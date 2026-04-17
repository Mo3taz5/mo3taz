import { ipcRenderer } from "electron";

export const analyticsAPI = {
  track: (event: string, metadata?: Record<string, any>) => 
    ipcRenderer.invoke("analytics:track", event, metadata),
  
  flush: () => 
    ipcRenderer.invoke("analytics:flush"),
};
