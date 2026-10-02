/** Audited source pixels shared by surface previews and dense district generation.
 * The neutral tile lookup is pinned by regional-v4; changes need a new bank/version.
 */
export const CITY_SURFACE_SOURCE = {
  sheetId: "me-complete",
  fingerprint: "1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737",
  notes: ["ce4b4882-0078-451d-b89b-bb4f24ef7acc", "e06455c5-5473-4ba8-8a10-aa0ac3e660f6"],
} as const;
export type SurfaceRect = readonly [number, number, number, number];
export interface SurfacePiece {
  label: string;
  rect: SurfaceRect;
  x: number;
  y: number;
  role: "road" | "pavement" | "curb" | "paint" | "median";
}
export interface CitySurfaceCase {
  id: string;
  name: string;
  prompt: string;
  layout: "straight" | "vertical" | "boulevard" | "corner" | "tee" | "cross";
  roadWidth: number;
  palette: "neutral" | "warm" | "original";
  /** A lead-in keeps the center divider legible before the raised island. */
  medianApproach?: "guided";
  /** New review geometry. Omitted in every frozen foundation recipe. */
  geometry?: "rounded" | "refuge" | "approaches" | "parking";
}
export const CITY_SURFACE_CASES: readonly CitySurfaceCase[] = [
  {
    id: "surface-v1-narrow",
    name: "Narrow neighborhood street",
    layout: "straight",
    roadWidth: 4,
    palette: "neutral",
    prompt: "Review the narrow roadway, pavement texture, and both curb edges.",
  },
  {
    id: "surface-v1-two-lane",
    name: "Two-lane street & crossing",
    layout: "straight",
    roadWidth: 8,
    palette: "neutral",
    prompt: "Review the lane divider, zebra crossing, and shaded curb joins.",
  },
  {
    id: "surface-v1-vertical",
    name: "Two-lane street · north–south",
    layout: "vertical",
    roadWidth: 8,
    palette: "neutral",
    prompt: "Check the vertical curb edges and crossing against the horizontal street.",
  },
  {
    id: "surface-v1-boulevard",
    name: "Divided boulevard",
    medianApproach: "guided",
    layout: "boulevard",
    roadWidth: 12,
    palette: "neutral",
    prompt: "Review the rounded raised center divider and the road space on each side.",
  },
  {
    id: "surface-v1-corner",
    name: "Neighborhood corner",
    layout: "corner",
    roadWidth: 6,
    palette: "neutral",
    prompt: "Review the inside and outside curb corners and the turn.",
  },
  {
    id: "surface-v1-tee",
    name: "T intersection",
    layout: "tee",
    roadWidth: 6,
    palette: "neutral",
    prompt: "Check pavement continuity, curb corners, and the three approaches.",
  },
  {
    id: "surface-v1-cross",
    name: "Four-way intersection",
    layout: "cross",
    roadWidth: 8,
    palette: "neutral",
    prompt: "Review the four corner joins, crossings, and open intersection center.",
  },
  {
    id: "surface-v1-warm",
    name: "Four-way intersection · warm pavement",
    layout: "cross",
    roadWidth: 8,
    palette: "warm",
    prompt: "Compare this neighboring warm pavement bank with the neutral intersection.",
  },
  {
    id: "surface-v1-original",
    name: "Two-lane street · first selection",
    layout: "straight",
    roadWidth: 8,
    palette: "original",
    prompt: "Compare the first selected pavement/road bank with the newer neutral bank.",
  },
];
export const SURFACE_COLS = 32;
export const SURFACE_ROWS = 24;

export const CITY_GEOMETRY_CASES: readonly CitySurfaceCase[] = [
  {
    id: "surface-v2-rounded",
    name: "Rounded intersection curbs",
    layout: "cross",
    roadWidth: 8,
    palette: "neutral",
    geometry: "rounded",
    prompt: "Check all four curved curb joins against the straight sidewalks and road edges.",
  },
  {
    id: "surface-v2-refuge",
    name: "Crossing with a pedestrian refuge",
    layout: "straight",
    roadWidth: 12,
    palette: "neutral",
    geometry: "refuge",
    prompt: "Check the capped island, open central landing and crossings on both sides.",
  },
  {
    id: "surface-v2-approaches",
    name: "Crossings & curb extensions",
    layout: "straight",
    roadWidth: 8,
    palette: "neutral",
    geometry: "approaches",
    prompt:
      "Check how the crossings meet the wider sidewalk approaches and the shortened crossing distance.",
  },
  {
    id: "surface-v2-parking",
    name: "Curbside parking bays",
    layout: "straight",
    roadWidth: 8,
    palette: "neutral",
    geometry: "parking",
    prompt:
      "Check the native parking markings, curb joins, sidewalk gaps and clear driving lanes. Cars and meters come after this surface review.",
  },
];
export const ALL_CITY_SURFACE_CASES = [...CITY_SURFACE_CASES, ...CITY_GEOMETRY_CASES];
export const citySurfaceRecipe = (c: CitySurfaceCase) =>
  c.geometry ? "city-surfaces-v2" : "city-surfaces-v1";

/** Reusable place facts, in native pixels. These reserve space for the next
 * furnishing slice; no cars or props are painted into the surface. */
export function cityGeometryPlan(c: CitySurfaceCase) {
  const top = 12 - c.roadWidth / 2,
    bottom = 12 + c.roadWidth / 2;
  const crossings =
    c.geometry === "refuge"
      ? [15]
      : c.geometry === "approaches"
        ? [8, 22]
        : c.geometry === "parking"
          ? [27]
          : [];
  return {
    sidewalkExtensions:
      c.geometry === "approaches"
        ? [7, 21].flatMap((x) =>
            [top, bottom - 2].map((y) => ({
              minX: x * 16,
              maxX: (x + 4) * 16,
              minY: y * 16,
              maxY: (y + 2) * 16,
            })),
          )
        : c.geometry === "parking"
          ? [8, 15, 22].map((x) => ({
              minX: x * 16,
              maxX: (x + 2) * 16,
              minY: top * 16,
              maxY: (top + 2) * 16,
            }))
          : [],
    crossings: crossings.map((x) => ({
      x: x * 16,
      width: 32,
      top: (c.geometry === "approaches" ? top + 2 : top) * 16,
      bottom: (c.geometry === "approaches" ? bottom - 2 : bottom) * 16,
    })),
    islands:
      c.geometry === "refuge"
        ? [{ minX: 6 * 16, maxX: 26 * 16, minY: 11 * 16, maxY: 13 * 16 }]
        : [],
    refuge:
      c.geometry === "refuge"
        ? { minX: 15 * 16, maxX: 17 * 16, minY: 11 * 16, maxY: 13 * 16 }
        : null,
    parking:
      c.geometry === "parking"
        ? [3, 10, 17].map((x) => ({
            minX: x * 16,
            maxX: (x + 5) * 16,
            minY: top * 16,
            maxY: (top + 2) * 16,
            facing: "east-west" as const,
          }))
        : [],
  };
}

/** Unbounded occupancy is intentional: preview boundaries do not create end caps.
 * Districts can use this same query across chunk boundaries.
 */
export function citySurfaceRoadAt(c: CitySurfaceCase, x: number, y: number): boolean {
  const left = 16 - c.roadWidth / 2,
    right = 16 + c.roadWidth / 2;
  const top = 12 - c.roadWidth / 2,
    bottom = 12 + c.roadWidth / 2;
  const h = y >= top && y < bottom,
    v = x >= left && x < right;
  if (
    c.geometry &&
    h &&
    cityGeometryPlan(c).sidewalkExtensions.some(
      (b) => x * 16 >= b.minX && x * 16 < b.maxX && y * 16 >= b.minY && y * 16 < b.maxY,
    )
  )
    return false;
  switch (c.layout) {
    case "vertical":
      return v;
    case "corner":
      return (h && x < right) || (v && y >= top);
    case "tee":
      return h || (v && y >= top);
    case "cross":
      return h || v;
    default:
      return h;
  }
}
function bank(palette: CitySurfaceCase["palette"]): [number, number] {
  return palette === "original" ? [512, 16] : palette === "warm" ? [416, 1904] : [0, 1904];
}
/** Neighbor query may span loaded chunks; tile choice never depends on view bounds.
 * Supports the reviewed wide connected streets, not isolated one-cell slivers.
 */
export function citySurfaceTileAt(
  palette: CitySurfaceCase["palette"],
  x: number,
  y: number,
  road: (x: number, y: number) => boolean,
): SurfacePiece {
  const [bx, by] = bank(palette);
  if (!road(x, y)) {
    return {
      label: "Pavement fill",
      rect: [bx + 96 + (((x % 2) + 2) % 2) * 16, by + 80 + (((y % 2) + 2) % 2) * 16, 16, 16],
      x: x * 16,
      y: y * 16,
      role: "pavement",
    };
  }
  // Curb pixels live on the asphalt side in this 4×4 vendor motif.
  const n = !road(x, y - 1),
    s = !road(x, y + 1),
    w = !road(x - 1, y),
    e = !road(x + 1, y);
  let rx = 80,
    ry = 0;
  if ((n || s) && (w || e)) {
    // Concave pavement corner: road touches two pavement sides. The inverted
    // vendor motif has full curb runs on both edges, unlike a convex end cap.
    rx = w ? 96 : 112;
    ry = n ? 0 : 48;
  } else if (n || s || w || e) {
    rx = w ? 64 : e ? 16 : 32;
    ry = n ? 48 : s ? 0 : 16;
  } else {
    const nw = !road(x - 1, y - 1),
      ne = !road(x + 1, y - 1),
      sw = !road(x - 1, y + 1),
      se = !road(x + 1, y + 1);
    if (nw || ne || sw || se) {
      rx = nw || sw ? 64 : 16;
      ry = nw || ne ? 48 : 0;
    }
  }
  return {
    label: rx === 80 ? "Asphalt fill" : "Curb join",
    rect: [bx + rx, by + ry, 16, 16],
    x: x * 16,
    y: y * 16,
    role: rx === 80 ? "road" : "curb",
  };
}

/** Every piece is original PNG art, including paint. No rotated curbs, CSS surfaces,
 * random fills, or independent lab-only tiling. Coordinates are native world pixels.
 */
export function composeCitySurface(c: CitySurfaceCase): SurfacePiece[] {
  if (c.geometry) return composeCityGeometry(c);
  const pieces: SurfacePiece[] = [];
  const [bx, by] = bank(c.palette);
  const add = (
    label: string,
    rx: number,
    ry: number,
    w: number,
    h: number,
    x: number,
    y: number,
    role: SurfacePiece["role"],
  ) => pieces.push({ label, rect: [bx + rx, by + ry, w, h], x, y, role });
  const road = (x: number, y: number) => citySurfaceRoadAt(c, x, y);
  for (let y = 0; y < SURFACE_ROWS; y++)
    for (let x = 0; x < SURFACE_COLS; x++) pieces.push(citySurfaceTileAt(c.palette, x, y, road));
  const top = 12 - c.roadWidth / 2,
    bottom = 12 + c.roadWidth / 2;
  const left = 16 - c.roadWidth / 2,
    right = 16 + c.roadWidth / 2;
  const horizontalCrossing = (x: number) => {
    for (let y = top + 1; y < bottom - 1; y++)
      add("Crosswalk · across horizontal road", 64, 80, 32, 16, x * 16, y * 16, "paint");
  };
  const verticalCrossing = (y: number) => {
    for (let x = left + 1; x < right - 1; x++)
      add("Crosswalk · across vertical road", 16, 112, 16, 32, x * 16, y * 16, "paint");
  };
  if (c.layout === "boulevard") {
    // The rounded 32px island is authored separately from the rectangular bank.
    // Repeat only its middle; retain each original end cap and south curb shadow.
    for (let x = 9; x < 23; x++)
      add(
        "Raised median",
        x === 9 ? 224 : x === 22 ? 272 : 240,
        96,
        16,
        32,
        x * 16,
        11 * 16,
        "median",
      );
    if (c.medianApproach === "guided") {
      for (const x of [0, 2, 4, 6, 8, 23, 25, 27, 29, 31])
        add("Median centerline approach", 32, 64, 16, 16, x * 16, 12 * 16 - 8, "paint");
    }
  } else if (c.roadWidth >= 6) {
    for (let x = 0; x < SURFACE_COLS; x += 2)
      if (
        c.layout !== "vertical" &&
        (c.layout === "straight" || x < left - 2 || (c.layout !== "corner" && x >= right + 2))
      )
        add("Dashed center line · horizontal", 32, 64, 16, 16, x * 16, 12 * 16 - 8, "paint");
    if (["vertical", "corner", "tee", "cross"].includes(c.layout))
      for (let y = 0; y < SURFACE_ROWS; y += 2)
        if (c.layout === "vertical" || y >= bottom + 2 || (c.layout === "cross" && y < top - 2))
          add("Dashed center line · vertical", 16, 80, 16, 16, 16 * 16 - 8, y * 16, "paint");
    if (c.layout === "straight") horizontalCrossing(8);
    if (c.layout === "vertical") verticalCrossing(6);
    if (c.layout === "cross" || c.layout === "tee") {
      horizontalCrossing(left - 3);
      horizontalCrossing(right + 1);
      verticalCrossing(bottom + 1);
      if (c.layout === "cross") verticalCrossing(top - 3);
    }
  }
  return pieces;
}
export function citySurfaceComposition(c: CitySurfaceCase) {
  return {
    source: CITY_SURFACE_SOURCE,
    columns: SURFACE_COLS,
    rows: SURFACE_ROWS,
    case: c,
    ...(c.geometry ? { geometry: cityGeometryPlan(c) } : {}),
    pieces: composeCitySurface(c),
  };
}

/** Rounded pavement corners span the pavement cell, both adjoining road-edge
 * cells and the diagonal road cell. Keep all four native clips together so
 * the curve and its south shadow join the straight curbs on each side.
 */
export function cityRoundedCornerPatches(road: (x: number, y: number) => boolean) {
  const patches: SurfacePiece[] = [];
  for (let y = 0; y < SURFACE_ROWS; y++)
    for (let x = 0; x < SURFACE_COLS; x++) {
      if (!road(x, y) || !road(x - 1, y) || !road(x + 1, y) || !road(x, y - 1) || !road(x, y + 1))
        continue;
      for (const [dx, dy, sx, sy] of [
        [-1, -1, 192, 1952],
        [1, -1, 144, 1952],
        [-1, 1, 192, 1904],
        [1, 1, 144, 1904],
      ] as const) {
        if (road(x + dx, y + dy)) continue;
        patches.push({
          label: "Rounded pavement corner",
          rect: [sx, sy, 32, 32],
          x: (x + Math.min(0, dx)) * 16,
          y: (y + Math.min(0, dy)) * 16,
          role: "curb",
        });
      }
    }
  return patches;
}

/** Source audit: native 32×32 pavement corners (144/192,1904/1952), island
 * caps/middle (224/240/272,2000), crossing entry (64,1968), and marked 80×32
 * bays (16,2048). Clips keep authored orientation, scale and south shadows.
 * The v1 lookup and its frozen consumers never call this composition. */
function composeCityGeometry(c: CitySurfaceCase): SurfacePiece[] {
  const pieces: SurfacePiece[] = [],
    plan = cityGeometryPlan(c);
  const road = (x: number, y: number) => citySurfaceRoadAt(c, x, y);
  const corners = cityRoundedCornerPatches(road);
  const add = (
    label: string,
    rect: SurfaceRect,
    x: number,
    y: number,
    role: SurfacePiece["role"],
  ) => pieces.push({ label, rect, x, y, role });
  for (let y = 0; y < SURFACE_ROWS; y++)
    for (let x = 0; x < SURFACE_COLS; x++) {
      const p = citySurfaceTileAt("neutral", x, y, road);
      const corner = corners.find(
        (c) => x * 16 >= c.x && x * 16 < c.x + 32 && y * 16 >= c.y && y * 16 < c.y + 32,
      );
      if (corner) {
        p.rect = [corner.rect[0] + x * 16 - corner.x, corner.rect[1] + y * 16 - corner.y, 16, 16];
        p.label = corner.label;
        p.role = "curb";
      }
      pieces.push(p);
    }
  for (const island of plan.islands)
    for (let x = island.minX; x < island.maxX; x += 16) {
      if (plan.refuge && x >= plan.refuge.minX && x < plan.refuge.maxX) {
        for (let y = island.minY; y < island.maxY; y += 16) {
          const p = citySurfaceTileAt("neutral", x / 16, y / 16, () => false);
          pieces.push({ ...p, label: "Open refuge landing", role: "median" });
        }
      } else
        add(
          "Capped pedestrian island",
          [x === island.minX ? 224 : x === island.maxX - 16 ? 272 : 240, 2000, 16, 32],
          x,
          island.minY,
          "median",
        );
    }
  for (const crossing of plan.crossings) {
    // Keep the south-facing curb shadow; paint only its road-side half.
    add("Crossing entry at sidewalk", [64, 1968, 32, 16], crossing.x, crossing.top, "paint");
    for (let y = crossing.top + 16; y < crossing.bottom - 16; y += 16) {
      if (plan.refuge && y >= plan.refuge.minY && y < plan.refuge.maxY) continue;
      add("Zebra crossing", [64, 1984, 32, 16], crossing.x, y, "paint");
    }
    add("Crossing exit at sidewalk", [64, 1984, 32, 8], crossing.x, crossing.bottom - 16, "paint");
  }
  for (const bay of plan.parking)
    add("Marked curbside parking bay", [16, 2048, 80, 32], bay.minX, bay.minY, "paint");
  if (c.geometry !== "rounded")
    for (let x = 0; x < SURFACE_COLS; x += 2) {
      if (c.geometry === "refuge" && x >= 5 && x < 27) continue;
      if (plan.crossings.some((p) => x * 16 >= p.x - 32 && x * 16 < p.x + p.width + 32)) continue;
      add(
        "Dashed lane divider",
        [32, 1968, 16, 16],
        x * 16,
        (c.geometry === "parking" ? 13 : 12) * 16 - 8,
        "paint",
      );
    }
  return pieces;
}
