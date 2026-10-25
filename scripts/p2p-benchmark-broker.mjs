// PeerServer has no public stop API for its housekeeping timers. Isolate it so
// closing a benchmark can reap those timers as well as every listening socket.
import { PeerServer } from "peer";

let server;
const sockets = new Set();
PeerServer({ host: "127.0.0.1", port: 0, path: "/peerjs" }, (http) => {
  server = http;
  http.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  process.send?.({ port: http.address().port });
});
function stop() {
  for (const socket of sockets) socket.destroy();
  server?.close(() => process.exit(0));
  // Also cover interrupted startup and WebSocket shutdown failure.
  setTimeout(() => process.exit(0), 1000).unref();
}
process.once("SIGTERM", stop);
process.once("SIGINT", stop);
process.once("disconnect", stop);
