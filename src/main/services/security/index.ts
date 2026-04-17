/**
 * Hydra Security Services - Main Index
 *
 * This module provides the central security infrastructure for Hydra launcher.
 * It integrates multiple security layers to protect users without premium antivirus.
 *
 * Architecture:
 * 1. Static Analysis - VirusTotal API + Import Table analysis
 * 2. Sandboxing - Job Objects + Firewall + ACL restrictions
 * 3. Runtime Monitoring - CPU/GPU, Network, Persistence detection
 * 4. Quarantine System - ACL-protected vault for suspicious files
 *
 * @module HydraSecurity
 */

export { HydraSecurityManager } from "./hydra-security-manager";
export { StaticAnalyzer } from "./static-analyzer";
export { VirusTotalScanner } from "./virus-total-scanner";
export { ImportTableAnalyzer } from "./import-table-analyzer";
export { SandboxManager } from "./sandbox-manager";
export { JobObjectController } from "./job-object-controller";
export { FirewallManager } from "./firewall-manager";
export { ACLManager } from "./acl-manager";
export { RuntimeMonitor } from "./runtime-monitor";
export { ProcessMonitor } from "./process-monitor";
export { NetworkWatcher } from "./network-watcher";
export { PersistenceDetector } from "./persistence-detector";
export { QuarantineManager } from "./quarantine-manager";
export { SecurityLogger } from "./security-logger";

export type {
  SecurityScanResult,
  ThreatCategory,
  QuarantineFile,
  SecurityLogEntry,
  SandboxConfig,
  MonitorConfig,
} from "./types";
