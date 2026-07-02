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
      document.body.classList.toggle("menu-open", !expanded);
    });
  });

  // "About" del nav = solo dropdown (pedido cliente 2026-07-02): el trigger no navega
  document.querySelectorAll('.has-dd > .nlink[href="#"]').forEach((trigger) => {
    trigger.addEventListener("click", (event) => event.preventDefault());
  });

  // Nav condensation on scroll — same behavior as the Home inline script
  const navs = document.querySelectorAll(".snav");
  const condenseNavs = () => {
    const always = document.body.classList.contains("nav-solid-always");
    navs.forEach((nav) => nav.classList.toggle("is-condensed", always || window.scrollY > 60));
  };
  addEventListener("scroll", condenseNavs, { passive: true });
  condenseNavs();

  // Scroll reveals — solo en páginas que marcan bloques con [data-reveal] (About SOTS).
  // El estado oculto inicial vive bajo .reveals-on, así que sin JS el contenido queda visible.
  const revealEls = document.querySelectorAll("[data-reveal]");
  if (revealEls.length && "IntersectionObserver" in window) {
    document.documentElement.classList.add("reveals-on");
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
    );
    revealEls.forEach((el) => revealObserver.observe(el));
  }

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
