# Asset Manifest — SOTSI Webflow Template

Todos los assets viven en `webflow-template/assets/`. **Súbelos al Asset Manager de Webflow** o sírvelos por tu host (jsDelivr/GitHub Pages) — ver `BUILD-GUIDE.md`.

Formato de imágenes: **WebP** (optimizado, con `srcset` para slides). Todas las `<img>` llevan `width`/`height` intrínsecos (evita CLS). Mantén los nombres de archivo: el HTML/JS los referencia tal cual.

## Logos
- `assets/whitelogo.webp` — logo blanco (sobre nav oscuro)
- `assets/darklogo.webp` — logo oscuro (sobre nav claro)

## Favicon (`assets/favicon/`)
- `favicon.ico`, `favicon-32x32.png`, `favicon-16x16.png`, `apple-touch-icon.png`

## Héroe — slides (`assets/images/slides/`)
LCP del Home (preload recomendado): `beach-creating-authentic-power-clean.webp` (+ `-768`, `-1280` responsive).
- `beach-creating-authentic-power-clean.webp` / `-768.webp` / `-1280.webp`
- `SOTSI-Site-Carousel-1.webp` / `-1-768.webp`
- `SOTSI-Site-Carousel-2.webp` / `-2-768.webp`
- `SOTSI-Site-Carousel-4.webp`, `SOTSI-Site-Carousel-6.webp`, `SOTSI-Site-Carousel-8.webp`

## Video (`assets/`)
- `SOTS-Homepage-Video-web.mp4` (~11 MB) — video del héroe/greeting (optimizado web). **Este es el que se usa.**
- `The-Seat-Of-The-Soul-Home_Woman.mp4` (~0.5 MB) — clip secundario.
> El fuente sin optimizar (`SOTS-Homepage-Video.mp4`, ~77 MB) **fue removido del paquete**. Si necesitas re-exportar, está en la carpeta original `sotsi landing/assets/`.

## Greeting / Consciousness / Founders / Books / Membership
- `images/greeting-poster.webp`, `images/Home-page-video-Thumbnail_image.webp`
- `images/6a3342a6143842a748166485_1220.webp` (consciousness)
- `images/seat.webp` (founders — Gary & Linda)
- `images/latest-books.webp` (books)
- `images/6a3342a6143842a748166484_..._sunset-100.webp` (membership)
- `images/Gary_outside_smiling_cb_146-scaled.jpg`, `images/Linda_cb_015.jpg`

## Testimonios / Praise (`assets/images/`)
oprah, gwyneth-paltrow, paulo-coelho, julianne-hough, andre-duqum, jay-z, lewis-howes, maya-angelou (archivos `6a3342…_*-testimonial.webp` / `*-endorsement.webp` / `*-review.webp`).

## Stats / Community
- `images/6a3342a6143842a74816646c_millions-of-people-reached...webp`
- `images/6a3342a6143842a748166452_...community.webp`, `..._454_...gary-zukav.webp`
- `images/6a3342a6143842a748166468_...emotional-awareness...webp`, `..._46a_...best-seller.webp`

## Instagram feed (mock)
- `assets/js/instafeed.js` + `assets/data/instagram-feed.json` (datos mock).
- Producción: el token de Meta **NUNCA** va en el cliente → un job server-side (p.ej. GitHub Action) escribe el JSON; el cliente solo hace `fetch()`. Ver `instafeed.js`.

---

### Conteo
- Imágenes en `assets/images/**`: ~72 archivos (incluye variantes responsive y algunas no usadas en el Home actual; las requeridas están arriba).
- JS: `app.js`, `soul-tide.js`, `instafeed.js`.
- **Sin fuentes self-hosted** (el template usa Google Fonts) — `assets/fonts/` fue eliminado.
