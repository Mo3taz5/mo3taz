import { registerEvent } from "../register-event";
import { QuarantineManager } from "@main/services";

const restoreFile = async (
  _event: Electron.IpcMainInvokeEvent,
  id: string
) => {
  return QuarantineManager.restoreFile(id);
};

registerEvent("restoreFile", restoreFile);
