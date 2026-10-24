# RevenuePilot frontend

Revenue intelligence dashboard with live WooCommerce products, orders, and Overview metrics. Illustrative opportunity and supporting demo views remain clearly labelled.

## Run

```sh
npm install
npm run dev -- --host 127.0.0.1
```

Use the URL printed by Vite. If its default port is occupied, Vite selects the next available port.

```sh
npm run build
npm run lint
```

## Dashboard

- Fixed desktop sidebar and keyboard-accessible mobile navigation.
- Reporting-period selector loads live 7, 30, or 90-day WooCommerce KPIs and chart data on Overview.
- SVG revenue chart with comparison toggle, hover values, and a readable data table.
- Recent orders with local search, empty state, and expanded view.
- Orders view with paginated live WooCommerce orders, search, status filters, and no customer information.
- Export orders CSV downloads exactly the displayed rows, including active search and status filters. The Overview preview exports its five visible rows; the Orders view exports all matching rows. With no matches, the CSV contains headers only. Each order row is labelled as demo data, and amounts are USD.
- Products view uses live WooCommerce data; Customers remains an explicitly labelled demo view.
- Revenue Recovery and Analytics views reuse the overview panels and selected reporting range.
- Settings edits the demo workspace name in React state, with validation and save feedback. Help explains the demo controls.
- Revenue opportunities with illustrative estimates and detail dialogs.
- Responsive purple/lime/lilac theme, visible keyboard focus, and reduced-motion support.
- The shared footer checks backend health on initial load, shows Checking/Connected/Disconnected, and offers Retry after failure. This is separate from WooCommerce/store connectivity and never replaces demo data.

`src/data/dashboard.ts` holds typed demo data. `src/components/` contains navigation, KPI/table/opportunity panels, the chart, and local SVG icons. CSS variables are in `src/index.css`; layout and responsive styles are in `src/App.css`.

WooCommerce credentials stay in the backend. The browser receives only validated product, order, and aggregate dashboard fields. Navigation and preferences use in-memory React state. Revenue opportunities remain illustrative and do not send messages or modify the store. Demo amounts are shown in INR.

The eight-order sample, product catalogue, and derived customer summaries are independent of aggregate reporting KPIs and are not date-filtered. Date selection updates Overview/Analytics KPIs, chart, chart data table, and CSV. The CSV current-period revenue sum matches the selected headline total. The 90-day chart groups revenue into 30 reporting intervals rather than 90 daily rows.

## Backend connection

Development defaults to `http://localhost:4001`. To override it, copy `.env.example` to `.env`, set `VITE_API_BASE_URL` to the backend origin (without `/api`), and restart Vite. `VITE_` variables are public build-time configuration: never put credentials in them.

The client requests `/api/health`, requires `success: true` and `service: "revenuepilot-backend"`, and times out after 8 seconds. HTTP errors, network/CORS failures, invalid JSON, and unexpected response shapes show Disconnected. Retry starts a new check; requests are cancelled on cleanup.

In production, set `VITE_API_BASE_URL` before `npm run build`. If omitted, the built frontend uses same-origin `/api/health`; deploy a matching API reverse proxy. With a separate API origin, configure the backend's `CORS_ORIGINS` with the exact deployed frontend origin. Production CORS has no cross-origin defaults and never uses `*`.
