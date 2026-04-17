/**
 * VirusTotal Scanner - Static Analysis Module
 *
 * Integrates with VirusTotal API to scan game executables for malware detection.
 * Uses file hash lookup and optional submission for comprehensive threat detection.
 *
 * @requires VirusTotal API Key (free tier: 4 requests/minute, 600/day)
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { promisify } from "node:util";
import { logger } from "../logger";
import { securityLogger } from "./security-logger";
import type { VirusTotalResult, EngineResult } from "./types";

const requestAsync = promisify<https.RequestOptions, string>(https.request);

interface VirusTotalConfig {
  apiKey: string;
  baseUrl: string;
}

export class VirusTotalScanner {
  private config: VirusTotalConfig;
  private requestQueue: Array<() => Promise<void>> = [];
  private isProcessing = false;
  private lastRequestTime = 0;
  private minRequestInterval = 15000; // 15 seconds for free tier

  constructor(apiKey: string) {
    this.config = {
      apiKey,
      baseUrl: "www.virustotal.com",
    };
  }

  /**
   * Scan a file using VirusTotal API
   * First checks if file exists, then computes hash, then queries VT
   */
  public async scanFile(filePath: string): Promise<VirusTotalResult | null> {
    try {
      // Validate file exists
      if (!fs.existsSync(filePath)) {
        logger.warn("[VirusTotal] File not found", { filePath });
        return null;
      }

      const fileStats = fs.statSync(filePath);

      // Skip files larger than 32MB (VT limit)
      if (fileStats.size > 32 * 1024 * 1024) {
        logger.warn("[VirusTotal] File too large (>32MB)", {
          filePath,
          size: fileStats.size,
        });
        return null;
      }

      // Compute SHA-256 hash of file
      const fileHash = await this.computeFileHash(filePath);
      logger.info("[VirusTotal] File hash computed", {
        filePath,
        hash: fileHash,
      });

      // Query VT with hash
      const result = await this.queryHash(fileHash);

      if (result) {
        securityLogger.logScan(
          filePath,
          this.getThreatLevel(result.positiveCount),
          `VT Scan: ${result.positiveCount}/${result.totalCount} detections`
        );
      }

      return result;
    } catch (error) {
      logger.error("[VirusTotal] Scan failed", { filePath, error });
      securityLogger.error(
        "VIRUSTOTAL",
        "ScanFailed",
        filePath,
        `Error: ${(error as Error).message}`
      );
      return null;
    }
  }

  /**
   * Compute SHA-256 hash of a file
   */
  private async computeFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");
      const stream = fs.createReadStream(filePath);

      stream.on("data", (data) => hash.update(data));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", reject);
    });
  }

  /**
   * Query VirusTotal API with file hash
   */
  private async queryHash(hash: string): Promise<VirusTotalResult | null> {
    // Rate limiting
    await this.waitForRateLimit();

    const options: https.RequestOptions = {
      hostname: this.config.baseUrl,
      path: `/api/v3/files/${hash}`,
      method: "GET",
      headers: {
        "x-apikey": this.config.apiKey,
        Accept: "application/json",
      },
    };

    try {
      const response = await requestAsync(options);
      const data = JSON.parse(response);

      if (data.error) {
        logger.warn("[VirusTotal] API error", { error: data.error });
        return null;
      }

      // Parse response
      const lastAnalysis = data.data?.attributes?.last_analysis_results || {};
      const engines = Object.entries(lastAnalysis).map(
        ([name, result]: [string, any]) => ({
          engineName: name,
          engineVersion: result.engine_version || "unknown",
          detected: result.category === "malicious",
          malwareName: result.malware_name,
          result: result.result,
        })
      );

      const positives = engines.filter((e) => e.detected).length;

      return {
        scanId: data.data?.id || hash,
        permalink: `https://www.virustotal.com/gui/file/${hash}`,
        positiveCount: positives,
        totalCount: engines.length,
        scanDate: data.data?.attributes?.last_analysis_date
          ? new Date(
              data.data.attributes.last_analysis_date * 1000
            ).toISOString()
          : new Date().toISOString(),
        positives: {
          malware: positives,
          suspicious: 0,
          clean: engines.length - positives,
          undected: 0,
        },
        scans: Object.fromEntries(
          engines.map((e) => [
            e.engineName,
            {
              detected: e.detected,
              malwareName: e.malwareName,
              result: e.result,
            },
          ])
        ),
      };
    } catch (error: any) {
      if (
        error.code === "ECONNREFUSED" ||
        error.message?.includes("ENOTFOUND")
      ) {
        logger.warn("[VirusTotal] Cannot connect to VT API");
        return null;
      }
      throw error;
    }
  }

  /**
   * Wait for rate limit
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      logger.info("[VirusTotal] Rate limiting", { waitMs: waitTime });
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Determine threat level based on positive count
   */
  private getThreatLevel(positives: number): string {
    if (positives >= 10) return "critical";
    if (positives >= 5) return "suspicious";
    if (positives >= 1) return "moderate";
    return "low";
  }

  /**
   * Batch scan multiple files
   */
  public async scanFiles(
    filePaths: string[]
  ): Promise<Map<string, VirusTotalResult | null>> {
    const results = new Map<string, VirusTotalResult | null>();

    for (const filePath of filePaths) {
      const result = await this.scanFile(filePath);
      results.set(filePath, result);
    }

    return results;
  }
}
