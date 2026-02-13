import { GameClient } from "./client/GameClient.js";
import { GameServer } from "./server/GameServer.js";
import { LocalTransport } from "./transport/LocalTransport.js";
import { SerializingTransport } from "./transport/SerializingTransport.js";

const USE_SERIALIZED = true;

const canvas = document.getElementById("game") as HTMLCanvasElement | null;
if (!canvas) throw new Error("Canvas element #game not found");

const transport = USE_SERIALIZED ? new SerializingTransport() : new LocalTransport();
const server = new GameServer(transport.serverSide);
const client = new GameClient(canvas, transport.clientSide, USE_SERIALIZED ? null : server, {
  mode: USE_SERIALIZED ? "serialized" : "local",
});

// Expose for debug/testing
// biome-ignore lint/suspicious/noExplicitAny: debug/test hook
(canvas as any).__game = client;

async function start() {
  await server.init();
  transport.triggerConnect();
  await client.init();
  if (USE_SERIALIZED) server.startLoop();
}

start().catch((err) => console.error("[tilefun] init failed:", err));

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    client.destroy();
    server.destroy();
  });
}
