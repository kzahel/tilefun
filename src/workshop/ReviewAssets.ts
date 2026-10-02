import { type ArtCatalog, required } from "../art/ArtCatalog.js";
import { loadVerifiedArtImage } from "../art/ArtSource.js";
import { type GameAssets, loadTerrainAssets } from "../assets/GameAssets.js";
import { Spritesheet } from "../assets/Spritesheet.js";
import { BlendGraph } from "../autotile/BlendGraph.js";

let assetsPromise: Promise<{ assets: GameAssets; catalog: ArtCatalog }> | undefined;
export async function reviewAssets() {
  if (assetsPromise) return assetsPromise;
  assetsPromise = (async () => {
    const catalog = (await fetch("/tilefun/data/art-catalog.json").then((r) =>
      r.json(),
    )) as ArtCatalog;
    const source = required(catalog.sheets.find((s) => s.id === "me-complete"));
    const [assets, image] = await Promise.all([
      loadTerrainAssets(new BlendGraph()),
      loadVerifiedArtImage(source),
    ]);
    assets.sheets.set("me-complete", new Spritesheet(await createImageBitmap(image), 16, 16));
    return { assets, catalog };
  })().catch((error) => {
    assetsPromise = undefined;
    throw error;
  });
  return assetsPromise;
}
