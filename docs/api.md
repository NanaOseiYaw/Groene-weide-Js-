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
| 503 | `busy` | The database was busy for too long; trying again usually works |

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

## Differences from the C# version (on purpose)

| What | C# | Now | Why |
| :-- | :-- | :-- | :-- |
| Paying | The reservation id never left the server | `bookingToken` required | In a JSON API, ids would otherwise be guessable |
| Calendar price on an almost-full deal day | Full price shown, discounted price charged | Discounted price shown | The calendar must show what the guest pays |
| A stay through the winter (e.g. 30 Oct → 2 Apr) | Accepted (arrival and departure both "in season") | Refused | Arrival and departure must be in the same season |
| Own tent/caravan | Only enforced by the screen | Also required by the API for `TentCaravan` | Server-side checks for every rule |
| Money | `decimal` euros, banker's rounding | Integer cents, rounding half up | No floating-point errors in JavaScript |
| Deal days | Two "all types" deals on one day were possible | Unique per day and type | The NULL type slipped through the unique index |

Staff endpoints (`/api/admin/*`) and sign-in follow in phase 3.
