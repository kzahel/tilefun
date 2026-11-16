import { expect, it } from "vitest";
import { savedUnifiedTopDown, saveUnifiedTopDown } from "./unifiedTopDown.js";

it("remembers the unified top-down choice on the device, off by default", () => {
  const items = new Map<string, string>();
  const storage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
  expect(savedUnifiedTopDown(storage)).toBe(false);
  saveUnifiedTopDown(storage, true);
  expect(savedUnifiedTopDown(storage)).toBe(true);
  saveUnifiedTopDown(storage, false);
  expect(savedUnifiedTopDown(storage)).toBe(false);
  // No storage (or a blocked one) is the default.
  expect(savedUnifiedTopDown(undefined)).toBe(false);
  expect(
    savedUnifiedTopDown({
      getItem: () => {
        throw Error("blocked");
      },
    }),
  ).toBe(false);
});
