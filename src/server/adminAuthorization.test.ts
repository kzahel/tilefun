import { describe, expect, it } from "vitest";
import { takeAdminToken } from "../client/adminToken.js";
import { adminAuthorization } from "./adminAuthorization.js";

describe("Node server admin policy", () => {
  const token = "a".repeat(64);
  it("denies remote administration by default, regardless of client identity", () => {
    expect(adminAuthorization({})("local", token)).toBe(false);
    expect(adminAuthorization({})("claimed-admin")).toBe(false);
  });
  it("requires the configured secret and handles invalid values", () => {
    const authorize = adminAuthorization({ TILEFUN_ADMIN_TOKEN: token });
    expect(authorize("any-client", token)).toBe(true);
    for (const invalid of [undefined, "", "b".repeat(64), "é".repeat(64), "a".repeat(513)])
      expect(authorize("any-client", invalid)).toBe(false);
    expect(() => adminAuthorization({ TILEFUN_ADMIN_TOKEN: "weak" })).toThrow();
  });
  it("allows explicitly trusted co-op and gives a configured token precedence", () => {
    expect(adminAuthorization({ TILEFUN_TRUSTED_COOP: "1" })("guest")).toBe(true);
    expect(
      adminAuthorization({ TILEFUN_TRUSTED_COOP: "1", TILEFUN_ADMIN_TOKEN: token })("guest"),
    ).toBe(false);
  });
  it("consumes the fragment credential without changing query parameters or other fragment values", () => {
    const result = takeAdminToken(
      new URL(`https://example.test/tilefun/?server=host#adminToken=${token}&view=map`),
    );
    expect(result.token).toBe(token);
    expect(result.url.href).toBe("https://example.test/tilefun/?server=host#view=map");
  });
});
