import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@renderer/components";
import type { QuarantinedFile } from "@types";

import "./quarantine-history.scss";

export default function QuarantineHistory() {
  const { t } = useTranslation("settings");
  const navigate = useNavigate();

  const [files, setFiles] = useState<QuarantinedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await window.api.getQuarantineFiles();
      setFiles(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load quarantine history."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const groupedCounts = useMemo(() => {
    return files.reduce(
      (accumulator, file) => {
        accumulator[file.riskCategory] += 1;
        return accumulator;
      },
      {
        "Low Risk": 0,
        "Requires Investigation": 0,
      }
    );
  }, [files]);

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    try {
      await window.api.restoreFile(id);
      await loadFiles();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to restore the selected file."
      );
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="quarantine-history">
      <div className="quarantine-history__header">
        <div>
          <h2>{t("quarantine_history", { defaultValue: "Quarantine History" })}</h2>
          <p>
            {t("quarantine_history_description", {
              defaultValue:
                "Review files the launcher quarantined and restore the ones you trust.",
            })}
          </p>
        </div>

        <Button theme="outline" onClick={() => navigate("/settings")}>
          {t("back_to_settings", { defaultValue: "Back to settings" })}
        </Button>
      </div>

      <div className="quarantine-history__summary">
        <span>
          {t("low_risk_count", {
            defaultValue: "Low Risk: {{count}}",
            count: groupedCounts["Low Risk"],
          })}
        </span>
        <span>
          {t("requires_investigation_count", {
            defaultValue: "Requires Investigation: {{count}}",
            count: groupedCounts["Requires Investigation"],
          })}
        </span>
      </div>

      {isLoading ? (
        <div className="quarantine-history__empty-state">
          {t("loading_quarantine_history", {
            defaultValue: "Loading quarantine history...",
          })}
        </div>
      ) : errorMessage ? (
        <div className="quarantine-history__empty-state quarantine-history__empty-state--error">
          {errorMessage}
        </div>
      ) : files.length === 0 ? (
        <div className="quarantine-history__empty-state">
          {t("no_quarantined_files", {
            defaultValue: "There are no quarantined files right now.",
          })}
        </div>
      ) : (
        <div className="quarantine-history__list">
          {files.map((file) => (
            <article key={file.id} className="quarantine-history__card">
              <div className="quarantine-history__card-header">
                <div className="quarantine-history__badge-group">
                  <span
                    className={`quarantine-history__badge quarantine-history__badge--${file.riskCategory === "Low Risk" ? "low" : "high"}`}
                  >
                    {file.riskCategory}
                  </span>
                  <span className="quarantine-history__signature">
                    {file.signature ?? "Unknown signature"}
                  </span>
                </div>

                <Button
                  theme="outline"
                  disabled={restoringId === file.id}
                  onClick={() => void handleRestore(file.id)}
                >
                  {restoringId === file.id
                    ? t("restoring", { defaultValue: "Restoring..." })
                    : t("restore", { defaultValue: "Restore" })}
                </Button>
              </div>

              <div className="quarantine-history__meta">
                <div>
                  <span className="quarantine-history__label">
                    {t("reason", { defaultValue: "Reason" })}
                  </span>
                  <p>{file.reason}</p>
                </div>

                <div>
                  <span className="quarantine-history__label">
                    {t("original_path", { defaultValue: "Original path" })}
                  </span>
                  <p className="quarantine-history__path">{file.originalPath}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
