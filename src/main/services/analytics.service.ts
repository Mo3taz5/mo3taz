import os from "node:os";
import { app } from "electron";
import axios from "axios";
import { logger } from "./logger";

/**
 * Analytics event types
 */
export enum AnalyticsEvent {
  AppLaunch = "app_launch",
  AppClose = "app_close",
  LoginAttempt = "login_attempt",
  LoginSuccess = "login_success",
  LoginFailed = "login_failed",
  SignOut = "sign_out",
  GameLaunch = "game_launch",
  GameDownload = "game_download",
  SettingsOpen = "settings_open",
  ThemeChange = "theme_change",
  LanguageChange = "language_change",
  ExternalAuth = "external_auth",
  LibraryImport = "library_import",
}

/**
 * Anonymous user telemetry data
 */
interface TelemetryPayload {
  // App identification
  appId: string;
  
  // Anonymous user identifier (machine fingerprint)
  anonymousId: string;
  
  // Event information
  event: AnalyticsEvent;
  timestamp: string;
  
  // System information (anonymous)
  system: {
    platform: string;
    arch: string;
    osVersion: string;
    osRelease: string;
    totalMemoryGB: number;
    cpuModel: string;
    cpuCores: number;
  };
  
  // App information
  app: {
    version: string;
    language: string;
    isDev: boolean;
    uptime: number;
  };
  
  // Event-specific metadata (optional)
  metadata?: Record<string, any>;
}

/**
 * AnalyticsService - Sends anonymous usage telemetry to help understand user behavior.
 * Does NOT collect personal data, emails, passwords, or identifiable information.
 */
export class AnalyticsService {
  private static instance: AnalyticsService;
  private analyticsUrl: string;
  private queue: TelemetryPayload[] = [];
  private isProcessing = false;
  private anonymousId: string;
  
  private constructor() {
    this.analyticsUrl = import.meta.env.MAIN_VITE_ANALYTICS_URL || "";
    this.anonymousId = this.generateAnonymousId();
  }

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  /**
   * Generate a persistent anonymous ID for the machine
   */
  private generateAnonymousId(): string {
    const machineInfo = `${os.hostname()}-${os.platform()}-${os.arch()}`;
    // Simple hash to create consistent anonymous ID
    let hash = 0;
    for (let i = 0; i < machineInfo.length; i++) {
      const char = machineInfo.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `anon_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
  }

  /**
   * Send an analytics event
   */
  async track(event: AnalyticsEvent, metadata?: Record<string, any>): Promise<void> {
    if (!this.analyticsUrl) {
      logger.debug("[Analytics] No analytics URL configured, skipping");
      return;
    }

    const payload: TelemetryPayload = {
      appId: "mo3taz-launcher",
      anonymousId: this.anonymousId,
      event,
      timestamp: new Date().toISOString(),
      system: {
        platform: process.platform,
        arch: process.arch,
        osVersion: os.version(),
        osRelease: os.release(),
        totalMemoryGB: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
        cpuModel: os.cpus()[0]?.model || "Unknown",
        cpuCores: os.cpus().length,
      },
      app: {
        version: app.getVersion(),
        language: app.getLocale(),
        isDev: !app.isPackaged,
        uptime: process.uptime(),
      },
      metadata,
    };

    // Queue the event
    this.queue.push(payload);
    
    // Process queue
    this.processQueue();
  }

  /**
   * Process the analytics queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const batch = this.queue.splice(0, 10); // Send in batches of 10
      
      await axios.post(this.analyticsUrl, {
        events: batch,
      }, {
        timeout: 5000,
        headers: {
          "Content-Type": "application/json",
        },
      });

      logger.debug(`[Analytics] Sent ${batch.length} events successfully`);
    } catch (error: any) {
      logger.warn("[Analytics] Failed to send events:", error.message || error);
      // Put failed events back in queue
      this.queue.unshift(...this.queue);
    } finally {
      this.isProcessing = false;

      // Process remaining events
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 2000);
      }
    }
  }

  /**
   * Flush all pending events (call before app exit)
   */
  async flush(): Promise<void> {
    while (this.queue.length > 0) {
      await this.processQueue();
    }
  }

  /**
   * Check if analytics is enabled
   */
  isEnabled(): boolean {
    return !!this.analyticsUrl;
  }
}
