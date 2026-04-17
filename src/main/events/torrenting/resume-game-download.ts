import { registerEvent } from "../register-event";

import { DownloadManager, logger } from "@main/services";
import { downloadsSublevel, levelKeys } from "@main/level";
import { GameShop } from "@types";

const resumeGameDownload = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string
) => {
  const gameKey = levelKeys.game(shop, objectId);

  const download = await downloadsSublevel.get(gameKey);

  if (
    download &&
    (download.status === "paused" ||
      download.status === "active" ||
      download.status === "error") &&
    download.progress !== 1
  ) {
    logger.log(
      `[Downloads] Resume requested for ${gameKey} (status=${download.status}, queued=${download.queued})`
    );

    // If this download is already active, just return
    if (download.status === "active" && DownloadManager.hasActiveDownload()) {
      logger.log(`[Downloads] ${gameKey} is already active, skipping`);
      return;
    }

    // Pause current active download if any
    await DownloadManager.pauseDownload();

    // Set all other active downloads to paused
    for await (const [key, value] of downloadsSublevel.iterator()) {
      if (value.status === "active" && value.progress !== 1 && key !== gameKey) {
        await downloadsSublevel.put(key, {
          ...value,
          status: "paused",
        });
      }
    }

    // Update the download to active state with queued=true
    await downloadsSublevel.put(gameKey, {
      ...download,
      status: "active",
      timestamp: Date.now(),
      queued: true,
    });

    // Start the download
    await DownloadManager.resumeDownload(download);
  }
};

registerEvent("resumeGameDownload", resumeGameDownload);
