document.addEventListener("DOMContentLoaded", () => {
  const year = document.getElementById("footYear");
  if (year) year.textContent = String(new Date().getFullYear());

  const burgers = document.querySelectorAll("[data-burger]");
  burgers.forEach((button) => {
    const panel = button.closest(".snav")?.querySelector("[data-mobile]");
    if (!panel) return;

    button.addEventListener("click", () => {
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      panel.hidden = expanded;
    });
  });

  const currentPath = window.location.pathname.replace(/index\.html$/, "");
  document.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;

    try {
      const url = new URL(href, window.location.href);
      const linkPath = url.pathname.replace(/index\.html$/, "");
      if (linkPath === currentPath) {
        link.setAttribute("aria-current", "page");
      }
    } catch {
      // ignore malformed relative hrefs
    }
  });
});
