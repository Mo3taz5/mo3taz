import { downloadsSublevel } from "./level/sublevels/downloads";
import { orderBy } from "lodash-es";
import { Downloader } from "@shared";
import { levelKeys, db } from "./level";
import type { Download, UserPreferences } from "@types";
import path from "node:path";
import fs from "node:fs";
import {
  SystemPath,
  CommonRedistManager,
  TorBoxClient,
  RealDebridClient,
  PremiumizeClient,
  AllDebridClient,
  DownloadManager,
  HydraApi,
  uploadGamesBatch,
  startMainLoop,
  Ludusavi,
  Lock,
  DeckyPlugin,
  DownloadSourcesChecker,
  WSClient,
  logger,
} from "@main/services";
import { migrateDownloadSources } from "./helpers/migrate-download-sources";
import { getDirSize } from "./services/download/helpers";

const hasMissingSeedFiles = async (download: Download): Promise<boolean> => {
  if (!download.folderName) return false;

  const downloadTargetPath = path.join(
    download.downloadPath,
    download.folderName
  );

  if (!fs.existsSync(downloadTargetPath)) {
    return true;
  }

  const expectedSize = download.selectedFilesSize ?? download.fileSize ?? 0;

  if (expectedSize <= 0) {
    return false;
  }

  const currentSize = await getDirSize(downloadTargetPath);
  return currentSize < expectedSize;
};

export const loadState = async () => {
  try {
    logger.log("[Main] loadState() called - starting initialization");
    await Lock.acquireLock();
    logger.log("[Main] Lock acquired");

    const userPreferences = await db.get<string, UserPreferences | null>(
      levelKeys.userPreferences,
      { valueEncoding: "json" }
    ).catch(() => null);
    logger.log("[Main] User preferences loaded");

    await import("./events");
    logger.log("[Main] Events imported");

    if (userPreferences?.realDebridApiToken) {
      RealDebridClient.authorize(userPreferences.realDebridApiToken);
    }
    if (userPreferences?.premiumizeApiToken) {
      PremiumizeClient.authorize(userPreferences.premiumizeApiToken);
    }
    if (userPreferences?.allDebridApiToken) {
      AllDebridClient.authorize(userPreferences.allDebridApiToken);
    }
    if (userPreferences?.torBoxApiToken) {
      TorBoxClient.authorize(userPreferences.torBoxApiToken);
    }

    Ludusavi.copyConfigFileToUserData();
    Ludusavi.copyBinaryToUserData();

    if (process.platform === "linux") {
      DeckyPlugin.checkAndUpdateIfOutdated();
    }

    logger.log("[Main] About to setup HydraApi");
    await HydraApi.setupApi();
    logger.log("[Main] HydraApi setup complete");
    uploadGamesBatch();
    void migrateDownloadSources();
    const { syncDownloadSourcesFromApi } = await import("./services/user");
    void syncDownloadSourcesFromApi();
    void DownloadSourcesChecker.checkForChanges();
    WSClient.connect();

    logger.log("[Main] Loading downloads from DB...");
    const downloads = await downloadsSublevel.values().all()
      .then((games) => orderBy(games, "timestamp", "desc"));
    logger.log(`[Main] Found ${downloads.length} downloads`);

    let interruptedDownload: Download | null = null;
    for (const download of downloads) {
      const downloadKey = levelKeys.game(download.shop, download.objectId);
      if (download.extracting) {
        await downloadsSublevel.put(downloadKey, { ...download, extracting: false });
      }
      if (download.status === "active" && !interruptedDownload) {
        interruptedDownload = download;
        await downloadsSublevel.put(downloadKey, { ...download, status: "paused" });
      } else if (download.status === "active") {
        await downloadsSublevel.put(downloadKey, { ...download, status: "paused" });
      }
    }

    const updatedDownloads = await downloadsSublevel.values().all()
      .then((games) => orderBy(games, "timestamp", "desc"));

    const normalizedDownloads: Download[] = [];
    for (const download of updatedDownloads) {
      const downloadKey = levelKeys.game(download.shop, download.objectId);
      const hasInvalidQueuedState = download.queued &&
        (download.status === "removed" || download.status === "complete" || download.status === "seeding");
      if (!hasInvalidQueuedState) {
        normalizedDownloads.push(download);
      } else {
        await downloadsSublevel.put(downloadKey, { ...download, queued: false });
        normalizedDownloads.push({ ...download, queued: false });
      }
    }

    const downloadToResume = interruptedDownload ??
      normalizedDownloads.find((game) => game.queued && (game.status === "paused" || game.status === "error"));

    const downloadsToSeed: Download[] = [];
    for (const game of normalizedDownloads) {
      if (!game.shouldSeed || game.downloader !== Downloader.Torrent || game.progress !== 1 || game.status !== "seeding" || game.uri === null) continue;
      if (!(await hasMissingSeedFiles(game))) {
        downloadsToSeed.push(game);
      } else {
        const gameKey = levelKeys.game(game.shop, game.objectId);
        await downloadsSublevel.put(gameKey, { ...game, status: "paused", shouldSeed: false, queued: false });
      }
    }

    logger.log(`[Main] downloadToResume=${downloadToResume?.objectId ?? 'none'}, downloadsToSeed=${downloadsToSeed.length}`);

    const isTorrent = downloadToResume?.downloader === Downloader.Torrent;
    if (downloadToResume && !isTorrent) {
      await DownloadManager.startRPC(undefined, downloadsToSeed);
      await DownloadManager.startDownload(downloadToResume).catch((err) => logger.error("Failed to auto-resume download:", err));
    } else {
      await DownloadManager.startRPC(downloadToResume, downloadsToSeed);
    }

    logger.log("[Main] loadState completed successfully");
  } catch (err) {
    logger.error("[Main] loadState error:", err);
  } finally {
    // ALWAYS start the main loop even if loadState fails
    logger.log("[Main] Starting main loop...");
    startMainLoop();
    logger.log("[Main] startMainLoop() called");
    CommonRedistManager.downloadCommonRedist();
    SystemPath.checkIfPathsAreAvailable();
  }
};
