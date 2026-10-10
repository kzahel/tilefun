import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import {
  FAULT_ID,
  type FaultReport,
  parseFaultReport,
  type StoredFaultReport,
} from "../diagnostics/FaultReport.js";
import { HttpError, jsonBody, jsonResponse, type WorkshopAuth } from "./workshopAuth.js";

/** Bounded public intake; diagnostics and deletion require the Workshop owner. */
export class FaultReportsService {
  private queue = Promise.resolve();
  private attempts = new Map<string, { count: number; until: number }>();
  constructor(
    private directory: string,
    private auth: WorkshopAuth,
  ) {}
  private async files() {
    try {
      return (await readdir(this.directory)).filter(
        (f) => f.endsWith(".json") && FAULT_ID.test(f.slice(0, -5)),
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  }
  private async read(id: string): Promise<StoredFaultReport | null> {
    try {
      return JSON.parse(await readFile(join(this.directory, `${id}.json`), "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
  private limit(req: IncomingMessage) {
    const now = Date.now();
    for (const [key, value] of this.attempts) if (value.until <= now) this.attempts.delete(key);
    for (const [key, max] of [
      ["global", 60],
      [req.socket.remoteAddress ?? "unknown", 10],
    ] as const) {
      const value = this.attempts.get(key) ?? { count: 0, until: now + 60_000 };
      if (value.count >= max) throw new HttpError(429, "Too many fault reports");
      value.count++;
      this.attempts.set(key, value);
    }
  }
  private mutate(fn: () => Promise<void>) {
    const operation = this.queue.then(fn);
    this.queue = operation.catch(() => {});
    return operation;
  }
  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? "/", "http://localhost"),
      base = "/tilefun/api/fault-reports";
    if (url.pathname !== base && !url.pathname.startsWith(`${base}/`)) return false;
    try {
      const id = url.pathname === base ? null : url.pathname.slice(base.length + 1);
      if (id !== null && !FAULT_ID.test(id)) throw new HttpError(404, "Report not found");
      if (req.method === "POST" && id === null) {
        if (!req.headers.origin) throw new HttpError(403, "Origin required");
        this.auth.sameOrigin(req);
        this.limit(req);
        const raw = await jsonBody(req, 32_000);
        let input: FaultReport;
        try {
          input = parseFaultReport(raw);
        } catch {
          throw new HttpError(400, "Invalid fault report");
        }
        await this.mutate(async () => {
          const old = await this.read(input.id);
          if (old) {
            if (JSON.stringify(parseFaultReport(old)) !== JSON.stringify(input))
              throw new HttpError(409, "Report ID already exists");
            return;
          }
          if ((await this.files()).length >= 500) throw new HttpError(413, "Fault inbox is full");
          await mkdir(this.directory, { recursive: true });
          const file = join(this.directory, `${input.id}.json`);
          await writeFile(
            `${file}.tmp`,
            JSON.stringify({ ...input, receivedAt: new Date().toISOString() }),
            { mode: 0o600 },
          );
          await rename(`${file}.tmp`, file);
        });
        jsonResponse(res, { saved: true, id: input.id });
      } else {
        await this.auth.require(req, req.method !== "GET");
        await this.queue;
        if (req.method === "GET" && id === null) {
          const records: StoredFaultReport[] = [];
          for (const file of await this.files()) {
            const r = await this.read(file.slice(0, -5));
            if (r) records.push(r);
          }
          records.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
          const offset = Math.max(0, Math.floor(Number(url.searchParams.get("offset")) || 0));
          jsonResponse(res, {
            total: records.length,
            reports: records
              .slice(offset, offset + 30)
              .map(({ stack: _, events: __, authority: ___, ...r }) => r),
          });
        } else if (req.method === "GET" && id) {
          const report = await this.read(id);
          if (!report) throw new HttpError(404, "Report not found");
          jsonResponse(res, report);
        } else if (req.method === "DELETE" && id) {
          await this.mutate(async () => {
            if (await this.read(id)) await unlink(join(this.directory, `${id}.json`));
          });
          jsonResponse(res, { deleted: true });
        } else throw new HttpError(405, "Method not allowed");
      }
    } catch (e) {
      if (e instanceof HttpError && e.status === 429) res.setHeader("Retry-After", "60");
      jsonResponse(
        res,
        { error: e instanceof HttpError ? e.message : "Fault report storage unavailable" },
        e instanceof HttpError ? e.status : 500,
      );
    }
    return true;
  }
}
