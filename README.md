# Boca Juniors PWA 📱💛💙

App no oficial de Boca Juniors instalable en cualquier celular como una app nativa.

**Incluye:**
- 🏆 Fixture en vivo (próximos partidos, resultados, tabla de posiciones)
- 📰 Noticias actualizadas de Planeta Boca, Olé y TyC Sports
- 📺 Videos del canal oficial de YouTube
- 📅 Botón "Agregar al calendario" en cada partido
- 🔄 Auto-actualización (noticias cada 30 min, fixture cada 1h)
- 🎨 Diseño con la identidad visual de Boca (azul-oro)
- 📱 Funciona offline (caché inteligente)

---

## 🚀 Cómo deployar (paso a paso, ~5 minutos)

### Opción 1: Vercel (recomendado, más fácil)

1. **Creá una cuenta gratis en [vercel.com](https://vercel.com)** (podés usar tu Google o GitHub).

2. **Subí el proyecto:**
   - Descargá esta carpeta `boca-pwa` completa.
   - Andá a [vercel.com/new](https://vercel.com/new).
   - Hacé clic en **"Import"** y arrastrá la carpeta entera.
   - Vercel detecta automáticamente que es un proyecto Vite. Hacé clic en **"Deploy"**.
   - En menos de 1 minuto te da una URL del estilo `boca-pwa-tunombre.vercel.app`.

3. **¡Listo!** Esa URL es tu app.

### Opción 2: Netlify

1. **Creá una cuenta gratis en [netlify.com](https://netlify.com).**
2. Hacé clic en **"Add new site"** → **"Deploy manually"**.
3. Arrastrá la carpeta `boca-pwa` ENTERA (Netlify la construye solo).
4. Te da una URL.

### Opción 3: Build manual + cualquier hosting

Si querés controlar el build vos:

```bash
cd boca-pwa
npm install
npm run build
```

La carpeta `dist/` resultante es lo que subís a cualquier hosting estático (Cloudflare Pages, GitHub Pages, etc).

---

## 📲 Cómo instalar en tu celular (después de deployar)

### Android (Chrome)
1. Abrí la URL de Vercel/Netlify en Chrome.
2. Tocá los 3 puntos arriba a la derecha.
3. Tocá **"Instalar app"** o **"Agregar a la pantalla de inicio"**.
4. Aceptá. Ya tenés la app con su ícono en tu home screen.

### iPhone (Safari)
1. Abrí la URL en Safari (NO en Chrome — en iOS solo Safari permite instalar PWAs).
2. Tocá el ícono de compartir (cuadrado con flecha).
3. Tocá **"Agregar a pantalla de inicio"**.
4. Confirmá. Aparece como una app más.

Una vez instalada:
- Abre a pantalla completa (sin barra de navegador).
- Tiene el ícono de la bandera de Boca.
- Funciona offline (con datos cacheados).
- Se actualiza automáticamente cuando deployás cambios nuevos.

---

## 🛠️ Desarrollo local

Para probar en tu compu antes de deployar:

```bash
cd boca-pwa
npm install
npm run dev
```

Abre `http://localhost:5173` en tu navegador.

---

## 📂 Estructura del proyecto

```
boca-pwa/
├── public/
│   ├── favicon.svg            # Bandera de Boca para el navegador
│   ├── icon-192.png           # Ícono PWA chico
│   ├── icon-512.png           # Ícono PWA grande
│   ├── icon-512-maskable.png  # Ícono adaptable Android
│   └── apple-touch-icon.png   # Ícono iOS
├── src/
│   ├── main.jsx               # Punto de entrada
│   └── BocaJuniorsApp.jsx     # Componente principal
├── index.html                 # HTML base
├── vite.config.js             # Configuración de Vite + PWA
└── package.json
```

---

## 🔧 Personalización

### Cambiar el ID de Boca o las ligas
Editá `src/BocaJuniorsApp.jsx` y buscá:
```js
const BOCA_TEAM_ID = '135156';
const LEAGUES = { ... };
```

### Cambiar las fuentes de noticias
Editá el array `NEWS_SOURCES` en el mismo archivo.

### Cambiar los colores
Buscá el objeto `colors` y modificá los valores.

---

## ⚠️ Notas importantes

1. **Las APIs son públicas y gratuitas:**
   - [TheSportsDB](https://www.thesportsdb.com) (fixture, resultados, tabla)
   - [rss2json](https://rss2json.com) (parseo de RSS)
   - [AllOrigins](https://allorigins.win) (proxy CORS de respaldo)

2. **Si una API se cae** la app sigue funcionando con las otras secciones.

3. **TheSportsDB es crowd-sourced**, a veces los datos pueden estar desactualizados unos días.

4. **Esto es un proyecto NO oficial.** No tiene afiliación con el Club Atlético Boca Juniors.

---

¡Vamos Boca! 💙💛💙
