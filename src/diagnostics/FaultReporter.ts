import { generateUUID } from "../shared/uuid.js";
import { type FaultAuthority, type FaultReport, parseFaultReport } from "./FaultReport.js";

export const FAULT_OUTBOX_KEY = "tilefun.fault-outbox.v1";
/** Persist before attempting delivery. Fault reporting must never throw into gameplay. */
export class FaultReporter {
  private pending: FaultReport[] = [];
  private events: FaultReport["events"] = [];
  private seen = new Set<string>();
  private sending = false;
  private acknowledged = new Set<string>();
  private count = 0;
  constructor(
    private options: {
      storage: Pick<Storage, "getItem" | "setItem">;
      fetch: typeof fetch;
      context: () => FaultReport["context"];
      build: string;
      browser: string;
      authority?: () => FaultAuthority | null;
    },
  ) {
    this.pending = this.readStored();
  }
  private readStored(): FaultReport[] {
    const records: FaultReport[] = [];
    try {
      const raw = JSON.parse(this.options.storage.getItem(FAULT_OUTBOX_KEY) ?? "[]");
      if (Array.isArray(raw))
        for (const value of raw.slice(-8)) {
          try {
            records.push(parseFaultReport(value));
          } catch {
            /* Ignore one invalid record without losing the others. */
          }
        }
    } catch {
      /* Corrupt or inaccessible storage must not stop play or direct delivery. */
    }
    return records;
  }
  event(type: string) {
    this.events.push({ at: Date.now(), type: type.slice(0, 80) });
    if (this.events.length > 24) this.events.shift();
  }
  capture(kind: FaultReport["kind"], reason: unknown) {
    try {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      const key = `${kind}:${error.message.slice(0, 2000)}`;
      if (this.seen.has(key) || this.count >= 8) return;
      this.seen.add(key);
      this.count++;
      let context: FaultReport["context"] = {
        mode: "unknown",
        worldId: "",
        generation: "",
        x: 0,
        y: 0,
        serverTick: 0,
        hidden: false,
      };
      let authority: FaultAuthority | null = null;
      try {
        context = this.options.context();
      } catch {
        /* A partially initialized client still needs a report. */
      }
      try {
        authority = this.options.authority?.() ?? null;
      } catch {
        /* Retain the fatal error even if the authority snapshot fails. */
      }
      for (const field of ["x", "y", "serverTick"] as const)
        if (!Number.isFinite(context[field]) || Math.abs(context[field]) > 1e12)
          context = { ...context, [field]: 0 };
      const report = parseFaultReport({
        id: generateUUID(),
        capturedAt: new Date().toISOString(),
        kind,
        message: error.message.slice(0, 2000),
        stack: (error.stack ?? "").slice(0, 8000),
        build: this.options.build.slice(0, 100),
        browser: this.options.browser.slice(0, 500),
        context,
        events: [...this.events],
        authority,
      });
      // UTF-8, not character count, determines the server's request limit.
      if (new TextEncoder().encode(JSON.stringify(report)).length > 31_000) {
        report.stack = report.stack.slice(0, 2000);
        report.context.generation = "";
        report.authority = null;
      }
      this.pending.push(report);
      this.pending = this.pending.slice(-8);
      this.persist();
      void this.flush();
    } catch {
      /* Diagnostics cannot become another fatal error. */
    }
  }
  private persist() {
    try {
      // Merge other tabs' pending reports before writing this tab's changes.
      const disk = this.readStored();
      const merged = new Map(
        [...disk, ...this.pending]
          .filter((r) => !this.acknowledged.has(r.id))
          .map((r) => [r.id, r]),
      );
      this.pending = [...merged.values()].slice(-8);
      this.options.storage.setItem(FAULT_OUTBOX_KEY, JSON.stringify(this.pending));
    } catch {
      /* Keep the in-memory copy and still attempt upload. */
    }
  }
  async flush() {
    if (this.sending) return;
    this.sending = true;
    this.persist();
    try {
      for (const report of [...this.pending]) {
        const response = await this.options.fetch("/tilefun/api/fault-reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(report),
          credentials: "omit",
          keepalive: true,
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) break;
        const receipt = await response.json();
        if (receipt.saved !== true || receipt.id !== report.id) break;
        this.acknowledged.add(report.id);
        if (this.acknowledged.size > 128)
          this.acknowledged.delete(this.acknowledged.values().next().value ?? "");
        this.pending = this.pending.filter((r) => r.id !== report.id);
        this.persist();
      }
    } catch {
      /* Offline reports retry on startup, online, and the minute timer. */
    } finally {
      this.sending = false;
    }
  }
}
let active: FaultReporter | undefined;
export function setFaultReporter(reporter: FaultReporter) {
  active = reporter;
}
export function faultEvent(type: string) {
  active?.event(type);
}
export function reportFault(kind: FaultReport["kind"], error: unknown) {
  active?.capture(kind, error);
}
