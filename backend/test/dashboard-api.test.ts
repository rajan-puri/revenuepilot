import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { createApp } from "../src/app.js";
import type { WooCommerceOrder } from "../src/woocommerce.js";

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

function order(
  id: number,
  date: string,
  status: string,
  total: string,
  currency = "INR",
): WooCommerceOrder {
  return {
    id,
    number: String(id),
    date,
    status,
    currency,
    total,
    lineItems: [],
  };
}

test("dashboard summary applies the selected UTC date range", async () => {
  let receivedRange: [string, string] | undefined;
  const app = createApp({
    now: () => new Date("2026-10-24T12:00:00Z"),
    dashboardOrdersSource: {
      async fetchOrdersInRange(start, endExclusive) {
        receivedRange = [start.toISOString(), endExclusive.toISOString()];
        return [
          order(1, "2026-10-17T23:59:59", "completed", "999.00"),
          order(2, "2026-10-18T00:00:00", "completed", "100.00"),
          order(3, "2026-10-24T23:59:59", "processing", "50.00"),
          order(4, "2026-10-25T00:00:00", "completed", "999.00"),
        ];
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/dashboard-summary?period=7d`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(receivedRange, [
      "2026-10-18T00:00:00.000Z",
      "2026-10-25T00:00:00.000Z",
    ]);
    assert.equal(body.summary.totalOrders, 2);
    assert.equal(body.summary.grossSales, 150);
    assert.equal(body.summary.daily.length, 7);
  });
});

test("dashboard summary returns safe zero metrics and chart points", async () => {
  const app = createApp({
    now: () => new Date("2026-10-24T12:00:00Z"),
    dashboardOrdersSource: { async fetchOrdersInRange() { return []; } },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/dashboard-summary?period=30d`);
    const body = await response.json();
    assert.equal(body.summary.totalOrders, 0);
    assert.equal(body.summary.salesOrderCount, 0);
    assert.equal(body.summary.grossSales, 0);
    assert.equal(body.summary.averageOrderValue, 0);
    assert.equal(body.summary.currency, null);
    assert.equal(body.summary.daily.length, 30);
    assert.equal(body.summary.daily.every((point: { grossSales: number }) => point.grossSales === 0), true);
  });
});

test("dashboard metrics include only defined sales statuses without double-counting", async () => {
  const app = createApp({
    now: () => new Date("2026-10-24T12:00:00Z"),
    dashboardOrdersSource: {
      async fetchOrdersInRange() {
        return [
          order(1, "2026-10-24T01:00:00", "completed", "100.00"),
          order(2, "2026-10-24T02:00:00", "processing", "50.00"),
          order(3, "2026-10-24T03:00:00", "on-hold", "25.00"),
          order(4, "2026-10-24T04:00:00", "cancelled", "200.00"),
          order(5, "2026-10-24T05:00:00", "refunded", "30.00"),
        ];
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/dashboard-summary?period=7d`);
    const body = await response.json();
    assert.equal(body.summary.totalOrders, 5);
    assert.equal(body.summary.salesOrderCount, 3);
    assert.equal(body.summary.grossSales, 175);
    assert.equal(body.summary.averageOrderValue, 58.333333);
    assert.deepEqual(body.summary.statusCounts, {
      completed: 1,
      processing: 1,
      "on-hold": 1,
      cancelled: 1,
      refunded: 1,
    });
  });
});

test("dashboard refuses to combine included sales currencies", async () => {
  const app = createApp({
    now: () => new Date("2026-10-24T12:00:00Z"),
    dashboardOrdersSource: {
      async fetchOrdersInRange() {
        return [
          order(1, "2026-10-24T01:00:00", "completed", "100.00", "INR"),
          order(2, "2026-10-24T02:00:00", "processing", "10.00", "USD"),
        ];
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/dashboard-summary?period=7d`);
    assert.equal(response.status, 422);
    assert.deepEqual(await response.json(), {
      success: false,
      error: "Dashboard cannot combine orders in multiple currencies.",
    });
  });
});
