import {
  BrowserWindow,
  Menu,
  MenuItem,
  MenuItemConstructorOptions,
  Tray,
  app,
  nativeImage,
  screen,
  shell,
} from "electron";
import { is } from "@electron-toolkit/utils";
import { t } from "i18next";
import path from "node:path";
import fs from "node:fs";
import icon from "@resources/icon.png?asset";
import trayIcon from "@resources/tray-icon.png?asset";
import icoIcon from "@resources/icon.ico?asset";
import { HydraApi } from "./hydra-api";
import UserAgent from "user-agents";
import { db, gamesSublevel, levelKeys } from "@main/level";
import { orderBy, slice } from "lodash-es";
import type {
  AchievementCustomNotificationPosition,
  ScreenState,
  UserPreferences,
} from "@types";
import { AuthPage, generateAchievementCustomNotificationTest } from "@shared";
import { logger } from "./logger";

// Load the output.gif as base64 data URL for injection into auth window
const outputGifPath = path.join(
  __dirname,
  is.dev ? "../../../output.gif" : "../../output.gif"
);
let outputGifDataUrl = "";
try {
  if (fs.existsSync(outputGifPath)) {
    const gifBuffer = fs.readFileSync(outputGifPath);
    outputGifDataUrl = `data:image/gif;base64,${gifBuffer.toString("base64")}`;
    logger.log(
      `[WindowManager] output.gif loaded successfully (${gifBuffer.length} bytes)`
    );
  } else {
    logger.warn(`[WindowManager] output.gif not found at: ${outputGifPath}`);
  }
} catch (err) {
  logger.error(`[WindowManager] Failed to load output.gif:`, err);
}

// Use the app icon - ICO for Windows (proper taskbar), PNG for others
// For Windows, we need to use nativeImage to properly load ICO
const windowIcon =
  process.platform === "win32"
    ? nativeImage.createFromPath(icoIcon)
    : nativeImage.createFromPath(icon);

export class WindowManager {
  public static mainWindow: Electron.BrowserWindow | null = null;
  public static notificationWindow: Electron.BrowserWindow | null = null;
  public static gameLauncherWindow: Electron.BrowserWindow | null = null;

  private static readonly editorWindows: Map<string, BrowserWindow> = new Map();

  private static initialConfigInitializationMainWindow: Electron.BrowserWindowConstructorOptions =
    {
      width: 1200,
      height: 860,
      minWidth: 1024,
      minHeight: 860,
      backgroundColor: "#1c1c1c",
      titleBarStyle: process.platform === "linux" ? "default" : "hidden",
      icon: windowIcon,
      trafficLightPosition: { x: 16, y: 16 },
      titleBarOverlay: {
        symbolColor: "#DADBE1",
        color: "#00000000",
        height: 34,
      },
      webPreferences: {
        preload: path.join(__dirname, "../preload/index.mjs"),
        sandbox: false,
      },
      show: false,
    };

  private static formatVersionNumber(version: string) {
    return version.replaceAll(".", "-");
  }

  private static installDevToolsToggle(window: BrowserWindow) {
    window.webContents.on("before-input-event", (event, input) => {
      if (input.key !== "F12") {
        return;
      }

      event.preventDefault();
      window.webContents.toggleDevTools();
    });
  }

  private static async loadWindowURL(window: BrowserWindow, hash: string = "") {
    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
      window.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}#/${hash}`);
    } else if (import.meta.env.MAIN_VITE_LAUNCHER_SUBDOMAIN) {
      // Try to load from remote URL in production
      try {
        // Add a 5s timeout to prevent hanging
        const loadPromise = window.loadURL(
          `https://release-v${this.formatVersionNumber(app.getVersion())}.${import.meta.env.MAIN_VITE_LAUNCHER_SUBDOMAIN}#/${hash}`
        );
        const timeout = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Remote URL load timeout")), 5000);
        });
        await Promise.race([loadPromise, timeout]);
      } catch (error) {
        // Fall back to local file if remote URL fails
        logger.error(
          "Failed to load from MAIN_VITE_LAUNCHER_SUBDOMAIN, falling back to local file:",
          error
        );
        window.loadFile(path.join(__dirname, "../renderer/index.html"), {
          hash,
        });
      }
    } else {
      window.loadFile(path.join(__dirname, "../renderer/index.html"), {
        hash,
      });
    }
  }

  private static async loadMainWindowURL(hash: string = "") {
    if (this.mainWindow) {
      await this.loadWindowURL(this.mainWindow, hash);
    }
  }

  private static async saveScreenConfig(configScreenWhenClosed: ScreenState) {
    await db.put(levelKeys.screenState, configScreenWhenClosed, {
      valueEncoding: "json",
    });
  }

  private static async loadScreenConfig() {
    const data = await db.get<string, ScreenState | undefined>(
      levelKeys.screenState,
      {
        valueEncoding: "json",
      }
    );
    return data ?? { isMaximized: false, height: 860, width: 1200 };
  }

  private static updateInitialConfig(
    newConfig: Partial<Electron.BrowserWindowConstructorOptions>
  ) {
    this.initialConfigInitializationMainWindow = {
      ...this.initialConfigInitializationMainWindow,
      ...newConfig,
    };
  }

  public static async createMainWindow() {
    if (this.mainWindow) return;

    const { isMaximized = false, ...configWithoutMaximized } =
      await this.loadScreenConfig();

    this.updateInitialConfig(configWithoutMaximized);

    // Create window with default size first
    this.mainWindow = new BrowserWindow(
      this.initialConfigInitializationMainWindow
    );

    // Check for default view mode preference - handled by renderer now via setControllerMode(true)
    // Keeping this log for debugging purposes
    setTimeout(async () => {
      try {
        const appearancePrefs = await db.get("appearancePreferences", { valueEncoding: "json" });
        console.log("[WindowManager] Appearance prefs loaded:", appearancePrefs);
        // Renderer handles Big Screen mode activation directly
      } catch (err) {
        console.log("[WindowManager] Error:", err);
      }
    }, 1000);

    if (isMaximized) {
      this.mainWindow.maximize();
    }

    this.mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
      (details, callback) => {
        if (
          details.webContentsId !== this.mainWindow?.webContents.id ||
          details.url.includes("chatwoot")
        ) {
          return callback(details);
        }

        if (details.url.includes("workwonders")) {
          return callback({
            ...details,
            requestHeaders: {
              Origin: "https://workwonders.app",
              ...details.requestHeaders,
            },
          });
        }

        const userAgent = new UserAgent();

        callback({
          requestHeaders: {
            ...details.requestHeaders,
            "user-agent": userAgent.toString(),
          },
        });
      }
    );

    this.mainWindow.webContents.session.webRequest.onHeadersReceived(
      (details, callback) => {
        if (
          details.webContentsId !== this.mainWindow?.webContents.id ||
          details.url.includes("featurebase") ||
          details.url.includes("chatwoot") ||
          details.url.includes("workwonders")
        ) {
          return callback(details);
        }

        const headers = {
          "access-control-allow-origin": ["*"],
          "access-control-allow-methods": ["GET, POST, PUT, DELETE, OPTIONS"],
          "access-control-expose-headers": ["ETag"],
          "access-control-allow-headers": [
            "Content-Type, Authorization, X-Requested-With, If-None-Match",
          ],
        };

        if (details.method === "OPTIONS") {
          return callback({
            cancel: false,
            responseHeaders: {
              ...details.responseHeaders,
              ...headers,
            },
            statusLine: "HTTP/1.1 200 OK",
          });
        }

        return callback({
          responseHeaders: {
            ...details.responseHeaders,
            ...headers,
          },
        });
      }
    );

    const userPreferences = await db
      .get<string, UserPreferences | null>(levelKeys.userPreferences, {
        valueEncoding: "json",
      })
      .catch(() => null);

    const initialHash = userPreferences?.launchToLibraryPage ? "library" : "";

    this.loadMainWindowURL(initialHash);
    this.mainWindow.removeMenu();

    this.installDevToolsToggle(this.mainWindow);

    this.mainWindow.webContents.on("before-input-event", (_event, input) => {
      if (input.key === "Escape" && this.mainWindow?.isFullScreen()) {
        _event.preventDefault();
        return;
      }

      if (input.key === "F2" && this.mainWindow?.isFullScreen()) {
        _event.preventDefault();
        this.mainWindow?.webContents.send("big-screen-escape");
        return;
      }
    });

    // Fallback: show window after 5s even if ready-to-show hasn't fired
    let windowShown = false;
    const showFallback = setTimeout(() => {
      if (!windowShown && this.mainWindow) {
        logger.warn("Window ready-to-show timeout reached, showing anyway");
        this.mainWindow.show();
        windowShown = true;
      }
    }, 5000);

    this.mainWindow.on("ready-to-show", () => {
      clearTimeout(showFallback);
      windowShown = true;
      WindowManager.mainWindow?.show();
    });

    // Also show on did-fail-load to debug
    this.mainWindow.webContents.on("did-fail-load", (_event, code, desc) => {
      logger.error(`Main window failed to load: ${code} - ${desc}`);
      if (!windowShown && this.mainWindow) {
        this.mainWindow.show();
        windowShown = true;
      }
    });

    this.mainWindow.on("close", async () => {
      const mainWindow = this.mainWindow;
      this.mainWindow = null;

      const userPreferences = await db.get<string, UserPreferences>(
        levelKeys.userPreferences,
        {
          valueEncoding: "json",
        }
      );

      if (mainWindow) {
        mainWindow.setProgressBar(-1);

        const lastBounds = mainWindow.getBounds();
        const isMaximized = mainWindow.isMaximized() ?? false;
        const screenConfig = isMaximized
          ? {
              x: undefined,
              y: undefined,
              height: this.initialConfigInitializationMainWindow.height ?? 860,
              width: this.initialConfigInitializationMainWindow.width ?? 1200,
              isMaximized: true,
            }
          : { ...lastBounds, isMaximized };

        await this.saveScreenConfig(screenConfig);
      }

      if (userPreferences?.preferQuitInsteadOfHiding) {
        app.quit();
      }
    });

    this.mainWindow.webContents.setWindowOpenHandler((handler) => {
      shell.openExternal(handler.url);
      return { action: "deny" };
    });
  }

  public static openAuthWindow(page: AuthPage, searchParams: URLSearchParams) {
    if (this.mainWindow) {
      const authWindow = new BrowserWindow({
        width: 600,
        height: 640,
        title: "MO3TAZ",
        icon: windowIcon,
        backgroundColor: "#1c1c1c",
        parent: this.mainWindow,
        modal: true,
        show: false,
        maximizable: false,
        resizable: false,
        minimizable: false,
        webPreferences: {
          sandbox: false,
          nodeIntegrationInSubFrames: true,
        },
      });

      authWindow.removeMenu();
      this.installDevToolsToggle(authWindow);

      const authUrl = `${import.meta.env.MAIN_VITE_AUTH_URL}${page}?${searchParams.toString()}`;
      logger.log(`[AuthWindow] Loading URL: ${authUrl}`);
      authWindow.loadURL(authUrl);

      // Handle navigation errors
      authWindow.webContents.on(
        "did-fail-load",
        (_event, errorCode, errorDescription) => {
          logger.error(
            `[AuthWindow] Failed to load: ${errorDescription} (code: ${errorCode})`
          );
        }
      );

      // Inject script to replace "Hydra" branding with "MO3TAZ" in the auth page
      authWindow.webContents.on("did-finish-load", () => {
        logger.log("[AuthWindow] Page loaded successfully");
        authWindow.webContents.executeJavaScript(`
          (function() {
            // Function to replace Hydra text
            function replaceHydraBranding() {
              // Replace document title
              document.title = document.title.replace(/Hydra/gi, 'MO3TAZ');

              // Replace all text nodes containing "Hydra"
              const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                null
              );
              const textNodes = [];
              let node;
              while (node = walker.nextNode()) {
                textNodes.push(node);
              }

              textNodes.forEach(textNode => {
                if (textNode.textContent.includes('Hydra')) {
                  textNode.textContent = textNode.textContent.replace(/Hydra/gi, 'MO3TAZ');
                }
              });

              // Replace in attributes (titles, placeholders, etc.)
              document.querySelectorAll('[title*="Hydra"], [placeholder*="Hydra"], [href*="Hydra"]').forEach(el => {
                if (el.title) el.title = el.title.replace(/Hydra/gi, 'MO3TAZ');
                if (el.placeholder) el.placeholder = el.placeholder.replace(/Hydra/gi, 'MO3TAZ');
              });

              // Replace favicon
              const favicon = document.querySelector('link[rel="icon"]');
              if (favicon) {
                favicon.href = 'https://cdn.losbroxas.org/favicon.svg';
              }
            }

            // Function to add "powered by hydra" watermark
            function addWatermark() {
              // Check if watermark already exists
              if (document.getElementById('hydra-watermark')) return;

              const watermark = document.createElement('div');
              watermark.id = 'hydra-watermark';
              watermark.textContent = 'powered by hydra';
              watermark.style.cssText = 'position:fixed;bottom:8px;right:12px;font-size:10px;color:rgba(255,255,255,0.3);font-family:system-ui,-apple-system,sans-serif;pointer-events:none;z-index:999999;letter-spacing:0.5px;';
              document.body.appendChild(watermark);
            }

            // Function to replace logo with GIF
            function replaceLogoWithGif() {
              if (document.getElementById('mo3taz-gif-logo')) return;

              var logoEl = null;

              // The auth page uses an SVG for the logo, not an img
              // Try SVG first
              var svgs = document.querySelectorAll('svg');
              for (var i = 0; i < svgs.length; i++) {
                var svg = svgs[i];
                var cls = (svg.className || '').toString();
                var viewBox = svg.getAttribute('viewBox') || '';
                // Match by class containing "logo" or by large viewBox (the auth logo is 692x638)
                if (cls.indexOf('logo') > -1 || (viewBox && parseInt(viewBox.split(' ')[2]) > 400)) {
                  logoEl = svg;
                  break;
                }
              }

              // Fallback: try img tags
              if (!logoEl) {
                var allImgs = document.querySelectorAll('img');
                for (var i = 0; i < allImgs.length; i++) {
                  var img = allImgs[i];
                  var rect = img.getBoundingClientRect();
                  var src = (img.src || '').toLowerCase();
                  var alt = (img.alt || '').toLowerCase();
                  if ((src.indexOf('logo') > -1 || alt.indexOf('logo') > -1) &&
                      rect.width > 20 && rect.height > 20) {
                    logoEl = img;
                    break;
                  }
                }
              }

              if (logoEl) {
                var gif = document.createElement('img');
                gif.id = 'mo3taz-gif-logo';
                gif.src = '${outputGifDataUrl}';
                gif.alt = 'MO3TAZ';
                gif.style.objectFit = 'contain';
                
                // Match original element size
                var w = logoEl.offsetWidth || logoEl.getAttribute('width');
                var h = logoEl.offsetHeight || logoEl.getAttribute('height');
                if (w && !isNaN(w)) gif.style.width = Math.min(parseInt(w), 200) + 'px';
                else gif.style.maxWidth = '200px';
                if (h && !isNaN(h)) gif.style.height = Math.min(parseInt(h), 80) + 'px';
                else gif.style.maxHeight = '80px';
                
                // Copy classes
                gif.className = logoEl.className || '';

                logoEl.replaceWith(gif);
              }
            }

            // Run immediately
            replaceHydraBranding();
            addWatermark();
            if ('${outputGifDataUrl}'.length > 0) {
              setTimeout(replaceLogoWithGif, 500);
            }

            // Watch for DOM changes (React re-renders and SPA route changes)
            const observer = new MutationObserver((mutations) => {
              replaceHydraBranding();
              if ('${outputGifDataUrl}'.length > 0) replaceLogoWithGif();
            });

            observer.observe(document.body, {
              childList: true,
              subtree: true,
              characterData: true
            });

            // Also run after delays to catch late renders and SPA navigation
            setTimeout(() => {
              replaceHydraBranding();
              addWatermark();
              if ('${outputGifDataUrl}'.length > 0) replaceLogoWithGif();
            }, 1000);
            setTimeout(() => {
              replaceHydraBranding();
              if ('${outputGifDataUrl}'.length > 0) replaceLogoWithGif();
            }, 2500);
            setTimeout(() => {
              replaceHydraBranding();
              if ('${outputGifDataUrl}'.length > 0) replaceLogoWithGif();
            }, 5000);

            // Polling for SPA route changes
            let routeCheckCount = 0;
            const routeCheckInterval = setInterval(() => {
              if ('${outputGifDataUrl}'.length > 0) replaceLogoWithGif();
              routeCheckCount++;
              if (routeCheckCount > 20) {
                clearInterval(routeCheckInterval);
              }
            }, 1000);
          })();
        `);
      });

      authWindow.once("ready-to-show", () => {
        authWindow.show();
      });

      authWindow.webContents.on("will-navigate", (_event, url) => {
        logger.log(
          `[AuthWindow] Navigation attempt to: ${url.substring(0, 200)}...`
        );

        // Handle both mo3taz:// and hydralauncher:// protocols
        if (
          url.startsWith("mo3taz://auth") ||
          url.startsWith("hydralauncher://auth")
        ) {
          logger.log("[AuthWindow] Auth callback received, closing window");
          authWindow.close();

          // Check if it's a payload URL that needs decoding
          if (url.includes("?payload=")) {
            logger.log("[AuthWindow] Payload URL detected, decoding...");
            try {
              const urlObj = new URL(url);
              const payload = urlObj.searchParams.get("payload");
              if (payload) {
                const decodedPayload = decodeURIComponent(payload);
                const authData = JSON.parse(
                  Buffer.from(decodedPayload, "base64").toString("utf-8")
                );
                logger.log(
                  `[AuthWindow] Decoded payload. Keys: ${Object.keys(authData).join(", ")}`
                );
                logger.log(
                  `[AuthWindow] Auth data - accessToken length: ${authData.accessToken?.length ?? 0}, refreshToken length: ${authData.refreshToken?.length ?? 0}`
                );

                // The outer payload doesn't contain userId, it's inside the accessToken JWT
                // We need to decode the JWT to get the userId
                let profileId = "";
                let profileUsername = "";

                if (authData.accessToken) {
                  try {
                    logger.log(`[AuthWindow] Decoding JWT token...`);
                    const tokenParts = authData.accessToken.split(".");
                    logger.log(
                      `[AuthWindow] JWT has ${tokenParts.length} parts`
                    );
                    if (tokenParts.length >= 2) {
                      // JWT payload is base64url encoded, need to add padding
                      const base64Payload = tokenParts[1]
                        .replace(/-/g, "+")
                        .replace(/_/g, "/");
                      const paddedBase64 =
                        base64Payload +
                        "=".repeat((4 - (base64Payload.length % 4)) % 4);
                      const decoded = Buffer.from(
                        paddedBase64,
                        "base64"
                      ).toString("utf-8");
                      logger.log(
                        `[AuthWindow] JWT decoded string: ${decoded.substring(0, 200)}`
                      );
                      const jwtPayload = JSON.parse(decoded);
                      logger.log(
                        `[AuthWindow] JWT payload keys: ${Object.keys(jwtPayload).join(", ")}`
                      );
                      logger.log(
                        `[AuthWindow] JWT payload values: userId=${jwtPayload.userId}, sub=${jwtPayload.sub}, username=${jwtPayload.username}, name=${jwtPayload.name}`
                      );
                      profileId = jwtPayload.userId || jwtPayload.sub || "";
                      profileUsername =
                        jwtPayload.username || jwtPayload.name || profileId;
                    }
                  } catch (err) {
                    logger.error("[AuthWindow] Failed to decode JWT:", err);
                  }
                } else {
                  logger.error("[AuthWindow] No accessToken in authData");
                }

                let hasActiveSubscription =
                  authData.hasActiveSubscription || "false";
                logger.log(
                  `[AuthWindow] Extracted: profileId=${profileId}, profileUsername=${profileUsername}`
                );

                const decodedAuthUrl = `hydralauncher://auth?accessToken=${encodeURIComponent(authData.accessToken || "")}&refreshToken=${encodeURIComponent(authData.refreshToken || "")}&profileId=${encodeURIComponent(profileId)}&profileUsername=${encodeURIComponent(profileUsername)}&hasActiveSubscription=${encodeURIComponent(hasActiveSubscription)}`;
                HydraApi.handleExternalAuth(decodedAuthUrl);
                return;
              }
            } catch (err) {
              logger.error("[AuthWindow] Failed to decode payload:", err);
            }
          }

          HydraApi.handleExternalAuth(url);
          return;
        }

        // Handle auth server redirect: auth.hydralauncher.gg redirects to /auth?payload=...
        // Extract the payload and decode it to get auth tokens
        if (url.includes("auth?payload=") || url.includes("/auth?payload=")) {
          logger.log(
            `[AuthWindow] Auth payload redirect detected: ${url.substring(0, 200)}`
          );
          try {
            // Parse the URL - it may be relative or absolute
            const fullUrl = url.startsWith("http")
              ? url
              : `${import.meta.env.MAIN_VITE_AUTH_URL}${url.startsWith("/") ? "" : "/"}${url}`;
            const urlObj = new URL(fullUrl);
            const payload = urlObj.searchParams.get("payload");

            if (payload) {
              logger.log("[AuthWindow] Extracting auth payload...");
              // Decode: payload is base64 encoded JSON
              const decodedPayload = decodeURIComponent(payload);
              logger.log(
                `[AuthWindow] Decoded payload (first 200 chars): ${decodedPayload.substring(0, 200)}`
              );
              const authData = JSON.parse(
                Buffer.from(decodedPayload, "base64").toString("utf-8")
              );
              logger.log(
                `[AuthWindow] Auth data decoded. Keys: ${Object.keys(authData).join(", ")}`
              );
              logger.log(
                `[AuthWindow] Auth data: accessToken=${!!authData.accessToken}, refreshToken=${!!authData.refreshToken}, profileId=${authData.profileId}, profileUsername=${authData.profileUsername}`
              );

              // Construct hydralauncher://auth URL from the decoded data (use hydralauncher:// since that's what the auth server uses)
              const authUrl = `hydralauncher://auth?accessToken=${encodeURIComponent(authData.accessToken || "")}&refreshToken=${encodeURIComponent(authData.refreshToken || "")}&profileId=${encodeURIComponent(authData.profileId || "")}&profileUsername=${encodeURIComponent(authData.profileUsername || "")}&hasActiveSubscription=${encodeURIComponent(authData.hasActiveSubscription || "false")}`;

              logger.log(
                "[AuthWindow] Closing auth window and calling handleExternalAuth"
              );
              authWindow.close();
              HydraApi.handleExternalAuth(authUrl);
              return;
            } else {
              logger.error("[AuthWindow] No payload parameter found in URL");
            }
          } catch (err) {
            logger.error("[AuthWindow] Failed to parse auth payload:", err);
          }
        }

        if (
          url.startsWith("mo3taz://update-account") ||
          url.startsWith("hydralauncher://update-account")
        ) {
          authWindow.close();

          WindowManager.mainWindow?.webContents.send("on-account-updated");
        }
      });
    }
  }

  private static readonly NOTIFICATION_WINDOW_WIDTH = 360;
  private static readonly NOTIFICATION_WINDOW_HEIGHT = 140;

  private static async getNotificationWindowPosition(
    position: AchievementCustomNotificationPosition | undefined
  ) {
    const display = screen.getPrimaryDisplay();
    const {
      x: displayX,
      y: displayY,
      width: displayWidth,
      height: displayHeight,
    } = display.bounds;

    if (position === "bottom-left") {
      return {
        x: displayX,
        y: displayY + displayHeight - this.NOTIFICATION_WINDOW_HEIGHT,
      };
    }

    if (position === "bottom-center") {
      return {
        x: displayX + (displayWidth - this.NOTIFICATION_WINDOW_WIDTH) / 2,
        y: displayY + displayHeight - this.NOTIFICATION_WINDOW_HEIGHT,
      };
    }

    if (position === "bottom-right") {
      return {
        x: displayX + displayWidth - this.NOTIFICATION_WINDOW_WIDTH,
        y: displayY + displayHeight - this.NOTIFICATION_WINDOW_HEIGHT,
      };
    }

    if (position === "top-left") {
      return {
        x: displayX,
        y: displayY,
      };
    }

    if (position === "top-center") {
      return {
        x: displayX + (displayWidth - this.NOTIFICATION_WINDOW_WIDTH) / 2,
        y: displayY,
      };
    }

    if (position === "top-right") {
      return {
        x: displayX + displayWidth - this.NOTIFICATION_WINDOW_WIDTH,
        y: displayY,
      };
    }

    return {
      x: displayX,
      y: displayY,
    };
  }

  public static async createNotificationWindow() {
    if (this.notificationWindow) return;

    if (process.platform === "darwin") {
      return;
    }

    const userPreferences = await db.get<string, UserPreferences | undefined>(
      levelKeys.userPreferences,
      {
        valueEncoding: "json",
      }
    );

    if (
      userPreferences?.achievementNotificationsEnabled === false ||
      userPreferences?.achievementCustomNotificationsEnabled === false
    ) {
      return;
    }

    const { x, y } = await this.getNotificationWindowPosition(
      userPreferences?.achievementCustomNotificationPosition
    );

    this.notificationWindow = new BrowserWindow({
      transparent: true,
      maximizable: false,
      autoHideMenuBar: true,
      minimizable: false,
      backgroundColor: "#00000000",
      focusable: false,
      skipTaskbar: true,
      frame: false,
      width: this.NOTIFICATION_WINDOW_WIDTH,
      height: this.NOTIFICATION_WINDOW_HEIGHT,
      x,
      y,
      webPreferences: {
        preload: path.join(__dirname, "../preload/index.mjs"),
        sandbox: false,
      },
    });
    this.notificationWindow.setIgnoreMouseEvents(true);

    this.notificationWindow.setAlwaysOnTop(true, "screen-saver", 1);
    this.loadWindowURL(this.notificationWindow, "achievement-notification");
    this.installDevToolsToggle(this.notificationWindow);
  }

  public static async showAchievementTestNotification() {
    const userPreferences = await db.get<string, UserPreferences>(
      levelKeys.userPreferences,
      {
        valueEncoding: "json",
      }
    );

    const language = userPreferences?.language ?? "en";

    this.notificationWindow?.webContents.send(
      "on-achievement-unlocked",
      userPreferences.achievementCustomNotificationPosition ?? "top-left",
      [
        generateAchievementCustomNotificationTest(t, language),
        generateAchievementCustomNotificationTest(t, language, {
          isRare: true,
          isHidden: true,
        }),
        generateAchievementCustomNotificationTest(t, language, {
          isPlatinum: true,
        }),
      ]
    );
  }

  public static async closeNotificationWindow() {
    if (this.notificationWindow) {
      this.notificationWindow.close();
      this.notificationWindow = null;
    }
  }

  public static openEditorWindow(themeId: string) {
    if (this.mainWindow) {
      const existingWindow = this.editorWindows.get(themeId);
      if (existingWindow) {
        if (existingWindow.isMinimized()) {
          existingWindow.restore();
        }
        existingWindow.focus();
        return;
      }

      const editorWindow = new BrowserWindow({
        width: 720,
        height: 720,
        minWidth: 600,
        minHeight: 540,
        backgroundColor: "#1c1c1c",
        titleBarStyle: process.platform === "linux" ? "default" : "hidden",
        icon: windowIcon,
        trafficLightPosition: { x: 16, y: 16 },
        titleBarOverlay: {
          symbolColor: "#DADBE1",
          color: "#151515",
          height: 34,
        },
        webPreferences: {
          preload: path.join(__dirname, "../preload/index.mjs"),
          sandbox: false,
        },
        show: false,
      });

      this.editorWindows.set(themeId, editorWindow);

      editorWindow.removeMenu();
      this.installDevToolsToggle(editorWindow);

      this.loadWindowURL(editorWindow, `theme-editor?themeId=${themeId}`);

      editorWindow.once("ready-to-show", () => {
        editorWindow.show();
      });

      editorWindow.on("close", () => {
        editorWindow.webContents.closeDevTools();
        this.editorWindows.delete(themeId);
      });
    }
  }

  public static closeEditorWindow(themeId?: string) {
    if (themeId) {
      const editorWindow = this.editorWindows.get(themeId);
      if (editorWindow) {
        editorWindow.close();
      }
    } else {
      this.editorWindows.forEach((editorWindow) => {
        editorWindow.close();
      });
    }
  }

  private static readonly GAME_LAUNCHER_WINDOW_WIDTH = 550;
  private static readonly GAME_LAUNCHER_WINDOW_HEIGHT = 320;

  public static async createGameLauncherWindow(shop: string, objectId: string) {
    if (this.gameLauncherWindow) {
      this.gameLauncherWindow.close();
      this.gameLauncherWindow = null;
    }

    const display = screen.getPrimaryDisplay();
    const { width: displayWidth, height: displayHeight } = display.bounds;

    const x = Math.round((displayWidth - this.GAME_LAUNCHER_WINDOW_WIDTH) / 2);
    const y = Math.round(
      (displayHeight - this.GAME_LAUNCHER_WINDOW_HEIGHT) / 2
    );

    this.gameLauncherWindow = new BrowserWindow({
      width: this.GAME_LAUNCHER_WINDOW_WIDTH,
      height: this.GAME_LAUNCHER_WINDOW_HEIGHT,
      x,
      y,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      frame: false,
      backgroundColor: "#1c1c1c",
      icon: windowIcon,
      skipTaskbar: false,
      webPreferences: {
        preload: path.join(__dirname, "../preload/index.mjs"),
        sandbox: false,
      },
      show: false,
    });

    this.gameLauncherWindow.removeMenu();
    this.installDevToolsToggle(this.gameLauncherWindow);

    this.loadWindowURL(
      this.gameLauncherWindow,
      `game-launcher?shop=${shop}&objectId=${objectId}`
    );

    this.gameLauncherWindow.on("closed", () => {
      this.gameLauncherWindow = null;
    });
  }

  public static showGameLauncherWindow() {
    if (this.gameLauncherWindow && !this.gameLauncherWindow.isDestroyed()) {
      this.gameLauncherWindow.show();
    }
  }

  public static closeGameLauncherWindow() {
    if (this.gameLauncherWindow) {
      this.gameLauncherWindow.close();
      this.gameLauncherWindow = null;
    }
  }

  public static openMainWindow() {
    if (this.mainWindow) {
      this.mainWindow.show();
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.focus();
    } else {
      this.createMainWindow();
    }
  }

  public static redirect(hash: string) {
    if (!this.mainWindow) this.createMainWindow();
    this.loadMainWindowURL(hash);

    if (this.mainWindow?.isMinimized()) this.mainWindow.restore();
    this.mainWindow?.focus();
  }

  public static async createSystemTray(language: string) {
    let tray: Tray;

    if (process.platform === "darwin") {
      const macIcon = nativeImage
        .createFromPath(trayIcon)
        .resize({ width: 24, height: 24 });
      tray = new Tray(macIcon);
    } else {
      tray = new Tray(trayIcon);
    }

    const updateSystemTray = async () => {
      const games = await gamesSublevel
        .values()
        .all()
        .then((games) => {
          const filteredGames = games.filter(
            (game) =>
              !game.isDeleted && game.executablePath && game.lastTimePlayed
          );

          const sortedGames = orderBy(filteredGames, "lastTimePlayed", "desc");

          return slice(sortedGames, 0, 6);
        });

      const recentlyPlayedGames: Array<MenuItemConstructorOptions | MenuItem> =
        games.map(({ title, executablePath }) => ({
          label: title.length > 18 ? `${title.slice(0, 18)}…` : title,
          type: "normal",
          click: async () => {
            if (!executablePath) return;

            shell.openPath(executablePath);
          },
        }));

      const contextMenu = Menu.buildFromTemplate([
        {
          label: t("open", {
            ns: "system_tray",
            lng: language,
          }),
          type: "normal",
          click: () => {
            if (this.mainWindow) {
              this.mainWindow.show();
            } else {
              this.createMainWindow();
            }
          },
        },
        {
          type: "separator",
        },
        ...recentlyPlayedGames,
        {
          type: "separator",
        },
        {
          label: t("quit", {
            ns: "system_tray",
            lng: language,
          }),
          type: "normal",
          click: () => app.quit(),
        },
      ]);

      if (process.platform === "linux") {
        tray.setContextMenu(contextMenu);
      }

      return contextMenu;
    };

    const showContextMenu = async () => {
      const contextMenu = await updateSystemTray();
      tray.popUpContextMenu(contextMenu);
    };

    tray.setToolTip("MO3TAZ Launcher");

    if (process.platform === "win32") {
      await updateSystemTray();

      tray.addListener("double-click", () => {
        if (this.mainWindow) {
          this.mainWindow.show();
        } else {
          this.createMainWindow();
        }
      });

      tray.addListener("right-click", showContextMenu);
    } else if (process.platform === "linux") {
      await updateSystemTray();

      tray.addListener("click", () => {
        if (this.mainWindow) {
          this.mainWindow.show();
        } else {
          this.createMainWindow();
        }
      });

      tray.addListener("right-click", showContextMenu);
    } else {
      tray.addListener("click", showContextMenu);
      tray.addListener("right-click", showContextMenu);
    }
  }
}
