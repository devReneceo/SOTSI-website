# Work Log — SOTSI → Webflow Template

## 2026-06-29 · Fase 0 (paquete + guía) — HECHO ✅

**Quién/qué:** Claude Code preparó el paquete autocontenido en `sotsi landing/webflow-template/`. El sitio estático original quedó **intacto** en `sotsi landing/`.

**Decisiones (aprobadas por el cliente):**
1. Enfoque **híbrido fiel** (recrear DOM/clases + embeber efectos a medida tal cual).
2. Entrega **paquete + guía** (sin acceso a la cuenta Webflow en esta fase).
3. Fuentes **licenciadas**: Canela (trial) + WorldDiscovery (uso personal) → **Fraunces + Inter + Dancing/Pinyon Script** (Google Fonts).
4. Alcance **solo Home**.

**Hecho:**
- `index.template.html` — blueprint: 1 variante (config bloqueada del PM), **sin dev-switcher**, body `font-fraunces`, scripts externalizados.
- `assets/js/app.js` (IIFE principal, sin el bloque del switcher) + `assets/js/soul-tide.js` (canvas + GSAP text-wave). `node --check` OK en ambos. GSAP sigue por CDN.
- `styles/` (9 CSS): `@font-face` de Canela/WorldDiscovery/Jost/Montserrat eliminados; variables de fuente → Google.
- Poda: borrada `assets/fonts/` (se usa Google Fonts) y el mp4 fuente de 77 MB sin usar. Paquete ~102 MB.
- Docs: `README.md`, `BUILD-GUIDE.md`, `webflow-custom-code.md`, `asset-manifest.md`.

**Verificación:** servido en `:8099` + screenshots Chrome headless **1440** y **390 px** → render fiel; **canvas Soul Tide dibuja**, Fraunces activo, hero/nav/scroll-reveal OK, sin overflow móvil.

**Gotcha registrado:** en `app.js` se removió el bloque de control del switcher (líneas ~1458–1513 del `index.html` original) porque `vt.addEventListener(...)` no tenía guard y tronaba sin el DOM del switcher.

---

## Aclaración: "instalar template" en Webflow

Webflow **NO** tiene "subir mi HTML y que lo tome como template". Las vías reales:
- **Cloneable template** → el comprador hace **"Clone in Webflow"** desde un enlace y obtiene una copia del proyecto completo. **Esto es lo que produciremos.**
- (Marketplace queda descartado: prohíbe el custom code que usan los efectos canvas/GSAP.)

Por eso hay que **construir el sitio una vez** en Webflow (vía MCP o manual) y de ahí sale el clone link.

---

## Ruta A — Yo lo construyo vía MCP (cuando aprueben)

Requisitos: tú autenticas el MCP de Webflow, abres el **Designer** y tienes **plan de pago**.
Pasos que ejecutaría:
1. `mcp__webflow__authenticate` → `complete_authentication` (tú autorizas).
2. Seleccionar/crear sitio + página **Home**.
3. Registrar **custom code site-wide** (head = links CSS + Google Fonts; footer = app.js → GSAP → soul-tide.js) — skill `webflow-skills:custom-code-management`.
4. Poner la **body class** y recrear las secciones (HTML Embed por sección con el markup de `index.template.html`) — skill `webflow-skills:designer-tools` (requiere Designer abierto).
5. Subir assets / referenciar host.
6. QA + publicar a staging — `webflow-skills:pre-deploy-check` → `:safe-publish`.
7. Generar el **clone link**.
> Límite real: el MCP/Designer puede colocar elementos, pero los efectos vienen del markup embebido + JS externo (el canvas no se "dibuja" en el Designer).

## Ruta B — Manual (tú, siguiendo la guía)

Todo el detalle está en **`BUILD-GUIDE.md`**. Resumen:
1. **Hosting** (§3): empuja `webflow-template/` a un repo y usa jsDelivr, **o** sube CSS/JS al Asset Manager.
2. **Custom code** (§4 + `webflow-custom-code.md`): pega Head + Footer y la body-class.
3. **Secciones** (§5): por cada una, un **HTML Embed** con el markup copiado de `index.template.html` (tabla con líneas y hooks). Nav activo `#navImmersive`; héroe activo `.oslider`.
4. **Assets** (`asset-manifest.md`): subir/host.
5. **QA** (§7): breakpoints 320–1920, reduced-motion, Chrome/Firefox/Safari.
6. **Publicar + clone link** (§8).

---

## 2026-07-01 (a) · Build nativo por MCP — slice Nav + Hero + Courses ✅

Se eligió **Ruta A ampliada**: reconstrucción **NATIVA** (no embeds) vía Webflow MCP en el sitio **"SOTSI Demo"** (`6a38f15a089da087cc76f81b`, staging **proposal-03.webflow.io**), página Home `6a38f15d089da087cc76f8a7`. Técnica: `data_whtml_builder` con CSS de reglas vacías para crear/aplicar clases + CSS/JS externos por jsDelivr + body-class por script de footer. Detalle completo en la memoria de proyecto `sotsi-webflow-native-build`. Hecho: custom code global, Nav immersive, Hero `.oslider` (5 slides), Courses con colección CMS (4 items). Publicado a staging.

## 2026-07-01 (b) · Sync lote cliente + fix del hero slider en el publicado ✅

**Bug (encontrado y arreglado):** en proposal-03 el nav funcionaba pero el slider del hero no corría. Causa: `app.js` truena sin el DOM del **hslider** (showcase) que en Webflow no se construyó — `syncHeroChrome(0)` dereferenciaba `slides[0]` (la clase `.hslider__status` la reusa el chrome del oslider → `hstatus` no era null), `dotsWrap.children` con `#hdots` null, y `#hnext/#hprev.addEventListener` sin guard. El IIFE moría ANTES del init del oslider (el nav se inicializa antes → por eso sí funcionaba). **Fix:** guards quirúrgicos en `app.js` + probado con repro local (página sin hslider).

**Gotcha Webflow (importante para las 13 secciones restantes):** el publish de Webflow **elimina los atributos booleanos `hidden`** (el Designer los conserva; el HTML publicado no) → el drawer móvil salía abierto y con el toggle invertido, y los slides no-activos perdían su estado a11y. **Fix:** `app.js` normaliza al iniciar (drawer cerrado; slides sin `.is-active` → `hidden`). OJO: la sección Testimonials usa `hidden style="display:none"` — al construirla, verificar que el `style` inline sobreviva o replicar el hide por otra vía.

**Sync del template con el lote del cliente 2026-06-30** (antes solo estaba en `index.html`): nav CTA → "Soul Store", "Podcast" → "Deepcast" (nav+drawer+footer), slide IA comentado en ambos sliders (contadores/aria 4 y 3), CTAs (Event "Learn more" · Books "Buy Now" · Courses ×4 "Explore" · Membership "Learn more"), stat "36 appearances on Oprah", Testimonials `hidden`, chips del blog fuera, script image-resilience en head, dims de logos, books img 1254², `instafeed.js` limit 3, `latest-books.webp` transparente.

**Cambios aplicados en Webflow (Designer + publicados):** slide IA eliminado (quedan 4: data-oslide 0,1,2,4, aria "x of 4", `#ototal` 04), textos nav "Soul Store"/"Deepcast" (desktop + drawer; `set_text` funciona directo sobre String nodes → no rompe spans hermanos como glow/flecha), Courses CTA "Explore". Custom code re-pineado; **pin actual: commit `20b44d760a558d3059c426f69a5e0e39ee08a8b0`**. Publicado y verificado headless: slider autoavanza (01→02, dots ×4, status), drawer cerrado en 390, 0 errores JS.

## 2026-07-01 (c) · Sección 2 · ASPIRATION construida y publicada ✅

Construida NATIVA con `data_whtml_builder` (markup verbatim de `index.template.html` 363-381 + CSS de reglas vacías), insertada `after` el `.hero-original-wrap` → orden **hero → aspire → courses** dentro del `<main>`. Estilos `sec`/`sec__inner` REUSADOS (sin duplicados). Publicada y QA'd headless: canvas Soul Tide **montado y dibujando** (JS le puso 1425×1241), SplitText generó 60 `.asp-char` (text-wave activo), slider del hero sin regresión, 0 errores JS. Screenshot 1440 = idéntico al template local.

**Gotchas confirmados en esta pasada:**
- Los `data-*` SIN valor (`data-asp-line`) **SÍ sobreviven** el publish (salen como `data-asp-line=""`) — solo los booleanos HTML estándar (`hidden`) se pierden.
- `<canvas>` via whtml → elemento DOM tag canvas, perfecto.
- Screenshot headless con fragment `#aspire` + virtual-time sale en blanco (artefacto del ink-reveal a mitad de animación) — QA visual mejor con ventana alta sin fragment.

## 2026-07-01/02 (d) · Fase 2 COMPLETA — las 13 secciones restantes + Blog CMS, publicadas y QA'd ✅

**El Home entero está en Webflow y publicado en proposal-03.webflow.io.** Construidas en esta pasada (orden DOM del template): `immersive-flow`(Statement+Greeting) → Consciousness → Tools → Event → Books → [Courses ya existía] → Membership → Stats → Instafeed → Founders → Blog(CMS) → BigCTA + Footer (fuera de `<main>`). **Praise/Testimonials NO se construyó** (decisión del usuario: cliente la ocultó, citas sin clearance legal, `hidden` se pierde al publicar).

**Prep (un commit + repin quirúrgico):** `app.js` — guard anti-crash del bloque greeting (`gv`/`gsec` sin null-check habrían matado el IIFE, mismo patrón del bug hslider), normalizador del video de Consciousness (Webflow borra `muted`/`loop` al publicar; `autoplay=""`/`playsinline=""` de whtml SÍ sobreviven como atributos con valor — sin `muted` no hay autoplay, el normalizador lo re-aplica y hace `play()`), `preventDefault` en greetPlay (los `<button>` publican como `<a href="#" class="w-button">`); `section-polish.css` — 3 reglas de paridad Membership; `webflow-custom-code.md` — documenta los bloques EXTRA del head vivo (`<style>` display:contents para grids CMS + image-resilience) y el procedimiento de **repin quirúrgico** (leer código actual por MCP → reemplazar SOLO el SHA → verificar). **Pin actual: `4b3a8ea22ac27f291d06704687f99488221c7285`** (se quitó el preload LCP duplicado del head — el hero usa el asset de Webflow).

**Técnica nueva confirmada:**
- `<video>`/`<source>`/`poster` via whtml → DOM elements perfectos; duplicar `src` en el tag de `<video>` (además del `<source>`) da resiliencia.
- Batch de hasta 5 whtml por llamada, insertando en ORDEN INVERSO ancladas `after` el mismo elemento → quedan en orden correcto con una sola ancla.
- `<input>` fuera de `<form>` → **rechazo atómico del batch** ("Text Field can only be placed in a Form"); el search del footer se construyó como `<form>` real (FormWrapper de Webflow) con el botón como `<span role="button">`.
- Estilos inline → combo-classes generadas (`inline-p-0`...) que SÍ publican (color gold/blanco de Membership verificado computado).
- El lookup de assets del whtml builder NO enlaza por URL (ni la del propio CDN de Webflow) → siempre `upload_image_by_url` + `set_image_asset` post-build.
- Collection List: `source` vive en el **DynamoWrapper**; sort acepta `[{"fieldSlug":...,"direction":"ascending"}]` pero NO hay slug de fecha de creación → para orden explícito usar `queryMode:"curated"` + `curatedItemIds` (así quedó el Blog: AI → Governments → Choosing, como el template).

**Blog CMS:** colección **"Blog Posts"** `6a45cd0030985b5c1ee1d50e` (Name + `read-time` PlainText `7a30147524b2cedb774372c53ca59bed` + `image` Image `a7896c0be05021f648c8b0cf65c84931`), 3 items seed (imagen por `{"url": jsDelivr}` → Webflow re-hostea). Card bindeada: título en el `<h3>` (Heading), meta recreada como TextBlock (Span no expone `text`), imagen por `assetId`; `<a>` de la card y CTA "Read" estáticos (href="#" como el template). Items publicados con el site publish.

**QA (headless Playwright + curl del publicado):** 17 secciones vivas; hero sin regresión (4 slides, autoavanza 0→1, drawer cerrado en 390); aspire canvas dibujando (60 asp-char); consciousness `paused=false, muted=true, loop=true`; greeting click→reproduce CON audio, Esc cierra, sin salto al top; text-waves (tools 21 / books 33 chars); count-up (6M+/32/30+/36); booksPaths 22 paths; instafeed 3 tiles mock; blog CMS 3 cards con imágenes; footYear 2026; colores Membership (gold/blanco) OK; todas las imágenes cargando; `display:contents` intacto en el head; overflow 0 en 390/768/1024/1440; 0 pageerrors. Warning benigno: "SplitText called before fonts loaded" (mismo orden de carga que el estático).

## Pendiente
- [ ] Praise/Testimonials: construir SOLO si el cliente la reactiva (+ colección Testimonials; ojo clearance legal de citas y el gotcha del `hidden`).
- [ ] CTAs con `href="#"` (paridad con el template): apuntarlos a destinos reales cuando el cliente los defina.
- [ ] Instafeed: pasar de mock a Meta Graph API (requiere credenciales del cliente + `useMockData:false` + JSON server-side).
- [ ] Al re-pinear jsDelivr tras cada push: **repin quirúrgico** (nunca pegar este md encima) y republicar.
- [ ] Generar el clone link al terminar.
