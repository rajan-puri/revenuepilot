import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { Server } from "node:http";
import { createApp } from "../src/app.js";
import { WooCommerceRequestError } from "../src/woocommerce.js";

async function withServer(
  app: ReturnType<typeof createApp>,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server: Server = await new Promise((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const address = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("GET /api/products returns only the public product fields", async () => {
  const app = createApp({
    wooCommerceClient: {
      async fetchProducts(page, perPage) {
        assert.equal(page, 2);
        assert.equal(perPage, 10);
        return {
          products: [
            {
              id: 42,
              name: "Live product",
              sku: "SKU-42",
              price: "199.00",
              stockStatus: "instock",
              image: "https://cdn.example.com/product.jpg",
              slug: "live-product",
              status: "publish",
              dateModifiedGmt: "2026-10-24T00:00:00",
            },
          ],
          page,
          perPage,
          total: 21,
          totalPages: 3,
        };
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/products?page=2&perPage=10`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body, {
      success: true,
      products: [
        {
          id: 42,
          name: "Live product",
          sku: "SKU-42",
          price: "199.00",
          stockStatus: "instock",
          image: "https://cdn.example.com/product.jpg",
        },
      ],
      pagination: { page: 2, perPage: 10, total: 21, totalPages: 3 },
    });
    assert.equal(JSON.stringify(body).includes("slug"), false);
    assert.equal(JSON.stringify(body).includes("dateModifiedGmt"), false);
  });
});

test("GET /api/products rejects invalid pagination before calling WooCommerce", async () => {
  let called = false;
  const app = createApp({
    wooCommerceClient: {
      async fetchProducts() {
        called = true;
        throw new Error("must not run");
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/products?perPage=100`);
    assert.equal(response.status, 400);
    assert.equal(called, false);
  });
});

test("GET /api/products sanitizes upstream WooCommerce failures", async () => {
  const secretMarker = "secret-response-marker";
  const app = createApp({
    wooCommerceClient: {
      async fetchProducts() {
        throw new WooCommerceRequestError("AUTHENTICATION", secretMarker, 401);
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/products`);
    assert.equal(response.status, 502);
    const text = await response.text();
    assert.equal(text.includes(secretMarker), false);
    assert.deepEqual(JSON.parse(text), {
      success: false,
      error: "WooCommerce products are temporarily unavailable.",
    });
  });
});
