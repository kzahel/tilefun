import { existsSync, readFileSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname } from "node:path";
import { containedPath } from "../persistence/fsPaths.js";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

export function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  directory: string,
  basePath: string,
): boolean {
  const url = req.url ?? "/";
  if (!url.startsWith(basePath) || !existsSync(directory)) return false;
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end();
    return true;
  }
  try {
    const path = decodeURIComponent(url.slice(basePath.length).split("?")[0] ?? "");
    // Reject dot segments even when they would normalize back into the root.
    if (path.split("/").some((segment) => segment === ".." || segment === "."))
      throw new Error("Invalid asset path.");
    let file = containedPath(directory, path || "index.html");
    if (existsSync(file) && statSync(file).isDirectory())
      file = containedPath(directory, `${path.replace(/\/$/, "")}/index.html`);
    if (!existsSync(file) || !statSync(file).isFile())
      file = containedPath(directory, "index.html");
    if (!existsSync(file) || !statSync(file).isFile()) return false;
    const content = readFileSync(file);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extname(file)] ?? "application/octet-stream",
      "Content-Length": content.byteLength,
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch {
    res.writeHead(400);
    res.end("Invalid asset path");
  }
  return true;
}
