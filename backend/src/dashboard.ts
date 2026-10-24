import type { WooCommerceOrder } from "./woocommerce.js";

export const SALES_ORDER_STATUSES = [
  "completed",
  "processing",
  "on-hold",
] as const;

const salesStatuses = new Set<string>(SALES_ORDER_STATUSES);

export class DashboardCurrencyError extends Error {
  override readonly name = "DashboardCurrencyError";
}

export interface DashboardSummary {
  readonly range: {
    readonly start: string;
    readonly endExclusive: string;
    readonly days: number;
  };
  readonly currency: string | null;
  readonly totalOrders: number;
  readonly salesOrderCount: number;
  readonly grossSales: number;
  readonly averageOrderValue: number;
  readonly statusCounts: Readonly<Record<string, number>>;
  readonly daily: readonly {
    readonly date: string;
    readonly orderCount: number;
    readonly salesOrderCount: number;
    readonly grossSales: number;
  }[];
  readonly salesStatuses: readonly string[];
}

function dateFromWooCommerce(value: string): Date {
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value)
    ? value
    : `${value}Z`;
  return new Date(normalized);
}

function money(value: string): number {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) {
    throw new Error("WooCommerce returned an invalid order total.");
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("WooCommerce returned an invalid order total.");
  }
  return parsed;
}

function rounded(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

export function calculateDashboardSummary(
  orders: readonly WooCommerceOrder[],
  start: Date,
  endExclusive: Date,
): DashboardSummary {
  const startTime = start.getTime();
  const endTime = endExclusive.getTime();
  const days = Math.round((endTime - startTime) / 86_400_000);
  if (
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime) ||
    startTime >= endTime ||
    days < 1
  ) {
    throw new Error("Invalid dashboard date range.");
  }

  const filtered = orders.filter((order) => {
    const timestamp = dateFromWooCommerce(order.date).getTime();
    return Number.isFinite(timestamp) && timestamp >= startTime && timestamp < endTime;
  });
  const salesOrders = filtered.filter((order) => salesStatuses.has(order.status));
  const currencies = new Set(salesOrders.map((order) => order.currency));
  if (currencies.size > 1) {
    throw new DashboardCurrencyError(
      "Dashboard sales cannot combine multiple currencies.",
    );
  }
  const currency = currencies.values().next().value ?? null;
  const grossSales = rounded(
    salesOrders.reduce((sum, order) => sum + money(order.total), 0),
  );
  const statusCounts: Record<string, number> = {};
  for (const order of filtered) {
    statusCounts[order.status] = (statusCounts[order.status] ?? 0) + 1;
  }

  const daily = Array.from({ length: days }, (_, index) => {
    const dayStart = startTime + index * 86_400_000;
    const dayEnd = dayStart + 86_400_000;
    const dayOrders = filtered.filter((order) => {
      const timestamp = dateFromWooCommerce(order.date).getTime();
      return timestamp >= dayStart && timestamp < dayEnd;
    });
    const daySalesOrders = dayOrders.filter((order) =>
      salesStatuses.has(order.status),
    );
    return {
      date: new Date(dayStart).toISOString().slice(0, 10),
      orderCount: dayOrders.length,
      salesOrderCount: daySalesOrders.length,
      grossSales: rounded(
        daySalesOrders.reduce((sum, order) => sum + money(order.total), 0),
      ),
    };
  });

  return {
    range: {
      start: start.toISOString(),
      endExclusive: endExclusive.toISOString(),
      days,
    },
    currency,
    totalOrders: filtered.length,
    salesOrderCount: salesOrders.length,
    grossSales,
    averageOrderValue:
      salesOrders.length === 0 ? 0 : rounded(grossSales / salesOrders.length),
    statusCounts,
    daily,
    salesStatuses: SALES_ORDER_STATUSES,
  };
}
