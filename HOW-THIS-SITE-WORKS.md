# How This Site Works

A plain-English guide to the whereisray.com codebase. No web-dev background assumed.

---

## The Big Picture

This site has one job: show people where you are during a 62-day Southeast Asia trip (May 28 -- Jul 28, 2026). It has three modes depending on the current date:

| Mode | When | What visitors see |
|------|------|-------------------|
| **Pre-trip** | Before May 28, 2026 | Countdown timer, full route map (all dots are "future"), country list with dates |
| **Live** | May 28 -- Jul 28, 2026 | Current city + flag, progress bar, map with visited/future dots and a pulsing "you are here" marker, upcoming schedule, photo feed from your posts |
| **Post-trip** | After Jul 28, 2026 | Same as live but the progress bar is full and the "upcoming schedule" section disappears |

The site picks which mode to show automatically based on today's date. You don't flip a switch -- it just knows.

There is also a **password gate**. Every visitor has to type `changeme` before they see anything. The password is checked entirely in the browser (no server involved); the site stores a SHA-256 hash and compares against it.

---

## How to Switch Between Modes (for Testing)

Since the trip hasn't started yet, the site would normally always show pre-trip mode. To preview the other modes, you set a **fake date** in the `.env` file at the project root.

### Step-by-step

1. Open the file called `.env` in the project root (same folder as `package.json`).
2. Find (or add) the line that starts with `TRIP_PREVIEW_DATE`.
3. Set it to a date inside the trip to see **live** mode, or after the trip to see **post** mode:

```
# Live mode -- pretend it's day 18 of the trip:
TRIP_PREVIEW_DATE=2026-06-14

# Post-trip mode -- pretend the trip is over:
TRIP_PREVIEW_DATE=2026-08-01

# Pre-trip mode -- just remove the line or comment it out:
# TRIP_PREVIEW_DATE=
```

4. Restart the dev server (Ctrl+C in the terminal, then `npm run dev` again). The site re-reads `.env` on startup, so you have to restart for the change to take effect.
5. Reload the page in your browser.

That's it. The variable only affects your local machine -- it is never sent to visitors' browsers and has zero effect on the production site.

---

## File Structure

Think of the project like a tree. Here's every folder and file that matters, with a one-sentence explanation of each.

```
whereisray.com/
|
|-- .env                      # Your local secrets (Mapbox token, preview date).
|                               Gitignored -- never uploaded to GitHub.
|-- .env.example              # Template showing what .env should look like.
|-- package.json              # List of dependencies (libraries the site needs).
|-- astro.config.mjs          # Astro framework settings (very short, rarely touched).
|-- tsconfig.json             # TypeScript settings (even shorter, never touched).
|
|-- src/                      # ALL of the actual site code lives in here.
|   |
|   |-- pages/
|   |   |-- index.astro       # THE main page. This is the "controller" -- it reads
|   |                           the trip state, grabs posts, and decides which
|   |                           components to show. If you want to understand the
|   |                           top-level flow, start here.
|   |
|   |-- layouts/
|   |   |-- Layout.astro      # The HTML skeleton (<html>, <head>, fonts, meta tags).
|   |                           Every page is wrapped in this. Think of it as the
|   |                           picture frame -- the content changes, the frame stays.
|   |
|   |-- components/           # Reusable UI pieces. Each .astro file is one "widget."
|   |   |-- PasswordGate.astro    # The password prompt overlay.
|   |   |-- StatusHero.astro      # Big city name + flag at the top (live/post modes).
|   |   |-- Countdown.astro       # "X days until departure" (pre-trip mode only).
|   |   |-- ProgressBar.astro     # Horizontal bar showing trip progress (live/post).
|   |   |-- RouteMap.astro        # The Mapbox map with dots, route line, labels.
|   |   |-- PhotoFeed.astro       # Grid of photo cards from your posts (live/post).
|   |   |-- PhotoCard.astro       # One individual photo card inside the feed.
|   |   |-- UpcomingSchedule.astro # "Coming up next" section (live mode only).
|   |
|   |-- lib/                  # Helper code (not visual -- just logic).
|   |   |-- dates.ts          # THE file that controls which mode the site is in.
|   |   |                       Defines trip start/end dates, reads TRIP_PREVIEW_DATE,
|   |   |                       and exports getTripState() which returns "pre",
|   |   |                       "live", or "post".
|   |   |-- notion.ts         # Talks to the Notion API. Fetches upcoming schedule
|   |   |                       entries AND travel posts from two separate databases.
|   |   |-- posts.ts          # Merges local markdown posts + Notion posts into one
|   |                           list. Notion wins on day conflicts. This is what
|   |                           index.astro and PhotoFeed.astro call.
|   |
|   |-- data/                 # Static data files (JSON).
|   |   |-- route.json        # Every city on the itinerary: name, country, GPS
|   |   |                       coordinates, which trip day you arrive. Also the
|   |   |                       line connecting them. This is what the map reads.
|   |   |-- countries.json    # The four countries with flag emoji, color, and dates.
|   |
|   |-- content/
|   |   |-- posts/            # Your travel posts (one Markdown file per post).
|   |       |-- 2026-05-28-hanoi.md
|   |       |-- 2026-05-30-hanoi-day3.md
|   |       |-- 2026-06-02-ninh-binh.md
|   |
|   |-- styles/
|   |   |-- global.css        # Colors, fonts, spacing -- the site's visual theme.
|   |
|   |-- content.config.ts     # Tells Astro where to find posts and what fields
|                               each post must have (title, date, coordinates, etc.).
|
|-- public/                   # Static assets served as-is (favicons, manifest, etc.).
```

---

## How the Three Modes Actually Work

Here's the flow, following the code:

1. A visitor loads the page. The browser requests `index.astro`.

2. **Before any HTML is sent**, Astro runs the code between the `---` fences at the top of `index.astro`. This is server-side code (runs on your machine during dev, or at build time for production). It does three things:
   - Calls `getTripState()` from `src/lib/dates.ts`, which compares "now" against the trip start/end dates and returns `"pre"`, `"live"`, or `"post"`.
   - Calls `getAllPosts()` from `src/lib/posts.ts`, which loads local markdown posts AND fetches posts from Notion, merges them (Notion wins on day conflicts), and sorts newest-first.
   - Picks the latest post to figure out what city you're currently in.

3. **Then it renders the HTML.** There's an `if/else` in the template:
   - If `state === 'pre'` --> render `<Countdown>`, the map with no current marker, and the country list.
   - Otherwise (`live` or `post`) --> render `<StatusHero>` (big city name), `<ProgressBar>`, the map with visited dots highlighted, and the `<PhotoFeed>`. If it's specifically `live`, also render `<UpcomingSchedule>`.

4. The `<PasswordGate>` always renders, regardless of mode. It overlays everything until the visitor types the right password.

That's the entire decision tree. The "intelligence" is in `src/lib/dates.ts` (about 50 lines) and the `if/else` in `index.astro`.

---

## Notion Integration

The site pulls data from two Notion databases. This means during the trip you can write posts from your phone or laptop in Notion -- no code, no terminal, no git.

### The Two Databases

**1. Upcoming Schedule** -- Your forward-looking itinerary. Shown in the "Coming up" section during live mode.

| Column | Type | Example |
|--------|------|---------|
| Title | Title | `Angkor Wat sunrise tour` |
| Subtitle | Text | `Meeting guide at 4:30am at hotel lobby` |
| Date | Date | `2026-06-19` |
| Day | Number | `23` |

**2. Travel Posts** -- Your trip updates / field notes. Powers the photo feed, status hero, and map marker.

| Column | Type | Example |
|--------|------|---------|
| Title | Title | `Landed in Hanoi` |
| Date | Date | `2026-05-28` |
| Day | Number | `1` (trip day 1--62) |
| Location | Text | `Hanoi` |
| Country | Select | `vietnam` (options: vietnam, cambodia, laos, indonesia) |
| Latitude | Number | `21.0285` |
| Longitude | Number | `105.8542` |
| Image URL | URL | `https://res.cloudinary.com/your-cloud/image/upload/v1/photo.jpg` |
| Image Alt | Text | `Old Quarter street scene at dusk` |
| Published | Checkbox | checked = visible on site, unchecked = draft |

The **body text** of your post goes in the page content -- just type regular paragraphs below the properties in Notion. The site reads them automatically.

### How to Publish a Post from Notion

1. Open the **Travel Posts** database in Notion.
2. Click "+ New" to add a row.
3. Fill in all the property columns (title, date, day, location, country, lat/lng, image URL, image alt).
4. Click into the page and write your post body as normal paragraphs.
5. Check the **Published** checkbox when you're ready for it to appear on the site.
6. Redeploy the site (or wait for the next scheduled build).

### How to Add Photos

You have two options. Use whichever is easier in the moment -- they can even be mixed in the same post.

**Option A: Drag/drop into Notion (easiest, no extra accounts needed)**

1. Open your post page in Notion.
2. Drag a photo from your camera roll (or paste from clipboard) directly into the page body, below the properties.
3. That's it. Notion hosts the image privately. At build time, the site downloads a copy and serves it locally. The photo never needs to be publicly accessible.

You can add multiple photos this way -- each image block you drop in becomes a separate photo in the post's carousel. If you want a caption on a specific image, click the image in Notion and type in the caption field that appears below it.

**Option B: Paste a public URL into the Image URL property**

If you prefer to host photos externally (Cloudinary, Imgur, etc.):

1. Upload your photo to the hosting service.
2. Copy the direct image URL.
3. Paste it into the **Image URL** column in the Notion database row.
4. Optionally fill in **Image Alt** with a description.

This is useful if you want more control over image size/quality, or if you already use a service like Cloudinary.

**How priority works:** The Image URL property photo shows first (as the "hero" image), followed by any images dropped into the page body. If you only use one method, that's fine too -- the site uses whatever it finds.

### Notion Credentials

The site talks to Notion using an API key and database IDs stored in the `.env` file:

```
NOTION_API_KEY=ntn_your_key_here
NOTION_DATABASE_ID=341c011117b0808584e8d5de5c5fc964
NOTION_POSTS_DATABASE_ID=341c011117b0803b8ebac305f6bc275b
```

The `NOTION_API_KEY` comes from your Notion integration (created at https://www.notion.so/my-integrations). Both databases must be shared with that integration (database page > "..." > "Connections" > add your integration).

These credentials are server-side only -- they are never sent to visitors' browsers.

### Fallback: Local Markdown Posts

If Notion credentials aren't set (or if the Notion API is down), the site falls back to local markdown files in `src/content/posts/`. These sample posts are bundled with the code and always work. During the trip, Notion posts will take priority -- if both sources have a post for the same trip day, the Notion version wins.

You can still add posts the old way if needed:

Create a file in `src/content/posts/` named `YYYY-MM-DD-slug.md`:

```markdown
---
title: "Your post title"
date: 2026-06-10
day: 14
location: "Hoi An"
country: "vietnam"
coordinates: [15.8801, 108.338]
images:
  - url: "https://your-image-url.jpg"
    alt: "Description of the photo"
---

Your post text goes here. Plain text or Markdown formatting.
```

The fields between the `---` lines are metadata. The important ones:
- **date**: when you wrote it (determines sort order)
- **day**: which day of the trip (1--62)
- **location**: city name (shown in the hero)
- **country**: must match an id in `countries.json` (e.g., `"vietnam"`, `"cambodia"`, `"laos"`, `"indonesia"`)
- **coordinates**: `[latitude, longitude]` -- this places the pulsing dot on the map

---

## How to Run the Site Locally

```bash
# From the project root:
npm run dev

# Opens at http://localhost:4321
# Password: changeme
```

To stop the server: press Ctrl+C in the terminal.
