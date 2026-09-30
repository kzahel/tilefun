import { appendFile, mkdir, readFile, stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import type { Plugin } from "vite";
import type { ArtCatalog } from "../art/ArtCatalog.js";
import { type ArtNote, latestArtNotes, parseArtNote, sameArtTarget } from "../art/ArtNotes.js";

export class ArtNoteStore {
  private writes = Promise.resolve();
  readonly file: string;
  constructor(
    readonly directory = process.env.ART_NOTES_DIR ?? "data/art-notes",
    readonly catalogPath = "public/data/art-catalog.json",
  ) {
    this.file = join(directory, "notes.ndjson");
  }
  async catalog(): Promise<ArtCatalog> {
    return JSON.parse(await readFile(this.catalogPath, "utf8"));
  }
  async records(): Promise<ArtNote[]> {
    await this.writes;
    return this.read();
  }
  private async read(): Promise<ArtNote[]> {
    try {
      // Stored events were validated on append. Historical coordinates must survive atlas replacement.
      return (await readFile(this.file, "utf8"))
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as ArtNote);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
  async append(value: unknown): Promise<ArtNote> {
    const row = parseArtNote(value, await this.catalog());
    const operation = this.writes.then(async () => {
      const records = await this.read();
      const duplicate = records.find((r) => r.id === row.id);
      if (duplicate) {
        if (JSON.stringify(duplicate) !== JSON.stringify(row))
          throw new Error("Note event ID already exists");
        return;
      }
      const previous = records.find((r) => r.threadId === row.threadId);
      if (previous && !sameArtTarget(previous, row))
        throw new Error("A note's source selection cannot change");
      if (
        records.length >= 20_000 ||
        (await stat(this.file).catch(() => ({ size: 0 }))).size > 32_000_000
      )
        throw new Error("Art note inbox is full");
      await mkdir(this.directory, { recursive: true });
      await appendFile(this.file, `${JSON.stringify(row)}\n`, { mode: 0o600 });
    });
    this.writes = operation.catch(() => {});
    await operation;
    return row;
  }
}
export function artNotesHandler(store = new ArtNoteStore()) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (req.url?.split("?")[0] !== "/tilefun/api/art-notes") return false;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    try {
      if (req.method === "GET") {
        res.end(JSON.stringify(latestArtNotes(await store.records())));
      } else if (req.method === "POST") {
        if (!req.headers["content-type"]?.startsWith("application/json"))
          throw new Error("Expected JSON");
        if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
          res.statusCode = 403;
          res.end('{"error":"Origin does not match"}');
          return true;
        }
        let body = "";
        for await (const part of req) {
          body += part.toString();
          if (Buffer.byteLength(body) > 24_000) throw new Error("Note too large");
        }
        await store.append(JSON.parse(body));
        res.end('{"saved":true}');
      } else {
        res.statusCode = 405;
        res.end("{}");
      }
    } catch (error) {
      res.statusCode = 400;
      res.end(
        JSON.stringify({ error: error instanceof Error ? error.message : "Notes unavailable" }),
      );
    }
    return true;
  };
}
export function artNotesPlugin(): Plugin {
  const handle = artNotesHandler();
  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    void handle(req, res)
      .then((handled) => {
        if (!handled) next();
      })
      .catch(next);
  };
  return {
    name: "art-notes",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
