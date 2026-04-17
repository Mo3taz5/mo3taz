import { registerEvent } from "../register-event";
import type { Download, StartGameDownloadPayload } from "@types";
import { DownloadManager, HydraApi, logger } from "@main/services";
import { createGame } from "@main/services/library-sync";
import { downloadsSublevel, gamesSublevel, levelKeys } from "@main/level";
import {
  handleDownloadError,
  isKnownDownloadError,
  prepareGameEntry,
} from "@main/helpers";

const startGameDownload = async (
  _event: Electron.IpcMainInvokeEvent,
  payload: StartGameDownloadPayload
) => {
  const {
    objectId,
    title,
    shop,
    downloadPath,
    downloader,
    uri,
    automaticallyExtract,
    fileIndices,
    selectedFilesSize,
  } = payload;

  const gameKey = levelKeys.game(shop, objectId);

  logger.log(
    `[Downloads] Start requested for ${gameKey} (downloader=${downloader}, uri=${uri?.substring(0, 50)}..., downloadPath=${downloadPath})`
  );

  logger.log(`[Downloads] Pausing current active downloads...`);
  await DownloadManager.pauseDownload();

  for await (const [key, value] of downloadsSublevel.iterator()) {
    if (value.status === "active" && value.progress !== 1) {
      await downloadsSublevel.put(key, {
        ...value,
        status: "paused",
      });
      logger.log(`[Downloads] Paused download: ${key}`);
    }
  }

  await prepareGameEntry({ gameKey, title, objectId, shop });

  await DownloadManager.cancelDownload(gameKey);

  const download: Download = {
    shop,
    objectId,
    status: "active",
    progress: 0,
    bytesDownloaded: 0,
    downloadPath,
    downloader,
    uri,
    folderName: null,
    shouldSeed: false,
    timestamp: Date.now(),
    queued: true,
    extracting: false,
    automaticallyExtract,
    extractionProgress: 0,
    fileIndices,
    selectedFilesSize,
    fileSize: selectedFilesSize ?? null,
  };

  logger.log(`[Downloads] Starting download for ${gameKey}...`);
  try {
    // Start the download first
    await DownloadManager.startDownload(download);
    logger.log(`[Downloads] DownloadManager.startDownload completed for ${gameKey}`);

    // Then persist to database
    await downloadsSublevel.put(gameKey, download);
    logger.log(`[Downloads] Download persisted to DB for ${gameKey}`);

    const updatedGame = await gamesSublevel.get(gameKey);

    await Promise.all([
      createGame(updatedGame!).catch(() => {}),
      HydraApi.post(`/games/${shop}/${objectId}/download`, null, {
        needsAuth: false,
      }).catch(() => {}),
    ]);

    logger.log(`[Downloads] Download successfully started for ${gameKey}`);
    return { ok: true };
  } catch (err: unknown) {
    if (isKnownDownloadError(err)) {
      logger.warn("Failed to start download with expected download error", err);
    } else {
      logger.error("Failed to start download", err);
    }
    return handleDownloadError(err, downloader);
  }
};

registerEvent("startGameDownload", startGameDownload);
