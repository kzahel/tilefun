export interface Env {
  ROOMS: KVNamespace;
}

interface RoomData {
  name: string;
  playerCount: number;
  hostName: string;
}

const MAX_BODY_BYTES = 4096;

function roomData(value: unknown): RoomData | null {
  if (!value || typeof value !== "object") return null;
  const { name, hostName, playerCount } = value as Partial<RoomData>;
  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 80 ||
    typeof hostName !== "string" ||
    !hostName.trim() ||
    hostName.length > 64 ||
    typeof playerCount !== "number" ||
    !Number.isInteger(playerCount) ||
    playerCount < 0 ||
    playerCount > 64
  )
    return null;
  return { name: name.trim(), hostName: hostName.trim(), playerCount };
}

async function readBody(request: Request): Promise<string | null> {
  if (Number(request.headers.get("Content-Length")) > MAX_BODY_BYTES) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // PUT /rooms/:peerId
    const putMatch = url.pathname.match(/^\/rooms\/([^/]+)$/);
    if (method === "PUT" && putMatch) {
      let peerId: string;
      try {
        peerId = decodeURIComponent(putMatch[1] ?? "");
      } catch {
        return json({ error: "Invalid peer ID" }, 400);
      }
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(peerId)) return json({ error: "Invalid peer ID" }, 400);
      if (
        request.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase() !==
        "application/json"
      )
        return json({ error: "Expected application/json" }, 415);
      const text = await readBody(request);
      if (text === null) return json({ error: "Room data too large" }, 413);
      let body: RoomData | null;
      try {
        body = roomData(JSON.parse(text));
      } catch {
        return json({ error: "Invalid JSON" }, 400);
      }
      if (!body) return json({ error: "Invalid room data" }, 400);
      await env.ROOMS.put(peerId, JSON.stringify(body), { expirationTtl: 90 });
      return json({ ok: true });
    }

    // GET /rooms
    if (method === "GET" && url.pathname === "/rooms") {
      const list = await env.ROOMS.list({ limit: 100 });
      const rooms = await Promise.all(
        list.keys.map(async (key) => {
          const val = await env.ROOMS.get(key.name);
          if (!val) return null;
          try {
            const data = roomData(JSON.parse(val));
            return data ? { peerId: key.name, ...data } : null;
          } catch {
            return null;
          }
        }),
      );
      return json(rooms.filter(Boolean));
    }

    return json({ error: "Not found" }, 404);
  },
} satisfies ExportedHandler<Env>;
