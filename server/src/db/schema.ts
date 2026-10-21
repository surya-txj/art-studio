// The whole database schema. Every statement is idempotent (IF NOT EXISTS),
// so it is safe to run on every server start.
//
// Business rules that matter for correctness are enforced here, not only in code:
//  - CHECK constraints pin every status column to the allowed values.
//  - Partial UNIQUE indexes stop double-selling a painting and double-booking a date,
//    even if two requests race each other.
export const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('customer', 'studio')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

-- Key/value settings loaded from seed.json (mural rate, currency).
CREATE TABLE IF NOT EXISTS studio_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS paintings (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  artist      TEXT NOT NULL,
  description TEXT NOT NULL,
  price       INTEGER NOT NULL CHECK (price > 0),
  image_url   TEXT,
  status      TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  painting_id  TEXT NOT NULL REFERENCES paintings(id),
  customer_id  INTEGER NOT NULL REFERENCES users(id),
  price        INTEGER NOT NULL CHECK (price > 0),
  status       TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'cancelled')),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  cancelled_at TEXT
);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders(customer_id);
-- A painting can have at most ONE placed order. Cancelled orders don't count,
-- so a painting can be bought again after its order is cancelled.
CREATE UNIQUE INDEX IF NOT EXISTS orders_one_placed_per_painting
  ON orders(painting_id) WHERE status = 'placed';

CREATE TABLE IF NOT EXISTS wall_bookings (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id    INTEGER NOT NULL REFERENCES users(id),
  booking_date   TEXT NOT NULL CHECK (date(booking_date) IS booking_date),
  wall_size_sqft INTEGER NOT NULL CHECK (wall_size_sqft BETWEEN 10 AND 500),
  address        TEXT NOT NULL CHECK (length(trim(address)) > 0),
  rate_per_sqft  INTEGER NOT NULL CHECK (rate_per_sqft > 0),
  price          INTEGER NOT NULL CHECK (price > 0),
  status         TEXT NOT NULL DEFAULT 'requested'
                 CHECK (status IN ('requested', 'confirmed', 'declined', 'cancelled')),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS wall_bookings_customer_idx ON wall_bookings(customer_id);
-- One date = one active booking. Declined and cancelled bookings free the date.
CREATE UNIQUE INDEX IF NOT EXISTS wall_bookings_one_active_per_date
  ON wall_bookings(booking_date) WHERE status IN ('requested', 'confirmed');

CREATE TABLE IF NOT EXISTS pottery_items (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS glazes (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pottery_requests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES users(id),
  item_id     TEXT NOT NULL REFERENCES pottery_items(id),
  glaze_id    TEXT NOT NULL REFERENCES glazes(id),
  quantity    INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 12),
  needed_by   TEXT NOT NULL CHECK (date(needed_by) IS needed_by),
  status      TEXT NOT NULL DEFAULT 'requested'
              CHECK (status IN ('requested', 'accepted', 'declined', 'cancelled')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS pottery_requests_customer_idx ON pottery_requests(customer_id);
`;
