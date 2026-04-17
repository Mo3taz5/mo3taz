import { app, ipcMain } from "electron";
import * as https from "https";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";
import {
  SecurityManager,
  SecurityThreatLevel,
  SecurityAction,
  type FileAnalysisResult,
} from "./security-manager";

const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY || "";
const VIRUSTOTAL_BASE_URL = "www.virustotal.com/api/v3";

const SUSPICIOUS_APIS = new Set([
  "WriteProcessMemory",
  "CreateRemoteThread",
  "VirtualAllocEx",
  "VirtualProtectEx",
  "OpenProcess",
  "OpenProcessToken",
  "DuplicateHandle",
  "CreateToolhelp32Snapshot",
  "Process32Next",
  "Module32Next",
  "GetProcAddress",
  "LoadLibraryExA",
  "LoadLibraryExW",
  "GetModuleHandleW",
  "GetModuleHandleA",
  "CreateFileMappingA",
  "MapViewOfFile",
  "NtCreateSection",
  "RtlCreateUserThread",
  "ZwCreateThreadEx",
  "NtMapViewOfSection",
  "QueueUserAPC",
  "SetThreadContext",
  "ResumeThread",
  "TerminateProcess",
  "ExitProcess",
  "WinExec",
  "ShellExecuteExA",
  "ShellExecuteExW",
  "URLDownloadToFileA",
  "URLDownloadToFileW",
  "InternetOpenUrlA",
  "InternetOpenUrlW",
  "InternetOpenA",
  "InternetOpenW",
  "CreateServiceA",
  "CreateServiceW",
  "StartServiceA",
  "StartServiceW",
  "ChangeServiceConfigA",
  "ChangeServiceConfigW",
  "DeleteService",
  "OpenSCManagerA",
  "OpenSCManagerW",
  "RegSetValueExA",
  "RegSetValueExW",
  "RegCreateKeyExA",
  "RegCreateKeyExW",
  "RegDeleteKeyA",
  "RegDeleteKeyW",
]);

const RISK_WEIGHTS: Record<string, number> = {
  WriteProcessMemory: 10,
  CreateRemoteThread: 10,
  VirtualAllocEx: 8,
  OpenProcess: 7,
  GetProcAddress: 6,
  LoadLibraryExA: 8,
  CreateServiceA: 9,
  DeleteService: 9,
  RegDeleteKeyA: 5,
};

interface ImportTableResult {
  suspiciousAPIs: string[];
  riskScore: number;
  importedFunctions: string[];
}

class StaticAnalyzerService {
  private virusTotalCache: Map<string, FileAnalysisResult> = new Map();
  private scanQueue: string[] = [];
  private isScanning = false;

  async initialize(): Promise<void> {
    this.registerIpcHandlers();
    logger.info("Static Analyzer Service initialized");
  }

  private registerIpcHandlers(): void {
    ipcMain.handle("security:scanFile", async (_event, filePath: string) => {
      return await this.scanFile(filePath);
    });

    ipcMain.handle(
      "security:analyzeImportTable",
      async (_event, filePath: string) => {
        return await this.analyzeImportTable(filePath);
      }
    );

    ipcMain.handle("security:getScanResults", async () => {
      return Array.from(this.virusTotalCache.values());
    });
  }

  async scanFile(filePath: string): Promise<FileAnalysisResult> {
    const cached = this.virusTotalCache.get(filePath);
    if (cached) return cached;

    const extension = path.extname(filePath).toLowerCase();
    if (extension !== ".exe" && extension !== ".dll") {
      return {
        filePath,
        threatLevel: SecurityThreatLevel.LOW,
        scannerResults: {},
        recommendedAction: SecurityAction.ALLOW,
      };
    }

    logger.info(`Scanning file: ${filePath}`);

    const importTable = await this.analyzeImportTable(filePath);
    let virustotalResult:
      | FileAnalysisResult["scannerResults"]["virustotal"]
      | undefined;

    if (VIRUSTOTAL_API_KEY) {
      try {
        virustotalResult = await this.scanWithVirusTotal(filePath);
      } catch (error) {
        logger.error("VirusTotal scan failed", error);
      }
    }

    const threatLevel = this.calculateThreatLevel(
      importTable,
      virustotalResult
    );
    const recommendedAction = this.determineAction(threatLevel, importTable);

    const result: FileAnalysisResult = {
      filePath,
      threatLevel,
      scannerResults: {
        importTable: {
          suspiciousAPIs: importTable.suspiciousAPIs,
          riskScore: importTable.riskScore,
        },
        virustotal: virustotalResult,
      },
      recommendedAction,
    };

    this.virusTotalCache.set(filePath, result);

    if (
      threatLevel === SecurityThreatLevel.CRITICAL ||
      threatLevel === SecurityThreatLevel.SUSPICIOUS
    ) {
      SecurityManager.logSecurityEvent({
        threatLevel,
        action: SecurityAction.QUARANTINE,
        module: "StaticAnalyzer",
        description: `Suspicious file detected: ${filePath}`,
        details: { result },
      });
      SecurityManager.quarantineFile(result);
    } else {
      SecurityManager.logSecurityEvent({
        threatLevel,
        action: SecurityAction.LOG_ONLY,
        module: "StaticAnalyzer",
        description: `File scanned: ${filePath}`,
        details: { result },
      });
    }

    return result;
  }

  async analyzeImportTable(filePath: string): Promise<ImportTableResult> {
    const result: ImportTableResult = {
      suspiciousAPIs: [],
      riskScore: 0,
      importedFunctions: [],
    };

    try {
      const buffer = fs.readFileSync(filePath);
      if (buffer.length < 2) return result;

      const dosHeader = buffer.readUInt16LE(0);
      if (dosHeader !== 0x5a4d) {
        logger.warn(`Invalid DOS header for ${filePath}`);
        return result;
      }

      const peOffset = buffer.readUInt32LE(60);
      if (peOffset + 24 > buffer.length) return result;

      const machine = buffer.readUInt16LE(peOffset + 4);
      if (machine !== 0x014c && machine !== 0x8664) {
        return result;
      }

      const optHeaderSize = buffer.readUInt16LE(peOffset + 20);
      const numSections = buffer.readUInt16LE(peOffset + 6);

      let importRva = 0;
      let importSize = 0;

      if (optHeaderSize >= 144) {
        const dataDirOffset = peOffset + 96;
        importRva = buffer.readUInt32LE(dataDirOffset + 8);
        importSize = buffer.readUInt32LE(dataDirOffset + 12);
      }

      if (importRva === 0) {
        logger.warn(`No import table found for ${filePath}`);
        return result;
      }

      const va = this.rvaToOffset(buffer, importRva);
      if (va === 0 || va + 20 > buffer.length) return result;

      let iltRva = buffer.readUInt32LE(va);
      if (iltRva === 0) return result;

      let iltOffset = this.rvaToOffset(buffer, iltRva);
      while (iltOffset > 0 && iltOffset + 8 < buffer.length) {
        const nameRva = buffer.readUInt32LE(iltOffset + 12);
        if (nameRva > 0) {
          const nameOffset = this.rvaToOffset(buffer, nameRva);
          if (nameOffset > 0 && nameOffset < buffer.length) {
            let nameEnd = nameOffset;
            while (nameEnd < buffer.length && buffer[nameEnd] !== 0) nameEnd++;
            const funcName = buffer.toString("ascii", nameOffset, nameEnd);

            result.importedFunctions.push(funcName);

            if (SUSPICIOUS_APIS.has(funcName)) {
              result.suspiciousAPIs.push(funcName);
              const weight = RISK_WEIGHTS[funcName] || 3;
              result.riskScore += weight;
            }
          }
        }

        iltOffset += 20;
      }
    } catch (error) {
      logger.error(`Import table analysis failed for ${filePath}`, error);
    }

    return result;
  }

  private rvaToOffset(buffer: Buffer, rva: number): number {
    const dosHeader = buffer.readUInt16LE(0);
    if (dosHeader !== 0x5a4d) return 0;

    const peOffset = buffer.readUInt32LE(60);
    if (peOffset + 24 > buffer.length) return 0;

    const optHeaderSize = buffer.readUInt16LE(peOffset + 20);
    if (optHeaderSize < 24) return 0;

    const numSections = buffer.readUInt16LE(peOffset + 6);
    const sectionTableOffset = peOffset + 24 + optHeaderSize;

    for (let i = 0; i < numSections; i++) {
      const sectionOffset = sectionTableOffset + i * 40;
      if (sectionOffset + 40 > buffer.length) break;

      const virtualSize = buffer.readUInt32LE(sectionOffset + 8);
      const virtualAddress = buffer.readUInt32LE(sectionOffset + 12);
      const rawSize = buffer.readUInt32LE(sectionOffset + 16);
      const rawOffset = buffer.readUInt32LE(sectionOffset + 20);

      if (rva >= virtualAddress && rva < virtualAddress + virtualSize) {
        return rawOffset + (rva - virtualAddress);
      }
    }

    return 0;
  }

  private async scanWithVirusTotal(filePath: string): Promise<{
    positives: number;
    total: number;
    scanDate: string;
  }> {
    return new Promise((resolve, reject) => {
      const fileBuffer = fs.readFileSync(filePath);
      const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

      const options = {
        hostname: VIRUSTOTAL_BASE_URL,
        path: `/files/${hash}`,
        method: "GET",
        headers: {
          "x-apikey": VIRUSTOTAL_API_KEY,
          Accept: "application/json",
        },
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.data?.attributes?.last_analysis_stats) {
              const stats = json.data.attributes.last_analysis_stats;
              resolve({
                positives: stats.malicious + stats.suspicious,
                total:
                  stats.undetected +
                  stats.malicious +
                  stats.suspicious +
                  stats.undetected,
                scanDate: new Date(
                  json.data.attributes.last_analysis_date * 1000
                ).toISOString(),
              });
            } else {
              resolve({
                positives: 0,
                total: 0,
                scanDate: new Date().toISOString(),
              });
            }
          } catch {
            resolve({
              positives: 0,
              total: 0,
              scanDate: new Date().toISOString(),
            });
          }
        });
      });

      req.on("error", reject);
      req.end();
    });
  }

  private calculateThreatLevel(
    importTable: ImportTableResult,
    virustotal?: { positives: number; total: number }
  ): SecurityThreatLevel {
    let riskScore = importTable.riskScore;

    if (virustotal && virustotal.total > 0) {
      const detectionRate = virustotal.positives / virustotal.total;
      if (detectionRate > 0.5) riskScore += 20;
      else if (detectionRate > 0.2) riskScore += 10;
      else if (detectionRate > 0.05) riskScore += 5;
    }

    if (riskScore >= 15 || (virustotal && virustotal.positives >= 5)) {
      return SecurityThreatLevel.CRITICAL;
    }
    if (riskScore >= 8 || (virustotal && virustotal.positives >= 2)) {
      return SecurityThreatLevel.SUSPICIOUS;
    }
    if (riskScore >= 3 || (virustotal && virustotal.positives >= 1)) {
      return SecurityThreatLevel.MODERATE;
    }
    return SecurityThreatLevel.LOW;
  }

  private determineAction(
    threatLevel: SecurityThreatLevel,
    importTable: ImportTableResult
  ): SecurityAction {
    if (threatLevel === SecurityThreatLevel.CRITICAL) {
      return SecurityAction.QUARANTINE;
    }
    if (threatLevel === SecurityThreatLevel.SUSPICIOUS) {
      return SecurityAction.QUARANTINE;
    }
    if (threatLevel === SecurityThreatLevel.MODERATE) {
      return SecurityAction.RESTRICT_ACCESS;
    }
    return SecurityAction.ALLOW;
  }
}

export const StaticAnalyzer = new StaticAnalyzerService();
