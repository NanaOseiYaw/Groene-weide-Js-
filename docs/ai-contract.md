# AI service contract (draft v1)

Status: **draft, to be agreed with Mohammed** (18 November 2026). Which AI features are built is still open (migration plan §9, question 6); the three endpoints below are the proposal from migration plan §6. Nothing in this repository depends on the AI service being there: the Node side and a mock are ready, so either side can change this document before building against it.

Machine-readable version (OpenAPI 3.1, e.g. for FastAPI to compare against): [ai-contract.openapi.yaml](ai-contract.openapi.yaml).

## The boundary

```
Browser ──► Node / Express (this repo) ──► Python AI service (Mohammed)
             server/src/ai/ai-client.js        HTTP + JSON, /v1/...
```

- The Python service is a **separate process** with its own repository or folder (his choice). FastAPI fits well, but that is his decision.
- **Only** `server/src/ai/ai-client.js` talks to it. The browser never calls the AI service directly, and the AI service never touches the database.
- Booking, payment and the staff pages **never wait for or depend on** the AI service. When it is slow, down or answers nonsense, the Node API answers `503 ai_unavailable` with a calm Dutch message, and everything else keeps working.

## Connection

| Setting (Node `.env`) | Meaning | Default |
| :-- | :-- | :-- |
| `AI_SERVICE_URL` | Base address, e.g. `http://localhost:8000`. Empty = AI switched off (every AI request answers 503 straight away) | empty |
| `AI_SERVICE_KEY` | Shared secret, sent as header `X-Service-Key` on every `/v1` request. Required in production when the URL is set (at least 16 characters) | empty |
| `AI_TIMEOUT_MS` | How long Node waits for one answer | `5000` |

- Requests and answers are JSON (`Content-Type: application/json`, UTF-8). Answers larger than 1 MB are refused by Node.
- `/v1/...` requests without the right `X-Service-Key` must get `401`. `GET /health` needs no key (monitoring).
- All `/v1` endpoints are **free of side effects**: they compute an answer and change nothing. That is what makes a retry safe.
- Dates are `YYYY-MM-DD`, spot types `TentCaravan`, `Camper`, `Safari` (the same as in [api.md](api.md)).

## What Node does when something goes wrong

| What happens | Node's reaction |
| :-- | :-- |
| No answer within `AI_TIMEOUT_MS` | Request is aborted; `503 ai_unavailable` |
| Connection refused / DNS error | One retry for forecast and advice; then `503` |
| `502`, `503`, `504` from the AI service | One retry for forecast and advice; then `503` |
| Any other non-2xx (e.g. `400`, `401`, `422`, `500`) | No retry; `503`. A `401`/`403` is logged as a configuration problem (wrong key) |
| `2xx` but not JSON, or not the shape below, or numbers out of range | `503` (`bad_response` in the server log) |
| The assistant endpoint | Never retried (slow and possibly costly); same `503` otherwise |

The Node log gets one line per failure with the endpoint, the reason (`timeout`, `network`, `http_503`, `bad_response`, …) and the duration. Never the key, never the request body.

Error answers from the AI service should look like this (English is fine; Node never shows them to users, it only logs the `code`):

```json
{ "error": { "code": "invalid_input", "message": "history must not be empty" } }
```

## Privacy (AVG / GDPR)

Only **aggregated, anonymous** data goes to the AI service: numbers of occupied spots per day per type. Never guest names, e-mail addresses, phone numbers, reservation numbers or notes. The assistant only receives the question a visitor typed and public campsite information; the assistant must not store questions longer than needed to answer them, unless the team agrees otherwise. Changing this needs a team decision first and an update of this section.

## Endpoints

### `GET /health`

No key needed. `200 { "status": "ok", "version": "1.0.0" }`. Anything else counts as "not available".

### `POST /v1/occupancy-forecast`

Expected occupancy per day and spot type, based on history.

Request (built by Node from the database):

```json
{
  "from": "2027-07-01",
  "to": "2027-07-31",
  "history": [
    { "date": "2026-07-01", "spotType": "Camper", "occupied": 9, "total": 12 }
  ]
}
```

- `from` ≤ `to`, at most 92 days apart.
- `history`: at most 365 days × 3 types; `0 ≤ occupied ≤ total`. May be empty (a new campsite): then the service gives its best guess with low confidence.

Response `200`:

```json
{
  "forecast": [
    { "date": "2027-07-01", "spotType": "Camper", "expectedOccupancy": 0.75, "confidence": 0.6 }
  ]
}
```

- At most one entry per day per type, every `date` within `from`…`to`, `spotType` one of the three types.
- `expectedOccupancy`: fraction of the spots of that type, `0` … `1`. `confidence`: `0` (a guess) … `1` (very sure).

### `POST /v1/purchase-advice`

What to buy for a period (e.g. toilet paper, firewood), based on a forecast.

Request:

```json
{
  "from": "2027-07-01",
  "to": "2027-07-31",
  "forecast": [ { "date": "2027-07-01", "spotType": "Camper", "expectedOccupancy": 0.75, "confidence": 0.6 } ]
}
```

Response `200` (texts in **Dutch**, staff read them as they are):

```json
{
  "advice": [
    { "item": "Toiletpapier", "quantity": 48, "unit": "rollen", "reason": "Drukke weken in juli: 70% bezetting verwacht." }
  ]
}
```

- At most 50 items. `item` 1–100 characters, `unit` 1–30, `reason` 1–300; `quantity` a number ≥ 0.

### `POST /v1/assistant/answer`

Answers a visitor's question about the campsite (opening times, facilities, …).

Request:

```json
{
  "question": "Mag mijn hond mee?",
  "language": "nl",
  "campsite": { "name": "Camping De Groene Weide", "season": { "start": "04-01", "end": "10-31" } }
}
```

- `question` 1–500 characters. `language` is `"nl"` for now.

Response `200`:

```json
{ "answer": "Ja, honden zijn welkom aan de lijn.", "sources": ["Huisregels"] }
```

- `answer` 1–2000 characters, in the requested language. `sources`: at most 10 short texts (≤ 200 characters each), may be empty.

## Trying it without Python

```bash
npm run ai:mock
```

starts a fake AI service on http://localhost:8000 that follows this contract (`server/src/ai/mock-ai-service.js`). Set `AI_SERVICE_URL=http://localhost:8000` in `.env` and restart `npm run dev`. To see how the site behaves when the AI service misbehaves, start the mock with a mode:

| Command | The mock … |
| :-- | :-- |
| `npm run ai:mock` | answers normally |
| `npm run ai:mock -- --mode=slow` | answers after 10 seconds (Node gives up after `AI_TIMEOUT_MS`) |
| `npm run ai:mock -- --mode=error` | answers `500` |
| `npm run ai:mock -- --mode=unavailable` | answers `503` |
| `npm run ai:mock -- --mode=bad` | answers `200` with the wrong shape |

With `AI_SERVICE_KEY` set (in `.env` or the environment), the mock also checks the key.

## In the Node API

| Method and path | What | Response |
| :-- | :-- | :-- |
| `GET /api/admin/ai/status` | Is the AI service configured and reachable? (staff) | `{ "configured": true, "available": true }` |
| `GET /api/admin/ai/occupancy-forecast?from&to` | Expected occupancy per day and type (staff). Node builds the anonymous history of the 365 days before `from` | `{ "from", "to", "forecast": [...] }` or `503 ai_unavailable` |

Purchase advice and the assistant are in `ai-client.js` and the mock, but get an API route (and a screen) only once it is agreed that they are built.

## Changing this contract

1. Agree the change with Mohammed (and the team) first.
2. Update this file, the OpenAPI file, the validation in `server/src/ai/ai-contract.js`, the mock and the tests (`server/test/ai-client.test.js`) in one commit.
3. A change that breaks existing clients gets a new path version (`/v2/...`); Node switches when both sides are ready.
