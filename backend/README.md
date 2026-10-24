# RevenuePilot backend

Minimal Node.js, Express, and strict TypeScript service. Requires Node.js 22.14 or newer and npm.

```sh
npm install
npm run dev
```

The development script watches TypeScript files and restarts automatically. It loads `.env` when present, using Node's built-in environment-file support. No environment file is required; `PORT` defaults to `4000`.

To choose another port, set `PORT` in your shell or copy `.env.example` to `.env` and edit it. The example contains no credentials. Keep secrets in ignored environment files and never add them to source control.

## Health check

`GET http://localhost:4000/api/health`

```json
{
  "success": true,
  "service": "revenuepilot-backend"
}
```

## Production

```sh
npm run build
npm start
```

The build compiles `src/` into `dist/`. `src/app.ts` defines the Express app, JSON parsing, health route, JSON 404 responses, and a basic error handler. `src/server.ts` validates the port and manages the server lifecycle.

The frontend uses the health, products, orders, and dashboard-summary endpoints. WooCommerce access is read-only and backend-only. PostgreSQL schema/tooling is configured separately and WooCommerce data is not persisted yet. Run the frontend separately from `../frontend`.

## CORS

`CORS_ORIGINS` is a comma-separated allowlist of exact frontend origins, with no paths or trailing slashes. Development defaults to `http://localhost:5175,http://127.0.0.1:5175`. Requests from other browser origins receive HTTP 403 without an allow-origin header. The service allows GET/OPTIONS and does not enable credentials or wildcard origins.

With `NODE_ENV=production`, no cross-origin access is allowed until `CORS_ORIGINS` is explicitly configured. For example, set it to your deployed frontend's exact HTTPS origin. Restart the backend after changing environment configuration. CORS is a browser policy, not authentication; requests without an Origin header remain available for same-origin access and health monitoring.

The existing local frontend uses port 5175 and expects this backend on 4001. When port 4000 is occupied, run `PORT=4001 npm run dev`, or set `PORT=4001` in your ignored `.env` file. The configurable backend default remains 4000.

## PostgreSQL and Prisma (Step 6)

Prisma CLI, Client, and PostgreSQL adapter are pinned together at `7.10.1`, compatible with the project's Node.js 22.14 / TypeScript 5.9 environment. The PostgreSQL driver is supplied by `@prisma/adapter-pg`. No database URL or credentials are embedded in the schema, generated client, or application source. Native Node environment-file loading avoids another environment-loader dependency.

At setup time, no local PostgreSQL executable, Homebrew PostgreSQL package, default-port listener, Docker, or configured `DATABASE_URL` was found. Schema validation and client generation were verified offline. No PostgreSQL connection or migration has been verified or performed.

Choose a database setup before attempting a connection:

- **Postgres.app:** a simple macOS GUI to install and run local PostgreSQL.
- **Homebrew PostgreSQL:** install/start a PostgreSQL formula and create a dedicated development database and role.
- **Existing hosted PostgreSQL:** use the real connection URL supplied by the database administrator/provider and its required TLS configuration.

Use a dedicated development database, not an existing production database, for the first development migration. Create your own role and credentials; no sample credentials are assumed.

1. Copy `.env.example` to `.env` and replace **every uppercase placeholder** in `DATABASE_URL` and `DATABASE_URL_UNPOOLED` with your real database settings. Use the pooled URL for application traffic and the direct URL for Prisma CLI migrations. URL-encode any special characters in the user/password. Do not print either URL or add `.env` to source control.
2. Set `PORT=4001` in `.env` to preserve the current frontend-to-backend configuration, and restart the backend if needed. Database credentials remain backend-only; never put them in a `VITE_` variable.
3. Run `npm run db:check`. It performs only `SELECT 1`, disconnects afterward, exits nonzero on failure, and never prints connection details. A successful connection check does not prove schema migrations are applied.
4. Run `npm run db:migrate -- --name init` only after the real development database is configured. Prisma may require permission to create a shadow database. Review the resulting migration under `prisma/migrations/` and commit that migration, not environment files or generated code.
5. Run `npm run db:status` to verify migration state. For deployed environments, apply reviewed/committed migrations with `npm run db:deploy`; do not run development migrations against production.

Commands from `backend/`:

| Command                             | Purpose                                             | Needs a configured database? |
| ----------------------------------- | --------------------------------------------------- | ---------------------------- |
| `npm run prisma:validate`           | Validate the schema                                 | No                           |
| `npm run prisma:generate`           | Generate the ESM TypeScript client                  | No                           |
| `npm run build`                     | Generate client, then compile backend               | No                           |
| `npm run db:check`                  | Verify a real PostgreSQL connection with `SELECT 1` | Yes                          |
| `npm run db:migrate -- --name init` | Create and apply the first development migration    | Yes                          |
| `npm run db:deploy`                 | Apply committed migrations                          | Yes                          |
| `npm run db:status`                 | Inspect applied/pending migrations                  | Yes                          |

`prisma.config.ts` prefers `DATABASE_URL_UNPOOLED` for Prisma CLI operations and falls back to `DATABASE_URL`. The runtime PostgreSQL adapter uses pooled `DATABASE_URL`. When neither variable is present, validation/generation still work but database commands cannot connect. Generated client files in `src/generated/` and compiled files in `dist/` are ignored and are recreated by the build. After a schema change, regenerate the client. The backend currently has no lint script; its production build performs strict TypeScript checking.

## WooCommerce connection

WooCommerce is the source of truth for product, order, and revenue data. The
backend uses the official WooCommerce REST API v3 over HTTPS. Configuration is
backend-only and is read from the ignored `.env` file:

```dotenv
WOOCOMMERCE_STORE_URL=https://store.example.com
WOOCOMMERCE_CONSUMER_KEY=ck_...
WOOCOMMERCE_CONSUMER_SECRET=cs_...
```

Create a read-only key in WooCommerce under **Settings → Advanced → REST API**.
The store URL must be the canonical public HTTPS URL. Localhost, IP literals in
private/reserved ranges, hostnames resolving to private/reserved addresses,
credentials embedded in URLs, and redirects are rejected. API credentials are
sent only in the HTTPS Basic Authorization header and are never placed in query
parameters.

Run `npm run woo:check` to verify the configured store and fetch at most three
products from page one. The command prints only a sanitized result. The API also
provides paginated products, paginated orders without customer information, and
date-filtered aggregate dashboard metrics. It does not write WooCommerce data
to PostgreSQL.

### Initial schema

- `User`: UUID, unique email, optional display name, timezone-aware creation/update timestamps. This is a data model only; no login, credentials, or authentication flow is implemented.
- `Store`: UUID, required owner relation, name, optional URL, three-character currency, timestamps. A user may own multiple stores.
- `Order`: required store relation, composite `(storeId, id)` primary key, optional external ID unique within its store, status, currency snapshot, placement timestamp, and monetary fields using PostgreSQL `DECIMAL(19,4)`.
- `Product`: required store relation, composite `(storeId, id)` primary key, store-scoped unique external ID/SKU, name, decimal price, optional stock, and timestamps. Product prices use their store's currency.

External IDs/SKUs can repeat across stores. Required foreign keys prevent orphaned records; indexed store/date/status fields support future store-scoped reads. Restrictive deletes avoid silently removing store/order/product data. No records or demo data are seeded. There is no order-line model yet; adding it later must use store-inclusive relations.

Composite identifiers require a store for unique order/product lookups; they do not replace authorization. Future business-data endpoints must verify ownership and scope all queries to the authorized store. Authentication, row-level security policies, and business-data endpoints are outside this step.
