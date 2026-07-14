/* SOTSI Webflow — CMS templates & listings runtime (Fase 6 + Fase 7 filter)
   Served via jsDelivr (pinned by SHA) into per-page HtmlEmbeds.
   ES2017-safe (no optional chaining / template literals / arrow-only tricks).
   Handles: blog post template (.bp_shell), episode template (.ep_shell),
   blog/podcast listings (.blg_shell / .pod_shell): date formatting, badge
   tints, YouTube facade, Megaphone audio + chapter seek, JSON-LD, and the
   blog content-type filter (Blogs / Soul Feasts / Soul Snacks / All) that
   toggles the four native Collection List panes on /blog. */
(function () {
  "use strict";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function txt(el) { return el ? (el.textContent || "").trim() : ""; }

  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  function parseDate(raw) {
    if (!raw) return null;
    var d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  function fmtDate(d) {
    return MONTHS[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear();
  }

  /* ---------- shared passes ---------- */

  function formatDates() {
    $all(".bp_date, .ep_date, .blg_card_date, .pod_card_date").forEach(function (el) {
      var raw = txt(el);
      var d = parseDate(raw);
      if (d) {
        el.setAttribute("data-iso", d.toISOString());
        el.textContent = fmtDate(d);
      } else if (!raw) {
        el.style.display = "none";
      }
    });
  }

  function tintBadges() {
    $all(".bp_badge, .ep_badge, .blg_card_badge, .pod_card_badge").forEach(function (el) {
      var s = txt(el).toLowerCase();
      if (!s) { el.style.display = "none"; return; }
      if (s.indexOf("feast") > -1) el.className += " is-feast";
      else if (s.indexOf("snack") > -1) el.className += " is-snack";
    });
  }

  function injectLd(obj) {
    try {
      var sc = document.createElement("script");
      sc.type = "application/ld+json";
      sc.text = JSON.stringify(obj);
      document.head.appendChild(sc);
    } catch (e) { /* non-fatal */ }
  }

  function ytFacade(slot, yt, label) {
    var card = document.createElement("div");
    card.className = "bp_video";
    var img = document.createElement("img");
    img.src = "https://i.ytimg.com/vi/" + yt + "/hqdefault.jpg";
    img.alt = "";
    img.loading = "lazy";
    var btn = document.createElement("button");
    btn.className = "bp_video_btn";
    btn.type = "button";
    btn.setAttribute("aria-label", label);
    var play = document.createElement("span");
    play.className = "bp_video_play";
    play.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
    var lab = document.createElement("p");
    lab.className = "bp_video_label";
    lab.textContent = label;
    btn.appendChild(play);
    btn.appendChild(lab);
    card.appendChild(img);
    card.appendChild(btn);
    btn.addEventListener("click", function () {
      var f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + yt + "?autoplay=1&rel=0";
      f.title = "YouTube video";
      f.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      f.setAttribute("allowfullscreen", "");
      card.innerHTML = "";
      card.appendChild(f);
    });
    slot.appendChild(card);
    return card;
  }

  /* ---------- blog post template ---------- */

  function initPost() {
    var shell = $(".bp_shell");
    if (!shell) return;

    var meta = $(".bp_byline_meta");
    if (meta && !txt(meta)) meta.textContent = "Reflections from Gary Zukav";

    var data = $(".bp_data");
    var yt = "", excerpt = "";
    if (data && data.children.length >= 2) {
      yt = txt(data.children[0]);
      excerpt = txt(data.children[1]);
    }

    var slot = $(".bp_video_slot");
    if (slot && yt) ytFacade(slot, yt, "Watch this reflection");

    var dateEl = $(".bp_date");
    var iso = dateEl ? (dateEl.getAttribute("data-iso") || "") : "";
    var ld = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": txt($(".bp_title")),
      "url": location.href,
      "author": { "@type": "Person", "name": txt($(".bp_byline_name")) || "Gary Zukav" },
      "publisher": { "@type": "Organization", "name": "Seat of the Soul Institute" },
      "mainEntityOfPage": location.href
    };
    if (iso) ld.datePublished = iso;
    if (excerpt) ld.description = excerpt;
    injectLd(ld);
  }

  /* ---------- episode template ---------- */

  function fmtDuration(sec) {
    sec = parseInt(sec, 10);
    if (!sec || sec <= 0) return "";
    var m = Math.round(sec / 60);
    if (m < 1) m = 1;
    return m + " min";
  }

  function initEpisode() {
    var shell = $(".ep_shell");
    if (!shell) return;

    /* hidden data slots: [0]=duration-sec [1]=megaphone-id [2]=youtube-id [3]=episode-number */
    var data = $(".ep_data");
    var dur = "", mega = "", yt = "", num = "";
    if (data && data.children.length >= 4) {
      dur = txt(data.children[0]);
      mega = txt(data.children[1]);
      yt = txt(data.children[2]);
      num = txt(data.children[3]);
    }

    /* facts line: "#74 · March 4, 2026 · 12 min · Video + audio" */
    var facts = $(".ep_facts");
    if (facts) {
      var bits = [];
      if (num) bits.push("#" + num);
      var dateEl = $(".ep_date");
      if (dateEl && dateEl.style.display !== "none") bits.push(txt(dateEl));
      var dtxt = fmtDuration(dur);
      if (dtxt) bits.push(dtxt);
      bits.push(yt ? "Video + audio" : "Audio");
      facts.textContent = bits.join(" · ");
    }

    /* YouTube facade above the fold of the body */
    var vslot = $(".ep_video_slot");
    if (vslot && yt) ytFacade(vslot, yt, "Watch this episode");

    /* Megaphone audio player */
    var audio = null;
    var aslot = $(".ep_audio_slot");
    if (aslot && mega) {
      var card = document.createElement("div");
      card.className = "ep_audio";
      var icon = document.createElement("span");
      icon.className = "ep_audio_icon";
      icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>';
      var body = document.createElement("div");
      body.className = "ep_audio_body";
      var label = document.createElement("p");
      label.className = "ep_audio_label";
      label.textContent = "Listen to this episode";
      audio = document.createElement("audio");
      audio.controls = true;
      audio.preload = "none";
      audio.src = "https://traffic.megaphone.fm/" + mega + ".mp3";
      audio.addEventListener("error", function () { card.style.display = "none"; audio = null; });
      body.appendChild(label);
      body.appendChild(audio);
      card.appendChild(icon);
      card.appendChild(body);
      aslot.appendChild(card);
    }

    /* Chapter seek: any <strong>M:SS</strong> (or H:MM:SS) inside .ep_chapters seeks the audio */
    var chapters = $(".ep_chapters");
    if (chapters) {
      var stamps = $all("strong", chapters);
      var found = 0;
      stamps.forEach(function (st) {
        var m = txt(st).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        if (!m) return;
        found++;
        var secs = m[3] !== undefined
          ? (parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10))
          : (parseInt(m[1], 10) * 60 + parseInt(m[2], 10));
        st.className += " ep_stamp";
        st.setAttribute("role", "button");
        st.setAttribute("tabindex", "0");
        st.setAttribute("aria-label", "Jump the audio to " + txt(st));
        function seek() {
          if (!audio) return;
          try {
            audio.currentTime = secs;
            var p = audio.play();
            if (p && p.catch) p.catch(function () {});
          } catch (e) { /* not seekable yet */ }
        }
        st.addEventListener("click", seek);
        st.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); seek(); }
        });
      });
      if (found > 0) {
        var hint = $(".ep_chapters_hint");
        if (hint) hint.style.display = "";
      } else {
        chapters.className += " ep_chapters--plain";
      }
      if (!audio) chapters.className += " ep_chapters--plain";
    }

    var dateEl2 = $(".ep_date");
    var iso = dateEl2 ? (dateEl2.getAttribute("data-iso") || "") : "";
    var ld = {
      "@context": "https://schema.org",
      "@type": "PodcastEpisode",
      "name": txt($(".ep_title")),
      "url": location.href,
      "partOfSeries": { "@type": "PodcastSeries", "name": "The Gary Zukav Deepcast" }
    };
    if (iso) ld.datePublished = iso;
    if (num) ld.episodeNumber = num;
    var durSec = parseInt(dur, 10);
    if (durSec > 0) ld.timeRequired = "PT" + Math.round(durSec / 60) + "M";
    if (mega) ld.associatedMedia = { "@type": "MediaObject", "contentUrl": "https://traffic.megaphone.fm/" + mega + ".mp3" };
    injectLd(ld);
  }

  /* ---------- listings ---------- */

  function initListings() {
    /* card links: whole card clickable already via LinkBlock; nothing dynamic yet.
       Count line: "N reflections" / "N episodes" from rendered collection items.
       When the content-type filter is present, initSeriesFilter owns .blg_count
       (rendered-card counting would sum all four panes). */
    var blg = $(".blg_shell");
    if (blg && !$(".blg_filter_select")) {
      var items = $all(".blg_card", blg);
      var count = $(".blg_count");
      if (count && items.length) count.textContent = items.length + " reflections · New posts weekly";
    }
    var pod = $(".pod_shell");
    if (pod) {
      var eps = $all(".pod_card", pod);
      var pcount = $(".pod_count");
      if (pcount && eps.length) pcount.textContent = eps.length + " episodes · New episodes Mondays & Fridays";
    }
  }

  /* ---------- blog content-type filter (Fase 7) ----------
     /blog holds four native Collection List panes (.blg_pane is-blog /
     is-feast / is-snack / is-all), each filtered server-side on the CMS
     `series` Option, plus three hidden counter lists (.blg_counter, order
     blog → feast → snack) that expose true per-series totals despite the
     24/page pagination. The select toggles panes; native pagination reloads
     the page, so the active pane is restored from the pagination query param
     (each list has a unique `<prefix>_page` param) or sessionStorage. */

  function initSeriesFilter() {
    var shell = $(".blg_shell");
    var select = $(".blg_filter_select");
    if (!shell || !select) return;
    var panes = $all(".blg_pane", shell);
    if (!panes.length) return;

    var PANE_CLASS = { "Blog": "is-blog", "Soul Feast": "is-feast", "Soul Snack": "is-snack", "all": "is-all" };
    var LABELS = { "Blog": "Blogs", "Soul Feast": "Soul Feasts", "Soul Snack": "Soul Snacks", "all": "All posts" };
    var KEY = "wfblg:series";

    function hasClass(el, cls) { return (" " + el.className + " ").indexOf(" " + cls + " ") > -1; }
    function paneFor(value) {
      var cls = PANE_CLASS[value] || "is-blog";
      for (var i = 0; i < panes.length; i++) if (hasClass(panes[i], cls)) return panes[i];
      return panes[0];
    }
    function valueForPane(pane) {
      for (var v in PANE_CLASS) if (hasClass(pane, PANE_CLASS[v])) return v;
      return "Blog";
    }

    var counters = $all(".blg_counter", shell);
    var counts = {};
    var total = 0;
    var haveCounts = counters.length >= 3;
    if (haveCounts) {
      var order = ["Blog", "Soul Feast", "Soul Snack"];
      for (var c = 0; c < 3; c++) {
        var n = counters[c].querySelectorAll(".w-dyn-item").length;
        counts[order[c]] = n;
        total += n;
      }
    }
    function countFor(value) { return value === "all" ? total : (counts[value] || 0); }

    for (var o = 0; o < select.options.length; o++) {
      var opt = select.options[o];
      var base = LABELS[opt.value] || opt.text;
      opt.textContent = haveCounts ? base + " (" + countFor(opt.value) + ")" : base;
    }

    var mast = $(".blg_count");
    if (mast && haveCounts && total > 0) mast.textContent = total + " reflections · New posts weekly";

    function apply(value, persist) {
      if (!(value in PANE_CLASS)) value = "Blog";
      var target = paneFor(value);
      for (var i = 0; i < panes.length; i++) {
        /* strip is-active-1 BEFORE is-active: \bis-active\b also matches
           inside "is-active-1" (the hyphen is a word boundary) */
        panes[i].className = panes[i].className
          .replace(/\bis-active-1\b/g, "")
          .replace(/\bis-active\b/g, "")
          .replace(/\s{2,}/g, " ")
          .replace(/\s+$/, "");
      }
      target.className += " is-active";
      select.value = value;
      var tc = $(".blg_toolbar_count");
      if (tc) {
        var shown = target.querySelectorAll(".blg_card").length;
        var subtotal = haveCounts ? countFor(value) : shown;
        if (shown > subtotal) shown = subtotal;
        tc.textContent = subtotal ? "Showing " + shown + " of " + subtotal : "No posts in this section yet";
      }
      if (persist) { try { sessionStorage.setItem(KEY, value); } catch (e) { /* private mode */ } }
    }

    function valueFromUrl() {
      var search = location.search || "";
      if (search.indexOf("_page=") === -1) return null;
      for (var i = 0; i < panes.length; i++) {
        var link = panes[i].querySelector(".w-pagination-next, .w-pagination-previous");
        if (!link) continue;
        var m = (link.getAttribute("href") || "").match(/[?&]([A-Za-z0-9_]+_page)=/);
        if (m && search.indexOf(m[1] + "=") > -1) return valueForPane(panes[i]);
      }
      return null;
    }

    var initial = valueFromUrl();
    if (!initial) { try { initial = sessionStorage.getItem(KEY); } catch (e) { initial = null; } }
    if (!initial || !(initial in PANE_CLASS)) initial = "Blog";
    apply(initial, false);

    select.addEventListener("change", function () { apply(select.value, true); });
    if (select.form) select.form.addEventListener("submit", function (ev) { ev.preventDefault(); });
  }

  function init() {
    formatDates();
    tintBadges();
    initPost();
    initEpisode();
    initListings();
    initSeriesFilter();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
