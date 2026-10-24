import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { KpiGrid, OpportunitiesPanel } from "./Dashboard";
import type { OrderFilters } from "./Dashboard";
import { RevenueChart } from "./RevenueChart";
import { currency, orders } from "../data/dashboard";
import type { RevenuePeriod, ViewName } from "../data/dashboard";
import {
  fetchWooCommerceOrders,
  fetchWooCommerceProducts,
  type WooCommerceOrder,
  type WooCommerceProduct,
} from "../utils/api";
import { Icon } from "./Icon";

interface WorkspaceViewsProps {
  activeView: Exclude<ViewName, "Overview">;
  period: RevenuePeriod;
  filters: OrderFilters;
  onFiltersChange: (filters: OrderFilters) => void;
  workspaceName: string;
  onSaveWorkspace: (name: string) => void;
}

const descriptions: Record<Exclude<ViewName, "Overview">, [string, string]> = {
  Orders: [
    "Every order, in one place.",
    "Review live order activity without exposing customer information.",
  ],
  Products: [
    "Know your product catalogue.",
    "Live products fetched securely from your connected WooCommerce store.",
  ],
  Customers: [
    "Get to know your customers.",
    "Customer summaries derived from the eight demo orders.",
  ],
  "Revenue Recovery": [
    "Find your next growth opportunity.",
    "Explore illustrative recovery suggestions. No campaigns are sent.",
  ],
  Analytics: [
    "Go deeper into your revenue.",
    "Compare demo periods, inspect figures, and export the selected report.",
  ],
  Settings: [
    "Make this workspace yours.",
    "Edit demo preferences for this browser session.",
  ],
  "Help & resources": [
    "A little guidance goes a long way.",
    "Learn how to explore the RevenuePilot demo workspace.",
  ],
};

function ViewIntro({ view }: { view: Exclude<ViewName, "Overview"> }) {
  const [heading, description] = descriptions[view];
  const isLiveStoreView = view === "Products" || view === "Orders";
  return (
    <div className="overview-intro">
      <div>
        <p className="eyebrow">{view.toUpperCase()}</p>
        <h2>{heading}</h2>
        <p>{description}</p>
      </div>
      <div className="demo-indicator">
        <span />
        <strong>{isLiveStoreView ? "Live store" : "Demo workspace"}</strong>
        <span className="demo-divider" />
        {isLiveStoreView ? "WooCommerce" : "Sample data only"}
      </div>
    </div>
  );
}

function formatOrderDate(value: string): string {
  const withTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value)
    ? value
    : `${value}Z`;
  const date = new Date(withTimezone);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatOrderAmount(value: string, currencyCode: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${currencyCode} ${value}`;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currencyCode,
    }).format(amount);
  } catch {
    return `${currencyCode} ${value}`;
  }
}

function orderStatusClass(status: string): string {
  if (status === "completed") return "completed";
  if (["processing", "pending", "on-hold"].includes(status)) {
    return "processing";
  }
  return "refunded";
}

function orderStatusLabel(status: string): string {
  return status
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function LiveOrdersView() {
  const [orders, setOrders] = useState<WooCommerceOrder[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [state, setState] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void fetchWooCommerceOrders(page, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setOrders(response.orders);
        setTotal(response.pagination.total);
        setTotalPages(response.pagination.totalPages);
        setState("success");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, [attempt, page]);

  const normalizedQuery = query.trim().toLowerCase();
  const statuses = Array.from(new Set(orders.map((order) => order.status)));
  const filtered = orders.filter((order) => {
    const searchable = `${order.id} ${order.number} ${order.lineItems
      .map((item) => item.name)
      .join(" ")}`.toLowerCase();
    return (
      searchable.includes(normalizedQuery) &&
      (statusFilter === "all" || order.status === statusFilter)
    );
  });
  const canGoNext =
    totalPages !== null ? page < totalPages : orders.length === 10;

  const changePage = (nextPage: number) => {
    setState("loading");
    setPage(nextPage);
  };

  const retry = () => {
    setState("loading");
    setAttempt((value) => value + 1);
  };

  return (
    <section className="panel orders-panel" aria-labelledby="live-orders-heading">
      <div className="panel-heading">
        <div>
          <h2 id="live-orders-heading">
            Store orders
            {state === "success" && (
              <span className="count-badge">{total ?? orders.length}</span>
            )}
          </h2>
          <p>Read-only order details from WooCommerce. Customer data is excluded.</p>
        </div>
      </div>

      {state === "loading" && (
        <div className="products-state" role="status" aria-live="polite">
          <span className="products-loader" aria-hidden="true" />
          <strong>Loading store orders…</strong>
          <p>Fetching page {page} securely from WooCommerce.</p>
        </div>
      )}

      {state === "error" && (
        <div className="products-state products-error" role="alert">
          <Icon name="info" size={20} />
          <strong>Orders couldn’t be loaded</strong>
          <p>Check the backend connection and WooCommerce key permissions.</p>
          <button className="secondary-button" onClick={retry}>
            Retry orders
          </button>
        </div>
      )}

      {state === "success" && orders.length === 0 && (
        <div className="products-state" role="status">
          <Icon name="bag" size={22} />
          <strong>{page === 1 ? "No orders found" : "No orders on this page"}</strong>
          <p>
            {page === 1
              ? "Your connected WooCommerce store returned no orders."
              : "Return to the previous page to continue browsing orders."}
          </p>
          {page > 1 && (
            <button className="secondary-button" onClick={() => changePage(page - 1)}>
              Previous page
            </button>
          )}
        </div>
      )}

      {state === "success" && orders.length > 0 && (
        <>
          <div className="table-tools">
            <label className="table-search">
              <Icon name="search" size={16} />
              <span className="sr-only">Search live orders</span>
              <input
                type="search"
                placeholder="Search order or product..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="status-filter">
              <span className="sr-only">Filter live orders by status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                {statuses.map((status) => (
                  <option value={status} key={status}>
                    {orderStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Live WooCommerce orders"
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Date</th>
                  <th scope="col">Items</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="amount-column">Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr key={order.id}>
                    <td className="order-id">
                      {order.number.startsWith("#") ? order.number : `#${order.number}`}
                    </td>
                    <td className="order-date">{formatOrderDate(order.date)}</td>
                    <td>
                      <div className="line-items-cell">
                        {order.lineItems.map((item) => (
                          <span key={`${order.id}-${item.productId}-${item.name}`}>
                            <strong>{item.name}</strong> × {item.quantity}
                            <small>{formatOrderAmount(item.price, order.currency)} each</small>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill ${orderStatusClass(order.status)}`}>
                        <span />
                        {orderStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="order-amount">
                      {formatOrderAmount(order.total, order.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="empty-state">
                <Icon name="search" size={25} />
                <strong>No matching orders</strong>
                <p>Try another order number, product name, or status.</p>
                <button
                  className="text-button"
                  onClick={() => {
                    setQuery("");
                    setStatusFilter("all");
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
          <div className="table-footer live-orders-footer">
            <span>
              Page {page}
              {total !== null ? ` · ${total} total orders` : ""}
            </span>
            <div className="pagination-controls" aria-label="Order pages">
              <button
                className="secondary-button"
                disabled={page === 1}
                onClick={() => changePage(page - 1)}
              >
                Previous
              </button>
              <span aria-current="page">{page}</span>
              <button
                className="secondary-button"
                disabled={!canGoNext}
                onClick={() => changePage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function ProductsView() {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<WooCommerceProduct[]>([]);
  const [state, setState] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void fetchWooCommerceProducts(controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setProducts(response.products);
        setState("success");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, [attempt]);

  const filtered = products.filter((product) =>
    `${product.name} ${product.sku} ${product.stockStatus}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  const retry = () => {
    setState("loading");
    setAttempt((value) => value + 1);
  };

  return (
    <section className="panel" aria-labelledby="products-heading">
      <div className="panel-heading">
        <div>
          <h2 id="products-heading">
            Store catalogue
            {state === "success" && (
              <span className="count-badge">{products.length}</span>
            )}
          </h2>
          <p>Read-only product data from your WooCommerce store.</p>
        </div>
      </div>
      {state === "loading" && (
        <div className="products-state" role="status" aria-live="polite">
          <span className="products-loader" aria-hidden="true" />
          <strong>Loading store products…</strong>
          <p>Connecting securely to WooCommerce.</p>
        </div>
      )}
      {state === "error" && (
        <div className="products-state products-error" role="alert">
          <Icon name="info" size={20} />
          <strong>Products couldn’t be loaded</strong>
          <p>Check the backend connection, then try again.</p>
          <button className="secondary-button" onClick={retry}>
            Retry products
          </button>
        </div>
      )}
      {state === "success" && products.length === 0 && (
        <div className="products-state" role="status">
          <Icon name="store" size={22} />
          <strong>No products found</strong>
          <p>Your connected WooCommerce store returned an empty catalogue.</p>
        </div>
      )}
      {state === "success" && products.length > 0 && (
        <>
          <div className="table-tools">
            <label className="table-search">
              <Icon name="search" size={16} />
              <span className="sr-only">Search store products</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products..."
              />
            </label>
          </div>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="WooCommerce products"
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">SKU</th>
                  <th scope="col">Stock</th>
                  <th scope="col">Price</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="product-cell">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt=""
                            width="42"
                            height="42"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="product-image-fallback" aria-hidden="true">
                            <Icon name="store" size={17} />
                          </span>
                        )}
                        <strong>{product.name}</strong>
                      </div>
                    </td>
                    <td>{product.sku || "—"}</td>
                    <td>
                      <span
                        className={`status-pill ${product.stockStatus === "instock" ? "completed" : product.stockStatus === "onbackorder" ? "processing" : "refunded"}`}
                      >
                        {product.stockStatus === "instock"
                          ? "In stock"
                          : product.stockStatus === "onbackorder"
                            ? "On backorder"
                            : "Out of stock"}
                      </span>
                    </td>
                    <td className="order-amount">{product.price || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && (
              <div className="empty-state">
                <strong>No matching products</strong>
                <button className="text-button" onClick={() => setQuery("")}>
                  Clear product search
                </button>
              </div>
            )}
          </div>
          <div className="table-footer">
            Showing {filtered.length} of {products.length} live products
          </div>
        </>
      )}
    </section>
  );
}

function CustomersView() {
  const [query, setQuery] = useState("");
  // Derive customer figures from the local order sample instead of inventing totals.
  const customers = Array.from(new Set(orders.map((order) => order.email)))
    .map((email) => {
      const purchases = orders.filter((order) => order.email === email);
      const customer = purchases[0];
      const netSpend = purchases
        .filter((order) => order.status !== "Refunded")
        .reduce((sum, order) => sum + order.amount, 0);
      return { ...customer, orderCount: purchases.length, netSpend };
    })
    .filter((customer) =>
      `${customer.customer} ${customer.email}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    );
  return (
    <section className="panel" aria-labelledby="customers-heading">
      <div className="panel-heading">
        <div>
          <h2 id="customers-heading">Demo customers</h2>
          <p>
            Sample order counts and net order value, excluding refunds.
            Processing orders are included.
          </p>
        </div>
      </div>
      <div className="table-tools">
        <label className="table-search">
          <Icon name="search" size={16} />
          <span className="sr-only">Search demo customers</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search customers..."
          />
        </label>
      </div>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Demo customers"
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Customer</th>
              <th scope="col">Email</th>
              <th scope="col">Sample orders</th>
              <th scope="col">Net order value (INR)</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.email}>
                <td>
                  <div className="customer-cell">
                    <span
                      className={`customer-avatar ${customer.tone}`}
                      aria-hidden="true"
                    >
                      {customer.initials}
                    </span>
                    <strong>{customer.customer}</strong>
                  </div>
                </td>
                <td>{customer.email}</td>
                <td>{customer.orderCount}</td>
                <td className="order-amount">{currency(customer.netSpend)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!customers.length && (
          <div className="empty-state">
            <strong>No matching customers</strong>
            <button className="text-button" onClick={() => setQuery("")}>
              Clear customer search
            </button>
          </div>
        )}
      </div>
      <div className="table-footer">
        {customers.length} demo customers shown
      </div>
    </section>
  );
}

function SettingsView({
  workspaceName,
  onSave,
}: {
  workspaceName: string;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(workspaceName);
  const [saved, setSaved] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setName(trimmed);
    onSave(trimmed);
    setSaved(true);
  }
  return (
    <section
      className="panel settings-panel"
      aria-labelledby="settings-heading"
    >
      <div className="panel-heading">
        <div>
          <h2 id="settings-heading">Demo workspace preferences</h2>
          <p>
            Changes remain available while you navigate. Refreshing the page
            resets them.
          </p>
        </div>
      </div>
      <form className="settings-form" onSubmit={submit}>
        <label htmlFor="workspace-name">Workspace name</label>
        <input
          id="workspace-name"
          value={name}
          maxLength={40}
          minLength={1}
          required
          pattern=".*\S.*"
          title="Enter a workspace name with at least one non-space character."
          onChange={(event) => {
            setName(event.target.value);
            setSaved(false);
          }}
        />
        <p>
          Up to 40 characters. This name appears in the sidebar and profile.
        </p>
        <label htmlFor="workspace-currency">Reporting currency</label>
        <input
          id="workspace-currency"
          value="INR — Indian Rupee"
          readOnly
          aria-describedby="currency-help"
        />
        <p id="currency-help">
          The demo dataset uses INR. Currency conversion is not available.
        </p>
        <div className="connection-summary">
          <Icon name="store" size={20} />
          <div>
            <strong>Demo mode</strong>
            <p>No WooCommerce store is connected.</p>
          </div>
        </div>
        <button className="primary-button" type="submit">
          Save demo settings
          <Icon name="check" size={16} />
        </button>
        <p role="status">{saved ? "Settings saved for this session." : ""}</p>
      </form>
    </section>
  );
}

function HelpView() {
  return (
    <section className="panel help-panel" aria-labelledby="help-heading">
      <div className="panel-heading">
        <div>
          <h2 id="help-heading">Exploring the demo</h2>
          <p>All figures are sample data, not live business activity.</p>
        </div>
      </div>
      <div className="help-items">
        <details open>
          <summary>How do reporting periods work?</summary>
          <p>
            Choose Last 7, 30, or 90 days in the header. Overview and Analytics
            share the selected range. Their KPIs, chart, data table, and CSV use
            the same demo dataset, ending October 23, 2026.
          </p>
        </details>
        <details>
          <summary>How do I search and filter orders?</summary>
          <p>
            Search by order ID or customer name, then choose a status. Both
            filters apply together. View all orders opens the full eight-order
            sample; it is independent of aggregate reporting totals.
          </p>
        </details>
        <details>
          <summary>What does the export contain?</summary>
          <p>
            Export report downloads the selected period's revenue and
            previous-period comparison as a CSV. Amounts are INR, and the
            current revenue column sums to the displayed revenue total.
          </p>
        </details>
        <details>
          <summary>Will recovery suggestions contact customers?</summary>
          <p>
            No. Opportunity buttons open illustrative details only. No messages
            are sent, no products are changed, and no live services are
            connected.
          </p>
        </details>
      </div>
    </section>
  );
}

export function WorkspaceViews({
  activeView,
  period,
  workspaceName,
  onSaveWorkspace,
}: WorkspaceViewsProps) {
  return (
    <>
      <ViewIntro view={activeView} />
      {activeView === "Orders" && <LiveOrdersView />}
      {activeView === "Products" && <ProductsView />}
      {activeView === "Customers" && <CustomersView />}
      {activeView === "Revenue Recovery" && (
        <div className="recovery-view">
          <OpportunitiesPanel />
        </div>
      )}
      {activeView === "Analytics" && (
        <>
          <KpiGrid period={period} />
          <RevenueChart period={period} />
        </>
      )}
      {activeView === "Settings" && (
        <SettingsView workspaceName={workspaceName} onSave={onSaveWorkspace} />
      )}
      {activeView === "Help & resources" && <HelpView />}
    </>
  );
}
