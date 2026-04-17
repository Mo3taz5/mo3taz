import { ipcMain } from "electron";
import { AnalyticsService, AnalyticsEvent } from "@main/services/analytics.service";

export function registerAnalyticsEvents() {
  const analytics = AnalyticsService.getInstance();

  ipcMain.handle("analytics:track", async (_, event: AnalyticsEvent, metadata?: Record<string, any>) => {
    await analytics.track(event, metadata);
    return { success: true };
  });

  ipcMain.handle("analytics:flush", async () => {
    await analytics.flush();
    return { success: true };
  });
}
