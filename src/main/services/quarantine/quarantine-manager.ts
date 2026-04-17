import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { logger } from "../logger";
import { quarantineFilesSublevel } from "@main/level";
import type { QuarantinedFile, SecurityRiskCategory } from "@types";

const moveFile = async (sourcePath: string, destinationPath: string) => {
  try {
    await fs.rename(sourcePath, destinationPath);
  } catch (error) {
    const code = (error as { code?: unknown }).code;

    if (code !== "EXDEV") {
      throw error;
    }

    await fs.copyFile(sourcePath, destinationPath);
    await fs.unlink(sourcePath);
  }
};

export const buildQuarantinePath = (originalPath: string, scanPath: string) => {
  const scanStats = fsSync.statSync(scanPath);
  const scanRoot = scanStats.isDirectory() ? scanPath : path.dirname(scanPath);
  const relativePath = path.relative(scanRoot, originalPath);
  const safeRelativePath =
    relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath)
      ? relativePath
      : path.basename(originalPath);

  return path.join(
    path.dirname(scanRoot),
    ".hydra-security-quarantine",
    safeRelativePath
  );
};

const ensureDestinationAvailable = async (destinationPath: string) => {
  try {
    await fs.access(destinationPath);
    throw new Error(`Destination already exists: ${destinationPath}`);
  } catch (error) {
    const code = (error as { code?: unknown }).code;

    if (code !== "ENOENT") {
      throw error;
    }
  }
};

export interface QuarantineFileInput {
  originalPath: string;
  quarantinePath: string;
  scanPath: string;
  riskCategory: SecurityRiskCategory;
  reason: string;
  signature: string | null;
  scanner: string | null;
}

export interface RestoreFileResult {
  file: QuarantinedFile;
  restoredPath: string;
}

export const QuarantineManager = {
  async registerFile(input: QuarantineFileInput): Promise<QuarantinedFile> {
    const id = crypto.randomUUID();
    const record: QuarantinedFile = {
      id,
      originalPath: input.originalPath,
      quarantinePath: input.quarantinePath,
      scanPath: input.scanPath,
      riskCategory: input.riskCategory,
      reason: input.reason,
      signature: input.signature,
      scanner: input.scanner,
      createdAt: Date.now(),
      restoredAt: null,
    };

    await quarantineFilesSublevel.put(id, record);
    return record;
  },

  async restoreFile(id: string): Promise<RestoreFileResult> {
    const file = await quarantineFilesSublevel.get(id).catch(() => null);

    if (!file) {
      throw new Error(`Quarantined file not found: ${id}`);
    }

    if (file.restoredAt) {
      return {
        file,
        restoredPath: file.originalPath,
      };
    }

    await ensureDestinationAvailable(file.originalPath);
    await fs.mkdir(path.dirname(file.originalPath), { recursive: true });

    if (!(await fs.stat(file.quarantinePath).catch(() => null))) {
      throw new Error(
        `Quarantined file no longer exists at ${file.quarantinePath}`
      );
    }

    logger.info("[QuarantineManager] Restoring quarantined file", {
      id,
      originalPath: file.originalPath,
      quarantinePath: file.quarantinePath,
    });

    await moveFile(file.quarantinePath, file.originalPath);

    const restoredFile: QuarantinedFile = {
      ...file,
      restoredAt: Date.now(),
    };

    await quarantineFilesSublevel.put(id, restoredFile);

    return {
      file: restoredFile,
      restoredPath: file.originalPath,
    };
  },
};
