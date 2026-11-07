import type { InteriorCatalogRouteState } from "./InteriorCatalog.js";

/** Interior catalog deep-link state from the page URL. */
export function readInteriorRouteState(params: URLSearchParams): InteriorCatalogRouteState {
  const state: InteriorCatalogRouteState = {};
  const search = params.get("interiorSearch") ?? params.get("search");
  if (search !== null) state.search = search;

  const sourceKind = params.get("interiorSource");
  if (
    sourceKind === "" ||
    sourceKind === "home_design_layer" ||
    sourceKind === "room_builder_tile" ||
    sourceKind === "room_builder_sheet" ||
    sourceKind === "single"
  ) {
    state.sourceKind = sourceKind;
  }

  const category = params.get("interiorCategory");
  if (category !== null) state.category = category;

  const variant = params.get("interiorVariant");
  if (
    variant === "" ||
    variant === "normal" ||
    variant === "shadowless" ||
    variant === "black-shadow"
  ) {
    state.variant = variant;
  }

  const design = params.get("interiorDesign");
  if (design !== null) state.design = design;
  return state;
}
