import type { SurfacePiece } from "../../road/CitySurfaceRecipes.js";
import manifest from "./commercial-city-assets-v1.json" with { type: "json" };
import type { StreetPropRecipe } from "./StreetRecipes.js";

/** Manual promotion of ten exact human-approved geometry/palette candidates.
 * Never regenerate this snapshot in builds or from mutable review recipes. */
export const COMMERCIAL_CITY_ASSETS = manifest;
export const COMMERCIAL_STREET_PROPS = manifest.props as unknown as readonly StreetPropRecipe[];
export const COMMERCIAL_SURFACE_CELLS =
  manifest.cells as unknown as readonly (readonly SurfacePiece[])[];
