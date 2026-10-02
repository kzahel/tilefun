import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";
import { isDirectLocalRequest } from "./workshopAuth.js";

const request = (peer: string, host: string, headers: Record<string, string> = {}) =>
  ({
    socket: { remoteAddress: peer },
    headers: { host, ...headers },
  }) as unknown as IncomingMessage;
describe("direct localhost Workshop access", () => {
  for (const peer of ["127.0.0.1", "::1", "::ffff:127.0.0.1"])
    for (const host of ["localhost:5174", "127.0.0.1:4174", "[::1]:3001"])
      it(`accepts ${host} from ${peer}`, () =>
        expect(isDirectLocalRequest(request(peer, host))).toBe(true));
  for (const peer of ["192.168.1.20", "203.0.113.2", "::ffff:192.168.1.20"])
    it(`rejects localhost Host from remote peer ${peer}`, () =>
      expect(isDirectLocalRequest(request(peer, "localhost:5174"))).toBe(false));
  for (const host of [
    "tilefun.graehlarts.com",
    "localhost.evil.example",
    "evil@localhost:5174",
    "127.0.0.1.evil.example",
    "localhost:5174/path",
  ])
    it(`requires owner login for ${host} even with a local proxy peer`, () =>
      expect(isDirectLocalRequest(request("127.0.0.1", host))).toBe(false));
  for (const header of ["forwarded", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto"])
    it(`never bypasses auth for proxied ${header} traffic`, () =>
      expect(
        isDirectLocalRequest(
          request("127.0.0.1", "localhost:5174", { [header]: "public-request" }),
        ),
      ).toBe(false));
});
