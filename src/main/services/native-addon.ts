import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import { app } from "electron";
import type { ProcessPayload } from "./download/types";

import { logger } from "./logger";

type NativeProcessProfileImageResponse = {
  imagePath?: string;
  image_path?: string;
  mimeType?: string;
  mime_type?: string;
};

type HydraNativeModule = {
  processProfileImage: (
    imagePath: string,
    targetExtension?: string
  ) => NativeProcessProfileImageResponse;
  listProcesses: () => ProcessPayload[];
};

export class NativeAddon {
  private static nativeModule: HydraNativeModule | null = null;

  private static resolveAddonPath() {
    if (app.isPackaged) {
      return path.join(
        process.resourcesPath,
        "hydra-native",
        "hydra-native.node"
      );
    }

    return path.join(app.getAppPath(), "hydra-native", "hydra-native.node");
  }

  private static load() {
    if (this.nativeModule) return this.nativeModule;

    const addonPath = this.resolveAddonPath();

    if (!fs.existsSync(addonPath)) {
      throw new Error("MO3TAZ native addon not found");
    }

    const nodeRequire = createRequire(addonPath);
    this.nativeModule = nodeRequire(addonPath);

    return this.nativeModule;
  }

  public static processProfileImage(
    imagePath: string,
    targetExtension?: string
  ): NativeProcessProfileImageResponse {
    try {
      const module = this.load();
      if (!module) throw new Error("Native addon module is null");
      const response = module.processProfileImage(imagePath, targetExtension);

      const normalizedImagePath = response.imagePath ?? response.image_path;
      const normalizedMimeType = response.mimeType ?? response.mime_type;

      if (!normalizedImagePath) {
        throw new Error("Hydra native addon returned an invalid payload");
      }

      return {
        imagePath: normalizedImagePath,
        mimeType: normalizedMimeType,
      };
    } catch (error) {
      logger.error("Failed to process profile image via native addon", error);
      throw error;
    }
  }

  public static listProcesses(): ProcessPayload[] {
    try {
      const module = this.load();
      if (!module) throw new Error("Native addon module is null");
      const response = module.listProcesses();

      if (!Array.isArray(response)) {
        throw new Error("Hydra native addon returned an invalid process list");
      }

      return response.filter((process): process is ProcessPayload => {
        return (
          typeof process?.pid === "number" &&
          typeof process?.name === "string" &&
          process.name.length > 0
        );
      });
    } catch (error) {
      logger.error("Failed to list processes via native addon", error);
      return [];
    }
  }
}
