# Webflow — Custom Code (copiar/pegar)

Estos son los **snippets exactos** para el sitio Webflow. Reemplaza `{BASE_URL}` por el host donde subas la carpeta `webflow-template/` (ver `BUILD-GUIDE.md` → "Hosting de CSS/JS").

> Ejemplo de `{BASE_URL}` con jsDelivr sobre el repo público:
> `https://cdn.jsdelivr.net/gh/devReneceo/SOTSI-website@main/webflow-template`
> (requiere haber empujado `webflow-template/` a ese repo). Tras publicar, fija una versión/tag en vez de `@main` para producción.
>
> **Pin ACTUAL en el sitio "SOTSI Demo" (2026-07-01/02, rama `webflow-mcp-assets`):**
> `https://cdn.jsdelivr.net/gh/devReneceo/SOTSI-website@4b3a8ea22ac27f291d06704687f99488221c7285/webflow-template`
> (incluye: sync lote cliente 2026-06-30, guards hslider+greeting, normalización de booleanos
> `hidden` Y de `autoplay/muted/loop/playsinline` del video de Consciousness — Webflow elimina
> los atributos booleanos al publicar —, `preventDefault` en el play del greeting, y las reglas
> de paridad de Membership en `section-polish.css`. Pin anterior: `20b44d7`.)

---

## 1) Site Settings → Custom Code → **Head Code** (antes de `</head>`)

Webflow limita el Head Code a ~10.000 caracteres; esto cabe de sobra porque solo son `<link>` (el CSS real se sirve externo).

```html
<!-- Google Fonts (licencia abierta: Fraunces, Inter, Dancing/Pinyon/Allura, etc.) -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&family=Pinyon+Script&family=Allura&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Inter:wght@400;500;600;700&family=Cormorant+Garamond:wght@400;500;600;700&family=Mulish:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Source+Sans+3:wght@400;500;600&family=Libre+Caslon+Display&family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

<!-- SOTSI stylesheets (ORDEN IMPORTANTE) -->
<link rel="stylesheet" href="{BASE_URL}/styles/tokens.css" />
<link rel="stylesheet" href="{BASE_URL}/styles/concepts.css" />
<link rel="stylesheet" href="{BASE_URL}/styles/brand.css" />
<link rel="stylesheet" href="{BASE_URL}/styles/sections.css" />
<link rel="stylesheet" href="{BASE_URL}/styles/theme.css" />
<link rel="stylesheet" href="{BASE_URL}/styles/mobile.css" />
<link rel="stylesheet" href="{BASE_URL}/styles/responsive-fix.css" />
<link rel="stylesheet" href="{BASE_URL}/styles/section-polish.css" />
<link rel="stylesheet" href="{BASE_URL}/styles/instafeed.css" />
```

> **Preload opcional del LCP** (acelera el héroe). Súbela como asset de Webflow o usa tu host:
> `<link rel="preload" as="image" href="{BASE_URL}/assets/images/slides/beach-creating-authentic-power-clean.webp" fetchpriority="high" />`

### ⚠️ Bloques EXTRA que viven en el head del sitio "SOTSI Demo" (no los pierdas)

El head VIVO contiene, además de los `<link>` de arriba:

```html
<!-- CMS grids: los wrappers .w-dyn-* de Webflow rompen el grid de cards → aplanarlos -->
<style>
  .courses__grid > .w-dyn-list, .courses__grid .w-dyn-items, .courses__grid .w-dyn-item,
  .blog__grid > .w-dyn-list, .blog__grid .w-dyn-items, .blog__grid .w-dyn-item { display: contents; }
</style>
```

y el **script inline de image-resilience** (retry + placeholder; ver head de `index.template.html`).

> **REPIN QUIRÚRGICO obligatorio:** al actualizar el pin NUNCA pegues este archivo sobre el
> custom code. Lee el código actual vía MCP (`data_scripts_tool`), reemplaza **solo el SHA**
> en las URLs jsDelivr y verifica que el `<style>` de arriba y los scripts inline siguen intactos.
> Sin la regla `display:contents`, los grids CMS (Courses/Blog) se rompen (cards apiladas).

---

## 2) Site Settings → Custom Code → **Footer Code** (antes de `</body>`)

El orden es **obligatorio**: `app.js` → GSAP → `soul-tide.js`. (`app.js` no depende de GSAP; `soul-tide.js` sí.)

En el sitio VIVO, el footer arranca con el **script de body-class** (el Body de Webflow no acepta clases):

```html
<script>
document.body.classList.add('nav-dark','cta-grad','nl-immersive','hero-original','heroheight-full','heroborder-on','navsize-m','logosize-m','logoframe-2','btnstyle-2','herocta-2','font-fraunces','anim-ink');
</script>
```

```html
<!-- 1. Interacciones del sitio (slider, nav, parallax, count-up, carruseles, ink-drop) -->
<script src="{BASE_URL}/assets/js/app.js"></script>

<!-- 2. GSAP (core + ScrollTrigger + SplitText) — necesario para el text-wave -->
<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/SplitText.min.js"></script>

<!-- 3. Efecto a medida: canvas "Soul Tide" + text-wave (Aspiration / Tools / Event) -->
<script src="{BASE_URL}/assets/js/soul-tide.js"></script>

<!-- 4. (Opcional) Instagram feed: mock → Meta Graph API vía JSON server-side -->
<script src="{BASE_URL}/assets/js/instafeed.js" defer></script>
```

> Los `<script src>` van **al final del body**, así que el DOM ya está parseado cuando corren (igual que en el sitio estático original). No uses `defer` en app.js/soul-tide.js: rompería el orden con GSAP.

---

## 3) Clase del elemento **Body** (en el Designer)

Selecciona el Body y añade esta combo-class (o pégala en la página). Es la config bloqueada del PM, con la tipografía ya en **fuentes licenciadas** (`font-fraunces`):

```
nav-dark cta-grad nl-immersive hero-original heroheight-full heroborder-on navsize-m logosize-m logoframe-2 btnstyle-2 herocta-2 font-fraunces anim-ink
```

| token | significado |
|---|---|
| `nav-dark` | nav glass oscuro (logo blanco) |
| `nl-immersive` | layout nav inmersivo (default) |
| `hero-original` | carrusel héroe fiel de 5 slides (`.oslider`) |
| `heroheight-full` / `heroborder-on` | héroe full-height con borde |
| `navsize-m` / `logosize-m` / `logoframe-2` | tamaños nav/logo |
| `btnstyle-2` / `herocta-2` | estilo de botones / CTA del héroe |
| `font-fraunces` | **tipografía licenciada** (Fraunces + Inter + Dancing/Pinyon) |
| `anim-ink` | animación de entrada "ink drop" (default) |

> Si Webflow inserta un `.page-wrapper`, no afecta: el JS engancha por clases/`data-` que tú recreas en el Designer (ver `BUILD-GUIDE.md`).

---

## Notas
- **Plan de Webflow:** el custom code requiere un plan de pago (Core+ / Site plan).
- **Producción:** cambia `@main` por un **tag/commit fijo** en las URLs jsDelivr para evitar romper por cambios futuros.
- **Autocontenido (opcional):** en vez de host externo, sube `app.js`, `soul-tide.js` y los CSS al Asset Manager de Webflow y usa esas URLs (ver `BUILD-GUIDE.md`).
