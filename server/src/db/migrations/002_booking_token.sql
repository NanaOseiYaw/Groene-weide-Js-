-- =====================================================================
-- 002_booking_token: protects the guest payment step.
--
-- In the C# (Blazor) version the reservation id never left the server. In a JSON API the
-- browser gets the id, so anyone could try "pay for reservation 41, 42, 43...".
-- When a guest reservation is created, the guest receives a random booking token; only a
-- SHA-256 hash of it is stored here. Paying requires the token. Staff bookings have none.
-- =====================================================================
ALTER TABLE reservations ADD COLUMN booking_token_hash TEXT;
