#!/usr/bin/env python3
"""Refresh the Home "Most viewed" Instagram row with the REAL top 3 by views.

Paginates all @gary_zukav media via the Instagram Graph API, ranks the top
video candidates by like_count, asks the insights endpoint for lifetime views
on each, and picks the true top 3. Then it rewrites two marker-delimited
blocks in index.html — the three static cards (IG-TOP3) and the schema.org
JSON-LD (IG-TOP3-JSONLD: VideoObject ItemList + Person, for SEO/AEO/GEO) —
plus a token-free ranking snapshot (assets/data/instagram-top3.json).

Token sources (in order): env INSTAGRAM_ACCESSTOKEN (GitHub Action Secret),
then ACCESSTOKEN in the repo-root .env (local runs; never committed).

Run locally:  python3 .github/scripts/refresh_top3.py
Requires: cwebp (brew install webp / apt-get install webp).
The token expires ~60 days — renew via GET graph.instagram.com/refresh_access_token
?grant_type=ig_refresh_token&access_token=<token> and update .env + the
INSTAGRAM_ACCESSTOKEN repo secret.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
HTML_PATH = REPO_ROOT / "index.html"
JSON_PATH = REPO_ROOT / "assets" / "data" / "instagram-top3.json"
IMAGES_DIR = REPO_ROOT / "assets" / "images" / "instagram"

# Al migrar el prototipo a seatofthesoul.com solo hay que cambiar BASE_URL.
BASE_URL = "https://devreneceo.github.io/SOTSI-website"
SITE_URL = "https://seatofthesoul.com/"

TOP_N = 3
CANDIDATES = 20          # top-N por likes a los que se les piden insights
API_FIELDS = ("id,caption,media_type,thumbnail_url,media_url,permalink,"
              "timestamp,like_count,comments_count")
PAGE_LIMIT = 100
MAX_PAGES = 30
FETCH_TIMEOUT = 30
API_SLEEP = 0.35
QUOTE_MAX_CHARS = 110
DESC_MAX_CHARS = 200

MARK_CARDS = ("<!-- IG-TOP3:START", "<!-- IG-TOP3:END -->")
MARK_JSONLD = ("<!-- IG-TOP3-JSONLD:START", "<!-- IG-TOP3-JSONLD:END -->")

# Citas y alt curados a mano (mejores que el extract automático). Un reel
# nuevo que entre al top 3 usa el fallback extract_quote()/alt genérico —
# si eso pasa, vale la pena curarlo aquí en el siguiente pase.
CURATED = {
    "DU1llBtDZ8O": {
        "quote": "Marriage is an old archetype.",
        "alt": "Gary Zukav smiling beside a redwood — reel: Marriage is an old archetype",
    },
    "DVR6T0NDOtL": {
        "quote": "I loved loving her.",
        "alt": "Gary and Linda embracing — reel: I loved loving her",
    },
    "DWzwgqlgPGj": {
        "quote": "The greatest event in human history is happening now.",
        "alt": "Gary Zukav seated beneath a blossoming tree — reel: The greatest event in human history is happening now",
    },
}

SAME_AS = [
    "https://www.instagram.com/gary_zukav/",
    "https://www.facebook.com/GaryZukav/",
    "https://x.com/gary_zukav",
    "https://www.tiktok.com/@gary.zukav.soul",
    "https://www.youtube.com/@TheGaryZukav",
]

PLAY_GLYPH = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
              'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
              '<path d="M8 5.5v13l11-6.5z"/></svg>')
HEART_GLYPH = ('<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
               '<path d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2 5 5.3 5c2 0 3.4 1.2 4.7 2.8'
               'C11.3 6.2 12.7 5 14.7 5 18 5 19.6 8.4 22 11.7 19.5 16.4 12 21 12 21z"/></svg>')
CHAT_GLYPH = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
              'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
              '<path d="M21 11.5a8.4 8.4 0 0 1-11.9 7.6L3 21l1.9-6.1A8.4 8.4 0 1 1 21 11.5z"/></svg>')
IG_GLYPH = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
            '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/>'
            '<circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>')
BIG_PLAY_GLYPH = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>'


def fail(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def load_token():
    token = os.environ.get("INSTAGRAM_ACCESSTOKEN", "").strip()
    if token:
        return token
    env_file = REPO_ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            m = re.match(r"\s*ACCESSTOKEN\s*=\s*(\S+)", line)
            if m:
                return m.group(1)
    fail("no token: set INSTAGRAM_ACCESSTOKEN or put ACCESSTOKEN=... in the repo-root .env")


def api_get(url):
    with urllib.request.urlopen(url, timeout=FETCH_TIMEOUT) as resp:
        return json.load(resp)


def fetch_all_media(token):
    url = ("https://graph.instagram.com/me/media?"
           + urllib.parse.urlencode({"fields": API_FIELDS, "limit": PAGE_LIMIT,
                                     "access_token": token}))
    rows, pages = [], 0
    while url and pages < MAX_PAGES:
        try:
            data = api_get(url)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")[:400]
            fail(f"Instagram API HTTP {e.code} (¿token vencido? renueva y actualiza el Secret): {body}")
        except OSError as e:
            fail(f"network error calling Instagram API: {e}")
        if "error" in data:
            fail(f"Instagram API error: {json.dumps(data['error'])[:400]}")
        rows.extend(data.get("data", []))
        url = data.get("paging", {}).get("next")
        pages += 1
        time.sleep(0.25)
    if not rows:
        fail("Instagram API returned no media")
    print(f"fetched {len(rows)} media in {pages} pages")
    return rows


def fetch_views(token, media_id):
    url = (f"https://graph.instagram.com/{media_id}/insights?"
           + urllib.parse.urlencode({"metric": "views", "access_token": token}))
    try:
        data = api_get(url)
        return int(data["data"][0]["values"][0]["value"])
    except Exception as e:  # media viejos sin insights: se saltan, no abortan
        print(f"  WARN: no insights for {media_id}: {str(e)[:120]}", file=sys.stderr)
        return 0


def pick_top3(token, media):
    videos = [m for m in media if m.get("media_type") == "VIDEO"]
    videos.sort(key=lambda m: m.get("like_count") or 0, reverse=True)
    ranked = []
    for m in videos[:CANDIDATES]:
        views = fetch_views(token, m["id"])
        if views > 0:
            ranked.append({**m, "views": views})
        time.sleep(API_SLEEP)
    ranked.sort(key=lambda m: m["views"], reverse=True)
    if len(ranked) < TOP_N:
        fail(f"only {len(ranked)} candidates with views — not rewriting the HTML")
    return ranked


def shortcode(permalink):
    m = re.search(r"/(?:reel|p|tv)/([^/?#]+)", permalink or "")
    if not m:
        fail(f"cannot extract shortcode from permalink: {permalink}")
    return m.group(1)


def compact(n):
    """Mismo formato que compactCount() en assets/js/instafeed.js."""
    n = int(n or 0)
    if n >= 1_000_000:
        return re.sub(r"\.0$", "", f"{n / 1_000_000:.1f}") + "M"
    if n >= 1000:
        return re.sub(r"\.0$", "", f"{n / 1000:.1f}") + "k"
    return str(n)


def extract_quote(caption):
    """Gary's captions open with a quoted line — use it; else first sentence."""
    text = (caption or "").strip()
    if not text:
        return "A new reflection from Gary."
    m = re.search(r"[“\"](.+?)[”\"]", text, re.S)
    quote = m.group(1).strip() if m else re.split(r"(?<=[.!?])\s", text)[0]
    quote = re.sub(r"\s+", " ", quote)
    if len(quote) > QUOTE_MAX_CHARS:
        quote = quote[:QUOTE_MAX_CHARS].rsplit(" ", 1)[0].rstrip(",;:") + "…"
    return quote


def extract_description(caption, quote):
    text = re.sub(r"\s+", " ", (caption or "").strip())
    if not text:
        return quote
    if len(text) > DESC_MAX_CHARS:
        text = text[:DESC_MAX_CHARS].rsplit(" ", 1)[0].rstrip(",;:") + "…"
    return text


def esc(text):
    return (str(text).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def download_poster(media, dest_webp):
    if dest_webp.exists():
        print(f"  poster ya existe, se reusa: {dest_webp.name}")
        return
    src = media.get("thumbnail_url") if media.get("media_type") == "VIDEO" else media.get("media_url")
    src = src or media.get("media_url")
    if not src:
        fail(f"media {media.get('id')} has no downloadable poster")
    cwebp = shutil.which("cwebp") or next(
        (p for p in ("/opt/homebrew/bin/cwebp", "/usr/local/bin/cwebp") if Path(p).exists()), None)
    if not cwebp:
        fail("cwebp not found (brew install webp / apt-get install -y webp)")
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        req = urllib.request.Request(src, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=FETCH_TIMEOUT) as resp:
            tmp_path.write_bytes(resp.read())
        run = subprocess.run([cwebp, "-quiet", "-q", "82", "-resize", "720", "0",
                              str(tmp_path), "-o", str(dest_webp)],
                             capture_output=True, text=True)
        if run.returncode != 0:
            fail(f"cwebp failed for {dest_webp.name}: {run.stderr[:300]}")
    finally:
        tmp_path.unlink(missing_ok=True)


def card_html(item):
    code = item["shortcode"]
    curated = CURATED.get(code, {})
    quote = curated.get("quote") or extract_quote(item.get("caption"))
    alt = curated.get("alt") or f"Instagram reel from Gary Zukav — {quote}"
    return f"""        <a class="post post--glow post--insta reveal" href="{esc(item['permalink'])}" target="_blank" rel="noopener noreferrer">
          <span class="post__media post__media--reel">
            <img src="assets/images/instagram/reel-{code}.webp" width="720" height="1280" decoding="async" loading="lazy" alt="{esc(alt)}" />
            <span class="post__play" aria-hidden="true">{BIG_PLAY_GLYPH}</span>
            <span class="post__chip post__chip--insta">{IG_GLYPH}Reel</span>
          </span>
          <span class="post__body">
            <h3 class="post__title post__title--insta">&ldquo;{esc(quote)}&rdquo;</h3>
            <span class="post__meta instafeed__stats">
              <span class="instafeed__stat instafeed__stat--views">{PLAY_GLYPH}{compact(item['views'])} views</span>
              <span class="instafeed__stat">{HEART_GLYPH}{compact(item.get('like_count'))}</span>
              <span class="instafeed__stat">{CHAT_GLYPH}{compact(item.get('comments_count'))}</span>
            </span>
            <span class="post__cta">Watch on Instagram<span class="post__cta-ico" aria-hidden="true">↗</span></span>
          </span>
        </a>"""


def jsonld_html(top3):
    def video_node(pos, item):
        code = item["shortcode"]
        quote = CURATED.get(code, {}).get("quote") or extract_quote(item.get("caption"))
        return {
            "@type": "ListItem",
            "position": pos,
            "item": {
                "@type": "VideoObject",
                "name": f"“{quote}” — Gary Zukav",
                "description": extract_description(item.get("caption"), quote),
                "thumbnailUrl": f"{BASE_URL}/assets/images/instagram/reel-{code}.webp",
                "url": item.get("permalink"),
                "uploadDate": item.get("timestamp"),
                "creator": {"@id": f"{SITE_URL}#gary-zukav"},
                "interactionStatistic": [
                    {"@type": "InteractionCounter",
                     "interactionType": {"@type": "WatchAction"},
                     "userInteractionCount": item["views"]},
                    {"@type": "InteractionCounter",
                     "interactionType": {"@type": "LikeAction"},
                     "userInteractionCount": item.get("like_count") or 0},
                    {"@type": "InteractionCounter",
                     "interactionType": {"@type": "CommentAction"},
                     "userInteractionCount": item.get("comments_count") or 0},
                ],
            },
        }

    graph = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Person",
                "@id": f"{SITE_URL}#gary-zukav",
                "name": "Gary Zukav",
                "url": SITE_URL,
                "description": ("Author of The Seat of the Soul and co-founder of the "
                                "Seat of the Soul Institute."),
                "sameAs": SAME_AS,
            },
            {
                "@type": "ItemList",
                "name": "Most viewed Gary Zukav reels on Instagram",
                "itemListElement": [video_node(i, it) for i, it in enumerate(top3, start=1)],
            },
        ],
    }
    # < evita que un "</script>" dentro de un caption rompa el bloque.
    payload = json.dumps(graph, ensure_ascii=False, indent=2).replace("<", "\\u003c")
    return f'<script type="application/ld+json">\n{payload}\n</script>'


def replace_between(html, markers, replacement):
    start_tag, end_tag = markers
    start = html.find(start_tag)
    end = html.find(end_tag)
    if start == -1 or end == -1 or end < start:
        fail(f"markers {start_tag!r} / {end_tag!r} not found in index.html")
    open_end = html.index("-->", start) + len("-->")
    return html[:open_end] + "\n" + replacement + "\n" + html[end:]


def main():
    token = load_token()
    media = fetch_all_media(token)
    ranked = pick_top3(token, media)
    top3 = ranked[:TOP_N]

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    JSON_PATH.parent.mkdir(parents=True, exist_ok=True)

    for i, item in enumerate(top3, start=1):
        item["shortcode"] = shortcode(item.get("permalink"))
        download_poster(item, IMAGES_DIR / f"reel-{item['shortcode']}.webp")
        print(f"[{i}/{TOP_N}] {compact(item['views'])} views  {item['permalink']}")

    html = HTML_PATH.read_text()
    html = replace_between(html, MARK_CARDS, "\n".join(card_html(it) for it in top3))
    html = replace_between(html, MARK_JSONLD, jsonld_html(top3))
    HTML_PATH.write_text(html)
    print(f"rewrote IG-TOP3 blocks in {HTML_PATH.name}")

    snapshot = {
        "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "top3": [{"permalink": it.get("permalink"), "shortcode": it["shortcode"],
                  "views": it["views"], "likes": it.get("like_count"),
                  "comments": it.get("comments_count"), "timestamp": it.get("timestamp")}
                 for it in top3],
        "ranking": [{"permalink": m.get("permalink"), "views": m["views"],
                     "likes": m.get("like_count")} for m in ranked[:10]],
    }
    JSON_PATH.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n")
    print(f"wrote {JSON_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
