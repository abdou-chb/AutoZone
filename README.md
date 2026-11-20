# AutoZone

**AutoZone** is a used‑vehicle marketplace for Algeria. It brings four vehicle categories together under one roof, adds an immersive 3D car studio, and lets buyers request an inspection, configure and order a car, or ask for a repair — then follow each request to completion. A full administration back office runs the whole operation.

All prices are in **Algerian dinars (DA)** and the interface is available in **English, French and Arabic** (with full right‑to‑left support).

---

## Table of contents

- [What AutoZone is](#what-autozone-is)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the app](#running-the-app)
- [Admin panel](#admin-panel)
- [Project structure](#project-structure)
- [Notes](#notes)

---

## What AutoZone is

AutoZone is organised into **four marketplace zones**, each with its own catalogue and filters:

| Zone | Vehicles |
|------|----------|
| **AutoZone** | Cars |
| **BikeZone** | Bicycles |
| **MotoZone** | Motorcycles |
| **TruckZone** | Trucks & work vehicles |

On top of the marketplace it offers:

- **Tuning Zone** — a cinematic 3D car configurator and showroom. Visitors pick one of several real car models, customise it (paint, wheels, lights, interior, and more) with **live option pricing in DA**, and can **request that configured car**. The same 3D studio also powers a **"Request a repair"** flow, where the problem is reported directly on a 3D car.
- **A request & tracking system** — inspection requests, car requests and repair requests, each identified by a reference the visitor uses to follow it.
- **An admin back office** — to review and manage every listing and request end‑to‑end.

> **No customer accounts.** Visitors are anonymous. Instead of signing up, a visitor receives a **reference** when they submit a request (an inspection number, `TZ-…` for a car request, or `RP-…` for a repair) and follows it on the **Track a request** page using that reference **plus the phone number** they provided. Only administrators log in.

---

## How it works

**Visitor side**

1. Browse a zone's catalogue; filter (type, brand, condition, price), search, sort and paginate.
2. Open a listing to see the photo gallery, specifications, price in DA and description.
3. Save vehicles to a favourites list.
4. **Request an inspection** for a listing, **configure and request a car** in the Tuning Zone, or **request a repair** — fill the form, attach photos where supported, and receive a reference.
5. **Track a request** with the reference + phone: see a status timeline, and for a repair, review the garage's **quotation and proposed schedule** and **accept, decline, or ask a question**.
6. List a vehicle for sale, or contact the team.

**Administrator side**

1. Log in to the back office.
2. Review incoming listings and requests from the dashboard.
3. Manage listings (approve/reject, edit, images), inspection requests (schedule, confirm, complete), car requests (approve/reject), and repair requests (**build a quotation with server‑computed totals**, set a schedule, send the response, then advance the repair through its stages).
4. Read and reply to contact messages; manage brands, zones, settings, the team and the activity log.

Both sides always see a **consistent, up‑to‑date status**: when an administrator updates a request, the change appears on the visitor's tracking page.

---

## Tech stack

- **Frontend:** [React 19](https://react.dev/) + [Vite](https://vite.dev/), React Router, i18n (EN/FR/AR).
- **3D (Tuning Zone):** [Three.js](https://threejs.org/) with [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) and drei.
- **Backend:** [Express 5](https://expressjs.com/) + [better‑sqlite3](https://github.com/WiseLibs/better-sqlite3) (a single SQLite database file).
- **Auth:** JWT for the admin panel, bcrypt password hashing.
- **Uploads:** [multer](https://github.com/expressjs/multer) (image uploads stored on disk).

---

## Features

- Four vehicle zones with a shared, consistent catalogue UI.
- Search, filter (type / brand / condition / price), sort and pagination.
- Rich listing pages (gallery, specs, DA pricing, description).
- Saved / favourite vehicles.
- Inspection requests, car requests (Tuning Zone), and repair requests.
- 3D Tuning Zone: configure a car with live DA option pricing; cinematic "Request this car" scene; 3D "Request a repair" with clickable problem areas.
- Track any request by reference + phone, with a status timeline; accept / decline / ask a question on a repair quotation.
- "Sell your vehicle" submission and a contact form.
- Admin back office: dashboard, listings, inspections, car requests, repair quotations & scheduling, messages, brands, zones, settings, team, activity log, notifications.
- Trilingual UI (English / French / Arabic) with full RTL layout; light & dark themes; responsive on desktop, tablet and mobile.

---

## Prerequisites

- **Node.js 20 or newer** and **npm** (comes with Node).

Check your version:

```bash
node --version
```

---

## Installation

The frontend and the backend each have their own dependencies.

```bash
# 1. Clone the repository
git clone https://github.com/abdou-chb/AutoZone.git
cd AutoZone

# 2. Install the frontend dependencies (project root)
npm install

# 3. Install the backend dependencies
cd server
npm install
cd ..

# 4. Configure the backend environment
cp server/.env.example server/.env
#    then open server/.env and set:
#      JWT_SECRET      -> a long random string (>= 32 chars)
#      ADMIN_EMAIL     -> the first admin login email
#      ADMIN_PASSWORD  -> a strong admin password
#    (these create the first admin account on the first run)

# 5. Seed the database with demo data (catalogue, brands, etc.)
npm run seed
```

> `npm run seed` creates the SQLite database (`server/autozone.db`) and the first administrator account from the values in `server/.env`. The database, uploaded files and `.env` are intentionally **git‑ignored** and never committed.

---

## Running the app

AutoZone needs **two processes**: the API and the frontend. Open two terminals.

```bash
# Terminal 1 — API (Express), http://localhost:5000
npm run server
```

```bash
# Terminal 2 — Frontend (Vite), http://localhost:5173
npm run dev
```

Then open **http://localhost:5173** in your browser.

If your API runs somewhere other than `http://localhost:5000`, copy `.env.example` to `.env` at the project root and set `VITE_API_URL`.

---

## Admin panel

1. Go to **http://localhost:5173/admin/login**.
2. Sign in with the **`ADMIN_EMAIL`** and **`ADMIN_PASSWORD`** you set in `server/.env` (used to create the first admin when the database was first seeded).

To change the admin password later, run the server's reset script:

```bash
cd server
npm run reset-password
```

There is also `npm run generate-password` (in `server/`) to generate a password hash. Administrator accounts and roles (owner / moderator) are managed from the **Team** page inside the admin panel.

---

## Project structure

```
AutoZone/
├─ src/                  # React frontend
│  ├─ pages/             # Public pages + Tuning Zone + admin UI
│  ├─ components/        # Shared UI components
│  ├─ i18n/              # English / French / Arabic translations
│  └─ lib/               # API client, helpers
├─ server/              # Express + better-sqlite3 API
│  ├─ server.js          # App entry
│  ├─ routes/            # API routes (public + admin)
│  ├─ database.js        # Schema & SQLite setup
│  ├─ seed.js            # Demo data
│  └─ uploads/           # Uploaded images (git-ignored)
├─ docs/                # Documentation & use cases
│  ├─ use-cases-en.md    # Full use cases (English)
│  └─ use-cases-ar.md    # Full use cases (Arabic)
├─ tools/               # Test & tooling scripts
└─ README.md
```

For a complete, use‑case‑by‑use‑case description of everything a visitor and an administrator can do, see **[`docs/use-cases-en.md`](docs/use-cases-en.md)** (English) and **[`docs/use-cases-ar.md`](docs/use-cases-ar.md)** (Arabic).

---

## Notes

- **Languages & RTL:** the UI ships in English, French and Arabic; Arabic is laid out right‑to‑left.
- **Pricing:** all amounts are in Algerian dinars (DA).
- **Privacy model:** there are no customer accounts — requests are tied to the name, phone and email given, and followed by reference + phone. Only administrators authenticate.
- **Images:** catalogue photos are real stock images loaded from remote URLs, so an internet connection is needed to display them.
- **Secrets & data are not in this repository:** `server/.env`, the SQLite database and uploaded files are git‑ignored by design. Copy `server/.env.example` and seed your own database to get started.
