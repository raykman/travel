# whereisray.com — Website Review & Improvement Plan

## Overall Assessment

This is a well-architected, tastefully designed travel site. The charcoal + sand palette, Plus Jakarta Sans typography, and restrained motion design create a premium, editorial feel. The code is clean and idiomatic Astro. That said, there are meaningful gaps across data consistency, UX polish, performance, accessibility, and missing features called for in the build spec.

Below is a prioritized breakdown organized into copy-paste-ready Claude Code instructions.

---

## Priority 1: Data & Content Inconsistencies (Fix First)

These are factual/logical bugs that will confuse users or break trust.

### 1.1 — Trip duration mismatch between spec and code

The build spec says "62-day trip, May 28 – Jul 28" but the code uses "79 days, May 1 – Jul 18." The Layout description still says "62-day trip." The StatusHero post-trip state hardcodes "62 days · 4 countries" but countries.json has 5 countries (Japan was added). The header line in index.astro says `TRIP_LENGTH_DAYS` (79) but the spec references 62 throughout.

```
Instructions for Claude Code:

1. In src/layouts/Layout.astro, update the description prop default from
   "Following a 62-day trip through Southeast Asia" to
   "Following a 79-day trip through Asia" (the trip includes Japan, not just SE Asia).

2. In src/components/StatusHero.astro, change the post-trip hardcoded text
   "62 days · 4 countries" to use the actual constants:
   - Import TRIP_LENGTH_DAYS from '../lib/dates' and countries from '../data/countries.json'
   - Render: `${TRIP_LENGTH_DAYS} days · ${countries.length} countries`

3. Update og:description and twitter:description in Layout.astro to match.

4. In the build spec (whereisray-build-spec.md), update all references from
   "62 days" to "79 days" and "May 28 – Jul 28" to "May 1 – Jul 18" to match
   the actual data in dates.ts and countries.json. Update "4 countries" to
   "5 countries" since Japan was added.
```

### 1.2 — Country schema doesn't include Japan

The content.config.ts schema for the `country` field uses `z.enum(['vietnam', 'cambodia', 'laos', 'indonesia'])` — Japan is missing despite being in countries.json and route.json.

```
Instructions for Claude Code:

In src/content.config.ts, update the country enum to include 'japan':
  country: z.enum(['japan', 'vietnam', 'cambodia', 'laos', 'indonesia'])
```

### 1.3 — OG image uses relative URL

The og:image and twitter:image meta tags use `/og-image.png` which won't resolve correctly when shared on social media — they need absolute URLs.

```
Instructions for Claude Code:

In src/layouts/Layout.astro, change:
  <meta property="og:image" content="/og-image.png" />
  <meta name="twitter:image" content="/og-image.png" />
To:
  <meta property="og:image" content="https://whereisray.com/og-image.png" />
  <meta name="twitter:image" content="https://whereisray.com/og-image.png" />

Alternatively, use `new URL('/og-image.png', Astro.site).href` to derive it
from the site config dynamically.
```

---

## Priority 2: Missing Features from Build Spec

### 2.1 — No footer

The build spec calls for a footer in all three states (pre, live, post). Currently there is no footer at all.

```
Instructions for Claude Code:

Create a new component src/components/Footer.astro with:
- A simple, minimal footer consistent with the site's aesthetic
- Content: "whereisray.com" or a small "·" separated line with
  trip dates ("May 1 – Jul 18, 2026") and maybe a subtle heart or wave emoji
- Style: centered text, var(--text-tertiary), font-size 11px, uppercase,
  letter-spacing 0.06em, padding 48px top and 32px bottom
- Add bottom safe-area padding for iOS standalone PWA:
  padding-bottom: calc(32px + env(safe-area-inset-bottom, 0px))

Then import and add <Footer /> at the bottom of the Layout.astro <slot /> area,
or at the end of index.astro after the conditional content blocks.
```

### 2.2 — Post-trip state missing summary stats

The spec suggests "a summary stat line (X posts, X countries, X cities)" for post-trip.

```
Instructions for Claude Code:

In src/pages/index.astro, when state === 'post', add a summary stats section
after the StatusHero. Create a small PostTripStats.astro component or inline it:

- Count total posts from getAllPosts()
- Count unique countries from posts
- Count unique cities (locations) from posts
- Display as a single line: "16 posts · 5 countries · 12 cities"
  using the .label-lg style, centered, with var(--text-secondary) color
- Place it between StatusHero and ProgressBar
```

### 2.3 — No route line draw-on animation

The spec calls for "SVG stroke-dashoffset animation, draws on page load over 3s" on the route line. Currently the route just appears statically.

```
Instructions for Claude Code:

In src/components/RouteMap.astro, in the onLoad function, after adding the
'route-full' layer, add a stroke-dasharray animation:

After the route-full layer is added:
1. Get the total length of the route line (approximate it from the number of
   coordinates * average segment length, or use turf.js lineDistance if available)
2. Set initial paint: 'line-dasharray' with a step expression that starts fully
   dashed (hidden)
3. Use map.setPaintProperty in a requestAnimationFrame loop or CSS transition
   to animate the dasharray from fully-hidden to fully-visible over 3 seconds

A simpler approach: use two layers — one static dashed line (already there) and
animate the 'route-visited' solid line width from 0 to 2 over 3 seconds using
requestAnimationFrame and map.setPaintProperty('route-visited', 'line-width', ...).
```

### 2.4 — Photo card fade-in stagger

The spec mentions "staggered by 100ms per card" though it also says "stagger by index is not needed since cards enter viewport one at a time." Currently there's no stagger. Consider adding a subtle transition-delay based on card index for cases where multiple cards are visible on initial load (desktop).

```
Instructions for Claude Code:

In src/components/PhotoFeed.astro, pass the index to each PhotoCard.
In PhotoCard.astro, accept an optional `index` prop and add an inline style:
  style={`transition-delay: ${(index % 3) * 100}ms`}
to the .card article element. The modulo 3 ensures the delay resets so
late-scroll cards don't have absurdly long delays.
```

---

## Priority 3: UX & Visual Polish

### 3.1 — Password gate subtitle says "asia · 2026" — should reflect actual trip scope

```
Instructions for Claude Code:

In src/components/PasswordGate.astro, change the subtitle from:
  <p class="gate-subtitle">asia · 2026</p>
to something more evocative and accurate. Options:
  - "japan · southeast asia · 2026"
  - "asia · summer 2026"
  - "5 countries · 79 days"
Pick whichever feels right for the audience (friends/family).
```

### 3.2 — Map has no loading state

When the Mapbox tiles are loading (especially on slow SE Asian mobile connections), users see a blank gray rectangle. Add a loading indicator.

```
Instructions for Claude Code:

In src/components/RouteMap.astro:
1. Add a loading placeholder inside the .map div:
   <div id="route-map" class="map">
     <div class="map-loading" id="map-loading">
       <span class="label">Loading map…</span>
     </div>
   </div>

2. Style .map-loading as:
   display: flex; align-items: center; justify-content: center;
   height: 100%; color: var(--text-tertiary);
   font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase;

3. In the script, after `map.on('load', ...)` fires, remove or hide
   the loading element:
   document.getElementById('map-loading')?.remove();
```

### 3.3 — No scroll-to-top or back-to-top affordance

On a long photo feed (which this will become), users have no quick way to get back to the status/map area.

```
Instructions for Claude Code:

Create a small, minimal back-to-top button:
1. Add a <button> element at the bottom of index.astro (before </Layout>)
   with id="back-to-top", aria-label="Back to top"
2. Style: fixed bottom-right (right: 20px, bottom: 20px), 36x36px circle,
   var(--surface) background, var(--border) border, var(--text-secondary) color
   with a simple chevron-up SVG icon (stroke, no fill)
3. Initially hidden (opacity: 0, pointer-events: none)
4. JS: show when scrollY > window.innerHeight, hide when less
5. On click: window.scrollTo({ top: 0, behavior: 'smooth' })
6. Add safe-area-inset-bottom padding for iOS PWA mode
7. Respect prefers-reduced-motion for the scroll behavior
```

### 3.4 — No empty state for pre-trip photo section

In pre-trip mode, the photo feed and schedule sections are correctly hidden. Good — no issue here. But consider: the pre-trip view is quite sparse (countdown + map + country list). Consider adding a brief "what to expect" teaser or a short intro paragraph.

```
Instructions for Claude Code:

This is optional/low priority. In the pre-trip state in index.astro, consider
adding a brief intro line after the Countdown component:

<p class="intro-text text-secondary" style="text-align:center; max-width:400px; margin:24px auto 0;">
  Japan, Vietnam, Cambodia, Laos, and Indonesia.
  Check back here once the trip starts for live updates.
</p>

Style with font-size: 14px, font-weight: 300, line-height: 1.6.
```

### 3.5 — Progress bar labels are cramped on mobile

Five country names at 9px in a row can get very tight on a 375px screen.

```
Instructions for Claude Code:

In src/components/ProgressBar.astro, update the mobile layout:
1. On screens < 640px, abbreviate the labels or use only the first 3 characters:
   - "Japan" → "JPN", "Vietnam" → "VNM", etc.
   OR
2. Hide the labels entirely on very small screens (< 380px) and show only the
   color-coded bar, which is self-explanatory with the country list elsewhere.
   Add: @media (max-width: 380px) { .progress-labels { display: none; } }
3. Alternatively, make labels overflow-hidden with text-overflow: ellipsis.
```

---

## Priority 4: Performance Optimizations

### 4.1 — Google Fonts blocks rendering

The Google Fonts stylesheet is render-blocking. On slow connections this delays first paint.

```
Instructions for Claude Code:

In src/layouts/Layout.astro, switch to font-display: swap loading:
1. Change the Google Fonts URL to include &display=swap (already there — good)
2. Add a preload hint for the font CSS:
   <link rel="preload" as="style"
     href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500&display=swap" />

Alternatively, for best performance, self-host the font files:
1. Download the WOFF2 files for Plus Jakarta Sans 300/400/500
2. Place them in public/fonts/
3. Add @font-face declarations in global.css with font-display: swap
4. Remove the Google Fonts <link> tags
This eliminates the external dependency entirely — important when audience
is in SE Asia with variable connectivity.
```

### 4.2 — Mapbox CSS loaded in component body, not <head>

The Mapbox GL CSS `<link>` is at the bottom of RouteMap.astro, outside the `<head>`. This works but causes a flash of unstyled map content.

```
Instructions for Claude Code:

Move the Mapbox CSS link from the bottom of RouteMap.astro into Layout.astro's
<head> section:
  <link rel="stylesheet" href="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.css" />

And remove it from RouteMap.astro.
This ensures the CSS is loaded before the map renders.
```

### 4.3 — No image optimization strategy for Notion-sourced images

Notion images are downloaded at build time to public/uploads/ but served as-is with no resizing or format optimization. On mobile, full-size images from Notion could be multiple MB each.

```
Instructions for Claude Code:

Option A (simple): Add width/height attributes to img tags in PhotoCard.astro
and set reasonable max dimensions. Add CSS: .single img, .scroller-slide img {
  object-fit: cover; max-height: 500px; }

Option B (better): Install sharp as a dev dependency and write a small build
script (or Astro integration) that processes images in public/uploads/ to:
  - Resize to max 1200px wide
  - Convert to WebP with JPEG fallback
  - Generate a small blur placeholder for loading states

Option C (best): Since the spec mentions Cloudinary, ensure all image URLs
use Cloudinary transforms (w_1200,f_auto,q_auto) in the URL path. Update
the Notion image download logic in src/lib/notion.ts to either skip
downloading (use Cloudinary URLs directly) or apply transforms.
```

---

## Priority 5: Accessibility Improvements

### 5.1 — Password input has no visible label

Screen readers get the aria-label, but there's no visible label for sighted users who may not understand the unlabeled input.

```
Instructions for Claude Code:

This is a deliberate design choice (minimalist gate), so no change needed for
sighted users. However, improve the screen reader experience:
1. Add role="dialog" and aria-modal="true" to the #password-gate div
2. Add aria-describedby pointing to the subtitle text
3. Ensure focus is trapped within the gate while it's visible (currently the
   page behind is still tabbable)

In PasswordGate.astro's script, add focus trapping:
- On Tab key, if focus would leave the gate, redirect to the input or button
- This prevents keyboard users from tabbing into the invisible content behind
```

### 5.2 — Photo carousel has no keyboard navigation

The horizontal scroll carousel can only be navigated by touch/mouse drag. Keyboard and screen reader users can't navigate between images.

```
Instructions for Claude Code:

In src/components/PhotoCard.astro:
1. Add left/right arrow buttons (visually minimal) on multi-image cards:
   <button class="carousel-prev" aria-label="Previous image">‹</button>
   <button class="carousel-next" aria-label="Next image">›</button>
2. Style them as small semi-transparent overlays on the left/right edges of
   the image, visible on hover/focus, always visible on keyboard focus
3. Wire up click handlers that scroll the .scroller-track by one slide width
4. Add aria-roledescription="carousel" to the .scroller container
5. Add aria-label="Image X of Y" to each slide
6. Handle arrow key events when the carousel is focused
```

### 5.3 — Map section lacks meaningful aria description

```
Instructions for Claude Code:

In src/components/RouteMap.astro, enhance the section's aria-label:
  aria-label="Interactive route map showing travel path through Japan,
  Vietnam, Cambodia, Laos, and Indonesia"

For the non-interactive default state, add a visually-hidden text summary
below the map for screen readers:
  <p class="sr-only">Route: Tokyo, Niigata, Sapporo, Kobe, Okinawa, Hanoi,
  Hoi An, Ho Chi Minh City, Siem Reap, Phnom Penh, Luang Prabang, Thakhek,
  Jakarta, Yogyakarta, Surabaya, Pangkalan Bun</p>

Add the sr-only utility class in global.css:
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0;
  margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap;
  border: 0; }
```

---

## Priority 6: Code Quality & Robustness

### 6.1 — PhotoCard uses Math.random() for IDs

`const cardId = `pc-${Math.random().toString(36).slice(2, 10)}`;` — This is fine at runtime but can cause hydration mismatches if Astro ever SSRs this component. Use a deterministic ID based on props instead.

```
Instructions for Claude Code:

In src/components/PhotoCard.astro, replace:
  const cardId = `pc-${Math.random().toString(36).slice(2, 10)}`;
With:
  const cardId = `pc-${day}-${location.toLowerCase().replace(/\s+/g, '-')}`;

This creates deterministic, readable IDs like "pc-14-hoi-an".
Note: cardId isn't actually used in the template currently — if it's unused,
just remove it.
```

### 6.2 — PasswordGate hash is visible in source

The SHA-256 hash ships in client JS and the password ("welcome") is trivially reversible via rainbow tables. This is acknowledged as acceptable in the spec (client-side only, friends/family audience), but worth noting: anyone who views source can bypass the gate. Consider adding a comment noting this is intentional.

```
Instructions for Claude Code:

No code change needed — this is by design per the spec. But ensure the actual
deployment password is changed from "welcome" before launch. Add a comment
in PasswordGate.astro near the hash:

// NOTE: Client-side auth is intentionally lightweight. The hash is visible in
// source — this gates casual access, not determined adversaries. Change the
// password before launch: echo -n "yourpassword" | shasum -a 256
```

### 6.3 — Mapbox token exposed as public env var

Also by design, but ensure the Mapbox token has URL restrictions configured in the Mapbox dashboard to prevent abuse.

```
Instructions for Claude Code:

No code change. Operational reminder: In the Mapbox account dashboard, restrict
the public token to only allow requests from whereisray.com and localhost.
```

---

## Priority 7: Nice-to-Have Enhancements

### 7.1 — Add a "last updated" timestamp

Friends and family will wonder "is this current?" Show when the site was last rebuilt.

```
Instructions for Claude Code:

In the header or footer, add a "Last updated" line:
1. In index.astro frontmatter, add:
   const buildTime = new Date().toLocaleDateString('en-US', {
     month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
     timeZone: 'Asia/Bangkok'  // or relevant trip timezone
   });
2. Display it subtly in the footer or as a tooltip on the header-meta label.
```

### 7.2 — Add page transition / smooth scroll between sections

```
Instructions for Claude Code:

In global.css, add:
  html { scroll-behavior: smooth; }
  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
  }
```

### 7.3 — Improve the map fullscreen UX

Currently fullscreen has no way to close except the small X button or Escape key. On mobile, the X button may be hard to tap.

```
Instructions for Claude Code:

In src/components/RouteMap.astro:
1. Make the close button larger in fullscreen mode:
   :global(.map-wrap.is-fullscreen) .map-toggle {
     width: 40px; height: 40px; top: 16px; right: 16px;
   }
2. Add safe-area-inset padding for iOS notch:
   :global(.map-wrap.is-fullscreen) .map-toggle {
     top: calc(16px + env(safe-area-inset-top, 0px));
     right: calc(16px + env(safe-area-inset-right, 0px));
   }
3. Prevent body scroll while map is fullscreen:
   In the setFullscreen function, toggle document.body.style.overflow
   between 'hidden' and '' based on the fullscreen state.
```

### 7.4 — Add a subtle country color accent to photo cards

Each photo card could have a very subtle left border or top accent line in the country's color, tying the card visually to the progress bar.

```
Instructions for Claude Code:

In src/components/PhotoCard.astro:
1. Accept a `country` prop (string, country ID)
2. In PhotoFeed.astro, pass post.data.country to each PhotoCard
3. Import countries.json and look up the color
4. Add a subtle 2px left border to the .card:
   border-left: 2px solid ${countryColor};
   Or a small colored dot next to the day/location metadata line.
Keep it very subtle — a 2px accent, not a heavy border.
```

### 7.5 — Add pull-to-refresh hint for PWA users

Since the site is static and rebuilds on push, PWA users may not know to refresh. Consider a small "pull to refresh for latest updates" hint or a subtle refresh icon in the header.

```
Instructions for Claude Code:

Low priority. In the site header, add a small refresh button:
<button onclick="location.reload()" class="refresh-btn" aria-label="Refresh">
  <svg width="14" height="14" viewBox="0 0 14 14" ...>
    <!-- simple refresh/reload icon -->
  </svg>
</button>

Style it like the map-toggle button: small, subtle, var(--text-tertiary).
```

---

## Execution Order for Claude Code

Run these in sequence. Each is a standalone, testable change:

1. **Fix data inconsistencies** (1.1, 1.2, 1.3) — correctness first
2. **Add footer** (2.1) — completes the page structure
3. **Self-host fonts** (4.1) — biggest perf win for the SE Asia audience
4. **Move Mapbox CSS to head** (4.2) — quick win
5. **Map loading state** (3.2) — improves perceived performance
6. **Progress bar mobile fix** (3.5) — fixes a cramped layout
7. **Accessibility: sr-only class + map description** (5.3) — low effort, high impact
8. **Accessibility: focus trap on password gate** (5.1)
9. **Carousel keyboard nav** (5.2) — medium effort
10. **Back-to-top button** (3.3) — nice UX addition
11. **Post-trip stats** (2.2) — future-proofing
12. **Photo card country accent** (7.4) — visual polish
13. **Smooth scroll** (7.2) — one-liner
14. **Fullscreen map UX** (7.3) — mobile polish
15. **Route line animation** (2.3) — visual flair
16. **Last updated timestamp** (7.1) — trust signal
17. **Image optimization** (4.3) — do before trip starts
18. **Deterministic card IDs** (6.1) — cleanup
19. **Password gate subtitle** (3.1) — copy tweak
20. **Pre-trip teaser text** (3.4) — optional
