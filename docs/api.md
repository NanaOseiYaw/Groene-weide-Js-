# API reference

JSON over HTTP, all paths start with `/api`. In development the API runs on http://localhost:3000.

## Conventions

| What | Format | Example |
| :-- | :-- | :-- |
| Dates | `YYYY-MM-DD` text, no time | `"2027-07-14"` |
| Money | whole **cents**, field names end in `Cents` | `2125` = € 21,25 |
| Spot types | `TentCaravan`, `Camper`, `Safari` | |
| A stay | `start` = arrival, `end` = departure. The guest occupies the nights `start` … `end - 1`; the departure day is free for the next guest | 14–17 July = 3 nights |
| User-facing text | Dutch, ready to show (`message`, `label`, field messages) | `"nog 2 plekken"` |

### Errors

Every error has the same shape. `code` is stable English for the frontend to check; `message` is a Dutch sentence for the user; `fields` only appears for form validation.

```json
{ "error": { "code": "validation_failed", "message": "Niet alle gegevens zijn goed ingevuld.",
             "fields": { "email": "Dit e-mailadres klopt niet. Bijvoorbeeld: naam@voorbeeld.nl" } } }
```

| Status | Codes | Meaning |
| :-- | :-- | :-- |
| 400 | `invalid_request`, `invalid_json` | Wrong parameter or unreadable body (a frontend bug, not a user mistake) |
| 402 | `payment_failed` | The payment did not go through; the reservation was cancelled |
| 404 | `not_found`, `spot_unavailable` | Does not exist, or the spot is no longer bookable for the period |
| 409 | `spot_taken`, `reservation_cancelled`, `payment_in_progress` | Conflict: someone else was first, or the state changed |
| 413 | `too_large` | Request body larger than 100 kB |
| 422 | `missing_choice`, `validation_failed`, `invalid_period` | The user has to change something |
| 500 | `server_error` | Unexpected; details are only in the server log |
| 503 | `busy`, `ai_unavailable` | The database was busy for too long (trying again usually works), or the AI service is off, slow or gave a wrong answer (the rest of the site works as always) |

## Public endpoints (no sign-in)

### `GET /api/health`

`200 { "status": "ok", "environment": "development" }`, or `503` when the database cannot be read.

### `GET /api/campsite`

Contact details, the season and what "today" is for the campsite (the server decides, in the configured time zone).

```json
{ "name": "Camping De Groene Weide", "phone": "012 345 67 89", "phoneHref": "tel:0123456789",
  "email": "info@groeneweide.example",
  "season": { "start": "04-01", "end": "10-31", "text": "1 april t/m 31 oktober" },
  "today": "2026-11-18", "firstOpenDay": "2027-04-01" }
```

### `GET /api/spot-types`

The types that have bookable spots, with the lowest price per night (booking step 2, home page).

```json
{ "spotTypes": [ { "type": "TentCaravan", "label": "Tent of caravan", "fieldName": "Kampeerveld", "pricePerNightCents": 2500 }, … ] }
```

### `GET /api/availability?type=Safari&year=2027&month=7`

One entry per day of the month for the colourful calendar (step 4). Only bookable spots of that type count (no reserve tents, no spots out of use).

```json
{ "type": "Safari", "year": 2027, "month": 7, "days": [
  { "date": "2027-07-20", "totalSpots": 8, "freeSpots": 0, "status": "Full", "pricePerNightCents": 7500,
    "discountPercentage": null, "label": "vol", "selectable": false, "onlyDeparture": true,
    "isPast": false, "inSeason": true }, … ] }
```

- `status` (priority order): `Closed` (outside the season) → `Full` → `AlmostFull` (free ≤ threshold, default 3) → `Deal` → `Free`.
- `label`: Dutch text that always goes with the colour: `vrij`, `nog 2 plekken`, `nog 1 plek`, `vol`, `deal`, `gesloten`, `voorbij`.
- `selectable`: can be chosen as arrival day. `onlyDeparture`: can only be a departure day (a full day, or the last day of the season).

### `GET /api/availability/check?type=Safari&start=2027-07-19&end=2027-07-21`

Checks a chosen period: departure after arrival, not in the past, within one season, and one spot free for the **whole** period.

```json
{ "valid": false, "message": "Op 20 juli is alles vol. Deze periodes van dezelfde lengte zijn wel vrij:",
  "alternatives": [ { "start": "2027-07-18", "end": "2027-07-20", "nights": 2 }, … ] }
```

At most 3 alternatives of the same length, closest first (searched up to 90 days either way).

### `GET /api/spots?type=Camper&start=2027-07-14&end=2027-07-17`

Spots of this type that are free for the whole period (step 5), sorted by name.

```json
{ "spots": [ { "id": 41, "name": "C01", "fieldName": "Camperveld", "capacity": 4, "pricePerNightCents": 3000,
  "distanceToiletM": 29, "amenities": ["stroom", "water"], "firstPhoto": null }, … ] }
```

`firstPhoto` is `{ id, url, altText }` or `null` (show "Foto volgt").

### `GET /api/spots/:id?start=…&end=…`

Details for the spot pop-up, with all photos and the total price for the period (deal days included). `404 spot_unavailable` when the spot is no longer bookable in that period; refresh the list.

```json
{ "spot": { "id": 41, "name": "C01", "type": "Camper", "fieldName": "Camperveld", "description": "…", "capacity": 4,
  "pricePerNightCents": 3000, "distanceToiletM": 29, "distancePoolM": 73, "amenities": ["stroom", "water"],
  "photos": [], "nights": 3, "totalPriceCents": 7800 } }
```

### `POST /api/reservations`

Booking step 6, part 1: store the reservation with payment status `Open`. The spot is checked again inside one database transaction, so two guests can never get the same spot. The price is always calculated on the server.

Request:

```json
{ "spotId": 41, "type": "Camper", "start": "2027-07-14", "end": "2027-07-17",
  "equipment": "OwnTent",
  "guest": { "name": "Familie Jansen", "email": "jansen@example.com", "phone": "06 12345678" } }
```

`equipment` (`OwnTent` or `OwnCaravan`) is required for `TentCaravan` and ignored otherwise.

Response `201`:

```json
{ "reservation": { "id": 21, "number": "GW-00021", "status": "Confirmed", "paymentStatus": "Open",
    "spot": { "id": 41, "name": "C01", "type": "Camper", "fieldName": "Camperveld" },
    "start": "2027-07-14", "end": "2027-07-17", "nights": 3, "totalPriceCents": 9000, "notes": null,
    "guest": { "name": "Familie Jansen", "email": "jansen@example.com" } },
  "bookingToken": "q3V…" }
```

Keep `bookingToken` in memory for the next call; it is the only proof that this browser made the reservation. Errors: `422 missing_choice` (go back a step), `422 validation_failed` (per field), `422 invalid_period`, `409 spot_taken` (go back to step 5 and show the message).

### `POST /api/reservations/:id/payment`

Booking step 6, part 2: pay (simulated in the MVP), mark as paid, e-mail the confirmation with an invoice.

Request: `{ "bookingToken": "q3V…" }` → `200 { "reservation": { …, "paymentStatus": "Paid" } }`

- Wrong or missing token, or unknown id: `404 not_found` (same answer, so ids cannot be guessed).
- Payment failed: `402 payment_failed`; the reservation is cancelled and the spot is free again. Create a new reservation to retry.
- Paying again for a paid reservation returns it unchanged (no second e-mail). A second call while the first is still running: `409 payment_in_progress`.
- A failing e-mail never undoes the payment; it is logged on the server.

## Staff sign-in

There is no registration page and no default account. Accounts are made in the terminal: `npm run create-staff -- "Anita" "anita@voorbeeld.nl" Staff` (role `Staff` or `Admin`; the password is asked twice, hidden, at least 10 characters).

### `POST /api/auth/login`

`{ "email": "anita@voorbeeld.nl", "password": "…", "rememberMe": true }` → `200 { "staff": { "id": 1, "name": "Anita", "email": "…", "role": "Staff" } }` and a session cookie `gw_session` (HttpOnly, SameSite=Lax, Secure in production). With `rememberMe` the cookie lasts 30 days; without it the browser forgets it when it closes. Sessions are extended while they are used.

- `401 invalid_credentials`: "E-mailadres of wachtwoord klopt niet." (same answer for an unknown address and a wrong password)
- `429 locked_out`: after 5 wrong passwords the account is locked for 10 minutes; the message says how long to wait
- `422 validation_failed`: e-mail or password missing

### `POST /api/auth/logout` → `204`, session removed and cookie cleared.

### `GET /api/auth/me` → `200 { "staff": … }` or `401 not_signed_in`.

## Staff endpoints (`/api/admin/*`)

Every route needs a signed-in staff member (role `Staff` or `Admin`): otherwise `401 not_signed_in`. Responses are never cached (`Cache-Control: no-store`). Requests that change something from another website are refused (`403 forbidden_origin`).

| Method and path | What | Response |
| :-- | :-- | :-- |
| `GET /api/admin/day/2027-07-20` | Daily overview | `{ stats: { checkIns, checkOuts, occupiedSpots, totalSpots, occupancyPercent }, arrivals: [row], departures: [row] }` |
| `GET /api/admin/calendar?year&month` | Month calendar for all 60 spots, with `checkIns`/`checkOuts` per day, no deals | `{ days }` |
| `GET /api/admin/reservations?search&from&to&status` | Spreadsheet-like list. `search`: part of a guest name or spot code. `from`: ends on/after. `to`: starts on/before. `status`: `Confirmed`/`Cancelled`. The page sorts the rows itself | `{ reservations: [row] }` |
| `POST /api/admin/reservations` | Phone booking (also friends of Bert, reserve tents allowed, no payment step). Body: `{ type, start, end, spotId, guestName, guestPhone, guestEmail?, notes?, isFriendOfBert? }`. A confirmation is e-mailed only when there is an e-mail address | `201 { reservation: row, emailSent }`, `422` per field, `409 spot_taken` |
| `POST /api/admin/reservations/:id/cancel` | Cancel (nothing is deleted; the spot is free again) | `{ reservation: row }` |
| `GET /api/admin/needs-move` | Confirmed reservations on spots that are out of use | `{ reservations: [row] }` |
| `GET /api/admin/availability?type&year&month` and `/availability/check?type&start&end` | Same as the public calendar, but reserve tents count (phone booking) | as public |
| `GET /api/admin/free-spots?type&start&end` | Free spots for a phone booking, reserve tents included | `{ spots: [{ id, name, isHeld }] }` |
| `GET /api/admin/spots?day` | All 60 spots in field order with `status` (`Free`, `Reserved`, `Held`, `Unavailable`), `reservedBy`, `unavailableReason` | `{ day, spots }` |
| `POST /api/admin/spots/:id/unavailable` | Take a spot out of use. Body `{ reason: "WetSeason" \| "Accident" \| "Maintenance" }`. Its current and future guests get `needsMove` | `{ spots: 1, needsMove: 2 }` |
| `POST /api/admin/spots/:id/available` | Back in use; `needsMove` is cleared | `{ spots: 1 }` |
| `POST /api/admin/fields/:fieldName/unavailable` / `available` | The same for a whole field (`Kampeerveld`, `Camperveld`, `Safariveld`) | `{ spots, needsMove }` |
| `GET /api/admin/spots/:id/photos` | Photos of a spot | `{ photos: [{ id, url, altText, sortOrder }] }` |
| `POST /api/admin/spots/:id/photos` | Upload: multipart form with `photo` (jpg/png/webp, max 5 MB, content checked) and `altText` (required, max 255) | `201 { photo }`, `422` per field |
| `PATCH /api/admin/photos/:id` | `{ altText }` | `204` |
| `POST /api/admin/photos/:id/move` | `{ direction: -1 }` (earlier) or `1` (later) | `204` |
| `DELETE /api/admin/photos/:id` | Removes the photo and its file | `204` |
| `GET /api/admin/ai/status` | Is the AI service configured and does it answer? | `{ configured, available }` |
| `GET /api/admin/ai/occupancy-forecast?from&to` | Expected occupancy per day and spot type from the AI service (at most 93 days). Only anonymous numbers of the 365 days before `from` are sent (docs/ai-contract.md) | `{ from, to, forecast: [{ date, spotType, expectedOccupancy, confidence }] }`, `503 ai_unavailable` |

A `row` in the staff lists: `{ id, number, spotId, spotName, spotType, guestName, start, end, nights, status, phone, email, isFriendOfBert, paymentStatus, needsMove, createdBy, notes, totalPriceCents, createdAt }`.

Uploaded photos are public at `/uploads/spots/<file>` (outside `/api`), so guests see them in the spot pop-up.

## Differences from the C# version (on purpose)

| What | C# | Now | Why |
| :-- | :-- | :-- | :-- |
| Paying | The reservation id never left the server | `bookingToken` required | In a JSON API, ids would otherwise be guessable |
| Calendar price on an almost-full deal day | Full price shown, discounted price charged | Discounted price shown | The calendar must show what the guest pays |
| A stay through the winter (e.g. 30 Oct → 2 Apr) | Accepted (arrival and departure both "in season") | Refused | Arrival and departure must be in the same season |
| Own tent/caravan | Only enforced by the screen | Also required by the API for `TentCaravan` | Server-side checks for every rule |
| Money | `decimal` euros, banker's rounding | Integer cents, rounding half up | No floating-point errors in JavaScript |
| Deal days | Two "all types" deals on one day were possible | Unique per day and type | The NULL type slipped through the unique index |
| Sign-in | ASP.NET Core Identity | Own small module: scrypt hashes, session table, same rules (10 characters, lockout 5 → 10 min, 30 days) | No Identity in Node; existing C# accounts cannot be carried over, re-create them with `create-staff` |
| Wrong passwords sent at the same moment | Counted one by one by Identity | Counter raised inside the database (`+ 1`) | Parallel attempts cannot skip the lockout |
| Phone booking form | Errors shown one field at a time by the form | All field errors in one answer | One request, one complete list |
