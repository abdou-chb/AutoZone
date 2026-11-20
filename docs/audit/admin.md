# Admin console audit

Date: 18 November 2026. Scope: `src/pages/admin/**`, the admin translation files and the admin API (`server/routes/admin-panel.js`, `server/settings.js`). Tested on the test copy (site :5175, API :5060).

## Summary

The console was already in good shape. Every page loads, every action we tried works in English, French and Arabic, and no page scrolls sideways at any width from 360 to 1536 px. The automated checks found no unnamed controls, no unlabeled fields, no raw translation keys and no console errors.

We fixed 18 problems. The most important ones:

- On phones and tablets, the closed side menu could still be reached with the Tab key (12 hidden links before the page content).
- A "403 Forbidden" answer from the server was hidden: the action failed silently instead of showing an error.
- Every 20 s check for notifications re-rendered the whole console, even when nothing had changed.
- The inspection calendar did not update when a new request arrived.
- Four colour contrast failures (the notification badge in dark mode, hidden brands, unavailable zone sections) and two heading order problems.

Three problems remain in files the lead now owns (`useAdminSession.js`, `AdminShell.jsx`). The most important one: when a page fails to load with a 403, it shows an endless loading state. See "Remaining issues".

## Method

- **Functional tests.** We scripted end-to-end flows in headless Chrome against the test copy and logged in through the real login form. The flows covered: listing filters and the address bar (URL) after a reload, bulk feature and unfeature, editor checks and the "unsaved changes" dialog, brand create, duplicate, move, rename, hide, logo upload and removal, and delete. On the calendar: scheduling, the 409 clash (provoked by booking the same slot through the API while the dialog was open), confirm, complete, and cancel with its confirmation. In the inbox: a new message arriving live, plus the notification badge, toast and page title. We also checked the moderator view of the owner-only pages, a session expiry (401 sends you to the login page with a message), and 403 answers (simulated in the browser).
- **Automated check** on all 14 admin pages plus the login page × {en-light, fr-dark, ar-light, ar-dark} × {390, 1366 px}. It looks for: text contrast (WCAG AA), buttons and links without a name, fields without a label, sideways page scroll, controls smaller than 24 px, skipped heading levels, duplicate ids, raw translation keys, English words left in fr/ar, console errors and "Missing translation" warnings. A second pass checked sideways scroll at 360, 768, 1024 and 1536 px.
- **Keyboard checks** at 390 px: Tab order with the menu closed and open, Escape on the menu, bell, account menu and dialogs, and arrow keys in the month grid.
- **Server calls and re-renders.** We counted the API calls each page makes while idle for 43 s and checked that typed form input survives a notification check.
- **Translations.** We compared the keys of every admin translation file between en, fr and ar (missing keys, placeholders, text left in English).
- **Lint and build.** `npx eslint src/pages/admin server` passes. `npx vite build` passes: the AdminApp chunk is 200.9 kB JS (48.6 kB gzip) and 75.7 kB CSS.

## Findings

| ID | Severity | Page | Issue | Status |
|---|---|---|---|---|
| A1 | High | Shell (≤ 960 px) | The closed side menu stayed in the Tab order: keyboard users went through 12 invisible links before reaching the page. | Fixed: the closed menu is hidden (`visibility`), not only moved off-screen. |
| A2 | High | Listings, editor, brands, calendar, inbox | A 403 answer was treated like an expired session and ignored, so the action failed silently. | Fixed: only 401 and aborted requests stay silent. A 403 now shows the server message. |
| A3 | Medium | Shell, dark theme | The unread count on the bell had a contrast of 2.3:1. | Fixed: the badge text uses the page colour (≥ 5.8:1 in both themes). |
| A4 | Medium | Brands | The names of hidden brands were faded to 3.7:1. | Fixed: muted text colour instead of transparency; only the logo stays faded. |
| A5 | Medium | Zones | For sections a zone does not use, the explanation text was 2.3:1 (light) or 3.1:1 (dark). | Fixed: only the switch is faded; the text stays readable. |
| A6 | Medium | Zones, inspection panel | Headings skipped levels (h1 → h3 on Zones, quick filters in h4) and the appointment block used the wrong level. | Fixed: h2 / h3 in order. |
| A7 | Medium | All pages | Each 20 s notification check replaced the summary object, which re-rendered every page that uses the admin context. | Fixed: the summary only changes when its content changes. |
| A8 | Medium | Overview, inbox | The overview data was loaded twice on every visit. The inbox list was reloaded when the first summary arrived and when opening a message that was already read. | Fixed. |
| A9 | Medium | Calendar | A new inspection request did not appear until the page was reloaded. | Fixed: the requests and calendar reload when a new notification arrives (tested live: tray 3 → 4). |
| A10 | Low | Shell | Each notification sound opened a new AudioContext and never closed it. | Fixed. |
| A11 | Medium | Activity, overview | The new sign-in events showed raw codes ("auth.login") and raised "Missing translation" warnings, and no filter included them. | Fixed: labels in en/fr/ar. The "Team" filter is now "Team and sign-ins" (page and API). |
| A12 | Low | Overview, phone | The "Listings by zone" table hid its last column behind a sideways scroll at 390 px. | Fixed: tighter cells on phones; the table fits at 360 px. |
| A13 | Low | Overview | Hovering an appointment added a border and made the list jump by 1 px. | Fixed: hover background instead. |
| A14 | Low | Listings, overview | Listing checkboxes were 20 × 20 px and card links 22 px high (WCAG 2.5.8 asks for 24 px). | Fixed: 24 px. |
| A15 | Low | Brands | Removing an uploaded logo deleted the file with no confirmation. | Fixed: confirmation dialog (en/fr/ar). |
| A16 | Low | Brands | Focus fell back to the page after switching a brand's visibility. | Fixed: focus returns to the switch. |
| A17 | Low | Listings | When a bulk action skipped a listing, the message said its status did not allow it, even when the listing simply already had that state. | Fixed: the message names both reasons (en/fr/ar). |
| A18 | Low | Code | `InspectionsPanel.jsx` (about 270 lines) and three filter constants were unused. | Removed; the appointment block moved into `EventPanel.jsx`. |
| R1 | High | All pages (`useAdminSession.js`) | `useAdminData` ignores 403 answers, so the page shows a loading skeleton forever (seen on Activity with a simulated 403). | Open: lead's file. |
| R2 | High | Shell, phone menu (`AdminShell.jsx`) | When the menu opens, focus stays on the menu button and Tab moves through the page behind the dark overlay. Escape does not close the menu, and closing it does not return focus to the menu button. | Open: lead's file. |
| R3 | Medium | Shell (`AdminShell.jsx`) | Escape closes the bell and account menus but focus falls back to the start of the page. The account menu uses `role="menu"` without arrow-key support. | Open: lead's file. |
| R4 | Low | Listings, calendar (phone) | The status tabs and status chips scroll sideways with the last item cut off and no visual hint. | Open: design choice. |
| R5 | Low | All pages (`src/lib/ToastProvider.jsx`) | Error toasts close after 4 s. Errors should stay until the user closes them (WCAG 2.2.1). | Open: outside admin scope. |
| R6 | Low | Calendar | In the month view every day is a Tab stop (35 to 42); arrow keys already work. | Open: a roving tabindex would leave one Tab stop. |
| R7 | Low | Inbox | The search text (which can be a phone number or email) is kept in the URL (`?q=`). | Open: acceptable for an internal tool. |
| R8 | Low | Activity | Moderators can read the activity log, which now includes failed sign-ins with the email that was typed. | Open: decision needed. |

## Remaining issues and recommendations

1. **R1:** in `useAdminData`, replace `!isAuthError(error)` with `error?.status !== 401`. A 403 then shows the error box with "Try again" instead of an endless skeleton.
2. **R2:** in `AdminShell.jsx`, when the menu opens on a narrow screen:
   - move focus to the close button;
   - let Escape close the menu;
   - set `inert` on `.console__body` while the menu is open (only below 960 px);
   - return focus to the menu button when the menu closes.
   The closed state is already handled in CSS (A1).
3. **R3:** return focus to the trigger button when the bell or account menu is closed with Escape. For the account menu, either add arrow-key navigation or drop `role="menu"` / `menuitem` and keep the simple show/hide (disclosure) pattern.
4. **R5:** keep error toasts open until they are dismissed.
5. **Team dialog:** with the new token revocation, an owner who changes their own password in the Team dialog will be signed out. Make sure this is intended or handled.
6. **Performance:** the console now makes one small request every 20 s while idle (checked on Overview, Zones, Settings and Activity), and typing is kept across checks. The Listings page loads the whole `/api/admin/overview` payload only to show the counts in its tabs. A small counts endpoint would be lighter if the overview grows.

## Test data changed on the copy

- **Created:** inspection request #14 for vehicle 14 (Live Buyer); it was then scheduled, confirmed and completed.
- **Changed:** request #11 was scheduled and then cancelled; it was pending before the tests.
- **Removed:**
  - test message #8;
  - the test brand;
  - the test owner account `auditor@example.test`.
- **Put back:**
  - Renault (TruckZone) is visible again;
  - listing #30 is featured again.
- **Left as is:** the password of `mod@example.test` was reset for the moderator test (the brief asked for this) and the account is a moderator again.
- **Uploads:** the uploaded test logo was deleted by the server.
