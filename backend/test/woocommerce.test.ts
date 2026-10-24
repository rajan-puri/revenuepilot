import assert from "node:assert/strict";
import test from "node:test";
import {
  loadWooCommerceConfig,
  validateWooCommerceStoreUrl,
  WooCommerceClient,
  WooCommerceRequestError,
  type WooCommerceTransport,
} from "../src/woocommerce.js";

const consumerKey = `ck_${"a".repeat(40)}`;
const consumerSecret = `cs_${"b".repeat(40)}`;

test("rejects local, private, insecure, and credential-bearing store URLs", () => {
  for (const value of [
    "http://shop.example.com",
    "https://localhost",
    "https://shop.local",
    "https://127.0.0.1",
    "https://10.0.0.8",
    "https://172.16.0.8",
    "https://192.168.1.8",
    "https://[::1]",
    "https://[::ffff:127.0.0.1]",
    "https://user:password@shop.example.com",
    "https://shop.example.com?next=https://127.0.0.1",
  ]) {
    assert.throws(() => validateWooCommerceStoreUrl(value));
  }

  assert.doesNotThrow(() =>
    validateWooCommerceStoreUrl("https://104.21.16.134"),
  );
});

test("loads only a complete backend configuration", () => {
  assert.throws(() => loadWooCommerceConfig({}));
  assert.throws(() =>
    loadWooCommerceConfig({ WOOCOMMERCE_STORE_URL: "https://shop.example.com" }),
  );
  const config = loadWooCommerceConfig({
    WOOCOMMERCE_STORE_URL: "https://shop.example.com/store/",
    WOOCOMMERCE_CONSUMER_KEY: consumerKey,
    WOOCOMMERCE_CONSUMER_SECRET: consumerSecret,
  });
  assert.equal(config.storeUrl.href, "https://shop.example.com/store");
});

test("fetches a small official wc/v3 products page using backend Basic Auth", async () => {
  let requestedUrl = "";
  let receivedAuthorization = "";
  const transport: WooCommerceTransport = {
    async getJson(url, authorization) {
      requestedUrl = url.href;
      receivedAuthorization = authorization;
      return {
        status: 200,
        total: 8,
        totalPages: 3,
        body: [
          {
            id: 101,
            name: "Sample response product",
            slug: "sample-response-product",
            status: "publish",
            sku: "SKU-101",
            price: "49.00",
            stock_status: "instock",
            date_modified_gmt: "2026-10-24T00:00:00",
          },
        ],
      };
    },
  };
  const config = loadWooCommerceConfig({
    WOOCOMMERCE_STORE_URL: "https://shop.example.com/store",
    WOOCOMMERCE_CONSUMER_KEY: consumerKey,
    WOOCOMMERCE_CONSUMER_SECRET: consumerSecret,
  });

  const result = await new WooCommerceClient(config, transport).fetchProductSample(
    1,
    3,
  );

  const url = new URL(requestedUrl);
  assert.equal(url.pathname, "/store/wp-json/wc/v3/products");
  assert.equal(url.searchParams.get("page"), "1");
  assert.equal(url.searchParams.get("per_page"), "3");
  assert.equal(url.searchParams.has("consumer_key"), false);
  assert.equal(url.searchParams.has("consumer_secret"), false);
  assert.match(receivedAuthorization, /^Basic /);
  assert.equal(result.products[0]?.id, 101);
  assert.equal(result.total, 8);
  assert.equal(result.totalPages, 3);
});

test("caps the product verification sample size", async () => {
  const transport: WooCommerceTransport = {
    async getJson() {
      throw new Error("transport must not run");
    },
  };
  const config = loadWooCommerceConfig({
    WOOCOMMERCE_STORE_URL: "https://shop.example.com",
    WOOCOMMERCE_CONSUMER_KEY: consumerKey,
    WOOCOMMERCE_CONSUMER_SECRET: consumerSecret,
  });

  await assert.rejects(
    new WooCommerceClient(config, transport).fetchProductSample(1, 6),
  );
});

test("fetches a paginated wc/v3 orders page without customer fields", async () => {
  let requestedUrl = "";
  const transport: WooCommerceTransport = {
    async getJson(url) {
      requestedUrl = url.href;
      return {
        status: 200,
        total: 14,
        totalPages: 2,
        body: [
          {
            id: 501,
            number: "501",
            date_created_gmt: "2026-10-24T08:30:00",
            status: "processing",
            currency: "INR",
            total: "1299.00",
            line_items: [
              {
                product_id: 101,
                name: "Store product",
                quantity: 2,
                price: "649.50",
              },
            ],
          },
        ],
      };
    },
  };
  const config = loadWooCommerceConfig({
    WOOCOMMERCE_STORE_URL: "https://shop.example.com/store",
    WOOCOMMERCE_CONSUMER_KEY: consumerKey,
    WOOCOMMERCE_CONSUMER_SECRET: consumerSecret,
  });

  const result = await new WooCommerceClient(config, transport).fetchOrders(
    2,
    10,
  );
  const url = new URL(requestedUrl);
  assert.equal(url.pathname, "/store/wp-json/wc/v3/orders");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(url.searchParams.get("per_page"), "10");
  assert.equal(url.searchParams.get("orderby"), "date");
  assert.equal(url.searchParams.get("order"), "desc");
  assert.equal(url.searchParams.get("_fields")?.includes("billing"), false);
  assert.equal(url.searchParams.get("_fields")?.includes("shipping"), false);
  assert.deepEqual(result.orders[0]?.lineItems[0], {
    productId: 101,
    name: "Store product",
    quantity: 2,
    price: "649.50",
  });
  assert.equal(result.total, 14);
  assert.equal(result.totalPages, 2);
});

test("fetches every dashboard order page and deduplicates overlapping IDs", async () => {
  const requestedPages: string[] = [];
  const makeOrder = (id: number) => ({
    id,
    number: String(id),
    date_created_gmt: "2026-10-24T08:30:00",
    status: "completed",
    currency: "INR",
    total: "100.00",
    line_items: [],
  });
  const transport: WooCommerceTransport = {
    async getJson(url) {
      const page = url.searchParams.get("page") ?? "";
      requestedPages.push(page);
      return {
        status: 200,
        totalPages: 2,
        body: page === "1" ? [makeOrder(1)] : [makeOrder(1), makeOrder(2)],
      };
    },
  };
  const config = loadWooCommerceConfig({
    WOOCOMMERCE_STORE_URL: "https://shop.example.com",
    WOOCOMMERCE_CONSUMER_KEY: consumerKey,
    WOOCOMMERCE_CONSUMER_SECRET: consumerSecret,
  });

  const orders = await new WooCommerceClient(
    config,
    transport,
  ).fetchOrdersInRange(
    new Date("2026-10-18T00:00:00Z"),
    new Date("2026-10-25T00:00:00Z"),
  );

  assert.deepEqual(requestedPages, ["1", "2"]);
  assert.deepEqual(orders.map((order) => order.id), [1, 2]);
});

test("classifies unsuccessful WooCommerce HTTP statuses", async () => {
  const expected = [
    [301, "REDIRECT"],
    [302, "REDIRECT"],
    [401, "AUTHENTICATION"],
    [403, "PERMISSIONS"],
    [404, "REST_API_NOT_FOUND"],
    [429, "RATE_LIMITED"],
    [500, "SERVER_ERROR"],
    [503, "SERVER_ERROR"],
  ] as const;
  const config = loadWooCommerceConfig({
    WOOCOMMERCE_STORE_URL: "https://shop.example.com",
    WOOCOMMERCE_CONSUMER_KEY: consumerKey,
    WOOCOMMERCE_CONSUMER_SECRET: consumerSecret,
  });

  for (const [status, category] of expected) {
    const transport: WooCommerceTransport = {
      async getJson() {
        return { status, body: null };
      },
    };

    await assert.rejects(
      new WooCommerceClient(config, transport).fetchProductSample(),
      (error: unknown) =>
        error instanceof WooCommerceRequestError &&
        error.category === category &&
        error.status === status,
    );
  }
});

test("classifies an unexpected successful response as invalid", async () => {
  const transport: WooCommerceTransport = {
    async getJson() {
      return { status: 200, body: { products: [] } };
    },
  };
  const config = loadWooCommerceConfig({
    WOOCOMMERCE_STORE_URL: "https://shop.example.com",
    WOOCOMMERCE_CONSUMER_KEY: consumerKey,
    WOOCOMMERCE_CONSUMER_SECRET: consumerSecret,
  });

  await assert.rejects(
    new WooCommerceClient(config, transport).fetchProductSample(),
    (error: unknown) =>
      error instanceof WooCommerceRequestError &&
      error.category === "INVALID_RESPONSE" &&
      error.status === undefined,
  );
});
