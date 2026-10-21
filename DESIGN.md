# Design notes

## 1. How do login and the two roles work?

**Logging in.** A customer signs up with name, email and password. The password is hashed with bcrypt (`bcryptjs`) and only the hash is stored.

**Sessions.** On sign-up or login, the server creates a random 32-byte token. It stores a SHA-256 hash of the token in the `sessions` table, with an expiry time. It sends the token to the browser as an `httpOnly`, `SameSite=Lax` cookie, which is also `Secure` in production. On every request, middleware (`loadUser`) looks the cookie up and sets `req.user`. Logging out deletes the session row, so the cookie stops working immediately.

**Roles.** There are two: `customer` and `studio`, matching `"role": "studio"` in the supplied seed data.

- Sign-up always creates a `customer`. The request schema is strict, so sending `"role": "studio"` is rejected with 400.
- The only studio account is created by the seed script from `seed.json`.

**Access checks.** Every protected route starts with `requireAuth` or `requireRole('customer' | 'studio')`:

- Not logged in → **401**.
- Logged in with the wrong role → **403**.
- Ownership is checked in the services: a customer's queries always include `AND customer_id = <their id>`. So another customer's order, booking or request is simply not found → **404**, as the brief asks.

The React app hides buttons that don't apply, but that's only convenience. The server makes every decision.

**Public catalogue.** Browsing paintings is public: guests can see the catalogue, and must log in to buy. I read the RBAC table as "both roles can browse", and a shop you can't look at before signing in would be unusual. Everything private (orders, bookings, pottery requests) needs a login.

## 2. Which database did you choose, and why?

**SQLite**, through `better-sqlite3`.

- **Runs anywhere.** It needs no server or account. `npm install && npm run dev` works on a clean machine, which matters because evaluators have to run the app from the README.
- **Real guarantees.** It still has transactions, foreign keys, `CHECK` constraints and **partial unique indexes**, and those carry the important rules (see question 3).
- **Simple code.** `better-sqlite3` is synchronous, which keeps transaction code short and easy to follow.

The brief prefers cloud databases. The trade-off is that SQLite allows only one writer at a time and lives on one machine. For a small studio site that's fine. The schema is plain SQL, so moving to PostgreSQL later would mostly mean changing the driver.

## 3. How do you stop two people from taking the same painting or date?

**Paintings.** There are two layers:

1. **Conditional update inside a transaction** (`orders.service.ts → placeOrder`). The purchase runs:

   ```sql
   UPDATE paintings SET status = 'sold' WHERE id = ? AND status = 'available'
   ```

   If another purchase got there first, zero rows change and the second buyer gets **409** "This painting has already been sold." The order row is inserted in the same transaction, so a painting can never be sold without an order, or have an order without being sold. Cancelling also runs in one transaction: it sets the order to `cancelled` and the painting back to `available`.

2. **Database constraint.**

   ```sql
   CREATE UNIQUE INDEX orders_one_placed_per_painting ON orders(painting_id) WHERE status = 'placed'
   ```

   Even if the code had a bug, the database would refuse a second placed order for the same painting. Cancelled orders don't count, so a painting can be bought again after a cancellation.

**Dates.** One partial unique index does the job:

```sql
CREATE UNIQUE INDEX wall_bookings_one_active_per_date ON wall_bookings(booking_date)
  WHERE status IN ('requested', 'confirmed')
```

The service doesn't check whether the date is free first, because that would leave a gap between the check and the insert. It just inserts. If SQLite reports a unique-constraint violation, the customer gets **409** with the message "… is no longer available. Please choose another date."

**What "each date can be booked only once" means here:** at most one booking per calendar date can be `requested` or `confirmed`. If a booking is declined by the studio or cancelled by the customer, the date becomes free again. Without this, one declined request would block a date forever.

**Proof in the tests.**

- Several purchases (or bookings) of the same painting (or date) are fired at once with `Promise.all`: exactly one gets 201 and the rest get 409.
- `database.test.ts` opens **two separate connections** to one database file, like two server processes would, and shows the database itself rejects the second booking and the second claim on a painting.

**Other trusted-server rules.**

- Prices come from the database, never from the request. Bookings store the rate they were priced at.
- Dates are checked on the server, counting days in the studio's timezone (IST). Any field the client isn't allowed to set, such as `price`, `status` or `customerId`, is rejected by strict Zod schemas.
- Status changes only happen through specific actions (`/confirm`, `/cancel`, …). Each one updates with `WHERE status = '<allowed from-state>'`, so an invalid transition can't happen, even in a race.

## 4. What did you finish, what did you leave out, and what would you do next?

**Finished** (all working and tested):

- Accounts and roles.
- All three services with every rule in the brief: paintings and orders, wall bookings, pottery requests.
- 401/403/404 handling.
- Concurrency protection.
- Loading, empty and error states on every data screen.
- Customer and studio dashboards.
- 96 automated tests: the date boundaries (6/7/90/91 days, 13/14 days, the 3-day cancel window), access control, ownership, concurrency, and seeding twice.
- The main flows were also clicked through by hand in a browser.

**Left out:**

- Everything the brief marked out of scope: payments, password reset, uploads, deployment.
- Rate limiting and a CSRF token.
- Frontend unit tests.
- A studio "cancel" action, since the brief gives cancelling only to customers.
- Pagination: the lists are small.

**Next:**

1. Add login rate limiting, and a cleanup job for expired sessions.
2. Add a few browser end-to-end tests (e.g. Playwright) for the main customer and studio flows.
3. Move to hosted PostgreSQL if the site needs more than one server, keeping the same partial unique indexes.
