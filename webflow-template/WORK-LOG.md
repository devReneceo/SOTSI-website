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

## Pendiente
- [ ] 13 secciones restantes (Aspiration/Statement/Greeting/Consciousness/Tools/Event/Books/Membership/Stats/Praise/Instafeed/Founders/Blog/BigCTA/Footer) + colecciones Testimonials/Blog (verificar límite del plan).
- [ ] Al re-pinear jsDelivr tras cada push: actualizar head+footer freeform y **republicar**.
- [ ] Generar el clone link al terminar.
