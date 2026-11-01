import { randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";
import { relative, resolve } from "node:path";
import type { Plugin } from "vite";
import type { DevUpdate } from "../shared/devUpdates.js";

export const DEV_READY_MARKER = ".tilefun-dev-ready";

export function isPlayableChange(path: string): boolean {
  const file = path.replaceAll("\\", "/");
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(file)) return false;
  return (
    /^(src|public|demo)\//.test(file) ||
    /^[^/]+\.html$/.test(file) ||
    /^(vite\.config\.[^/]+|package(-lock)?\.json|tsconfig[^/]*\.json)$/.test(file)
  );
}

/** One process-local change signal, not a build/version store. */
export class DevUpdateTracker {
  current: DevUpdate = { revision: randomUUID(), state: "changed" };
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly notify: (update: DevUpdate) => void,
    private readonly settleMs = 5000,
  ) {}

  changed(): void {
    this.dispose();
    this.current = { revision: randomUUID(), state: "editing" };
    this.notify(this.current);
    this.timer = setTimeout(() => {
      this.current = { ...this.current, state: "changed" };
      this.notify(this.current);
    }, this.settleMs);
  }

  ready(): void {
    this.dispose();
    this.current = { revision: randomUUID(), state: "ready" };
    this.notify(this.current);
  }

  dispose(): void {
    clearTimeout(this.timer);
  }
}

/** Independent of Vite's HMR socket, including its automatic restart reload. */
export function devUpdatePlugin(): Plugin {
  return {
    name: "tilefun-dev-updates",
    apply: "serve",
    configureServer(server) {
      if (server.config.server.hmr !== false) return;
      const clients = new Set<ServerResponse>();
      const send = (res: ServerResponse, update: DevUpdate) =>
        res.write(`data: ${JSON.stringify(update)}\n\n`);
      const tracker = new DevUpdateTracker((update) => {
        for (const res of clients) send(res, update);
      });
      const marker = resolve(server.config.root, DEV_READY_MARKER);
      server.watcher.add(marker);
      const onFile = (event: string, file: string) => {
        if (!["add", "change", "unlink"].includes(event)) return;
        if (resolve(file) === marker) {
          if (event !== "unlink") tracker.ready();
        } else if (isPlayableChange(relative(server.config.root, file))) tracker.changed();
      };
      server.watcher.on("all", onFile);
      const heartbeat = setInterval(() => {
        for (const res of clients) res.write(": keepalive\n\n");
      }, 15000);
      heartbeat.unref();
      server.middlewares.use((req, res, next) => {
        const path = new URL(req.url ?? "/", "http://localhost").pathname;
        // Vite's base middleware may already have removed the deployment prefix.
        if (path !== "/__dev-updates" && path !== `${server.config.base}__dev-updates`)
          return next();
        if (req.method !== "GET") {
          res.writeHead(405, { Allow: "GET" });
          res.end();
          return;
        }
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        });
        res.write("retry: 1500\n\n");
        clients.add(res);
        send(res, tracker.current);
        res.on("close", () => clients.delete(res));
      });
      const dispose = () => {
        tracker.dispose();
        clearInterval(heartbeat);
        server.watcher.off("all", onFile);
        for (const res of clients) res.end();
        clients.clear();
      };
      server.httpServer?.once("close", dispose);
    },
  };
}
