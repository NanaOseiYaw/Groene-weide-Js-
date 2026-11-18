# Migration plan: Groene Weide, C# (Blazor) → JavaScript (Node.js)

Status: **approved direction, nothing migrated yet** (18 November 2026). Decisions in §9.
Reference implementation: `lunahilly/Boer` (read only, never modified).
Destination: this repository, `Groene-weide-Js-`.

---

## 1. What the application is

Camping De Groene Weide is a booking system for a small farm campsite (60 spots, open 1 April – 31 October).

- **Guests** book a spot themselves in a one-page, 7-step flow, without an account.
- **Staff** (Bert, owner, and Anita, receptionist; both have low vision) sign in and see every reservation, a daily overview, take spots out of use and enter phone bookings.

The audience shapes everything: large text (`em`, never `px`), WCAG AA contrast, colour never the only signal, big tap targets (≥ 2.75em), keyboard support, Dutch UI text. The code itself is English.

---

## 2. Which C# code is the reference?

The reference repository has several branches. They are not equal:

| Branch | Where | Contents | Use for migration |
| :-- | :-- | :-- | :-- |
| `main`, `dev`, `AI-basis_app` | GitHub | The empty Blazor template (Counter, Weather, Bootstrap) | Nothing to migrate |
| `frontend-ontwerp` | GitHub | The complete MVP: guest booking flow (steps 1–7), staff section (daily overview, reservation list, spots on/off, phone booking, photos), design system, Gemini images. ~8,100 lines | **Baseline** |
| `medewerkersportaal` | **Only on Nana's machine** (not pushed) | Everything above plus a full staff portal: dashboard with check-in/out, resource-timeline calendar, guests, invoices, payments, PDF, SMTP mail, spot blocks, staff accounts, settings, audit log, backups. +13,000 lines, 8 extra tables | **Decision needed** (see §9, question 1) |

> ⚠️ `medewerkersportaal` is not on GitHub. Teammates cannot see it, and if it is the reference, it should be pushed first so it is not lost.

The rest of this document describes `frontend-ontwerp` in detail and lists the portal branch as an extra scope block (§4.4).

---

## 3. Existing architecture (C#)

### 3.1 Runtime model

- **ASP.NET Core 9, Blazor Server** (`@rendermode InteractiveServer`). The UI runs *on the server*; the browser keeps a SignalR websocket open and receives DOM diffs.
- **There is no REST API.** Razor components call C# services directly via `@inject`. The only plain HTTP endpoint is `POST /account/logout`.
  → The JSON API in the new app is a **new design**, derived from the service methods (§5.4). It is not a port of existing endpoints.
- State of a guest's booking (`BookingDraft`) lived in a scoped service on the server, one per browser tab.

### 3.2 Data (EF Core 9 + SQLite)

Database file `App_Data/groeneweide.db` (not in git). Design source: `docs/schema.sql`. Enums are stored as text.

| Table | Key fields | Notes |
| :-- | :-- | :-- |
| `spots` | Name (unique, e.g. T01), Type (`TentCaravan`/`Camper`/`Safari`), FieldName, Capacity, PricePerNight, DistanceToiletM, DistancePoolM, Amenities (JSON text), IsAvailable, UnavailableReason (`WetSeason`/`Accident`/`Maintenance`), IsHeld | 60 rows: 40 / 12 / 8. `IsHeld` = reserve tent for staff only |
| `spot_photos` | SpotId → spots (cascade), Filename, AltText, SortOrder | Files in `wwwroot/uploads/spots/`, GUID names |
| `reservations` | SpotId → spots (restrict), StartDate, EndDate (date only, check `End > Start`), GuestName, GuestEmail?, GuestPhone?, Status (`Confirmed`/`Cancelled`), CreatedBy (`Guest`/`Staff`), IsFriendOfBert, NeedsMove, MovedFromSpotId, TotalPrice, DiscountCodeId?, PaymentStatus (`Open`/`Paid`), Notes | Never hard-deleted; cancel = status |
| `deal_days` | DealDate, SpotType? (null = all), DiscountPercentage | Unique (date, type). "Blue days" |
| `settings` | key/value: `almost_full_threshold` (3), `season_start` (`04-01`), `season_end` (`10-31`) | |
| `discount_codes` | Code, type, value, target | In the model, **unused** in the MVP |
| Identity tables | `AspNetUsers` (+ DisplayName), roles `Staff`/`Admin`, lockout fields | Replaces `staff_users` from schema.sql |

Seed (development only, when empty): 60 spots, 4 held reserve tents, test reservations in 2027, 3 deal days, settings, roles. **No accounts.**

### 3.3 Business rules (BUILD.md §4, live in one place each)

1. **Bookable** = `IsAvailable && !IsHeld && no confirmed reservation overlapping`. One central query (`SpotQueries.Bookable`).
2. **Nights**: a reservation occupies `StartDate … EndDate-1`. Departure day is free for the next guest. Overlap = `existing.Start < new.End && existing.End > new.Start`.
3. **Season**: outside the season dates everything is "closed". Last day of season: departure only.
4. **No double bookings**: re-check overlap and insert inside **one serializable transaction** (guest booking, phone booking). Verified with a CLI stress test (10 parallel bookings → 1 succeeds).
5. Guests never see held spots or the reason a spot is out of use.
6. **Price** = Σ per night of `PricePerNight`, discounted on deal days (highest applicable %), rounded to cents. Calculated on the server.
7. No e-mail to staff. Guests get a confirmation with an invoice.
8. Payment is simulated; e-mail goes to a log file in development.

Further logic worth preserving exactly:

- **Calendar day status** (priority): Closed → Full → AlmostFull (free ≤ threshold) → Deal → Free; labels "vrij", "nog 3 plekken", "vol", "gesloten", "deal", "voorbij". `Selectable` / `OnlyDeparture` flags.
- **Period validation**: one spot must be free for the *whole* period. If not: Dutch message naming the full nights + up to 3 alternative periods of the same length (search ±90 days, closest first).
- **Spot out of use**: one spot or a whole field; all current/future confirmed reservations on it get `NeedsMove = true`; back in use clears it.
- **Payment failure**: reservation is set to `Cancelled` so the spot frees up.
- **Confirmation e-mail**: reservation number `GW-00042`, per-night invoice lines with deal discount.

### 3.4 Authentication and authorisation

- ASP.NET Core Identity, cookie `GroeneWeide.Login`: HttpOnly, SameSite=Lax, Secure in production, 30 days sliding ("Onthoud mij").
- Password ≥ 10 characters, no other rules. Lockout: 5 failures → 10 minutes. E-mail unique.
- **No registration page, no default account.** Accounts are created with `dotnet run -- create-staff "Name" email Role` (hidden password prompt).
- Every `/admin/*` page requires role `Staff` or `Admin` (no difference between them yet in the MVP). Unauthenticated → redirect to `/account/login?returnUrl=…`.
- Dutch Identity error messages (`DutchIdentityErrors`).
- Antiforgery tokens on forms.

### 3.5 Frontend

Razor components, no JS framework, two tiny ES modules (`calendar.js` arrow-key scroll guard, `dialog.js` native `<dialog>` + photo gallery).

| Route | Screen |
| :-- | :-- |
| `/` | One-page booking flow. Step 1 = home page (hero, "Reserveer een plek", phone link, three field cards with "vanaf € x"). Steps 2–7: type → own tent/caravan (tent only) → dates (colourful calendar) → spot list + photo pop-up → summary + guest form + simulated payment → confirmation (countdown back to start) |
| `/account/login`, `/account/access-denied` | Staff sign-in |
| `/admin` | Daily overview: stat tiles, who arrives/leaves, staff calendar with numbers, print |
| `/admin/reservations` | Spreadsheet-like list: search, filters, sort (`aria-sort`), cancel with confirmation, refresh every 30 s |
| `/admin/spots` | 60 spots per field, take spot/field out of use with reason, "needs to be moved" list |
| `/admin/new-reservation` | Phone booking, includes reserve tents, no payment step |
| `/admin/photos` | Upload (jpg/png/webp, ≤ 5 MB, magic-byte check), alt text, reorder, delete |

Two layouts: `MainLayout` (guest: header with phone, footer) and `AdminLayout` (dark green header, large menu with icons, black on white, no images).

Accessibility work already done and measured (Lighthouse Accessibility 100 on all pages): focus moves to each step heading, `aria-live` notices, roving focus in the calendar, focus returns after closing a dialog, first invalid field gets focus, label-in-name fixes, reduced motion.

### 3.6 Styling (Sass)

`wwwroot/scss/`: `_variables.scss` (tokens), `_mixins.scss`, `_base.scss`, 16 component partials, BEM class names, `em` only. Palette "farm meadow" (forest `#1b5e34`, hay, buttercup accent), fixed status colours, admin tokens (black on white, 20px base), Georgia headings + system font (no CDN). Documented in `docs/design-system.md` with contrast ratios. **This is preserved, not rewritten.**

### 3.7 Configuration and integrations

| What | C# | Notes |
| :-- | :-- | :-- |
| Campsite name, phone, e-mail | `appsettings.json` → `Campsite` | Current values are **placeholders** |
| Database | connection string, `|DataDirectory|` | |
| Secrets | `dotnet user-secrets` | None needed in the MVP |
| E-mail | `LogEmailSender` → `App_Data/mail/mail.log` | Portal branch: SMTP via MailKit (Brevo) |
| Payment | `FakePaymentService` (1.5 s delay, always succeeds) | Real iDEAL/Wero = later |
| PDF | – | Portal branch: QuestPDF (invoices, calendar) |
| AI | **Nothing exists**, on any branch | MVP scope lists "AI assistant, crowd forecast, purchasing advice" as *later* |
| CLI | `create-staff`, `test-double-booking` | |

---

## 4. Migration inventory

Action: **Migrate** (same behaviour, new code) · **Replace** (different mechanism, same result) · **Preserve** (copy as is) · **Drop**.

### 4.1 Backend

| Item | Action | Notes |
| :-- | :-- | :-- |
| Data model (§3.2) | Migrate | Plain SQL schema from `docs/schema.sql`. Money as **integer cents** (see §8.3) |
| EF migrations | Replace | Numbered `.sql` files + tiny runner |
| Seed | Migrate | Same 60 spots and test data |
| `SpotQueries` (Bookable, FreeBetween, Overlapping) | Migrate | One module, reused everywhere |
| `SettingsService`, `PriceRules`, `AvailabilityService` | Migrate | Pure functions where possible, unit-tested |
| `SpotService`, `ReservationService` (guest + manual + pay + cancel + e-mail) | Migrate | Transaction rule 4 is the critical part |
| `AdminService`, `SpotAdminService`, `SpotPhotoService` | Migrate | |
| `BookingDraft` (server-scoped state) | Replace | Client-side store; server re-validates everything on submit |
| ASP.NET Identity | Replace | Own small auth module (§5.3), same rules |
| `DutchIdentityErrors`, `Format` | Migrate | `Intl` for Dutch dates/currency, no library |
| `LogEmailSender`, `FakePaymentService` | Migrate | Behind a small interface so real providers slot in later |
| CLI `create-staff`, `test-double-booking` | Migrate | `npm run create-staff`; the double-booking test becomes an automated test |
| `Permissions-Policy: unload=()` header | Drop | Only needed for Blazor's script |

### 4.2 Frontend

| Item | Action |
| :-- | :-- |
| 7-step booking flow, progress bar, calendar, spot list, spot dialog + gallery, summary form, confirmation | Migrate (to components) |
| Staff layout and 5 staff pages, login, access denied | Migrate |
| Shared UI: Alert, LoadingState, EmptyState, ModalDialog, Icon (inline SVG), FieldSign, SiteLogo, YesNo | Migrate |
| `calendar.js`, `dialog.js` | Preserve (logic moves into components) |
| All SCSS partials and tokens | Preserve |
| Images `wwwroot/img/*` | Preserve |
| Home page | **Redesign** (Phase 5): becomes its own page |

### 4.3 Docs

`schema.sql`, `design-system.md`, `mvp_afbakening.md`, `beeldprompts.md`: copy and update to the new stack. `BUILD.md`: rewrite the stack sections. `ai-log.md`: continue (team agreement).

### 4.4 Extra scope if `medewerkersportaal` is the reference

Tables `guests`, `reservation_lines`, `invoices`, `payments`, `spot_blocks`, `email_log`, `audit_log` (+ reservation changes). Pages: dashboard with check-in/out, resource-timeline calendar (7/14 days, month, year), reservation detail/edit/move, 4-step phone booking wizard, guests + profile, invoices/payments + reminders, spot create/edit/blocks/cleaning status, settings (season, rates, VAT, tourist tax), staff accounts (Admin only), campsite info, "large reception mode", live updates (SignalR events), daily DB backups, PDF (QuestPDF), SMTP (MailKit). Roughly **2.5× the work** of the baseline.

---

## 5. Proposed architecture (JavaScript)

### 5.1 Overview

```
Browser ── Vue app (Vite build, static files)
   │  JSON over HTTPS, session cookie
   ▼
Node.js / Express API  ── better-sqlite3 ──  SQLite file (data/groeneweide.db)
   │  HTTP + JSON, timeout, shared key
   ▼
Python AI service (Mohammed, separate process/repo)
```

In development Vite serves the frontend on :5173 and proxies `/api` to Express on :3000. In production Express serves the built frontend and the API from one origin (no CORS, simple cookies).

### 5.2 Technology choices

| Concern | Choice | Why |
| :-- | :-- | :-- |
| Runtime | Node.js 22 LTS (installed: 22.11) | |
| Web framework | **Express 5** | The most documented Node framework; small surface; easy for newcomers |
| Database | **SQLite via `better-sqlite3`**, plain parameterised SQL | Keeps the current database engine. Synchronous transactions make "check overlap + insert" atomic by construction (rule 4). `schema.sql` already is the design. No ORM to learn |
| Migrations | Numbered `server/src/db/migrations/*.sql` + ~30-line runner | |
| Passwords | Node built-in `crypto.scrypt` | No native dependency |
| Sessions | `sessions` table + random token in an HttpOnly cookie | Same behaviour as the Identity cookie, ~60 lines, no extra package |
| Validation | Small validator functions per module, Dutch messages | Same rules as the C# `DataAnnotations` |
| Uploads | `multer` (memory, 5 MB limit) + magic-byte check | |
| Frontend | **Vue 3 + Vite + vue-router** (recommended, see §9 Q2) | `.vue` files look like `.razor` files (markup + script + style, `v-if` ≈ `@if`, `v-for` ≈ `@foreach`, `v-model` ≈ `@bind`). Vite compiles SCSS natively |
| Styling | Existing SCSS via the `sass` package | Same dart-sass compiler the C# project used |
| Tests | `node:test` (built in) for the API; Playwright later for a few end-to-end flows | |
| Dates | ISO strings `YYYY-MM-DD`, small `dates.js` helper, `Intl.DateTimeFormat('nl-NL')` | No date library needed |

Dependencies in total (runtime): express, better-sqlite3, multer, vue, vue-router. Dev: vite, @vitejs/plugin-vue, sass.

### 5.3 Authentication

Same rules as today: no registration, accounts via `npm run create-staff`, password ≥ 10, lockout 5 → 10 min, cookie HttpOnly + SameSite=Lax + Secure in production, 30 days with "Onthoud mij" (otherwise a session cookie), roles `Staff`/`Admin`.

- `requireStaff` / `requireRole('Admin')` middleware on every `/api/admin/*` route (checked on the server, not just hidden in the UI).
- CSRF: SameSite=Lax cookie + the API only accepts `application/json` bodies (and multipart for uploads from the same origin) + an `Origin` check on state-changing requests.
- Login always answers "E-mailadres of wachtwoord klopt niet." (no user enumeration).

### 5.4 API (first draft, Dutch messages in responses)

Public:

| Method | Path | C# source |
| :-- | :-- | :-- |
| GET | `/api/campsite` | `CampsiteOptions` + season text |
| GET | `/api/spot-types` | `SpotService.GetTypePricesAsync` |
| GET | `/api/availability?type&year&month` | `AvailabilityService.GetMonthAsync` |
| POST | `/api/availability/check` `{type,start,end}` | `ValidateAsync` (message + alternatives) |
| GET | `/api/spots?type&start&end` | `SpotService.GetAvailableAsync` |
| GET | `/api/spots/:id?start&end` | `GetDetailAsync` (404 when no longer bookable) |
| POST | `/api/reservations` | `CreateGuestAsync` → `201 {id, bookingToken, totalPrice}` / `409 spot_taken` / `422` |
| POST | `/api/reservations/:id/payment` (needs `bookingToken`) | `PayAndConfirmAsync` |

Auth: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.

Staff (`/api/admin/*`, role Staff or Admin): day overview (`GET /day/:date`), staff calendar (`GET /calendar?year&month`), reservations list (`GET /reservations?search&from&to&status`), cancel (`POST /reservations/:id/cancel`), phone booking (`POST /reservations`, plus availability/spots variants that include reserve tents), spots overview (`GET /spots?day`), spot/field out of use and back (`POST /spots/:id/unavailable`, `/available`, `/fields/:name/…`), needs-move list, photos (`GET|POST /spots/:id/photos`, `PATCH|DELETE /photos/:id`, `POST /photos/:id/move`).

Error shape everywhere: `{ "error": { "code": "spot_taken", "message": "Deze plek is net …", "fields": { "email": "…" } } }`.

The full contract goes in `docs/api.md` during Phase 2.

### 5.5 Folder structure

```
Groene-weide-Js-/
├─ package.json            npm workspaces: server, client. "npm run dev" starts both
├─ .env.example            all settings, no secrets
├─ README.md               install, configure, run, test
├─ docs/                   migration-plan, api, ai-contract, schema, design-system, ai-log
├─ server/
│  ├─ src/
│  │  ├─ server.js         starts the HTTP server
│  │  ├─ app.js            Express app: middleware, routes, error handler, static files
│  │  ├─ config.js         reads and checks environment variables
│  │  ├─ db/               connection.js, migrate.js, migrations/*.sql, seed.js
│  │  ├─ modules/          one folder per feature: *.routes.js + *.service.js (+ *.test.js)
│  │  │  ├─ auth/  availability/  spots/  reservations/
│  │  │  ├─ admin/  spot-admin/  photos/  settings/
│  │  ├─ lib/              dates, format, price-rules, email, payment, errors, validate
│  │  └─ ai/               aiClient.js (the only file that talks to Python)
│  ├─ scripts/             create-staff.js, test-double-booking.js
│  └─ data/                SQLite file, mail log, uploads (git-ignored)
└─ client/
   ├─ index.html, vite.config.js
   ├─ public/img/          existing images
   └─ src/
      ├─ main.js, router.js, App.vue
      ├─ api/              fetch wrapper + one file per resource
      ├─ stores/           bookingDraft.js (reactive, kept in sessionStorage)
      ├─ layouts/          SiteLayout.vue, AdminLayout.vue
      ├─ pages/            HomePage, BookingPage, LoginPage, admin/*
      ├─ components/       booking/, ui/ (Alert, Icon, ModalDialog, …)
      └─ styles/           the existing SCSS (variables, mixins, base, components/)
```

Rule of thumb for the team: **routes** read the request and send the response, **services** hold the business rules and SQL, **lib** holds small shared helpers. Nothing else.

---

## 6. Python AI integration boundary

Nothing AI-related exists yet, so the contract is new and must be agreed with Mohammed. Proposal:

- The Python service is a **separate process** (own repo or own folder, Mohammed's choice), HTTP + JSON, versioned paths (`/v1/...`). FastAPI is a natural fit because it generates OpenAPI docs, but that is his decision.
- Node only talks to it through `server/src/ai/aiClient.js`. The browser never calls Python directly.
- Configuration: `AI_SERVICE_URL`, `AI_SERVICE_KEY` (sent as header `X-Service-Key`), `AI_TIMEOUT_MS` (default 5000).
- Failure handling in `aiClient`: timeout via `AbortController`; one retry only for read requests; check the response shape; any failure → `AiUnavailableError` → the API answers `503 { code: "ai_unavailable", message: "…" }` and the UI shows a calm "niet beschikbaar" state. **Booking, payment and the staff portal never depend on the AI service.**
- Privacy (AVG): only aggregated, anonymous data goes to the AI service (e.g. occupancy per day per type), never guest names, e-mail or phone numbers, unless explicitly agreed.
- A `GET /health` endpoint, plus a small Node mock (`npm run ai:mock`) so the team can develop without Python running.

Candidate endpoints, based on the "later" list in `mvp_afbakening.md` (to confirm):

| Endpoint | Input | Output |
| :-- | :-- | :-- |
| `POST /v1/occupancy-forecast` | date range, history `[{date, spotType, occupied, total}]` | `[{date, spotType, expectedOccupancy, confidence}]` |
| `POST /v1/purchase-advice` | forecast + period | `[{item, quantity, reason}]` |
| `POST /v1/assistant/answer` | `{question, language: "nl"}` + public campsite info | `{answer, sources}` |

The agreed version goes into `docs/ai-contract.md` (OpenAPI) before either side builds against it.

---

## 7. Home page and dashboard

**Today:** the home page is step 1 *inside* the booking flow (hero + three field cards). The staff side is a separate, calm, black-on-white, large-type interface (and in the portal branch a light-grey panel dashboard with a "large reception mode").

**Plan:**

- `/` becomes its **own landing page** with its own layout: a full-width hero, a short story of the farm, the three fields (with the hand-painted "field sign" as the signature element), how booking works in three steps, facilities and practical info (season, distances, what to bring), contact and a clear "Reserveer een plek" call to action. Same brand tokens (forest green, buttercup, Georgia headings, meadow images), but a different structure and rhythm: editorial and spacious, no tiles, no tables, no widgets.
- The booking flow moves to `/reserveren` (steps and progress bar unchanged).
- Constraints stay: high contrast, `em`, reduced motion, works at 375 px, no external fonts or CDNs. "Impressive" comes from photography, typography and layout, not from animation.
- The **staff dashboard keeps its design direction** (calm, large, very high contrast, spreadsheet-like, no decorative images). Improvements only where they help Anita: hierarchy, spacing, responsiveness.

---

## 8. Points that need special attention

1. **No double bookings.** The whole booking path must stay one atomic transaction (`BEGIN IMMEDIATE`). Run one Node process against the database (no cluster mode). Port the stress test (10 parallel bookings → 1 succeeds, guests and staff mixed) as an automated test.
2. **Dates.** C# used `DateOnly`. In JS, `new Date("2027-07-14")` is UTC and shifts by a day in local time. Use `YYYY-MM-DD` strings everywhere and one `dates.js` helper. "Today" = today in `Europe/Amsterdam`.
3. **Money.** C# used `decimal`; JS numbers are floating point (21.25 × 3 can drift). Store and calculate in **integer cents**, format only for display.
4. **Guest payment step.** In Blazor the reservation id never left the server. In a REST API, `POST /reservations/:id/payment` would let anyone pay/confirm someone else's reservation by guessing ids. A random `bookingToken` returned on creation fixes this.
5. **Accounts cannot be migrated.** Identity uses its own PBKDF2 hash format; there is only dev data, so: fresh database, re-create staff with `npm run create-staff`. (Confirm there is no live deployment with real data.)
6. **Accessibility parity.** Focus management, `aria-live`, `<dialog>`, keyboard calendar and the Lighthouse 100 scores were real work. Each migrated screen is re-checked at 375 / 768 / 1280 px.
7. **Live updates.** The staff list refreshes every 30 s (easy). The portal branch pushes changes instantly via SignalR → Server-Sent Events if that branch is in scope.
8. **Portal-only integrations.** PDF (QuestPDF) and SMTP (MailKit) → `pdfkit` and `nodemailer`, only if `medewerkersportaal` is in scope.
9. **Placeholders that look real.** Phone/e-mail in config and the portal's VAT/tourist-tax rates are example values; keep them clearly marked.
10. **`.gitignore`** in this repo is the Next.js template; replace it with one for this stack (`node_modules`, `dist`, `.env`, `server/data/`).

---

## 9. Decisions and open questions

Decided (18 November 2026):

1. **Reference branch: MVP first, portal next.** Round 1 migrates `frontend-ontwerp` completely. Round 2 adds the `medewerkersportaal` features (§4.4). Push `medewerkersportaal` to GitHub so it is safe.
2. **Frontend: Vue 3 + Vite.**
3. **Home page: own landing page on `/`**, booking flow on `/reserveren`.
4. **AI service location: not decided yet.** This repo gets the contract (`docs/ai-contract.md`), `aiClient.js` and a mock; the location is agreed later with Mohammed.

Still open:

5. **Which AI features** Mohammed is building (the table in §6 is a proposal).
6. **"Anita's dashboard":** in round 1 the dashboard is the `/admin` daily overview from `frontend-ontwerp`; in round 2 it becomes the portal dashboard. Confirm that the portal dashboard is the design Anita chose.
7. **Hosting:** still undecided (BUILD.md assumption 1). SQLite works well on a single small server or VPS; serverless hosting would need a different database.

---

## 10. Migration phases

Each phase ends with a commit and a "done when" check. The C# repository stays untouched throughout.

| # | Phase | Done when |
| :-- | :-- | :-- |
| 1 | Foundation: workspaces, Express app, config, `.env.example`, `.gitignore`, DB connection, migration runner, schema, seed | `npm run dev` starts; DB has 60 spots (40/12/8), 4 held |
| 2 | Business rules + public API: settings, price rules, availability, spots, guest reservation + payment + e-mail log | API tests pass, including the double-booking test |
| 3 | Auth + staff API: login/logout/lockout, create-staff CLI, admin endpoints, photo upload | Admin routes reject anonymous users; tests pass |
| 4 | Frontend foundation: Vite, Vue, router, layouts, SCSS moved over, shared UI components | Existing styles render identically |
| 5 | Booking flow `/reserveren` (steps 2–7) on the new API | A guest books end to end; reservation in DB; mail in log |
| 6 | Staff pages (dashboard, list, spots, phone booking, photos) | Same features as C#; new booking visible within 30 s |
| 7 | AI contract + `aiClient` + mock, with Mohammed | Node handles success, timeout, 5xx and bad responses |
| 8 | New home page | Distinct from dashboard; 375/768/1280 checked; Lighthouse a11y ≥ 95 |
| 9 | Dashboard refinement (same direction) | Reviewed against the original |
| 10 | Full verification: all features, a11y, responsive, errors | Checklist in `docs/` filled with real results |
| 11 | Final docs: README, architecture, how to run | A teammate can run it from a clean clone |

Round 2 (`medewerkersportaal` features) follows after phase 11 with its own phases: data model extension, portal API, billing/PDF/SMTP, portal pages, live updates.
