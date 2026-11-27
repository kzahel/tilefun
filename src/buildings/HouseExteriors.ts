import { type BuildingSection, section } from "./BuildingSection.js";

/** Endpoints are traced in sprite pixels (origin top left). The rear eave is
 * 'depth' rows above the front eave. The painted drop shadow has no volume. */
function roofWing(
  width: number,
  height: number,
  feet: number,
  depth: number,
  outline: readonly [number, number][],
): BuildingSection[] {
  const result: BuildingSection[] = [];
  for (let i = 1; i < outline.length; i++) {
    const a = outline[i - 1],
      b = outline[i];
    if (!a || !b) continue;
    const left = a[0] - width / 2,
      right = b[0] - width / 2;
    const front = feet - height,
      top = feet - a[1],
      topRight = feet - b[1];
    const slope = (topRight - top) / (right - left);
    const insetLeft = i === 1 ? 4 : 0,
      insetRight = i === outline.length - 1 ? 4 : 0;
    result.push(
      section(
        left + insetLeft,
        right - insetRight,
        front - depth + 4,
        front - 4,
        top + slope * insetLeft - 4,
        { topRight: topRight - slope * insetRight - 4 },
      ),
      section(left, right, front - depth, front, top, {
        topRight,
        base: top - 4,
        baseRight: topRight - 4,
      }),
    );
  }
  return result;
}

export const farmhouse = [
  ...roofWing(288, 256, 205, 52, [
    [6, 146],
    [89, 135],
  ]),
  ...roofWing(288, 256, 236, 94, [
    [85, 162],
    [170, 95],
    [256, 162],
  ]),
  // The wraparound balcony, its front pillars and the lower timber porch.
  section(-46, 127, -46, -5, 47, { base: 40 }),
  section(110, 127, -121, -46, 47, { base: 40 }),
  section(-46, -34, -14, -5, 40),
  section(112, 126, -14, -5, 40),
  section(-66, 127, -23, -4, 4),
  section(-34, -14, -9, -6, 23, { base: 6 }),
  section(14, 112, -9, -6, 23, { base: 6 }),
];
export const japaneseHouse = [
  ...roofWing(240, 224, 209, 75, [
    [8, 138],
    [37, 134],
  ]),
  ...roofWing(240, 224, 222, 93, [
    [35, 141],
    [122, 94],
    [210, 141],
  ]),
  ...roofWing(240, 224, 216, 82, [
    [208, 140],
    [233, 140],
  ]),
  section(-112, 23, -26, -2, 35, { base: 31 }),
];
export const shed = roofWing(48, 64, 64, 26, [
  [0, 39],
  [24, 26],
  [48, 39],
]);
export function terracedHouse(variant: number) {
  const height = variant === 3 ? 256 : 240;
  const feet = variant === 3 ? 244 : variant >= 4 ? 231 : 228;
  const sections = [
    ...roofWing(192, height, feet, 122, [
      [11, 161],
      [159, 122],
    ]),
    ...roofWing(192, height, feet, 117, [
      [154, 133],
      [175, 133],
    ]),
  ];
  if (variant === 3) {
    sections.push(
      section(-60, 51, -25, -9, 45, { base: 40 }),
      section(-57, -52, -15, -8, 40),
      section(45, 50, -15, -8, 40),
    );
  }
  return sections;
}
