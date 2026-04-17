/**
 * Security Logger - Centralized logging for all security events
 *
 * Provides structured logging with threat levels and categorization.
 */

import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { logger } from "../logger";

export class SecurityLogger {
  private static instance: SecurityLogger;
  private logDirectory: string;
  private currentLogFile: string;
  private maxLogSize = 10 * 1024 * 1024; // 10MB

  private constructor() {
    this.logDirectory = path.join(app.getPath("userData"), "security-logs");
    this.ensureLogDirectory();
    this.currentLogFile = this.getLogFilePath();
  }

  public static getInstance(): SecurityLogger {
    if (!SecurityLogger.instance) {
      SecurityLogger.instance = new SecurityLogger();
    }
    return SecurityLogger.instance;
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
    }
  }

  private getLogFilePath(): string {
    const date = new Date().toISOString().split("T")[0];
    return path.join(this.logDirectory, `security-${date}.log`);
  }

  private rotateLogIfNeeded(): void {
    try {
      if (fs.existsSync(this.currentLogFile)) {
        const stats = fs.statSync(this.currentLogFile);
        if (stats.size > this.maxLogSize) {
          const timestamp = Date.now();
          const rotatedPath = this.currentLogFile.replace(
            ".log",
            `-${timestamp}.log`
          );
          fs.renameSync(this.currentLogFile, rotatedPath);
          this.cleanOldLogs();
        }
      }
    } catch (error) {
      logger.error("[SecurityLogger] Error rotating log", { error });
    }
  }

  private cleanOldLogs(): void {
    try {
      const files = fs
        .readdirSync(this.logDirectory)
        .filter((f) => f.startsWith("security-") && f.endsWith(".log"))
        .map((f) => ({
          name: f,
          path: path.join(this.logDirectory, f),
          time: fs.statSync(path.join(this.logDirectory, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time);

      // Keep only last 7 days
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      files.forEach((file) => {
        if (file.time < sevenDaysAgo) {
          fs.unlinkSync(file.path);
        }
      });
    } catch (error) {
      logger.error("[SecurityLogger] Error cleaning old logs", { error });
    }
  }

  private formatEntry(
    level: "info" | "warning" | "critical" | "error",
    category: string,
    action: string,
    target: string,
    details: string,
    threatLevel?: string
  ): string {
    const timestamp = new Date().toISOString();
    const levelIndicator = threatLevel
      ? `[${threatLevel.toUpperCase()}]`
      : `[${level.toUpperCase()}]`;

    return `[${timestamp}] ${levelIndicator} [${category}] ${action}: ${target} - ${details}\n`;
  }

  private writeToFile(entry: string): void {
    try {
      this.rotateLogIfNeeded();
      fs.appendFileSync(this.currentLogFile, entry, "utf-8");
    } catch (error) {
      logger.error("[SecurityLogger] Error writing to log file", { error });
    }
  }

  /**
   * Log an informational security event
   */
  public info(
    category: string,
    action: string,
    target: string,
    details: string
  ): void {
    const entry = this.formatEntry("info", category, action, target, details);
    this.writeToFile(entry);
    logger.info(`[SECURITY] ${action}: ${details}`, { category, target });
  }

  /**
   * Log a warning-level security event
   */
  public warning(
    category: string,
    action: string,
    target: string,
    details: string,
    threatLevel?: string
  ): void {
    const entry = this.formatEntry(
      "warning",
      category,
      action,
      target,
      details,
      threatLevel
    );
    this.writeToFile(entry);
    logger.warn(`[SECURITY] ${action}: ${details}`, {
      category,
      target,
      threatLevel,
    });
  }

  /**
   * Log a critical security event
   */
  public critical(
    category: string,
    action: string,
    target: string,
    details: string,
    threatLevel: string
  ): void {
    const entry = this.formatEntry(
      "critical",
      category,
      action,
      target,
      details,
      threatLevel
    );
    this.writeToFile(entry);
    logger.error(`[SECURITY] [CRITICAL] ${action}: ${details}`, {
      category,
      target,
      threatLevel,
    });
  }

  /**
   * Log a security error
   */
  public error(
    category: string,
    action: string,
    target: string,
    details: string,
    error?: Error
  ): void {
    const entry = this.formatEntry("error", category, action, target, details);
    this.writeToFile(entry);
    logger.error(`[SECURITY] ${action}: ${details}`, {
      category,
      target,
      error: error?.message,
    });
  }

  /**
   * Log scan results
   */
  public logScan(filePath: string, threatLevel: string, details: string): void {
    this.warning("SCAN", "FileScanned", filePath, details, threatLevel);
  }

  /**
   * Log quarantine action
   */
  public logQuarantine(
    filePath: string,
    quarantinedPath: string,
    threatLevel: string,
    reason: string
  ): void {
    this.critical(
      "QUARANTINE",
      "FileQuarantined",
      filePath,
      `Moved to ${quarantinedPath}. Reason: ${reason}`,
      threatLevel
    );
  }

  /**
   * Log sandbox action
   */
  public logSandbox(
    action: string,
    processName: string,
    details: string
  ): void {
    this.info("SANDBOX", action, processName, details);
  }

  /**
   * Log runtime detection
   */
  public logDetection(
    type: string,
    processName: string,
    details: string,
    threatLevel: string
  ): void {
    this.critical("RUNTIME", type, processName, details, threatLevel);
  }

  /**
   * Log firewall action
   */
  public logFirewall(action: string, target: string, details: string): void {
    this.info("FIREWALL", action, target, details);
  }

  /**
   * Log persistence detection
   */
  public logPersistence(type: string, target: string, details: string): void {
    this.critical("PERSISTENCE", type, target, details, "critical");
  }

  /**
   * Get recent security logs
   */
  public getRecentLogs(count: number = 100): string[] {
    try {
      if (!fs.existsSync(this.currentLogFile)) {
        return [];
      }
      const content = fs.readFileSync(this.currentLogFile, "utf-8");
      const lines = content.split("\n").filter(Boolean);
      return lines.slice(-count);
    } catch (error) {
      logger.error("[SecurityLogger] Error reading logs", { error });
      return [];
    }
  }

  /**
   * Get logs for specific date
   */
  public getLogsForDate(date: string): string[] {
    try {
      const logFile = path.join(this.logDirectory, `security-${date}.log`);
      if (!fs.existsSync(logFile)) {
        return [];
      }
      return fs.readFileSync(logFile, "utf-8").split("\n").filter(Boolean);
    } catch (error) {
      logger.error("[SecurityLogger] Error reading logs for date", {
        error,
        date,
      });
      return [];
    }
  }

  /**
   * Get log directory path
   */
  public getLogDirectory(): string {
    return this.logDirectory;
  }
}

export const securityLogger = SecurityLogger.getInstance();
