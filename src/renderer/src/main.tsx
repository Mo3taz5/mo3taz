import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { Provider } from "react-redux";
import LanguageDetector from "i18next-browser-languagedetector";
import { HashRouter, Route, Routes } from "react-router-dom";

import "@fontsource/noto-sans/400.css";
import "@fontsource/noto-sans/500.css";
import "@fontsource/noto-sans/700.css";

import "react-loading-skeleton/dist/skeleton.css";
import "react-tooltip/dist/react-tooltip.css";

import { App } from "./app";

import { store } from "./store";

import resources from "@locales";

import { logger } from "./logger";
import { addCookieInterceptor } from "./cookies";
import * as Sentry from "@sentry/react";
import { levelDBService } from "./services/leveldb.service";
import { detectLanguageFromIP } from "./services/ip-language.service";

const Catalogue = lazy(() => import("./pages/catalogue/catalogue"));
const Home = lazy(() => import("./pages/home/home"));
const Downloads = lazy(() => import("./pages/downloads/downloads"));
const GameDetails = lazy(() => import("./pages/game-details/game-details"));
const Settings = lazy(() => import("./pages/settings/settings"));
const Profile = lazy(() => import("./pages/profile/profile"));
const Achievements = lazy(() => import("./pages/achievements/achievements"));
const ThemeEditor = lazy(() => import("./pages/theme-editor/theme-editor"));
const Library = lazy(() => import("./pages/library/library"));
const Notifications = lazy(() => import("./pages/notifications/notifications"));
const GameLauncher = lazy(() => import("./pages/game-launcher/game-launcher"));
const QuarantineHistory = lazy(
  () => import("./pages/quarantine/QuarantineHistory")
);
const AchievementNotification = lazy(() =>
  import("./pages/achievements/notification/achievement-notification").then(
    (m) => ({ default: m.AchievementNotification })
  )
);

function PageLoader() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
      }}
    >
      Loading...
    </div>
  );
}

function RouteWrapper({ element }: { element: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{element}</Suspense>;
}

console.log = logger.log;

Sentry.init({
  dsn: import.meta.env.RENDERER_VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 0.5,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  release: "hydra-launcher@" + (await window.electron.getVersion()),
});

const isStaging = await window.electron.isStaging();
addCookieInterceptor(isStaging);

const syncDocumentLanguage = (language: string) => {
  document.documentElement.lang = language;
  document.documentElement.dir = i18n.dir(language);
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  })
  .then(async () => {
    const userPreferences = (await levelDBService.get(
      "userPreferences",
      null,
      "json"
    )) as { language?: string; languageAutoDetected?: boolean } | null;

    const shouldAutoDetectLanguage =
      !userPreferences?.language ||
      userPreferences.languageAutoDetected !== false;

    if (shouldAutoDetectLanguage) {
      // Auto-detected language should win unless the user explicitly locked one in settings.
      logger.log(
        "[Language] No locked language preference found, detecting from current IP"
      );
      const detectedLanguage = await detectLanguageFromIP();
      logger.log(
        `[Language] Current IP resolved to language: ${detectedLanguage}`
      );

      // Only apply detected language if it differs from current.
      if (detectedLanguage !== i18n.language) {
        await i18n.changeLanguage(detectedLanguage);
      }

      // Persist the auto-detected language so the UI and backend stay aligned.
      void window.electron.updateUserPreferences({
        language: i18n.language,
        languageAutoDetected: true,
      });
      logger.log(`[Language] Saved auto-detected language: ${i18n.language}`);
    } else {
      logger.log(
        `[Language] Using saved language preference: ${userPreferences.language}`
      );
      await i18n.changeLanguage(userPreferences.language);
    }

    logger.log(`[Language] Startup language finalized: ${i18n.language}`);
    syncDocumentLanguage(i18n.language);
    i18n.on("languageChanged", syncDocumentLanguage);
  });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <HashRouter>
        <Routes>
          <Route element={<App />}>
            <Route path="/" element={<RouteWrapper element={<Home />} />} />
            <Route
              path="/catalogue"
              element={<RouteWrapper element={<Catalogue />} />}
            />
            <Route
              path="/library"
              element={<RouteWrapper element={<Library />} />}
            />
            <Route
              path="/downloads"
              element={<RouteWrapper element={<Downloads />} />}
            />
            <Route
              path="/game/:shop/:objectId"
              element={<RouteWrapper element={<GameDetails />} />}
            />
            <Route
              path="/settings"
              element={<RouteWrapper element={<Settings />} />}
            />
            <Route
              path="/quarantine"
              element={<RouteWrapper element={<QuarantineHistory />} />}
            />
            <Route
              path="/profile/:userId"
              element={<RouteWrapper element={<Profile />} />}
            />
            <Route
              path="/achievements"
              element={<RouteWrapper element={<Achievements />} />}
            />
            <Route
              path="/notifications"
              element={<RouteWrapper element={<Notifications />} />}
            />
          </Route>

          <Route
            path="/theme-editor"
            element={<RouteWrapper element={<ThemeEditor />} />}
          />
          <Route
            path="/achievement-notification"
            element={<RouteWrapper element={<AchievementNotification />} />}
          />
          <Route
            path="/game-launcher"
            element={<RouteWrapper element={<GameLauncher />} />}
          />
        </Routes>
      </HashRouter>
    </Provider>
  </React.StrictMode>
);
