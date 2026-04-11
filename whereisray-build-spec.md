# whereisray.com — Build Spec

## Project Overview

A private, password-protected travel site for friends and family to follow a 62-day backpacking trip through Southeast Asia (May 28 – Jul 28, 2026). The site shows current location, route progress, upcoming plans, and a reverse-chronological photo feed.

**Live URL:** whereisray.com
**Audience:** ~30-50 friends and family members, accessed primarily on mobile (iPhones)
**Update workflow:** Owner posts from phone while traveling — uploads photos to Cloudinary, pushes markdown files via GitHub mobile app, and manages upcoming schedule via a Notion table.

---

## Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | **Astro** (latest stable) | Static-first, zero JS by default, content collections for markdown, deploys to Cloudflare Pages natively |
| Hosting | **Cloudflare Pages** | Free, global CDN (fast loads from SE Asia and US), GitHub integration for auto-deploy on push |
| Content (photos) | **Markdown files** in `src/content/posts/` | Each post is a `.md` file with frontmatter. Owner creates via GitHub mobile app |
| Content (schedule) | **Notion API** → fetched at build time | Owner manages upcoming schedule in a Notion table; Astro fetches at build time via `@notionhq/client` |
| Images | **Cloudinary** (free tier) | Upload via Cloudinary mobile app, reference URLs in markdown frontmatter. Auto-optimizes format/size |
| Map | **Mapbox GL JS** | Monochrome custom style, GeoJSON route data, pulsing current location dot |
| PWA | **manifest.json** + meta tags | iOS/Android home screen bookmark with custom icon and title |

---

## Design System

### Theme: Charcoal

```css
--bg: #1A1B1E;
--surface: #242528;
--text: #E0E1E3;
--text-secondary: #95979D;
--text-tertiary: #65676D;
--border: #303136;
--accent: #B8A88A;          /* Sand */
--map-dot: #2A2B2F;

/* Country colors (progress bar + map labels) */
--vietnam: #C47A5A;         /* Terracotta */
--cambodia: #8B7355;        /* Warm brown */
--laos: #6B8F71;            /* Sage */
--indonesia: #7A8B99;       /* Slate */
```

### Typography

- **Font:** Plus Jakarta Sans (Google Fonts)
- **Weights:** 300 (light/secondary text), 400 (body), 500 (headings, emphasis)
- **Display heading (city name):** `clamp(36px, 7vw, 48px)`, weight 500, letter-spacing -0.03em
- **Site title:** 17-18px, weight 500
- **Body text:** 13-14px, line-height 1.6
- **Metadata/labels:** 10-11px, uppercase, letter-spacing 0.06-0.08em
- **No other fonts.** Plus Jakarta Sans only throughout.

### Spacing & Layout

- **Max content width:** 680px, centered
- **Horizontal padding:** `clamp(16px, 5vw, 24px)`
- **Section spacing:** 48-64px between major sections
- **Structure through whitespace and typography weight only** — no borders, no drop shadows, no gradients except where specified
- **Border-radius:** 8px for photos/cards, 10-12px for map container, 8px for password input/button
- **Dividers:** 1px solid var(--border) used sparingly; thin centered 28px line between sections

### Motion

- Route path on map: SVG stroke-dashoffset animation, draws on page load over 3s
- Current location dot: subtle pulse animation (radius 8→14→8, opacity 0.15→0.05→0.15, 3s loop)
- Photo cards: fade-in + translateY(20px→0) on scroll into viewport, staggered by 100ms per card
- Progress bar: width transition 1s ease
- Password gate: shake animation on wrong password (translateX keyframes, 400ms)
- **No other animations.** Restraint is the point.

---

## Site States

### Pre-trip state (before May 28, 2026)

Show when `currentDate < departureDate`:
- Same password gate
- After unlock: centered layout with site title, a countdown ("Departing in X days"), the route map with all points shown as unfilled/future dots and the full route as a dashed line, and the country list with date ranges
- No photo feed section, no "coming up" section
- Footer with trip dates

### Live state (May 28 – Jul 28, 2026)

The full layout:
1. Header (site title + "Day X of 62")
2. Status hero (pulsing dot + "Currently in" + city name + country flag)
3. Progress bar (color-coded by country)
4. Route map
5. "Coming up" section (next 4-7 days from Notion)
6. Divider
7. "Field notes" photo feed (reverse chronological)
8. Footer

### Post-trip state (after Jul 28, 2026)

- Header changes to "62 days · 4 countries"
- Status hero changes to "Trip complete" or similar
- Progress bar fully filled
- Map shows full route, all dots filled
- Photo feed remains, no "coming up" section
- Consider: a summary stat line (X posts, X countries, X cities)

---

## Page Structure (Single Page)

The entire site is a single `index.astro` page. No routing, no tabs.

```
src/
├── components/
│   ├── PasswordGate.astro      # Client-side password check
│   ├── StatusHero.astro        # Current location display
│   ├── ProgressBar.astro       # Country progress bar
│   ├── RouteMap.astro          # Mapbox GL JS map (client:load)
│   ├── UpcomingSchedule.astro  # Next N days from Notion
│   ├── PhotoFeed.astro         # Reverse-chron photo cards
│   ├── PhotoCard.astro         # Single post with scroll gallery
│   └── Countdown.astro         # Pre-trip countdown display
├── content/
│   └── posts/                  # Markdown photo posts
│       ├── 2026-05-28-hanoi.md
│       ├── 2026-05-29-hanoi-day2.md
│       └── ...
├── data/
│   ├── route.json              # GeoJSON route coordinates
│   └── countries.json          # Country metadata (colors, date ranges, flags)
├── lib/
│   ├── notion.ts               # Notion API client for schedule
│   └── dates.ts                # Trip state logic (pre/live/post)
├── layouts/
│   └── Layout.astro            # HTML shell, meta tags, fonts, manifest link
├── pages/
│   └── index.astro             # Single page, assembles all components
├── styles/
│   └── global.css              # CSS variables, resets, base styles
└── public/
    ├── manifest.json           # PWA manifest
    ├── icon-192.png            # Home screen icon
    ├── icon-512.png            # Splash icon
    └── og-image.png            # Social preview image
```

---

## Content Schema

### Post frontmatter (`src/content/posts/*.md`)

```yaml
---
title: "Tra Que Cooking Class"
date: 2026-06-14
day: 18
location: "Hoi An"
country: "vietnam"        # matches key in countries.json
coordinates: [15.8801, 108.338]   # [lat, lng] — used to update current position
images:
  - url: "https://res.cloudinary.com/xxx/image/upload/v1/trip/hoi-an-cooking-1.jpg"
    alt: "Herbs in the garden at Tra Que"
  - url: "https://res.cloudinary.com/xxx/image/upload/v1/trip/hoi-an-cooking-2.jpg"
    alt: "Cao lau noodles from scratch"
---

Cooking class at Tra Que Herb Village. Picked herbs from the garden, made cao lau from scratch. The turmeric noodles here literally can't be replicated anywhere else — the water comes from one specific well.
```

**Content collection config** (`src/content/config.ts`):

```ts
import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    day: z.number(),
    location: z.string(),
    country: z.enum(['vietnam', 'cambodia', 'laos', 'indonesia']),
    coordinates: z.tuple([z.number(), z.number()]),
    images: z.array(z.object({
      url: z.string().url(),
      alt: z.string(),
    })).min(1),
  }),
});

export const collections = { posts };
```

### Route data (`src/data/route.json`)

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "city": "Hanoi", "country": "vietnam", "day": 1 },
      "geometry": { "type": "Point", "coordinates": [105.8542, 21.0285] }
    }
  ]
}
```

Also include a LineString feature for the full route path for Mapbox to render.

### Countries data (`src/data/countries.json`)

```json
[
  {
    "id": "vietnam",
    "name": "Vietnam",
    "flag": "🇻🇳",
    "color": "#C47A5A",
    "startDay": 1,
    "endDay": 21,
    "startDate": "2026-05-28",
    "endDate": "2026-06-17"
  },
  {
    "id": "cambodia",
    "name": "Cambodia",
    "flag": "🇰🇭",
    "color": "#8B7355",
    "startDay": 22,
    "endDay": 31,
    "startDate": "2026-06-18",
    "endDate": "2026-06-27"
  },
  {
    "id": "laos",
    "name": "Laos",
    "flag": "🇱🇦",
    "color": "#6B8F71",
    "startDay": 32,
    "endDay": 43,
    "startDate": "2026-06-28",
    "endDate": "2026-07-09"
  },
  {
    "id": "indonesia",
    "name": "Indonesia",
    "flag": "🇮🇩",
    "color": "#7A8B99",
    "startDay": 44,
    "endDay": 62,
    "startDate": "2026-07-10",
    "endDate": "2026-07-28"
  }
]
```

---

## Notion Integration (Upcoming Schedule)

### Notion table schema

| Column | Type | Example |
|--------|------|---------|
| Date | Date | 2026-06-15 |
| Title | Title | Hoi An → Da Nang half-day |
| Subtitle | Rich text | Marble Mountains, beach sunset |
| Day | Number | 19 |

### Fetch logic (`src/lib/notion.ts`)

- Use `@notionhq/client` to query the database
- Filter: `date >= today`, sort ascending by date, limit to 4-7 entries
- Fetch at **build time** (not runtime) — this means the schedule updates when the site rebuilds (i.e., when a new post is pushed)
- Store NOTION_API_KEY and NOTION_DATABASE_ID as environment variables in Cloudflare Pages
- Fallback: if Notion fetch fails, show nothing (don't break the page)

---

## Password Gate

### Implementation

- Client-side only (no server auth needed for this threat model)
- Single shared password stored as a hashed constant in the built JS
- On correct entry: set a localStorage key (`whereisray_auth = true`) that persists indefinitely
- On page load: check localStorage — if authed, skip gate entirely
- Wrong password: shake animation on the input container, no error text needed
- **Password value:** Will be set before launch — use a placeholder in code and note where to change it

### Gate UI

- Centered vertically and horizontally
- Site title in Plus Jakarta Sans, 500 weight, ~32px
- Subtitle: "southeast asia · 2026" in text-tertiary, 13px
- Password input: centered, no visible label, placeholder "password", 14px, letter-spacing 0.1em
- "enter" button below: full width of input, bg = var(--text), color = var(--bg), 13px, letter-spacing 0.06em
- No "forgot password" or other UI

---

## Route Map

### Mapbox setup

- Use Mapbox GL JS (free tier covers this usage)
- **Style:** `mapbox://styles/mapbox/dark-v11` as base, then override to match charcoal theme:
  - Background: var(--surface)
  - Water: slightly lighter than bg
  - Labels: minimal or off
  - Land: var(--bg)
- Store MAPBOX_ACCESS_TOKEN as env variable, inject at build time as a public env var

### Map layers

1. **Full route line** (dashed, var(--border) color, 1.5px) — always visible
2. **Visited route line** (solid, country-colored or sand accent, 2px) — up to current location
3. **All stop points** (small circles at each city)
   - Visited: filled, sand accent, slight opacity
   - Current: larger, pulsing (CSS animation on a marker element)
   - Future: unfilled/stroke only, var(--border)
4. **Country labels** — small uppercase text positioned near each country's cluster of points

### Current location logic

- Derived from the most recent post's `coordinates` field
- If no posts yet (pre-trip), no current dot shown
- The map should be non-interactive by default (no zoom/pan on scroll) to prevent accidental scroll hijacking on mobile. Add a small "expand" button in the corner that enables interaction.

---

## Photo Feed

### Layout

- Single column, reverse chronological (newest first)
- Each card: image(s) → metadata line (day + location) → caption text
- 48px gap between cards
- Images: full width of content column, 8px border-radius, aspect ratio preserved from source

### Multi-image posts (horizontal scroll)

- If `images.length > 1`: render a horizontal scroll strip
- Each image is the full height of the container, scroll snaps to each image
- Small dot indicators below the strip showing position (like iOS photo carousel)
- CSS `scroll-snap-type: x mandatory` on the container, `scroll-snap-align: center` on each image
- Hide scrollbar: `-webkit-scrollbar { display: none }`, `scrollbar-width: none`
- This component should be an Astro island with `client:visible` for the scroll indicator state

### Intersection Observer for fade-in

- Each PhotoCard fades in when it enters the viewport
- Use a shared IntersectionObserver (threshold: 0.1)
- On intersect: add a CSS class that transitions opacity 0→1 and translateY 20px→0 over 600ms
- Stagger by index is not needed since cards enter viewport one at a time during scroll

---

## PWA / Home Screen

### manifest.json

```json
{
  "name": "Where Is Ray",
  "short_name": "Ray",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1A1B1E",
  "theme_color": "#1A1B1E",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Meta tags (in Layout.astro `<head>`)

```html
<meta name="theme-color" content="#1A1B1E" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<link rel="apple-touch-icon" href="/icon-192.png" />
<link rel="manifest" href="/manifest.json" />

<!-- OG tags -->
<meta property="og:title" content="Where Is Ray" />
<meta property="og:description" content="Following a 62-day trip through Southeast Asia" />
<meta property="og:image" content="/og-image.png" />
```

---

## Responsive Behavior

### Mobile (< 640px)

- Full-bleed photos (content padding still applies, photos fill the column)
- Map height: ~55vw
- City name heading: 36px
- Touch-friendly horizontal scroll on multi-image posts
- Password input and button: full width

### Desktop (≥ 640px)

- Content column maxes at 680px, centered
- Map height: ~380px
- City name heading: 48px
- Horizontal scroll still works but images are larger
- More whitespace between sections (64px vs 48px)

No breakpoint-specific layout changes beyond scaling. The single-column design is intentionally the same structure on both — just more breathing room on desktop.

---

## Environment Variables

```
MAPBOX_ACCESS_TOKEN=pk.xxx          # Public (exposed in client JS)
NOTION_API_KEY=ntn_xxx              # Server-only (build time)
NOTION_DATABASE_ID=xxx              # Server-only (build time)
```

Set these in Cloudflare Pages dashboard under Settings → Environment Variables.

---

## Build & Deploy

### Local development

```bash
npm create astro@latest whereisray
cd whereisray
npm install @notionhq/client mapbox-gl
npm run dev
```

### Deploy pipeline

1. Push to GitHub `main` branch
2. Cloudflare Pages auto-builds (build command: `npm run build`, output dir: `dist/`)
3. Site live at whereisray.com (configure custom domain in Cloudflare Pages)

### Posting workflow (on the road)

1. Take photo → upload to Cloudinary via mobile app (30 sec)
2. Open GitHub mobile → navigate to `src/content/posts/` → create new file → paste frontmatter template + Cloudinary URL + write caption (60-90 sec)
3. Push to `main` → triggers Cloudflare Pages rebuild → live in ~90 sec
4. Notion table for upcoming schedule can be updated anytime — changes appear on next site rebuild

---

## Build Order (Suggested)

### Phase 1 — Skeleton
1. Initialize Astro project, install dependencies
2. Set up global CSS with all design tokens
3. Create Layout.astro with font loading, meta tags, manifest
4. Build the password gate component
5. Build the single index page with placeholder sections

### Phase 2 — Core content
6. Set up content collection schema and create 2-3 sample posts
7. Build PhotoCard component (single image first)
8. Build PhotoFeed component (reverse chronological list)
9. Add multi-image horizontal scroll to PhotoCard
10. Add intersection observer fade-in animation

### Phase 3 — Status & navigation
11. Build date logic (pre-trip / live / post-trip state detection)
12. Build StatusHero component (current city derived from latest post)
13. Build ProgressBar component with country colors
14. Build Countdown component for pre-trip state
15. Wire up state switching on index page

### Phase 4 — Map
16. Set up Mapbox with custom dark style
17. Load route.json as GeoJSON source
18. Render full route (dashed), visited route (solid), stop points, current location pulse
19. Disable scroll zoom by default, add interaction toggle

### Phase 5 — Notion schedule
20. Set up Notion API client
21. Create the Notion database with the schema above
22. Fetch upcoming entries at build time
23. Build UpcomingSchedule component
24. Handle empty/error states gracefully

### Phase 6 — Polish & deploy
25. Add PWA manifest and icons
26. Add OG image and meta tags
27. Test on iPhone Safari (primary audience device)
28. Configure Cloudflare Pages with custom domain
29. Set real password
30. Test full posting workflow (Cloudinary → GitHub → deploy)

---

## Reference: Design Prototype

The final design direction was validated through interactive prototypes. Key decisions:

- **Theme:** Charcoal (`#1A1B1E` background)
- **Font:** Plus Jakarta Sans, single font throughout
- **Accent:** Sand (`#B8A88A`)
- **Country colors:** Terracotta (#C47A5A), Warm Brown (#8B7355), Sage (#6B8F71), Slate (#7A8B99)
- **Layout:** Single page, single column, 680px max width
- **Photo feed:** Reverse chronological, horizontal scroll for multi-image posts
- **Map:** Mapbox dark style, animated route line, pulsing current location
- **Password:** Client-side, localStorage persistence, enter once
- **Pre-trip:** Countdown + map with future route shown
- **Aesthetic:** Japanese/Scandinavian minimalism. Structure through whitespace and type weight. No borders, no shadows, no gradients. Photos do the visual work; UI recedes.
