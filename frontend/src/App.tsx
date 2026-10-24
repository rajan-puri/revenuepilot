import { useCallback, useEffect, useRef, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import {
  DashboardHeader,
  OpportunitiesPanel,
  OrdersTable,
} from "./components/Dashboard";
import { Icon } from "./components/Icon";
import { WorkspaceViews } from "./components/WorkspaceViews";
import { BackendConnection } from "./components/BackendConnection";
import { LiveOverview } from "./components/LiveOverview";
import type { OrderFilters } from "./components/Dashboard";
import { periods, viewTitles } from "./data/dashboard";
import type { PeriodKey, ViewName } from "./data/dashboard";
import "./App.css";
import "./theme.css";

function App() {
  const [periodKey, setPeriodKey] = useState<PeriodKey>("30d");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [activeView, setActiveView] = useState<ViewName>("Overview");
  const [workspaceName, setWorkspaceName] = useState("The Everyday Store");
  const [orderFilters, setOrderFilters] = useState<OrderFilters>({
    search: "",
    status: "All statuses",
  });
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const period = periods[periodKey];

  useEffect(() => {
    document.title = `${viewTitles[activeView]} · RevenuePilot`;
    const frame = requestAnimationFrame(() => {
      document.getElementById("main-content")?.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeView]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
    menuTrigger.current?.focus();
  }, []);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to dashboard
      </a>
      <Sidebar
        open={sidebarOpen}
        onClose={closeSidebar}
        activeView={activeView}
        workspaceName={workspaceName}
        onNavigate={setActiveView}
      />
      <div className="app-main">
        <DashboardHeader
          periodKey={periodKey}
          onPeriodChange={setPeriodKey}
          onMenuOpen={() => setSidebarOpen(true)}
          menuTrigger={menuTrigger}
          sidebarOpen={sidebarOpen}
          activeView={activeView}
          workspaceName={workspaceName}
        />
        <main id="main-content" tabIndex={-1}>
          {activeView === "Overview" ? (
            <>
              <div className="overview-intro">
                <div>
                  <p className="eyebrow">YOUR STORE, AT A GLANCE</p>
                  <h2>A clearer picture of your revenue.</h2>
                  <p>
                    See what's growing, what's working, and where to go next.
                  </p>
                </div>
                <div className="demo-indicator">
                  <span />
                  <strong>Live store</strong>
                  <span className="demo-divider" />
                  WooCommerce metrics
                </div>
              </div>
              <LiveOverview periodKey={periodKey} />
              <div className="dashboard-bottom">
                <OrdersTable
                  filters={orderFilters}
                  onFiltersChange={setOrderFilters}
                  onViewAll={() => setActiveView("Orders")}
                />
                <OpportunitiesPanel />
              </div>
            </>
          ) : (
            <WorkspaceViews
              activeView={activeView}
              period={period}
              filters={orderFilters}
              onFiltersChange={setOrderFilters}
              workspaceName={workspaceName}
              onSaveWorkspace={(name) => {
                setWorkspaceName(name);
                setNotice("Demo workspace settings saved for this session.");
              }}
            />
          )}
          <footer className="dashboard-footer">
            <BackendConnection />
            <span>
              RevenuePilot <span aria-hidden="true">·</span> Demo data. No store
              connected.
            </span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Icon name="info" size={18} />
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => setNotice("")}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </>
  );
}

export default App;
