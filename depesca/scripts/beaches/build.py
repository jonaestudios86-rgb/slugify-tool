import json, glob, math, os, sys, time
from collections import defaultdict
from overpass import ovp

# ---- 1. merge tiles
els={}
for f in glob.glob('tiles/b_*.json'):
    for e in json.load(open(f)):
        els[(e['type'],e['id'])]=e
print('raw elements',len(els))
pts=[]
for (t,i),e in els.items():
    la=e.get('lat') if 'lat' in e else (e.get('center') or {}).get('lat')
    lo=e.get('lon') if 'lon' in e else (e.get('center') or {}).get('lon')
    if la is None or lo is None: continue
    tg=e.get('tags',{})
    kind=0 if tg.get('natural')=='beach' else (1 if tg.get('man_made')=='pier' else 2)
    name=(tg.get('name') or tg.get('name:es') or '').strip()
    pts.append([la,lo,name,kind,tg.get('surface','')])
print('with coords',len(pts))

# ---- 2. dedupe (same kind+name within 400 m, unnamed within 120 m)
def d_m(a,b):
    return math.hypot((a[0]-b[0])*111320,(a[1]-b[1])*111320*math.cos(math.radians(a[0])))
cell=defaultdict(list); out=[]
for p in sorted(pts,key=lambda p:(not p[2],p[0],p[1])):
    ck=(round(p[0]/0.005),round(p[1]/0.005)); dup=False
    lim=400 if p[2] else 120
    for dx in (-1,0,1):
        for dy in (-1,0,1):
            for q in cell[(ck[0]+dx,ck[1]+dy)]:
                if q[3]==p[3] and (q[2]==p[2] or not p[2]) and d_m(p,q)<lim: dup=True; break
            if dup: break
        if dup: break
    if not dup: cell[ck].append(p); out.append(p)
print('after dedupe',len(out))

# ---- 3. coastline orientation per tile
tilesWith=defaultdict(list)
for i,p in enumerate(out): tilesWith[(math.floor(p[0]),math.floor(p[1]))].append(i)
GRID=0.02
for p in out: p.append(-1)
def seg_index(ways):
    idx=defaultdict(list)
    for g in ways:
        for a,b in zip(g,g[1:]):
            if not a or not b: continue
            ci=set()
            n=max(1,int(max(abs(a[0]-b[0]),abs(a[1]-b[1]))/GRID)+1)
            for k in range(n+1):
                t=k/n; ci.add((math.floor((a[0]+(b[0]-a[0])*t)/GRID),math.floor((a[1]+(b[1]-a[1])*t)/GRID)))
            for c in ci: idx[c].append((a,b))
    return idx
def bearing(a,b):
    r=math.pi/180
    y=math.sin((b[1]-a[1])*r)*math.cos(b[0]*r)
    x=math.cos(a[0]*r)*math.sin(b[0]*r)-math.sin(a[0]*r)*math.cos(b[0]*r)*math.cos((b[1]-a[1])*r)
    return (math.degrees(math.atan2(y,x))+360)%360
def orient(p,idx):
    best=None
    cy,cx=math.floor(p[0]/GRID),math.floor(p[1]/GRID)
    kx=math.cos(math.radians(p[0]))
    for dy in (-1,0,1):
        for dx in (-1,0,1):
            for a,b in idx.get((cy+dy,cx+dx),()):
                ax,ay=(a[1]-p[1])*kx,a[0]-p[0]; bx,by=(b[1]-p[1])*kx,b[0]-p[0]
                ddx,ddy=bx-ax,by-ay; l2=ddx*ddx+ddy*ddy or 1e-12
                t=max(0,min(1,-(ax*ddx+ay*ddy)/l2))
                d=math.hypot(ax+t*ddx,ay+t*ddy)*111320
                if d<2000 and (best is None or d<best[0]): best=(d,(bearing(a,b)+90)%360)
    return None if best is None else int(round(best[1]/45)*45)%360
os.makedirs('coast',exist_ok=True)
for n,((s,w),ids) in enumerate(sorted(tilesWith.items())):
    f=f'coast/c_{s}_{w}.json'
    if not os.path.exists(f):
        bb=f'({s-0.05},{w-0.05},{s+1.05},{w+1.05})'
        q=f'[out:json][timeout:120];way["natural"="coastline"]{bb};out geom{bb};'
        try:
            j=ovp(q,tries=4); json.dump([[ [ (pt['lat'],pt['lon']) if pt else None for pt in e.get('geometry',[])] for e in j['elements'] ]][0],open(f,'w')); print('coast',n,len(tilesWith),s,w,len(j['elements']),flush=True)
        except Exception as e:
            print('COAST FAIL',s,w,e,flush=True); continue
        time.sleep(0.5)
    ways=json.load(open(f)); idx=seg_index(ways)
    for i in ids: 
        o=orient(out[i],idx)
        if o is not None: out[i][5]=o
known=sum(1 for p in out if p[5]>=0)
print('with orientation',known,'of',len(out))
b=[[round(p[0],4),round(p[1],4),p[2] or None,p[3],p[5],p[4] or None] for p in sorted(out,key=lambda p:(p[0],p[1]))]
json.dump({'v':1,'cov':[27.5,-18.5,44.5,4.5],'b':b},open('beaches-es.json','w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
print('size',os.path.getsize('beaches-es.json'))
