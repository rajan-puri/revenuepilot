import { useEffect, useMemo, useState } from "react";
import { KpiGrid } from "./Dashboard";
import { RevenueChart } from "./RevenueChart";
import { Icon } from "./Icon";
import { fetchDashboardSummary, type DashboardSummary } from "../utils/api";
import { periods, type PeriodKey, type RevenuePeriod } from "../data/dashboard";

function formatMoney(value: number, currencyCode: string | null): string {
  if (!currencyCode) {
    return value.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  }
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currencyCode,
    }).format(value);
  } catch {
    return `${currencyCode} ${value.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
    })}`;
  }
}

function dateLabel(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function makeLivePeriod(
  summary: DashboardSummary,
  periodKey: PeriodKey,
): RevenuePeriod {
  const grossValues = summary.daily.map((point) => point.grossSales);
  const orderValues = summary.daily.map((point) => point.orderCount);
  const salesOrderValues = summary.daily.map((point) => point.salesOrderCount);
  const averageValues = summary.daily.map((point) =>
    point.salesOrderCount === 0 ? 0 : point.grossSales / point.salesOrderCount,
  );
  const statusDescription = `Completed ${summary.statusCounts.completed ?? 0} · Processing ${summary.statusCounts.processing ?? 0} · On hold ${summary.statusCounts["on-hold"] ?? 0}`;
  const lastDay = new Date(
    new Date(summary.range.endExclusive).getTime() - 86_400_000,
  )
    .toISOString()
    .slice(0, 10);

  return {
    label: periods[periodKey].label,
    dateRange: `${dateLabel(summary.range.start.slice(0, 10))} – ${dateLabel(lastDay)}`,
    previousLabel: "",
    total: formatMoney(summary.grossSales, summary.currency),
    change: "",
    metrics: [
      {
        label: "Gross sales",
        value: formatMoney(summary.grossSales, summary.currency),
        change: "",
        description: "Completed + processing + on-hold orders",
        icon: "wallet",
        sparkline: grossValues,
      },
      {
        label: "Total orders",
        value: summary.totalOrders.toLocaleString("en-IN"),
        change: "",
        description: "All order statuses in the selected range",
        icon: "bag",
        sparkline: orderValues,
      },
      {
        label: "Average order value",
        value: formatMoney(summary.averageOrderValue, summary.currency),
        change: "",
        description: "Gross sales ÷ qualifying sales orders",
        icon: "receipt",
        sparkline: averageValues,
      },
      {
        label: "Sales orders",
        value: summary.salesOrderCount.toLocaleString("en-IN"),
        change: "",
        description: statusDescription,
        icon: "recovery",
        sparkline: salesOrderValues,
      },
    ],
    points: summary.daily.map((point) => ({
      label: dateLabel(point.date),
      current: point.grossSales,
      previous: 0,
    })),
  };
}

export function LiveOverview({ periodKey }: { periodKey: PeriodKey }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [state, setState] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void fetchDashboardSummary(periodKey, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setSummary(response.summary);
        setState("success");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, [attempt, periodKey]);

  const period = useMemo(
    () => (summary ? makeLivePeriod(summary, periodKey) : null),
    [periodKey, summary],
  );

  if (state === "loading") {
    return (
      <section className="panel overview-live-state" role="status" aria-live="polite">
        <span className="products-loader" aria-hidden="true" />
        <strong>Loading live dashboard…</strong>
        <p>Calculating WooCommerce totals for {periods[periodKey].label.toLowerCase()}.</p>
      </section>
    );
  }

  if (state === "error" || !period || !summary) {
    return (
      <section className="panel overview-live-state products-error" role="alert">
        <Icon name="info" size={22} />
        <strong>Live dashboard couldn’t be loaded</strong>
        <p>Check the WooCommerce connection and ensure orders use one currency.</p>
        <button
          className="secondary-button"
          onClick={() => {
            setState("loading");
            setAttempt((value) => value + 1);
          }}
        >
          Retry dashboard
        </button>
      </section>
    );
  }

  return (
    <>
      <KpiGrid period={period} live />
      <RevenueChart period={period} live currencyCode={summary.currency} />
    </>
  );
}
