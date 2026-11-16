import { expect, it } from "vitest";
import { savedUnifiedTopDown, saveUnifiedTopDown, unifiedTopDownChoice } from "./unifiedTopDown.js";

const memory = () => {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
};

it("is the unified top-down view on a device unless the classic view was chosen", () => {
  const storage = memory();
  expect(savedUnifiedTopDown(storage)).toBe(true);
  saveUnifiedTopDown(storage, false);
  expect(savedUnifiedTopDown(storage)).toBe(false);
  saveUnifiedTopDown(storage, true);
  expect(savedUnifiedTopDown(storage)).toBe(true);
  // The earlier opt-in reads as the unified view too.
  storage.items.set("tilefun.unifiedTopDown", "1");
  expect(savedUnifiedTopDown(storage)).toBe(true);
  // No storage (or a blocked one) is the default.
  expect(savedUnifiedTopDown(undefined)).toBe(true);
  expect(
    savedUnifiedTopDown({
      getItem: () => {
        throw Error("blocked");
      },
    }),
  ).toBe(true);
});

it("lets the page's view parameter override the device's choice for one load", () => {
  const classic = memory();
  saveUnifiedTopDown(classic, false);
  expect(unifiedTopDownChoice("", classic)).toBe(false);
  expect(unifiedTopDownChoice("?view=topdown3d", classic)).toBe(true);
  expect(unifiedTopDownChoice("?view=fixed", memory())).toBe(false);
  expect(unifiedTopDownChoice("?view=2d", memory())).toBe(false);
  expect(unifiedTopDownChoice("?nogamepad", memory())).toBe(true);
});
