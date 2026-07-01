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

## Pendiente
- [ ] Aprobación del cliente para construir en Webflow.
- [ ] Elegir Ruta A (MCP) o B (manual).
- [ ] (Ruta A) recibir auth MCP + Designer abierto + confirmar plan de pago.
- [ ] Construir Home → QA → publicar staging → generar clone link.
- [ ] Decidir hosting final (jsDelivr con tag fijo vs. autocontenido en Webflow).
