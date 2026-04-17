import { ipcMain } from "electron";
import * as os from "os";
import { exec, execSync } from "child_process";
import { logger } from "./logger";
import {
  SecurityManager,
  SecurityThreatLevel,
  SecurityAction,
} from "./security-manager";

interface ProcessMetrics {
  pid: number;
  cpuUsage: number;
  memoryUsage: number;
  gpuUsage?: number;
  networkConnections: NetworkConnection[];
  timestamp: number;
}

interface NetworkConnection {
  localAddress: string;
  remoteAddress: string;
  state: string;
  pid: number;
  protocol: string;
}

interface PersistenceAttempt {
  type: "registry" | "scheduled_task" | "startup" | "service";
  path: string;
  timestamp: number;
}

interface BehavioralAnomaly {
  type:
    | "high_cpu_idle"
    | "high_gpu_idle"
    | "suspicious_network"
    | "persistence";
  severity: SecurityThreatLevel;
  details: Record<string, unknown>;
  timestamp: number;
}

const KNOWN_GAME_PORTS = new Set([
  27015, 27016, 27017, 27018, 27019, 27020, 3478, 3479, 3480, 3659, 5222, 6112,
  7777, 7778, 7779, 27030, 27031, 9000, 9001,
]);

const SUSPICIOUS_IP_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^127\./,
  /^224\./,
  /^240\./,
];

const HIGH_CPU_THRESHOLD = 80;
const HIGH_IDLE_THRESHOLD = 15;
const MONITOR_INTERVAL = 5000;
const ANOMALY_DETECTION_WINDOW = 60000;

const STARTUP_LOCATIONS = [
  "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
  "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce",
  "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
  "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce",
  "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run",
];

class RuntimeMonitorService {
  private monitoredPids: Set<number> = new Set();
  private metricsHistory: Map<number, ProcessMetrics[]> = new Map();
  private isMonitoring = false;
  private monitorInterval: NodeJS.Timeout | null = null;
  private lastAnomalies: BehavioralAnomaly[] = [];

  async initialize(): Promise<void> {
    this.registerIpcHandlers();
    logger.info("Runtime Monitor Service initialized");
  }

  private registerIpcHandlers(): void {
    ipcMain.handle("security:startMonitoring", async (_event, pid: number) => {
      return this.startMonitoring(pid);
    });

    ipcMain.handle("security:stopMonitoring", async (_event, pid: number) => {
      return this.stopMonitoring(pid);
    });

    ipcMain.handle(
      "security:getProcessMetrics",
      async (_event, pid: number) => {
        return this.getProcessMetrics(pid);
      }
    );

    ipcMain.handle("security:getAnomalies", async () => {
      return this.lastAnomalies;
    });

    ipcMain.handle("security:checkPersistence", async () => {
      return await this.checkPersistenceAttempts();
    });
  }

  startMonitoring(pid: number): void {
    this.monitoredPids.add(pid);
    this.metricsHistory.set(pid, []);

    if (!this.isMonitoring) {
      this.isMonitoring = true;
      this.monitorLoop();
    }

    SecurityManager.logSecurityEvent({
      threatLevel: SecurityThreatLevel.LOW,
      action: SecurityAction.LOG_ONLY,
      module: "RuntimeMonitor",
      description: `Started monitoring process: ${pid}`,
      details: { pid },
    });

    logger.info(`Started runtime monitoring for PID: ${pid}`);
  }

  stopMonitoring(pid: number): void {
    this.monitoredPids.delete(pid);
    this.metricsHistory.delete(pid);

    if (this.monitoredPids.size === 0 && this.isMonitoring) {
      this.isMonitoring = false;
      if (this.monitorInterval) {
        clearInterval(this.monitorInterval);
        this.monitorInterval = null;
      }
    }

    logger.info(`Stopped runtime monitoring for PID: ${pid}`);
  }

  private monitorLoop(): void {
    this.monitorInterval = setInterval(async () => {
      for (const pid of this.monitoredPids) {
        await this.collectAndAnalyzeMetrics(pid);
      }
    }, MONITOR_INTERVAL);
  }

  private async collectAndAnalyzeMetrics(pid: number): Promise<void> {
    try {
      const metrics = await this.getProcessMetrics(pid);
      if (!metrics) return;

      const history = this.metricsHistory.get(pid) || [];
      history.push(metrics);

      const cutoff = Date.now() - ANOMALY_DETECTION_WINDOW;
      const recentHistory = history.filter((m) => m.timestamp > cutoff);
      this.metricsHistory.set(pid, recentHistory);

      this.detectAnomalies(pid, recentHistory);
    } catch (error) {
      logger.error(`Failed to collect metrics for PID ${pid}`, error);
      this.stopMonitoring(pid);
    }
  }

  private async getProcessMetrics(pid: number): Promise<ProcessMetrics | null> {
    try {
      const cpuUsage = await this.getCpuUsage(pid);
      const memoryUsage = await this.getMemoryUsage(pid);
      const networkConnections = await this.getNetworkConnections(pid);

      return {
        pid,
        cpuUsage,
        memoryUsage,
        networkConnections,
        timestamp: Date.now(),
      };
    } catch (error) {
      return null;
    }
  }

  private async getCpuUsage(pid: number): Promise<number> {
    if (os.platform() === "win32") {
      try {
        const output = execSync(
          `wmic path Win32_PerfFormattedData_PerfProc_Process where "IDProcess=${pid}" get PercentProcessorTime /value`,
          { encoding: "utf-8", maxBuffer: 1024 * 1024 }
        );
        const match = output.match(/PercentProcessorTime=(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      } catch {
        return 0;
      }
    }
    return 0;
  }

  private async getMemoryUsage(pid: number): Promise<number> {
    if (os.platform() === "win32") {
      try {
        const output = execSync(
          `wmic process where processid=${pid} get WorkingSetSize /value`,
          { encoding: "utf-8", maxBuffer: 1024 * 1024 }
        );
        const match = output.match(/WorkingSetSize=(\d+)/);
        return match ? parseInt(match[1], 10) / (1024 * 1024) : 0;
      } catch {
        return 0;
      }
    }
    return 0;
  }

  private async getNetworkConnections(
    pid: number
  ): Promise<NetworkConnection[]> {
    try {
      if (os.platform() === "win32") {
        const output = execSync(`netstat -ano | findstr "${pid}"`, {
          encoding: "utf-8",
          maxBuffer: 1024 * 1024,
        });
        const connections: NetworkConnection[] = [];
        const lines = output.split("\n").filter((l) => l.trim());

        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 4) {
            const protocol = parts[0];
            const localAddress = parts[1];
            const remoteAddress = parts[2];
            const state = parts[3] || "UNKNOWN";

            connections.push({
              localAddress,
              remoteAddress,
              state,
              pid,
              protocol,
            });
          }
        }

        return connections;
      }
    } catch {}
    return [];
  }

  private async detectAnomalies(
    pid: number,
    history: ProcessMetrics[]
  ): Promise<void> {
    if (history.length < 3) return;

    const recentMetrics = history.slice(-3);
    const avgCpu =
      recentMetrics.reduce((sum, m) => sum + m.cpuUsage, 0) /
      recentMetrics.length;

    if (avgCpu > HIGH_CPU_THRESHOLD) {
      const isGameIdle = await this.checkIfGameIsIdle(pid);

      if (isGameIdle || avgCpu > 95) {
        const anomaly: BehavioralAnomaly = {
          type: "high_cpu_idle",
          severity: SecurityThreatLevel.CRITICAL,
          details: { pid, avgCpu, isGameIdle },
          timestamp: Date.now(),
        };

        this.lastAnomalies.push(anomaly);
        this.handleAnomaly(anomaly);
      }
    }

    for (const metrics of recentMetrics) {
      for (const conn of metrics.networkConnections) {
        if (this.isSuspiciousConnection(conn)) {
          const anomaly: BehavioralAnomaly = {
            type: "suspicious_network",
            severity: SecurityThreatLevel.SUSPICIOUS,
            details: { pid, connection: conn },
            timestamp: Date.now(),
          };

          this.lastAnomalies.push(anomaly);
          this.handleAnomaly(anomaly);
        }
      }
    }
  }

  private async checkIfGameIsIdle(pid: number): Promise<boolean> {
    try {
      if (os.platform() === "win32") {
        const output = execSync(
          `powershell -command "Add-Type -TypeDefinition '[DllImport(\"user32.dll\")] public static extern bool GetAsyncKeyState(int vKey);";"(([user32]::GetAsyncKeyState(0x01) -shr 14) -eq 0) -and (([user32]::GetAsyncKeyState(0x02) -shr 14) -eq 0)"`,
          { encoding: "utf-8" }
        );
        const isIdle = output.trim().toLowerCase() === "true";
        return isIdle;
      }
    } catch {}
    return false;
  }

  private isSuspiciousConnection(conn: NetworkConnection): boolean {
    const remoteParts = conn.remoteAddress.split(":");
    if (remoteParts.length < 2) return false;

    const remoteIP = remoteParts[0];
    const remotePort = parseInt(remoteParts[1], 10);

    if (KNOWN_GAME_PORTS.has(remotePort)) return false;
    if (
      remoteIP === "127.0.0.1" ||
      remoteIP === "::1" ||
      remoteIP === "0.0.0.0"
    ) {
      return false;
    }

    for (const pattern of SUSPICIOUS_IP_PATTERNS) {
      if (pattern.test(remoteIP)) return false;
    }

    if (conn.state !== "ESTABLISHED" && conn.state !== "CLOSE_WAIT") {
      return false;
    }

    return true;
  }

  private async checkPersistenceAttempts(): Promise<PersistenceAttempt[]> {
    const attempts: PersistenceAttempt[] = [];

    try {
      if (os.platform() === "win32") {
        for (const location of STARTUP_LOCATIONS) {
          try {
            const output = execSync(`reg query "${location}"`, {
              encoding: "utf-8",
            });

            const lines = output
              .split("\n")
              .filter((l) => l.includes("REG_SZ"));

            for (const line of lines) {
              const match = line.match(/^\s+(\S+)\s+REG_SZ\s+(.+)$/);
              if (match) {
                attempts.push({
                  type: "startup",
                  path: `${location}\\${match[1]}`,
                  timestamp: Date.now(),
                });
              }
            }
          } catch {}
        }

        try {
          const output = execSync(`schtasks /query /fo LIST /v`, {
            encoding: "utf-8",
          });
          const suspiciousTasks = output.includes("Hydra") ? [] : [];

          for (const task of suspiciousTasks) {
            if (task.includes("\\")) {
              attempts.push({
                type: "scheduled_task",
                path: task.trim(),
                timestamp: Date.now(),
              });
            }
          }
        } catch {}
      }
    } catch (error) {
      logger.error("Persistence check failed", error);
    }

    if (attempts.length > 0) {
      const anomaly: BehavioralAnomaly = {
        type: "persistence",
        severity: SecurityThreatLevel.SUSPICIOUS,
        details: { attempts },
        timestamp: Date.now(),
      };

      this.lastAnomalies.push(anomaly);
      this.handleAnomaly(anomaly);
    }

    return attempts;
  }

  private handleAnomaly(anomaly: BehavioralAnomaly): void {
    const action =
      anomaly.severity === SecurityThreatLevel.CRITICAL
        ? SecurityAction.TERMINATE
        : SecurityAction.BLOCK_NETWORK;

    SecurityManager.logSecurityEvent({
      threatLevel: anomaly.severity,
      action,
      module: "RuntimeMonitor",
      description: `Behavioral anomaly detected: ${anomaly.type}`,
      details: anomaly.details,
    });

    if (anomaly.severity === SecurityThreatLevel.CRITICAL) {
      const pid = anomaly.details.pid as number;
      if (pid) {
        this.terminateProcess(pid);
      }
    }
  }

  private async terminateProcess(pid: number): Promise<void> {
    try {
      if (os.platform() === "win32") {
        execSync(`taskkill /F /PID ${pid}`, { encoding: "utf-8" });
      } else {
        process.kill(pid, "SIGKILL");
      }

      logger.warn(`Terminated process due to behavioral anomaly: ${pid}`);
    } catch (error) {
      logger.error(`Failed to terminate process ${pid}`, error);
    }
  }

  async shutdown(): Promise<void> {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
    this.monitoredPids.clear();
    this.metricsHistory.clear();
    logger.info("Runtime Monitor Service shut down");
  }

  getAnomalyHistory(): BehavioralAnomaly[] {
    return this.lastAnomalies.slice(-50);
  }
}

export const RuntimeMonitor = new RuntimeMonitorService();
