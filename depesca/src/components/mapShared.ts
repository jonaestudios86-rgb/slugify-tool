import type { Spot } from '../lib/types';

export interface MapHandle {
  setMe: (lat: number, lon: number, center?: boolean) => void;
  flyTo: (lat: number, lon: number) => void;
  /** Fishing score (0-100) per imported place id, drawn inside its circle. */
  setScores: (scores: Record<string, number>) => void;
}

export interface PlaceInfo {
  kind: 'beach' | 'pier' | 'breakwater';
  surface?: string;
  /** Precomputed direction the coast faces (deg), when known. */
  orientation?: number;
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
  /** Imported places now on the map; the screen answers with `handleRef.setScores`. */
  onPlaces?: (places: { id: string; lat: number; lon: number; orientation?: number }[], center: { lat: number; lon: number }) => void;
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
 .then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(j){if(j.remark&&!(j.elements&&j.elements.length)&&/error|timed out|memory|too many/i.test(j.remark))throw 0;return j}).catch(function(e){if(k+1>=SEQ.length)throw e;return new Promise(function(ok){setTimeout(ok,1500*(k+1))}).then(function(){return ovp(q,k+1)})})}
var cmap={},scores={};
function lvl(s){return s>=85?'#22c55e':s>=70?'#3b82f6':s>=50?'#f59e0b':s>=30?'#f97316':'#ef4444'}
function dot(s,beach){var ring=beach?'#fff':'#d0b8ff';
 if(s==null)return L.divIcon({className:'',iconSize:[14,14],html:'<div style="width:14px;height:14px;border-radius:50%;background:'+(beach?'#4cc9f0':'#b388ff')+';border:2px solid '+ring+';box-sizing:border-box"></div>'});
 return L.divIcon({className:'',iconSize:[30,30],html:'<div style="width:30px;height:30px;border-radius:50%;background:'+lvl(s)+';border:2px solid '+ring+';box-sizing:border-box;color:#06121b;font:800 13px/26px sans-serif;text-align:center;box-shadow:0 1px 4px #0008">'+s+'</div>'})}
window.setScores=function(sc){for(var k in sc){scores[k]=sc[k];var c=cmap[k];if(c){c.m.setIcon(dot(sc[k],c.beach));c.m.setTooltipContent(c.label+' · pesca '+sc[k]+'/100')}}};
function announce(){var items=[],bb=map.getBounds();for(var k in cmap){if(scores[k]==null&&bb.contains([cmap[k].lat,cmap[k].lon]))items.push({id:k,lat:cmap[k].lat,lon:cmap[k].lon,orientation:cmap[k].o>=0?cmap[k].o:undefined})}
 if(items.length){var c=map.getCenter();post({type:'places',items:items.slice(0,300),center:{lat:c.lat,lon:c.lng}})}}
map.on('moveend',function(){setTimeout(announce,900)});
var cand=L.layerGroup(),candOn=true,seen={},lastBox=null,timer=null,busy=false,failed=false;
var ctl=L.control({position:'topleft'});
ctl.onAdd=function(){var d=L.DomUtil.create('div','leaflet-bar');d.style.cssText='background:#0b1d2aee;color:#fff;font:600 13px sans-serif;padding:8px 10px;border-radius:8px;cursor:pointer;margin-top:10px';
 d.innerHTML='\uD83C\uDFD6 Playas: <span id="cs">cargando…</span>';L.DomEvent.disableClickPropagation(d);
 d.onclick=function(){if(candOn&&failed){failed=false;lastBox=null;loadCand();return}candOn=!candOn;if(candOn){cand.addTo(map);lastBox=null;loadCand()}else{map.removeLayer(cand)}status()};return d};
ctl.addTo(map);cand.addTo(map);
function status(msg){var e=document.getElementById('cs');if(e)e.textContent=!candOn?'ocultas':(msg||'sí')}
function kind(t){return t.natural==='beach'?'Playa':t.man_made==='pier'?'Espigón':'Escollera'}
var DB=null,COV=null,dbState=0,KN=['beach','pier','breakwater'],KL=['Playa','Espigón','Escollera'];
function loadDB(cb){
 if(dbState===2)return cb(true);if(dbState===3)return cb(false);
 if(dbState===1)return setTimeout(function(){loadDB(cb)},150);
 dbState=1;
 fetch('/beaches-es.json').then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(j){DB=j.b;COV=j.cov;dbState=2;cb(true)}).catch(function(){dbState=3;cb(false)});
}
function addCand(k,la,lo,kd,name,surface,orient){
 if(seen[k])return;seen[k]=1;var beach=kd==='beach',label=KL[KN.indexOf(kd)]+(name?': '+name:'');
 var m=L.marker([la,lo],{icon:dot(scores[k]!=null?scores[k]:null,beach)}).addTo(cand);
 m.bindTooltip(label+(scores[k]!=null?' · pesca '+scores[k]+'/100':''));
 cmap[k]={m:m,beach:beach,label:label,lat:la,lon:lo,o:orient};
 m.on('click',function(){pick(la,lo,name||KL[KN.indexOf(kd)],kd,surface,orient)});
}
function pick(la,lo,nm,kd,surface,orient){
 if(orient!=null){post({type:'place',lat:la,lon:lo,name:nm,kind:kd,surface:surface,orientation:orient>=0?orient:undefined,coast:[]});return}
 status('analizando '+nm+'…');
 var q='[out:json][timeout:15];way(around:1200,'+la+','+lo+')["natural"="coastline"];out geom('+(la-0.015)+','+(lo-0.02)+','+(la+0.015)+','+(lo+0.02)+');';
 var done=false,go=function(coast){if(done)return;done=true;status();post({type:'place',lat:la,lon:lo,name:nm,kind:kd,surface:surface,coast:coast})};
 setTimeout(function(){go([])},12000);
 ovp(q).then(function(j){
  var segs=[],kx=Math.cos(la*Math.PI/180);
  j.elements.forEach(function(e){var g=e.geometry||[];for(var i=0;i+1<g.length&&segs.length<200;i++){
   var a=g[i],b=g[i+1];if(!a||!b)continue;var dA=Math.hypot((a.lon-lo)*kx,a.lat-la)*111320,dB=Math.hypot((b.lon-lo)*kx,b.lat-la)*111320;
   if(dA<2000||dB<2000)segs.push([[a.lat,a.lon],[b.lat,b.lon]])}});
  go(segs)}).catch(function(){go([])});
}
function fromDB(){
 var b=map.getBounds().pad(.1),c=map.getCenter(),s=b.getSouth(),n=b.getNorth(),w=b.getWest(),e=b.getEast(),list=[];
 for(var i=0;i<DB.length;i++){var r=DB[i];if(r[0]>=s&&r[0]<=n&&r[1]>=w&&r[1]<=e)list.push(i)}
 var d=function(i){return Math.hypot(DB[i][0]-c.lat,(DB[i][1]-c.lng)*.8)};
 list.sort(function(x,y){return d(x)-d(y)});
 if(Object.keys(cmap).length>900){cand.clearLayers();cmap={};seen={}}
 list.slice(0,300).forEach(function(i){var r=DB[i];addCand('d'+i,r[0],r[1],KN[r[3]],r[2],r[5],r[4])});
 failed=false;announce();status(list.length+' en la zona');
}
function loadLive(){
 var b=map.getBounds();
 if(lastBox&&lastBox.contains(b))return;
 var pb=b.pad(.15),q='[out:json][timeout:25];(nwr["natural"="beach"]('+pb.getSouth()+','+pb.getWest()+','+pb.getNorth()+','+pb.getEast()+');nwr["man_made"~"^(pier|breakwater)$"]["name"]('+pb.getSouth()+','+pb.getWest()+','+pb.getNorth()+','+pb.getEast()+'););out center 250;';
 if(busy)return;busy=true;failed=false;status('buscando…');
 ovp(q).then(function(j){
  lastBox=pb;var n=0;
  j.elements.forEach(function(e){var la=e.lat!=null?e.lat:e.center&&e.center.lat,lo=e.lon!=null?e.lon:e.center&&e.center.lon;
   if(la==null||lo==null)return;n++;var t=e.tags||{};
   addCand(e.type+e.id,la,lo,t.natural==='beach'?'beach':t.man_made==='pier'?'pier':'breakwater',t.name,t.surface,null)});
  announce();
  failed=false;if(!n)lastBox=null;status(n+' en la zona')}).catch(function(){lastBox=null;failed=true;status('sin datos · toca para reintentar')}).then(function(){busy=false});
}
function loadCand(){
 if(!candOn)return;
 if(map.getZoom()<10){status('acerca el zoom');return}
 loadDB(function(ok){
  var c=map.getCenter();
  if(ok&&COV&&c.lat>=COV[0]&&c.lat<=COV[2]&&c.lng>=COV[1]&&c.lng<=COV[3])fromDB();else loadLive();
 });
}
map.on('moveend',function(){clearTimeout(timer);timer=setTimeout(loadCand,250)});
function fit(){map.invalidateSize();clearTimeout(timer);timer=setTimeout(loadCand,400)}
window.addEventListener('resize',fit);if(window.ResizeObserver)new ResizeObserver(fit).observe(document.getElementById('m'));
setTimeout(fit,300);setTimeout(fit,1500);
map.on('contextmenu',function(e){post({type:'add',lat:e.latlng.lat,lon:e.latlng.lng})});
post({type:'ready'});
</script></body></html>`;
