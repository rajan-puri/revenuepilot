export type PeriodKey = "7d" | "30d" | "90d";
export type ViewName =
  | "Overview"
  | "Orders"
  | "Products"
  | "Customers"
  | "Revenue Recovery"
  | "Analytics"
  | "Settings"
  | "Help & resources";
export type OrderStatusFilter = "All statuses" | Order["status"];
export const viewTitles: Record<ViewName, string> = {
  Overview: "Revenue Overview",
  Orders: "Orders",
  Products: "Products",
  Customers: "Customers",
  "Revenue Recovery": "Revenue Recovery",
  Analytics: "Analytics",
  Settings: "Settings",
  "Help & resources": "Help & resources",
};
export type MetricIcon = "wallet" | "bag" | "receipt" | "recovery";

export interface Metric {
  label: string;
  value: string;
  change: string;
  description: string;
  icon: MetricIcon;
  sparkline: number[];
}

export interface RevenuePoint {
  label: string;
  current: number;
  previous: number;
}
export interface RevenuePeriod {
  label: string;
  dateRange: string;
  previousLabel: string;
  metrics: Metric[];
  points: RevenuePoint[];
  total: string;
  change: string;
}

const current = [
  1280, 1640, 1420, 1750, 1690, 2420, 2180, 1870, 2150, 2760, 2010, 1820, 2220,
  2630, 2450, 3140, 2890, 2510, 2940, 3290, 2780, 3010, 3490, 3120, 3640, 4130,
  3700, 3990, 4460, 4050,
];
const previous = [
  1040, 1330, 1210, 1480, 1350, 1620, 1540, 1290, 1690, 1720, 1390, 1500, 1720,
  1830, 1620, 1980, 1770, 1940, 2140, 2010, 2260, 1880, 2320, 2490, 2310, 2660,
  2450, 2640, 2880, 2620,
];

// Keep chart/export values consistent with the headline totals for every period.
function scaleToTotal(values: number[], total: number): number[] {
  const sum = values.reduce((result, value) => result + value, 0);
  const scaled = values.map((value) => Math.round((value / sum) * total));
  scaled[scaled.length - 1] +=
    total - scaled.reduce((result, value) => result + value, 0);
  return scaled;
}

function makePoints(
  values: number[],
  comparisons: number[],
  start: string,
  total: number,
  growth: number,
  step = 1,
): RevenuePoint[] {
  const scaled = scaleToTotal(values, total);
  const scaledPrevious = scaleToTotal(
    comparisons,
    Math.round(total / (1 + growth / 100)),
  );
  return values.map((value, index) => {
    const date = new Date(`${start}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + Math.round(index * step));
    return {
      label: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }),
      current: scaled[index] ?? value,
      previous: scaledPrevious[index] ?? 0,
    };
  });
}

const metrics: Metric[] = [
  {
    label: "Total revenue",
    value: "₹78,460.00",
    change: "18.6%",
    description: "vs. previous 30 days",
    icon: "wallet",
    sparkline: [3, 5, 4, 7, 6, 8, 6, 10, 9, 13, 12, 15],
  },
  {
    label: "Total orders",
    value: "1,284",
    change: "12.8%",
    description: "vs. previous 30 days",
    icon: "bag",
    sparkline: [3, 4, 6, 5, 8, 7, 9, 7, 9, 11, 10, 14],
  },
  {
    label: "Average order value",
    value: "₹61.11",
    change: "5.2%",
    description: "vs. previous 30 days",
    icon: "receipt",
    sparkline: [5, 6, 5, 8, 7, 7, 10, 9, 11, 10, 12, 14],
  },
  {
    label: "Revenue recovered",
    value: "₹4,280.00",
    change: "24.3%",
    description: "vs. previous 30 days",
    icon: "recovery",
    sparkline: [2, 5, 4, 6, 5, 8, 7, 9, 9, 12, 10, 15],
  },
];

export const periods: Record<PeriodKey, RevenuePeriod> = {
  "30d": {
    label: "Last 30 days",
    dateRange: "Sep 24 – Oct 23, 2026",
    previousLabel: "vs. previous 30 days",
    metrics,
    points: makePoints(current, previous, "2026-09-24", 78460, 18.6),
    total: "₹78,460.00",
    change: "18.6%",
  },
  "7d": {
    label: "Last 7 days",
    dateRange: "Oct 17 – Oct 23, 2026",
    previousLabel: "vs. previous 7 days",
    metrics: metrics.map((metric, index) => ({
      ...metric,
      value: ["₹20,870.00", "326", "₹64.02", "₹1,180.00"][index] ?? "",
      change: ["14.2%", "8.7%", "5.1%", "19.8%"][index] ?? "",
      description: "vs. previous 7 days",
    })),
    points: makePoints(
      current.slice(16, 23),
      previous.slice(16, 23),
      "2026-10-17",
      20870,
      14.2,
    ),
    total: "₹20,870.00",
    change: "14.2%",
  },
  "90d": {
    label: "Last 90 days",
    dateRange: "Jul 26 – Oct 23, 2026",
    previousLabel: "vs. previous 90 days",
    metrics: metrics.map((metric, index) => ({
      ...metric,
      value: ["₹218,940.00", "3,648", "₹60.02", "₹11,840.00"][index] ?? "",
      change: ["21.4%", "16.3%", "4.4%", "28.1%"][index] ?? "",
      description: "vs. previous 90 days",
    })),
    points: makePoints(current, previous, "2026-07-26", 218940, 21.4, 89 / 29),
    total: "₹218,940.00",
    change: "21.4%",
  },
};

export interface Order {
  id: string;
  customer: string;
  email: string;
  initials: string;
  tone: string;
  date: string;
  status: "Completed" | "Processing" | "Refunded";
  amount: number;
}
export const orders: Order[] = [
  {
    id: "#RP-1048",
    customer: "Olivia Bennett",
    email: "olivia.b@example.com",
    initials: "OB",
    tone: "lavender",
    date: "Oct 23, 2026",
    status: "Completed",
    amount: 129.0,
  },
  {
    id: "#RP-1047",
    customer: "James Carter",
    email: "james.c@example.com",
    initials: "JC",
    tone: "peach",
    date: "Oct 23, 2026",
    status: "Processing",
    amount: 84.5,
  },
  {
    id: "#RP-1046",
    customer: "Sofia Martinez",
    email: "sofia.m@example.com",
    initials: "SM",
    tone: "mint",
    date: "Oct 22, 2026",
    status: "Completed",
    amount: 215.0,
  },
  {
    id: "#RP-1045",
    customer: "Ethan Brooks",
    email: "ethan.b@example.com",
    initials: "EB",
    tone: "blue",
    date: "Oct 22, 2026",
    status: "Completed",
    amount: 59.99,
  },
  {
    id: "#RP-1044",
    customer: "Mia Anderson",
    email: "mia.a@example.com",
    initials: "MA",
    tone: "rose",
    date: "Oct 22, 2026",
    status: "Refunded",
    amount: 47.0,
  },
  {
    id: "#RP-1043",
    customer: "Noah Wilson",
    email: "noah.w@example.com",
    initials: "NW",
    tone: "blue",
    date: "Oct 21, 2026",
    status: "Completed",
    amount: 168.0,
  },
  {
    id: "#RP-1042",
    customer: "Ava Mitchell",
    email: "ava.m@example.com",
    initials: "AM",
    tone: "lavender",
    date: "Oct 21, 2026",
    status: "Processing",
    amount: 92.0,
  },
  {
    id: "#RP-1041",
    customer: "Liam Hayes",
    email: "liam.h@example.com",
    initials: "LH",
    tone: "mint",
    date: "Oct 20, 2026",
    status: "Completed",
    amount: 136.5,
  },
];

export const opportunities = [
  {
    id: "carts",
    icon: "bag" as const,
    title: "Bring abandoned carts back",
    description: "24 shoppers left something behind.",
    value: "₹1,840",
    action: "Review carts",
    detail:
      "24 demo carts contain ₹1,840 in products. A timely reminder with a direct checkout link could help shoppers complete their purchase. Start with the 8 highest-value carts, which account for ₹960.",
    next: "Suggested next step: review high-value carts and draft a reminder campaign. No messages will be sent from this demo.",
  },
  {
    id: "customers",
    icon: "users" as const,
    title: "Reconnect with loyal customers",
    description: "18 repeat buyers are ready for a nudge.",
    value: "₹920",
    action: "View customers",
    detail:
      "18 demo customers have purchased at least twice but have not returned in 60 days. Their historical average order value is ₹51.11. A relevant product recommendation may help bring them back.",
    next: "Suggested next step: create a returning-customer segment and choose relevant products. Customer outreach is not connected in this demo.",
  },
  {
    id: "bundles",
    icon: "products" as const,
    title: "Turn bestsellers into bundles",
    description: "3 product pairs are often bought together.",
    value: "₹680",
    action: "Explore bundles",
    detail:
      "Three demo product pairs appear together in more than 12% of completed orders. A starter bundle with a small discount could improve discovery and average order value.",
    next: "Suggested next step: compare margins and select one pair for a bundle test. No products or prices will be changed in this demo.",
  },
];

export interface DemoProduct {
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
}

export const products: DemoProduct[] = [
  {
    sku: "EV-001",
    name: "Everyday Canvas Tote",
    category: "Accessories",
    price: 29,
    stock: 82,
  },
  {
    sku: "EV-002",
    name: "Ceramic Travel Cup",
    category: "Home & living",
    price: 24.5,
    stock: 46,
  },
  {
    sku: "EV-003",
    name: "Linen Weekend Shirt",
    category: "Apparel",
    price: 59.99,
    stock: 18,
  },
  {
    sku: "EV-004",
    name: "Desk Essentials Set",
    category: "Home & living",
    price: 47,
    stock: 0,
  },
  {
    sku: "EV-005",
    name: "Lightweight Daypack",
    category: "Accessories",
    price: 84.5,
    stock: 35,
  },
];

export const currency = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    amount,
  );
