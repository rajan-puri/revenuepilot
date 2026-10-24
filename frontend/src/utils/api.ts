const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  (import.meta.env.DEV ? "http://localhost:4001" : "")
).replace(/\/+$/, "");

interface RequestOptions {
  signal?: AbortSignal;
}

/** Validate response data at runtime; a TypeScript cast alone cannot validate an API. */
export async function requestJson<T>(
  path: string,
  validate: (value: unknown) => value is T,
  { signal }: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
  const timeout = window.setTimeout(cancel, 8000);

  try {
    const response = await fetch(`${apiBaseUrl}/${path.replace(/^\/+/, "")}`, {
      signal: controller.signal,
      cache: "no-store",
      credentials: "omit",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("API request failed.");
    const data: unknown = await response.json();
    if (!validate(data)) throw new Error("Invalid API response.");
    return data;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}

export interface HealthResponse {
  success: true;
  service: "revenuepilot-backend";
}

function isHealthResponse(value: unknown): value is HealthResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    value.success === true &&
    "service" in value &&
    value.service === "revenuepilot-backend"
  );
}

export function checkBackendHealth(
  signal?: AbortSignal,
): Promise<HealthResponse> {
  return requestJson("/api/health", isHealthResponse, { signal });
}

export interface WooCommerceProduct {
  id: number;
  name: string;
  sku: string;
  price: string;
  stockStatus: string;
  image: string | null;
}

export interface ProductsResponse {
  success: true;
  products: WooCommerceProduct[];
  pagination: {
    page: number;
    perPage: number;
    total: number | null;
    totalPages: number | null;
  };
}

function isProduct(value: unknown): value is WooCommerceProduct {
  if (typeof value !== "object" || value === null) return false;
  const product = value as Record<string, unknown>;
  return (
    typeof product.id === "number" &&
    Number.isSafeInteger(product.id) &&
    product.id > 0 &&
    typeof product.name === "string" &&
    typeof product.sku === "string" &&
    typeof product.price === "string" &&
    typeof product.stockStatus === "string" &&
    (product.image === null || typeof product.image === "string")
  );
}

function isProductsResponse(value: unknown): value is ProductsResponse {
  if (typeof value !== "object" || value === null) return false;
  const response = value as Record<string, unknown>;
  if (response.success !== true || !Array.isArray(response.products)) {
    return false;
  }
  if (typeof response.pagination !== "object" || response.pagination === null) {
    return false;
  }
  const pagination = response.pagination as Record<string, unknown>;
  return (
    response.products.every(isProduct) &&
    typeof pagination.page === "number" &&
    typeof pagination.perPage === "number" &&
    (pagination.total === null || typeof pagination.total === "number") &&
    (pagination.totalPages === null || typeof pagination.totalPages === "number")
  );
}

export function fetchWooCommerceProducts(
  signal?: AbortSignal,
): Promise<ProductsResponse> {
  return requestJson("/api/products?perPage=20", isProductsResponse, { signal });
}

export interface WooCommerceOrderLineItem {
  productId: number;
  name: string;
  quantity: number;
  price: string;
}

export interface WooCommerceOrder {
  id: number;
  number: string;
  date: string;
  status: string;
  currency: string;
  total: string;
  lineItems: WooCommerceOrderLineItem[];
}

export interface OrdersResponse {
  success: true;
  orders: WooCommerceOrder[];
  pagination: {
    page: number;
    perPage: number;
    total: number | null;
    totalPages: number | null;
  };
}

function isOrderLineItem(value: unknown): value is WooCommerceOrderLineItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.productId === "number" &&
    Number.isSafeInteger(item.productId) &&
    item.productId >= 0 &&
    typeof item.name === "string" &&
    typeof item.quantity === "number" &&
    Number.isSafeInteger(item.quantity) &&
    item.quantity > 0 &&
    typeof item.price === "string"
  );
}

function isOrder(value: unknown): value is WooCommerceOrder {
  if (typeof value !== "object" || value === null) return false;
  const order = value as Record<string, unknown>;
  return (
    typeof order.id === "number" &&
    Number.isSafeInteger(order.id) &&
    order.id > 0 &&
    typeof order.number === "string" &&
    typeof order.date === "string" &&
    typeof order.status === "string" &&
    typeof order.currency === "string" &&
    /^[A-Z]{3}$/.test(order.currency) &&
    typeof order.total === "string" &&
    Array.isArray(order.lineItems) &&
    order.lineItems.every(isOrderLineItem)
  );
}

function isOrdersResponse(value: unknown): value is OrdersResponse {
  if (typeof value !== "object" || value === null) return false;
  const response = value as Record<string, unknown>;
  if (response.success !== true || !Array.isArray(response.orders)) return false;
  if (typeof response.pagination !== "object" || response.pagination === null) {
    return false;
  }
  const pagination = response.pagination as Record<string, unknown>;
  return (
    response.orders.every(isOrder) &&
    typeof pagination.page === "number" &&
    typeof pagination.perPage === "number" &&
    (pagination.total === null || typeof pagination.total === "number") &&
    (pagination.totalPages === null || typeof pagination.totalPages === "number")
  );
}

export function fetchWooCommerceOrders(
  page: number,
  signal?: AbortSignal,
): Promise<OrdersResponse> {
  return requestJson(
    `/api/orders?page=${encodeURIComponent(String(page))}&perPage=10`,
    isOrdersResponse,
    { signal },
  );
}

export interface DashboardDailyPoint {
  date: string;
  orderCount: number;
  salesOrderCount: number;
  grossSales: number;
}

export interface DashboardSummary {
  range: { start: string; endExclusive: string; days: number };
  currency: string | null;
  totalOrders: number;
  salesOrderCount: number;
  grossSales: number;
  averageOrderValue: number;
  statusCounts: Record<string, number>;
  daily: DashboardDailyPoint[];
  salesStatuses: string[];
}

export interface DashboardSummaryResponse {
  success: true;
  summary: DashboardSummary;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isDashboardDailyPoint(value: unknown): value is DashboardDailyPoint {
  if (typeof value !== "object" || value === null) return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.date === "string" &&
    isFiniteNumber(point.orderCount) &&
    isFiniteNumber(point.salesOrderCount) &&
    isFiniteNumber(point.grossSales)
  );
}

function isDashboardSummaryResponse(
  value: unknown,
): value is DashboardSummaryResponse {
  if (typeof value !== "object" || value === null) return false;
  const response = value as Record<string, unknown>;
  if (response.success !== true || typeof response.summary !== "object" || response.summary === null) {
    return false;
  }
  const summary = response.summary as Record<string, unknown>;
  return (
    (summary.currency === null || typeof summary.currency === "string") &&
    isFiniteNumber(summary.totalOrders) &&
    isFiniteNumber(summary.salesOrderCount) &&
    isFiniteNumber(summary.grossSales) &&
    isFiniteNumber(summary.averageOrderValue) &&
    typeof summary.statusCounts === "object" &&
    summary.statusCounts !== null &&
    Array.isArray(summary.daily) &&
    summary.daily.every(isDashboardDailyPoint) &&
    Array.isArray(summary.salesStatuses) &&
    summary.salesStatuses.every((status) => typeof status === "string") &&
    typeof summary.range === "object" &&
    summary.range !== null
  );
}

export function fetchDashboardSummary(
  period: "7d" | "30d" | "90d",
  signal?: AbortSignal,
): Promise<DashboardSummaryResponse> {
  return requestJson(
    `/api/dashboard-summary?period=${encodeURIComponent(period)}`,
    isDashboardSummaryResponse,
    { signal },
  );
}
