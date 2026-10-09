import type { Spot } from '../lib/types';

export interface MapHandle {
  setMe: (lat: number, lon: number, center?: boolean) => void;
  flyTo: (lat: number, lon: number) => void;
}

export interface SpotMapProps {
  spots: Spot[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (lat: number, lon: number) => void;
  handleRef: React.MutableRefObject<MapHandle | null>;
}

/** Leaflet page shared by the native WebView and the web iframe. Tiles: OpenStreetMap + OpenSeaMap. */
export const MAP_HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{height:100%;margin:0;background:#0b1d2a}</style></head><body><div id="m"></div><script>
var map=L.map('m',{zoomControl:false}).setView([40.2,-3.7],6);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',{maxZoom:18}).addTo(map);
var layer=L.layerGroup().addTo(map),me=null,fitted=false;
function post(o){var t=JSON.stringify(o);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(t);else window.parent.postMessage({depescaMap:t},'*')}
window.setSpots=function(spots,sel){layer.clearLayers();spots.forEach(function(s){
 var m=L.circleMarker([s.lat,s.lon],{radius:s.id===sel?11:8,color:s.favorite?'#f4b942':'#2ec4b6',fillColor:s.favorite?'#f4b942':'#2ec4b6',fillOpacity:.7,weight:s.id===sel?4:2}).addTo(layer);
 m.bindTooltip(s.name);m.on('click',function(){post({type:'select',id:s.id})});});
 if(!fitted&&spots.length){fitted=true;map.fitBounds(L.latLngBounds(spots.map(function(s){return [s.lat,s.lon]})).pad(.3),{maxZoom:12})}};
window.setMe=function(lat,lon,center){if(me)map.removeLayer(me);me=L.circleMarker([lat,lon],{radius:6,color:'#fff',fillColor:'#3a86ff',fillOpacity:1}).addTo(map);if(center)map.setView([lat,lon],12)};
window.flyTo=function(lat,lon){map.setView([lat,lon],13)};
map.on('contextmenu',function(e){post({type:'add',lat:e.latlng.lat,lon:e.latlng.lng})});
post({type:'ready'});
</script></body></html>`;
