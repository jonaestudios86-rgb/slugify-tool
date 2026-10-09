// Expo's "single" web output uses a fixed index.html template; add what makes the site installable on a phone.
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../dist/index.html', import.meta.url);
let html = readFileSync(file, 'utf8');

const head = `
    <meta name="description" content="Predicción de pesca, mapa de spots y registro de capturas." />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="DePesca" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800&display=swap" />
    <style>body{background-color:#0b1d2a}body,body *{font-family:'Barlow',system-ui,-apple-system,'Segoe UI',sans-serif}</style>
  `;

html = html
  .replace('<html lang="en">', '<html lang="es">')
  .replace('content="width=device-width, initial-scale=1, shrink-to-fit=no"', 'content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"')
  .replace('</head>', `${head}</head>`);

if (!html.includes('rel="manifest"')) throw new Error('postbuild-web: could not patch dist/index.html');
writeFileSync(file, html);
console.log('dist/index.html patched');
