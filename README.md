# Art Studio

A small full-stack website for an art studio, with two roles:

- **Customers** can buy one-of-a-kind paintings, book a wall-painting date, and request custom pottery. They can also cancel or edit their own records where the rules allow.
- **The studio** (admin) can add and edit paintings, see every order, booking and request, confirm or decline bookings, and accept or decline pottery requests.

Built for the GDGC Web Dev volunteer assignment. Design answers are in [DESIGN.md](DESIGN.md), the progress checklist in [TASKS.md](TASKS.md), and the demo script in [DEMO.md](DEMO.md).

## Features

| Area | What works |
| --- | --- |
| Accounts | Customer sign-up, log in, log out, session cookie. Studio account comes from the seed data (no studio sign-up). |
| Paintings | Public catalogue with an available/sold filter, and a detail page. The studio adds paintings and edits a painting only while it is available. |
| Orders | A customer buys an available painting, which creates a `placed` order. Cancelling (`cancelled`) makes the painting available again. Two buyers can never both get the same painting. |
| Wall bookings | Date 7–90 days away, wall size 10–500 sq ft, and an address. Price = size × the rate from `seed.json` (₹150/sq ft), calculated on the server. One active booking per date. The studio confirms or declines. A customer can cancel until 3 days before the date. |
| Pottery | Item and glaze from the seed data, quantity 1–12, needed-by date at least 14 days away. A customer edits or cancels only while the request is `requested`. The studio accepts or declines. |
| Access control | Not logged in → 401. Wrong role → 403. Someone else's record → 404. Checked on the server for every request. |
| UI states | Every data screen has loading, empty and error states, and refusals show clear messages ("This painting has already been sold.", "… is no longer available. Please choose another date.", etc.). |

## Tech stack

- **Frontend:** React 19 + TypeScript + Vite + React Router
- **Backend:** Node.js + Express 5 + TypeScript
- **Database:** SQLite through `better-sqlite3` (a single file, created automatically)
- **Validation:** Zod at every API boundary
- **Auth:** bcrypt-hashed passwords, plus random session tokens stored (hashed) in the database and sent as an httpOnly cookie
- **Tests:** Vitest + Supertest (API and database tests with a controllable clock)

### Project layout

```
art-studio/
├── package.json            # npm workspaces + top-level scripts
├── .env.example
├── client/                 # React app
│   └── src/
│       ├── api/            # fetch wrapper + response types
│       ├── auth/           # AuthContext (who is logged in, for the UI only)
│       ├── components/     # Layout, RequireRole, loading/empty/error states
│       ├── hooks/          # useAsync (load data), useAction (buttons that change data)
│       └── pages/          # one file per screen
└── server/
    ├── seed-data/          # the supplied seed.json + painting images
    ├── src/
    │   ├── app.ts          # builds the Express app (used by index.ts and tests)
    │   ├── index.ts        # starts the server
    │   ├── config.ts       # environment variables
    │   ├── db/             # schema, connection, idempotent seeding
    │   ├── lib/            # errors, date helpers, validation helper
    │   ├── middleware/     # session loading, requireAuth/requireRole, error handler
    │   └── modules/        # auth, paintings, orders, bookings, pottery, studio
    │       └── <feature>/  #   <feature>.routes.ts (HTTP + validation) and <feature>.service.ts (rules + SQL)
    └── tests/              # Vitest + Supertest
```

Each request follows the same path: **route** (checks role, validates input with Zod) → **service** (business rules and SQL, run in a transaction where needed) → JSON response. Every error goes through one error handler and comes back as:

```json
{ "error": { "code": "DATE_TAKEN", "message": "2026-11-05 is no longer available. Please choose another date." } }
```

## Prerequisites

- **Node.js 22.9 or newer** (tested with Node 24; the scripts use `--env-file-if-exists`). npm comes with it.
- Nothing else. No database server is needed, because SQLite is a file. `better-sqlite3` downloads a prebuilt binary for common platforms. If your platform has no prebuilt binary, it compiles one, which needs Python and a C++ toolchain.

## Setup and running

```bash
git clone <this-repo-url> art-studio
cd art-studio
npm install
cp .env.example .env      # optional: every variable has a sensible default
```

### Development (two servers, hot reload)

```bash
npm run dev
```

- Website: http://localhost:5173
- API: http://localhost:4000 (Vite forwards `/api` and `/images` to it)

On first start the server creates `server/data/art-studio.db`, builds the tables and loads the seed data. There is no separate migration step: the schema is `CREATE TABLE IF NOT EXISTS …` in `server/src/db/schema.ts` and is applied on every start.

### Production-style (one server)

```bash
npm run build
npm start                 # serves the built React app and the API on http://localhost:4000
```

Only set `NODE_ENV=production` when serving over HTTPS, because it marks the session cookie `Secure`.

### Seed data

The seed is loaded automatically on server start. You can also run it on its own:

```bash
npm run seed
```

It reads `server/seed-data/seed.json` and is safe to run many times:

- Paintings are inserted only if missing, so a re-seed never un-sells a bought painting.
- Pottery items, glazes and the mural rate are upserted.
- The studio account is created only if it doesn't exist yet.

**Reset to a fresh database:** stop the server, delete `server/data/`, and start again.

## Test accounts

- **Studio (admin):** the account in `server/seed-data/seed.json` → `studioAccount` (email and password are in that file; it was supplied with the assignment). To use a different password, set `STUDIO_PASSWORD` in `.env` before the first start. The password is stored only as a bcrypt hash.
- **Customer:** use **Sign up** on the website (any email, password at least 8 characters). Customers can only be created through sign-up, and sign-up can only create customers.

## Tests, typecheck, build

```bash
npm test             # 96 API + database tests (server)
npm run typecheck    # TypeScript, server and client
npm run build        # compiles the server and builds the client
```

Tests use a fresh in-memory database per test, and a fake clock fixed at 1 Nov 2026 (IST), so date rules are tested at exact boundaries and the results do not depend on when you run them. There is no ESLint setup; TypeScript strict mode is the static check.

## Environment variables

All are optional. See [.env.example](.env.example).

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | API port (the Vite dev proxy expects 4000) |
| `DATABASE_FILE` | `data/art-studio.db` | SQLite file, relative to `server/` |
| `SESSION_TTL_HOURS` | `168` | Login session lifetime |
| `BCRYPT_ROUNDS` | `10` | Password hashing cost |
| `STUDIO_TIMEZONE` | `Asia/Kolkata` | Calendar used for "days away" rules |
| `STUDIO_PASSWORD` | *(from seed.json)* | Studio password used when the account is first created |
| `NODE_ENV` | `development` | `production` makes the session cookie `Secure` |

## API overview

All endpoints are under `/api`. Bodies are JSON. "C" = customer, "S" = studio.

| Method & path | Who | Notes |
| --- | --- | --- |
| `POST /auth/register` | anyone | `{name, email, password}`. Always creates a customer and logs them in. |
| `POST /auth/login` / `POST /auth/logout` / `GET /auth/me` | anyone / any / logged in | Session cookie `sid` |
| `GET /paintings[?status=available\|sold]`, `GET /paintings/:id` | anyone | Public catalogue |
| `POST /paintings`, `PATCH /paintings/:id` | S | Edit → 409 if the painting is sold. Unknown fields such as `status` → 400. |
| `GET /orders`, `GET /orders/:id` | C (own) / S (all) | Another customer's order → 404 |
| `POST /orders` | C | `{paintingId}` → 201. 409 `PAINTING_SOLD` if already sold. |
| `POST /orders/:id/cancel` | C (own) | Makes the painting available again |
| `GET /bookings`, `GET /bookings/:id` | C (own) / S (all) | |
| `GET /bookings/unavailable-dates` | logged in | Dates already held (no customer details) |
| `POST /bookings` | C | `{date: "YYYY-MM-DD", wallSizeSqft, address}`. 409 `DATE_TAKEN` if the date is held. |
| `POST /bookings/:id/cancel` | C (own) | 409 within 3 days of the date |
| `POST /bookings/:id/confirm`, `/decline` | S | Only from `requested` |
| `GET /pottery-options` | anyone | Items and glazes from the seed |
| `GET /pottery-requests`, `GET /pottery-requests/:id` | C (own) / S (all) | |
| `POST /pottery-requests` | C | `{itemId, glazeId, quantity, neededBy}` |
| `PATCH /pottery-requests/:id`, `POST /pottery-requests/:id/cancel` | C (own) | Only while `requested`, else 409 |
| `POST /pottery-requests/:id/accept`, `/decline` | S | Only from `requested` |
| `GET /studio/info` | anyone | Currency, mural rate, today's allowed date ranges (for forms) |
| `GET /health` | anyone | Checks the database is reachable |

Status codes: 400 invalid input / malformed JSON, 401 not logged in, 403 wrong role, 404 missing or not yours, 409 business conflict, 500 unexpected (generic message; details only in the server log).

## Known limitations

- **SQLite allows one writer at a time.** That's fine for a small studio site and is part of why double-booking can't happen. A busy multi-server deployment would move to PostgreSQL (the SQL and constraints carry over).
- **No CSRF token.** The cookie is `SameSite=Lax` and every state change is a JSON `POST`/`PATCH`, which blocks the usual cross-site form attack in modern browsers, but there is no explicit token.
- **No rate limiting** on login or sign-up.
- **Sessions are not cleaned up:** expired ones are ignored but stay in the table.
- Images for new paintings are a URL or path (uploads were out of scope).
- Wall size must be a whole number of square feet.
- The studio cannot cancel customer orders or bookings (the brief gives cancelling only to customers), and cannot decline a booking after confirming it.
- No frontend tests: business rules are tested at the API level, and the UI was checked manually in a browser (see TASKS.md).
- Not deployed (deployment was out of scope).
