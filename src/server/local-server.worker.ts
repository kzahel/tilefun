import { GameServer } from "./GameServer.js";
import { browserServerDependencies } from "./hosts/browser.js";
import { type LocalAuthorityPort, serveLocalAuthority } from "./LocalServerRuntime.js";

serveLocalAuthority(
  globalThis as unknown as LocalAuthorityPort,
  (transport) => new GameServer(transport, browserServerDependencies()),
);
