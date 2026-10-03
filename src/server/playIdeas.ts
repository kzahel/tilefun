import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import {
  IDEA_ID,
  IDEA_IMAGE_LIMIT,
  IDEA_TEXT_LIMIT,
  type PlayIdea,
  type PlayIdeaSubmission,
} from "../ideas/PlayIdea.js";
import { HttpError, jsonBody, jsonResponse, type WorkshopAuth } from "./workshopAuth.js";

export function parseIdea(raw: unknown): PlayIdeaSubmission {
  const v = raw as PlayIdeaSubmission;
  const bounded = (s: unknown, max: number): s is string =>
    typeof s === "string" && s.length <= max;
  if (
    !v ||
    typeof v !== "object" ||
    !bounded(v.id, 36) ||
    !IDEA_ID.test(v.id) ||
    !bounded(v.text, IDEA_TEXT_LIMIT) ||
    !v.text.trim() ||
    !bounded(v.language, 40) ||
    !/^[a-zA-Z]{2,8}(-[a-zA-Z0-9]{1,8})*$/.test(v.language) ||
    !bounded(v.screenshot, IDEA_IMAGE_LIMIT) ||
    !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(v.screenshot) ||
    !v.context ||
    !bounded(v.context.worldId, 100) ||
    !bounded(v.context.generation, 2000) ||
    !bounded(v.context.build, 100) ||
    !bounded(v.context.capturedAt, 40) ||
    !Number.isFinite(Date.parse(v.context.capturedAt)) ||
    !Number.isFinite(v.context.x) ||
    !Number.isFinite(v.context.y) ||
    Math.abs(v.context.x) > 1e12 ||
    Math.abs(v.context.y) > 1e12
  )
    throw new HttpError(400, "Invalid play idea");
  const png = Buffer.from(v.screenshot.slice(22), "base64");
  if (
    png.length < 45 ||
    png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
    png.toString("ascii", 12, 16) !== "IHDR" ||
    png.readUInt32BE(16) < 1 ||
    png.readUInt32BE(16) > 640 ||
    png.readUInt32BE(20) < 1 ||
    png.readUInt32BE(20) > 640 ||
    png.toString("hex", png.length - 12) !== "0000000049454e44ae426082"
  )
    throw new HttpError(400, "Expected a game PNG up to 640 pixels");
  // Whitelist every persisted field, including nested context. Never persist raw audio/extra keys.
  return {
    id: v.id,
    text: v.text.trim(),
    language: v.language,
    screenshot: v.screenshot,
    context: {
      worldId: v.context.worldId,
      generation: v.context.generation,
      x: v.context.x,
      y: v.context.y,
      build: v.context.build,
      capturedAt: v.context.capturedAt,
    },
  };
}

/** Shared by dev, preview and standalone. Files remain within protected WORKSHOP_DATA_DIR. */
export class PlayIdeasService {
  private queue = Promise.resolve();
  private attempts = new Map<string, { count: number; until: number }>();
  constructor(
    private directory: string,
    private auth: WorkshopAuth,
  ) {}
  private async files() {
    try {
      return (await readdir(this.directory)).filter(
        (f) => IDEA_ID.test(f.slice(0, -5)) && f.endsWith(".json"),
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  }
  private async read(id: string): Promise<PlayIdea | null> {
    try {
      return JSON.parse(await readFile(join(this.directory, `${id}.json`), "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
  private async save(idea: PlayIdea) {
    await mkdir(this.directory, { recursive: true });
    const file = join(this.directory, `${idea.id}.json`);
    await writeFile(`${file}.tmp`, JSON.stringify(idea), { mode: 0o600 });
    await rename(`${file}.tmp`, file);
  }
  private limit(req: IncomingMessage) {
    const now = Date.now();
    for (const [key, value] of this.attempts) if (value.until <= now) this.attempts.delete(key);
    // Socket addresses only; arbitrary forwarded headers must not evade limits.
    for (const [key, max] of [
      ["global", 60],
      [req.socket.remoteAddress ?? "unknown", 10],
    ] as const) {
      const value = this.attempts.get(key) ?? { count: 0, until: now + 60_000 };
      if (value.count >= max)
        throw new HttpError(429, "Too many ideas at once. Try again in a minute.");
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
    const url = new URL(req.url ?? "/", "http://localhost");
    const base = "/tilefun/api/play-ideas";
    if (url.pathname !== base && !url.pathname.startsWith(`${base}/`)) return false;
    try {
      const id = url.pathname === base ? null : url.pathname.slice(base.length + 1);
      if (id !== null && !IDEA_ID.test(id)) throw new HttpError(404, "Idea not found");
      if (req.method === "POST" && id === null) {
        if (!req.headers.origin) throw new HttpError(403, "Origin required");
        this.auth.sameOrigin(req);
        this.limit(req);
        const input = parseIdea(await jsonBody(req, 520_000));
        await this.mutate(async () => {
          const old = await this.read(input.id);
          if (old) {
            if (JSON.stringify(parseIdea(old)) !== JSON.stringify(input))
              throw new HttpError(409, "Idea ID already exists");
            return;
          }
          if ((await this.files()).length >= 500)
            throw new HttpError(413, "Idea inbox is full. Please try later.");
          await this.save({ ...input, createdAt: new Date().toISOString(), status: "new" });
        });
        jsonResponse(res, { saved: true, id: input.id });
      } else {
        await this.auth.require(req, req.method !== "GET");
        await this.queue;
        if (req.method === "GET" && id === null) {
          const offset = Math.max(0, Math.floor(Number(url.searchParams.get("offset")) || 0));
          const records: Omit<PlayIdea, "screenshot">[] = [];
          // Read sequentially and discard image strings immediately: a full inbox
          // must not allocate all 500 screenshots for a metadata list request.
          for (const file of await this.files()) {
            const value = await this.read(file.slice(0, -5));
            if (value) {
              const { screenshot: _, ...metadata } = value;
              records.push(metadata);
            }
          }
          records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          // List responses exclude image payloads; detail loads them on demand.
          jsonResponse(res, {
            total: records.length,
            ideas: records.slice(offset, offset + 30),
          });
        } else if (req.method === "GET" && id) {
          const idea = await this.read(id);
          if (!idea) throw new HttpError(404, "Idea not found");
          jsonResponse(res, idea);
        } else if (req.method === "PATCH" && id) {
          const body = (await jsonBody(req, 1000)) as { status?: unknown };
          const status = body?.status;
          if (status !== "new" && status !== "planned" && status !== "done")
            throw new HttpError(400, "Invalid status");
          await this.mutate(async () => {
            const idea = await this.read(id);
            if (!idea) throw new HttpError(404, "Idea not found");
            await this.save({ ...idea, status });
          });
          jsonResponse(res, { saved: true });
        } else if (req.method === "DELETE" && id) {
          await this.mutate(async () => {
            if (await this.read(id)) await unlink(join(this.directory, `${id}.json`));
          });
          jsonResponse(res, { deleted: true });
        } else throw new HttpError(405, "Method not allowed");
      }
    } catch (error) {
      if (error instanceof HttpError && error.status === 429) res.setHeader("Retry-After", "60");
      jsonResponse(
        res,
        {
          error:
            error instanceof HttpError
              ? error.message
              : "Could not save or load ideas. Please try again.",
        },
        error instanceof HttpError ? error.status : 500,
      );
    }
    return true;
  }
}
