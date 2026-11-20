# Public site audit

Date: 2026-11-18. Scope: everything a visitor sees (all four zones, listings, details, inspection request, track, saved, sell, contact, 404, header, footer, announcement bar, maintenance screen). The admin area is covered in `admin.md`.

## Summary

The public site was already in good shape: clean semantics, labelled forms with error messages wired to the fields, good RTL support, translated content in the three languages and a consistent design. The real problems were:

- **Performance**: every page downloaded one 708 kB script (235 kB gzip), including GSAP, the sell form, the brand logos and every other page. It is now split by page: the shared script is 392 kB (122 kB gzip), about half.
- **Accessibility**: form field borders were almost invisible for low-vision users (1.7:1, needs 3:1), several grey texts failed contrast, and on tablets and phones the menu could not be reached with the keyboard.
- **Small layout bugs**: header overflow on TruckZone at 360 px, scroll strips that hid the first tile edge, small footer and breadcrumb targets.

All findings below marked "Fixed" are in the code. Nothing was committed.

## Method

- Code review of every public page and shared component (`src/` minus `src/pages/admin/`).
- An automated check script run in headless Chrome on 17 pages (all zone homes, a listing per zone, inspection form, track, saved, sell for two zones, contact with and without a listing, 404, page 2 of a listing) in four combinations (English light, French dark, Arabic light, Arabic dark) at 390 and 1280 px, plus a second pass at 360, 768, 1024 and 1536 px. It checks text contrast from computed colors, controls without an accessible name, inputs without a label, images without `alt`, horizontal overflow, heading order, landmarks, duplicate ids, console errors, "Missing translation" warnings, English left in French or Arabic, duplicate API calls and targets smaller than 24 px.
- Keyboard and functional scripts on the test copy (port 5175 / API 5060): skip link, language menu, theme and language persistence, mobile menu, filters and pagination with URL sync and back/forward, gallery and lightbox (focus trap, arrows, Escape, focus return), save, track (validation, wrong phone, real request), inspection request, contact and sell forms submitted for real on the test copy only.
- Screenshots at 390 and 1280 px in light, dark and Arabic, reviewed by eye.
- Performance: production builds before and after, served with `vite preview`, measured in headless Chrome (LCP and CLS from `PerformanceObserver`, `Performance.getMetrics` for script time), three runs per page, median. Once without throttling at 1280 px and once at 390 px with a slow network (150 ms latency, 1.6 Mbit/s) and a 4x slower CPU.

## Findings

| ID | Severity | Page | Issue | Status |
|---|---|---|---|---|
| P1 | High | All | One 708 kB script (235 kB gzip) for every page: GSAP, Lenis plugins, sell form, contact, brand logos (57 kB) and all pages were downloaded before anything showed. | Fixed: pages load on demand (`src/routes.js`), the current page is loaded in parallel with the language before the first render, so there is no loading flash and no layout shift. Lightbox and brand logos load only when needed. Lenis no longer needs GSAP, so GSAP only comes with the zone home and the saved page. Main script 392 kB / 122 kB gzip, main CSS 80 kB → 27 kB. |
| P2 | Medium | Details, inspection, contact | Two `GET /api/cars/:id` per page in development. | Not a bug: React StrictMode runs the effect twice in development and the first request is aborted. The production build makes one request (measured). |
| A1 | High | All forms | Input, select and textarea borders at 1.7:1 in light and dark (WCAG 1.4.11 asks 3:1). Same for the yes/no switches and the photo drop zone. | Fixed: new `--line-input` token (3.6:1 light, 3.6 to 3.9:1 dark). |
| A2 | High | Header below 1200 px | Opening the menu left focus on the menu button; the next Tab went to the hero search, so keyboard users could not reach the menu links. Escape did not return focus, clicking outside or following the logo did not close it. | Fixed: focus moves to the first link, Escape closes and returns focus, outside click and any page change close it, `aria-controls` added. |
| A3 | Medium | Bikes home, sell preview, cards and gallery without photo | Grey text (`--subtle`) at 3.1:1 in light and 4.3:1 in dark ("None for sale", sell preview placeholders, "No photo", placeholders). | Fixed: token now 4.5:1 or more on white and grey surfaces in both themes. |
| A4 | Medium | All | Choosing a language left focus on the page body; Tab left the menu open; no Home / End keys. | Fixed. |
| A5 | Medium | All | The skip link added `#main` to the URL, which unselected "Buy a car" in the menu and triggered the hash scroll logic; `main` could not take focus. | Fixed: the link focuses `main` directly. |
| A6 | Medium | All | Smooth scrolling (Lenis) stayed on for visitors who ask for reduced motion. | Fixed: Lenis is off when `prefers-reduced-motion: reduce`. GSAP, React Bits and CSS animations already respected it (checked). |
| A7 | Low | Footer, details breadcrumb | Footer links 19 px high, breadcrumb links 14 to 17 px (WCAG 2.5.8 asks 24 px). | Fixed: 32 px footer rows, 24 px breadcrumb links. |
| A8 | Low | Header | The saved link said "Saved" without the number of saved vehicles. | Fixed: "Saved, 3 vehicles", with plurals in English, French and Arabic. |
| A9 | Low | Details | Changing photo with the arrows was silent for screen readers. | Fixed: polite live region with "photo 2 of 3". |
| A10 | Low | Details, inspection | When the API fails, the error page had no heading (`h1`). | Fixed. |
| A11 | Low | Zone homes | Focus rings of the picks tabs, body type tiles, brand tiles and quick filters were cut by their scroll containers. | Fixed: inset focus ring, more room around quick filters. |
| R1 | Medium | TruckZone at 360 px | Header wider than the screen (9 px horizontal scroll). | Fixed: smaller gaps and logo below 400 px. |
| R2 | Low | Zone homes on phones | "Browse by body type" and "Popular brands" strips snapped the first tile against the screen edge, without the page margin. | Fixed: `scroll-padding-inline`. |
| U1 | Low | Details on touch | The full-screen photo viewer had no swipe. | Fixed: horizontal swipe, mirrored in Arabic. |
| U2 | Low | Cars, bikes, motos, trucks homes | The range bar animation ran only in Arabic. | Fixed: same in all languages. |
| U3 | Low | Cards, details | Card and thumbnail images decoded on the main thread; the first gallery photo had no priority. | Fixed: `decoding="async"`, `fetchpriority="high"` on the first photo. |

Checked and fine: landmarks (one `main`, labelled navs), one `h1` per page, heading order, labels and error messages on all fields (`aria-invalid`, `aria-describedby`, focus on the first wrong field), images with `alt` or `alt=""`, toasts in a live region, no missing translations, no English left in French or Arabic except brand names and seller text, mirrored icons and arrows in Arabic, phone numbers and emails kept left to right, dark mode surfaces and borders, the four zone colors (button text 4.8 to 9:1), filters and pagination in the URL, back button and scroll restore, empty and error states, 404.

## Performance

Bundle (`npx vite build`):

| | Before | After |
|---|---|---|
| Main script | 708 kB (235 kB gzip) | 392 kB (122 kB gzip) |
| Main CSS | 80 kB (14.4 kB gzip) | 27 kB (6.3 kB gzip) |
| Zone home extra | in main | Home 80 kB + GSAP 71 kB (57 kB gzip together) |
| Details extra | in main | 14 kB + shared pieces |
| Brand logos | in main (57 kB) | loaded with the brand list only |

The page-load measurements (LCP, CLS, script time) were not written down: the audit stopped before this section was finished. The bundle sizes above come from the production build.

## Remaining issues and recommendations

- **Admin strings in the public bundle**: the English dictionary in the main script still holds about 40 kB of admin text, and the French and Arabic files the same. Loading the admin namespaces with the admin pages would save about 10 kB gzip per visitor.
- **Home LCP** is the hero photo, which fades in after it loads, plus the API calls for the grid and shelves. A `<link rel="preload">` of the hero image for the four zone homes, or showing it without the fade, would bring it earlier.
- **Arabic hero search**: the placeholder "Polo, Accent, Clio…" shows its ellipsis on the left. Cosmetic.
- **Placeholders** now use a darker grey that passes contrast; they look closer to typed text. Short example values keep this clear.
- **External links** (social networks, WhatsApp, announcement link) open a new tab without saying so. Low.
- **Test data**: the test copy holds a listing "Amir Richard 1977" at 432 DA with an orange placeholder photo; it is data, not code.
