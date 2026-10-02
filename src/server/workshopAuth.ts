import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import type { WorkshopSession } from "../workshop/WorkshopTypes.js";

const COOKIE = "tilefun_workshop";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
export interface OwnerConfig {
  version: 1;
  username: string;
  passwordHash: string;
}
interface Session {
  owner: string;
  csrfToken: string;
  expires: number;
  configHash: string;
}
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export function jsonResponse(res: ServerResponse, value: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(value));
}
export async function jsonBody(req: IncomingMessage, limit = 24_000): Promise<unknown> {
  if (!req.headers["content-type"]?.startsWith("application/json"))
    throw new HttpError(415, "Expected JSON");
  let body = "";
  for await (const chunk of req) {
    body += chunk.toString();
    if (Buffer.byteLength(body) > limit) throw new HttpError(413, "Request too large");
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}
function derive(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, 32, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}
export async function hashWorkshopPassword(password: string) {
  if (password.length < 16 || password.length > 1024)
    throw new Error("Use a password of 16–1024 characters.");
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
async function verifyPassword(password: string, hash: string) {
  const [, salt, key] = hash.split("$");
  if (!salt || !key || !/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(hash))
    throw new Error("Invalid Workshop password hash");
  return timingSafeEqual(await derive(password, salt), Buffer.from(key, "hex"));
}
const digest = (s: string) => createHash("sha256").update(s).digest("hex");

/** Require both the actual TCP peer and the requested host to be loopback.
 * Reverse-proxied public traffic often has a loopback peer, so never trust
 * forwarded requests or the socket address alone for local access.
 */
export function isDirectLocalRequest(req: IncomingMessage): boolean {
  const peer = req.socket.remoteAddress;
  return (
    (peer === "127.0.0.1" || peer === "::1" || peer === "::ffff:127.0.0.1") &&
    /^(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/i.test(req.headers.host ?? "") &&
    ["forwarded", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto"].every(
      (key) => req.headers[key] === undefined,
    )
  );
}

export class WorkshopAuth {
  private queue = Promise.resolve();
  private attempts = new Map<string, { count: number; until: number }>();
  constructor(
    readonly directory = process.env.WORKSHOP_AUTH_DIR ?? "data/workshop",
    private publicOrigin = process.env.WORKSHOP_PUBLIC_ORIGIN,
    private localAuthBypass = process.env.WORKSHOP_LOCAL_AUTH_BYPASS !== "0",
  ) {}
  async config(): Promise<OwnerConfig | null> {
    try {
      const c = JSON.parse(
        await readFile(join(this.directory, "owner.json"), "utf8"),
      ) as OwnerConfig;
      if (
        c.version !== 1 ||
        typeof c.username !== "string" ||
        c.username.length > 80 ||
        !/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(c.passwordHash)
      )
        throw new Error("Invalid owner configuration");
      return c;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
  private origin(req: IncomingMessage) {
    if (this.publicOrigin && !this.localAccess(req)) return new URL(this.publicOrigin).origin;
    const host = req.headers.host ?? "";
    // This deployment terminates TLS upstream. Do not trust arbitrary forwarded headers.
    const secure =
      host === "tilefun.graehlarts.com" || ("encrypted" in req.socket && req.socket.encrypted);
    return `${secure ? "https" : "http"}://${host}`;
  }
  sameOrigin(req: IncomingMessage) {
    if (req.headers.origin && req.headers.origin !== this.origin(req))
      throw new HttpError(403, "Origin does not match");
    if (req.headers["sec-fetch-site"] === "cross-site")
      throw new HttpError(403, "Cross-site request denied");
  }
  private token(req: IncomingMessage) {
    const value = req.headers.cookie
      ?.split(";")
      .map((p) => p.trim())
      .find((p) => p.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1);
    return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
  }
  private async sessions(): Promise<Record<string, Session>> {
    try {
      return JSON.parse(await readFile(join(this.directory, "sessions.json"), "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw error;
    }
  }
  private async saveSessions(values: Record<string, Session>) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const path = join(this.directory, "sessions.json"),
      temp = `${path}.${randomBytes(6).toString("hex")}.tmp`;
    await writeFile(temp, JSON.stringify(values), { mode: 0o600 });
    await rename(temp, path);
  }
  private async updateSessions(change: (values: Record<string, Session>) => void) {
    const operation = this.queue.then(async () => {
      const values = await this.sessions();
      for (const [id, session] of Object.entries(values))
        if (session.expires <= Date.now()) delete values[id];
      change(values);
      await this.saveSessions(values);
    });
    this.queue = operation.catch(() => {});
    await operation;
  }
  private localAccess(req: IncomingMessage) {
    return this.localAuthBypass && isDirectLocalRequest(req);
  }
  async session(req: IncomingMessage): Promise<WorkshopSession> {
    const config = await this.config();
    if (this.localAccess(req))
      return {
        authenticated: true,
        configured: !!config,
        owner: "local",
        csrfToken: "local",
        local: true,
      };
    if (!config) return { authenticated: false, configured: false };
    const token = this.token(req),
      session = token ? (await this.sessions())[digest(token)] : undefined;
    if (
      !session ||
      session.expires <= Date.now() ||
      session.configHash !== digest(JSON.stringify(config))
    )
      return { authenticated: false, configured: true };
    return {
      authenticated: true,
      configured: true,
      owner: session.owner,
      csrfToken: session.csrfToken,
    };
  }
  async require(req: IncomingMessage, mutation = false) {
    const session = await this.session(req);
    if (!session.authenticated)
      throw new HttpError(401, "Sign in to the Workshop. Your unsent feedback is retained.");
    if (mutation) {
      this.sameOrigin(req);
      const supplied = req.headers["x-workshop-csrf"];
      if (typeof supplied !== "string" || supplied !== session.csrfToken)
        throw new HttpError(403, "Invalid session CSRF token");
    }
    return session;
  }
  private cookie(req: IncomingMessage, token: string, maxAge: number) {
    return `${COOKIE}=${token}; Path=/tilefun/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${this.origin(req).startsWith("https:") ? "; Secure" : ""}`;
  }
  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const path = req.url?.split("?")[0];
    if (!path?.startsWith("/tilefun/api/auth/")) return false;
    try {
      if (path === "/tilefun/api/auth/session" && req.method === "GET") {
        jsonResponse(res, await this.session(req));
        return true;
      }
      if (req.method !== "POST") throw new HttpError(405, "Use POST");
      this.sameOrigin(req);
      if (path === "/tilefun/api/auth/logout") {
        await this.require(req, true);
        const token = this.token(req);
        if (token)
          await this.updateSessions((values) => {
            delete values[digest(token)];
          });
        res.setHeader("Set-Cookie", this.cookie(req, "", 0));
        jsonResponse(
          res,
          this.localAccess(req)
            ? await this.session(req)
            : { authenticated: false, configured: true },
        );
        return true;
      }
      if (path !== "/tilefun/api/auth/login") throw new HttpError(404, "Unknown auth endpoint");
      const address = req.socket.remoteAddress ?? "unknown",
        now = Date.now();
      // Bound the limiter even when many distinct clients arrive.
      for (const [key, value] of this.attempts) if (value.until <= now) this.attempts.delete(key);
      const attempts = this.attempts.get(address) ?? { count: 0, until: now + 15 * 60_000 };
      if (attempts.count >= 6 || (this.attempts.size >= 4096 && !this.attempts.has(address))) {
        res.setHeader("Retry-After", "900");
        throw new HttpError(429, "Too many login attempts. Try again later.");
      }
      attempts.count++;
      this.attempts.set(address, attempts);
      const body = (await jsonBody(req, 2048)) as { username?: unknown; password?: unknown };
      const config = await this.config();
      if (!config)
        throw new HttpError(
          503,
          "Workshop login is not configured. Run npm run workshop:auth -- setup on the server.",
        );
      const valid =
        typeof body.password === "string" &&
        body.password.length <= 1024 &&
        typeof body.username === "string";
      const password = valid ? (body.password as string) : "invalid-password";
      const matches = await verifyPassword(password, config.passwordHash);
      if (!valid || body.username !== config.username || !matches)
        throw new HttpError(401, "Incorrect username or password");
      this.attempts.delete(address);
      const token = randomBytes(32).toString("hex"),
        csrfToken = randomBytes(32).toString("hex");
      await this.updateSessions((values) => {
        if (Object.keys(values).length >= 128) delete values[Object.keys(values)[0] ?? ""];
        values[digest(token)] = {
          owner: config.username,
          csrfToken,
          expires: Date.now() + SESSION_MS,
          configHash: digest(JSON.stringify(config)),
        };
      });
      res.setHeader("Set-Cookie", this.cookie(req, token, SESSION_MS / 1000));
      jsonResponse(res, {
        authenticated: true,
        configured: true,
        owner: config.username,
        csrfToken,
      });
    } catch (error) {
      jsonResponse(
        res,
        { error: error instanceof HttpError ? error.message : "Authentication unavailable" },
        error instanceof HttpError ? error.status : 500,
      );
    }
    return true;
  }
}
