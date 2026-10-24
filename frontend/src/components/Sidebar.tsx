import { useEffect, useRef } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import type { ViewName } from "../data/dashboard";

const navigation: { label: ViewName; icon: IconName; badge?: string }[] = [
  { label: "Overview", icon: "overview" },
  { label: "Orders", icon: "bag" },
  { label: "Products", icon: "products" },
  { label: "Customers", icon: "users" },
  { label: "Revenue Recovery", icon: "recovery", badge: "3" },
  { label: "Analytics", icon: "analytics" },
];

export function Sidebar({
  open,
  onClose,
  onNavigate,
  activeView,
  workspaceName,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (name: ViewName) => void;
  activeView: ViewName;
  workspaceName: string;
}) {
  const sidebar = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    sidebar.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const elements =
          sidebar.current?.querySelectorAll<HTMLButtonElement>(
            "button, a[href]",
          );
        if (!elements?.length) return;
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKey);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = oldOverflow;
    };
  }, [open, onClose]);

  function navigate(label: ViewName) {
    if (open) onClose();
    onNavigate(label);
  }

  return (
    <>
      {open && (
        <div className="sidebar-scrim" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        ref={sidebar}
        id="main-sidebar"
        className={`sidebar ${open ? "is-open" : ""}`}
      >
        <div className="brand-row">
          <a
            className="brand"
            href="#main-content"
            aria-label="RevenuePilot home"
            onClick={(event) => {
              event.preventDefault();
              navigate("Overview");
            }}
          >
            <span className="brand-mark">
              <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
                <path
                  d="M6 21V7h8a5 5 0 0 1 0 10H6M14 17l7 5"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="m16 5 5-2-1 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span>
              Revenue<span className="brand-light">Pilot</span>
            </span>
          </a>
          <button
            className="icon-button mobile-close"
            aria-label="Close navigation"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="workspace-switch">
          <span className="store-icon">
            <Icon name="store" size={19} />
          </span>
          <div>
            <strong>{workspaceName}</strong>
            <span>Demo workspace</span>
          </div>
          <span className="workspace-badge">DEMO</span>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          <ul className="nav-list">
            {navigation.map((item) => (
              <li key={item.label}>
                <button
                  className={`nav-item ${item.label === activeView ? "active" : ""}`}
                  aria-label={item.label}
                  aria-current={item.label === activeView ? "page" : undefined}
                  onClick={() => navigate(item.label)}
                >
                  <Icon name={item.icon} size={19} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="nav-badge">{item.badge}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon">
              <Icon name="bolt" size={18} />
            </span>
            <strong>Good data. Better decisions.</strong>
            <p>
              Your store's growth story,
              <br />
              all in one place.
            </p>
            <span className="demo-note">You're exploring a demo</span>
          </div>
          <button
            className={`nav-item ${activeView === "Settings" ? "active" : ""}`}
            aria-current={activeView === "Settings" ? "page" : undefined}
            onClick={() => navigate("Settings")}
          >
            <Icon name="settings" size={19} />
            <span>Settings</span>
          </button>
          <button
            className={`nav-item ${activeView === "Help & resources" ? "active" : ""}`}
            aria-current={
              activeView === "Help & resources" ? "page" : undefined
            }
            onClick={() => navigate("Help & resources")}
          >
            <Icon name="help" size={19} />
            <span>Help & resources</span>
            <Icon name="external" size={15} />
          </button>
          <div className="sidebar-account">
            <span className="avatar avatar-small">RP</span>
            <div>
              <strong>Rajan Puri</strong>
              <span>Workspace owner</span>
            </div>
            <span className="owner-indicator" />
          </div>
        </div>
      </aside>
    </>
  );
}
