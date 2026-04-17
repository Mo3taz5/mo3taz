import { sleep } from "@main/helpers";
import { DownloadManager } from "./download";
import { gamesPlaytime, watchProcesses } from "./process-watcher";
import { AchievementWatcherManager } from "./achievements/achievement-watcher-manager";
import { UpdateManager } from "./update-manager";
import { MAIN_LOOP_INTERVAL } from "@main/constants";
import { PowerSaveBlockerManager } from "./power-save-blocker";
import { logger } from "./logger";

export const startMainLoop = async () => {
  logger.log("[MainLoop] Starting main loop with interval " + MAIN_LOOP_INTERVAL + "ms");
  let iterationCount = 0;
  while (true) {
    iterationCount++;
    try {
      await Promise.allSettled([
        watchProcesses(),
        DownloadManager.watchDownloads(),
        AchievementWatcherManager.watchAchievements(),
        DownloadManager.getSeedStatus(),
        UpdateManager.checkForUpdatePeriodically(),
      ]);
      if (iterationCount % 10 === 0) {
        logger.log(`[MainLoop] Completed ${iterationCount} iterations`);
      }
    } catch (err) {
      logger.error("[MainLoop] Error in main loop iteration:", err);
    }

    PowerSaveBlockerManager.syncState({
      downloadActive: DownloadManager.hasActiveDownload(),
      compatibilityGameActive:
        PowerSaveBlockerManager.hasRunningCompatibilityGame(
          gamesPlaytime.keys()
        ),
    });

    await sleep(MAIN_LOOP_INTERVAL);
  }
};
