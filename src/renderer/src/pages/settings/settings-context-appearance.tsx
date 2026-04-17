import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { levelDBService } from "@renderer/services/leveldb.service";
import type { Theme } from "@types";
import { SettingsAppearance } from "./appearance/settings-appearance";
import { SelectField, CheckboxField } from "@renderer/components";
import "./settings-context-appearance.scss";

interface SettingsContextAppearanceProps {
  appearance: {
    theme: string | null;
    authorId: string | null;
    authorName: string | null;
  };
}

interface AppearancePreferences {
  themeMode: "dark" | "light" | "system";
  uiDensity: "comfortable" | "compact" | "cozy";
  cardScale: "small" | "regular" | "large";
  fontSize: number;
  animationsEnabled: boolean;
  defaultViewMode: "normal" | "big";
}

export function SettingsContextAppearance({
  appearance,
}: Readonly<SettingsContextAppearanceProps>) {
  const { t } = useTranslation("settings");
  const [themes, setThemes] = useState<Theme[]>([]);
  const [preferences, setPreferences] = useState<AppearancePreferences>({
    themeMode: "dark",
    uiDensity: "comfortable",
    cardScale: "regular",
    fontSize: 13,
    animationsEnabled: true,
    defaultViewMode: "normal",
  });
  const [currentThemeCode, setCurrentThemeCode] = useState<string>("");

  const loadThemes = useCallback(async () => {
    const themesList = (await levelDBService.values("themes")) as Theme[];
    setThemes(themesList);
  }, []);

  const loadPreferences = useCallback(async () => {
    try {
      const prefs = await levelDBService.get(
        "appearancePreferences",
        null,
        "json"
      );
      if (prefs && typeof prefs === "object") {
        const loaded = prefs as AppearancePreferences;
        setPreferences({
          themeMode: loaded.themeMode || "dark",
          uiDensity: loaded.uiDensity || "comfortable",
          cardScale: loaded.cardScale || "regular",
          fontSize: loaded.fontSize || 13,
          animationsEnabled: loaded.animationsEnabled !== false,
          defaultViewMode: loaded.defaultViewMode || "normal",
        });
        applyPreferences(loaded);
      }
    } catch {
      // Use defaults
    }
  }, []);

  useEffect(() => {
    loadThemes();
    loadPreferences();
  }, [loadThemes, loadPreferences]);

  useEffect(() => {
    // Get current theme's CSS code
    if (appearance.theme) {
      const activeTheme = themes.find((t) => t.id === appearance.theme);
      if (activeTheme) {
        setCurrentThemeCode(activeTheme.code || "");
      }
    } else {
      setCurrentThemeCode("");
    }
  }, [appearance.theme, themes]);

  const applyPreferences = (prefs: Partial<AppearancePreferences>) => {
    const root = document.documentElement;
    const body = document.body;

    if (prefs.themeMode) {
      const resolvedThemeMode =
        prefs.themeMode === "system"
          ? window.matchMedia?.("(prefers-color-scheme: light)").matches
            ? "light"
            : "dark"
          : prefs.themeMode;

      root.dataset.themeMode = resolvedThemeMode;
      body.dataset.themeMode = resolvedThemeMode;
    }

    if (prefs.uiDensity) {
      root.dataset.uiDensity = prefs.uiDensity;
      body.dataset.uiDensity = prefs.uiDensity;
    }

    if (prefs.cardScale) {
      root.dataset.cardScale = prefs.cardScale;
      body.dataset.cardScale = prefs.cardScale;
    }

    if (prefs.fontSize !== undefined) {
      root.style.fontSize = `${prefs.fontSize}px`;
      // Also apply to body to ensure inheritance
      document.body.style.fontSize = `${prefs.fontSize}px`;
    }

    if (prefs.animationsEnabled !== undefined) {
      if (!prefs.animationsEnabled) {
        root.style.setProperty("--animation-duration", "0s");
        root.style.setProperty("--transition-duration", "0s");
      } else {
        root.style.setProperty("--animation-duration", "");
        root.style.setProperty("--transition-duration", "");
      }
    }
  };

  const saveAndApply = async (updates: Partial<AppearancePreferences>) => {
    const newPrefs = { ...preferences, ...updates };
    setPreferences(newPrefs);
    applyPreferences(updates);
    await levelDBService.put("appearancePreferences", newPrefs, null, "json");
  };

  const handleThemeModeChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    saveAndApply({
      themeMode: event.target.value as AppearancePreferences["themeMode"],
    });
  };

  const handleFontSizeChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    saveAndApply({ fontSize: parseInt(event.target.value, 10) });
  };

  const handleDensityChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    saveAndApply({
      uiDensity: event.target.value as AppearancePreferences["uiDensity"],
    });
  };

  const handleCardScaleChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    saveAndApply({
      cardScale: event.target.value as AppearancePreferences["cardScale"],
    });
  };

  const handleAnimationsToggle = () => {
    saveAndApply({ animationsEnabled: !preferences.animationsEnabled });
  };

  const fontSizeOptions = [
    {
      key: "11",
      value: "11",
      label: t("font_size_small", { defaultValue: "Small" }),
    },
    {
      key: "13",
      value: "13",
      label: t("font_size_medium", { defaultValue: "Medium" }),
    },
    {
      key: "15",
      value: "15",
      label: t("font_size_large", { defaultValue: "Large" }),
    },
    {
      key: "17",
      value: "17",
      label: t("font_size_xlarge", { defaultValue: "Extra Large" }),
    },
  ];

  const themeModeOptions = [
    {
      key: "dark",
      value: "dark",
      label: t("theme_dark", { defaultValue: "Dark" }),
    },
    {
      key: "light",
      value: "light",
      label: t("theme_light", { defaultValue: "Light" }),
    },
    {
      key: "system",
      value: "system",
      label: t("theme_system", { defaultValue: "System" }),
    },
  ];

  const densityOptions = [
    {
      key: "comfortable",
      value: "comfortable",
      label: t("ui_density_comfortable", { defaultValue: "Comfortable" }),
    },
    {
      key: "compact",
      value: "compact",
      label: t("ui_density_compact", { defaultValue: "Compact" }),
    },
    {
      key: "cozy",
      value: "cozy",
      label: t("ui_density_cozy", { defaultValue: "Cozy" }),
    },
  ];

  const cardScaleOptions = [
    {
      key: "small",
      value: "small",
      label: t("card_scale_small", { defaultValue: "Small" }),
    },
    {
      key: "regular",
      value: "regular",
      label: t("card_scale_regular", { defaultValue: "Regular" }),
    },
    {
      key: "large",
      value: "large",
      label: t("card_scale_large", { defaultValue: "Large" }),
    },
  ];

  return (
    <div className="settings-context-appearance">
      <div className="settings-context-panel__group">
        <h3>{t("theme_mode", { defaultValue: "Theme Mode" })}</h3>
        <SelectField
          label={t("select_theme_mode", { defaultValue: "Select theme mode" })}
          value={preferences.themeMode}
          onChange={handleThemeModeChange}
          options={themeModeOptions}
        />
      </div>

      <div className="settings-context-panel__group">
        <h3>{t("display", { defaultValue: "Display" })}</h3>
        <SelectField
          label={t("font_size", { defaultValue: "Font Size" })}
          value={String(preferences.fontSize)}
          onChange={handleFontSizeChange}
          options={fontSizeOptions}
        />
        <div style={{ marginTop: "16px" }}>
          <SelectField
            label={t("card_scale", { defaultValue: "Card Scale" })}
            value={preferences.cardScale}
            onChange={handleCardScaleChange}
            options={cardScaleOptions}
          />
        </div>
        <div style={{ marginTop: "16px" }}>
          <SelectField
            label={t("default_view", { defaultValue: "Default View Mode" })}
            value={preferences.defaultViewMode}
            onChange={(e) => {
              const newPrefs = {
                ...preferences,
                defaultViewMode: e.target.value as "normal" | "big",
              };
              saveAndApply(newPrefs);
            }}
            options={[
              {
                key: "normal",
                value: "normal",
                label: t("normal_view", { defaultValue: "Normal Launcher" }),
              },
              {
                key: "big",
                value: "big",
                label: t("big_view", { defaultValue: "Big Screen (Controller UI)" }),
              },
            ]}
          />
        </div>
        <div style={{ marginTop: "16px" }}>
          <CheckboxField
            label={t("enable_animations", {
              defaultValue: "Enable animations",
            })}
            checked={preferences.animationsEnabled}
            onChange={handleAnimationsToggle}
          />
        </div>
      </div>

      {currentThemeCode && (
        <div className="settings-context-panel__group">
          <h3>
            {t("current_theme_css", {
              defaultValue: "Current Theme CSS Preview",
            })}
          </h3>
          <div className="theme-css-preview">
            <div className="theme-css-preview__header">
              <span>CSS</span>
            </div>
            <pre className="theme-css-preview__code">{currentThemeCode}</pre>
          </div>
        </div>
      )}

      <div className="settings-context-panel__group">
        <h3>{t("custom_themes", { defaultValue: "Custom Themes" })}</h3>
        <SettingsAppearance appearance={appearance} />
      </div>
    </div>
  );
}
