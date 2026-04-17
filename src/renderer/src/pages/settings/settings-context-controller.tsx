import { useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Gamepad2 } from "lucide-react";

import { Button, SelectField } from "@renderer/components";
import { settingsContext } from "@renderer/context";
import { useAppSelector, useControllerLayout } from "@renderer/hooks";
import type { ControllerLayoutPreference } from "@types";
import {
  getControllerLayoutDisplayName,
  type ResolvedControllerLayout,
} from "@renderer/helpers/controller-layout";

import xboxPreview from "@renderer/assets/icons/controller-xbox.png";
import psPreview from "@renderer/assets/icons/controller-ps.png";

import "./settings-context-controller.scss";

const layoutOptions: {
  key: ControllerLayoutPreference;
  value: ControllerLayoutPreference;
  label: string;
}[] = [
  { key: "auto", value: "auto", label: "Auto" },
  { key: "xbox", value: "xbox", label: "Xbox" },
  { key: "playstation", value: "playstation", label: "PlayStation" },
];

function LayoutPreviewCard({
  layout,
  activeLayout,
  title,
  description,
  image,
  badge,
}: {
  layout: ResolvedControllerLayout;
  activeLayout: ResolvedControllerLayout;
  title: string;
  description: string;
  image: string;
  badge: string;
}) {
  return (
    <article
      className={`settings-context-controller__preview-card ${
        activeLayout === layout
          ? "settings-context-controller__preview-card--active"
          : ""
      }`}
    >
      <div className="settings-context-controller__preview-art">
        <img src={image} alt={title} />
      </div>
      <div className="settings-context-controller__preview-meta">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <div className="settings-context-controller__preview-badge">{badge}</div>
    </article>
  );
}

export function SettingsContextController() {
  const { t } = useTranslation("settings");
  const { updateUserPreferences } = useContext(settingsContext);
  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );

  const [controllerLayout, setControllerLayout] =
    useState<ControllerLayoutPreference>("auto");

  useEffect(() => {
    if (!userPreferences) return;
    setControllerLayout(userPreferences.controllerLayout ?? "auto");
  }, [userPreferences]);

  const {
    detectedLayout,
    detectedLabel,
    detectedRawId,
    resolvedLayout,
  } = useControllerLayout(controllerLayout);

  const selectedLayout = resolvedLayout;

  const statusText = useMemo(() => {
    if (controllerLayout !== "auto") {
      return t("controller_layout_manual_status", {
        defaultValue: "Manual layout selected",
      });
    }

    if (!detectedLayout) {
      return t("controller_layout_no_controller", {
        defaultValue: "No controller detected right now",
      });
    }

    return t("controller_layout_auto_status", {
      defaultValue: "Auto mode is using {{controller}}",
      controller: detectedLabel ?? getControllerLayoutDisplayName(detectedLayout),
    });
  }, [controllerLayout, detectedLabel, detectedLayout, t]);

  const handleLayoutChange = async (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = event.target.value as ControllerLayoutPreference;
    setControllerLayout(value);
    await updateUserPreferences({ controllerLayout: value });
  };

  return (
    <div className="settings-context-panel settings-context-controller">
      <div className="settings-context-panel__group">
        <h3>{t("controller_layout", { defaultValue: "Controller layout" })}</h3>

        <div className="settings-context-controller__header">
          <Gamepad2 size={18} />
          <div>
            <strong>{statusText}</strong>
            <span>
              {detectedRawId
                ? t("controller_layout_detected_from", {
                    defaultValue: "Detected from: {{name}}",
                    name: detectedRawId,
                  })
                : t("controller_layout_detected_from_none", {
                    defaultValue: "Waiting for a connected controller",
                  })}
            </span>
          </div>
        </div>

        <SelectField
          label={t("controller_layout_select", {
            defaultValue: "Choose controller layout",
          })}
          value={controllerLayout}
          onChange={handleLayoutChange}
          options={layoutOptions}
        />

        <p className="settings-context-controller__hint">
          {t("controller_layout_hint", {
            defaultValue:
              "Auto follows the first detected controller. Manual mode keeps the selected layout.",
          })}
        </p>
      </div>

      <div className="settings-context-panel__group">
        <h3>{t("controller_preview", { defaultValue: "Layout preview" })}</h3>

        <div className="settings-context-controller__preview-grid">
          <LayoutPreviewCard
            layout="xbox"
            activeLayout={selectedLayout}
            title={t("xbox", { defaultValue: "Xbox" })}
            description={t("controller_layout_xbox_desc", {
              defaultValue: "A / B / X / Y button labels",
            })}
            image={xboxPreview}
            badge="A B X Y"
          />
          <LayoutPreviewCard
            layout="playstation"
            activeLayout={selectedLayout}
            title={t("playstation", { defaultValue: "PlayStation" })}
            description={t("controller_layout_ps_desc", {
              defaultValue: "Cross / Circle / Square / Triangle labels",
            })}
            image={psPreview}
            badge="Cross Circle Square Triangle"
          />
        </div>

        <div className="settings-context-controller__legend">
          <div>
            <strong>{t("select", { defaultValue: "Select" })}</strong>
            <span>
              {selectedLayout === "playstation" ? "Cross" : "A"}
            </span>
          </div>
          <div>
            <strong>{t("back", { defaultValue: "Back" })}</strong>
            <span>
              {selectedLayout === "playstation" ? "Circle" : "B"}
            </span>
          </div>
          <div>
            <strong>{t("options", { defaultValue: "Options" })}</strong>
            <span>
              {selectedLayout === "playstation" ? "Square" : "X"}
            </span>
          </div>
          <div>
            <strong>{t("search", { defaultValue: "Search" })}</strong>
            <span>
              {selectedLayout === "playstation" ? "Triangle" : "Y"}
            </span>
          </div>
        </div>

        <div className="settings-context-controller__actions">
          <Button
            theme="outline"
            onClick={async () => {
              const nextLayout: ControllerLayoutPreference = "auto";
              setControllerLayout(nextLayout);
              await updateUserPreferences({ controllerLayout: nextLayout });
            }}
          >
            {t("reset_to_auto", { defaultValue: "Reset to auto" })}
          </Button>
        </div>
      </div>
    </div>
  );
}
