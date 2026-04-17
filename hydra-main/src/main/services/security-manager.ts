import { logger } from "./logger";

export enum SecurityThreatLevel {
  CRITICAL = "critical",
  SUSPICIOUS = "suspicious",
  MODERATE = "moderate",
  LOW = "low",
}

export enum SecurityAction {
  QUARANTINE = "quarantine",
  TERMINATE = "terminate",
  BLOCK_NETWORK = "block_network",
  RESTRICT_ACCESS = "restrict_access",
  LOG_ONLY = "log_only",
  ALLOW = "allow",
}

export interface SecurityEvent {
  id: string;
  timestamp: number;
  threatLevel: SecurityThreatLevel;
  action: SecurityAction;
  module: string;
  description: string;
  details: Record<string, unknown>;
}

export interface FileAnalysisResult {
  filePath: string;
  threatLevel: SecurityThreatLevel;
  scannerResults: {
    virustotal?: {
      positives: number;
      total: number;
      scanDate: string;
    };
    importTable?: {
      suspiciousAPIs: string[];
      riskScore: number;
    };
  };
  recommendedAction: SecurityAction;
}

export interface ProcessSecurityContext {
  processId: number;
  jobObjectHandle: string;
  isSandboxed: boolean;
  networkBlocked: boolean;
  restrictedFolders: string[];
}

class SecurityManagerClass {
  private securityEvents: SecurityEvent[] = [];
  private quarantinedFiles: Map<string, FileAnalysisResult> = new Map();
  private monitoredProcesses: Map<number, ProcessSecurityContext> = new Map();
  private isEnabled = true;

  async initialize(): Promise<void> {
    logger.info("Security Manager initialized");
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    logger.info(`Security Manager ${enabled ? "enabled" : "disabled"}`);
  }

  isSecurityEnabled(): boolean {
    return this.isEnabled;
  }

  logSecurityEvent(event: Omit<SecurityEvent, "id" | "timestamp">): void {
    const fullEvent: SecurityEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    this.securityEvents.push(fullEvent);
    logger.warn(
      `[SECURITY] ${event.module}: ${event.description}`,
      event.details
    );

    if (
      event.action !== SecurityAction.LOG_ONLY &&
      event.action !== SecurityAction.ALLOW
    ) {
      this.handleSecurityAction(fullEvent);
    }
  }

  private handleSecurityAction(event: SecurityEvent): void {
    switch (event.action) {
      case SecurityAction.QUARANTINE:
        logger.error(`QUARANTINE action triggered: ${event.description}`);
        break;
      case SecurityAction.TERMINATE:
        logger.error(`TERMINATE action triggered: ${event.description}`);
        break;
      case SecurityAction.BLOCK_NETWORK:
        logger.error(`BLOCK_NETWORK action triggered: ${event.description}`);
        break;
      case SecurityAction.RESTRICT_ACCESS:
        logger.warn(`RESTRICT_ACCESS action triggered: ${event.description}`);
        break;
    }
  }

  quarantineFile(result: FileAnalysisResult): void {
    this.quarantinedFiles.set(result.filePath, result);
    this.logSecurityEvent({
      threatLevel: result.threatLevel,
      action: SecurityAction.QUARANTINE,
      module: "QuarantineManager",
      description: `File quarantined: ${result.filePath}`,
      details: { result },
    });
  }

  getQuarantinedFiles(): FileAnalysisResult[] {
    return Array.from(this.quarantinedFiles.values());
  }

  registerMonitoredProcess(context: ProcessSecurityContext): void {
    this.monitoredProcesses.set(context.processId, context);
  }

  unregisterMonitoredProcess(processId: number): void {
    this.monitoredProcesses.delete(processId);
  }

  getMonitoredProcess(processId: number): ProcessSecurityContext | undefined {
    return this.monitoredProcesses.get(processId);
  }

  getSecurityEvents(limit = 100): SecurityEvent[] {
    return this.securityEvents.slice(-limit);
  }

  clearOldEvents(maxAgeMs = 7 * 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAgeMs;
    this.securityEvents = this.securityEvents.filter(
      (e) => e.timestamp > cutoff
    );
  }
}

export const SecurityManager = new SecurityManagerClass();
