# Instagram section (Home 7c) — how it works & how to take it to Webflow

## Static site (live now, GitHub Pages)

Two rows on the Home, both fed by the Instagram Graph API (@gary_zukav, Business account):

- **Row 1 "Most viewed"** — the REAL top 3 reels by lifetime views (insights endpoint).
  `.github/scripts/refresh_top3.py` (weekly Action `instafeed-top3.yml`, Mondays ~9:41 UTC):
  paginates all ~1.5k media → asks insights `views` for the top-20 candidates by likes →
  picks the top 3 → rewrites two marker blocks in `index.html`:
  **`IG-TOP3`** (the 3 static cards, incl. "▷ 1.2M views" stat) and **`IG-TOP3-JSONLD`**
  (head: schema.org `ItemList` of `VideoObject` + `Person` Gary Zukav with `sameAs` — the
  SEO/AEO/GEO payload) → traceability snapshot in `assets/data/instagram-top3.json`.
- **Row 2 "The latest"** — the 3 newest posts. `.github/scripts/refresh_instafeed.py`
  (daily Action `instafeed.yml`, ~9:23 UTC) → `assets/data/instagram-feed.json` +
  `latest-{1,2,3}.webp` → rendered client-side by `assets/js/instafeed.js`.
- Posters are **self-hosted** (`assets/images/instagram/*.webp`, `cwebp -q 82 -resize 720 0`) —
  never hotlink the Instagram CDN (those URLs expire in days).
- **Token**: repo Secret `INSTAGRAM_ACCESSTOKEN` (local runs: `.env` → `ACCESSTOKEN=`).
  Expires **~60 days** → renew via `GET graph.instagram.com/refresh_access_token
  ?grant_type=ig_refresh_token&access_token=<token>` and update Secret + `.env`.
  The token **never ships to the client** — only the Actions see it.

## Taking it to Webflow

**No extra server is needed — Google Cloud is NOT required.** Webflow can't run scheduled
jobs or hold secrets, so the sync must live somewhere else; the cheapest "somewhere else"
is what already works today: **this repo's GitHub Actions keep running on their same crons**,
but instead of committing HTML they push into the **Webflow CMS via the Data API v2**.
The repo stops being the website and becomes the (free) automation runner.

### Action plan in Webflow (site "SOTSI Demo")

1. **CMS Collection `Instagram Reels`** — fields: Name (the quote), Slug, Permalink (Link),
   Row (Option: `most-viewed` | `latest`), Order (Number), Views / Likes / Comments (Number),
   Views compact / Likes compact / Comments compact (Plain text: "1.2M", "58.9k"…),
   Poster (Image), Upload date (Date/time), Caption excerpt (Plain text), Alt text (Plain text).
2. **Home page**: replace the static IG cards with **two Collection Lists** bound to that
   collection (filter `Row = most-viewed`, sort Order asc, limit 3 · filter `Row = latest`,
   sort newest, limit 3), recreating the current card design (same `post--insta` look already
   ported in the native Home build; same whtml technique as Courses/Blog Posts).
3. **JSON-LD**:
   - `Person` Gary Zukav (never changes) → Site Settings → Custom Code → **Head**.
   - `VideoObject` per reel → an **HTML Embed placed INSIDE the most-viewed Collection List**
     binding CMS fields (Views, Permalink, Poster URL, Upload date…). JSON-LD is valid
     anywhere in the body, and embeds inside Collection Lists CAN bind fields — head code on
     a static page can't. One `<script type="application/ld+json">` per item is fine.
4. **Script changes** (both Python scripts, ~30 lines each): swap the "rewrite index.html /
   write JSON" step for Webflow API calls — upload the poster (`POST /v2/sites/:site_id/assets`)
   and upsert the 6 items (`PATCH /v2/collections/:collection_id/items/:item_id/live`).
   New repo Secret **`WEBFLOW_API_TOKEN`** (site token, scopes `cms:write` + `assets:write`)
   next to `INSTAGRAM_ACCESSTOKEN`. Patching **live** items = no republish needed.
5. Crons stay exactly as they are (daily latest / weekly top 3).

### If the GitHub repo is ever retired

Move the two scripts to **Google Cloud Run Jobs + Cloud Scheduler** — the team already runs
22d-trello and DonorBoxAC on Cloud Run, and at this volume (1 run/day + 1 run/week, seconds
each) the cost is ≈ $0. Same scripts; tokens go to Secret Manager. Only then does Google
Cloud enter the picture — it is an alternative runner, not a requirement.

Third-party IG widgets (Elfsight, Behold, SociableKIT…) are **not** recommended: monthly
cost, generic look that breaks the premium design, no "top 3 by views" logic, and an extra
third-party script on the page.

### Never do

- Put `INSTAGRAM_ACCESSTOKEN` in Webflow custom code or any client-side JS — it grants
  full read access to the account's media and insights.
- Hotlink `scontent.cdninstagram.com` images — always re-host posters (Webflow Assets).
