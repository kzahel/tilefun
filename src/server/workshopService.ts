import { appendFile, mkdir, readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import type { Plugin } from "vite";
import { type ArtNote, latestArtNotes, parseArtNote } from "../art/ArtNotes.js";
import type { ReviewFeedback } from "../interiors/review/ReviewFeedback.js";
import { parseReviewFeedback } from "../interiors/review/ReviewFeedback.js";
import {
  artThread,
  candidateSummary,
  interiorThread,
  pendingRequests,
  projectActivity,
} from "../workshop/WorkshopProjection.js";
import type {
  WorkshopActivity,
  WorkshopEvent,
  WorkshopInbox,
  WorkshopThread,
} from "../workshop/WorkshopTypes.js";
import { ArtNoteStore, artNotesHandler } from "./artNotesHttp.js";
import { InteriorReviewStore, interiorReviewHandler } from "./interiorReviewPlugin.js";
import { HttpError, jsonBody, jsonResponse, WorkshopAuth } from "./workshopAuth.js";
import { loadWorkshopManifest, workshopInputDigest } from "./workshopManifest.js";

interface Command {
  event: WorkshopEvent;
  createdAt: string;
  author: string;
  art?: ArtNote;
  interior?: ReviewFeedback;
  targetId?: string;
}
export class WorkshopService {
  private queue = Promise.resolve();
  private applied = new Set<string>();
  private manifestCache: ReturnType<typeof this.readManifest> | undefined;
  readonly auth: WorkshopAuth;
  readonly art: ArtNoteStore;
  readonly interiors: InteriorReviewStore;
  constructor(
    readonly options: {
      directory?: string;
      manifestPath?: string;
      root?: string;
      auth?: WorkshopAuth;
      art?: ArtNoteStore;
      interiors?: InteriorReviewStore;
    } = {},
  ) {
    this.auth = options.auth ?? new WorkshopAuth();
    this.art = options.art ?? new ArtNoteStore();
    this.interiors = options.interiors ?? new InteriorReviewStore();
  }
  private get directory() {
    return this.options.directory ?? process.env.WORKSHOP_DATA_DIR ?? "data/workshop";
  }
  invalidateManifest() {
    this.manifestCache = undefined;
  }
  private async readManifest() {
    const manifest = await loadWorkshopManifest(this.options.manifestPath);
    return {
      manifest,
      current: manifest.inputDigest === (await workshopInputDigest(this.options.root)),
    };
  }
  private manifest() {
    this.manifestCache ??= this.readManifest().catch((error) => {
      this.manifestCache = undefined;
      throw error;
    });
    return this.manifestCache;
  }
  private async commands(): Promise<Command[]> {
    try {
      return (await readFile(join(this.directory, "events.ndjson"), "utf8"))
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Command);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
  private async apply(c: Command) {
    if (this.applied.has(c.event.id)) return;
    if (c.art) await this.art.append(c.art);
    if (c.interior) await this.interiors.append(c.interior);
    this.applied.add(c.event.id);
  }
  private async settledCommands() {
    await this.queue;
    const commands = await this.commands();
    for (const c of commands) await this.apply(c);
    return commands;
  }
  private async submit(raw: unknown, owner: string) {
    const e = raw as WorkshopEvent;
    if (
      !e ||
      typeof e !== "object" ||
      typeof e.id !== "string" ||
      !/^[a-zA-Z0-9-]{1,100}$/.test(e.id) ||
      !["source", "review", "reply"].includes(e.type)
    )
      throw new HttpError(400, "Invalid Workshop event");
    const operation = this.queue.then(async () => {
      const commands = await this.commands();
      for (const command of commands) await this.apply(command);
      const existing = commands.find((c) => c.event.id === e.id);
      if (existing) {
        if (JSON.stringify(existing.event) !== JSON.stringify(e))
          throw new HttpError(409, "Event ID already exists");
        await this.apply(existing);
        return;
      }
      if (commands.length >= 20_000) throw new HttpError(413, "Workshop event log is full");
      const createdAt = new Date().toISOString(),
        command: Command = { event: e, createdAt, author: owner };
      const [art, interiors] = await Promise.all([this.art.records(), this.interiors.records()]);
      if (e.type === "source") {
        const catalog = await this.art.catalog(),
          sheet = catalog.sheets.find((s) => s.id === e.sheetId);
        if (!sheet || sheet.fingerprint !== e.fingerprint)
          throw new HttpError(409, "Source changed. Reload before annotating.");
        if (typeof e.note !== "string" || !e.note.trim())
          throw new HttpError(400, "Write a note first");
        command.art = parseArtNote(
          {
            id: e.id,
            threadId: e.id,
            sheetId: e.sheetId,
            fingerprint: e.fingerprint,
            sheetSize: [sheet.width, sheet.height],
            rect: e.rect,
            sliceKeys: e.sliceKeys,
            intent: e.intent,
            status: "pending",
            note: e.note.trim(),
            reply: "",
            createdAt,
          },
          catalog,
        );
      } else if (e.type === "review") {
        const { manifest, current } = await this.manifest(),
          candidate = manifest.candidates.find((c) => c.id === e.candidateId);
        if (!current || !candidate || candidate.excluded || candidate.fingerprint !== e.fingerprint)
          throw new HttpError(409, "Candidate changed. Reload the current review.");
        if (
          !["approved", "changes", "clear"].includes(e.verdict) ||
          typeof e.note !== "string" ||
          (e.verdict === "changes" && !e.note.trim())
        )
          throw new HttpError(400, "A reason is required for Needs changes");
        if (candidate.art)
          command.art = parseArtNote(
            {
              ...candidate.art,
              id: e.id,
              threadId: e.id,
              createdAt,
              status: e.verdict === "changes" ? "pending" : "resolved",
              note:
                e.note.trim() ||
                (e.verdict === "clear" ? "Reopened for review." : "Approved this candidate."),
              reply: "",
              buildingVerdict: { value: e.verdict, createdAt },
            },
            await this.art.catalog(),
          );
        else if (candidate.interior)
          command.interior = parseReviewFeedback({
            ...candidate.interior,
            id: e.id,
            createdAt,
            verdict:
              e.verdict === "approved" ? "good" : e.verdict === "changes" ? "wrong" : "clear",
            note: e.note.trim(),
            ...(e.pins ? { pins: e.pins } : {}),
          });
        else throw new HttpError(400, "Review movement in the playable tool");
      } else {
        if (
          typeof e.threadId !== "string" ||
          typeof e.reply !== "string" ||
          e.reply.length > 3500 ||
          !["pending", "in-progress", "resolved"].includes(e.status)
        )
          throw new HttpError(400, "Invalid reply");
        if (e.threadId.startsWith("art:")) {
          const row = latestArtNotes(art).find((r) => r.threadId === e.threadId.slice(4));
          if (!row) throw new HttpError(404, "Unknown thread");
          command.art = parseArtNote(
            { ...row, id: e.id, createdAt, reply: e.reply, status: e.status },
            await this.art.catalog(),
          );
          command.targetId = row.id;
        } else if (e.threadId.startsWith("interior:")) {
          const row = interiors.filter((r) => r.caseId === e.threadId.slice(9)).at(-1);
          if (!row) throw new HttpError(404, "Unknown thread");
          command.targetId = row.id;
        } else throw new HttpError(404, "Unknown thread");
      }
      // Command first, derived compatibility event second. A restart/retry replays
      // the exact timestamp and payload, so partial writes cannot duplicate votes.
      await mkdir(this.directory, { recursive: true });
      await appendFile(join(this.directory, "events.ndjson"), `${JSON.stringify(command)}\n`, {
        mode: 0o600,
      });
      await this.apply(command);
    });
    this.queue = operation.catch(() => {});
    await operation;
  }
  private applyReplies(thread: WorkshopThread, commands: Command[], targetId?: string) {
    const latest = commands
      .filter(
        (c) =>
          c.event.type === "reply" &&
          c.event.threadId === thread.id &&
          (!targetId || c.targetId === targetId),
      )
      .at(-1);
    return latest?.event.type === "reply"
      ? { ...thread, reply: latest.event.reply, status: latest.event.status }
      : thread;
  }
  /** Trusted local read for the agent CLI; HTTP callers authenticate in handle. */
  async inbox(): Promise<WorkshopInbox> {
    const commands = await this.settledCommands();
    const [{ manifest, current }, art, interiors] = await Promise.all([
      this.manifest(),
      this.art.records(),
      this.interiors.records(),
    ]);
    const requests = pendingRequests(art, interiors)
      .map((thread) =>
        this.applyReplies(
          thread,
          commands,
          thread.kind === "interior"
            ? interiors.filter((r) => r.caseId === thread.caseId).at(-1)?.id
            : undefined,
        ),
      )
      .filter((t) => t.status !== "resolved");
    return {
      manifestCurrent: current,
      candidates: manifest.candidates.map((c) => candidateSummary(c, art, interiors, current)),
      requests,
    };
  }
  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    if (await this.auth.handle(req, res)) return true;
    const url = new URL(req.url ?? "/", "http://localhost"),
      legacy = ["/tilefun/api/art-notes", "/tilefun/api/interior-review"].includes(url.pathname);
    if (!legacy && !url.pathname.startsWith("/tilefun/api/workshop/")) return false;
    try {
      const session = await this.auth.require(req, req.method !== "GET");
      if (legacy) {
        await this.settledCommands();
        return url.pathname.endsWith("art-notes")
          ? artNotesHandler(this.art)(req, res)
          : interiorReviewHandler(this.interiors)(req, res);
      }
      if (url.pathname === "/tilefun/api/workshop/events") {
        if (req.method !== "POST") throw new HttpError(405, "Use POST");
        await this.submit(await jsonBody(req, 24_000), session.owner ?? "owner");
        jsonResponse(res, { saved: true });
        return true;
      }
      if (req.method !== "GET") throw new HttpError(405, "Use GET");
      const commands = await this.settledCommands();
      if (url.pathname === "/tilefun/api/workshop/manifest") {
        const { manifest, current } = await this.manifest();
        jsonResponse(res, { ...manifest, current });
        return true;
      }
      const [art, interiors] = await Promise.all([this.art.records(), this.interiors.records()]);
      if (url.pathname === "/tilefun/api/workshop/inbox") {
        jsonResponse(res, await this.inbox());
      } else if (url.pathname === "/tilefun/api/workshop/activity") {
        const discussion: WorkshopActivity[] = commands
          .filter((c) => c.event.type === "reply" && c.event.threadId.startsWith("interior:"))
          .flatMap((c) => {
            if (c.event.type !== "reply") return [];
            const target = interiors.find((r) => r.id === c.targetId);
            return target
              ? [
                  {
                    ...interiorThread(target),
                    eventId: c.event.id,
                    note: "",
                    reply: c.event.reply,
                    status: c.event.status,
                    createdAt: c.createdAt,
                  },
                ]
              : [];
          });
        const rows = [...projectActivity(art, interiors), ...discussion].sort(
          (a, b) => b.createdAt.localeCompare(a.createdAt) || b.eventId.localeCompare(a.eventId),
        );
        const offset = Math.min(
            rows.length,
            Math.max(0, Number(url.searchParams.get("offset")) || 0),
          ),
          limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
        jsonResponse(res, {
          events: rows.slice(offset, offset + limit),
          total: rows.length,
          next: offset + limit < rows.length ? offset + limit : null,
        });
      } else if (url.pathname.startsWith("/tilefun/api/workshop/threads/")) {
        const id = decodeURIComponent(url.pathname.slice("/tilefun/api/workshop/threads/".length));
        if (!/^(art|interior):[a-zA-Z0-9-]{1,100}$/.test(id))
          throw new HttpError(400, "Invalid thread ID");
        const history = id.startsWith("art:")
          ? art.filter((r) => r.threadId === id.slice(4))
          : interiors.filter((r) => r.caseId === id.slice(9));
        const row = history.at(-1);
        if (!row) throw new HttpError(404, "Unknown thread");
        const thread = "threadId" in row ? artThread(row) : interiorThread(row);
        jsonResponse(res, {
          thread: this.applyReplies(thread, commands, "threadId" in row ? undefined : row.id),
          history,
          discussion: commands
            .filter((c) => c.event.type === "reply" && c.event.threadId === id)
            .map((c) => ({
              id: c.event.id,
              author: c.author,
              createdAt: c.createdAt,
              ...(c.event.type === "reply" ? { reply: c.event.reply, status: c.event.status } : {}),
            })),
        });
      } else throw new HttpError(404, "Unknown Workshop endpoint");
    } catch (error) {
      jsonResponse(
        res,
        { error: error instanceof Error ? error.message : "Workshop unavailable" },
        error instanceof HttpError ? error.status : 400,
      );
    }
    return true;
  }
}
export function workshopPlugin(): Plugin {
  const service = new WorkshopService();
  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    void service
      .handle(req, res)
      .then((handled) => {
        if (!handled) next();
      })
      .catch(next);
  };
  return {
    name: "tilefun-workshop",
    configureServer(server) {
      server.middlewares.use(middleware);
      server.watcher.on("all", (_event, path) => {
        if (
          path.replaceAll("\\", "/").includes("/src/") ||
          path.replaceAll("\\", "/").includes("/public/")
        )
          service.invalidateManifest();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
