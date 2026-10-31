# Fast4Top API integration notes

Source: https://api.fast4top.com/api-docs

- Authentication uses the `api-token` header.
- Profile/balance: `GET https://api.fast4top.com/client/api/profile`.
- Products: `GET https://api.fast4top.com/client/api/products`.
- Create order: `GET https://api.fast4top.com/client/api/newOrder/{product_id}/params` with `qty`, optional `playerId`/other parameters, and required UUIDv4 `order_uuid`.
- Check orders: `GET https://api.fast4top.com/client/api/check?orders=...`.
- Provider order statuses are `accept`, `reject`, and `wait`.
- `order_uuid` makes retries idempotent and prevents duplicate orders.
- Documented error codes include 100 (insufficient provider balance), 111 (retry after one minute), 121 (invalid token), and 123 (IP not allowed).
- The store keeps the token server-side in the protected `FAST4TOP_API_TOKEN` environment value. It must not be committed or exposed to the browser.
