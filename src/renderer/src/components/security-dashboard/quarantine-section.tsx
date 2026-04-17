import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@renderer/components";
import type { QuarantinedFile } from "@types";

import "./security-dashboard.scss";

export function QuarantineSection() {
  const { t } = useTranslation("settings");
  const [files, setFiles] = useState<QuarantinedFile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFiles = useCallback(async () => {
    try {
      const quarantineFiles = await window.electron.getQuarantineFiles();
      setFiles(quarantineFiles);
    } catch (error) {
      console.error("[QuarantineSection] Failed to fetch", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleRestore = async (id: string) => {
    try {
      await window.electron.restoreFile(id);
      fetchFiles();
    } catch (error) {
      console.error("[QuarantineSection] Restore failed", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        t("confirm_delete", {
          defaultValue:
            "Are you sure you want to permanently delete this file?",
        })
      )
    ) {
      return;
    }
    try {
      await window.electron.deleteFile(id);
      fetchFiles();
    } catch (error) {
      console.error("[QuarantineSection] Delete failed", error);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
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

  if (loading) {
    return (
      <div className="quarantine-section__loading">
        {t("loading", { defaultValue: "Loading..." })}
      </div>
    );
  }

  return (
    <div className="quarantine-section">
      <div className="quarantine-section__header">
        <h3>{t("quarantine_vault", { defaultValue: "Quarantine Vault" })}</h3>
        <span className="quarantine-section__count">
          {files.length} {t("files", { defaultValue: "files" })}
        </span>
      </div>

      {files.length === 0 ? (
        <p className="quarantine-section__empty">
          {t("no_quarantined", { defaultValue: "No files in quarantine." })}
        </p>
      ) : (
        <div className="quarantine-section__list">
          {files.map((file) => (
            <div key={file.id} className="quarantine-section__file">
              <div className="quarantine-section__file-info">
                <span
                  className="quarantine-section__threat-level"
                  style={{ color: getThreatColor(file.threatLevel) }}
                >
                  {file.threatLevel}
                </span>
                <span
                  className="quarantine-section__file-path"
                  title={file.originalPath}
                >
                  {file.originalPath.split("\\").pop() ||
                    file.originalPath.split("/").pop()}
                </span>
                <span className="quarantine-section__date">
                  {formatDate(file.timestamp)}
                </span>
                <span className="quarantine-section__reason">
                  {file.reason}
                </span>
              </div>
              <div className="quarantine-section__actions">
                <Button
                  theme="outline"
                  size="small"
                  onClick={() => handleRestore(file.id)}
                >
                  {t("restore", { defaultValue: "Restore" })}
                </Button>
                <Button
                  theme="danger"
                  size="small"
                  onClick={() => handleDelete(file.id)}
                >
                  {t("delete", { defaultValue: "Delete" })}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
