import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { currency, opportunities, orders, periods } from "../data/dashboard";
import type {
  OrderStatusFilter,
  PeriodKey,
  RevenuePeriod,
  ViewName,
} from "../data/dashboard";
import { viewTitles } from "../data/dashboard";
import { downloadCsv } from "../utils/csv";

const availableOrderStatuses = Array.from(
  new Set(orders.map((order) => order.status)),
);

interface HeaderProps {
  periodKey: PeriodKey;
  onPeriodChange: (period: PeriodKey) => void;
  onMenuOpen: () => void;
  menuTrigger: RefObject<HTMLButtonElement | null>;
  sidebarOpen: boolean;
  activeView: ViewName;
  workspaceName: string;
}

export function DashboardHeader({
  periodKey,
  onPeriodChange,
  onMenuOpen,
  menuTrigger,
  sidebarOpen,
  activeView,
  workspaceName,
}: HeaderProps) {
  const [popover, setPopover] = useState<"profile" | "notifications" | null>(
    null,
  );
  const popoverRef = useRef<HTMLDivElement>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!popover) return;
    function onPointer(event: PointerEvent) {
      if (!popoverRef.current?.contains(event.target as Node)) setPopover(null);
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPopover(null);
        lastTrigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onEscape);
    };
  }, [popover]);

  return (
    <header className="main-header">
      <div className="header-title">
        <button
          ref={menuTrigger}
          className="icon-button mobile-menu"
          onClick={onMenuOpen}
          aria-label="Open navigation"
          aria-expanded={sidebarOpen}
          aria-controls="main-sidebar"
        >
          <Icon name="menu" />
        </button>
        <div>
          <div className="header-breadcrumb">
            Workspace <span>/</span> {activeView}
          </div>
          <h1>{viewTitles[activeView]}</h1>
        </div>
      </div>
      <div className="header-actions">
        <div className="date-select">
          <Icon name="calendar" size={16} />
          <label className="sr-only" htmlFor="date-period">
            Reporting period
          </label>
          <select
            id="date-period"
            value={periodKey}
            onChange={(event) =>
              onPeriodChange(event.target.value as PeriodKey)
            }
          >
            {Object.entries(periods).map(([key, period]) => (
              <option key={key} value={key}>
                {period.label}
              </option>
            ))}
          </select>
          <Icon name="chevron" size={14} />
        </div>
        <span className="header-divider" />
        <div className="header-popovers" ref={popoverRef}>
          <button
            className={`icon-button notification-button ${popover === "notifications" ? "selected" : ""}`}
            aria-label="Notifications"
            aria-expanded={popover === "notifications"}
            onClick={(event) => {
              lastTrigger.current = event.currentTarget;
              setPopover(popover === "notifications" ? null : "notifications");
            }}
          >
            <Icon name="bell" size={20} />
            <span className="notification-dot" />
          </button>
          <button
            className="profile-button"
            aria-label="View profile"
            aria-expanded={popover === "profile"}
            onClick={(event) => {
              lastTrigger.current = event.currentTarget;
              setPopover(popover === "profile" ? null : "profile");
            }}
          >
            <span className="avatar">RP</span>
            <Icon name="chevron" size={14} />
          </button>
          {popover && (
            <div
              className="header-popover"
              role="region"
              aria-label={
                popover === "profile" ? "Your profile" : "Notifications"
              }
            >
              {popover === "profile" ? (
                <>
                  <span className="popover-label">YOUR WORKSPACE</span>
                  <strong>Rajan Puri</strong>
                  <p>Owner · {workspaceName}</p>
                  <span className="small-demo-tag">Demo account</span>
                </>
              ) : (
                <>
                  <span className="popover-label">NOTIFICATIONS</span>
                  <strong>You're all caught up.</strong>
                  <p>
                    New store activity will appear here once a store is
                    connected.
                  </p>
                  <span className="small-demo-tag">
                    No live store connected
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Sparkline({ values, indigo }: { values: number[]; indigo: boolean }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const spread = max - min || 1;
  const steps = Math.max(1, values.length - 1);
  const points = values
    .map(
      (value, index) =>
        `${index * (90 / steps)},${35 - ((value - min) / spread) * 29}`,
    )
    .join(" ");
  return (
    <svg
      className={`sparkline ${indigo ? "sparkline-indigo" : ""}`}
      width="90"
      height="39"
      viewBox="0 0 90 39"
      fill="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KpiGrid({
  period,
  live = false,
}: {
  period: RevenuePeriod;
  live?: boolean;
}) {
  return (
    <section className="kpi-grid" aria-label="Key performance indicators">
      {period.metrics.map((metric, index) => (
        <article
          className={`kpi-card ${index === 3 ? "recovered-card" : ""}`}
          key={metric.label}
        >
          <div className="kpi-top">
            <h3>{metric.label}</h3>
            <Icon name={metric.icon} size={18} />
          </div>
          <div className="kpi-value-row">
            <strong className="kpi-value">{metric.value}</strong>
            <Sparkline values={metric.sparkline} indigo={index === 3} />
          </div>
          <p className="kpi-comparison">
            <span className={`positive-change ${live ? "live-metric-tag" : ""}`}>
              <Icon name={live ? "check" : "arrowUp"} size={13} />
              {live ? "Live" : metric.change}
            </span>
            <span>{metric.description}</span>
          </p>
          {index === 3 && <span className="recovered-accent" />}
        </article>
      ))}
    </section>
  );
}

export interface OrderFilters {
  search: string;
  status: OrderStatusFilter;
}

interface OrdersTableProps {
  filters: OrderFilters;
  onFiltersChange: (filters: OrderFilters) => void;
  fullPage?: boolean;
  onViewAll?: () => void;
}

export function OrdersTable({
  filters,
  onFiltersChange,
  fullPage = false,
  onViewAll,
}: OrdersTableProps) {
  const { search, status } = filters;
  const query = search.trim().toLowerCase();
  const filtered = orders.filter(
    (order) =>
      `${order.customer} ${order.id}`.toLowerCase().includes(query) &&
      (status === "All statuses" || order.status === status),
  );
  const visible =
    fullPage || query || status !== "All statuses"
      ? filtered
      : filtered.slice(0, 5);

  function exportOrders() {
    // Share the rendered row selection so the file cannot bypass active filters
    // or include rows hidden by the Overview's five-order preview.
    downloadCsv("revenuepilot-demo-orders.csv", [
      ["Order ID", "Customer", "Date", "Status", "Amount (INR)", "Data source"],
      ...visible.map((order) => [
        order.id,
        order.customer,
        order.date,
        order.status,
        order.amount.toFixed(2),
        "Demo data",
      ]),
    ]);
  }
  return (
    <section className="panel orders-panel" aria-labelledby="orders-heading">
      <div className="panel-heading">
        <div>
          <h2 id="orders-heading">
            {fullPage ? "Demo orders" : "Recent orders"}
            <span className="count-badge">{orders.length}</span>
          </h2>
          <p>A snapshot of your store's latest activity.</p>
        </div>
        {!fullPage && (
          <button className="text-button" onClick={onViewAll}>
            View all orders
            <Icon name="arrowRight" size={15} />
          </button>
        )}
      </div>
      <div className="table-tools">
        <label className="table-search">
          <Icon name="search" size={16} />
          <span className="sr-only">Search demo orders</span>
          <input
            type="search"
            placeholder="Search orders..."
            value={search}
            onChange={(event) =>
              onFiltersChange({ ...filters, search: event.target.value })
            }
          />
        </label>
        <label className="status-filter">
          <span className="sr-only">Filter orders by status</span>
          <select
            value={status}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                status: event.target.value as OrderStatusFilter,
              })
            }
          >
            <option>All statuses</option>
            {availableOrderStatuses.map((orderStatus) => (
              <option key={orderStatus}>{orderStatus}</option>
            ))}
          </select>
        </label>
      </div>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Recent orders table, scroll horizontally on small screens"
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Order ID</th>
              <th scope="col">Customer</th>
              <th scope="col">Date</th>
              <th scope="col">Status</th>
              <th scope="col" className="amount-column">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((order) => (
              <tr key={order.id}>
                <td className="order-id">{order.id}</td>
                <td>
                  <div className="customer-cell">
                    <span
                      className={`customer-avatar ${order.tone}`}
                      aria-hidden="true"
                    >
                      {order.initials}
                    </span>
                    <div>
                      <strong>{order.customer}</strong>
                      <span>{order.email}</span>
                    </div>
                  </div>
                </td>
                <td className="order-date">{order.date}</td>
                <td>
                  <span className={`status-pill ${order.status.toLowerCase()}`}>
                    <span />
                    {order.status}
                  </span>
                </td>
                <td className="order-amount">{currency(order.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && (
          <div className="empty-state">
            <Icon name="search" size={25} />
            <strong>No matching orders</strong>
            <p>Try another customer name, order ID, or status filter.</p>
            <button
              className="text-button"
              onClick={() =>
                onFiltersChange({ search: "", status: "All statuses" })
              }
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
      <div className="table-footer">
        <span>
          Showing {visible.length} of {filtered.length} demo orders
        </span>
        <button
          className="text-button"
          onClick={exportOrders}
          aria-label={`Export ${visible.length} displayed demo orders as CSV`}
        >
          <Icon name="download" size={13} />
          Export orders CSV
        </button>
      </div>
    </section>
  );
}

type Opportunity = (typeof opportunities)[number];

function OpportunityDialog({
  opportunity,
  onClose,
}: {
  opportunity: Opportunity;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => {
      element?.close();
      trigger?.focus();
    };
  }, []);
  function keepFocusWithin(event: ReactKeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    // Explicit wrapping keeps keyboard focus in the dialog across browsers.
    const buttons =
      dialog.current?.querySelectorAll<HTMLButtonElement>("button");
    if (!buttons?.length) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  return createPortal(
    <dialog
      ref={dialog}
      className="opportunity-dialog"
      aria-labelledby={titleId}
      onKeyDown={keepFocusWithin}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog-top">
        <span className="dialog-eyebrow">
          <Icon name="bolt" size={16} /> REVENUE OPPORTUNITY
        </span>
        <button
          className="icon-button"
          aria-label="Close opportunity details"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <h2 id={titleId}>{opportunity.title}</h2>
      <div className="dialog-potential">
        <strong>{opportunity.value}</strong>
        <span>illustrative revenue potential</span>
      </div>
      <p>{opportunity.detail}</p>
      <div className="suggested-action">
        <Icon name="info" size={20} />
        <p>{opportunity.next}</p>
      </div>
      <button className="primary-button" onClick={onClose}>
        Back to overview
        <Icon name="arrowRight" size={16} />
      </button>
    </dialog>,
    document.body,
  );
}

export function OpportunitiesPanel() {
  const [selected, setSelected] = useState<Opportunity | null>(null);
  return (
    <>
      <section
        className="panel opportunities-panel"
        aria-labelledby="opportunities-heading"
      >
        <div className="panel-heading">
          <div>
            <h2 id="opportunities-heading">
              <Icon name="bolt" size={18} />
              Revenue opportunities
            </h2>
            <p>Small moves. Meaningful growth.</p>
          </div>
          <span className="opportunity-count">3</span>
        </div>
        <div className="opportunity-total">
          <div>
            <span>YOUR NEXT GROWTH OPPORTUNITY</span>
            <strong>
              ₹3,440<span>potential revenue</span>
            </strong>
          </div>
          <span className="potential-symbol">
            <Icon name="arrowUp" size={24} />
          </span>
        </div>
        <div className="opportunity-list">
          {opportunities.map((opportunity) => (
            <article className="opportunity" key={opportunity.id}>
              <div className="opportunity-title">
                <Icon name={opportunity.icon} size={18} />
                <h3>{opportunity.title}</h3>
              </div>
              <p>{opportunity.description}</p>
              <div className="opportunity-action">
                <span>
                  Up to <strong>{opportunity.value}</strong>
                </span>
                <button
                  className="text-button"
                  onClick={() => setSelected(opportunity)}
                >
                  {opportunity.action}
                  <Icon name="arrowRight" size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
        <p className="opportunity-disclaimer">
          <Icon name="info" size={13} />
          Illustrative estimates based on demo activity.
        </p>
      </section>
      {selected && (
        <OpportunityDialog
          opportunity={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
