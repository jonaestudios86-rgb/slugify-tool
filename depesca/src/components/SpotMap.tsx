import { useEffect, useRef } from 'react';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import { MAP_HTML, type MapHandle, type SpotMapProps } from './mapShared';

export type { MapHandle };



/** Leaflet + OpenStreetMap/OpenSeaMap in a WebView: no API keys. Long-press the map to add a spot. */
export function SpotMap({ spots, selectedId, onSelect, onAdd, onPlace, onPlaces, handleRef }: SpotMapProps) {
  const web = useRef<WebView>(null);
  const ready = useRef(false);
  const run = (js: string) => web.current?.injectJavaScript(js + ';true;');

  const push = () => {
    if (ready.current) run(`setSpots(${JSON.stringify(spots)},${JSON.stringify(selectedId)})`);
  };
  useEffect(push, [spots, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    handleRef.current = {
      setMe: (lat, lon, center) => run(`setMe(${lat},${lon},${!!center})`),
      flyTo: (lat, lon) => run(`flyTo(${lat},${lon})`),
      setScores: (scores) => run(`setScores(${JSON.stringify(scores)})`),
    };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef]);

  const onMessage = (e: WebViewMessageEvent) => {
    const m = JSON.parse(e.nativeEvent.data);
    if (m.type === 'ready') {
      ready.current = true;
      push();
    } else if (m.type === 'select') onSelect(m.id);
    else if (m.type === 'add') onAdd(m.lat, m.lon);
    else if (m.type === 'places') onPlaces?.(m.items, m.center);
    else if (m.type === 'place') onPlace?.(m.lat, m.lon, m.name, { kind: m.kind, surface: m.surface, coast: m.coast });
  };

  return <WebView ref={web} originWhitelist={['*']} source={{ html: MAP_HTML, baseUrl: 'https://localhost' }} onMessage={onMessage} javaScriptEnabled style={{ flex: 1 }} />;
}
