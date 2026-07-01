# SOTSI Landing — Webflow Template Package

Paquete listo para convertir el Home de SOTSI en un **template clonable de Webflow**, manteniendo los efectos idénticos (canvas "Soul Tide", text-wave GSAP, slider, ink-drop, etc.) y con **tipografía licenciada** (Fraunces + Inter + Dancing/Pinyon Script, todas Google Fonts).

## Empieza aquí
1. **`BUILD-GUIDE.md`** — guía completa: hosting, custom code, recrear secciones, QA, cómo se clona/"instala".
2. **`webflow-custom-code.md`** — snippets exactos para pegar en Webflow (head + footer + body class).
3. **`asset-manifest.md`** — qué assets subir/host.

## Preview local
```bash
python3 -m http.server 8099   # → http://127.0.0.1:8099/index.template.html
```

## Cambios vs. el sitio estático original
- Una sola variante (config bloqueada del PM); **dev-switcher eliminado**.
- JS inline → externalizado en `assets/js/app.js` + `assets/js/soul-tide.js`.
- Fuentes trial/personal (Canela, WorldDiscovery) → **Google Fonts licenciadas** (`@font-face` self-hosted y carpeta `assets/fonts/` eliminados).
- Video fuente sin optimizar (~77 MB) removido (se usa el `-web.mp4`).

> El sitio estático original sigue intacto en `sotsi landing/` (este paquete es una copia autocontenida en `sotsi landing/webflow-template/`).
