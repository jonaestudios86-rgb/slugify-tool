import json, sys, time, urllib.request, urllib.parse
EPS=['https://overpass.openstreetmap.fr/api/interpreter','https://maps.mail.ru/osm/tools/overpass/api/interpreter']
def ovp(q, tries=6):
    last=None
    for i in range(tries):
        ep=EPS[i%len(EPS)]
        try:
            req=urllib.request.Request(ep, data=urllib.parse.urlencode({'data':q}).encode(), headers={'User-Agent':'depesca-dataset/1.0 (jonaestudios86@gmail.com)'})
            with urllib.request.urlopen(req, timeout=300) as r:
                j=json.load(r)
            if j.get('remark') and not j.get('elements'): raise RuntimeError(j['remark'])
            return j
        except Exception as e:
            last=e; print('retry',ep,e,file=sys.stderr); time.sleep(5*(i+1))
    raise last
if False:
    q='[out:json][timeout:280][maxsize:1000000000];area["ISO3166-1"="ES"][admin_level=2]->.a;(nwr["natural"="beach"](area.a);nwr["man_made"~"^(pier|breakwater)$"]["name"](area.a););out center tags;'
    t=time.time(); j=ovp(q); json.dump(j,open('beaches_raw.json','w'))
    print(len(j['elements']), 'elements', round(time.time()-t),'s')
