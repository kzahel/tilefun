import { expect, it } from "vitest";
import { requireWebGl2, softwareWebGl, WebGl2UnavailableError } from "./WebGl2Support.js";

const canvasWith = (getContext: () => unknown) => () =>
  ({ getContext }) as unknown as HTMLCanvasElement;

it("rejects browsers without a WebGL2 context and releases the probe context", () => {
  expect(() => requireWebGl2(canvasWith(() => null))).toThrow(WebGl2UnavailableError);
  expect(() =>
    requireWebGl2(
      canvasWith(() => {
        throw Error("blocked");
      }),
    ),
  ).toThrow(/needs WebGL2/);
  let lost = false;
  const UNMASKED = 0x9246;
  requireWebGl2(
    canvasWith(() => ({
      getExtension: (name: string) =>
        name === "WEBGL_debug_renderer_info"
          ? { UNMASKED_RENDERER_WEBGL: UNMASKED }
          : {
              loseContext: () => {
                lost = true;
              },
            },
      getParameter: (key: number) =>
        key === UNMASKED
          ? "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device), SwiftShader driver)"
          : "",
    })),
  );
  expect(lost).toBe(true);
  // The probe remembers that the GPU's work runs on the CPU.
  expect(softwareWebGl()).toBe(true);
});
