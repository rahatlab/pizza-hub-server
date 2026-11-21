# PizzaHub Server — API

Backend for **PizzaHub**, a pizza ordering & delivery platform (Assignment 9, Category 009).
Built with Express 4, TypeScript, Mongoose, Better Auth, JWT, Stripe.

## Tech stack

- **Runtime**: Node.js 20+ (tsx in dev)
- **Framework**: Express 4 + TypeScript
- **Database**: MongoDB (Atlas) via Mongoose
- **Auth**: Better Auth (email/password + Google OAuth) + JWT bearer tokens
- **Payments**: Stripe (vendor Premium subscription only)
- **Image hosting**: ImgBB (proxied through `/api/upload`)

## Getting started

```bash
cd pizza-hub-server
cp .env.example .env          # fill in the values below
npm install
npm run dev                   # http://localhost:5000
```

### Seed the admin

```bash
npm run seed
# creates pizza@admin.com / 000000aA#  (role: admin)
```

Admin accounts are **never** creatable through the public sign-up endpoint.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | no | `development` / `production` |
| `PORT` | no | default `5000` |
| `CLIENT_ORIGIN` | no | comma-separated, default `http://localhost:3000` |
| `MONGODB_URI` | **yes** | Atlas connection string |
| `MONGODB_DB_NAME` | no | default `pizzahub` |
| `BETTER_AUTH_SECRET` | **yes** | ≥ 32 chars |
| `BETTER_AUTH_URL` | **yes** | server base URL |
| `APP_URL` | **yes** | client base URL |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | enables Google sign-in |
| `JWT_SECRET` | **yes** | ≥ 32 chars |
| `JWT_EXPIRES_IN` | no | default `1d` |
| `STRIPE_SECRET_KEY` | no | vendor Premium checkout |
| `STRIPE_WEBHOOK_SECRET` | no | webhook signature verification |
| `STRIPE_PRICE_ID` | no | recurring price for Premium |
| `PUBLISH_KEY` | no | Stripe publishable key (client) |
| `IMGBB_API_KEY` | no | menu item image hosting |

## API overview

All responses use a consistent envelope: `{ success, data, message? }` or `{ success: false, message }`.

### Health
- `GET /api/health`

### Auth (Better Auth mounted at `/api/auth/*`)
- `POST /api/auth/sign-up/email` — register (customer or vendor)
- `POST /api/auth/sign-in/email` — sign in
- `POST /api/auth/sign-in/social` — Google OAuth start
- `GET  /api/auth/callback/google` — Google OAuth callback
- `POST /api/auth/sign-out` — sign out

### Account (JWT)
- `POST /api/account/token` — swap Better Auth session for JWT
- `GET  /api/account/me` — current user (Bearer token)
- `PATCH /api/account/profile` — update profile
- `POST /api/account/logout` — sign out

### Menu (public browse + vendor CRUD)
- `GET  /api/menu` — browse (search, category, price range, location, sort, pagination)
- `GET  /api/menu/categories` — categories with counts
- `GET  /api/menu/:id` — item detail + reviews
- `POST /api/menu` — vendor creates item (pending approval)
- `PATCH /api/menu/:id` — vendor/admin updates item
- `DELETE /api/menu/:id` — vendor/admin deletes item
- `PATCH /api/menu/:id/moderate` — admin approve/reject
- `POST /api/menu/:id/reviews` — customer review

### Orders
- `POST /api/orders` — place order (customer)
- `GET  /api/orders` — list (filtered by role)
- `GET  /api/orders/:id` — detail with timeline
- `PATCH /api/orders/:id/status` — advance/cancel

### Upload
- `POST /api/upload` — proxy image to ImgBB

### Vendor
- `GET /api/vendor/menu` — vendor's own items (all statuses) + plan usage
- `GET /api/vendor/stats` — item/order counts
- `GET /api/vendor/orders` — vendor's orders

### Admin
- `GET /api/admin/menu` — all items (all statuses)
- `GET /api/admin/users` — user list (role filter)
- `GET /api/admin/stats` — platform overview
- `GET /api/admin/transactions` — subscription transactions
- `GET /api/admin/orders` — all orders
- `PATCH /api/admin/users/:id/role` — change role

### Stripe
- `POST /api/stripe/checkout` — create Premium checkout session
- `POST /api/stripe/webhook` — Stripe webhook (raw body)
- `GET  /api/stripe/status` — configuration check

## Challenge requirements (assignment)

1. **Advanced search + price sort** — `GET /api/menu` accepts `search`, `category`, `minPrice`, `maxPrice`, `location`, `sort` (newest/priceAsc/priceDesc/nameAsc/rating) and `page`/`limit`. Full-text index on `itemName`, `description`, `location`. Price range filtering with `$gte`/`$lte`. Sort applied via Mongoose `.sort()`.
2. **JWT middleware** — `requireAuth` verifies the Bearer JWT on every protected route. `requireRole(...roles)` enforces role-based access. `requireOwnership()` checks resource ownership (admins bypass). Role is re-read from the database, never trusted from the client.
3. **Professional appearance** — consistent response envelope, Zod validation with field-level errors, proper HTTP status codes (401 unauthorized, 403 forbidden, 404 not found, 409 conflict), central error handler.

## Business rules enforced

- Password: minimum 6 chars, at least 1 uppercase, 1 lowercase (Zod + Better Auth hook)
- Admin not creatable via public registration (hook blocks `role: "admin"`)
- Free plan: max 3 active menu items (server-enforced count check)
- Duplicate active order (same customer + item + delivery date) blocked by partial unique index
- Premium activated **only** after a verified Stripe webhook (`checkout.session.completed`)
- Role verified server-side on every protected API
- Order status transitions validated (no skipping steps)

## Database collections

- `users` — accounts (role, plan, favorites, vendor fields)
- `accounts` — Better Auth credentials (password hash)
- `sessions` — Better Auth sessions
- `menuitems` — menu items with embedded reviews
- `orders` — orders with embedded timeline (actor name + role)
- `transactions` — vendor subscription payments only

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start dev server (tsx watch) |
| `npm run build` | Type-check (`tsc --noEmit`) |
| `npm run seed` | Create admin account |
| `npm run test` | Run vitest |

## License

MIT
EOF