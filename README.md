# Camping De Groene Weide

A booking website for a small farm campsite. Guests book a spot themselves in a few steps; Bert and Anita (staff) see every reservation in an overview.

This is the JavaScript version of the original C# (Blazor) project. The migration happens in phases; see [docs/migration-plan.md](docs/migration-plan.md) for the architecture, decisions and progress.

| Part | Technology | Status |
| :-- | :-- | :-- |
| Backend (`server/`) | Node.js, Express 5, SQLite (`better-sqlite3`) | Phases 1–3 done: database, public booking API, staff sign-in and staff API (daily overview, reservations, phone booking, spots out of use, photos) |
| Frontend (`client/`) | Vue 3, Vue Router 4, Vite 8, the original Sass styling | Phase 4 done: site frame, staff frame, shared components, sign-in page. Booking steps: phase 5. Staff pages: phase 6. New home page: phase 8 |
| Shared (`shared/`) | Plain JavaScript | Dates and Dutch formatting, used by both server and client |
| AI (separate) | Python, by Mohammed, behind an HTTP contract | Not started (phase 7) |

Code, file names and comments are in English. Everything a guest or staff member reads is Dutch.

## Requirements

- [Node.js](https://nodejs.org) **22.12 or newer**; the current LTS (24 or 26) is recommended. Check with `node --version`. With nvm: `nvm use` reads `.nvmrc`.
- Nothing else: SQLite is included in the `better-sqlite3` package, Sass in the `sass` package.
- After updating Node, delete `node_modules` and run `npm install` again (native parts such as SQLite and the Vite bundler are installed per Node version).

## First start

```bash
npm install
npm run dev
```

Open **http://localhost:5173**. `npm run dev` starts two things, and every line of output shows which one it comes from:

- `[web]` the Vue site via Vite on port 5173. Saving a `.vue`, `.js` or `.scss` file updates the browser straight away.
- `[api]` the API on port 3000 (Vite passes `/api` and `/uploads` on to it). It restarts when you save a file in `server/src`.

On the first start the API creates the database file `server/data/groeneweide.db`, builds the tables and fills them with dummy data (60 spots, test reservations in 2027).

npm 11 may say that install scripts were not run (`npm warn install-scripts`). That is fine: `better-sqlite3` and the Sass file watcher work without them.

## Production

```bash
npm run build
npm start
```

`npm run build` puts the finished site in `client/dist`. `npm start` runs only the Express server, which then serves the site and the API from one address (port 3000, or `PORT`). Set `NODE_ENV=production` on the server: cookies then only go over HTTPS and no dummy data is ever added.

## Staff accounts

There is no registration page and no default account. Create an account in the terminal (from the repository root):

```bash
npm run create-staff -- "Anita" "anita@voorbeeld.nl" Staff
```

- The role is `Staff` (receptie) or `Admin` (beheerder).
- The password is asked for twice and is invisible while typing. At least 10 characters.
- The password never ends up in the code, git, the shell history or a log; the database only stores a hash.
- Sign in at http://localhost:5173/account/login (or the link "Inloggen voor medewerkers" at the bottom of the site). "Onthoud mij 30 dagen" keeps you signed in. After 5 wrong passwords the account is locked for 10 minutes.
- Accounts from the C# version cannot be carried over (different password format): create them again with this command.

## Configuration

All settings are environment variables with safe defaults, so a `.env` file is optional for local development. To change something:

```bash
cp .env.example .env
```

Then edit `.env`. It is in `.gitignore`: **never commit it**, and never put passwords or keys in the code. The meaning of every setting is explained in [.env.example](.env.example).

The phone number and e-mail address of the campsite are only shown when they are set. The values in `.env.example` are **placeholders**; replace them with Bert's real details.

## Commands

Run these from the repository root.

| Command | What it does |
| :-- | :-- |
| `npm run dev` | Start the site (5173) and the API (3000) in development mode |
| `npm run build` | Build the Vue site into `client/dist` |
| `npm start` | Start the Express server: API plus the built site (production) |
| `npm test` | Run all tests (Node's built-in test runner) |
| `npm run db:migrate` | Apply new database migrations without starting the server |
| `npm run db:seed` | Add the dummy data to an empty database |
| `npm run db:reset` | Delete the local database and start again with fresh dummy data (stop the server first; refused in production) |
| `npm run create-staff -- "Naam" "mail" Staff` | Create a staff account (see above) |

## Folders

```
client/                    the Vue frontend
  index.html               the one HTML page; Vue fills <div id="app">
  public/                  images and icons, served as they are
  src/
    main.js                starts Vue: styles, router, app
    App.vue                picks the layout (guest site or staff section) for the current page
    router.js              all page addresses, page titles, the sign-in check for staff pages
    api/                   talking to the API: http.js (the only place that calls fetch) + one file per subject
    stores/                shared state, e.g. auth.js (who is signed in)
    composables/           shared logic for components, e.g. useCampsite.js (name, phone, season)
    layouts/               SiteLayout.vue (guests) and AdminLayout.vue (staff)
    pages/                 one component per page
    components/ui/         small shared building blocks: AppIcon, AlertBox, LoadingState, EmptyState, FieldSign, ModalDialog, …
    styles/                the Sass from the C# project (tokens, mixins, one file per component)
shared/                    dates and Dutch formatting, used by server and client
server/
  src/
    server.js              starts everything: settings → database → HTTP server
    app.js                 the Express app: middleware, routes, error handling, the built site
    config.js              reads and checks the environment variables
    db/                    connection, migration runner, migrations/*.sql, seed
    lib/                   small helpers: validation, errors, e-mail, payment, passwords, security headers
    modules/               one folder per feature: *.service.js (rules + SQL) and *.routes.js (HTTP)
      admin/               staff: daily overview, reservation list, phone booking, spots out of use
      auth/                staff accounts, sign-in, sessions, the requireStaff check
      availability/        colourful calendar and the period check
      photos/              photo upload and management per spot
      pricing/             price per night with deal days
      reservations/        guest booking, payment, confirmation e-mail
      settings/            season and thresholds; GET /api/campsite
      spots/               spot types, spot list, spot details; the central "bookable" rules
  scripts/                 the db:* and create-staff commands
  test/                    tests (*.test.js)
  data/                    database file, mail log, uploads (created at runtime, not in git)
scripts/dev.js             starts API and site together
docs/                      migration plan, API reference, design system, AI log
```

## Styling

The Sass from the C# project is used as it was: `client/src/styles/main.scss` loads everything once for the whole site. The Vue components use the same BEM class names as the Razor components did (`.field-card__price`, `.btn--large`, …), so the design stays the same. Rules of the design system: [docs/design-system.md](docs/design-system.md). In short: only tokens from `_variables.scss`, `em` instead of `px`, contrast at least 4.5 : 1, never colour as the only signal, tap targets at least 2.75em.

## Database

- SQLite, one file. The structure is in `server/src/db/migrations/`. To change it, **add a new numbered file** (e.g. `004_…sql`); never edit a file that is already committed.
- Money is stored in **cents** (`2500` = € 25,00), dates as `YYYY-MM-DD` text. The comments at the top of `001_initial.sql` explain all conventions.
- Bookable spot = available, not a reserve tent, and no confirmed reservation in the period. A reservation occupies the nights from arrival up to the day before departure; the departure day is free again.

## API

All endpoints, request and response examples and error codes: [docs/api.md](docs/api.md).

Every error response has the same shape, with a Dutch message that can be shown to the user:

```json
{ "error": { "code": "not_found", "message": "Deze pagina of gegevens bestaan niet." } }
```

In the frontend, `client/src/api/http.js` turns that into an `ApiError` with `status`, `code`, `message` and `fields`.

## Test e-mail and test payment

- E-mails are not really sent in this version: they are written to `server/data/mail/mail.log`.
- Paying is simulated: it always succeeds after 1.5 seconds (`PAYMENT_DELAY_MS`). No money changes hands.

## No double bookings

Checking that a spot is free and saving the reservation happen in one database transaction that takes the write lock first (`insertReservationIfFree` in `server/src/modules/reservations/reservations.service.js`). `npm test` proves it in `server/test/double-booking.test.js`: 10 guests booking the same spot at the same moment, through the API and from 10 separate database connections, guests and staff mixed. Exactly 1 succeeds each time.

## Known: `npm audit`

`npm audit` reports a high-severity ReDoS issue in `picomatch`, used by Vite and Sass while **building** (they match file patterns from our own config, never visitor input). No fixed version exists yet. The production dependencies have no known problems: `npm audit --omit=dev` finds 0.
