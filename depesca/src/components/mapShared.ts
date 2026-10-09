import type { Spot } from '../lib/types';

export interface MapHandle {
  setMe: (lat: number, lon: number, center?: boolean) => void;
  flyTo: (lat: number, lon: number) => void;
}

export interface PlaceInfo {
  kind: 'beach' | 'pier' | 'breakwater';
  surface?: string;
  /** Coastline segments [[lat,lon],[lat,lon]] near the place, to work out which way the coast faces. */
  coast: [number, number][][];
}

export interface SpotMapProps {
  spots: Spot[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (lat: number, lon: number) => void;
  /** A beach / pier loaded from OpenStreetMap was tapped. */
  onPlace?: (lat: number, lon: number, name: string, info: PlaceInfo) => void;
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
var OVP=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.private.coffee/api/interpreter'];
var SEQ=[0,0,1,0,2];
function ovp(q,k){k=k||0;return fetch(OVP[SEQ[k]],{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(q)})
 .then(function(r){if(!r.ok)throw 0;return r.json()}).catch(function(e){if(k+1>=SEQ.length)throw e;return new Promise(function(ok){setTimeout(ok,1500*(k+1))}).then(function(){return ovp(q,k+1)})})}
var cand=L.layerGroup(),candOn=true,seen={},lastBox=null,timer=null,busy=false;
var ctl=L.control({position:'topleft'});
ctl.onAdd=function(){var d=L.DomUtil.create('div','leaflet-bar');d.style.cssText='background:#0b1d2aee;color:#fff;font:600 13px sans-serif;padding:8px 10px;border-radius:8px;cursor:pointer;margin-top:10px';
 d.innerHTML='\uD83C\uDFD6 Playas: <span id="cs">cargando…</span>';L.DomEvent.disableClickPropagation(d);
 d.onclick=function(){candOn=!candOn;if(candOn){cand.addTo(map);lastBox=null;loadCand()}else{map.removeLayer(cand)}status()};return d};
ctl.addTo(map);cand.addTo(map);
function status(msg){var e=document.getElementById('cs');if(e)e.textContent=!candOn?'ocultas':(msg||'sí')}
function kind(t){return t.natural==='beach'?'Playa':t.man_made==='pier'?'Espigón':'Escollera'}
function pick(la,lo,nm,kd,surface){
 status('analizando '+nm+'…');
 var q='[out:json][timeout:15];way(around:1500,'+la+','+lo+')["natural"="coastline"];out geom;';
 var done=false,go=function(coast){if(done)return;done=true;status();post({type:'place',lat:la,lon:lo,name:nm,kind:kd,surface:surface,coast:coast})};
 setTimeout(function(){go([])},20000);
 ovp(q).then(function(j){
  var segs=[],kx=Math.cos(la*Math.PI/180);
  j.elements.forEach(function(e){var g=e.geometry||[];for(var i=0;i+1<g.length&&segs.length<200;i++){
   var a=g[i],b=g[i+1],dA=Math.hypot((a.lon-lo)*kx,a.lat-la)*111320,dB=Math.hypot((b.lon-lo)*kx,b.lat-la)*111320;
   if(dA<2000||dB<2000)segs.push([[a.lat,a.lon],[b.lat,b.lon]])}});
  go(segs)}).catch(function(){go([])});
}
function loadCand(){
 if(!candOn)return;
 if(map.getZoom()<10){status('acerca el zoom');return}
 var b=map.getBounds();
 if(lastBox&&lastBox.contains(b))return;
 var pb=b.pad(.3),q='[out:json][timeout:25];(nwr["natural"="beach"]('+pb.getSouth()+','+pb.getWest()+','+pb.getNorth()+','+pb.getEast()+');nwr["man_made"~"^(pier|breakwater)$"]["name"]('+pb.getSouth()+','+pb.getWest()+','+pb.getNorth()+','+pb.getEast()+'););out center 250;';
 if(busy)return;busy=true;status('buscando…');
 ovp(q).then(function(j){
  lastBox=pb;var n=0;
  j.elements.forEach(function(e){var la=e.lat!=null?e.lat:e.center&&e.center.lat,lo=e.lon!=null?e.lon:e.center&&e.center.lon,k=e.type+e.id;
   if(la==null||lo==null)return;n++;if(seen[k])return;seen[k]=1;
   var t=e.tags||{},nm=t.name||kind(t),beach=t.natural==='beach';
   var m=L.circleMarker([la,lo],{radius:beach?6:5,color:'#fff',weight:1,fillColor:beach?'#4cc9f0':'#b388ff',fillOpacity:.85}).addTo(cand);
   m.bindTooltip(kind(t)+(t.name?': '+t.name:''));
   m.on('click',function(){pick(la,lo,nm,t.natural==='beach'?'beach':t.man_made==='pier'?'pier':'breakwater',t.surface)})});
  status(n+' en la zona')}).catch(function(){lastBox=null;status('sin conexión')}).then(function(){busy=false});
}
map.on('moveend',function(){clearTimeout(timer);timer=setTimeout(loadCand,600)});
setTimeout(loadCand,800);
map.on('contextmenu',function(e){post({type:'add',lat:e.latlng.lat,lon:e.latlng.lng})});
post({type:'ready'});
</script></body></html>`;
