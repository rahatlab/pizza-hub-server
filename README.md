# PizzaHub Server — Express + MongoDB + Better Auth

Backend API for PizzaHub — Pizza Ordering & Delivery Platform.

## 🛠 Tech Stack

- Express.js, TypeScript, MongoDB (Mongoose)
- Better Auth (MongoDB adapter) + Google OAuth
- JWT (localStorage) + role-based middleware chain
- Stripe Checkout + webhook (vendor premium subscription)
- ImgBB proxy (image upload)
- Socket.io (realtime review updates)

## 📁 Structure

```
src/config/env.ts       # Env validation
src/lib/db.ts           # MongoDB connection
src/lib/auth.ts         # Better Auth config
src/lib/jwt.ts          # JWT sign/verify
src/lib/socket.ts       # Socket.io server
src/middleware/auth.ts  # verifyJWT → loadUserFresh → blockCheck → requireRole → ownershipCheck
src/middleware/error.ts # ApiError + asyncHandler + centralized error middleware
src/models/*.ts         # User, MenuItem, Order, Transaction, Review
src/routes/*.ts         # All API routes
scripts/seed-admin.ts   # Admin seed script
```

## 🔑 Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default 5000) |
| `NODE_ENV` | development/production |
| `CLIENT_URL` | CORS allowlist origin |
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DB_NAME` | Database name |
| `BETTER_AUTH_SECRET` | Better Auth secret |
| `BETTER_AUTH_URL` | Better Auth base URL |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `JWT_SECRET` | JWT signing secret |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_ID` | Stripe premium plan price ID |
| `IMGBB_API_KEY` | ImgBB API key |
| `ADMIN_EMAIL` | Admin email for seeding |

## 🚀 Local Development

```bash
cd pizza-hub-server
cp .env.example .env
# Edit .env with real values
npm install
npm run dev      # http://localhost:5000
npm run seed     # Seed admin user
npm run build    # TypeScript check
```

## 📋 API Endpoints

### Public
- `GET /api/health` — health check
- `GET /api/menu` — search/filter/sort/paginate
- `GET /api/menu/:id` — single item

### Auth (`/api/auth/*`)
- Better Auth: sign-in, sign-up, sign-out, session
- `POST /api/auth/jwt` — issue JWT for Bearer auth

### Customer
- `POST /api/orders` — place order
- `GET /api/customer/orders` — own orders
- `PATCH /api/customer/orders/:id/cancel` — cancel pending
- `GET /api/customer/stats` — order stats

### Vendor
- `POST /api/vendor/menu` — create item (free: max 3 active)
- `GET /api/vendor/menu` — own items
- `PUT /api/vendor/menu/:id` — update item
- `DELETE /api/vendor/menu/:id` — delete item
- `PATCH /api/vendor/menu/:id/availability` — toggle
- `GET /api/vendor/orders` — received orders
- `PATCH /api/vendor/orders/:id` — accept/reject
- `GET /api/vendor/stats` — vendor stats
- `POST /api/payment/checkout` — Stripe checkout

### Admin
- `GET /api/admin/users` — list users
- `PATCH /api/admin/users/:id/block` — block/unblock
- `GET /api/admin/menu` — all items
- `PATCH /api/admin/menu/:id/status` — approve/reject
- `DELETE /api/admin/menu/:id` — delete item
- `GET /api/admin/transactions` — transactions (read-only)
- `GET /api/admin/stats` — overview counts

### Profile & Reviews
- `PATCH /api/profile` — update profile
- `POST /api/reviews` — create review
- `GET /api/reviews/:itemId` — reviews + avg
- `PATCH /api/reviews/:id` — edit review
- `DELETE /api/reviews/:id` — delete review

### Upload
- `POST /api/upload` — ImgBB proxy (max 2MB)

## 🔐 Auth Flow (JWT)

1. Better Auth handles sign-in/up (session cookie)
2. Client calls `POST /api/auth/jwt` with `credentials: include`
3. Server verifies Better Auth session, signs JWT `{ userId, email, role }`
4. Client stores JWT in `localStorage` as `pizzahub_token`
5. Protected APIs require `Authorization: Bearer <jwt>`
6. Middleware chain: `verifyJWT → loadUserFresh → blockCheck → requireRole → ownershipCheck`
7. User role loaded fresh from DB on every protected request (never stale)

## 💳 Stripe (Vendor Premium Only)

- Customer orders: no payment (plain button)
- Vendor premium: Stripe Checkout → webhook verification → activate premium
- Premium activated only via verified `checkout.session.completed` webhook
- `customer.subscription.deleted` → downgrade to free

## 📡 Socket.io (Realtime Reviews)

- Client connects with `auth: { token: localStorage.pizzahub_token }`
- Server verifies JWT on handshake
- Room: `item:<itemId>` → targeted broadcast
- On new review: emit `new-review` to room

## 🔒 Security

- CORS with explicit origin allowlist + credentials
- Helmet security headers
- Server-side role verification on all protected APIs
- Resource ownership check before update/delete
- Stripe premium only via verified webhook (never frontend redirect)
- Input validation on all endpoints
- `.env` / secrets never committed

## 📦 Commit Convention

Format: `type: short-relevant-message`

Types: `feat`, `fix`, `style`, `refactor`, `perf`, `docs`, `test`, `chore`, `ci/build`, `revert`

No suffixes (`final2`, `done`, `update`, `wip`).
