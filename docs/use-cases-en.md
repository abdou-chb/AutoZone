# AutoZone — Use-Case Document (Cahier des Charges)

## 1. Overview

**AutoZone** is a used-vehicle marketplace for Algeria. It is organised into four catalogue **zones**, plus a 3D experience, a request/tracking system and an administration back office:

| Zone | Vehicles |
|---|---|
| **AutoZone** | Cars |
| **BikeZone** | Bicycles |
| **MotoZone** | Motorcycles |
| **TruckZone** | Trucks |
| **Tuning Zone** | A 3D car configurator & showroom (six cars) with request and repair services |

Key product facts:
- **Prices in Algerian dinars (DA).**
- **Interface in English, French and Arabic** (Arabic is right-to-left); light and dark themes.
- **No customer accounts.** Visitors are anonymous. When they send a request they receive a **reference number**, and they follow it later with that reference **plus their phone number** on the Track page. Only administrators log in.
- Vehicle photos are real stock images; the Tuning Zone uses real 3D car models.

## 2. Actors

- **Visitor / User** — anonymous; browses the catalogue and submits and tracks requests.
- **Administrator** — signs in to the back office. Two roles:
  - **Owner** — full access, including team and sensitive settings.
  - **Moderator** — day-to-day management; cannot manage the team or owner-only settings.

## 3. Summary of use cases

| # | Actor | Use case |
|---|---|---|
| V1 | Visitor | Change language, theme or zone |
| V2 | Visitor | Browse a zone's catalogue |
| V3 | Visitor | Search vehicles |
| V4 | Visitor | Filter, sort and paginate the catalogue |
| V5 | Visitor | View a listing's details |
| V6 | Visitor | Save a listing and view Saved |
| V7 | Visitor | Request an inspection of a listing |
| V8 | Visitor | Explore the Tuning Zone (six 3D cars) |
| V9 | Visitor | Configure a car with live DA pricing |
| V10 | Visitor | Request the configured car (TZ-n) |
| V11 | Visitor | Request a repair (RP-n) |
| V12 | Visitor | Track a request by reference + phone |
| V13 | Visitor | Accept / decline / question a repair quote |
| V14 | Visitor | Sell a vehicle (submit a listing) |
| V15 | Visitor | Contact the team |
| A1 | Admin | Log in to the back office |
| A2 | Admin | See the overview / dashboard |
| A3 | Admin | Manage the vehicle listings |
| A4 | Admin | Manage inspection requests |
| A5 | Admin | Manage car requests |
| A6 | Admin | Manage repair requests (quote, schedule, respond) |
| A7 | Admin | Read and reply to contact messages |
| A8 | Admin | Manage brands |
| A9 | Admin | Manage zones & filters |
| A10 | Admin | Manage settings |
| A11 | Admin | Manage the team (owner only) |
| A12 | Admin | View the activity log |
| A13 | Admin | Manage their account |
| A14 | Admin | Receive notifications of new requests |

---

## 4. Visitor use cases

### V1 — Change language, theme or zone
- **Actor:** Visitor
- **Precondition:** On any page.
- **Steps:**
  1. Open the language menu and choose English, French or Arabic.
  2. Toggle the light/dark theme.
  3. Use the zone switcher to move between AutoZone, BikeZone, MotoZone, TruckZone and the Tuning Zone.
- **Result:** The whole interface updates to the chosen language (mirrored for Arabic), theme and zone.

### V2 — Browse a zone's catalogue
- **Actor:** Visitor
- **Precondition:** None.
- **Steps:**
  1. Open a zone's home page (e.g. `/bicycles`).
  2. See the "browse by type" tiles, the featured vehicles, popular brands and the full grid of vehicles, each with its photo, name, year, price in DA and key specifications.
- **Result:** The visitor sees the vehicles available in that zone.

### V3 — Search vehicles
- **Actor:** Visitor
- **Precondition:** On a zone page.
- **Steps:**
  1. Type a term (e.g. a brand or model) into the search box and submit.
  2. The results page shows the matching vehicles and the count, with an active search chip that can be cleared.
- **Result:** Only matching vehicles are shown.

### V4 — Filter, sort and paginate the catalogue
- **Actor:** Visitor
- **Precondition:** On a results/catalogue page.
- **Steps:**
  1. Apply quick filters (type, brand, condition such as New/Used, transmission, fuel, price range).
  2. Choose a sort order (newest, lowest price, etc.).
  3. Move between result pages.
- **Result:** The grid updates to reflect the filters, sort and page; the URL reflects the current view. All filtering, sorting and pagination is validated by the backend.

### V5 — View a listing's details
- **Actor:** Visitor
- **Precondition:** A listing exists.
- **Steps:**
  1. Open a vehicle card.
  2. View the image gallery, the price in DA, the full specifications, the description and the seller's location.
  3. Use the "Request an inspection" call to action.
- **Result:** The visitor sees everything about the vehicle and can act on it.

### V6 — Save a listing and view Saved
- **Actor:** Visitor
- **Precondition:** A listing exists.
- **Steps:**
  1. Click the heart/save control on a card or detail page.
  2. Open the **Saved** page to review saved vehicles; remove any.
- **Result:** The visitor keeps a personal shortlist (stored in the browser, consistent with the no-accounts model).

### V7 — Request an inspection of a listing
- **Actor:** Visitor
- **Precondition:** On a listing's detail page; inspection requests are enabled.
- **Steps:**
  1. Open "Request an inspection" for the chosen vehicle.
  2. Fill the form: full name, phone, preferred date, optional message. The selected vehicle is attached automatically.
  3. The form validates the inputs (name length, valid phone, a non-past date); errors are shown inline.
  4. Submit.
- **Result:** The request is saved with status **pending**; the visitor gets a confirmation and a request number to track it. The administrator is notified.

### V8 — Explore the Tuning Zone (six 3D cars)
- **Actor:** Visitor
- **Precondition:** On `/tuning`.
- **Steps:**
  1. The chosen car is shown in 3D with a cinematic opening shot, then free orbit/zoom.
  2. Use the selector (arrows or the gallery panel) to switch between the six cars (Golf GTI, Audi RS 6 Avant, BMW M3, VW Tiguan, Mercedes-AMG C 63, Toyota GR Supra). Each car keeps its own saved configuration.
- **Result:** The visitor inspects any of the six cars in 3D.

### V9 — Configure a car with live DA pricing
- **Actor:** Visitor
- **Precondition:** In the Tuning Zone.
- **Steps:**
  1. Open the sections (paint, wheels, glass & lights, details, interior, ambient light, engine) and choose options; the 3D car updates and the camera frames the relevant part.
  2. A price pill shows the running **options total in DA**; a breakdown lists each paid option. Prices are illustrative demo prices.
  3. Only options the car's model really supports are offered.
- **Result:** The visitor builds a personalised car and sees its price live.

### V10 — Request the configured car (TZ-n)
- **Actor:** Visitor
- **Precondition:** A car is configured.
- **Steps:**
  1. Choose "Request this car".
  2. A cinematic night scene plays: the chosen car in the centre, an Audi and a Mercedes arriving on either side; a request form appears.
  3. Fill the form (name, phone, optional email, wilaya, optional message) and send.
- **Result:** A car request is created as **pending**, with a reference **TZ-n**; the visitor gets the reference and a link to track it. The administrator is notified.

### V11 — Request a repair (RP-n)
- **Actor:** Visitor
- **Precondition:** On `/tuning`.
- **Steps:**
  1. Choose "Request a repair". A 3D studio scene opens with the car.
  2. Describe the vehicle (the shown model or a different one, with make/model/year/engine/mileage).
  3. Report problems: pick categories (engine, transmission, brakes, suspension, electrical, A/C, bodywork, tyres, interior, other), or click an area on the 3D car to tag where the problem is. For each problem add a description, a severity and, optionally, symptoms, when it started and photos.
  4. Enter contact details (name, phone, optional email, preferred date/time, comments).
  5. Review and send.
- **Result:** A repair request is created as **submitted** (never priced automatically), with a reference **RP-n**; the visitor gets the reference and a link to track it. The administrator is notified.

### V12 — Track a request by reference + phone
- **Actor:** Visitor
- **Precondition:** The visitor has a reference (a number for an inspection, **TZ-n** for a car request, **RP-n** for a repair) and the phone they used.
- **Steps:**
  1. Open the **Track a request** page.
  2. Enter the reference and the phone number.
  3. See the current status, a status timeline, dates and any message from the team.
- **Result:** The visitor sees the up-to-date status. A wrong phone returns "not found"; no other person's data is exposed.

### V13 — Accept / decline / question a repair quote
- **Actor:** Visitor
- **Precondition:** Tracking a repair whose quotation has been sent (status "quote ready").
- **Steps:**
  1. On the Track page, review the quotation (itemised, with subtotal, VAT and total in DA) and the proposed schedule.
  2. Choose **Accept the quote**, **Decline** (optional note), or **Ask a question** (required note).
- **Result:** The decision is recorded (guarded by the reference + phone) and the status moves accordingly; nothing is confirmed automatically.

### V14 — Sell a vehicle
- **Actor:** Visitor
- **Precondition:** None.
- **Steps:**
  1. Open **Sell** and choose the zone/vehicle type.
  2. Fill the vehicle details (name, year, location, price, condition, description, zone-specific attributes) and the seller's contact (name, email, phone), and upload photos.
  3. The form validates every field; errors are shown inline.
  4. Submit.
- **Result:** A listing is created for review (status **pending**); the visitor is told it was submitted. It appears in the catalogue once an administrator approves it.

### V15 — Contact the team
- **Actor:** Visitor
- **Precondition:** None.
- **Steps:**
  1. Open **Contact**.
  2. Enter name, an email or phone, a subject, and a message (optionally linked to a listing).
  3. The form validates the inputs; a hidden anti-spam field is included.
  4. Submit.
- **Result:** A message is saved for the team; the visitor sees a success confirmation.

---

## 5. Administrator use cases

### A1 — Log in to the back office
- **Actor:** Administrator
- **Precondition:** Has an admin account.
- **Steps:**
  1. Open `/admin/login`.
  2. Enter email and password and submit.
- **Result:** On success, a session token is issued and the back office opens. Wrong credentials are rejected with a generic message; repeated failures are temporarily locked out. Visiting any `/admin/*` page without a session redirects to the login.

### A2 — See the overview / dashboard
- **Actor:** Administrator
- **Precondition:** Logged in.
- **Steps:**
  1. Open the Overview.
  2. See the to-do counts (pending listings, pending inspections, pending car requests, new repair requests) and quick links.
- **Result:** The administrator sees what needs attention.

### A3 — Manage the vehicle listings
- **Actor:** Administrator
- **Precondition:** Logged in.
- **Steps:**
  1. Open **Listings**; search, filter (category, brand, status) and sort; paginate.
  2. Review a pending listing and **approve** or **reject** it.
  3. Open a listing to **edit** its fields, manage its images (set the main image, delete) and save.
  4. Use bulk actions where available.
- **Result:** Listing changes persist; approved listings appear in the public catalogue; the activity log records the actions.

### A4 — Manage inspection requests
- **Actor:** Administrator
- **Precondition:** Logged in; inspection requests exist.
- **Steps:**
  1. Open **Inspections** (list and calendar).
  2. Open a request to see the vehicle, the requester and the preferred date.
  3. **Schedule** an appointment (confirmed date/time, place, arrangement, payment note); then **confirm**, mark **completed**, or **cancel**.
- **Result:** The status and appointment persist and become visible to the visitor on the Track page.

### A5 — Manage car requests
- **Actor:** Administrator
- **Precondition:** Logged in; car (TZ) requests exist.
- **Steps:**
  1. Open **Car requests**; filter by status.
  2. Open a request to see the applicant, the chosen car and its full configuration with prices.
  3. **Approve** or **Reject** it, with an optional note to the applicant.
- **Result:** The decision persists and shows on the visitor's Track page.

### A6 — Manage repair requests (quote, schedule, respond)
- **Actor:** Administrator
- **Precondition:** Logged in; repair (RP) requests exist.
- **Steps:**
  1. Open **Repair requests**; see the applicant, the vehicle, the reported problems (with the tagged area and severity) and the uploaded photos.
  2. **Accept** for quoting, **Reject** with a reason, or **Request more information**.
  3. Build a **quotation**: add line items (diagnostic, parts, labour, service); the server computes each amount, the subtotal, the tax and the total (the client cannot tamper with totals).
  4. Set a **schedule** (confirmed arrival date/time, estimated duration, expected completion, instructions).
  5. **Send** the response to the customer.
  6. After the customer accepts, advance the repair stages: scheduled → received → in progress → completed (or cancel).
  7. See the customer's decision (accepted / declined / question).
- **Result:** Every step persists, is recorded in the audit trail, and is reflected on the visitor's Track page.

### A7 — Read and reply to contact messages
- **Actor:** Administrator
- **Precondition:** Logged in.
- **Steps:**
  1. Open **Messages**; read a message (with any linked listing).
  2. Reply, change its status, or delete it.
- **Result:** The message thread is managed.

### A8 — Manage brands
- **Actor:** Administrator
- **Precondition:** Logged in.
- **Steps:**
  1. Open **Brands**; add a brand, edit it, set its logo, reorder, toggle visibility, or delete it.
- **Result:** The brand list (used by filters and the "popular brands" section) is updated.

### A9 — Manage zones & filters
- **Actor:** Administrator
- **Precondition:** Logged in.
- **Steps:**
  1. Open **Zones**; configure the zones and their filters/attributes.
- **Result:** The catalogue's categories and filters reflect the configuration.

### A10 — Manage settings
- **Actor:** Administrator (some settings owner-only)
- **Precondition:** Logged in.
- **Steps:**
  1. Open **Settings**; change a setting (for example, whether inspection requests are enabled).
- **Result:** The setting persists. Sensitive settings are restricted to the owner.

### A11 — Manage the team (owner only)
- **Actor:** Owner
- **Precondition:** Logged in as owner.
- **Steps:**
  1. Open **Team**; create an administrator (name, email, role), edit, or deactivate one.
- **Result:** Admin accounts are managed. A moderator attempting this is refused.

### A12 — View the activity log
- **Actor:** Administrator
- **Precondition:** Logged in.
- **Steps:**
  1. Open **Activity** to see the recorded administrative actions.
- **Result:** The administrator reviews who did what and when.

### A13 — Manage their account
- **Actor:** Administrator
- **Precondition:** Logged in.
- **Steps:**
  1. Open **Account**; change the password/email; optionally sign out of all sessions.
- **Result:** The account is updated.

### A14 — Receive notifications of new requests
- **Actor:** Administrator
- **Precondition:** Logged in.
- **Steps:**
  1. A new inspection, car or repair request raises the notification bell count.
  2. Open the notification to go straight to the request.
- **Result:** The administrator is alerted to incoming work.

---

## 6. Request status lifecycles

The visitor (on Track) and the administrator always see the same, consistent status.

**Inspection request:**
`pending → scheduled → confirmed → completed` (or `cancelled`).

**Car request (TZ-n):**
`pending → approved` or `rejected`.

**Repair request (RP-n):**
`submitted → under review → (more info requested) → quote sent → accepted | declined → scheduled → received → in progress → completed` (plus `rejected`, `cancelled`). The customer acts only at "quote sent"; asking a question returns the request to the team. The server enforces the valid transitions.

---

## 7. Non-functional notes

- **Languages:** English, French, Arabic, with full right-to-left layout for Arabic.
- **Responsive:** works on desktop, tablet and mobile (touch-friendly controls, no horizontal scrolling).
- **Privacy model:** no customer accounts; a request belongs to its applicant through the name, phone and email they give, and is followed by reference + phone. The Track page is the customer's notification channel.
- **Administrator security:** token-based login with lockout on repeated failures; role-based permissions (owner vs moderator) enforced on the server; every admin action is audited.
- **Pricing:** all amounts in Algerian dinars; repair quotation totals are computed and validated on the server.
- **Media:** real vehicle photos; real 3D car models in the Tuning Zone.
