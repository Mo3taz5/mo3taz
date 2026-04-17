import path from "node:path";
import { registerEvent } from "../register-event";
import { gamesSublevel, levelKeys } from "@main/level";
import { GameSecurityScanner, logger } from "@main/services";
import type { GameShop } from "@types";

const scanInstalledGame = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string
) => {
  const gameKey = levelKeys.game(shop, objectId);
  const game = await gamesSublevel.get(gameKey).catch(() => null);

  if (!game) {
    return {
      status: "error" as const,
      scanner: null,
      scanPath: "",
      details: "Game not found",
      exitCode: null,
      findings: [],
    };
  }

  if (!game.executablePath) {
    return {
      status: "error" as const,
      scanner: null,
      scanPath: "",
      details: "Game is not installed",
      exitCode: null,
      findings: [],
    };
  }

  const scanPath = path.dirname(game.executablePath);

  logger.info("[ScanInstalledGame] Starting scan", {
    shop,
    objectId,
    scanPath,
  });

  return GameSecurityScanner.scanPath(scanPath);
};

registerEvent("scanInstalledGame", scanInstalledGame);
