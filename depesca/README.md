# DePesca (uso personal)

App móvil de pesca inspirada en la app RadarFish. Expo + React Native + TypeScript. Sin cuentas ni claves de API: los datos se guardan en el móvil.

## Funciones
- **Mapa** (OpenStreetMap + OpenSeaMap): spots con fondo, orientación de la costa, especies, técnicas y notas; favoritos; tu ubicación. Pulsación larga en el mapa para guardar un spot.
- **Predicción** (pestaña por spot, 7 días):
  - Puntuación 0-100 con nivel (Excelente, Bueno, Moderado, Flojo, Malo), mejor hora y explicación de qué pesa más.
  - Selector de día con la puntuación de cada uno.
  - Resumen: coeficiente de marea, viento, estado del mar estimado en tu costa, luna, presión, temperatura del agua y orientación.
  - Plan de pesca: ventana principal, alternativa y plan B con especie, técnica, señuelo o cebo y el motivo.
  - Tabla por hora: puntuación, olas, series, periodo, dirección, corriente, agua, viento, rachas, temperatura, presión, nubes y lluvia.
  - Coeficiente y horas de pleamar/bajamar.
  - Tabla solunar: fase lunar, amanecer/atardecer, salida/puesta de luna, períodos mayores y menores y mejores momentos.
  - Especie objetivo con distancia de lance recomendada.
  - Tus especies e historial de capturas en ese spot.
  - Tiendas de pesca cercanas (OpenStreetMap).
  - Guarda la última previsión para consultarla sin conexión.
- **Capturas**: foto, especie, peso, longitud, spot y notas, con estadísticas. “Pescar aquí” abre una captura nueva en ese spot.
- **Datos**: copia de seguridad (exportar e importar un archivo .json con spots, capturas y alertas; combinar o reemplazar).
- **Alertas**: reglas por spot (viento en km/h, oleaje, presión, marea, franja horaria) que programan notificaciones locales cuando el pronóstico las cumple.

## Uso
```
npm install
npx expo start      # abre con Expo Go en el móvil
npm test            # lógica de mareas, alertas y estadísticas
npm run typecheck
```

## Versión web (tu propio subdominio)
La web es estática: se genera una carpeta y se sube al hosting.

```
npm install
npm run build:web      # genera dist/
```

1. En el panel de tu hosting crea el subdominio (por ejemplo `pesca.tudominio.com`) y anota su carpeta raíz.
2. Activa HTTPS en ese subdominio (Let's Encrypt / AutoSSL). Sin HTTPS el navegador no da la ubicación ni deja instalarla en la pantalla de inicio.
3. Sube **el contenido** de `dist/` (no la carpeta) a la raíz del subdominio. Incluye el archivo oculto `.htaccess`: activa "mostrar archivos ocultos" en tu cliente FTP o administrador de archivos.
4. Abre la dirección. En el iPhone: Safari > Compartir > "Añadir a pantalla de inicio".

Para actualizar, repite `npm run build:web` y vuelve a subir `dist/`.

**Apache** (cPanel y la mayoría de hostings): `public/.htaccess` ya redirige a HTTPS, carga la app en cualquier ruta y ajusta la caché.

**Nginx**, dentro del `server` del subdominio:
```
root /ruta/al/subdominio;
location / { try_files $uri $uri/ /index.html; }
location ~* -[0-9a-f]{32}\.(js|css|png|ttf)$ { add_header Cache-Control "public, max-age=31536000, immutable"; }
```

**Limitaciones de la web:** los datos viven en el navegador de cada dispositivo (no se sincronizan entre ellos), no hay notificaciones y la cámara no está disponible: solo galería. Haz copias de seguridad desde la pestaña Datos.

## Limitaciones
- Datos de Open-Meteo (modelo global). El oleaje en tu costa se estima a partir de la orientación que indiques en el spot; defínela para que sea útil.
- Las mareas y el coeficiente son aproximaciones. El nivel del mar es del modelo y está referido al nivel medio, no al cero hidrográfico. Contrasta con las tablas oficiales.
- La puntuación, el plan de pesca, las especies y la distancia de lance son reglas orientativas (ver `src/lib/score.ts` y `src/lib/plan.ts`); ajústalas con tu experiencia.
- Las alertas se recalculan al abrir la app o pulsar “Comprobar”; no hay servidor que las dispare en segundo plano.
- El mapa y las tiendas necesitan conexión; la predicción usa la última copia guardada si no hay red.
- `.npmrc` activa `legacy-peer-deps` porque algunas dependencias de Expo declaran peers opcionales que chocan entre sí.
