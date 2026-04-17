import { app, ipcMain, shell } from "electron";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import { logger } from "./logger";
import {
  SecurityManager,
  SecurityThreatLevel,
  SecurityAction,
  type FileAnalysisResult,
} from "./security-manager";

const QUARANTINE_FOLDER = ".hydra-security-quarantine";

interface QuarantineRecord {
  id: string;
  originalPath: string;
  quarantinedPath: string;
  threatLevel: SecurityThreatLevel;
  reason: string;
  timestamp: number;
  userReviewed: boolean;
  actionTaken?: "restored" | "deleted" | "pending";
}

class QuarantineManagerService {
  private quarantineDir: string;
  private quarantineRecords: Map<string, QuarantineRecord> = new Map();
  private isInitialized = false;

  async initialize(): Promise<void> {
    this.quarantineDir = path.join(app.getPath("userData"), QUARANTINE_FOLDER);

    try {
      if (!fs.existsSync(this.quarantineDir)) {
        fs.mkdirSync(this.quarantineDir, { recursive: true });
      }

      this.applyQuarantineACLs();

      this.loadQuarantineIndex();

      this.registerIpcHandlers();

      this.isInitialized = true;
      logger.info("Quarantine Manager initialized", {
        quarantineDir: this.quarantineDir,
      });
    } catch (error) {
      logger.error("Failed to initialize Quarantine Manager", error);
    }
  }

  private applyQuarantineACLs(): void {
    if (os.platform() !== "win32") return;

    try {
      const everyoneSid = "S-1-1-0";
      const adminsSid = "S-1-5-32-544";

      execSync(`icacls "${this.quarantineDir}" /reset /T`, {
        encoding: "utf-8",
        stdio: "ignore",
      });

      execSync(`icacls "${this.quarantineDir}" /inheritance:r`, {
        encoding: "utf-8",
        stdio: "ignore",
      });

      execSync(
        `icacls "${this.quarantineDir}" /grant:r "${everyoneSid}:(OI)(CI)(RX)"`,
        { encoding: "utf-8", stdio: "ignore" }
      );

      execSync(`icacls "${this.quarantineDir}" /grant:r "${adminsSid}:(F)"`, {
        encoding: "utf-8",
        stdio: "ignore",
      });

      execSync(`icacls "${this.quarantineDir}" /grant:r "SYSTEM:(F)"`, {
        encoding: "utf-8",
        stdio: "ignore",
      });

      logger.info("Quarantine folder ACLs applied");
    } catch (error) {
      logger.error("Failed to apply quarantine ACLs", error);
    }
  }

  private loadQuarantineIndex(): void {
    const indexPath = path.join(this.quarantineDir, "index.json");

    try {
      if (fs.existsSync(indexPath)) {
        const data = fs.readFileSync(indexPath, "utf-8");
        const records: QuarantineRecord[] = JSON.parse(data);

        for (const record of records) {
          this.quarantineRecords.set(record.id, record);
        }
      }
    } catch (error) {
      logger.error("Failed to load quarantine index", error);
    }
  }

  private saveQuarantineIndex(): void {
    const indexPath = path.join(this.quarantineDir, "index.json");

    try {
      const records = Array.from(this.quarantineRecords.values());
      fs.writeFileSync(indexPath, JSON.stringify(records, null, 2));
    } catch (error) {
      logger.error("Failed to save quarantine index", error);
    }
  }

  private registerIpcHandlers(): void {
    ipcMain.handle("security:getQuarantineFiles", async () => {
      return this.getQuarantineRecords();
    });

    ipcMain.handle(
      "security:quarantineFile",
      async (_event, filePath: string, reason: string) => {
        return await this.quarantineFile(filePath, reason);
      }
    );

    ipcMain.handle("security:restoreFile", async (_event, recordId: string) => {
      return await this.restoreFile(recordId);
    });

    ipcMain.handle(
      "security:deleteQuarantinedFile",
      async (_event, recordId: string) => {
        return await this.deleteQuarantinedFile(recordId);
      }
    );

    ipcMain.handle("security:openQuarantineFolder", async () => {
      return await shell.openPath(this.quarantineDir);
    });
  }

  async quarantineFile(
    filePath: string,
    reason: string,
    threatLevel: SecurityThreatLevel = SecurityThreatLevel.SUSPICIOUS
  ): Promise<QuarantineRecord | null> {
    try {
      if (!fs.existsSync(filePath)) {
        logger.error(`File not found for quarantine: ${filePath}`);
        return null;
      }

      const id = crypto.randomUUID();
      const ext = path.extname(filePath);
      const quarantinedFileName = `${id}${ext}`;
      const quarantinedPath = path.join(
        this.quarantineDir,
        quarantinedFileName
      );

      fs.copyFileSync(filePath, quarantinedPath);
      fs.unlinkSync(filePath);

      const record: QuarantineRecord = {
        id,
        originalPath: filePath,
        quarantinedPath,
        threatLevel,
        reason,
        timestamp: Date.now(),
        userReviewed: false,
      };

      this.quarantineRecords.set(id, record);
      this.saveQuarantineIndex();

      SecurityManager.logSecurityEvent({
        threatLevel,
        action: SecurityAction.QUARANTINE,
        module: "QuarantineManager",
        description: `File quarantined: ${filePath}`,
        details: { record },
      });

      logger.info(`File quarantined: ${filePath} -> ${quarantinedPath}`);

      return record;
    } catch (error) {
      logger.error(`Failed to quarantine file: ${filePath}`, error);
      return null;
    }
  }

  async restoreFile(recordId: string): Promise<boolean> {
    const record = this.quarantineRecords.get(recordId);
    if (!record) return false;

    try {
      if (fs.existsSync(record.originalPath)) {
        logger.error(`Original path already exists: ${record.originalPath}`);
        return false;
      }

      fs.copyFileSync(record.quarantinedPath, record.originalPath);

      record.actionTaken = "restored";
      record.userReviewed = true;
      this.saveQuarantineIndex();

      SecurityManager.logSecurityEvent({
        threatLevel: SecurityThreatLevel.LOW,
        action: SecurityAction.ALLOW,
        module: "QuarantineManager",
        description: `File restored from quarantine: ${record.originalPath}`,
        details: { record },
      });

      logger.info(
        `File restored: ${record.quarantinedPath} -> ${record.originalPath}`
      );
      return true;
    } catch (error) {
      logger.error(`Failed to restore file: ${recordId}`, error);
      return false;
    }
  }

  async deleteQuarantinedFile(recordId: string): Promise<boolean> {
    const record = this.quarantineRecords.get(recordId);
    if (!record) return false;

    try {
      if (fs.existsSync(record.quarantinedPath)) {
        fs.unlinkSync(record.quarantinedPath);
      }

      record.actionTaken = "deleted";
      record.userReviewed = true;
      this.saveQuarantineIndex();

      SecurityManager.logSecurityEvent({
        threatLevel: SecurityThreatLevel.LOW,
        action: SecurityAction.TERMINATE,
        module: "QuarantineManager",
        description: `Quarantined file deleted: ${record.originalPath}`,
        details: { record },
      });

      logger.info(`Quarantined file deleted: ${record.quarantinedPath}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete quarantined file: ${recordId}`, error);
      return false;
    }
  }

  getQuarantineRecords(): QuarantineRecord[] {
    return Array.from(this.quarantineRecords.values()).sort(
      (a, b) => b.timestamp - a.timestamp
    );
  }

  getQuarantineDirectory(): string {
    return this.quarantineDir;
  }

  async shutdown(): Promise<void> {
    this.saveQuarantineIndex();
    logger.info("Quarantine Manager shut down");
  }
}

export const QuarantineManager = new QuarantineManagerService();
