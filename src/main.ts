import { GameClient } from "./client/GameClient.js";
import { GameServer } from "./server/GameServer.js";
import { generateUUID } from "./shared/uuid.js";
import { SerializingTransport } from "./transport/SerializingTransport.js";
import { WebSocketClientTransport } from "./transport/WebSocketClientTransport.js";

const canvasEl = document.getElementById("game") as HTMLCanvasElement | null;
if (!canvasEl) throw new Error("Canvas element #game not found");
const canvas: HTMLCanvasElement = canvasEl;

// ?server=host:port      → connect to a specific standalone server
// ?multiplayer           → connect to game server on same host (Vite plugin uses /ws path)
// ?server=host:port/ws   → explicit path also works
// (neither)              → single-player, in-browser server
const params = new URLSearchParams(window.location.search);
const serverParam = params.get("server"); // e.g. "localhost:3001"
const multiplayer = params.has("multiplayer");

let client: GameClient;
let server: GameServer | null = null;

async function start() {
  if (serverParam || multiplayer) {
    // Multiplayer mode: connect via WebSocket.
    // ?multiplayer uses /ws path (Vite plugin shares HTTP server with HMR).
    // ?server=host:port connects to standalone server (no path needed).

    // Player identity: ?playerid= override, or persistent UUID from localStorage
    const STORAGE_KEY = "tilefun-player-id";
    const playerIdParam = params.get("playerid");
    let playerId: string;
    if (playerIdParam) {
      playerId = playerIdParam;
    } else {
      let stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        stored = generateUUID();
        localStorage.setItem(STORAGE_KEY, stored);
      }
      playerId = stored;
    }

    const baseWsUrl = serverParam ? `ws://${serverParam}` : `ws://${window.location.host}/ws`;
    const wsUrl = `${baseWsUrl}${baseWsUrl.includes("?") ? "&" : "?"}uuid=${encodeURIComponent(playerId)}`;
    console.log(`[tilefun] Connecting as ${playerId} to ${baseWsUrl}...`);
    const wsTransport = new WebSocketClientTransport(wsUrl);
    await wsTransport.ready();
    console.log("[tilefun] Connected to server");
    client = new GameClient(canvas, wsTransport, null, { mode: "serialized" });
    // biome-ignore lint/suspicious/noExplicitAny: debug/test hook
    (canvas as any).__game = client;
    await client.init();
  } else {
    // Single-player mode: local server + SerializingTransport
    const transport = new SerializingTransport();
    server = new GameServer(transport.serverSide);
    client = new GameClient(canvas, transport.clientSide, null, { mode: "serialized" });
    // biome-ignore lint/suspicious/noExplicitAny: debug/test hook
    (canvas as any).__game = client;
    await server.init();
    transport.triggerConnect();
    await client.init();
    server.startLoop();
  }
}

start().catch((err) => console.error("[tilefun] init failed:", err));

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    client?.destroy();
    server?.destroy();
  });
}
