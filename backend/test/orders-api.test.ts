import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
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

test("GET /api/orders returns only safe order and line-item fields", async () => {
  const app = createApp({
    ordersSource: {
      async fetchOrders(page, perPage) {
        assert.equal(page, 2);
        assert.equal(perPage, 5);
        return {
          orders: [
            {
              id: 501,
              number: "WC-501",
              date: "2026-10-24T08:30:00",
              status: "processing",
              currency: "INR",
              total: "1299.00",
              lineItems: [
                {
                  productId: 101,
                  name: "Store product",
                  quantity: 2,
                  price: "649.50",
                },
              ],
            },
          ],
          page,
          perPage,
          total: 14,
          totalPages: 3,
        };
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/orders?page=2&perPage=5`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      orders: [
        {
          id: 501,
          number: "WC-501",
          date: "2026-10-24T08:30:00",
          status: "processing",
          currency: "INR",
          total: "1299.00",
          lineItems: [
            {
              productId: 101,
              name: "Store product",
              quantity: 2,
              price: "649.50",
            },
          ],
        },
      ],
      pagination: { page: 2, perPage: 5, total: 14, totalPages: 3 },
    });
  });
});

test("GET /api/orders preserves pagination metadata", async () => {
  const app = createApp({
    ordersSource: {
      async fetchOrders(page, perPage) {
        return { orders: [], page, perPage, total: 45, totalPages: 5 };
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/orders?page=3&perPage=10`);
    const body = await response.json();
    assert.deepEqual(body.pagination, {
      page: 3,
      perPage: 10,
      total: 45,
      totalPages: 5,
    });
  });
});

test("GET /api/orders rejects invalid pagination before WooCommerce", async () => {
  let called = false;
  const app = createApp({
    ordersSource: {
      async fetchOrders() {
        called = true;
        throw new Error("must not run");
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    for (const query of ["page=0", "page=one", "perPage=0", "perPage=21"]) {
      const response = await fetch(`${baseUrl}/api/orders?${query}`);
      assert.equal(response.status, 400);
    }
    assert.equal(called, false);
  });
});

test("GET /api/orders sanitizes WooCommerce failures", async () => {
  const secretMarker = "private-customer-response";
  const app = createApp({
    ordersSource: {
      async fetchOrders() {
        throw new WooCommerceRequestError("PERMISSIONS", secretMarker, 403);
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/orders`);
    assert.equal(response.status, 502);
    const text = await response.text();
    assert.equal(text.includes(secretMarker), false);
    assert.deepEqual(JSON.parse(text), {
      success: false,
      error: "WooCommerce orders are temporarily unavailable.",
    });
  });
});
