import { expect, it } from "vitest";
import { requestedRenderer } from "./SelectableRenderHost.js";

it("defaults to GPU with 3D meshes and selects canvas sprites only through the legacy override", () => {
  const mode = (query: string) => requestedRenderer(new URLSearchParams(query));
  expect(mode("")).toBe("gpu");
  expect(mode("renderer=unknown")).toBe("gpu");
  // Older links: the GPU renderer has no sprite-vehicle mode, with or without `meshes`.
  expect(mode("renderer=gpu&meshes")).toBe("gpu");
  expect(mode("renderer=gpu")).toBe("gpu");
  expect(mode("renderer=legacy-canvas")).toBe("canvas");
  expect(mode("renderer=canvas")).toBe("canvas");
});
