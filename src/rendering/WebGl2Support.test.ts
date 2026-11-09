import { expect, it } from "vitest";
import { requireWebGl2, WebGl2UnavailableError } from "./WebGl2Support.js";

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
  requireWebGl2(
    canvasWith(() => ({
      getExtension: () => ({
        loseContext: () => {
          lost = true;
        },
      }),
    })),
  );
  expect(lost).toBe(true);
});
