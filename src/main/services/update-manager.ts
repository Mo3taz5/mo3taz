import updater, { UpdateInfo } from "electron-updater";
import { logger, WindowManager } from "@main/services";
import { AppUpdaterEvent, UserPreferences } from "@types";
import { app } from "electron";
import { publishNotificationUpdateReadyToInstall } from "@main/services/notifications";
import { db, levelKeys } from "@main/level";
import { MAIN_LOOP_INTERVAL } from "@main/constants";

const { autoUpdater } = updater;
const sendEventsForDebug = false;
const ticksToUpdate = (50 * 60 * 1000) / MAIN_LOOP_INTERVAL; // 50 minutes

export class UpdateManager {
  private static hasNotified = false;
  private static newVersion = "";
  private static checkTick = 0;

  private static mockValuesForDebug() {
    this.sendEvent({ type: "update-available", info: { version: "3.3.1" } });
    this.sendEvent({ type: "update-downloaded" });
  }

  private static sendEvent(event: AppUpdaterEvent) {
    WindowManager.mainWindow?.webContents.send("autoUpdaterEvent", event);
  }

  private static async isAutoInstallEnabled() {
    return true;
  }

  public static async checkForUpdates() {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater
      .once("update-available", (info: UpdateInfo) => {
        this.sendEvent({ type: "update-available", info });
        this.newVersion = info.version;
        logger.log(`Update available: ${info.version}, auto-downloading...`);
      })
      .once("update-downloaded", () => {
        this.sendEvent({ type: "update-downloaded" });

        if (!this.hasNotified) {
          this.hasNotified = true;
          publishNotificationUpdateReadyToInstall(this.newVersion);
        }
        
        logger.log("Update downloaded, restarting to install...");
        setTimeout(() => {
          autoUpdater.quitAndInstall(false, true);
        }, 3000);
      })
      .once("error", (err) => {
        logger.error("Update error:", err);
      });

    if (app.isPackaged) {
      autoUpdater.checkForUpdates().then((result) => {
        logger.log(`Check for updates result: ${result}`);
      });
    } else if (sendEventsForDebug) {
      this.mockValuesForDebug();
    }

    return true;
  }

  public static checkForUpdatePeriodically() {
    if (this.checkTick % ticksToUpdate == 0) {
      this.checkForUpdates();
    }
    this.checkTick++;
  }
}
