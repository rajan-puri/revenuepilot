import express from "express";
import type { ErrorRequestHandler } from "express";
import { cors } from "./cors.js";
import {
  calculateDashboardSummary,
  DashboardCurrencyError,
} from "./dashboard.js";
import {
  loadWooCommerceConfig,
  WooCommerceClient,
  WooCommerceConfigurationError,
  WooCommerceRequestError,
  type WooCommerceOrdersPage,
  type WooCommerceProductsPage,
} from "./woocommerce.js";

interface ProductsSource {
  fetchProducts(page: number, perPage: number): Promise<WooCommerceProductsPage>;
}

interface OrdersSource {
  fetchOrders(page: number, perPage: number): Promise<WooCommerceOrdersPage>;
}

interface DashboardOrdersSource {
  fetchOrdersInRange(
    start: Date,
    endExclusive: Date,
  ): Promise<readonly import("./woocommerce.js").WooCommerceOrder[]>;
}

interface AppDependencies {
  readonly wooCommerceClient?: ProductsSource;
  readonly ordersSource?: OrdersSource;
  readonly dashboardOrdersSource?: DashboardOrdersSource;
  readonly now?: () => Date;
}

function parsePositiveInteger(value: unknown, fallback: number): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function createApp({
  wooCommerceClient,
  ordersSource,
  dashboardOrdersSource,
  now = () => new Date(),
}: AppDependencies = {}) {
  const application = express();
  let configuredClient: WooCommerceClient | undefined;
  const getClient = () =>
    (configuredClient ??= new WooCommerceClient(loadWooCommerceConfig()));

  application.disable("x-powered-by");
  application.use(cors);
  application.use(express.json({ limit: "100kb" }));

  application.get("/api/health", (_request, response) => {
    response.status(200).json({
      success: true,
      service: "revenuepilot-backend",
    });
  });

  application.get("/api/products", async (request, response) => {
    const page = parsePositiveInteger(request.query.page, 1);
    const perPage = parsePositiveInteger(request.query.perPage, 20);
    if (page === null || perPage === null || perPage > 20) {
      response.status(400).json({
        success: false,
        error: "Invalid product pagination.",
      });
      return;
    }

    try {
      const result = await (wooCommerceClient ?? getClient()).fetchProducts(
        page,
        perPage,
      );
      response.status(200).json({
        success: true,
        products: result.products.map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          price: product.price,
          stockStatus: product.stockStatus,
          image: product.image,
        })),
        pagination: {
          page: result.page,
          perPage: result.perPage,
          total: result.total ?? null,
          totalPages: result.totalPages ?? null,
        },
      });
    } catch (error) {
      const unavailable =
        error instanceof WooCommerceConfigurationError ||
        error instanceof WooCommerceRequestError;
      response.status(unavailable ? 502 : 500).json({
        success: false,
        error: unavailable
          ? "WooCommerce products are temporarily unavailable."
          : "Internal server error",
      });
    }
  });

  application.get("/api/orders", async (request, response) => {
    const page = parsePositiveInteger(request.query.page, 1);
    const perPage = parsePositiveInteger(request.query.perPage, 10);
    if (page === null || perPage === null || perPage > 20) {
      response.status(400).json({
        success: false,
        error: "Invalid order pagination.",
      });
      return;
    }

    try {
      const result = await (ordersSource ?? getClient()).fetchOrders(
        page,
        perPage,
      );
      response.status(200).json({
        success: true,
        orders: result.orders.map((order) => ({
          id: order.id,
          number: order.number,
          date: order.date,
          status: order.status,
          currency: order.currency,
          total: order.total,
          lineItems: order.lineItems.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
          })),
        })),
        pagination: {
          page: result.page,
          perPage: result.perPage,
          total: result.total ?? null,
          totalPages: result.totalPages ?? null,
        },
      });
    } catch (error) {
      const unavailable =
        error instanceof WooCommerceConfigurationError ||
        error instanceof WooCommerceRequestError;
      response.status(unavailable ? 502 : 500).json({
        success: false,
        error: unavailable
          ? "WooCommerce orders are temporarily unavailable."
          : "Internal server error",
      });
    }
  });

  application.get("/api/dashboard-summary", async (request, response) => {
    const period = request.query.period;
    const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : null;
    if (days === null) {
      response.status(400).json({
        success: false,
        error: "Invalid dashboard period.",
      });
      return;
    }

    const current = now();
    const endExclusive = new Date(
      Date.UTC(
        current.getUTCFullYear(),
        current.getUTCMonth(),
        current.getUTCDate() + 1,
      ),
    );
    const start = new Date(endExclusive.getTime() - days * 86_400_000);

    try {
      const orders = await (
        dashboardOrdersSource ?? getClient()
      ).fetchOrdersInRange(start, endExclusive);
      response.status(200).json({
        success: true,
        summary: calculateDashboardSummary(orders, start, endExclusive),
      });
    } catch (error) {
      if (error instanceof DashboardCurrencyError) {
        response.status(422).json({
          success: false,
          error: "Dashboard cannot combine orders in multiple currencies.",
        });
        return;
      }
      const unavailable =
        error instanceof WooCommerceConfigurationError ||
        error instanceof WooCommerceRequestError;
      response.status(unavailable ? 502 : 500).json({
        success: false,
        error: unavailable
          ? "WooCommerce dashboard data is temporarily unavailable."
          : "Internal server error",
      });
    }
  });

  application.use((_request, response) => {
    response.status(404).json({ success: false, error: "Not found" });
  });

// Keep parser errors useful without exposing stack traces or request content.
const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? error.status
      : undefined;

  if (status === 400) {
    response
      .status(400)
      .json({ success: false, error: "Invalid JSON request body" });
    return;
  }

  if (status === 413) {
    response
      .status(413)
      .json({ success: false, error: "Request body too large" });
    return;
  }

  response.status(500).json({ success: false, error: "Internal server error" });
};

  application.use(errorHandler);
  return application;
}

export const app = createApp();
