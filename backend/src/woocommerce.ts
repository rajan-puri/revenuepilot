import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";

const API_RESPONSE_LIMIT_BYTES = 1_000_000;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_SAMPLE_SIZE = 5;
const MAX_PRODUCTS_PAGE_SIZE = 20;
const MAX_ORDERS_PAGE_SIZE = 20;

const blockedAddresses = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedAddresses.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blockedAddresses.addSubnet(network, prefix, "ipv6");
}

export class WooCommerceConfigurationError extends Error {
  override readonly name = "WooCommerceConfigurationError";
}

export type WooCommerceDiagnosticCategory =
  | "SECURITY"
  | "DNS"
  | "NETWORK_TLS"
  | "REDIRECT"
  | "AUTHENTICATION"
  | "PERMISSIONS"
  | "REST_API_NOT_FOUND"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "HTTP_ERROR"
  | "INVALID_RESPONSE"
  | "INVALID_INPUT";

export class WooCommerceRequestError extends Error {
  override readonly name = "WooCommerceRequestError";

  constructor(
    readonly category: WooCommerceDiagnosticCategory,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export interface WooCommerceConfig {
  readonly storeUrl: URL;
  readonly consumerKey: string;
  readonly consumerSecret: string;
}

export interface WooCommerceProductSample {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
  readonly status: string;
  readonly sku: string;
  readonly price: string;
  readonly stockStatus: string;
  readonly dateModifiedGmt: string | null;
  readonly image: string | null;
}

export interface WooCommerceProductsPage {
  readonly products: readonly WooCommerceProductSample[];
  readonly page: number;
  readonly perPage: number;
  readonly total?: number;
  readonly totalPages?: number;
}

export interface WooCommerceOrderLineItem {
  readonly productId: number;
  readonly name: string;
  readonly quantity: number;
  readonly price: string;
}

export interface WooCommerceOrder {
  readonly id: number;
  readonly number: string;
  readonly date: string;
  readonly status: string;
  readonly currency: string;
  readonly total: string;
  readonly lineItems: readonly WooCommerceOrderLineItem[];
}

export interface WooCommerceOrdersPage {
  readonly orders: readonly WooCommerceOrder[];
  readonly page: number;
  readonly perPage: number;
  readonly total?: number;
  readonly totalPages?: number;
}

interface TransportResponse {
  readonly status: number;
  readonly body: unknown;
  readonly total?: number;
  readonly totalPages?: number;
}

export interface WooCommerceTransport {
  getJson(url: URL, authorization: string): Promise<TransportResponse>;
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    normalized.endsWith(".home") ||
    normalized.endsWith(".lan")
  );
}

function normalizeHostname(hostname: string): string {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return normalized.startsWith("[") && normalized.endsWith("]")
    ? normalized.slice(1, -1)
    : normalized;
}

function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return blockedAddresses.check(address, "ipv4");
  if (family !== 6) return true;

  const mappedIpv4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address)?.[1];
  if (mappedIpv4) return isBlockedAddress(mappedIpv4);
  return blockedAddresses.check(address, "ipv6");
}

export function validateWooCommerceStoreUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new WooCommerceConfigurationError(
      "WOOCOMMERCE_STORE_URL must be a valid absolute URL.",
    );
  }

  if (url.protocol !== "https:") {
    throw new WooCommerceConfigurationError(
      "WOOCOMMERCE_STORE_URL must use HTTPS.",
    );
  }
  if (url.username || url.password) {
    throw new WooCommerceConfigurationError(
      "WOOCOMMERCE_STORE_URL must not contain credentials.",
    );
  }
  if (url.search || url.hash) {
    throw new WooCommerceConfigurationError(
      "WOOCOMMERCE_STORE_URL must not contain a query string or fragment.",
    );
  }
  if (isBlockedHostname(url.hostname)) {
    throw new WooCommerceConfigurationError(
      "WOOCOMMERCE_STORE_URL must use a public hostname.",
    );
  }
  const hostname = normalizeHostname(url.hostname);
  if (isIP(hostname) !== 0 && isBlockedAddress(hostname)) {
    throw new WooCommerceConfigurationError(
      "WOOCOMMERCE_STORE_URL must not use a private or reserved address.",
    );
  }

  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url;
}

export function loadWooCommerceConfig(
  environment: NodeJS.ProcessEnv = process.env,
): WooCommerceConfig {
  const storeUrl = environment.WOOCOMMERCE_STORE_URL?.trim();
  const consumerKey = environment.WOOCOMMERCE_CONSUMER_KEY?.trim();
  const consumerSecret = environment.WOOCOMMERCE_CONSUMER_SECRET?.trim();
  const configuredCount = [storeUrl, consumerKey, consumerSecret].filter(
    Boolean,
  ).length;

  if (configuredCount === 0) {
    throw new WooCommerceConfigurationError(
      "WooCommerce is not configured in backend/.env.",
    );
  }
  if (configuredCount !== 3 || !storeUrl || !consumerKey || !consumerSecret) {
    throw new WooCommerceConfigurationError(
      "WooCommerce configuration is incomplete in backend/.env.",
    );
  }
  if (!/^ck_[A-Za-z0-9]{20,}$/.test(consumerKey)) {
    throw new WooCommerceConfigurationError(
      "WOOCOMMERCE_CONSUMER_KEY has an invalid format.",
    );
  }
  if (!/^cs_[A-Za-z0-9]{20,}$/.test(consumerSecret)) {
    throw new WooCommerceConfigurationError(
      "WOOCOMMERCE_CONSUMER_SECRET has an invalid format.",
    );
  }

  return {
    storeUrl: validateWooCommerceStoreUrl(storeUrl),
    consumerKey,
    consumerSecret,
  };
}

function parseHeaderNumber(value: string | string[] | undefined): number | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  if (!first || !/^\d+$/.test(first)) return undefined;
  return Number(first);
}

function httpStatusError(status: number): WooCommerceRequestError {
  if (status >= 300 && status < 400) {
    return new WooCommerceRequestError(
      "REDIRECT",
      "WooCommerce redirected the request.",
      status,
    );
  }
  if (status === 401) {
    return new WooCommerceRequestError(
      "AUTHENTICATION",
      "WooCommerce rejected the API credentials.",
      status,
    );
  }
  if (status === 403) {
    return new WooCommerceRequestError(
      "PERMISSIONS",
      "WooCommerce denied access to the requested endpoint.",
      status,
    );
  }
  if (status === 404) {
    return new WooCommerceRequestError(
      "REST_API_NOT_FOUND",
      "WooCommerce REST API route was not found.",
      status,
    );
  }
  if (status === 429) {
    return new WooCommerceRequestError(
      "RATE_LIMITED",
      "WooCommerce rate-limited the request.",
      status,
    );
  }
  if (status >= 500 && status <= 599) {
    return new WooCommerceRequestError(
      "SERVER_ERROR",
      "WooCommerce or its upstream server returned an error.",
      status,
    );
  }
  return new WooCommerceRequestError(
    "HTTP_ERROR",
    "WooCommerce returned an unsuccessful HTTP status.",
    status,
  );
}

function networkError(error: unknown): WooCommerceRequestError {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  if (["ENOTFOUND", "EAI_AGAIN", "ENODATA"].includes(code)) {
    return new WooCommerceRequestError(
      "DNS",
      "WooCommerce hostname could not be resolved.",
    );
  }
  return new WooCommerceRequestError(
    "NETWORK_TLS",
    "WooCommerce network or TLS connection failed.",
  );
}

export class SecureWooCommerceTransport implements WooCommerceTransport {
  async getJson(url: URL, authorization: string): Promise<TransportResponse> {
    if (url.protocol !== "https:" || isBlockedHostname(url.hostname)) {
      throw new WooCommerceRequestError(
        "SECURITY",
        "WooCommerce destination was rejected.",
      );
    }

    const hostname = normalizeHostname(url.hostname);
    const addressFamily = isIP(hostname);
    let addresses;
    try {
      addresses =
        addressFamily === 0
          ? await lookup(hostname, { all: true, verbatim: true })
          : [{ address: hostname, family: addressFamily }];
    } catch (error) {
      throw networkError(error);
    }
    if (
      addresses.length === 0 ||
      addresses.some(({ address }) => isBlockedAddress(address))
    ) {
      throw new WooCommerceRequestError(
        "SECURITY",
        "WooCommerce hostname did not resolve exclusively to public addresses.",
      );
    }
    const selectedAddress = addresses[0];
    if (!selectedAddress) {
      throw new WooCommerceRequestError(
        "DNS",
        "WooCommerce hostname did not resolve.",
      );
    }

    return await new Promise<TransportResponse>((resolve, reject) => {
      const request = httpsRequest(
        url,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: authorization,
            "User-Agent": "RevenuePilot/0.1 WooCommerce connection check",
          },
          lookup: (_hostname, options, callback) => {
            if (options.all) {
              callback(null, [selectedAddress]);
              return;
            }
            callback(null, selectedAddress.address, selectedAddress.family);
          },
          ...(addressFamily === 0 ? { servername: hostname } : {}),
        },
        (response) => {
          const status = response.statusCode ?? 0;
          if (status >= 300 && status < 400) {
            response.resume();
            reject(httpStatusError(status));
            return;
          }

          const chunks: Buffer[] = [];
          let receivedBytes = 0;
          response.on("data", (chunk: Buffer) => {
            receivedBytes += chunk.length;
            if (receivedBytes > API_RESPONSE_LIMIT_BYTES) {
              request.destroy(
                new WooCommerceRequestError(
                  "INVALID_RESPONSE",
                  "WooCommerce response exceeded the size limit.",
                ),
              );
              return;
            }
            chunks.push(chunk);
          });
          response.on("end", () => {
            if (status !== 200) {
              reject(httpStatusError(status));
              return;
            }
            try {
              resolve({
                status,
                body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
                total: parseHeaderNumber(response.headers["x-wp-total"]),
                totalPages: parseHeaderNumber(
                  response.headers["x-wp-totalpages"],
                ),
              });
            } catch {
              reject(
                new WooCommerceRequestError(
                  "INVALID_RESPONSE",
                  "WooCommerce returned an invalid JSON response.",
                ),
              );
            }
          });
        },
      );

      request.setTimeout(REQUEST_TIMEOUT_MS, () => {
        request.destroy(
          new WooCommerceRequestError(
            "NETWORK_TLS",
            "WooCommerce request timed out.",
          ),
        );
      });
      request.on("error", (error) => {
        reject(
          error instanceof WooCommerceRequestError
            ? error
            : networkError(error),
        );
      });
      request.end();
    });
  }
}

function buildProductsUrl(storeUrl: URL, page: number, perPage: number): URL {
  const url = new URL(storeUrl.href);
  const basePath = url.pathname === "/" ? "" : url.pathname;
  url.pathname = `${basePath}/wp-json/wc/v3/products`;
  url.searchParams.set("context", "view");
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set(
    "_fields",
    "id,name,slug,status,sku,price,stock_status,date_modified_gmt,images",
  );
  return url;
}

function buildOrdersUrl(
  storeUrl: URL,
  page: number,
  perPage: number,
  range?: { readonly start: Date; readonly endExclusive: Date },
): URL {
  const url = new URL(storeUrl.href);
  const basePath = url.pathname === "/" ? "" : url.pathname;
  url.pathname = `${basePath}/wp-json/wc/v3/orders`;
  url.searchParams.set("context", "view");
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("orderby", "date");
  url.searchParams.set("order", "desc");
  if (range) {
    url.searchParams.set(
      "after",
      new Date(range.start.getTime() - 1_000).toISOString(),
    );
    url.searchParams.set("before", range.endExclusive.toISOString());
    url.searchParams.set("dates_are_gmt", "true");
  }
  url.searchParams.set(
    "_fields",
    "id,number,date_created_gmt,status,currency,total,line_items",
  );
  return url;
}

function readString(product: Record<string, unknown>, field: string): string {
  const value = product[field];
  if (typeof value !== "string") {
    throw new WooCommerceRequestError(
      "INVALID_RESPONSE",
      "WooCommerce returned an unexpected product response.",
    );
  }
  return value;
}

function readProductImage(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const first = value[0];
  if (typeof first !== "object" || first === null || !("src" in first)) {
    return null;
  }
  const source = first.src;
  if (typeof source !== "string") return null;

  try {
    const url = new URL(source);
    const hostname = normalizeHostname(url.hostname);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      isBlockedHostname(hostname) ||
      (isIP(hostname) !== 0 && isBlockedAddress(hostname))
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

function parseProduct(value: unknown): WooCommerceProductSample {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new WooCommerceRequestError(
      "INVALID_RESPONSE",
      "WooCommerce returned an unexpected product response.",
    );
  }
  const product = value as Record<string, unknown>;
  if (!Number.isSafeInteger(product.id) || Number(product.id) < 1) {
    throw new WooCommerceRequestError(
      "INVALID_RESPONSE",
      "WooCommerce returned an unexpected product response.",
    );
  }
  const modified = product.date_modified_gmt;
  if (modified !== null && typeof modified !== "string") {
    throw new WooCommerceRequestError(
      "INVALID_RESPONSE",
      "WooCommerce returned an unexpected product response.",
    );
  }

  return {
    id: Number(product.id),
    name: readString(product, "name"),
    slug: readString(product, "slug"),
    status: readString(product, "status"),
    sku: readString(product, "sku"),
    price: readString(product, "price"),
    stockStatus: readString(product, "stock_status"),
    dateModifiedGmt: modified,
    image: readProductImage(product.images),
  };
}

function parseOrderLineItem(value: unknown): WooCommerceOrderLineItem {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new WooCommerceRequestError(
      "INVALID_RESPONSE",
      "WooCommerce returned an unexpected order response.",
    );
  }
  const item = value as Record<string, unknown>;
  if (
    !Number.isSafeInteger(item.product_id) ||
    Number(item.product_id) < 0 ||
    !Number.isSafeInteger(item.quantity) ||
    Number(item.quantity) < 1 ||
    typeof item.name !== "string" ||
    typeof item.price !== "string"
  ) {
    throw new WooCommerceRequestError(
      "INVALID_RESPONSE",
      "WooCommerce returned an unexpected order response.",
    );
  }
  return {
    productId: Number(item.product_id),
    name: item.name,
    quantity: Number(item.quantity),
    price: item.price,
  };
}

function parseOrder(value: unknown): WooCommerceOrder {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new WooCommerceRequestError(
      "INVALID_RESPONSE",
      "WooCommerce returned an unexpected order response.",
    );
  }
  const order = value as Record<string, unknown>;
  if (
    !Number.isSafeInteger(order.id) ||
    Number(order.id) < 1 ||
    typeof order.number !== "string" ||
    typeof order.date_created_gmt !== "string" ||
    typeof order.status !== "string" ||
    typeof order.currency !== "string" ||
    !/^[A-Z]{3}$/.test(order.currency) ||
    typeof order.total !== "string" ||
    !Array.isArray(order.line_items)
  ) {
    throw new WooCommerceRequestError(
      "INVALID_RESPONSE",
      "WooCommerce returned an unexpected order response.",
    );
  }
  return {
    id: Number(order.id),
    number: order.number,
    date: order.date_created_gmt,
    status: order.status,
    currency: order.currency,
    total: order.total,
    lineItems: order.line_items.map(parseOrderLineItem),
  };
}

export class WooCommerceClient {
  readonly #authorization: string;

  constructor(
    private readonly config: WooCommerceConfig,
    private readonly transport: WooCommerceTransport =
      new SecureWooCommerceTransport(),
  ) {
    this.#authorization = `Basic ${Buffer.from(
      `${config.consumerKey}:${config.consumerSecret}`,
      "utf8",
    ).toString("base64")}`;
  }

  async fetchProducts(
    page = 1,
    perPage = MAX_PRODUCTS_PAGE_SIZE,
  ): Promise<WooCommerceProductsPage> {
    if (!Number.isInteger(page) || page < 1) {
      throw new WooCommerceRequestError(
        "INVALID_INPUT",
        "WooCommerce page must be positive.",
      );
    }
    if (
      !Number.isInteger(perPage) ||
      perPage < 1 ||
      perPage > MAX_PRODUCTS_PAGE_SIZE
    ) {
      throw new WooCommerceRequestError(
        "INVALID_INPUT",
        `WooCommerce page size must be between 1 and ${MAX_PRODUCTS_PAGE_SIZE}.`,
      );
    }

    const response = await this.transport.getJson(
      buildProductsUrl(this.config.storeUrl, page, perPage),
      this.#authorization,
    );
    if (response.status !== 200 || !Array.isArray(response.body)) {
      if (response.status !== 200) throw httpStatusError(response.status);
      throw new WooCommerceRequestError(
        "INVALID_RESPONSE",
        "WooCommerce returned an unexpected products response.",
      );
    }

    return {
      products: response.body.map(parseProduct),
      page,
      perPage,
      ...(response.total === undefined ? {} : { total: response.total }),
      ...(response.totalPages === undefined
        ? {}
        : { totalPages: response.totalPages }),
    };
  }

  async fetchProductSample(page = 1, perPage = 3): Promise<WooCommerceProductsPage> {
    if (!Number.isInteger(perPage) || perPage < 1 || perPage > MAX_SAMPLE_SIZE) {
      throw new WooCommerceRequestError(
        "INVALID_INPUT",
        `WooCommerce sample size must be between 1 and ${MAX_SAMPLE_SIZE}.`,
      );
    }
    return this.fetchProducts(page, perPage);
  }

  async fetchOrders(
    page = 1,
    perPage = MAX_ORDERS_PAGE_SIZE,
  ): Promise<WooCommerceOrdersPage> {
    if (!Number.isInteger(page) || page < 1) {
      throw new WooCommerceRequestError(
        "INVALID_INPUT",
        "WooCommerce page must be positive.",
      );
    }
    if (
      !Number.isInteger(perPage) ||
      perPage < 1 ||
      perPage > MAX_ORDERS_PAGE_SIZE
    ) {
      throw new WooCommerceRequestError(
        "INVALID_INPUT",
        `WooCommerce page size must be between 1 and ${MAX_ORDERS_PAGE_SIZE}.`,
      );
    }

    const response = await this.transport.getJson(
      buildOrdersUrl(this.config.storeUrl, page, perPage),
      this.#authorization,
    );
    if (response.status !== 200 || !Array.isArray(response.body)) {
      if (response.status !== 200) throw httpStatusError(response.status);
      throw new WooCommerceRequestError(
        "INVALID_RESPONSE",
        "WooCommerce returned an unexpected orders response.",
      );
    }

    return {
      orders: response.body.map(parseOrder),
      page,
      perPage,
      ...(response.total === undefined ? {} : { total: response.total }),
      ...(response.totalPages === undefined
        ? {}
        : { totalPages: response.totalPages }),
    };
  }

  async fetchOrdersInRange(
    start: Date,
    endExclusive: Date,
  ): Promise<readonly WooCommerceOrder[]> {
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(endExclusive.getTime()) ||
      start >= endExclusive
    ) {
      throw new WooCommerceRequestError(
        "INVALID_INPUT",
        "WooCommerce order date range is invalid.",
      );
    }

    const ordersById = new Map<number, WooCommerceOrder>();
    let page = 1;
    let totalPages = 1;
    do {
      const response = await this.transport.getJson(
        buildOrdersUrl(this.config.storeUrl, page, 100, {
          start,
          endExclusive,
        }),
        this.#authorization,
      );
      if (response.status !== 200 || !Array.isArray(response.body)) {
        if (response.status !== 200) throw httpStatusError(response.status);
        throw new WooCommerceRequestError(
          "INVALID_RESPONSE",
          "WooCommerce returned an unexpected orders response.",
        );
      }
      for (const order of response.body.map(parseOrder)) {
        ordersById.set(order.id, order);
      }
      totalPages = response.totalPages ?? page;
      page += 1;
    } while (page <= totalPages);

    return [...ordersById.values()];
  }
}
