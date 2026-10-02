import { useQuery } from "@tanstack/react-query";
import type { ArtCatalog } from "../art/ArtCatalog.js";
import type { ArtNote } from "../art/ArtNotes.js";
import { loadVerifiedArtImage } from "../art/ArtSource.js";
import type { OutdoorAsset, OutdoorCatalog } from "../assets/outdoor/OutdoorCatalog.js";
import { workshopJson } from "./AuthClient.js";
import { useSession } from "./WorkshopQueries.js";
export function useOutdoorCatalog() {
  return useQuery({
    queryKey: ["outdoor-catalog"],
    queryFn: async () => {
      const [catalog, art] = await Promise.all([
        fetch("/tilefun/data/outdoor-catalog.json").then((r) => {
          if (!r.ok) throw new Error("Outdoor catalog unavailable");
          return r.json() as Promise<OutdoorCatalog>;
        }),
        fetch("/tilefun/data/art-catalog.json").then((r) => r.json() as Promise<ArtCatalog>),
      ]);
      const sheet = art.sheets.find((s) => s.id === "me-complete");
      if (!sheet || sheet.fingerprint !== catalog.sourceFingerprint)
        throw new Error("Outdoor source revision changed; rebuild the catalog");
      const image = await loadVerifiedArtImage(sheet);
      return { catalog, art, sheet, image };
    },
    staleTime: Infinity,
  });
}
export function useArtNotes() {
  const session = useSession();
  return useQuery({
    queryKey: ["workshop", "art-notes"],
    queryFn: () => workshopJson<ArtNote[]>("art-notes"),
    enabled: session.data?.authenticated === true,
    refetchInterval: 15000,
  });
}
export function assetNotes(notes: ArtNote[], asset: OutdoorAsset, fingerprint: string) {
  return notes
    .filter((n) => n.assetAnnotation?.assetId === asset.id && n.fingerprint === fingerprint)
    .sort((a, b) =>
      (a.assetAnnotation?.createdAt ?? a.createdAt).localeCompare(
        b.assetAnnotation?.createdAt ?? b.createdAt,
      ),
    );
}
export function catalogAssets(catalog: OutdoorCatalog, notes: ArtNote[]) {
  const originals = new Map(catalog.assets.map((a) => [a.id, a]));
  const assets = new Map(originals);
  for (const n of [...notes].sort((a, b) =>
    (a.assetAnnotation?.createdAt ?? a.createdAt).localeCompare(
      b.assetAnnotation?.createdAt ?? b.createdAt,
    ),
  )) {
    if (!n.assetAnnotation || n.fingerprint !== catalog.sourceFingerprint) continue;
    const original = originals.get(n.assetAnnotation.assetId);
    if (
      original &&
      n.assetAnnotation.baseMetadata &&
      JSON.stringify(original.metadata) !== JSON.stringify(n.assetAnnotation.baseMetadata) &&
      JSON.stringify(original.metadata) !== JSON.stringify(n.assetAnnotation.metadata)
    )
      continue;
    const a = assets.get(n.assetAnnotation.assetId);
    assets.set(
      n.assetAnnotation.assetId,
      a
        ? { ...a, metadata: n.assetAnnotation.metadata }
        : {
            id: n.assetAnnotation.assetId,
            rect: n.rect,
            visualBounds: [0, 0, n.rect[2], n.rect[3]],
            aliases: [],
            metadata: n.assetAnnotation.metadata,
            evidence: "candidate",
            runtimeTypes: [],
          },
    );
  }
  return [...assets.values()];
}

export function assetReviewState(notes: ArtNote[], asset: OutdoorAsset, fingerprint: string) {
  const latest = assetNotes(notes, asset, fingerprint).at(-1)?.assetAnnotation;
  return latest
    ? JSON.stringify(latest.metadata) === JSON.stringify(asset.metadata)
      ? latest.verdict
      : "changed"
    : "";
}
