# SOTSI Landing → Webflow Template — Build & Install Guide

Convierte el Home de SOTSI (sitio estático) en un **template de Webflow clonable** manteniendo los efectos idénticos. Enfoque **híbrido fiel**: estructura recreable en Webflow + efectos a medida servidos como código (CSS/JS externos). Tipografía cambiada a **fuentes licenciadas** (Fraunces + Inter + Dancing/Pinyon Script, todas Google Fonts).

---

## 0. Qué contiene este paquete (`webflow-template/`)

```
index.template.html      ← blueprint del DOM (1 sola variante, sin dev-switcher) + preview local
styles/                  ← 9 CSS reales (fuentes ya cambiadas a licenciadas; sin @font-face self-hosted)
assets/
  js/app.js              ← interacciones (slider, nav, parallax, count-up, carruseles, ink-drop)
  js/soul-tide.js        ← efecto canvas "Soul Tide" + text-wave GSAP
  js/instafeed.js        ← feed IG (mock → Meta API)
  images/ … video … favicon/
webflow-custom-code.md   ← snippets exactos head/footer + body class
asset-manifest.md        ← lista de assets a subir/host
BUILD-GUIDE.md           ← este archivo
```

## 1. Requisitos
- Cuenta **Webflow con plan de pago** (Core+/Site plan) — el custom code lo exige.
- Un host para CSS/JS/imágenes (ver §3) **o** subirlos al Asset Manager de Webflow.

## 2. Preview local (verificar antes de Webflow)
```bash
cd "sotsi landing/webflow-template"
python3 -m http.server 8099
# abrir http://127.0.0.1:8099/index.template.html
```
Debes ver: héroe con "Creating **Authentic Power**", el canvas de puntos "Soul Tide" en *DO YOU WANT…*, fuentes Fraunces, slider/nav/scroll-reveal funcionando. (Ya verificado en build.)

## 3. Hosting de CSS/JS (elige una)

**Opción A — jsDelivr sobre el repo público (rápida).**
1. Empuja la carpeta `webflow-template/` al repo público (p.ej. `devReneceo/SOTSI-website`).
2. `{BASE_URL}` = `https://cdn.jsdelivr.net/gh/devReneceo/SOTSI-website@main/webflow-template`
3. En producción cambia `@main` por un **tag fijo** (`@v1.0.0`) para no romper por cambios.

**Opción B — autocontenido en Webflow (distribuible).**
- Sube `app.js`, `soul-tide.js`, `instafeed.js` y los 9 CSS al **Asset Manager** (o pega cada CSS en un Embed si cabe <50 KB) y usa esas URLs como `{BASE_URL}`.
- Más trabajo, pero el clon no depende de hosts externos (mejor para vender el template).

> GSAP siempre viene de su CDN (jsDelivr). Si lo quieres autocontenido, sube también los 3 archivos GSAP.

## 4. Configurar el sitio Webflow

1. Crea el sitio + la página **Home**.
2. **Site Settings → Custom Code:** pega el **Head Code** y el **Footer Code** de `webflow-custom-code.md` (reemplaza `{BASE_URL}`).
3. Selecciona el **Body** y añade la combo-class (de `webflow-custom-code.md` §3):
   `nav-dark cta-grad nl-immersive hero-original heroheight-full heroborder-on navsize-m logosize-m logoframe-2 btnstyle-2 herocta-2 font-fraunces anim-ink`
4. Sube los assets (ver `asset-manifest.md`) o referencia tu host.

## 5. Recrear el contenido (método híbrido fiel)

> **Por qué así:** los efectos enganchan por **clases y `data-` exactos**. Si recreas el mismo DOM, el CSS y el JS se aplican solos y el resultado es idéntico.

**Método recomendado (máxima fidelidad, menor esfuerzo):**
Por cada sección, crea un **Section** nativo en Webflow y, dentro, un bloque **HTML Embed** con el markup de esa sección **copiado de `index.template.html`** (rangos en la tabla §5.1). El CSS/JS global hace el resto.
- Mantén intactas clases, `id` y atributos `data-*`.
- Los `<canvas>` y SVG inline van tal cual dentro del Embed.
- El texto sigue siendo editable (en el código del Embed). Para edición visual total, ver §5.2.

**Variantes:** el archivo trae nav y héroe con variantes alternas ocultas por CSS. Usa solo las **activas**:
- **Nav:** `#navImmersive` (immersive). Ignora `#navCentered` y `#navBar`.
- **Héroe:** `.oslider` dentro de `.hero-original-wrap` (original, 5 slides). Ignora `.hslider` y `.heroA`.

### 5.1 Mapa de secciones (líneas en `index.template.html`)

| # | Sección | Líneas | Hooks clave (clases / `data-`) | ¿Canvas? |
|---|---------|--------|--------------------------------|:---:|
| — | **Nav (immersive)** | 116–148 | `.snav.snav--immersive`, `.has-dd`, `[data-burger]`, `[data-mobile]`, `.logo--for-dark/light` | — |
| 1 | **Hero (original)** | 232–310 (+ wrapper `.hero-original-wrap`) | `.oslider`, `.oslide[data-oslide][data-status]`, `.oslide__script/title/lead`, `.oslider__dots/arrows` | — |
| 2 | **Aspiration** | 335–361 | `#aspire`, **`<canvas class="aspire__waves tw-tide">`**, `.aspire__word(.--accent)` (GSAP SplitText) | ✅ |
| 3 | Statement | 362–372 | `.statement--tide`, `.accent` | — |
| 4 | Greeting (video) | 373–402 | `.greeting__video`, `.greeting__script` | — |
| 5 | Consciousness | 403–429 | `.consciousness__intro/aside/img` | — |
| 6 | Tools | 430–443 | `.textwave`, `[data-wave-line]` | — |
| 7 | **Event** | 444–476 | **`<canvas class="event__waves tw-tide">`**, `[data-wave-line][data-wave-base][data-wave-crest]`, `.event__connector` | ✅ |
| 8 | Books | 477–501 | `.textwave`, `.books__img` (float), `[data-wave-line]` | — |
| 9 | Courses | 502–557 | `.courses__grid`, `.ccard` (bento 4) | — |
| 10 | Membership | 558–573 | `.membership__media`, `.accent` | — |
| 11 | Stats | 574–589 | `.stat__number[data-target]` (count-up) | — |
| 12 | Praise | 590–666 | `.praise__carousel`, `.praise__slide`, `.praise__nav/dots` | — |
| 13 | Instafeed | 667–700 | `.instafeed__grid`, `.post.post--glow` (spotlight) | — |
| 14 | Founders | 701–730 | `.founders--immersive`, `.founders__script/halo/portrait` | — |
| 15 | Blog · Soul Feed | 731–782 | `.blog__grid`, `.post` | — |
| 16 | Big CTA | 783–794 | `.bigcta__media/scrim`, `.gold` | — |
| — | **Footer** | 795–fin | `.site-footer`, `.foot__*`, `#footYear` (año auto) | — |

> Importante: en Aspiration y Event, el `<canvas>` debe ir **dentro** de su sección (`#aspire` / `.event`) — `soul-tide.js` busca `section.querySelector('canvas')`.

### 5.2 (Opcional) Rebuild 100% nativo para editar en el Designer
Cualquier sección **estática** (Courses, Stats, Membership, CTA, Footer, Blog) puede reconstruirse con elementos nativos de Webflow **usando exactamente las mismas clases** de la tabla — así el CSS aplica y queda editable en el Designer. Para las secciones **con efecto** (Hero, Aspiration, Event, Praise, Instafeed) conviene dejar el Embed (los efectos dependen del DOM/JS exacto).

## 6. Checklist de efectos (deben funcionar al terminar §4–5)
- [ ] **Hero** `.oslider`: autoplay 12s, dots, cursor circular, ripple en transición, parallax con mouse (desktop).
- [ ] **Soul Tide canvas** en Aspiration y Event (campo de puntos periwinkle→dorado, reacciona al scroll).
- [ ] **Text-wave GSAP** en Aspiration / Tools / Event (entrada letra-a-letra + color scrub al scroll). Requiere GSAP cargado.
- [ ] **Ink-drop** de entrada en héroe y secciones (`anim-ink`).
- [ ] **Count-up** en Stats al entrar en viewport.
- [ ] **Praise carousel** (autoplay 9s, swipe, flechas, teclado).
- [ ] **Instafeed** spotlight glow siguiendo el cursor.
- [ ] **Nav** colapsa al scrollear >60px; **drawer móvil** con hamburguesa.
- [ ] **Footer** muestra el año actual (`#footYear`).
- [ ] **Reduced motion:** con `prefers-reduced-motion`, animaciones/canvas se detienen.

## 7. QA antes de publicar
- Breakpoints **320 / 375 / 768 / 1024 / 1440 / 1920**: sin overflow horizontal.
- Cross-browser **Chrome / Firefox / Safari** (canvas + `mask-image` del cursor-lens; probar prefijo `-webkit-`).
- Performance: GSAP por CDN async; imágenes con `width/height`; preload del LCP del héroe.
- Skills útiles: `webflow-skills:pre-deploy-check`, `:link-checker`, `:accessibility-audit`, `:asset-audit`, luego `:safe-publish`.

## 8. Empaquetar como template (cómo se "instala")
Webflow no tiene "instalar HTML". La vía real para distribuir manteniendo el custom code es **cloneable**:
1. Termina y publica el sitio a staging.
2. **Made in Webflow → Share / "Clone in Webflow"**: genera un enlace clonable.
3. Quien lo "instala" hace **Clone** → obtiene una copia del proyecto completo (con el custom code y la estructura).

> **Marketplace:** este template **no** es elegible para el Webflow Marketplace porque usa custom code (canvas/GSAP), prohibido en plantillas del Marketplace. Es por diseño (fidelidad de efectos). El canal correcto es **cloneable** / entrega directa al cliente.

## 9. Limitaciones conocidas
- **Custom code = caja parcial:** las secciones por Embed no se editan con las herramientas visuales del Designer (sí su HTML).
- **Dependencia GSAP CDN** en runtime (hazlo autocontenido si lo necesitas).
- **Instagram feed:** el token de Meta va server-side; el cliente solo lee un JSON.
- **jsDelivr `@main`:** fija un tag para producción.
