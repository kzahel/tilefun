import { expect, it } from "vitest";
import { extendOpaqueEdges } from "./ProxyTexture.js";

it("extends nearest painted edge colors without editing any original texel or source bytes", () => {
  const source = new Uint8ClampedArray(5 * 3 * 4);
  const blue = [10, 100, 210, 255],
    red = [220, 30, 10, 255];
  source.set(blue, (1 * 5 + 1) * 4);
  source.set(red, (1 * 5 + 3) * 4);
  const before = source.slice();
  const filled = extendOpaqueEdges(source, 5, 3);
  expect(source).toEqual(before);
  for (let i = 0; i < 15; i++) expect(filled[i * 4 + 3]).toBe(255);
  expect([...filled.slice(0, 4)]).toEqual(blue);
  expect([...filled.slice(4 * 4, 5 * 4)]).toEqual(red);
  expect([...filled.slice(6 * 4, 7 * 4)]).toEqual(blue);
  expect([...filled.slice(8 * 4, 9 * 4)]).toEqual(red);
});

it("keeps an entirely empty source empty and rejects inconsistent dimensions", () => {
  const empty = new Uint8ClampedArray(16);
  expect(extendOpaqueEdges(empty, 2, 2)).toEqual(empty);
  expect(() => extendOpaqueEdges(empty, 3, 2)).toThrow("dimensions");
});
