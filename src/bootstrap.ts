import { prepareStartupAssetCache } from "./assets/AssetLoader.js";
import { STARTUP_ASSET_MANIFEST } from "./shared/startupAssetCache.js";
import { failStartup } from "./ui/StartupProgress.js";

// Keep this entry tiny: the HTML loading screen paints while the game graph loads.
if (import.meta.env.VITE_STARTUP_ASSET_CACHE)
  prepareStartupAssetCache(`${import.meta.env.BASE_URL}${STARTUP_ASSET_MANIFEST}`);
void import("./main.js").catch((error) => {
  console.error("[tilefun] Game code failed to load", error);
  failStartup(error);
});
