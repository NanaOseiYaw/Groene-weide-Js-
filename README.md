# Camping De Groene Weide

A booking website for a small farm campsite. Guests book a spot themselves in a few steps; Bert and Anita (staff) see every reservation in an overview.

This is the JavaScript version of the original C# (Blazor) project. The migration happens in phases; see [docs/migration-plan.md](docs/migration-plan.md) for the architecture, decisions and progress.

| Part | Technology | Status |
| :-- | :-- | :-- |
| Backend (`server/`) | Node.js 22, Express 5, SQLite (`better-sqlite3`) | Phase 1 done: app, config, database, seed |
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
    lib/             small shared helpers (errors, security headers)
  scripts/           the db:* commands
  test/              tests (*.test.js)
  data/              database file, mail log, uploads (created at runtime, not in git)
docs/                migration plan and other documentation
```

## Database

- SQLite, one file. The structure is in `server/src/db/migrations/`. To change it, **add a new numbered file** (e.g. `002_auth.sql`); never edit a file that is already committed.
- Money is stored in **cents** (`2500` = € 25,00), dates as `YYYY-MM-DD` text. The comments at the top of `001_initial.sql` explain all conventions.
- Bookable spot = available, not a reserve tent, and no confirmed reservation in the period. A reservation occupies the nights from arrival up to the day before departure; the departure day is free again.

## API errors

Every error response has the same shape, with a Dutch message that can be shown to the user:

```json
{ "error": { "code": "not_found", "message": "Deze pagina of gegevens bestaan niet." } }
```
