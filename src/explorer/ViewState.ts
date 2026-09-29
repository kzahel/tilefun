import type { Bounds, Point } from "../generation/regional/RegionalPlanner.js";
import {
  GENERATOR_VERSION,
  MAX_WORLD_COORDINATE,
  PROFILE,
  type RegionalWorld,
  regionalWorld,
  validateWorld,
} from "../generation/regional/WorldDescriptor.js";

export interface ViewState {
  x: number;
  y: number;
  /** CSS pixels per tile. The device pixel ratio is a rendering concern only. */
  zoom: number;
}

export interface Overlays {
  geography: boolean;
  landUse: boolean;
  roads: boolean;
  settlements: boolean;
  boundaries: boolean;
  lots: boolean;
  entrances: boolean;
}

export const DEFAULT_VIEW: ViewState = { x: 300, y: 519, zoom: 0.42 };
export const DEFAULT_OVERLAYS: Overlays = {
  geography: true,
  landUse: true,
  roads: true,
  settlements: true,
  boundaries: false,
  lots: true,
  entrances: true,
};
export const MIN_ZOOM = 0.0005;
export const MAX_ZOOM = 64;

export function clampView(view: ViewState): ViewState {
  const edge = MAX_WORLD_COORDINATE / 2;
  return {
    x: Math.max(-edge, Math.min(edge, view.x)),
    y: Math.max(-edge, Math.min(edge, view.y)),
    zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.zoom)),
  };
}

export function visibleBounds(view: ViewState, width: number, height: number): Bounds {
  return {
    minX: view.x - width / (2 * view.zoom),
    minY: view.y - height / (2 * view.zoom),
    maxX: view.x + width / (2 * view.zoom),
    maxY: view.y + height / (2 * view.zoom),
  };
}

export function screenToWorld(view: ViewState, width: number, height: number, point: Point): Point {
  return {
    x: view.x + (point.x - width / 2) / view.zoom,
    y: view.y + (point.y - height / 2) / view.zoom,
  };
}

/** Keep the geographic point under the pointer fixed while zoom changes. */
export function zoomAt(
  view: ViewState,
  width: number,
  height: number,
  point: Point,
  factor: number,
): ViewState {
  const anchor = screenToWorld(view, width, height, point);
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.zoom * factor));
  return clampView({
    x: anchor.x - (point.x - width / 2) / zoom,
    y: anchor.y - (point.y - height / 2) / zoom,
    zoom,
  });
}

export function locationUrl(
  base: string,
  world: RegionalWorld,
  view: ViewState,
  overlays: Overlays,
): string {
  const url = new URL(base);
  url.search = new URLSearchParams({
    seed: String(world.seed),
    version: world.generatorVersion,
    profile: world.profile,
    x: view.x.toFixed(3),
    y: view.y.toFixed(3),
    zoom: view.zoom.toPrecision(6),
    layers: (Object.keys(overlays) as (keyof Overlays)[]).filter((key) => overlays[key]).join(","),
  }).toString();
  return url.href;
}

export function parseLocation(url: string): {
  world: RegionalWorld;
  view: ViewState;
  overlays: Overlays;
} {
  const params = new URL(url).searchParams;
  const world = {
    seed: Number(params.get("seed") ?? 2026),
    generatorVersion: params.get("version") ?? GENERATOR_VERSION,
    profile: params.get("profile") ?? PROFILE,
  } as RegionalWorld;
  validateWorld(world);
  const view = {
    x: Number(params.get("x") ?? DEFAULT_VIEW.x),
    y: Number(params.get("y") ?? DEFAULT_VIEW.y),
    zoom: Number(params.get("zoom") ?? DEFAULT_VIEW.zoom),
  };
  if (
    !Object.values(view).every(Number.isFinite) ||
    Math.abs(view.x) > MAX_WORLD_COORDINATE / 2 ||
    Math.abs(view.y) > MAX_WORLD_COORDINATE / 2 ||
    view.zoom < MIN_ZOOM ||
    view.zoom > MAX_ZOOM
  )
    throw new Error("This location is outside the supported view range.");
  const overlays = { ...DEFAULT_OVERLAYS };
  if (params.has("layers")) {
    const layers = params.get("layers")?.split(",") ?? [];
    for (const key of Object.keys(overlays) as (keyof Overlays)[])
      overlays[key] = layers.includes(key);
  }
  return { world: regionalWorld(world.seed), view, overlays };
}
