import type { IncomingMessage, ServerResponse } from "node:http";
import type { GameServer } from "./GameServer.js";
/** Read-only, bounded inspection. Uses live authority when the realm is active. */
export async function inspectionHttp(
  server: GameServer,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith("/api/world-")) return false;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "GET") throw new Error("Use GET for world inspection.");
    if (url.pathname === "/api/world-list") res.end(JSON.stringify(await server.listWorlds()));
    else if (url.pathname === "/api/world-preview") {
      const coordinates = JSON.parse(url.searchParams.get("chunks") ?? "[]");
      const bounds = JSON.parse(url.searchParams.get("bounds") ?? "null");
      if (!Array.isArray(coordinates) || !bounds || typeof bounds !== "object")
        throw new Error("Invalid inspection request.");
      res.end(
        JSON.stringify(
          await server.inspectWorld(url.searchParams.get("worldId") ?? "", coordinates, bounds),
        ),
      );
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "Unknown inspection endpoint." }));
    }
  } catch (error) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: String(error) }));
  }
  return true;
}
