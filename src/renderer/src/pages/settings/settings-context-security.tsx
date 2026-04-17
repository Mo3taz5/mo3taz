import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { Button, CheckboxField, Modal } from "@renderer/components";
import { settingsContext } from "@renderer/context";
import { useAppSelector, useToast } from "@renderer/hooks";
import { SecurityDashboard } from "@renderer/components/security-dashboard/security-dashboard";
import { SecurityEvents } from "@renderer/components/security-dashboard/security-events";

import "./settings-security.scss";

export function SettingsContextSecurity() {
  const { t } = useTranslation("settings");
  const navigate = useNavigate();
  const { showSuccessToast, showErrorToast } = useToast();
  const { updateUserPreferences } = useContext(settingsContext);
  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );
  const [isScanningAll, setIsScanningAll] = useState(false);
  const [showEvents, setShowEvents] = useState(false);

  const scanAfterDownloadComplete =
    userPreferences?.scanAfterDownloadComplete ?? true;

  const handleToggleScanAfterDownload = async () => {
    try {
      await updateUserPreferences({
        scanAfterDownloadComplete: !scanAfterDownloadComplete,
      });
    } catch (error) {
      void error;
      showErrorToast(
        t("failed_update_settings", {
          defaultValue: "Unable to save security settings.",
        })
      );
    }
  };

  const handleScanInstalledGames = async () => {
    if (isScanningAll) return;

    setIsScanningAll(true);

    try {
      const result = await window.electron.scanInstalledGames();
      const foundCount = result.foundGames.length;

      if (foundCount > 0) {
        showErrorToast(
          t("scan_games_complete_description", {
            defaultValue:
              "Installed games were scanned and suspicious files were flagged.",
            count: foundCount,
          })
        );
      } else {
        showSuccessToast(
          t("scan_games_no_results_description", {
            defaultValue:
              "Installed games were scanned and no issues were found.",
            count: foundCount,
          })
        );
      }
    } catch (error) {
      void error;
      showErrorToast(
        t("scan_games_failed", {
          defaultValue: "Installed game scan could not be completed.",
        })
      );
    } finally {
      setIsScanningAll(false);
    }
  };

  return (
    <div className="settings-context-panel">
      <SecurityDashboard />
      <button
        className="security-events-button"
        onClick={() => setShowEvents(true)}
      >
        {t("view_events", { defaultValue: "View Security Events" })}
      </button>
      {showEvents && (
        <Modal
          visible
          onClose={() => setShowEvents(false)}
          title="Security Events"
          large
        >
          <SecurityEvents />
        </Modal>
      )}
      <div className="settings-context-panel__group">
        <h3>
          {t("anti_malware_system", { defaultValue: "Anti-malware system" })}
        </h3>

        <p className="settings-security__description">
          {t("anti_malware_system_description", {
            defaultValue:
              "The launcher can scan downloads and installed games for malware-like behavior, then keep anything suspicious in quarantine.",
          })}
        </p>

        <CheckboxField
          label={t("scan_after_download_complete", {
            defaultValue: "Scan after download",
          })}
          checked={scanAfterDownloadComplete}
          onChange={() => {
            void handleToggleScanAfterDownload();
          }}
        />

        <p className="settings-security__hint">
          {t("security_threat_action_hint", {
            defaultValue:
              "Suspicious files are recorded in quarantine with a reason so they can be reviewed or restored later.",
          })}
        </p>
      </div>

      <div className="settings-context-panel__group">
        <h3>{t("scan_tools", { defaultValue: "Scan tools" })}</h3>

        <div className="settings-security__actions">
          <Button
            theme="outline"
            onClick={() => {
              void handleScanInstalledGames();
            }}
            disabled={isScanningAll}
          >
            {isScanningAll
              ? t("scan_games_scanning", {
                  defaultValue: "Scanning installed games...",
                })
              : t("scan_installed_games", {
                  defaultValue: "Scan installed games for malware",
                })}
          </Button>

          <Button theme="outline" onClick={() => navigate("/quarantine")}>
            {t("open_quarantine_history", {
              defaultValue: "Open quarantine history",
            })}
          </Button>
        </div>
      </div>
    </div>
  );
}
