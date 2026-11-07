import { expect, it } from "vitest";
import { requestedRenderer } from "./SelectableRenderHost.js";

it("defaults to 3D meshes and selects canvas sprites only through the legacy override", () => {
  const mode = (query: string) => requestedRenderer(new URLSearchParams(query));
  expect(mode("")).toBe("gpu-mesh");
  expect(mode("renderer=unknown")).toBe("gpu-mesh");
  expect(mode("renderer=gpu&meshes")).toBe("gpu-mesh");
  expect(mode("renderer=gpu")).toBe("gpu");
  expect(mode("renderer=legacy-canvas")).toBe("canvas");
  expect(mode("renderer=canvas")).toBe("canvas");
});
