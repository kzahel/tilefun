import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { FsPersistenceStore } from "../persistence/FsPersistenceStore.js";
import { FsWorldRegistry } from "../persistence/FsWorldRegistry.js";
import { worldDirectory } from "../persistence/fsPaths.js";
import type { IServerTransport } from "../transport/Transport.js";
import { WebSocketServerTransport } from "../transport/WebSocketServerTransport.js";
import { GameServer } from "./GameServer.js";
import { inspectionHttp } from "./inspectionHttp.js";
import { initServerLog, installCrashHandlers, serverLog } from "./serverLog.js";
import { serveStatic } from "./staticFiles.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const DATA_DIR = process.env.DATA_DIR ?? "./data";
const NET_TRANSPORT = (process.env.NET_TRANSPORT ?? "ws").toLowerCase();
const RTC_SIGNAL_PATH = process.env.RTC_SIGNAL_PATH ?? "/rtc-signal";

// Resolve dist/ directory (Vite build output) relative to project root
const thisFile = fileURLToPath(import.meta.url);
// standalone.ts is at src/server/standalone.ts → project root is ../../
const projectRoot = join(thisFile, "..", "..", "..");
const distDir = join(projectRoot, "dist");
const hasDistDir = existsSync(distDir);

// The Vite build uses base: "/tilefun/" so all assets are under that path.
const BASE_PATH = "/tilefun/";

const httpServer = createServer(async (req, res) => {
  if (await inspectionHttp(server, req, res)) return;
  const url = req.url ?? "/";

  // Redirect root to the base path
  if (url === "/" || url === "") {
    res.writeHead(302, { Location: BASE_PATH });
    res.end();
    return;
  }

  if (serveStatic(req, res, distDir, BASE_PATH)) return;

  res.writeHead(404);
  res.end("Not Found");
});

await initServerLog(DATA_DIR);
installCrashHandlers();

const transport = await createTransport();

// Create game server with filesystem persistence
const server = new GameServer(transport, {
  registry: new FsWorldRegistry(DATA_DIR),
  createStore: (worldId) =>
    new FsPersistenceStore(worldDirectory(DATA_DIR, worldId), ["chunks", "meta", "players"]),
});

await server.init();
server.startLoop();

httpServer.listen(PORT, () => {
  serverLog(`Server listening on http://localhost:${PORT}`);
  serverLog(`Network transport: ${NET_TRANSPORT}`);
  if (hasDistDir) {
    serverLog(`Serving client at http://localhost:${PORT}${BASE_PATH}`);
  } else {
    serverLog("No dist/ found — run 'npm run build' to serve client files");
    serverLog(`For dev, use 'npm run dev' + open http://localhost:5173/?server=localhost:${PORT}`);
  }
  if (NET_TRANSPORT === "webrtc") {
    serverLog(
      `WebRTC connect URL: http://localhost:${PORT}${BASE_PATH}?server=localhost:${PORT}&transport=webrtc`,
    );
    serverLog(`WebRTC signaling path: ${RTC_SIGNAL_PATH}`);
  }
});

// Graceful shutdown
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  serverLog("Shutting down...");
  await server.flushAsync();
  server.destroy();
  httpServer.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function createTransport(): Promise<IServerTransport> {
  if (NET_TRANSPORT === "webrtc") {
    const { WebRtcServerTransport } = await import("../transport/WebRtcServerTransport.js");
    return await WebRtcServerTransport.create({
      server: httpServer,
      path: RTC_SIGNAL_PATH,
    });
  }
  return new WebSocketServerTransport({ server: httpServer });
}
