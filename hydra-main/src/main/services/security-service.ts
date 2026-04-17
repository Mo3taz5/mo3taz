import { ipcMain, BrowserWindow } from "electron";
import * as path from "path";
import { logger } from "./logger";
import { SecurityManager } from "./security-manager";
import { StaticAnalyzer } from "./static-analyzer";
import { ProcessIsolation } from "./process-isolation";
import { RuntimeMonitor } from "./runtime-monitor";
import { QuarantineManager } from "./quarantine-manager";

export interface SecurityConfig {
  enableStaticAnalysis: boolean;
  enableJobObjects: boolean;
  enableNetworkIsolation: boolean;
  enableFolderRestrictions: boolean;
  enableRuntimeMonitoring: boolean;
  enableQuarantine: boolean;
  virustotalApiKey?: string;
}

const DEFAULT_CONFIG: SecurityConfig = {
  enableStaticAnalysis: true,
  enableJobObjects: true,
  enableNetworkIsolation: true,
  enableFolderRestrictions: true,
  enableRuntimeMonitoring: true,
  enableQuarantine: true,
};

class SecurityServiceClass {
  private config: SecurityConfig = DEFAULT_CONFIG;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    logger.info("Initializing Hydra Security Service...");

    try {
      await SecurityManager.initialize();

      if (this.config.enableStaticAnalysis) {
        await StaticAnalyzer.initialize();
      }

      if (
        this.config.enableJobObjects ||
        this.config.enableNetworkIsolation ||
        this.config.enableFolderRestrictions
      ) {
        await ProcessIsolation.initialize();
      }

      if (this.config.enableRuntimeMonitoring) {
        await RuntimeMonitor.initialize();
      }

      if (this.config.enableQuarantine) {
        await QuarantineManager.initialize();
      }

      this.registerGlobalHandlers();

      this.isInitialized = true;
      logger.info("Hydra Security Service initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize Security Service", error);
      throw error;
    }
  }

  setConfig(config: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.virustotalApiKey) {
      process.env.VIRUSTOTAL_API_KEY = config.virustotalApiKey;
    }

    logger.info("Security config updated", config);
  }

  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  private registerGlobalHandlers(): void {
    ipcMain.handle("security:getConfig", async () => {
      return this.getConfig();
    });

    ipcMain.handle(
      "security:setConfig",
      async (_event, config: Partial<SecurityConfig>) => {
        this.setConfig(config);
        return true;
      }
    );

    ipcMain.handle("security:getSecurityEvents", async () => {
      return SecurityManager.getSecurityEvents();
    });

    ipcMain.handle("security:getDashboardStats", async () => {
      return this.getDashboardStats();
    });

    ipcMain.handle(
      "security:scanAndLaunch",
      async (_event, executablePath: string) => {
        return await this.scanAndLaunch(executablePath);
      }
    );
  }

  async scanFile(
    filePath: string
  ): Promise<ReturnType<typeof StaticAnalyzer.scanFile>> {
    if (!this.config.enableStaticAnalysis) {
      return {
        filePath,
        threatLevel: "low" as const,
        scannerResults: {},
        recommendedAction: "allow" as const,
      };
    }

    return await StaticAnalyzer.scanFile(filePath);
  }

  async scanAndLaunch(
    executablePath: string
  ): Promise<{ shouldLaunch: boolean; reason: string }> {
    const fileAnalysis = await this.scanFile(executablePath);

    if (
      fileAnalysis.threatLevel === "critical" ||
      fileAnalysis.threatLevel === "suspicious"
    ) {
      logger.warn(
        `Blocked launch due to security scan: ${executablePath}`,
        fileAnalysis
      );
      return {
        shouldLaunch: false,
        reason: `Security scan detected ${fileAnalysis.threatLevel} threat`,
      };
    }

    return { shouldLaunch: true, reason: "Security scan passed" };
  }

  async launchGameWithProtection(
    executablePath: string,
    command: string,
    args: string[],
    options: {
      cwd?: string;
      env?: Record<string, string>;
      allowNetwork?: boolean;
    }
  ): Promise<{ pid: number; isolationContext: any }> {
    const { process, isolationContext } =
      await ProcessIsolation.spawnIsolatedProcess(command, args, {
        cwd: options.cwd,
        env: options.env,
        allowNetwork: options.allowNetwork,
      });

    if (this.config.enableRuntimeMonitoring && process.pid) {
      RuntimeMonitor.startMonitoring(process.pid);
    }

    return { pid: process.pid!, isolationContext };
  }

  private getDashboardStats() {
    const events = SecurityManager.getSecurityEvents();
    const quarantined = SecurityManager.getQuarantinedFiles();
    const isolates = ProcessIsolation.getActiveIsolations();

    const threatCounts = {
      critical: 0,
      suspicious: 0,
      moderate: 0,
      low: 0,
    };

    for (const event of events) {
      threatCounts[event.threatLevel]++;
    }

    return {
      totalEvents: events.length,
      quarantinedFiles: quarantined.length,
      activeIsolations: isolates.length,
      threatCounts,
      isEnabled: SecurityManager.isSecurityEnabled(),
    };
  }

  async shutdown(): Promise<void> {
    logger.info("Shutting down Hydra Security Service...");

    await RuntimeMonitor.shutdown();
    await ProcessIsolation.shutdown();
    await QuarantineManager.shutdown();

    logger.info("Hydra Security Service shut down complete");
  }
}

export const SecurityService = new SecurityServiceClass();
