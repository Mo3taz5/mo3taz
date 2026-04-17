import { registerEvent } from "../register-event";
import { HydraApi } from "@main/services/hydra-api";
import { downloadSourcesSublevel } from "@main/level";
import { logger } from "@main/services";
import type { DownloadSource } from "@types";

const addDownloadSourceDirect = async (
  _event: Electron.IpcMainInvokeEvent,
  url: string,
  name?: string
) => {
  try {
    const existingSources = await downloadSourcesSublevel.values().all();
    const urlExists = existingSources.some((source) => source.url === url);

    if (urlExists) {
      throw new Error("Download source with this URL already exists");
    }

    // Call API to register the source so it gets a proper fingerprint
    const downloadSource = await HydraApi.post<DownloadSource>(
      "/download-sources",
      {
        url,
      },
      { needsAuth: false }
    );

    // Override name if provided
    if (name) {
      downloadSource.name = name;
    }

    if (HydraApi.isLoggedIn() && HydraApi.hasActiveSubscription()) {
      try {
        await HydraApi.post("/profile/download-sources", {
          urls: [url],
        });
      } catch (error) {
        logger.error("Failed to add download source to profile:", error);
      }
    }

    await downloadSourcesSublevel.put(downloadSource.id, {
      ...downloadSource,
      isRemote: true,
      createdAt: new Date().toISOString(),
    });

    return downloadSource;
  } catch (error) {
    logger.error("Failed to add download source directly:", error);
    throw error;
  }
};

registerEvent("addDownloadSourceDirect", addDownloadSourceDirect);
