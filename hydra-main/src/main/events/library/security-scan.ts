import { registerEvent } from "../register-event";
import { SecurityService } from "@main/services/security-service";

const scanGameExecutable = async (
  _event: Electron.IpcMainInvokeEvent,
  executablePath: string
) => {
  return await SecurityService.scanAndLaunch(executablePath);
};

const securityScanFile = async (
  _event: Electron.IpcMainInvokeEvent,
  filePath: string
) => {
  return await SecurityService.scanFile(filePath);
};

registerEvent("security:scanGameExecutable", scanGameExecutable);
registerEvent("security:scanFile", securityScanFile);
