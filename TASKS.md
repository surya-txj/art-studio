# Tasks

Deadline: **23 Oct 2026, 11:59 PM IST** (submit via the Google form).

## Done

- [x] Read the brief and the seed data; chose the stack (React + Express + SQLite)
- [x] Database schema with CHECK constraints, foreign keys, partial unique indexes
- [x] Idempotent seeding from `seed.json` (12 paintings, 5 items, 6 glazes, rate 150, studio account)
- [x] Auth: sign-up (customers only), login, logout, hashed DB sessions, httpOnly cookie
- [x] Role middleware: 401 / 403, ownership → 404
- [x] Paintings: public browse, studio add, studio edit only while available
- [x] Orders: buy (concurrency-safe), cancel → painting available again
- [x] Wall bookings: 7–90 days, 10–500 sq ft, address, server-side price, one active booking per date, confirm/decline, 3-day cancel rule
- [x] Pottery: seed items/glazes, qty 1–12, needed-by ≥ 14 days, edit/cancel only while requested, accept/decline
- [x] Consistent JSON errors (400/401/403/404/409/500), malformed-JSON handling, request logging without bodies
- [x] 96 server tests (Vitest + Supertest, fake clock, concurrency, two-connection DB tests): all passing
- [x] React UI: catalogue, painting detail + buy, sign-up/login, customer dashboard, wall booking form, pottery form (new/edit), studio dashboard (bookings, pottery, orders, paintings), painting add/edit
- [x] Loading / empty / error states on every data screen; confirm dialogs on destructive actions
- [x] Manual browser check (21 Oct 2026): sign-up → buy → "already sold" race message → book wall (₹18,000 for 120 sq ft) → pottery request → edit → studio login → confirm booking → accept pottery → customer sees updated statuses, edit/cancel gone → cancel order → painting available again → customer blocked from /studio → API down shows error state
- [x] Production build serves client + API from one server
- [x] README, DESIGN.md, DEMO.md, .env.example

## Before submitting (you)

- [ ] Create a public GitHub repo and push
- [ ] Record the ≤ 5-minute demo with voice (script in DEMO.md), upload to Google Drive, set "anyone with the link"
- [ ] Submit the Google form with the repo link and video link

## Not done / possible next steps

- [ ] Login rate limiting; CSRF token
- [ ] Clean up expired sessions
- [ ] Browser E2E tests (Playwright)
- [ ] ESLint config (TypeScript strict is the current static check)
