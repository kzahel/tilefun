import { appendFile, mkdir, readFile, stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import type { Plugin } from "vite";
import { parseReviewFeedback, type ReviewFeedback } from "../interiors/review/ReviewFeedback.js";

/** Local development/preview feedback inbox; no game state or user files are writable. */
export function interiorReviewPlugin(
  directory = process.env.INTERIOR_REVIEW_DIR ?? "data/interior-review",
): Plugin {
  const file = join(directory, "feedback.ndjson");
  let writes = Promise.resolve();
  async function records(): Promise<ReviewFeedback[]> {
    try {
      return (await readFile(file, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => parseReviewFeedback(JSON.parse(line)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    try {
      if (req.method === "GET") {
        await writes;
        const latest = new Map<string, ReviewFeedback>();
        for (const row of await records()) latest.set(row.caseId, row);
        res.end(
          JSON.stringify([...latest.values()].map(({ screenshot: _screenshot, ...row }) => row)),
        );
        return;
      }
      if (req.method !== "POST") {
        res.statusCode = 405;
        res.end("{}");
        return;
      }
      if (!req.headers["content-type"]?.startsWith("application/json"))
        throw new Error("Expected JSON");
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
        res.statusCode = 403;
        res.end("{}");
        return;
      }
      let body = "";
      for await (const chunk of req) {
        body += chunk.toString();
        if (body.length > 750_000) throw new Error("Feedback too large");
      }
      const row = parseReviewFeedback(JSON.parse(body));
      const operation = writes.then(async () => {
        await mkdir(directory, { recursive: true });
        const existing = await records();
        if (existing.some((r) => r.id === row.id)) return;
        if (
          existing.length >= 5000 ||
          (await stat(file).catch(() => ({ size: 0 }))).size > 64_000_000
        )
          throw new Error("Review inbox is full");
        await appendFile(file, `${JSON.stringify(row)}\n`, { mode: 0o600 });
      });
      writes = operation.catch(() => {});
      await operation;
      res.end('{"saved":true}');
    } catch (error) {
      res.statusCode = 400;
      res.end(
        JSON.stringify({ error: error instanceof Error ? error.message : "Feedback unavailable" }),
      );
    }
  }
  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    if (req.url?.split("?")[0] !== "/tilefun/api/interior-review") {
      next();
      return;
    }
    void handle(req, res);
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
