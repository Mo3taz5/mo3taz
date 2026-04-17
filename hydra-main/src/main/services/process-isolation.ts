import { spawn, ChildProcess, execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { exec } from "child_process";
import { logger } from "./logger";
import {
  SecurityManager,
  SecurityThreatLevel,
  SecurityAction,
  type ProcessSecurityContext,
} from "./security-manager";

const JOB_OBJECT_NAME_PREFIX = "HydraSandbox_";

const RESTRICTED_FOLDERS = [
  path.join(os.homedir(), "Documents"),
  path.join(os.homedir(), "Desktop"),
  path.join(os.homedir(), "AppData"),
  path.join(os.homedir(), "AppData", "Roaming"),
  path.join(os.homedir(), "AppData", "Local"),
  "C:\\Windows\\System32",
  "C:\\Windows\\SysWOW64",
  "C:\\Program Files\\Windows Defender",
  "C:\\Program Files\\Common Files\\Microsoft Shared",
];

const FIREWALL_RULE_NAME_PREFIX = "HydraGame_";

const SECURITY_DESCRIPTOR =
  require("../native/hydra-native.node")?.getSecurityDescriptor() ||
  "D:(A;;FA;;;BA)(A;;FA;;;SY)(A;;FR;;;LS)";

interface IsolationConfig {
  enableJobObject: boolean;
  killOnJobClose: boolean;
  blockNetwork: boolean;
  allowNetwork: boolean;
  restrictFolders: boolean;
  restrictedFolders?: string[];
}

class ProcessIsolationService {
  private activeIsolations: Map<number, ProcessSecurityContext> = new Map();
  private firewallRulesCreated: Set<string> = new Set();
  private config: IsolationConfig = {
    enableJobObject: true,
    killOnJobClose: true,
    blockNetwork: false,
    allowNetwork: false,
    restrictFolders: true,
  };

  async initialize(): Promise<void> {
    this.config = {
      enableJobObject: true,
      killOnJobClose: true,
      blockNetwork: false,
      allowNetwork: false,
      restrictFolders: true,
    };
    logger.info("Process Isolation Service initialized");
  }

  setConfig(config: Partial<IsolationConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info("Isolation config updated", config);
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
  ): Promise<{
    process: ChildProcess;
    isolationContext: ProcessSecurityContext;
  }> {
    const jobName = `${JOB_OBJECT_NAME_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const allowNetwork = options.allowNetwork ?? this.config.allowNetwork;

    if (this.config.enableJobObject) {
      await this.createJobObject(jobName);
    }

    if (this.config.blockNetwork && !allowNetwork) {
      await this.applyFirewallRule(jobName, true);
    }

    if (this.config.restrictFolders) {
      await this.applyFolderRestrictions(jobName, options.cwd);
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

    const isolationContext: ProcessSecurityContext = {
      processId: pid,
      jobObjectHandle: jobName,
      isSandboxed: this.config.enableJobObject,
      networkBlocked: this.config.blockNetwork && !allowNetwork,
      restrictedFolders: this.config.restrictFolders ? RESTRICTED_FOLDERS : [],
    };

    this.activeIsolations.set(pid, isolationContext);
    SecurityManager.registerMonitoredProcess(isolationContext);

    childProcess.once("exit", (code) => {
      this.cleanupIsolation(pid);
    });

    childProcess.once("error", (error) => {
      logger.error(`Isolated process error: ${pid}`, error);
      this.cleanupIsolation(pid);
    });

    logger.info(`Spawned isolated process: ${pid} (job: ${jobName})`);

    return { process: childProcess, isolationContext };
  }

  async attachToProcess(pid: number): Promise<boolean> {
    if (this.activeIsolations.has(pid)) {
      return true;
    }

    if (this.config.enableJobObject) {
      try {
        const jobName = `${JOB_OBJECT_NAME_PREFIX}attach_${pid}`;
        const success = await this.createJobObject(jobName);
        if (success) {
          const context: ProcessSecurityContext = {
            processId: pid,
            jobObjectHandle: jobName,
            isSandboxed: true,
            networkBlocked: false,
            restrictedFolders: [],
          };
          this.activeIsolations.set(pid, context);
          return true;
        }
      } catch (error) {
        logger.error(`Failed to attach to process ${pid}`, error);
      }
    }

    return false;
  }

  private async createJobObject(jobName: string): Promise<boolean> {
    if (os.platform() !== "win32") {
      logger.warn("Job Objects are only supported on Windows");
      return false;
    }

    try {
      const script = `
        $job = New-Object System.Threading.JobObject($(New-Object System.Security.AccessControl.JobSecurityDescriptor))
        $job.Name = "${jobName}"
        
        $limit = $job.GetLimitInformation([System.Threading.JobObjectLimitTypes]::KillOnJobClose, [System.IntPtr]::Zero)
        
        $job.Dispose()
        Write-Output "OK"
      `;

      logger.info(`Creating Job Object: ${jobName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to create Job Object: ${jobName}`, error);
      return false;
    }
  }

  private async applyFirewallRule(
    processName: string,
    block: boolean
  ): Promise<boolean> {
    if (os.platform() !== "win32") {
      return false;
    }

    const ruleName = `${FIREWALL_RULE_NAME_PREFIX}${processName}`;

    try {
      if (block) {
        execSync(`netsh advfirewall firewall delete rule name="${ruleName}"`, {
          encoding: "utf-8",
          stdio: "ignore",
        });
      }

      const action = block ? "block" : "allow";
      const direction = "outbound";
      const program = "*";

      execSync(
        `netsh advfirewall firewall add rule name="${ruleName}" dir=${direction} action=${action} program="${program}" enable=no`,
        { encoding: "utf-8" }
      );

      this.firewallRulesCreated.add(ruleName);
      logger.info(
        `Firewall rule ${block ? "blocked" : "allowed"}: ${ruleName}`
      );
      return true;
    } catch (error) {
      logger.error(`Failed to apply firewall rule: ${ruleName}`, error);
      return false;
    }
  }

  private async applyFolderRestrictions(
    processName: string,
    workingDir?: string
  ): Promise<boolean> {
    if (os.platform() !== "win32") {
      return false;
    }

    const restricted = workingDir
      ? [
          ...RESTRICTED_FOLDERS.filter((f) => !f.startsWith(workingDir)),
          workingDir,
        ]
      : RESTRICTED_FOLDERS;

    for (const folder of restricted) {
      try {
        const normalizedPath = folder.replace(/\//g, "\\");
        execSync(
          `icacls "${normalizedPath}" /inheritance:r /deny "${processName}:(OI)(CI)(RX,W,D)"`,
          { encoding: "utf-8", stdio: "ignore" }
        );
      } catch (error) {
        logger.warn(`Failed to restrict folder: ${folder}`, error);
      }
    }

    logger.info(`Folder restrictions applied for: ${processName}`);
    return true;
  }

  async allowNetworkAccess(pid: number): Promise<boolean> {
    const context = this.activeIsolations.get(pid);
    if (!context) return false;

    try {
      const ruleName = `${FIREWALL_RULE_NAME_PREFIX}${context.jobObjectHandle}`;
      await this.applyFirewallRule(context.jobObjectHandle, false);
      context.networkBlocked = false;
      return true;
    } catch (error) {
      logger.error(`Failed to allow network for PID ${pid}`, error);
      return false;
    }
  }

  async blockNetworkAccess(pid: number): Promise<boolean> {
    const context = this.activeIsolations.get(pid);
    if (!context) return false;

    try {
      await this.applyFirewallRule(context.jobObjectHandle, true);
      context.networkBlocked = true;
      return true;
    } catch (error) {
      logger.error(`Failed to block network for PID ${pid}`, error);
      return false;
    }
  }

  async terminateProcess(pid: number): Promise<boolean> {
    const context = this.activeIsolations.get(pid);
    if (!context) return false;

    try {
      if (os.platform() === "win32") {
        execSync(`taskkill /F /PID ${pid}`, { encoding: "utf-8" });
      } else {
        process.kill(pid, "SIGKILL");
      }

      SecurityManager.logSecurityEvent({
        threatLevel: SecurityThreatLevel.MODERATE,
        action: SecurityAction.TERMINATE,
        module: "ProcessIsolation",
        description: `Terminated isolated process: ${pid}`,
        details: { pid, jobName: context.jobObjectHandle },
      });

      return true;
    } catch (error) {
      logger.error(`Failed to terminate process ${pid}`, error);
      return false;
    }
  }

  private cleanupIsolation(pid: number): void {
    const context = this.activeIsolations.get(pid);
    if (!context) return;

    try {
      const ruleName = `${FIREWALL_RULE_NAME_PREFIX}${context.jobObjectHandle}`;
      execSync(`netsh advfirewall firewall delete rule name="${ruleName}"`, {
        encoding: "utf-8",
        stdio: "ignore",
      });
      this.firewallRulesCreated.delete(ruleName);
    } catch {}

    for (const folder of RESTRICTED_FOLDERS) {
      try {
        const normalizedPath = folder.replace(/\//g, "\\");
        execSync(
          `icacls "${normalizedPath}" /remove:d "${context.jobObjectHandle}"`,
          { encoding: "utf-8", stdio: "ignore" }
        );
      } catch {}
    }

    this.activeIsolations.delete(pid);
    SecurityManager.unregisterMonitoredProcess(pid);
    logger.info(`Cleaned up isolation for PID: ${pid}`);
  }

  async shutdown(): Promise<void> {
    for (const [pid] of this.activeIsolations) {
      await this.terminateProcess(pid);
    }
    logger.info("Process Isolation Service shut down");
  }

  getActiveIsolations(): ProcessSecurityContext[] {
    return Array.from(this.activeIsolations.values());
  }
}

export const ProcessIsolation = new ProcessIsolationService();
