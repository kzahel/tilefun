import { networkInterfaces } from "node:os";
import { join } from "node:path";
import type { Plugin } from "vite";
import { FsPersistenceStore } from "../persistence/FsPersistenceStore.js";
import { FsWorldRegistry } from "../persistence/FsWorldRegistry.js";
import { WebSocketServerTransport } from "../transport/WebSocketServerTransport.js";
import { GameServer } from "./GameServer.js";

function getLanAddress(): string | null {
  for (const ifaces of Object.values(networkInterfaces())) {
    if (!ifaces) continue;
    for (const iface of ifaces) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return null;
}

/**
 * Vite plugin that runs the game server on the same port as the dev server.
 * WebSocket connections share Vite's HTTP server — no second process needed.
 *
 * Client connects with ?multiplayer or ?server=localhost:5173.
 */
export function tilefunServer(dataDir = "./data"): Plugin {
  let server: GameServer | null = null;

  return {
    name: "tilefun-server",

    configureServer(viteServer) {
      // Vite calls this after the HTTP server is created but before listening.
      // httpServer is available after the server starts, so we use the hook.
      viteServer.httpServer?.on("listening", async () => {
        const httpServer = viteServer.httpServer;
        if (!httpServer) return;

        const transport = new WebSocketServerTransport({ server: httpServer, path: "/ws" });
        server = new GameServer(transport, {
          registry: new FsWorldRegistry(dataDir),
          createStore: (worldId) =>
            new FsPersistenceStore(join(dataDir, "worlds", worldId), ["chunks", "meta"]),
        });

        await server.init();
        server.startLoop();

        const addr = httpServer.address();
        const port = typeof addr === "object" && addr ? addr.port : 5173;
        const lanIp = getLanAddress();
        console.log("[tilefun] Game server running (attached to Vite dev server)");
        console.log(`[tilefun] Multiplayer URL: http://localhost:${port}/tilefun/?multiplayer`);
        if (lanIp) {
          console.log(
            `[tilefun] LAN Multiplayer:  http://${lanIp}:${port}/tilefun/?multiplayer`,
          );
        }
      });
    },

    closeBundle() {
      if (server) {
        server.destroy();
        server = null;
      }
    },
  };
}
