# 5-minute demo script

Before recording, start from a fresh database (`rm -rf server/data` with the server stopped), then run `npm run dev` and open http://localhost:5173. Use two browser windows, one normal and one private, so the customer and the studio can be logged in at the same time.

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:20 | Catalogue | "Art studio site: customers buy paintings, book a wall painting and request pottery; the studio manages them. React + Express + SQLite." |
| 0:20–0:50 | **Sign up** as a new customer | "Sign-up always creates a customer. The password is hashed with bcrypt, and the session is an httpOnly cookie backed by a sessions table." |
| 0:50–1:30 | Open a painting → **Buy** → show "Sold". Then, in the private window as a second customer, try to buy the same one | "Second buyer gets 'This painting has already been sold.' (409). I'll show why in the code." |
| 1:30–2:10 | **Book a wall**: show the date limits, type 120 sq ft → ₹18,000, submit. Try the same date again | "Rate ₹150 comes from the seed data; the server computes the price. The same date again is refused with a clear message." |
| 2:10–2:40 | **Request pottery**: item, glaze, quantity, date ≥ 14 days away. Show Edit on My account | "Editable and cancellable only while it is still 'requested'." |
| 2:40–3:20 | Private window: **log in as studio** → dashboard → **Confirm** the booking, **Accept** the pottery request. Back in the customer window: refresh My account | "Statuses changed; the pottery request no longer has Edit/Cancel. The customer can't open /studio, and the API returns 403 even if they try directly." |
| 3:20–4:40 | **Code walkthrough**: `server/src/modules/orders/orders.service.ts → placeOrder`, then `server/src/db/schema.ts` (the two partial unique indexes) | "The purchase is one transaction: `UPDATE … SET status='sold' WHERE id=? AND status='available'`. If zero rows change, someone else won, so 409. The partial unique index on orders is a second guard in the database itself. Bookings just insert and let the unique index on active dates reject the duplicate." |
| 4:40–5:00 | Terminal: `npm test` | "96 tests: date boundaries, 401/403/404, ownership, and concurrent purchases and bookings where exactly one wins." |

**If something goes wrong live:** the test suite is the fallback evidence. Show the concurrency tests in `server/tests/orders.test.ts` and `server/tests/database.test.ts`.
