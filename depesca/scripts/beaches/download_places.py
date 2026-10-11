"""Descarga los núcleos de población (ciudades, pueblos, aldeas, barrios) de las cuadrículas que tienen playas."""
import glob, json, os, time
from overpass import ovp

os.makedirs('places', exist_ok=True)
tiles = []
for f in sorted(glob.glob('tiles/b_*.json')):
    if not json.load(open(f)): continue
    s, w = os.path.basename(f)[2:-5].split('_')
    tiles.append((float(s), float(w)))
print(len(tiles), 'cuadrículas con playas', flush=True)
for k, (s, w) in enumerate(tiles):
    out = f'places/p_{s}_{w}.json'
    if os.path.exists(out): continue
    bb = f'({s-0.1},{w-0.1},{s+1.1},{w+1.1})'
    q = f'[out:json][timeout:120];node["place"~"^(city|town|village|hamlet|suburb)$"]["name"]{bb};out;'
    try:
        j = ovp(q, tries=4)
        json.dump([[e['lat'], e['lon'], e['tags']['name'], e['tags']['place']] for e in j['elements']], open(out, 'w', encoding='utf-8'), ensure_ascii=False)
        print(k, len(tiles), s, w, len(j['elements']), flush=True)
    except Exception as e:
        print('FAIL', s, w, e, flush=True)
    time.sleep(0.5)
print('DONE', flush=True)
