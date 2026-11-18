-- =====================================================================
-- 001_initial: the campsite data model.
-- Source: docs/schema.sql and AppDbContext.cs of the C# project, adapted to SQLite.
--
-- Conventions in this database:
--   * Dates (arrival, departure, deal day) are TEXT 'YYYY-MM-DD'.
--   * Timestamps are TEXT in ISO 8601, UTC, e.g. '2026-11-18T14:05:00.000Z'.
--   * Money is INTEGER cents: 2500 = € 25,00. Never use decimals for money in JavaScript.
--   * Yes/no columns are INTEGER 0 or 1.
--   * Fixed lists of values ("enums") are TEXT with a CHECK on the allowed English values.
--   * STRICT tables: SQLite refuses a value of the wrong type instead of silently storing it.
--
-- Staff accounts and sessions follow in a later migration (phase 3, sign-in).
-- =====================================================================

-- ---------------------------------------------------------------------
-- spots: all pitches and safari tents (60 in total).
-- Bookable for guests when is_available = 1 AND is_held = 0 AND no confirmed reservation overlaps.
--   is_available = 0 -> taken out of use by staff (reason in unavailable_reason, never shown to guests)
--   is_held = 1      -> reserve tent, only staff may book it
-- ---------------------------------------------------------------------
CREATE TABLE spots (
  id                    INTEGER PRIMARY KEY,
  name                  TEXT    NOT NULL UNIQUE,              -- e.g. T01, C12, S8
  type                  TEXT    NOT NULL CHECK (type IN ('TentCaravan', 'Camper', 'Safari')),
  field_name            TEXT    NOT NULL,                     -- Kampeerveld, Camperveld, Safariveld
  description           TEXT,
  capacity              INTEGER NOT NULL DEFAULT 4 CHECK (capacity > 0),
  price_per_night_cents INTEGER NOT NULL CHECK (price_per_night_cents >= 0),
  distance_toilet_m     INTEGER CHECK (distance_toilet_m >= 0),
  distance_pool_m       INTEGER CHECK (distance_pool_m >= 0),
  amenities             TEXT    NOT NULL DEFAULT '[]' CHECK (json_valid(amenities)), -- JSON list, Dutch words shown to guests
  is_available          INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1)),
  unavailable_reason    TEXT    CHECK (unavailable_reason IN ('WetSeason', 'Accident', 'Maintenance')),
  is_held               INTEGER NOT NULL DEFAULT 0 CHECK (is_held IN (0, 1)),
  created_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_spots_type ON spots (type, is_available, is_held);

-- ---------------------------------------------------------------------
-- spot_photos: photos per spot for the pop-up gallery.
-- filename is always a generated name; files live in server/data/uploads/spots/.
-- Rows whose filename starts with 'placeholder_' have no file: guests see "Foto volgt".
-- ---------------------------------------------------------------------
CREATE TABLE spot_photos (
  id         INTEGER PRIMARY KEY,
  spot_id    INTEGER NOT NULL REFERENCES spots (id) ON DELETE CASCADE,
  filename   TEXT    NOT NULL,
  alt_text   TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_spot_photos_spot ON spot_photos (spot_id, sort_order);

-- ---------------------------------------------------------------------
-- discount_codes: part of the data model already, NOT used in the MVP.
--   discount_type 'Percentage' -> discount_value is a whole percentage (15 = 15 %)
--   discount_type 'Fixed'      -> discount_value is an amount in cents
-- ---------------------------------------------------------------------
CREATE TABLE discount_codes (
  id             INTEGER PRIMARY KEY,
  code           TEXT    NOT NULL UNIQUE,
  discount_type  TEXT    NOT NULL CHECK (discount_type IN ('Fixed', 'Percentage')),
  discount_value INTEGER NOT NULL CHECK (discount_value >= 0),
  target_type    TEXT    NOT NULL DEFAULT 'All' CHECK (target_type IN ('All', 'Product', 'Spot')),
  target_id      INTEGER,
  expires_at     TEXT,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

-- ---------------------------------------------------------------------
-- reservations: guest bookings, phone bookings and friends of Bert.
-- A reservation occupies the nights from start_date up to and including the day before end_date.
-- The departure day itself is free again for a new guest.
-- Nothing is ever deleted: cancelling sets status = 'Cancelled'.
-- The database does NOT prevent overlap on its own: the booking code checks overlap and
-- inserts inside one transaction (business rule 4).
-- ---------------------------------------------------------------------
CREATE TABLE reservations (
  id                 INTEGER PRIMARY KEY,
  spot_id            INTEGER NOT NULL REFERENCES spots (id),
  start_date         TEXT    NOT NULL CHECK (start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  end_date           TEXT    NOT NULL CHECK (end_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  guest_name         TEXT    NOT NULL,
  guest_email        TEXT,
  guest_phone        TEXT,
  status             TEXT    NOT NULL DEFAULT 'Confirmed' CHECK (status IN ('Confirmed', 'Cancelled')),
  created_by         TEXT    NOT NULL DEFAULT 'Guest' CHECK (created_by IN ('Guest', 'Staff')),
  is_friend_of_bert  INTEGER NOT NULL DEFAULT 0 CHECK (is_friend_of_bert IN (0, 1)),
  needs_move         INTEGER NOT NULL DEFAULT 0 CHECK (needs_move IN (0, 1)),
  moved_from_spot_id INTEGER REFERENCES spots (id),
  total_price_cents  INTEGER NOT NULL DEFAULT 0 CHECK (total_price_cents >= 0),
  discount_code_id   INTEGER REFERENCES discount_codes (id) ON DELETE SET NULL,
  payment_status     TEXT    NOT NULL DEFAULT 'Open' CHECK (payment_status IN ('Open', 'Paid')),
  notes              TEXT,
  created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (end_date > start_date) -- works because 'YYYY-MM-DD' text sorts like a date
) STRICT;

CREATE INDEX idx_reservations_spot_dates ON reservations (spot_id, start_date, end_date);
CREATE INDEX idx_reservations_start ON reservations (start_date);
CREATE INDEX idx_reservations_end ON reservations (end_date);

-- ---------------------------------------------------------------------
-- deal_days: quiet days with a discount (blue in the calendar).
-- spot_type NULL = the deal applies to every type.
-- ---------------------------------------------------------------------
CREATE TABLE deal_days (
  id                  INTEGER PRIMARY KEY,
  deal_date           TEXT NOT NULL CHECK (deal_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  spot_type           TEXT CHECK (spot_type IN ('TentCaravan', 'Camper', 'Safari')),
  discount_percentage REAL NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100)
) STRICT;

-- One deal per day and type. ifnull() is needed because a plain UNIQUE index allows
-- several rows with spot_type NULL on the same day.
CREATE UNIQUE INDEX uq_deal_days ON deal_days (deal_date, ifnull(spot_type, 'All'));

-- ---------------------------------------------------------------------
-- settings: values the administrator can change.
--   almost_full_threshold  '3'      -> "nog 3 plekken" or fewer = almost full (orange)
--   season_start           '04-01'  -> MM-DD
--   season_end             '10-31'  -> MM-DD
-- ---------------------------------------------------------------------
CREATE TABLE settings (
  setting_key   TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL
) STRICT;
