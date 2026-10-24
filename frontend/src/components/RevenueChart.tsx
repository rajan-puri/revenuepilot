import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./Icon";
import { currency } from "../data/dashboard";
import type { RevenuePeriod } from "../data/dashboard";

const HEIGHT = 235;
const LEFT = 54;
const RIGHT = 18;
const TOP = 14;
const BOTTOM = 30;

function smoothPath(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  return points.reduce((path, point, index) => {
    if (!index) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const midpoint = (previous.x + point.x) / 2;
    return `${path} C ${midpoint} ${previous.y}, ${midpoint} ${point.y}, ${point.x} ${point.y}`;
  }, "");
}

function formatAmount(value: number, currencyCode: string | null): string {
  if (!currencyCode) return value.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currencyCode,
    }).format(value);
  } catch {
    return `${currencyCode} ${value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  }
}

export function RevenueChart({
  period,
  live = false,
  currencyCode = "INR",
}: {
  period: RevenuePeriod;
  live?: boolean;
  currencyCode?: string | null;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [comparison, setComparison] = useState(true);
  const [showData, setShowData] = useState(false);
  const [width, setWidth] = useState(1060);
  const chartContainer = useRef<HTMLDivElement>(null);
  const WIDTH = width;
  const descriptionId = useId();
  useEffect(() => {
    const container = chartContainer.current;
    if (!container) return;
    // Resize the coordinate space, keeping labels readable on narrow screens.
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(250, Math.round(entry.contentRect.width)));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  const peak = Math.max(...period.points.map((point) => point.current));
  const max = peak > 0 ? Math.ceil(peak / 1000) * 1000 : 1;
  const isEmpty = period.points.every((point) => point.current === 0);
  const showComparison = !live && comparison;
  const plotHeight = HEIGHT - TOP - BOTTOM;
  const plotWidth = WIDTH - LEFT - RIGHT;
  const coordinates = period.points.map((point, index) => ({
    x: LEFT + (index / (period.points.length - 1)) * plotWidth,
    y: TOP + plotHeight - (point.current / max) * plotHeight,
  }));
  const previousCoordinates = period.points.map((point, index) => ({
    x: coordinates[index].x,
    y: TOP + plotHeight - (point.previous / max) * plotHeight,
  }));
  const line = smoothPath(coordinates);
  const hovered = active === null ? undefined : period.points[active];
  const hoveredPosition = active === null ? undefined : coordinates[active];
  const labelCount = width < 500 ? 3 : 6;
  const xLabels = [
    ...new Set(
      Array.from({ length: labelCount }, (_, index) =>
        Math.round(((period.points.length - 1) * index) / (labelCount - 1)),
      ),
    ),
  ];

  function exportData() {
    const csv = live
      ? [
          `Date,Gross sales (${currencyCode ?? "currency unavailable"})`,
          ...period.points.map((point) => `"${point.label}",${point.current}`),
        ].join("\n")
      : [
          "Date,Revenue (INR),Previous period (INR)",
          ...period.points.map(
            (point) => `"${point.label}",${point.current},${point.previous}`,
          ),
        ].join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = live
      ? "revenuepilot-live-gross-sales.csv"
      : "revenuepilot-demo-revenue.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel revenue-panel" aria-labelledby="revenue-heading">
      <div className="panel-heading">
        <div>
          <h2 id="revenue-heading">Revenue performance</h2>
          <p>
            {live
              ? "Gross order value for completed, processing, and on-hold orders."
              : "Your revenue, moving in the right direction."}
          </p>
        </div>
        <button className="secondary-button export-button" onClick={exportData}>
          <Icon name="download" size={15} />
          Export report
        </button>
      </div>
      <div className="chart-summary">
        <div className="chart-total">
          <strong>{period.total}</strong>
          {live ? (
            <span className="positive-change live-metric-tag">
              <Icon name="check" size={13} /> Live
            </span>
          ) : (
            <>
              <span className="positive-change">
                <Icon name="arrowUp" size={13} />
                {period.change}
              </span>
              <span className="chart-comparison-label">{period.previousLabel}</span>
            </>
          )}
        </div>
        <div className="chart-legend">
          <span>
            <i className="legend-line" />
            Current period
          </span>
          {!live && (
            <button
              aria-pressed={comparison}
              aria-label="Show previous period comparison"
              onClick={() => setComparison(!comparison)}
              className={!comparison ? "legend-disabled" : ""}
            >
              <i className="legend-line legend-previous" />
              Previous period
            </button>
          )}
        </div>
      </div>
      <div
        ref={chartContainer}
        className="chart-wrap"
        onMouseLeave={() => setActive(null)}
      >
        <svg
          className="revenue-chart"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-labelledby={`revenue-heading ${descriptionId}`}
        >
          <desc id={descriptionId}>
            Revenue trend for {period.dateRange}. Total revenue {period.total}.
            Use the data table below for exact figures.
          </desc>
          {[0, 1, 2, 3, 4].map((tick) => {
            const y = TOP + (tick / 4) * plotHeight;
            return (
              <g key={tick}>
                <text
                  x={LEFT - 15}
                  y={y + 4}
                  className="axis-label"
                  textAnchor="end"
                >
                  {live
                    ? ((max - (tick / 4) * max) / 1000).toLocaleString("en-US", {
                        maximumFractionDigits: 1,
                      })
                    : `₹${((max - (tick / 4) * max) / 1000).toLocaleString("en-IN", {
                        maximumFractionDigits: 1,
                      })}k`}
                </text>
                <line
                  x1={LEFT}
                  x2={WIDTH - RIGHT}
                  y1={y}
                  y2={y}
                  className="chart-gridline"
                />
              </g>
            );
          })}
          <path
            d={`${line} L ${WIDTH - RIGHT} ${HEIGHT - BOTTOM} L ${LEFT} ${HEIGHT - BOTTOM} Z`}
            className="chart-area"
          />
          {showComparison && (
            <path
              d={smoothPath(previousCoordinates)}
              className="chart-previous"
            />
          )}
          <path d={line} className="chart-current" />
          {xLabels.map((index) => (
            <text
              className="axis-label"
              key={index}
              x={coordinates[index].x}
              y={HEIGHT - 7}
              textAnchor={
                index === 0
                  ? "start"
                  : index === period.points.length - 1
                    ? "end"
                    : "middle"
              }
            >
              {period.points[index].label.replace(", 2026", "")}
            </text>
          ))}
          {hoveredPosition && (
            <g>
              <line
                x1={hoveredPosition.x}
                x2={hoveredPosition.x}
                y1={TOP}
                y2={HEIGHT - BOTTOM}
                className="chart-crosshair"
              />
              <circle
                cx={hoveredPosition.x}
                cy={hoveredPosition.y}
                r="5"
                className="chart-point"
              />
            </g>
          )}
          {coordinates.map((point, index) => (
            <rect
              key={index}
              x={point.x - plotWidth / (period.points.length - 1) / 2}
              width={plotWidth / (period.points.length - 1)}
              y={0}
              height={HEIGHT - BOTTOM}
              fill="transparent"
              onMouseEnter={() => setActive(index)}
            />
          ))}
        </svg>
        {live && isEmpty && (
          <div className="chart-empty-state" role="status">
            <Icon name="analytics" size={22} />
            <strong>No sales in this date range</strong>
            <span>The chart remains at zero because WooCommerce returned no qualifying orders.</span>
          </div>
        )}
        {hovered && hoveredPosition && (
          <div
            className="chart-tooltip"
            style={{
              left: `${Math.min(83, Math.max(15, (hoveredPosition.x / WIDTH) * 100))}%`,
            }}
          >
            <strong>{hovered.label}</strong>
            <span>
              <i />
              Revenue<b>{live ? formatAmount(hovered.current, currencyCode) : currency(hovered.current)}</b>
            </span>
            {showComparison && (
              <span>
                <i className="previous-dot" />
                Previous<b>{currency(hovered.previous)}</b>
              </span>
            )}
          </div>
        )}
      </div>
      <div className="chart-footer">
        <span>
          <span className="fresh-dot" />
          {period.dateRange}
          <span className="chart-currency">
            {currencyCode ? `All amounts in ${currencyCode}` : "No order currency available"}
          </span>
        </span>
        <button
          className="text-button"
          aria-expanded={showData}
          onClick={() => setShowData(!showData)}
        >
          {showData ? "Hide data table" : "View data table"}
          <Icon name="chevron" size={13} />
        </button>
      </div>
      {showData && (
        <div
          className="chart-data-table table-scroll"
          role="region"
          aria-label="Revenue figures"
          tabIndex={0}
        >
          <table>
            <caption className="sr-only">
              {live ? "Daily live gross sales" : "Daily demo revenue and comparison"}
            </caption>
            <thead>
              <tr>
                <th>Date</th>
                <th>Current period</th>
                {!live && <th>Previous period</th>}
              </tr>
            </thead>
            <tbody>
              {period.points.map((point) => (
                <tr key={point.label}>
                  <td>{point.label}</td>
                  <td>{live ? formatAmount(point.current, currencyCode) : currency(point.current)}</td>
                  {!live && <td>{currency(point.previous)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
