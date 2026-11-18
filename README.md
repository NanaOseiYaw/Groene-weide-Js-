# Camping De Groene Weide

A booking website for a small farm campsite. Guests book a spot themselves in a few steps; Bert and Anita (staff) see every reservation in an overview.

This is the JavaScript version of the original C# (Blazor) project. The migration happens in phases; see [docs/migration-plan.md](docs/migration-plan.md) for the architecture, decisions and progress.

| Part | Technology | Status |
| :-- | :-- | :-- |
| Backend (`server/`) | Node.js 22, Express 5, SQLite (`better-sqlite3`) | Phases 1–3 done: database, public booking API, staff sign-in and staff API (daily overview, reservations, phone booking, spots out of use, photos) |
| Frontend (`client/`) | Vue 3 + Vite, existing Sass styling | Not started (phase 4) |
| AI (separate) | Python, by Mohammed, behind an HTTP contract | Not started (phase 7) |

Code, file names and comments are in English. Everything a guest or staff member reads is Dutch.

## Requirements

- [Node.js](https://nodejs.org) **22.11 or newer** (`node --version`). With nvm: `nvm use` reads `.nvmrc`.
- Nothing else: SQLite is included in the `better-sqlite3` package.

## First start

```bash
npm install
npm run dev
```

The API runs on http://localhost:3000. Check it with http://localhost:3000/api/health.

On the first start the server creates the database file `server/data/groeneweide.db`, builds the tables and fills them with dummy data (60 spots, test reservations in 2027). In development `npm run dev` restarts the server automatically when you save a file in `server/src`.

## Staff accounts

There is no registration page and no default account. Create an account in the terminal (from the repository root):

```bash
npm run create-staff -- "Anita" "anita@voorbeeld.nl" Staff
```

- The role is `Staff` (receptie) or `Admin` (beheerder).
- The password is asked for twice and is invisible while typing. At least 10 characters.
- The password never ends up in the code, git, the shell history or a log; the database only stores a hash.
- Sign in with `POST /api/auth/login` (the sign-in page follows with the frontend). "Onthoud mij" keeps you signed in for 30 days. After 5 wrong passwords the account is locked for 10 minutes.
- Accounts from the C# version cannot be carried over (different password format): create them again with this command.

## Configuration

All settings are environment variables with safe defaults, so a `.env` file is optional for local development. To change something:

```bash
cp .env.example .env
```

Then edit `.env`. It is in `.gitignore`: **never commit it**, and never put passwords or keys in the code. The meaning of every setting is explained in [.env.example](.env.example).

The phone number and e-mail address of the campsite in `.env.example` are **placeholders**; replace them with Bert's real details.

## Commands

Run these from the repository root.

| Command | What it does |
| :-- | :-- |
| `npm run dev` | Start the API in development mode (restarts on changes) |
| `npm start` | Start the API without watching files (production) |
| `npm test` | Run all tests (Node's built-in test runner) |
| `npm run db:migrate` | Apply new database migrations without starting the server |
| `npm run db:seed` | Add the dummy data to an empty database |
| `npm run db:reset` | Delete the local database and start again with fresh dummy data (stop the server first; refused in production) |
| `npm run create-staff -- "Naam" "mail" Staff` | Create a staff account (see above) |

## Folders

```
server/
  src/
    server.js        starts everything: settings → database → HTTP server
    app.js           the Express app: middleware, routes, error handling
    config.js        reads and checks the environment variables
    db/
      connection.js  opens SQLite with the right settings
      migrate.js     runs new files from migrations/ once, in order
      migrations/    the database structure, one numbered .sql file per change
      seed.js        dummy data for development
    lib/             small shared helpers: dates, Dutch formatting, validation, errors, e-mail, payment
    modules/         one folder per feature: *.service.js (rules + SQL) and *.routes.js (HTTP)
      admin/         staff: daily overview, reservation list, phone booking, spots out of use
      auth/          staff accounts, sign-in, sessions, the requireStaff check
      availability/  colourful calendar and the period check
      photos/        photo upload and management per spot
      pricing/       price per night with deal days
      reservations/  guest booking, payment, confirmation e-mail
      settings/      season and thresholds; GET /api/campsite
      spots/         spot types, spot list, spot details; the central "bookable" rules
  scripts/           the db:* commands
  test/              tests (*.test.js)
  data/              database file, mail log, uploads (created at runtime, not in git)
docs/                migration plan and other documentation
```

## Database

- SQLite, one file. The structure is in `server/src/db/migrations/`. To change it, **add a new numbered file** (e.g. `002_auth.sql`); never edit a file that is already committed.
- Money is stored in **cents** (`2500` = € 25,00), dates as `YYYY-MM-DD` text. The comments at the top of `001_initial.sql` explain all conventions.
- Bookable spot = available, not a reserve tent, and no confirmed reservation in the period. A reservation occupies the nights from arrival up to the day before departure; the departure day is free again.

## API

All endpoints, request and response examples and error codes: [docs/api.md](docs/api.md).

Every error response has the same shape, with a Dutch message that can be shown to the user:

```json
{ "error": { "code": "not_found", "message": "Deze pagina of gegevens bestaan niet." } }
```

## Test e-mail and test payment

- E-mails are not really sent in this version: they are written to `server/data/mail/mail.log`.
- Paying is simulated: it always succeeds after 1.5 seconds (`PAYMENT_DELAY_MS`). No money changes hands.

## No double bookings

Checking that a spot is free and saving the reservation happen in one database transaction that takes the write lock first (`insertReservationIfFree` in `server/src/modules/reservations/reservations.service.js`). `npm test` proves it in `server/test/double-booking.test.js`: 10 guests booking the same spot at the same moment, through the API and from 10 separate database connections, guests and staff mixed. Exactly 1 succeeds each time.
