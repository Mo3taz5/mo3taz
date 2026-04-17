/**
 * ============================================================
 * Supervisor — Process Launcher & Exit Watcher
 * ============================================================
 *
 * Runs exclusively in the Electron Main Process.
 * Spawns executables, tracks their PIDs, and reliably detects
 * termination using a DUAL-DETECTION mechanism.
 */

import { spawn, ChildProcess } from "node:child_process";
import { platform } from "node:os";
import { BrowserWindow } from "electron";

// ---- Strict Type Definitions ----

interface SupervisedProcess {
  child: ChildProcess | null;
  pid: number;
  pollTimer: ReturnType<typeof setInterval> | null;
  launchedAt: number;
}

type ExitCallback = (pid: number) => void;

export interface ISupervisor {
  launch(executablePath: string, args?: string[]): Promise<number>;
  onExit(callback: ExitCallback): () => void;
  stopWatching(pid: number): void;
  kill(pid: number): void;
  isWatching(pid: number): boolean;
  shutdown(): void;
}

const POLL_INTERVAL_MS = 2000;
const IPC_CHANNEL = "PROCESS_EXITED";

// ---- Platform-Specific Process Detection ----

/**
 * Checks if a process is still alive.
 *
 * Windows: `tasklist /FI "PID eq X" /NH /FO CSV`
 *   - Returns exit code 0 if found, 1 if not
 *   - Output is non-empty when the process exists
 *
 * POSIX: `process.kill(pid, 0)`
 *   - Sends signal 0 (no actual signal)
 *   - Throws if the process is dead or inaccessible
 */
async function isProcessAlive(pid: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (platform() === "win32") {
      const proc = spawn("tasklist", [
        "/FI",
        `PID eq ${pid}`,
        "/NH",
        "/FO",
        "CSV",
      ]);
      let stdout = "";
      proc.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
      proc.on("close", (code: number | null) => {
        // Exit code 0 + non-empty output = process found
        resolve(code === 0 && stdout.trim().length > 0);
      });
      proc.on("error", () => resolve(false));
    } else {
      try {
        process.kill(pid, 0);
        resolve(true);
      } catch {
        resolve(false);
      }
    }
  });
}

// ---- Factory Implementation ----

export function createSupervisor(): ISupervisor {
  const watchers = new Map<number, SupervisedProcess>();
  const exitListeners = new Set<ExitCallback>();

  /**
   * Internal helper: remove a PID from supervision and clean up timers.
   * Does NOT kill the process.
   */
  function stopWatchingInternal(pid: number): void {
    const entry = watchers.get(pid);
    if (entry?.pollTimer) {
      clearInterval(entry.pollTimer);
      entry.pollTimer = null;
    }
    watchers.delete(pid);
  }

  /**
   * Internal helper: notify all subscribers that a process exited.
   * Also sends the IPC event to all renderer windows.
   */
  function notifyExit(pid: number): void {
    stopWatchingInternal(pid);

    // Notify in-process listeners
    for (const cb of exitListeners) cb(pid);

    // Broadcast to ALL renderer windows via IPC
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC_CHANNEL, { pid });
    }
  }

  return {
    /**
     * Launch an executable and begin supervising it.
     *
     * @param executablePath - Absolute path to the binary
     * @param args - Command-line arguments (optional)
     * @returns Promise resolving to the process PID
     */
    async launch(
      executablePath: string,
      args: string[] = []
    ): Promise<number> {
      let child: ChildProcess;
      try {
        child = spawn(executablePath, args, {
          detached: platform() !== "win32",
          stdio: "ignore",
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Spawn failed for "${executablePath}": ${msg}`);
      }

      const pid = child.pid;
      if (!pid) {
        throw new Error("Spawn succeeded but PID is undefined");
      }

      const entry: SupervisedProcess = {
        child,
        pid,
        pollTimer: null,
        launchedAt: Date.now(),
      };
      watchers.set(pid, entry);

      /**
       * DUAL-DETECTION MECHANISM:
       *
       * A) IMMEDIATE EVENT LISTENER:
       *    Catches the exact moment the direct child process exits.
       *    Fast, efficient, zero overhead. Fires instantly.
       *
       * B) POLLING FALLBACK (2-second interval):
       *    Some games launch "launcher" wrappers that immediately
       *    exit while the actual game runs as a grandchild process.
       *    The initial child exits, but the game continues.
       *    The polling loop catches these scenarios by checking the
       *    OS process table every 2 seconds via tasklist (Win) or
       *    process.kill(pid, 0) (POSIX).
       */

      // --- Detection A: Immediate ---
      child.on("exit", () => notifyExit(pid));

      // --- Detection B: Polling fallback ---
      entry.pollTimer = setInterval(async () => {
        const alive = await isProcessAlive(pid);
        if (!alive) notifyExit(pid);
      }, POLL_INTERVAL_MS);

      return pid;
    },

    onExit(callback: ExitCallback): () => void {
      exitListeners.add(callback);
      return () => exitListeners.delete(callback);
    },

    stopWatching(pid: number): void {
      stopWatchingInternal(pid);
    },

    kill(pid: number): void {
      try {
        if (platform() === "win32") {
          // Force-kill process tree on Windows
          spawn("taskkill", ["/pid", String(pid), "/f", "/t"], {
            stdio: "ignore",
          });
        } else {
          // Kill process group on POSIX
          try {
            process.kill(-pid, "SIGTERM");
          } catch {
            process.kill(pid, "SIGTERM");
          }
        }
      } catch {
        /* Process already dead — silently ignore */
      }
      stopWatchingInternal(pid);
    },

    isWatching(pid: number): boolean {
      return watchers.has(pid);
    },

    shutdown(): void {
      for (const [pid] of watchers) stopWatchingInternal(pid);
      exitListeners.clear();
    },
  };
}

// ---- Singleton ----

let _supervisor: ISupervisor | null = null;

export function getSupervisor(): ISupervisor {
  if (!_supervisor) _supervisor = createSupervisor();
  return _supervisor;
}
