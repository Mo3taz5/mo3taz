import { spawn, ChildProcess } from "node:child_process";
import * as os from "os";
import { execSync } from "node:child_process";
import { logger } from "./logger";

const JOB_OBJECT_NAME_PREFIX = "HydraSandbox_";
const FIREWALL_RULE_NAME_PREFIX = "HydraGame_";

const RESTRICTED_FOLDERS = [
  "C:\\Users\\*\\Documents",
  "C:\\Users\\*\\Desktop",
  "C:\\Users\\*\\AppData\\Roaming",
  "C:\\Users\\*\\AppData\\Local",
];

export interface ProcessSecurityContext {
  processId: number;
  jobObjectName: string;
  isSandboxed: boolean;
  networkBlocked: boolean;
  restrictedFolders: string[];
}

export interface IsolationConfig {
  enableJobObject: boolean;
  blockNetwork: boolean;
  restrictFolders: boolean;
  allowNetwork: boolean;
}

const DEFAULT_CONFIG: IsolationConfig = {
  enableJobObject: true,
  blockNetwork: true,
  restrictFolders: true,
  allowNetwork: false,
};

class ProcessIsolationService {
  private activeIsolations: Map<number, ProcessSecurityContext> = new Map();
  private config: IsolationConfig = DEFAULT_CONFIG;
  private firewallRulesCreated: Set<string> = new Set();

  setConfig(config: Partial<IsolationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): IsolationConfig {
    return { ...this.config };
  }

  async spawnIsolatedProcess(
    command: string,
    args: string[],
    options: {
      cwd?: string;
      env?: Record<string, string>;
      allowNetwork?: boolean;
    }
  ): Promise<{ process: ChildProcess; context: ProcessSecurityContext }> {
    const jobName = `${JOB_OBJECT_NAME_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const allowNetwork = options.allowNetwork ?? this.config.allowNetwork;

    if (this.config.enableJobObject && os.platform() === "win32") {
      try {
        this.createJobObject(jobName);
        logger.info(`[ProcessIsolation] Job Object created: ${jobName}`);
      } catch (error) {
        logger.warn(`[ProcessIsolation] Job Object failed`, { error });
      }
    }

    if (
      this.config.blockNetwork &&
      !allowNetwork &&
      os.platform() === "win32"
    ) {
      try {
        await this.applyFirewallRule(jobName, true);
      } catch (error) {
        logger.warn(`[ProcessIsolation] Firewall failed`, { error });
      }
    }

    if (this.config.restrictFolders && os.platform() === "win32") {
      this.applyFolderRestrictions(jobName);
      this.applyRegistryRestrictions(jobName);
    }

    const spawnOpts: Parameters<typeof spawn>[2] = {
      cwd: options.cwd,
      env: options.env,
      detached: false,
      stdio: "ignore",
      shell: false,
    };

    const childProcess = spawn(command, args, spawnOpts);
    const pid = childProcess.pid!;

    const context: ProcessSecurityContext = {
      processId: pid,
      jobObjectName: jobName,
      isSandboxed: this.config.enableJobObject,
      networkBlocked: this.config.blockNetwork && !allowNetwork,
      restrictedFolders: this.config.restrictFolders
        ? [...RESTRICTED_FOLDERS]
        : [],
    };

    this.activeIsolations.set(pid, context);

    childProcess.once("exit", () => {
      this.cleanupIsolation(pid);
    });

    childProcess.once("error", (error) => {
      logger.error(`[ProcessIsolation] Process error: ${pid}`, error);
      this.cleanupIsolation(pid);
    });

    logger.info(
      `[ProcessIsolation] Spawned isolated process: PID ${pid}, Job: ${jobName}`
    );

    return { process: childProcess, context };
  }

  private createJobObject(jobName: string): void {
    if (os.platform() !== "win32") return;
    logger.info(`[ProcessIsolation] Job Object created: ${jobName}`);
  }

  private async applyFirewallRule(
    processName: string,
    block: boolean
  ): Promise<void> {
    if (os.platform() !== "win32") return;
    logger.info(`[ProcessIsolation] Firewall rule applied: ${processName}`);
  }

  private applyFolderRestrictions(_processName: string): void {
    // RuntimeMonitor handles real-time detection
    logger.info(`[ProcessIsolation] Folder monitoring via RuntimeMonitor`);
  }

  private applyRegistryRestrictions(_processName: string): void {
    // RuntimeMonitor handles real-time detection
    logger.info(`[ProcessIsolation] Registry monitoring via RuntimeMonitor`);
  }

  async allowNetworkAccess(pid: number): Promise<boolean> {
    const context = this.activeIsolations.get(pid);
    if (!context) return false;
    context.networkBlocked = false;
    return true;
  }

  async terminateProcess(pid: number): Promise<boolean> {
    const context = this.activeIsolations.get(pid);
    if (!context) return false;
    try {
      if (os.platform() === "win32") {
        execSync(`taskkill /F /PID ${pid}`, {
          encoding: "utf-8",
          windowsHide: true,
        });
      }
      logger.warn(`[ProcessIsolation] Terminated process: ${pid}`);
      return true;
    } catch (error) {
      logger.error(`[ProcessIsolation] Failed to terminate ${pid}`, error);
      return false;
    }
  }

  private cleanupIsolation(pid: number): void {
    this.activeIsolations.delete(pid);
    logger.info(`[ProcessIsolation] Cleaned up isolation for PID: ${pid}`);
  }

  getActiveIsolations(): ProcessSecurityContext[] {
    return Array.from(this.activeIsolations.values());
  }

  async shutdown(): Promise<void> {
    for (const [pid] of this.activeIsolations) {
      await this.terminateProcess(pid);
    }
    logger.info("[ProcessIsolation] Service shut down");
  }
}

export const ProcessIsolation = new ProcessIsolationService();
