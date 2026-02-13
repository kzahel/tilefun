import { GameClient } from "./client/GameClient.js";
import { GameServer } from "./server/GameServer.js";
import { LocalTransport } from "./transport/LocalTransport.js";

const canvas = document.getElementById("game") as HTMLCanvasElement | null;
if (!canvas) throw new Error("Canvas element #game not found");

const transport = new LocalTransport();
const server = new GameServer(transport.serverSide);
const client = new GameClient(canvas, transport.clientSide, server);

// Expose for debug/testing
// biome-ignore lint/suspicious/noExplicitAny: debug/test hook
(canvas as any).__game = client;

async function start() {
  await server.init();
  transport.triggerConnect();
  await client.init();
}

start().catch((err) => console.error("[tilefun] init failed:", err));

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    client.destroy();
    server.destroy();
  });
}
