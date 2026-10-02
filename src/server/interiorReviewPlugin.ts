import { appendFile, mkdir, readFile, stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import type { Plugin } from "vite";
import { parseReviewFeedback, type ReviewFeedback } from "../interiors/review/ReviewFeedback.js";
import { HttpError, jsonBody, jsonResponse, WorkshopAuth } from "./workshopAuth.js";

/** Same durable store for development, preview, standalone and Workshop adapters. */
export class InteriorReviewStore {
  private writes = Promise.resolve();
  readonly file: string;
  constructor(readonly directory = process.env.INTERIOR_REVIEW_DIR ?? "data/interior-review") {
    this.file = join(directory, "feedback.ndjson");
  }
  private async read(): Promise<ReviewFeedback[]> {
    try {
      return (await readFile(this.file, "utf8"))
        .split("\n")
        .filter(Boolean)
        .map((line) => parseReviewFeedback(JSON.parse(line)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
  async records() {
    await this.writes;
    return this.read();
  }
  async append(value: unknown) {
    const row = parseReviewFeedback(value);
    const operation = this.writes.then(async () => {
      const records = await this.read(),
        previous = records.find((r) => r.id === row.id);
      if (previous) {
        if (JSON.stringify(previous) !== JSON.stringify(row))
          throw new Error("Feedback event ID already exists");
        return;
      }
      if (
        records.length >= 5000 ||
        (await stat(this.file).catch(() => ({ size: 0 }))).size > 64_000_000
      )
        throw new Error("Review inbox is full");
      await mkdir(this.directory, { recursive: true });
      await appendFile(this.file, `${JSON.stringify(row)}\n`, { mode: 0o600 });
    });
    this.writes = operation.catch(() => {});
    await operation;
    return row;
  }
}
export function interiorReviewHandler(store = new InteriorReviewStore()) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (req.url?.split("?")[0] !== "/tilefun/api/interior-review") return false;
    try {
      if (req.method === "GET") {
        const latest = new Map<string, ReviewFeedback>();
        for (const row of await store.records()) latest.set(row.caseId, row);
        jsonResponse(
          res,
          [...latest.values()].map(({ screenshot: _screenshot, ...row }) => row),
        );
      } else if (req.method === "POST") {
        if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)
          throw new HttpError(403, "Origin does not match");
        await store.append(await jsonBody(req, 750_000));
        jsonResponse(res, { saved: true });
      } else throw new HttpError(405, "Use GET or POST");
    } catch (error) {
      jsonResponse(
        res,
        { error: error instanceof Error ? error.message : "Review unavailable" },
        error instanceof HttpError ? error.status : 400,
      );
    }
    return true;
  };
}
/** Legacy plugin remains protected even when used without the Workshop plugin. */
export function interiorReviewPlugin(
  directory = process.env.INTERIOR_REVIEW_DIR ?? "data/interior-review",
): Plugin {
  const handle = interiorReviewHandler(new InteriorReviewStore(directory)),
    auth = new WorkshopAuth();
  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.url?.split("?")[0] !== "/tilefun/api/interior-review") {
      next();
      return;
    }
    void auth
      .require(req, req.method !== "GET")
      .then(() => handle(req, res))
      .catch((error) =>
        jsonResponse(
          res,
          { error: error instanceof Error ? error.message : "Unauthorized" },
          error instanceof HttpError ? error.status : 500,
        ),
      );
  };
  return {
    name: "interior-review",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
