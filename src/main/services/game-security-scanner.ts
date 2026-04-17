import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SecurityRiskCategory } from "@types";
import { logger } from "./logger";

const execFileAsync = promisify(execFile);

export type GameSecurityScanStatus =
  | "clean"
  | "threats-found"
  | "unavailable"
  | "error";

export interface GameSecurityScanResult {
  status: GameSecurityScanStatus;
  scanner: string | null;
  scanPath: string;
  details: string | null;
  exitCode: number | null;
  findings: GameSecurityFinding[];
}

export interface GameSecurityFinding {
  filePath: string | null;
  signature: string | null;
  category: SecurityRiskCategory;
  reason: string;
  description: string;
  raw: string;
}

type FindingInput = Pick<GameSecurityFinding, "filePath" | "signature" | "raw">;

const normalizeOutput = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const splitOutputLines = (output: string) =>
  output
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

const hasThreatKeywords = (text: string) =>
  /threat|malware|virus|infected|quarantine|detected/i.test(text);

const systemLevelPattern =
  /registry|regkey|autorun|startup|service|scheduled task|task scheduler|persistence|run key|boot|logon|driver|hook|inject|dll injection/i;

const networkPattern =
  /network|socket|connect|connection|http|https|tcp|udp|dns|c2|command and control|callback|beacon|remote host|exfiltrat|upload|download|websocket/i;

const knownMalwarePattern =
  /trojan|stealer|backdoor|rat|keylog|spy|ransom|worm|virus|adware|pua|potentially unwanted/i;

const normalizePathValue = (value: string) =>
  path.resolve(value).replace(/[\\/]+$/, "");

const isPathInsideRoot = (candidatePath: string, rootPath: string) => {
  const normalizedCandidate = normalizePathValue(candidatePath);
  const normalizedRoot = normalizePathValue(rootPath);
  const relative = path.relative(normalizedRoot, normalizedCandidate);

  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const hasSystemOrNetworkIndicators = (text: string) =>
  systemLevelPattern.test(text) ||
  networkPattern.test(text) ||
  knownMalwarePattern.test(text);

export const evaluateRisk = (
  finding: FindingInput,
  scanPath: string
): Pick<GameSecurityFinding, "category" | "reason"> => {
  const combinedText = [
    finding.filePath ?? "",
    finding.signature ?? "",
    finding.raw,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (hasSystemOrNetworkIndicators(combinedText)) {
    return {
      category: "Requires Investigation",
      reason:
        "The scanner saw registry, startup, service, injection, or network-related behavior.",
    };
  }

  if (finding.filePath) {
    try {
      if (isPathInsideRoot(finding.filePath, scanPath)) {
        return {
          category: "Low Risk",
          reason: "The activity appears to stay inside the game folder.",
        };
      }
    } catch {
      // Fall through to the conservative default below.
    }
  }

  return {
    category: "Requires Investigation",
    reason: "The file could not be confirmed as limited to the game folder.",
  };
};

const buildFindingDescription = (
  signature: string | null,
  filePath: string | null,
  category: SecurityRiskCategory,
  reason: string
) => {
  const targetLabel = filePath ?? "the scanned item";
  const signatureLabel = signature ?? "an unidentified threat";
  return `${signatureLabel} was flagged in ${targetLabel} (${category}): ${reason}`;
};

const parseThreatFindings = (
  output: string,
  scanPath: string
): GameSecurityFinding[] => {
  const findings: GameSecurityFinding[] = [];
  let pendingFinding: GameSecurityFinding | null = null;

  const pushFinding = (input: FindingInput) => {
    const evaluated = evaluateRisk(input, scanPath);
    findings.push({
      filePath: input.filePath,
      signature: input.signature,
      category: evaluated.category,
      reason: evaluated.reason,
      description: buildFindingDescription(
        input.signature,
        input.filePath,
        evaluated.category,
        evaluated.reason
      ),
      raw: input.raw,
    });
  };

  for (const line of splitOutputLines(output)) {
    const clamMatch = line.match(/^(.+?):\s+(.+?)\s+FOUND$/i);
    if (clamMatch) {
      pushFinding({
        filePath: clamMatch[1]?.trim() || null,
        signature: clamMatch[2]?.trim() || null,
        raw: line,
      });
      pendingFinding = null;
      continue;
    }

    const threatLabelMatch = line.match(
      /^(?:threat|threat name|name)\s*:\s*(.+)$/i
    );
    if (threatLabelMatch) {
      const finding = {
        filePath: null,
        signature: threatLabelMatch[1]?.trim() || null,
        raw: line,
      };
      pendingFinding = {
        ...finding,
        ...evaluateRisk(finding, scanPath),
        description: buildFindingDescription(
          finding.signature,
          finding.filePath,
          evaluateRisk(finding, scanPath).category,
          evaluateRisk(finding, scanPath).reason
        ),
      };
      findings.push(pendingFinding);
      continue;
    }

    const pathLabelMatch = line.match(/^(?:path|path to file)\s*:\s*(.+)$/i);
    if (pathLabelMatch && pendingFinding) {
      pendingFinding.filePath = pathLabelMatch[1]?.trim() || null;
      const evaluated = evaluateRisk(
        {
          filePath: pendingFinding.filePath,
          signature: pendingFinding.signature,
          raw: pendingFinding.raw,
        },
        scanPath
      );
      pendingFinding.category = evaluated.category;
      pendingFinding.reason = evaluated.reason;
      pendingFinding.description = buildFindingDescription(
        pendingFinding.signature,
        pendingFinding.filePath,
        evaluated.category,
        evaluated.reason
      );
      continue;
    }

    if (/found$/i.test(line) && hasThreatKeywords(line)) {
      const rawPath = line.split(":").slice(0, -1).join(":").trim() || null;
      const signature =
        line.replace(/found$/i, "").split(":").pop()?.trim() || null;
      pushFinding({
        filePath: rawPath,
        signature,
        raw: line,
      });
    }
  }

  return findings;
};

const scanWithProcess = async (
  command: string,
  args: string[],
  scanPath: string
): Promise<GameSecurityScanResult> => {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 4,
    });

    const output = [normalizeOutput(stdout), normalizeOutput(stderr)]
      .filter(Boolean)
      .join("\n");

    return {
      status: "clean",
      scanner: command,
      scanPath,
      details: output || null,
      exitCode: 0,
      findings: [],
    };
  } catch (error) {
    const exitCode =
      typeof (error as { code?: unknown }).code === "number"
        ? ((error as { code?: number }).code ?? null)
        : null;
    const errorCode = (error as { code?: unknown }).code;
    const stdout = normalizeOutput(
      (error as { stdout?: unknown }).stdout ?? ""
    );
    const stderr = normalizeOutput(
      (error as { stderr?: unknown }).stderr ?? ""
    );
    const output = [stdout, stderr].filter(Boolean).join("\n");

    if (errorCode === "ENOENT") {
      return {
        status: "unavailable",
        scanner: command,
        scanPath,
        details: output || "Security scanner was not found",
        exitCode,
        findings: [],
      };
    }

    if (hasThreatKeywords(output) || exitCode === 1) {
      const findings = parseThreatFindings(output, scanPath);

      return {
        status: "threats-found",
        scanner: command,
        scanPath,
        details: output || "Security scanner reported a threat.",
        exitCode,
        findings,
      };
    }

    logger.warn("[GameSecurityScanner] Scan failed", {
      command,
      scanPath,
      exitCode,
      output,
      error,
    });

    return {
      status: "error",
      scanner: command,
      scanPath,
      details: output || "Security scan failed",
      exitCode,
      findings: [],
    };
  }
};

const escapePowerShellSingleQuotedString = (value: string) =>
  value.replaceAll("'", "''");

const scanWithPowerShellDefender = async (
  scanPath: string
): Promise<GameSecurityScanResult> => {
  const quotedScanPath = escapePowerShellSingleQuotedString(scanPath);
  const command = `Start-MpScan -ScanType CustomScan -ScanPath '${quotedScanPath}'`;

  logger.info("[GameSecurityScanner] Scanning with PowerShell Defender", {
    scanPath,
  });

  return scanWithProcess(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command],
    scanPath
  );
};

const findWindowsDefenderScanner = (): string | null => {
  const programData = process.env.ProgramData ?? "C:\\ProgramData";
  const platformRoot = path.join(
    programData,
    "Microsoft",
    "Windows Defender",
    "Platform"
  );

  if (fs.existsSync(platformRoot)) {
    const versions = fs
      .readdirSync(platformRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .reverse();

    for (const version of versions) {
      const candidate = path.join(platformRoot, version, "MpCmdRun.exe");
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  const legacyCandidates = [
    path.join(
      process.env.ProgramFiles ?? "C:\\Program Files",
      "Windows Defender",
      "MpCmdRun.exe"
    ),
    path.join(
      process.env.ProgramFiles ?? "C:\\Program Files",
      "Windows Defender Advanced Threat Protection",
      "MpCmdRun.exe"
    ),
  ];

  return legacyCandidates.find((candidate) => fs.existsSync(candidate)) ?? null;
};

const findClamAVScanner = (): string | null => {
  const candidates = [
    "/usr/bin/clamscan",
    "/usr/bin/clamdscan",
    "/bin/clamscan",
    "/bin/clamdscan",
  ];

  return candidates.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  }) ?? "clamscan";
};

const getQuarantinePath = (scanPath: string) =>
  path.join(
    path.dirname(scanPath),
    ".hydra-security-quarantine",
    path.basename(scanPath)
  );

export const GameSecurityScanner = {
  async scanPath(scanPath: string): Promise<GameSecurityScanResult> {
    if (!scanPath || !fs.existsSync(scanPath)) {
      return {
        status: "error",
        scanner: null,
        scanPath,
        details: "Scan path does not exist",
        exitCode: null,
        findings: [],
      };
    }

    if (process.platform === "win32") {
      try {
        const powershellResult = await scanWithPowerShellDefender(scanPath);

        if (powershellResult.status !== "unavailable") {
          return powershellResult;
        }
      } catch (error) {
        logger.warn("[GameSecurityScanner] PowerShell Defender scan failed", {
          scanPath,
          error,
        });
      }

      const scanner = findWindowsDefenderScanner();

      if (!scanner) {
        return {
          status: "unavailable",
          scanner: null,
          scanPath,
          details: "Windows Defender scanner was not found",
          exitCode: null,
          findings: [],
        };
      }

      logger.info("[GameSecurityScanner] Scanning with Windows Defender", {
        scanPath,
        scanner,
      });

      return scanWithProcess(
        scanner,
        ["-Scan", "-ScanType", "3", "-File", scanPath],
        scanPath
      );
    }

    if (process.platform === "linux") {
      const scanner = findClamAVScanner();

      if (!scanner) {
        return {
          status: "unavailable",
          scanner: null,
          scanPath,
          details: "ClamAV scanner was not found",
          exitCode: null,
          findings: [],
        };
      }

      const quarantinePath = getQuarantinePath(scanPath);

      if (quarantinePath) {
        try {
          fs.mkdirSync(quarantinePath, { recursive: true });
        } catch (error) {
          logger.warn("[GameSecurityScanner] Failed to prepare quarantine path", {
            scanPath,
            quarantinePath,
            error,
          });
        }
      }

      logger.info("[GameSecurityScanner] Scanning with ClamAV", {
        scanPath,
        scanner,
        quarantinePath,
      });

      const args = ["--recursive", "--infected"];

      if (quarantinePath) {
        args.push(`--move=${quarantinePath}`);
      }

      args.push(scanPath);

      return scanWithProcess(scanner, args, scanPath);
    }

    return {
      status: "unavailable",
      scanner: null,
      scanPath,
      details: `Security scanning is not supported on ${process.platform}`,
      exitCode: null,
      findings: [],
    };
  },
};
