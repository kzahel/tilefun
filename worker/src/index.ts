interface Env {
  ROOMS: KVNamespace;
}

interface RoomData {
  name: string;
  playerCount: number;
  hostName: string;
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
      const peerId = decodeURIComponent(putMatch[1]);
      const body = (await request.json()) as RoomData;
      await env.ROOMS.put(peerId, JSON.stringify(body), { expirationTtl: 90 });
      return json({ ok: true });
    }

    // GET /rooms
    if (method === "GET" && url.pathname === "/rooms") {
      const list = await env.ROOMS.list();
      const rooms = await Promise.all(
        list.keys.map(async (key) => {
          const val = await env.ROOMS.get(key.name);
          if (!val) return null;
          const data = JSON.parse(val) as RoomData;
          return { peerId: key.name, ...data };
        }),
      );
      return json(rooms.filter(Boolean));
    }

    return json({ error: "Not found" }, 404);
  },
} satisfies ExportedHandler<Env>;
