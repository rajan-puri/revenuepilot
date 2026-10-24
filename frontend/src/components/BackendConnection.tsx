import { useEffect, useState } from "react";
import { checkBackendHealth } from "../utils/api";
import { Icon } from "./Icon";

type ConnectionState = "checking" | "connected" | "disconnected";

export function BackendConnection() {
  const [state, setState] = useState<ConnectionState>("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void checkBackendHealth(controller.signal)
      .then(() => {
        if (!controller.signal.aborted) setState("connected");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("disconnected");
      });
    // Ignore cancelled requests after unmount or React's development effect replay.
    return () => controller.abort();
  }, [attempt]);

  return (
    <div className={`backend-connection ${state}`}>
      <span role="status" aria-live="polite" aria-atomic="true">
        <Icon
          name={
            state === "connected"
              ? "check"
              : state === "disconnected"
                ? "info"
                : "recovery"
          }
          size={14}
        />
        {state === "checking"
          ? "Backend: Checking connection…"
          : state === "connected"
            ? "Backend: Connected"
            : "Backend: Disconnected"}
      </span>
      {state === "disconnected" && (
        <button
          className="text-button"
          aria-label="Retry backend connection"
          onClick={() => {
            setState("checking");
            setAttempt((value) => value + 1);
          }}
        >
          Retry
          <Icon name="recovery" size={12} />
        </button>
      )}
    </div>
  );
}
