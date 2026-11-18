-- =====================================================================
-- 003_auth: staff accounts and sign-in sessions.
-- Replaces ASP.NET Core Identity from the C# version (same rules, see docs/migration-plan.md §5.3).
-- There is no registration page and no default account: accounts are made with
--   npm run create-staff -- "Name" "mail@example.com" Staff|Admin
-- =====================================================================

-- ---------------------------------------------------------------------
-- staff_users: Bert, Anita and other staff.
--   password_hash       never the password itself (scrypt, see server/src/lib/passwords.js)
--   failed_login_count  wrong passwords in a row; 5 → locked for 10 minutes
--   locked_until        ISO timestamp (UTC), NULL = not locked
-- ---------------------------------------------------------------------
CREATE TABLE staff_users (
  id                 INTEGER PRIMARY KEY,
  name               TEXT    NOT NULL,
  email              TEXT    NOT NULL UNIQUE COLLATE NOCASE, -- "Anita@..." and "anita@..." are the same account
  password_hash      TEXT    NOT NULL,
  role               TEXT    NOT NULL DEFAULT 'Staff' CHECK (role IN ('Staff', 'Admin')),
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until       TEXT,
  created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

-- ---------------------------------------------------------------------
-- sessions: one row per signed-in browser.
-- The browser keeps a random token in an HttpOnly cookie; only its SHA-256 hash is stored here,
-- so a copy of the database cannot be used to sign in.
--   persistent = 1  "Onthoud mij 30 dagen": the cookie survives closing the browser
-- ---------------------------------------------------------------------
CREATE TABLE sessions (
  token_hash    TEXT    PRIMARY KEY,
  staff_user_id INTEGER NOT NULL REFERENCES staff_users (id) ON DELETE CASCADE,
  persistent    INTEGER NOT NULL CHECK (persistent IN (0, 1)),
  expires_at    TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_sessions_expires ON sessions (expires_at);
