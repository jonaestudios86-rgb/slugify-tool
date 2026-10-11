# Base de datos de playas (public/beaches-es.json)

Se genera una vez desde OpenStreetMap (Overpass) y se sirve como archivo estático: el mapa carga al instante y la orientación de cada playa ya viene calculada.

```
cd depesca/scripts/beaches
python download_tiles.py 0 2 &   # descarga playas, espigones y escolleras por cuadrículas (2 procesos)
python download_tiles.py 1 2
PYTHONIOENCODING=utf-8 python build.py   # une, quita duplicados, calcula la orientación (línea de costa) y escribe beaches-es.json
cp beaches-es.json ../../public/beaches-es.json
```

Formato: `{"v":1,"cov":[sur,oeste,norte,este],"b":[[lat,lon,nombre|null,tipo,orientación|-1,suelo|null],...]}`
con tipo 0 = playa, 1 = espigón, 2 = escollera. Fuera de `cov` el mapa consulta Overpass en directo.
