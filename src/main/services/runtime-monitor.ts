import * as os from "os";
import { execSync } from "node:child_process";
import { logger } from "./logger";

interface ProcessMetrics {
  pid: number;
  cpuUsage: number;
  memoryMB: number;
  childProcesses: number;
  networkConnections: number;
  timestamp: number;
}

interface Anomaly {
  type:
    | "high_cpu"
    | "suspicious_child"
    | "registry_mod"
    | "file_write"
    | "suspicious_network";
  severity: "critical" | "warning";
  details: Record<string, unknown>;
  timestamp: number;
}

const HIGH_CPU_THRESHOLD = 90;
const MONITOR_INTERVAL_MS = 2000;

class RuntimeMonitorService {
  private monitoredPids: Set<number> = new Set();
  private metricsHistory: Map<number, ProcessMetrics[]> = new Map();
  private anomalies: Anomaly[] = [];
  private isMonitoring = false;
  private monitorInterval: ReturnType<typeof setInterval> | null = null;
  private initialChildProcesses: Map<number, Set<number>> = new Map();

  startMonitoring(pid: number): void {
    this.monitoredPids.add(pid);
    this.metricsHistory.set(pid, []);
    this.anomalies = [];
    this.initialChildProcesses.set(pid, new Set());
    this.captureChildProcesses(pid);

    if (!this.isMonitoring) {
      this.isMonitoring = true;
      this.monitorLoop();
    }

    logger.info(`[RuntimeMonitor] Started monitoring PID: ${pid}`);
  }

  private captureChildProcesses(pid: number): void {
    try {
      if (os.platform() === "win32") {
        const output = execSync(
          `wmic process where "ParentProcessId=${pid}" get ProcessId /value`,
          { encoding: "utf-8", windowsHide: true }
        );
        const childPids = new Set<number>();
        const matches = output.matchAll(/ProcessId=(\d+)/g);
        for (const match of matches) {
          childPids.add(parseInt(match[1], 10));
        }
        this.initialChildProcesses.set(pid, childPids);
        logger.info(
          `[RuntimeMonitor] Initial children for ${pid}:`,
          Array.from(childPids)
        );
      }
    } catch (err) {
      logger.warn(`[RuntimeMonitor] Failed to capture children: ${err}`);
    }
  }

  stopMonitoring(pid: number): void {
    this.monitoredPids.delete(pid);
    this.metricsHistory.delete(pid);
    this.initialChildProcesses.delete(pid);

    if (this.monitoredPids.size === 0 && this.isMonitoring) {
      this.isMonitoring = false;
      if (this.monitorInterval) {
        clearInterval(this.monitorInterval);
        this.monitorInterval = null;
      }
    }

    logger.info(`[RuntimeMonitor] Stopped monitoring PID: ${pid}`);
  }

  private monitorLoop(): void {
    this.monitorInterval = setInterval(async () => {
      for (const pid of this.monitoredPids) {
        await this.checkProcess(pid);
      }
    }, MONITOR_INTERVAL_MS);
  }

  private async checkProcess(pid: number): Promise<void> {
    try {
      const metrics = await this.getProcessMetrics(pid);
      if (!metrics) {
        this.stopMonitoring(pid);
        return;
      }

      const history = this.metricsHistory.get(pid) || [];
      history.push(metrics);
      if (history.length > 10) history.shift();
      this.metricsHistory.set(pid, history);

      await this.detectAnomalies(pid, metrics);
    } catch (err) {
      logger.warn(`[RuntimeMonitor] Check failed for PID ${pid}: ${err}`);
    }
  }

  private async getProcessMetrics(pid: number): Promise<ProcessMetrics | null> {
    try {
      if (os.platform() === "win32") {
        let cpuUsage = 0;
        let memoryMB = 0;

        try {
          const cpuOut = execSync(
            `wmic path Win32_PerfFormattedData_PerfProc_Process where "IDProcess=${pid}" get PercentProcessorTime /value`,
            { encoding: "utf-8", windowsHide: true }
          );
          const cpuMatch = cpuOut.match(/PercentProcessorTime=(\d+)/);
          cpuUsage = cpuMatch ? parseInt(cpuMatch[1], 10) : 0;
        } catch {}

        try {
          const memOut = execSync(
            `wmic process where processid=${pid} get WorkingSetSize /value`,
            { encoding: "utf-8", windowsHide: true }
          );
          const memMatch = memOut.match(/WorkingSetSize=(\d+)/);
          memoryMB = memMatch
            ? Math.round(parseInt(memMatch[1], 10) / (1024 * 1024))
            : 0;
        } catch {}

        let childCount = 0;
        try {
          const childOut = execSync(
            `wmic process where "ParentProcessId=${pid}" get ProcessId`,
            { encoding: "utf-8", windowsHide: true }
          );
          childCount = (childOut.match(/ProcessId/g) || []).length - 1;
          if (childCount < 0) childCount = 0;
        } catch {}

        let netCount = 0;
        try {
          const netOut = execSync(`netstat -ano | findstr " ${pid} "`, {
            encoding: "utf-8",
            windowsHide: true,
          });
          netCount = netOut.split("\n").filter((l) => l.trim()).length;
        } catch {}

        return {
          pid,
          cpuUsage,
          memoryMB,
          childProcesses: childCount,
          networkConnections: netCount,
          timestamp: Date.now(),
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  private async detectAnomalies(
    pid: number,
    metrics: ProcessMetrics
  ): Promise<void> {
    if (metrics.cpuUsage > HIGH_CPU_THRESHOLD) {
      const anomaly: Anomaly = {
        type: "high_cpu",
        severity: "warning",
        details: { pid, cpu: metrics.cpuUsage },
        timestamp: Date.now(),
      };
      this.anomalies.push(anomaly);
      logger.warn(`[RuntimeMonitor] HIGH CPU: ${metrics.cpuUsage}%`);
      logger.error(
        `[SECURITY] Terminating: High CPU usage ${metrics.cpuUsage}%`
      );
      this.terminateProcess(pid);
      return;
    }

    if (metrics.childProcesses > 5) {
      const anomaly: Anomaly = {
        type: "suspicious_child",
        severity: "critical",
        details: { pid, children: metrics.childProcesses },
        timestamp: Date.now(),
      };
      this.anomalies.push(anomaly);
      logger.error(
        `[RuntimeMonitor] CRITICAL: Suspicious child processes: ${metrics.childProcesses}`
      );
      logger.error(
        `[SECURITY] Terminating: Suspicious child process injection detected`
      );
      this.terminateProcess(pid);
      return;
    }

    if (metrics.networkConnections > 10) {
      const anomaly: Anomaly = {
        type: "suspicious_network",
        severity: "warning",
        details: { pid, connections: metrics.networkConnections },
        timestamp: Date.now(),
      };
      this.anomalies.push(anomaly);
      logger.warn(
        `[RuntimeMonitor] Suspicious network: ${metrics.networkConnections} connections`
      );
    }
  }

  private terminateProcess(pid: number): void {
    try {
      if (os.platform() === "win32") {
        execSync(`taskkill /F /PID ${pid}`, {
          encoding: "utf-8",
          windowsHide: true,
        });
        logger.warn(`[RuntimeMonitor] Terminated suspicious process: ${pid}`);
      }
    } catch (err) {
      logger.error(`[RuntimeMonitor] Failed to terminate ${pid}: ${err}`);
    }
  }

  getAnomalies(): Anomaly[] {
    return this.anomalies.slice(-20);
  }

  async shutdown(): Promise<void> {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
    this.monitoredPids.clear();
    this.metricsHistory.clear();
    logger.info("[RuntimeMonitor] Service shut down");
  }
}

export const RuntimeMonitor = new RuntimeMonitorService();
