``` json

{
  "success": false,
  "statusCode": 500,
  "message": "Something went wrong",
  "error": {
    "code": "INTERNAL_SERVER_ERROR"
  }
}

{
  "success": false,
  "statusCode": 401,
  "message": "Authentication required. Please log in to continue.",
  "error": {
    "code": "UNAUTHORIZED"
  }
}

{
  "success": true,
  "message": "Users fetched successfully",
  "data": [
    {
      "_id": "101",
      "name": "Rahat",
      "email": "rahat@gmail.com",
      "role": "admin"
    },
    {
      "_id": "102",
      "name": "John",
      "email": "john@gmail.com",
      "role": "user"
    }
  ]
}
```

### Suggested semantic tokens

| Token | Light Mode | Dark Mode |
|---|---|---|
| Page background | Warm cream | Deep charcoal |
| Card background | White | Dark chocolate |
| Main text | Dark brown | Warm white |
| Muted text | Brown-gray | Soft gray |
| Primary | Tomato red | Tomato red |
| Accent | Warm orange | Warm orange |
| Border | Light beige | Muted dark gray |
| Success | Accessible green | Accessible green |
| Warning | Accessible amber | Accessible amber |
| Destructive | Accessible red | Accessible red |

Use semantic tokens rather than scattering raw hex values throughout components.

---

## 5. MongoDB collections and relationships

Follow the assignment's four business collections. Better Auth manages its own authentication-related collections.

### `users` (Better Auth user records + application fields)
- `name`
- `email`
- `image`
- `role`: `admin | vendor | customer`
- `isBlocked`
- `businessName` (vendor only)
- `subscriptionPlan`: `free | premium`
- `subscriptionExpiresAt`

### `menuItems`
- `vendorId` — reference to `users`
- `itemName`
- `category`
- `description`
- `price`
- `location`
- `images`
- `status`: `pending | approved | rejected | inactive`
- `createdAt`

### `orders`
- `itemId` — reference to `menuItems`
- `vendorId` — reference to `users`
- `customerId` — reference to `users`
- `deliveryDate`
- `deliveryAddress`
- `message`
- `status`: `pending | accepted | rejected | cancelled`
- `createdAt`

### `transactions`
- `vendorId` — reference to `users`
- `plan`
- `amount`
- `currency`
- `stripeSessionId`
- `stripeSubscriptionId`
- `status`
- `createdAt`



---

## 6. Suggested API endpoints

All protected endpoints must verify the authenticated identity on the server. Never trust a client-supplied role or user ID for authorization.

### Dashboard analytics
- `GET /api/admin/dashboard/stats`
- `GET /api/admin/dashboard/analytics`
- `GET /api/vendor/dashboard/stats`
- `GET /api/vendor/dashboard/analytics`
- `GET /api/customer/dashboard/stats`
- `GET /api/customer/dashboard/analytics`

### Admin
- `GET /api/admin/users`
- `PATCH /api/admin/users/:id/block` (optional feature)
- `PATCH /api/admin/users/:id/unblock` (optional feature)
- `GET /api/admin/menu-items`
- `PATCH /api/admin/menu-items/:id/approve`
- `PATCH /api/admin/menu-items/:id/reject`
- `PATCH /api/admin/menu-items/:id/status`
- `DELETE /api/admin/menu-items/:id`
- `GET /api/admin/transactions`

### Vendor
- `GET /api/vendor/menu-items`
- `POST /api/vendor/menu-items`
- `PATCH /api/vendor/menu-items/:id`
- `DELETE /api/vendor/menu-items/:id`
- `GET /api/vendor/orders`
- `PATCH /api/vendor/orders/:id/status`
- `POST /api/vendor/subscription/checkout`

### Customer
- `GET /api/customer/orders`
- `POST /api/customer/orders`
- `PATCH /api/customer/orders/:id/cancel`
