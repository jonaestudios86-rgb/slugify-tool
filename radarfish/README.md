# RadarFish (uso personal)

App móvil de pesca inspirada en RadarFish. Expo + React Native + TypeScript. Sin cuentas ni claves de API: los datos se guardan en el móvil.

## Funciones
- **Mapa** (OpenStreetMap + OpenSeaMap): spots con fondo, especies, técnicas y notas; favoritos; tu ubicación. Pulsación larga en el mapa para guardar un spot.
- **Condiciones**: oleaje, temperatura del agua, viento, presión y nivel del mar a 5 días (Open-Meteo), con pleamares/bajamares derivadas del nivel del mar.
- **Capturas**: foto, especie, peso, longitud, spot y notas, con estadísticas.
- **Alertas**: reglas por spot (viento, oleaje, presión, marea, franja horaria) que programan notificaciones locales cuando el pronóstico las cumple.

## Uso
```
npm install
npx expo start      # abre con Expo Go en el móvil
npm test            # lógica de mareas, alertas y estadísticas
npm run typecheck
```

## Limitaciones
- Las mareas son aproximadas (modelo global de baja resolución); contrasta con las tablas oficiales.
- Las alertas se recalculan al abrir la app o pulsar “Comprobar”; no hay servidor que las dispare en segundo plano.
- El mapa necesita conexión (no hay mapas sin conexión).
- La ficha de la app original no detalla sus fuentes de datos, así que esta versión usa las suyas propias.
