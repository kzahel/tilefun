import { expect, it } from "vitest";
import { isSoftwareRenderer } from "../rendering/WebGl2Support.js";
import { savedUnifiedTopDown, saveUnifiedTopDown, unifiedTopDownChoice } from "./unifiedTopDown.js";

const memory = () => {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
};

it("remembers the device's choice of view, and that none was made", () => {
  const storage = memory();
  expect(savedUnifiedTopDown(storage)).toBeUndefined();
  saveUnifiedTopDown(storage, false);
  expect(savedUnifiedTopDown(storage)).toBe(false);
  saveUnifiedTopDown(storage, true);
  expect(savedUnifiedTopDown(storage)).toBe(true);
  expect(savedUnifiedTopDown(undefined)).toBeUndefined();
  expect(
    savedUnifiedTopDown({
      getItem: () => {
        throw Error("blocked");
      },
    }),
  ).toBeUndefined();
});

it("is the unified view unless the device chose the classic one or draws in software", () => {
  expect(unifiedTopDownChoice("", memory())).toBe(true);
  expect(unifiedTopDownChoice("?nogamepad", undefined)).toBe(true);
  // A software rasteriser keeps the classic view, unless the unified one was chosen.
  expect(unifiedTopDownChoice("", memory(), true)).toBe(false);
  const chosen = memory();
  saveUnifiedTopDown(chosen, true);
  expect(unifiedTopDownChoice("", chosen, true)).toBe(true);
  const classic = memory();
  saveUnifiedTopDown(classic, false);
  expect(unifiedTopDownChoice("", classic)).toBe(false);
  // The page's view parameter overrides both for one load.
  expect(unifiedTopDownChoice("?view=topdown3d", classic, true)).toBe(true);
  expect(unifiedTopDownChoice("?view=fixed", chosen)).toBe(false);
  expect(unifiedTopDownChoice("?view=2d", memory())).toBe(false);
});

it("recognises software rasterisers by their renderer string", () => {
  expect(
    isSoftwareRenderer(
      "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)",
    ),
  ).toBe(true);
  expect(isSoftwareRenderer("llvmpipe (LLVM 15.0.7, 256 bits)")).toBe(true);
  expect(isSoftwareRenderer("ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11)")).toBe(
    true,
  );
  expect(
    isSoftwareRenderer("ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)"),
  ).toBe(false);
  expect(isSoftwareRenderer("Adreno (TM) 740")).toBe(false);
  expect(isSoftwareRenderer("AMD Custom GPU 0405 (radeonsi, vangogh, LLVM 17.0.6, DRM 3.57)")).toBe(
    false,
  );
});
