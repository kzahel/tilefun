let logPath: string | null = null;
let appendFileSync: ((path: string, data: string) => void) | null = null;

/** Initialize file logging. Call once at startup with the data directory (Node.js only). */
export async function initServerLog(dataDir: string): Promise<void> {
  const fs = await import("node:fs");
  const path = await import("node:path");
  fs.mkdirSync(dataDir, { recursive: true });
  logPath = path.join(dataDir, "server.log");
  appendFileSync = fs.appendFileSync;
}

function timestamp(): string {
  return new Date().toISOString();
}

/** Log an informational message to stderr and the log file. */
export function serverLog(msg: string): void {
  const line = `${timestamp()} [tilefun] ${msg}`;
  console.error(line);
  if (logPath && appendFileSync) {
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
  if (logPath && appendFileSync) {
    try {
      appendFileSync(logPath, `${line}\n`);
    } catch {
      // Can't write to log file — don't crash over it
    }
  }
}

/**
 * Install global handlers for uncaught exceptions and unhandled rejections.
 * Node.js only — no-ops in the browser.
 */
export function installCrashHandlers(): void {
  if (typeof process === "undefined") return;
  process.on("uncaughtException", (err) => {
    serverLogError("uncaughtException", err);
  });
  process.on("unhandledRejection", (reason) => {
    serverLogError("unhandledRejection", reason);
  });
}
