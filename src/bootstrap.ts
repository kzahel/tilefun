import { failStartup } from "./ui/StartupProgress.js";

// Keep this entry tiny: the HTML loading screen paints while the game graph loads.
void import("./main.js").catch((error) => {
  console.error("[tilefun] Game code failed to load", error);
  failStartup(error);
});
