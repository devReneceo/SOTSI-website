#!/usr/bin/env python3
"""Refresh the Home "The latest" Instagram row.

Pulls the 3 newest posts from @gary_zukav via the Instagram Graph API,
self-hosts their posters as webp, and writes the token-free feed JSON that
the browser reads (assets/data/instagram-feed.json).

Token sources (in order): env INSTAGRAM_ACCESSTOKEN (GitHub Action Secret),
then ACCESSTOKEN in the repo-root .env (local runs; never committed).

Run locally:  python3 .github/scripts/refresh_instafeed.py
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
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
JSON_PATH = REPO_ROOT / "assets" / "data" / "instagram-feed.json"
IMAGES_DIR = REPO_ROOT / "assets" / "images" / "instagram"
ITEMS = 3
API_FIELDS = ("id,caption,media_type,media_url,thumbnail_url,permalink,"
              "timestamp,like_count,comments_count")
FETCH_TIMEOUT = 30
QUOTE_MAX_CHARS = 110


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


def fetch_media(token):
    url = ("https://graph.instagram.com/me/media?"
           + urllib.parse.urlencode({"fields": API_FIELDS, "limit": 10,
                                     "access_token": token}))
    try:
        data = api_get(url)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:400]
        fail(f"Instagram API HTTP {e.code} (¿token vencido? renueva y actualiza el Secret): {body}")
    except OSError as e:
        fail(f"network error calling Instagram API: {e}")
    if "error" in data:
        fail(f"Instagram API error: {json.dumps(data['error'])[:400]}")
    rows = data.get("data", [])
    if not rows:
        fail("Instagram API returned no media")
    rows.sort(key=lambda m: m.get("timestamp", ""), reverse=True)
    return rows[:ITEMS]


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


def download_poster(media, dest_webp):
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


def main():
    token = load_token()
    media = fetch_media(token)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    JSON_PATH.parent.mkdir(parents=True, exist_ok=True)

    items = []
    for i, m in enumerate(media, start=1):
        dest = IMAGES_DIR / f"latest-{i}.webp"
        download_poster(m, dest)
        items.append({
            "permalink": m.get("permalink"),
            "media_type": m.get("media_type"),
            "quote": extract_quote(m.get("caption")),
            "likes": m.get("like_count"),
            "comments": m.get("comments_count"),
            "image": f"assets/images/instagram/{dest.name}",
            "timestamp": m.get("timestamp"),
        })
        print(f"[{i}/{ITEMS}] {m.get('media_type')} {m.get('permalink')} → {dest.name}")

    feed = {"updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "items": items}
    JSON_PATH.write_text(json.dumps(feed, ensure_ascii=False, indent=2) + "\n")
    print(f"wrote {JSON_PATH.relative_to(REPO_ROOT)} ({len(items)} items)")


if __name__ == "__main__":
    main()
