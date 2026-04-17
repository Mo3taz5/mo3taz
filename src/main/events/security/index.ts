import { ipcMain, BrowserWindow } from "electron";
import { logger } from "@main/services";
import type {
  SecurityEvent,
  SecurityStats,
  SecurityThreatLevel,
  SecurityAction,
} from "@types";

const securityEvents: SecurityEvent[] = [];
let isEnabled = true;

export const logSecurityEvent = (
  threatLevel: SecurityThreatLevel,
  action: SecurityAction,
  module: string,
  description: string,
  details: Record<string, unknown> = {}
): void => {
  const event: SecurityEvent = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    threatLevel,
    action,
    module,
    description,
    details,
  };

  securityEvents.push(event);

  logger.warn(`[SECURITY] ${module}: ${description}`, details);

  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send("on-security-event", event);
  });
};

export const getSecurityEvents = async (
  _event: Electron.IpcMainInvokeEvent,
  limit?: number
): Promise<SecurityEvent[]> => {
  const events = limit ? securityEvents.slice(-limit) : securityEvents;
  return events;
};

export const getDashboardStats = async (): Promise<SecurityStats> => {
  const threatCounts = { critical: 0, suspicious: 0, moderate: 0, low: 0 };
  for (const e of securityEvents) {
    threatCounts[e.threatLevel]++;
  }

  return {
    totalEvents: securityEvents.length,
    quarantinedFiles: 0,
    activeIsolations: 0,
    threatCounts,
    isEnabled,
  };
};

ipcMain.handle("security:getSecurityEvents", getSecurityEvents);
ipcMain.handle("security:getDashboardStats", getDashboardStats);

logger.info("Security IPC handlers registered");
