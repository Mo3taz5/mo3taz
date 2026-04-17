import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

import "./security-dashboard.scss";

const STATUS_COLORS = {
  protected: "#22c55e",
  partial: "#eab308",
  warning: "#ef4444",
} as const;

const THREAT_COLORS = {
  critical: "#ef4444",
  suspicious: "#f97316",
  moderate: "#eab308",
  low: "#22c55e",
} as const;

export function SecurityDashboard() {
  const { t } = useTranslation("settings");
  const [stats, setStats] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      console.log("[SecurityDashboard] Fetching data...");
      const [newStats, newEvents] = await Promise.all([
        window.electron.getSecurityStats(),
        window.electron.getSecurityEvents(50),
      ]);
      console.log("[SecurityDashboard] Got stats:", newStats);
      console.log("[SecurityDashboard] Got events:", newEvents);
      setStats(newStats);
      setEvents(newEvents);
      setLastUpdate(new Date());
      setError(null);
    } catch (err: any) {
      console.error("[SecurityDashboard] Failed to fetch data", err);
      setError(err.message || "Failed to load");
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    const unsubscribe = window.electron.onSecurityEvent(() => {
      fetchData();
    });
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [fetchData]);

  const getStatus = (): "protected" | "partial" | "warning" => {
    if (!stats) return "partial";
    if (stats.threatCounts.critical > 0 || stats.threatCounts.suspicious > 0)
      return "warning";
    if (stats.threatCounts.moderate > 0) return "partial";
    return "protected";
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const formatAction = (action: string) => {
    const labels: Record<string, string> = {
      quarantine: t("action_quarantine", { defaultValue: "Quarantined" }),
      terminate: t("action_terminate", { defaultValue: "Terminated" }),
      block_network: t("action_blocked", { defaultValue: "Blocked" }),
      restrict_access: t("action_restricted", { defaultValue: "Restricted" }),
      log_only: t("action_logged", { defaultValue: "Logged" }),
      allow: t("action_allowed", { defaultValue: "Allowed" }),
    };
    return labels[action] || action;
  };

  const status = getStatus();
  const statusColor = STATUS_COLORS[status];

  return (
    <div className="security-dashboard">
      <div className="security-dashboard__header">
        <h2>
          {t("security_dashboard", { defaultValue: "Security Dashboard" })}
        </h2>
        <span className="security-dashboard__timestamp">
          {t("last_updated", { defaultValue: "Updated" })}:{" "}
          {formatTime(lastUpdate.getTime())}
        </span>
      </div>

      <div
        className="security-dashboard__status-card"
        style={{ borderColor: statusColor }}
      >
        <div
          className="security-dashboard__shield"
          style={{ color: statusColor }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div className="security-dashboard__status-info">
          <h3 style={{ color: statusColor }}>
            {status === "protected"
              ? t("status_protected", { defaultValue: "Protected" })
              : status === "partial"
                ? t("status_partial", { defaultValue: "Partial Protection" })
                : t("status_warning", { defaultValue: "Warning" })}
          </h3>
          <p>
            {stats
              ? t("threat_summary", {
                  defaultValue:
                    "{{critical}} critical, {{suspicious}} suspicious",
                  critical: stats.threatCounts.critical,
                  suspicious: stats.threatCounts.suspicious,
                })
              : t("loading", { defaultValue: "Loading..." })}
          </p>
        </div>
      </div>

      <div className="security-dashboard__stats">
        <div className="security-dashboard__stat">
          <span className="security-dashboard__stat-value">
            {stats?.activeIsolations ?? 0}
          </span>
          <span className="security-dashboard__stat-label">
            {t("active_isolations", { defaultValue: "Active Isolations" })}
          </span>
        </div>
        <div className="security-dashboard__stat">
          <span className="security-dashboard__stat-value">
            {stats?.quarantinedFiles ?? 0}
          </span>
          <span className="security-dashboard__stat-label">
            {t("quarantined", { defaultValue: "Quarantined" })}
          </span>
        </div>
        <div className="security-dashboard__stat">
          <span className="security-dashboard__stat-value">
            {stats?.totalEvents ?? 0}
          </span>
          <span className="security-dashboard__stat-label">
            {t("total_events", { defaultValue: "Total Events" })}
          </span>
        </div>
      </div>

      <div className="security-dashboard__events">
        <h3>
          {t("recent_events", { defaultValue: "Recent Security Events" })}
        </h3>
        {events.length === 0 ? (
          <p className="security-dashboard__empty">
            {t("no_events", {
              defaultValue: "No security events recorded yet.",
            })}
          </p>
        ) : (
          <div className="security-dashboard__events-table">
            <div className="security-dashboard__events-header">
              <span>{t("time", { defaultValue: "Time" })}</span>
              <span>{t("threat", { defaultValue: "Threat" })}</span>
              <span>{t("action", { defaultValue: "Action" })}</span>
              <span>{t("description", { defaultValue: "Description" })}</span>
            </div>
            {events
              .slice(-10)
              .reverse()
              .map((event) => (
                <div key={event.id} className="security-dashboard__event-row">
                  <span className="security-dashboard__event-time">
                    {formatTime(event.timestamp)}
                  </span>
                  <span
                    className="security-dashboard__event-threat"
                    style={{ color: THREAT_COLORS[event.threatLevel] }}
                  >
                    {event.threatLevel}
                  </span>
                  <span className="security-dashboard__event-action">
                    {formatAction(event.action)}
                  </span>
                  <span
                    className="security-dashboard__event-desc"
                    title={event.description}
                  >
                    {event.module}: {event.description}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      {!stats?.isEnabled && (
        <div className="security-dashboard__warning">
          <p>
            {t("scan_unavailable", {
              defaultValue:
                "Security scan unavailable, proceeding with caution. Game launches are allowed but may not be scanned.",
            })}
          </p>
        </div>
      )}
    </div>
  );
}
