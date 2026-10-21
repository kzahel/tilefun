/** Coordinates always refer to native pixels in the named source sheet. */
export type ArtRect = [number, number, number, number];
export interface ArtSheet {
  id: string;
  name: string;
  image: string;
  width: number;
  height: number;
  tileSize: number;
  fingerprint: string;
  source: string;
  index?: string;
  indexKind?: "exteriors" | "interiors";
}
export interface ArtUsage {
  id: string;
  sheetId: string;
  rect: ArtRect;
  label: string;
  kind: "recipe" | "prop" | "terrain" | "furniture" | "architecture" | "sprite";
  /** Static source references, not a claim that an instance is in a particular world. */
  consumers: { system: string; source: string }[];
}
export interface ArtCatalog {
  version: 1;
  sheets: ArtSheet[];
  usages: ArtUsage[];
}
export interface ArtSlice {
  key: string;
  name: string;
  theme: string;
  rect: ArtRect;
  source?: string;
}
export function intersects(a: ArtRect, b: ArtRect): boolean {
  return a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];
}
export function validateRect(rect: unknown, sheet: Pick<ArtSheet, "width" | "height">): ArtRect {
  if (!Array.isArray(rect) || rect.length !== 4 || rect.some((v) => !Number.isInteger(v)))
    throw new Error("Invalid source rectangle");
  const [x, y, w, h] = rect;
  if (x < 0 || y < 0 || w < 1 || h < 1 || x + w > sheet.width || y + h > sheet.height)
    throw new Error("Selection is outside the source sheet");
  return [x, y, w, h];
}
/** Packed interior sprites are not tile-aligned; keep exact sprite rectangles. */
export function inflateSlices(sheet: ArtSheet, index: unknown): ArtSlice[] {
  if (sheet.indexKind === "exteriors") {
    const data = index as { themes: Record<string, Record<string, ArtRect>> };
    return Object.entries(data.themes).flatMap(([theme, entries]) =>
      Object.entries(entries).map(([name, rect]) => ({
        key: theme ? `${theme}_16x16_${name}` : name,
        name,
        theme: theme || "Additional houses",
        rect: validateRect(rect, sheet),
      })),
    );
  }
  if (sheet.indexKind === "interiors") {
    const data = index as {
      entries: {
        key: string;
        theme: string;
        category: string;
        rect: ArtRect;
        sourcePath: string;
      }[];
    };
    return data.entries.map((entry) => ({
      key: entry.key,
      name: entry.key,
      theme: `${entry.theme} / ${entry.category}`,
      rect: validateRect(entry.rect, sheet),
      source: entry.sourcePath,
    }));
  }
  return [];
}
export function snapRegion(
  a: { x: number; y: number },
  b: { x: number; y: number },
  sheet: ArtSheet,
): ArtRect {
  const s = sheet.tileSize;
  const x = Math.max(0, Math.floor(Math.min(a.x, b.x) / s) * s);
  const y = Math.max(0, Math.floor(Math.min(a.y, b.y) / s) * s);
  return validateRect(
    [
      x,
      y,
      Math.min(sheet.width, Math.floor(Math.max(a.x, b.x) / s) * s + s) - x,
      Math.min(sheet.height, Math.floor(Math.max(a.y, b.y) / s) * s + s) - y,
    ],
    sheet,
  );
}

export function required<T>(value: T | null | undefined, message = "Missing art source"): T {
  if (value === undefined || value === null) throw new Error(message);
  return value;
}
