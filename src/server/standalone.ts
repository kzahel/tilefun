import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FsPersistenceStore } from "../persistence/FsPersistenceStore.js";
import { FsWorldRegistry } from "../persistence/FsWorldRegistry.js";
import { WebSocketServerTransport } from "../transport/WebSocketServerTransport.js";
import { GameServer } from "./GameServer.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const DATA_DIR = process.env.DATA_DIR ?? "./data";

// Resolve dist/ directory (Vite build output) relative to project root
const thisFile = fileURLToPath(import.meta.url);
// standalone.ts is at src/server/standalone.ts → project root is ../../
const projectRoot = join(thisFile, "..", "..", "..");
const distDir = join(projectRoot, "dist");
const hasDistDir = existsSync(distDir);

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

// The Vite build uses base: "/tilefun/" so all assets are under that path.
const BASE_PATH = "/tilefun/";

const httpServer = createServer((req, res) => {
  const url = req.url ?? "/";

  // Redirect root to the base path
  if (url === "/" || url === "") {
    res.writeHead(302, { Location: BASE_PATH });
    res.end();
    return;
  }

  // Serve static files from dist/
  if (hasDistDir && url.startsWith(BASE_PATH)) {
    const relativePath = url.slice(BASE_PATH.length).split("?")[0] ?? "";
    const filePath = join(distDir, relativePath || "index.html");

    // If it's a directory or empty path, serve index.html
    let resolvedPath = filePath;
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      resolvedPath = join(filePath, "index.html");
    }

    if (existsSync(resolvedPath) && statSync(resolvedPath).isFile()) {
      const ext = extname(resolvedPath);
      const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
      const content = readFileSync(resolvedPath);
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
      return;
    }

    // SPA fallback: serve index.html for non-file routes
    const indexPath = join(distDir, "index.html");
    if (existsSync(indexPath)) {
      const content = readFileSync(indexPath);
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(content);
      return;
    }
  }

  res.writeHead(404);
  res.end("Not Found");
});

// Create WebSocket transport attached to HTTP server
const transport = new WebSocketServerTransport({ server: httpServer });

// Create game server with filesystem persistence
const server = new GameServer(transport, {
  registry: new FsWorldRegistry(DATA_DIR),
  createStore: (worldId) =>
    new FsPersistenceStore(join(DATA_DIR, "worlds", worldId), ["chunks", "meta"]),
});

await server.init();
server.startLoop();

httpServer.listen(PORT, () => {
  console.log(`[tilefun] Server listening on http://localhost:${PORT}`);
  if (hasDistDir) {
    console.log(`[tilefun] Serving client at http://localhost:${PORT}${BASE_PATH}`);
  } else {
    console.log("[tilefun] No dist/ found — run 'npm run build' to serve client files");
    console.log(
      `[tilefun] For dev, use 'npm run dev' + open http://localhost:5173/?server=localhost:${PORT}`,
    );
  }
});

// Graceful shutdown
function shutdown() {
  console.log("\n[tilefun] Shutting down...");
  server.destroy();
  httpServer.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
