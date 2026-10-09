import { createElement, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { MAP_HTML, type MapHandle, type SpotMapProps } from './mapShared';

export type { MapHandle };

type MapWindow = Window & {
  setSpots?: (spots: unknown, selected: string | null) => void;
  setMe?: (lat: number, lon: number, center: boolean) => void;
  flyTo?: (lat: number, lon: number) => void;
  setScores?: (scores: Record<string, number>) => void;
};

/** Same Leaflet page as the native app, in an iframe. A srcDoc iframe shares our origin, so we call into it directly. */
export function SpotMap({ spots, selectedId, onSelect, onAdd, onPlace, onPlaces, handleRef }: SpotMapProps) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const ready = useRef(false);
  const latest = useRef({ spots, selectedId, onSelect, onAdd, onPlace, onPlaces });
  latest.current = { spots, selectedId, onSelect, onAdd, onPlace, onPlaces };

  const win = () => frame.current?.contentWindow as MapWindow | null | undefined;
  const push = () => {
    if (ready.current) win()?.setSpots?.(latest.current.spots, latest.current.selectedId);
  };
  useEffect(push, [spots, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    handleRef.current = {
      setMe: (lat, lon, center) => win()?.setMe?.(lat, lon, !!center),
      flyTo: (lat, lon) => win()?.flyTo?.(lat, lon),
      setScores: (scores) => win()?.setScores?.(scores),
    } satisfies MapHandle;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || typeof e.data?.depescaMap !== 'string') return;
      const m = JSON.parse(e.data.depescaMap);
      if (m.type === 'ready') {
        ready.current = true;
        push();
      } else if (m.type === 'select') latest.current.onSelect(m.id);
      else if (m.type === 'add') latest.current.onAdd(m.lat, m.lon);
      else if (m.type === 'places') latest.current.onPlaces?.(m.items, m.center);
      else if (m.type === 'place') latest.current.onPlace?.(m.lat, m.lon, m.name, { kind: m.kind, surface: m.surface, coast: m.coast });
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      handleRef.current = null;
    };
  }, [handleRef]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ flex: 1 }}>
      {createElement('iframe', {
        ref: frame,
        srcDoc: MAP_HTML,
        title: 'Mapa de spots',
        style: { border: 0, width: '100%', height: '100%', flex: 1 },
      })}
    </View>
  );
}
