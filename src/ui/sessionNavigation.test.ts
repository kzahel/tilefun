import { expect, it } from "vitest";
import { sessionUrl } from "./sessionNavigation.js";

it("opens invitations on the installation's stable origin and clears conflicting transport/routes", () => {
  const url = new URL(
    sessionUrl(
      "join",
      "https://example.org/tilefun/?join=hello_123",
      "tilefun://app/tilefun/?host&server=bad&generation=old&desktop=1",
    ),
  );
  expect(url.origin).toBe("null"); // Node doesn't register Electron's custom scheme
  expect(url.host).toBe("app");
  expect(url.searchParams.get("join")).toBe("hello_123");
  expect(url.searchParams.get("desktop")).toBe("1");
  expect(url.searchParams.has("host")).toBe(false);
  expect(url.searchParams.has("server")).toBe(false);
  expect(url.searchParams.has("generation")).toBe(false);
  expect(() => sessionUrl("join", "not a code", "https://example.org/tilefun/")).toThrow(
    "valid join code",
  );
});
