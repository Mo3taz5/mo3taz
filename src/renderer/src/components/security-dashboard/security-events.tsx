import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

import "./security-events.scss";

export function SecurityEvents() {
  const { t } = useTranslation("settings");
  const [events, setEvents] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.electron.getSecurityEvents(20);
      setEvents(data);
    } catch (err) {
      console.error("[SecurityEvents] Failed to fetch", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchEvents();
    }
  }, [isOpen, fetchEvents]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getThreatColor = (level: string) => {
    const colors: Record<string, string> = {
      critical: "#ef4444",
      suspicious: "#f97316",
      moderate: "#eab308",
      low: "#22c55e",
    };
    return colors[level] || "#22c55e";
  };

  if (isOpen) {
    return (
      <div className="security-events">
        <div className="security-events__header">
          <h3>
            {t("recent_events", { defaultValue: "Recent Security Events" })}
          </h3>
          <button
            className="security-events__close"
            onClick={() => setIsOpen(false)}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="security-events__loading">
            {t("loading", { defaultValue: "Loading..." })}
          </div>
        ) : events.length === 0 ? (
          <div className="security-events__empty">
            {t("no_events", {
              defaultValue: "No security events recorded yet.",
            })}
          </div>
        ) : (
          <div className="security-events__list">
            {events.map((event) => (
              <div key={event.id} className="security-events__item">
                <div className="security-events__item-header">
                  <span
                    className="security-events__threat"
                    style={{ color: getThreatColor(event.threatLevel) }}
                  >
                    {event.threatLevel}
                  </span>
                  <span className="security-events__time">
                    {formatTime(event.timestamp)}
                  </span>
                </div>
                <div className="security-events__description">
                  {event.description}
                </div>
                <div className="security-events__module">{event.module}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button className="security-events-button" onClick={() => setIsOpen(true)}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
      <span>{t("security_events", { defaultValue: "Security Events" })}</span>
      {events.length > 0 && (
        <span className="security-events-button__badge">{events.length}</span>
      )}
    </button>
  );
}
