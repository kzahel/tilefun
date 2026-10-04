import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { validateRect } from "../art/ArtCatalog.js";
import { loadVerifiedArtImage, sha256 } from "../art/ArtSource.js";
import { reviewContext2D } from "../art/reviewCanvas.js";
import type { FamilySheetCatalog, FamilySprite } from "./FamilySheetTypes.js";

/** Matches the adapter's sorted, ASCII-escaped JSON; revisions exclude only themselves. */
export function familyCanonicalJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(familyCanonicalJSON).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, entry]) => `${familyCanonicalJSON(key)}:${familyCanonicalJSON(entry)}`)
      .join(",")}}`;
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error("Invalid family metadata.");
  return encoded.replace(
    /[\u007f-\uffff]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

async function verifyRevision(value: { revision: string }) {
  const { revision, ...contents } = value;
  if ((await sha256(new TextEncoder().encode(familyCanonicalJSON(contents)))) !== revision)
    throw new Error("The family sheet changed. Reload before leaving a note.");
}

export async function loadFamilySheetCatalog(): Promise<FamilySheetCatalog> {
  const response = await fetch("/tilefun/data/family-sheets.json");
  if (!response.ok) throw new Error("Family sheets are unavailable.");
  const catalog = (await response.json()) as FamilySheetCatalog;
  if (
    catalog.version !== 1 ||
    !Array.isArray(catalog.sources) ||
    !Array.isArray(catalog.families) ||
    catalog.families.length !== 3
  )
    throw new Error("Unsupported family sheets.");
  await verifyRevision(catalog);
  const ids = new Set<string>();
  for (const family of catalog.families) {
    if (ids.has(family.id) || !["cabinets", "trees", "scrapyard"].includes(family.id))
      throw new Error("Invalid family identity.");
    ids.add(family.id);
    await verifyRevision(family);
    const pinnedIds = new Set<string>();
    for (const pin of family.sourcePins) {
      const source = catalog.sources.find((entry) => entry.id === pin.id);
      if (
        pinnedIds.has(pin.id) ||
        !source ||
        source.fingerprint !== pin.fingerprint ||
        source.width !== pin.width ||
        source.height !== pin.height
      )
        throw new Error("The artwork no longer matches this family proposal.");
      pinnedIds.add(pin.id);
    }
    const usedIds = new Set<string>();
    for (const item of [...family.groups.flatMap((g) => g.members), ...family.examples]) {
      for (const variant of item.variants) {
        const [width, height] = variant.sprite.size;
        if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1)
          throw new Error("Invalid artwork size.");
        if (!variant.sprite.layers.length) throw new Error("Artwork is missing.");
        for (const layer of variant.sprite.layers) {
          const sheet = catalog.sources.find((s) => s.id === layer.sheetId);
          if (!sheet || !pinnedIds.has(sheet.id)) throw new Error("Artwork source is missing.");
          usedIds.add(sheet.id);
          validateRect(layer.rect, sheet);
          const [x, y] = layer.at;
          if (
            !Number.isInteger(x) ||
            !Number.isInteger(y) ||
            x < 0 ||
            y < 0 ||
            x + layer.rect[2] > width ||
            y + layer.rect[3] > height
          )
            throw new Error("Artwork does not fit its frame.");
        }
      }
    }
    if (usedIds.size !== pinnedIds.size) throw new Error("Unexpected artwork source pin.");
  }
  return catalog;
}

export function useFamilySheets() {
  return useQuery({
    queryKey: ["family-sheets"],
    queryFn: loadFamilySheetCatalog,
    staleTime: Infinity,
  });
}

export async function loadFamilyImages(catalog: FamilySheetCatalog) {
  return new Map(
    await Promise.all(
      catalog.sources.map(
        async (source) => [source.id, await loadVerifiedArtImage(source)] as const,
      ),
    ),
  );
}

export function useFamilyImages(catalog: FamilySheetCatalog) {
  return useQuery({
    queryKey: ["family-images", catalog.revision],
    queryFn: () => loadFamilyImages(catalog),
    staleTime: Infinity,
  });
}

export function drawFamilySprite(
  canvas: HTMLCanvasElement,
  sprite: FamilySprite,
  images: Map<string, HTMLImageElement>,
) {
  [canvas.width, canvas.height] = sprite.size;
  const ctx = reviewContext2D(canvas);
  ctx.imageSmoothingEnabled = false;
  for (const layer of sprite.layers) {
    const image = images.get(layer.sheetId);
    if (!image) throw new Error("Artwork source is not loaded.");
    const [sx, sy, width, height] = layer.rect;
    const [x, y] = layer.at;
    // Replacement strips also replace transparent pixels. Source-over alone would
    // retain pixels from earlier layers and would misrepresent a composed sprite.
    ctx.clearRect(x, y, width, height);
    ctx.drawImage(image, sx, sy, width, height, x, y, width, height);
  }
  canvas.dataset.artReady = "true";
}

export function FamilySpriteCanvas({
  sprite,
  images,
  zoom,
  label,
}: {
  sprite: FamilySprite;
  images: Map<string, HTMLImageElement>;
  zoom: number;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawFamilySprite(ref.current, sprite, images);
  }, [sprite, images]);
  const scale = Math.max(1, Math.floor(zoom));
  return (
    <canvas
      ref={ref}
      width={sprite.size[0]}
      height={sprite.size[1]}
      role="img"
      aria-label={label}
      data-layer-count={sprite.layers.length}
      style={{
        width: sprite.size[0] * scale,
        height: sprite.size[1] * scale,
        imageRendering: "pixelated",
      }}
    />
  );
}
