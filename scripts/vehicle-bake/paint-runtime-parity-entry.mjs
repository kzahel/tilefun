/** Ignored QA build only; one Three.js module graph for real loader/material identity. */
import "./family-viewer.mjs";
import { VehiclePaintResources } from "../../src/rendering/VehiclePaintResources.ts";

window.runtimePaintResources = new VehiclePaintResources();
addEventListener("pagehide", () => window.runtimePaintResources.dispose());
