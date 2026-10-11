import json, os, sys, time
from overpass import ovp
part=int(sys.argv[1]); nparts=int(sys.argv[2])
STEP=1.0
def frange(a,b): 
    x=a
    while x<=b: yield round(x,2); x+=1
tiles=[]
for s in frange(35.5,43.5):
    for w in frange(-9.5,3.5): tiles.append((s,w))     # mainland (+ Ceuta/Melilla, W Portugal skipped)
for s in (38.5,39.5):
    for w in (1.5,2.5,3.5): tiles.append((s,w))          # Baleares
for s in (27.5,28.5):
    for w in frange(-18.5,-13.5): tiles.append((s,w))    # Canarias
tiles=sorted(set(tiles))
mine=[t for i,t in enumerate(tiles) if i%nparts==part]
os.makedirs('tiles',exist_ok=True)
print(len(tiles),'total',len(mine),'mine',flush=True)
for k,(s,w) in enumerate(mine):
    f=f'tiles/b_{s}_{w}.json'
    if os.path.exists(f): continue
    bb=f'({s},{w},{s+STEP},{w+STEP})'
    q=f'[out:json][timeout:120];(nwr["natural"="beach"]{bb};nwr["man_made"~"^(pier|breakwater)$"]["name"]{bb};);out center tags;'
    try:
        j=ovp(q,tries=4); json.dump(j['elements'],open(f,'w')); print(k,len(mine),s,w,len(j['elements']),flush=True)
    except Exception as e: print('FAIL',s,w,e,flush=True)
    time.sleep(0.5)
print('DONE',flush=True)
