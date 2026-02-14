import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

let logPath: string | null = null;

/** Initialize file logging. Call once at startup with the data directory. */
export function initServerLog(dataDir: string): void {
  mkdirSync(dataDir, { recursive: true });
  logPath = join(dataDir, "server.log");
}

function timestamp(): string {
  return new Date().toISOString();
}

/** Log an informational message to stderr and the log file. */
export function serverLog(msg: string): void {
  const line = `${timestamp()} [tilefun] ${msg}`;
  console.error(line);
  if (logPath) {
    try {
      appendFileSync(logPath, `${line}\n`);
    } catch {
      // Can't write to log file — don't crash over it
    }
  }
}

/** Log an error (with stack trace) to stderr and the log file. */
export function serverLogError(label: string, err: unknown): void {
  const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
  const line = `${timestamp()} [tilefun] ${label}: ${msg}`;
  console.error(line);
  if (logPath) {
    try {
      appendFileSync(logPath, `${line}\n`);
    } catch {
      // Can't write to log file — don't crash over it
    }
  }
}

/**
 * Install global handlers for uncaught exceptions and unhandled rejections.
 * Logs the error to file, then re-throws / exits so the process still crashes
 * (we want to notice crashes, not silently swallow them).
 */
export function installCrashHandlers(): void {
  process.on("uncaughtException", (err) => {
    serverLogError("uncaughtException", err);
    // Let the process crash — the log file preserves the stack trace
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    serverLogError("unhandledRejection", reason);
    process.exit(1);
  });
}
