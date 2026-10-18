import { afterEach, expect, it, vi } from "vitest";
import { peerOptions } from "./peerOptions.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("enables internal PeerJS errors and preserves the exception object/stack", () => {
  vi.stubGlobal("location", { href: "https://example.com/tilefun/" });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const options = peerOptions();
  const error = new TypeError("message too large");
  expect(options.debug).toBe(1);
  options.logFunction?.(1, "Error when sending", error);
  expect(log).toHaveBeenCalledWith("[tilefun] PeerJS:", "Error when sending", error);
});
