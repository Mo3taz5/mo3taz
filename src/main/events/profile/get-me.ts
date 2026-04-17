import { registerEvent } from "../register-event";
import type { UserDetails } from "@types";
import { getUserData } from "@main/services/user/get-user-data";
import { logger } from "@main/services/logger";

const getMe = async (
  _event: Electron.IpcMainInvokeEvent
): Promise<UserDetails | null> => {
  logger.log("[GetMe] Calling getUserData...");
  const result = await getUserData();
  logger.log(`[GetMe] getUserData returned: ${result ? `user id=${result.id}, displayName=${result.displayName}` : 'null'}`);
  return result;
};

registerEvent("getMe", getMe);
