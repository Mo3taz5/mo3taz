/**
 * Security Types for Hydra Security Module
 *
 * Defines all interfaces and types for the multi-layered security system.
 */

import type { SecurityRiskCategory } from "@types";

/**
 * Threat severity levels for categorization
 */
export type ThreatLevel =
  | "critical"
  | "suspicious"
  | "moderate"
  | "low"
  | "clean";

/**
 * Status of a security scan
 */
export type ScanStatus =
  | "pending"
  | "scanning"
  | "completed"
  | "failed"
  | "quarantined";

/**
 * Result of a security scan
 */
export interface SecurityScanResult {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  scanStatus: ScanStatus;
  threatLevel: ThreatLevel;
  threatCategory?: SecurityRiskCategory;
  threatName?: string;
  threatDescription?: string;
  scanTimestamp: Date;
  scanDuration: number;
  engineResults?: EngineResult[];
  virusTotalResult?: VirusTotalResult;
  importTableAnalysis?: ImportTableAnalysis;
  quarantineAction?: QuarantineAction;
}

/**
 * Result from a single antivirus engine
 */
export interface EngineResult {
  engineName: string;
  engineVersion: string;
  detected: boolean;
  threatName?: string;
  threatType?: string;
}

/**
 * VirusTotal API scan result
 */
export interface VirusTotalResult {
  scanId: string;
  permalink: string;
  positiveCount: number;
  totalCount: number;
  scanDate: string;
  positives: {
    malware: number;
    suspicious: number;
    clean: number;
    undected: number;
  };
  scans: Record<
    string,
    {
      detected: boolean;
      malwareName?: string;
      result: string;
    }
  >;
}

/**
 * Import Table analysis result
 */
export interface ImportTableAnalysis {
  suspiciousImports: SuspiciousImport[];
  riskyImports: RiskyImport[];
  totalImports: number;
  riskScore: number;
  isSuspicious: boolean;
  reasons: string[];
}

/**
 * Suspicious import detected
 */
export interface SuspiciousImport {
  dllName: string;
  functionName: string;
  category: string;
  riskLevel: ThreatLevel;
  description: string;
}

/**
 * Risky import information
 */
export interface RiskyImport {
  dllName: string;
  functionName: string;
  category: string;
  isKnownVulnerable: boolean;
}

/**
 * Quarantine action taken
 */
export interface QuarantineAction {
  action: "quarantined" | "blocked" | "allowed" | "deleted";
  timestamp: Date;
  reason: string;
  quarantinePath?: string;
  restored?: boolean;
}

/**
 * Quarantine file information
 */
export interface QuarantineFile {
  id: string;
  originalPath: string;
  quarantinedPath: string;
  fileName: string;
  fileSize: number;
  threatLevel: ThreatLevel;
  threatCategory: SecurityRiskCategory;
  threatName?: string;
  quarantinedAt: Date;
  quarantinedBy: string;
  scanResult: SecurityScanResult;
  userNotes?: string;
  autoQuarantined: boolean;
}

/**
 * Security log entry
 */
export interface SecurityLogEntry {
  id: string;
  timestamp: Date;
  level: "info" | "warning" | "critical" | "error";
  category: string;
  action: string;
  target: string;
  details: string;
  threatLevel?: ThreatLevel;
  resolved: boolean;
  resolution?: string;
}

/**
 * Sandbox configuration
 */
export interface SandboxConfig {
  enableJobObject: boolean;
  killOnJobClose: boolean;
  restrictNetwork: boolean;
  restrictFileAccess: boolean;
  allowedFolders: string[];
  blockedFolders: string[];
  cpuLimit?: number;
  memoryLimit?: number;
  processPriority: "idle" | "below_normal" | "normal" | "above_normal" | "high";
}

/**
 * Runtime monitor configuration
 */
export interface MonitorConfig {
  enableCpuMonitor: boolean;
  enableNetworkMonitor: boolean;
  enablePersistenceMonitor: boolean;
  cpuThreshold: number;
  idleThreshold: number;
  checkInterval: number;
  maxIdleMinutes: number;
  blockedIPRanges: string[];
  allowedDomains: string[];
}

/**
 * Process information for monitoring
 */
export interface MonitoredProcess {
  pid: number;
  processName: string;
  executablePath: string;
  startTime: Date;
  cpuUsage: number;
  memoryUsage: number;
  networkConnections: NetworkConnection[];
  isGameProcess: boolean;
  sandboxed: boolean;
}

/**
 * Network connection information
 */
export interface NetworkConnection {
  localAddress: string;
  localPort: number;
  remoteAddress: string;
  remotePort: number;
  protocol: "TCP" | "UDP";
  state: string;
  processId: number;
}

/**
 * Firewall rule configuration
 */
export interface FirewallRule {
  ruleName: string;
  direction: "inbound" | "outbound";
  action: "allow" | "block";
  protocol: "TCP" | "UDP" | "Any";
  localPort?: number;
  remotePort?: number;
  remoteIP?: string;
  profile: "Domain" | "Private" | "Public" | "All";
  enabled: boolean;
}

/**
 * ACL permission entry
 */
export interface ACLEntry {
  path: string;
  principal: string;
  accessType: "allow" | "deny";
  permissions: string[];
  inheritance: "none" | "container_inherit" | "object_inherit";
}

/**
 * Security dashboard summary
 */
export interface SecurityDashboard {
  totalScans: number;
  threatsDetected: number;
  quarantinedFiles: number;
  blockedConnections: number;
  monitoredProcesses: number;
  recentActivity: SecurityLogEntry[];
  threatBreakdown: Record<ThreatLevel, number>;
  lastScanTime?: Date;
  systemHealth: "secure" | "warning" | "critical";
}

/**
 * Security settings from user preferences
 */
export interface SecuritySettings {
  autoScanOnDownload: boolean;
  scanBeforeLaunch: boolean;
  quarantineSuspicious: boolean;
  enableSandboxing: boolean;
  enableRuntimeMonitoring: boolean;
  enableFirewallRules: boolean;
  enableACLRestrictions: boolean;
  virusTotalApiKey?: string;
  cpuMonitorThreshold: number;
  networkMonitorEnabled: boolean;
  logRetentionDays: number;
}
