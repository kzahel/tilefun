import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname } from "node:path";
import type { Plugin } from "vite";
import { containedPath } from "../persistence/fsPaths.js";
import { STARTUP_ASSET_MANIFEST, STARTUP_ASSET_VERSION } from "../shared/startupAssetCache.js";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".webp": "image/webp",
  ".json": "application/json",
  ".ogg": "audio/ogg",
};
const IMMUTABLE = "public, max-age=31536000, immutable";
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

interface Version {
  readonly identity: string;
  readonly hash: string;
  readonly bytes: Buffer;
}

/** Keep current bytes in memory so we serve exactly what each hash describes. */
class StartupAssetVersions {
  private readonly cache = new Map<string, Version>();
  private refresh: Promise<Version> | undefined;

  constructor(
    private readonly root: string,
    private readonly paths: ReadonlySet<string>,
  ) {}

  async read(path: string): Promise<Version | undefined> {
    try {
      const file = containedPath(this.root, path);
      const info = await stat(file);
      if (!info.isFile()) return undefined;
      const identity = `${info.dev}:${info.ino}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`;
      const cached = this.cache.get(path);
      if (cached?.identity === identity) return cached;
      const bytes = await readFile(file);
      const version = { identity, hash: hash(bytes), bytes };
      this.cache.set(path, version);
      return version;
    } catch {
      this.cache.delete(path);
      return undefined;
    }
  }

  manifest(): Promise<Version> {
    this.refresh ??= Promise.all(
      [...this.paths].map(async (path) => [path, (await this.read(path))?.hash] as const),
    )
      .then((entries) => {
        const bytes = Buffer.from(JSON.stringify(Object.fromEntries(entries)));
        return { identity: "", hash: hash(bytes), bytes };
      })
      .finally(() => {
        this.refresh = undefined;
      });
    return this.refresh;
  }
}

function send(
  req: IncomingMessage,
  res: ServerResponse,
  version: Version,
  contentType: string,
  cacheControl: string,
): void {
  const etag = `"${version.hash}"`;
  res.setHeader("Cache-Control", cacheControl);
  res.setHeader("ETag", etag);
  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304).end();
    return;
  }
  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": version.bytes.length,
    "X-Content-Type-Options": "nosniff",
  });
  res.end(req.method === "HEAD" ? undefined : version.bytes);
}

export function devStartupAssetCache(paths: readonly string[]): Plugin {
  return {
    name: "tilefun-startup-asset-cache",
    apply: "serve",
    config: () => ({
      define: { "import.meta.env.VITE_STARTUP_ASSET_CACHE": "true" },
    }),
    configureServer(server) {
      // The manifest is a server-owned allowlist of gameplay assets under public.
      const allowed = new Set(paths.filter((path) => CONTENT_TYPES[extname(path)]));
      const versions = new StartupAssetVersions(server.config.publicDir, allowed);
      const { base } = server.config;
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();
        const url = new URL(req.url ?? "/", "http://localhost");
        if (!url.pathname.startsWith(base)) return next();
        const path = url.pathname.slice(base.length);
        if (path === STARTUP_ASSET_MANIFEST) {
          send(req, res, await versions.manifest(), "application/json", "no-cache");
          return;
        }
        const requested = url.searchParams.get(STARTUP_ASSET_VERSION);
        if (!requested || !allowed.has(path)) return next();
        const version = await versions.read(path);
        const contentType = CONTENT_TYPES[extname(path)];
        if (version?.hash === requested && contentType) {
          send(req, res, version, contentType, IMMUTABLE);
        } else {
          res.writeHead(404, { "Cache-Control": "no-store" }).end();
        }
      });
    },
  };
}
