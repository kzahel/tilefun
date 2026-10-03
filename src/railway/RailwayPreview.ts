import { required } from "../art/ArtCatalog.js";
import { reviewContext2D } from "../art/reviewCanvas.js";
import source from "./RailwaySource.json" with { type: "json" };

export const RAIL_SOURCE = source;
export type TrainColor = "Blue" | "Green" | "Orange" | "Grey" | "White";
export type RailDirection = "east" | "west" | "north" | "south";
export type RailScene =
  | "motion"
  | "patterns"
  | "corners"
  | "junction-art"
  | "through"
  | "terminal"
  | "hub"
  | "network"
  | "bend"
  | "crossover"
  | "bridge"
  | "tunnel";
export interface RailwayCase {
  id: string;
  name: string;
  batch: "rail-patterns" | "rail-trains" | "rail-plans" | "rail-structures";
  scene: RailScene;
  prompt: string;
  color?: TrainColor;
  direction?: RailDirection;
  railColor?: "Grey" | "Brown";
}
export const RAIL_CASES: RailwayCase[] = [
  ...(["Grey", "Brown"] as const).map((railColor) => ({
    id: `rails-${railColor.toLowerCase()}`,
    name: `${railColor} rails · repeats and paired tracks`,
    batch: "rail-patterns" as const,
    scene: "patterns" as const,
    railColor,
    prompt:
      "Inspect native horizontal/vertical repeats, seams and paired-track spacing. Rail gauge is 32 pixels; orange guides show 16-pixel source cells, not collision bounds.",
  })),
  {
    id: "corners",
    name: "Rail corners · all four native bends",
    batch: "rail-patterns",
    scene: "corners",
    prompt:
      "These are the supplied 48×48 curved pieces, assembled with straight repeats. Their small radius is not yet suitable for long train cars. Review the joins and art only.",
  },
  {
    id: "junction-art",
    name: "Diagonal junction pieces · source comparison",
    batch: "rail-patterns",
    scene: "junction-art",
    prompt:
      "Native grey/brown diagonal assemblies. These are source proposals, not validated moving turnouts. Compare them with the separate crossover motion study.",
  },
  ...(["Grey", "Blue", "Green", "Orange", "White"] as const).flatMap((color) =>
    (["east", "west", "south", "north"] as const).map((direction) => ({
      id: `${color.toLowerCase()}-${direction}`,
      name: `${color === "White" ? "White express" : `${color} train`} · ${direction}`,
      batch: "rail-trains" as const,
      scene: "motion" as const,
      color,
      direction,
      prompt: `Watch the ${color.toLowerCase()} composition travel ${direction}. Check ends, couplers, rail alignment and native scale. These are source pieces joined without rotation or mirroring; reversal uses the same physical body. ${color === "Orange" ? "Orange has no audited vertical middle piece, so both axes use two end cars only." : "Three source sections form the proposed train."} Motion is a visual prototype, not train physics.`,
    })),
  ),
  {
    id: "through",
    name: "Town through station · stopping services",
    batch: "rail-plans",
    scene: "through",
    prompt:
      "Paired side platforms with town access from below and a proposed pedestrian overpass at the left. Both trains arrive, dwell at the platforms and continue in their own travel direction. Cyan blocks are proposed access structures, not finished art or collision.",
  },
  {
    id: "terminal",
    name: "Terminal · reserved crossover and return",
    batch: "rail-plans",
    scene: "terminal",
    prompt:
      "A double-ended train arrives, pauses, reverses and crosses to the outbound track. Inspect the throat and train clearance. Amber turnout rails and cyan access are diagram geometry; coupler/facing changes still need your judgment. The body is not teleported between tracks.",
  },
  {
    id: "hub",
    name: "Hub · local platforms and express pair",
    batch: "rail-plans",
    scene: "hub",
    prompt:
      "Local trains stop on the lower pair; white express trains pass on the upper pair. Cyan pedestrian access crosses above all four tracks. This is a native-scale layout proposal, not a generated station or a proven bridge.",
  },
  {
    id: "network",
    name: "Regional plan · towns, branch and express hubs",
    batch: "rail-plans",
    scene: "network",
    prompt:
      "Diagram, not a generated world: gold local pair links three towns, a branch serves a fourth, blue express tracks join the two larger hubs. Cyan crossings reserve bridge/tunnel work. Station access and route placement are proposed; no world generation changes are enabled.",
  },
  {
    id: "bend",
    name: "Long-car bend · cardinal-pose feasibility",
    batch: "rail-plans",
    scene: "bend",
    prompt:
      "An intentionally exposed feasibility test: each section follows the curve at its own distance, using only native horizontal/vertical poses. Watch the gaps, overlap and facing pop. Amber rails are proposed geometry, not finished tile art. Approving this study does not certify a production turning solution.",
  },
  {
    id: "crossover",
    name: "Shallow crossover · carriage clearance study",
    batch: "rail-plans",
    scene: "crossover",
    prompt:
      "Carriages follow a shallow lane change. With no diagonal train poses, the bodies stay cardinal; inspect the sideways sliding and coupler alignment. Amber switch rails are a schematic gap in the art kit. This is the experiment to review before an overworld terminal.",
  },
  {
    id: "bridge",
    name: "Rail bridge · deck, water and clearance proposal",
    batch: "rail-structures",
    scene: "bridge",
    prompt:
      "Native train and rails on a proposed blue-grey bridge deck over water. Deck, piers and banks are schematic placeholder geometry: this review is for layout and train clearance, not finished bridge art or underpass physics. No suitable complete rail-bridge kit has been verified.",
  },
  {
    id: "tunnel",
    name: "Tunnel portal · vertical entry and cutaway",
    batch: "rail-structures",
    scene: "tunnel",
    prompt:
      "Native double tunnel cornice over two vertical tracks. Watch trains enter/leave; cutaway exposes the hidden body. Surrounding mountain and tunnel floor are layout placeholders. Portal fit and visual hiding are reviewable; floor/ceiling collision and rider handling are not implemented.",
  },
];
export function railCase(id: string): RailwayCase {
  return required(RAIL_CASES.find((c) => c.id === id.replace(/^pattern:rail-v1-/, "")));
}
export function sprite(name: string) {
  const item = (source.sprites as Record<string, { rect: number[]; bounds: number[] }>)[name];
  if (!item) throw new Error(`Unknown railway source: ${name}`);
  return item;
}
export function trainParts(color: TrainColor, vertical: boolean) {
  const names = vertical ? ["Back", "Middle", "Front"] : ["Left", "Middle", "Right"];
  return names
    .filter((part) => color !== "Orange" || part !== "Middle")
    .map((part) => {
      const name = vertical ? `Train_${color}_${part}_Down` : `Exterior_Train_${color}_${part}`;
      const s = sprite(name),
        b = s.bounds;
      return {
        name,
        length: vertical ? required(b[3]) - required(b[1]) : required(b[2]) - required(b[0]),
      };
    });
}
export function trainLength(color: TrainColor, vertical: boolean) {
  return trainParts(color, vertical).reduce((sum, p) => sum + p.length, 0);
}
export function previewSize(c: RailwayCase) {
  return c.scene === "motion" && (c.direction === "north" || c.direction === "south")
    ? { width: 512, height: 768 }
    : c.scene === "motion"
      ? { width: 1024, height: 384 }
      : { width: 1152, height: 768 };
}
export const RAIL_MOTION_REVISION = "rail-preview-motion-v1";
export function motionPosition(
  time: number,
  direction: RailDirection,
  extent: number,
  length: number,
  speed = 64,
) {
  const distance = ((time * speed + extent / 2 + length / 2) % (extent + length)) - length / 2;
  return direction === "west" || direction === "north" ? extent - distance : distance;
}
/** Smooth rest-to-rest prototype with two-second endpoint dwell. */
export function shuttle(time: number, a: number, b: number) {
  const t = ((time % 24) + 24) % 24;
  const leg = t < 12 ? t : t - 12;
  const f = Math.min(1, Math.max(0, (leg - 2) / 8));
  const eased = f * f * (3 - 2 * f);
  return t < 12 ? a + (b - a) * eased : b - (b - a) * eased;
}
export interface RailPoint {
  x: number;
  y: number;
}
export function atDistance(points: readonly RailPoint[], distance: number) {
  if (points.length < 2) throw new Error("Rail path needs two points");
  let remaining = Math.max(0, distance);
  for (let i = 1; i < points.length; i++) {
    const a = required(points[i - 1]),
      b = required(points[i]);
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= length || i === points.length - 1) {
      const t = Math.min(1, remaining / Math.max(1, length));
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        vertical: Math.abs(b.y - a.y) > Math.abs(b.x - a.x),
      };
    }
    remaining -= length;
  }
  throw new Error("Empty rail path");
}
export function pathLength(points: readonly RailPoint[]) {
  return points
    .slice(1)
    .reduce(
      (s, p, i) => s + Math.hypot(p.x - required(points[i]).x, p.y - required(points[i]).y),
      0,
    );
}
export const CROSSOVER: RailPoint[] = [
  { x: 64, y: 420 },
  { x: 420, y: 420 },
  { x: 612, y: 300 },
  { x: 1088, y: 300 },
];
export const BEND: RailPoint[] = [
  { x: 64, y: 608 },
  { x: 560, y: 608 },
  ...Array.from({ length: 17 }, (_, i) => {
    const angle = ((Math.PI / 2) * i) / 16;
    return { x: 560 + Math.sin(angle) * 208, y: 400 + Math.cos(angle) * 208 };
  }),
  { x: 768, y: 48 },
];

export function drawRailway(
  canvas: HTMLCanvasElement,
  image: CanvasImageSource,
  c: RailwayCase,
  time = 0,
  geometry = false,
  cutaway = false,
) {
  const size = previewSize(c);
  if (canvas.width !== size.width) canvas.width = size.width;
  if (canvas.height !== size.height) canvas.height = size.height;
  const ctx = reviewContext2D(canvas);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#a7b391";
  ctx.fillRect(0, 0, size.width, size.height);
  const box = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const piece = (name: string, x: number, y: number, trimmed = false) => {
    const s = sprite(name),
      r = s.rect,
      b = s.bounds;
    const sx = required(r[0]) + (trimmed ? required(b[0]) : 0),
      sy = required(r[1]) + (trimmed ? required(b[1]) : 0);
    const w = trimmed ? required(b[2]) - required(b[0]) : required(r[2]);
    const h = trimmed ? required(b[3]) - required(b[1]) : required(r[3]);
    ctx.drawImage(image, sx, sy, w, h, Math.round(x), Math.round(y), w, h);
  };
  const rail = (x: number, y: number, length: number, vertical = false, color = "Grey") => {
    box(
      x - (vertical ? 22 : 0),
      y - (vertical ? 0 : 22),
      vertical ? 44 : length,
      vertical ? length : 44,
      "#777d77",
    );
    for (let n = 0; n < length; n += 16)
      piece(
        `${color}_Rail_Modular_${vertical ? "Vertical" : "Horizontal"}`,
        x + (vertical ? -16 : n),
        y + (vertical ? n : -16),
      );
  };
  const train = (color: TrainColor, x: number, y: number, vertical = false) => {
    const parts = trainParts(color, vertical);
    let offset = -trainLength(color, vertical) / 2;
    for (const p of parts) {
      const b = sprite(p.name).bounds,
        w = required(b[2]) - required(b[0]),
        h = required(b[3]) - required(b[1]);
      piece(p.name, vertical ? x - w / 2 : x + offset, vertical ? y + offset : y - h + 15, true);
      if (geometry) {
        ctx.strokeStyle = "#ffef80";
        ctx.lineWidth = 1;
        ctx.strokeRect(
          vertical ? x - 16 : x + offset,
          vertical ? y + offset : y - 12,
          vertical ? 32 : p.length,
          vertical ? p.length : 24,
        );
      }
      offset += p.length;
    }
  };
  const platform = (x: number, y: number, length: number) => {
    box(x, y, length, 48, "#b9b9b3");
    for (let n = 0; n < length; n += 16) {
      box(x + n, y, 1, 48, "#9b9d98");
      piece("Binary_Edge_Middle_Modular_Horizontal_Up_1", x + n, y);
    }
    for (let n = 64; n < length - 48; n += 192)
      piece("Three_Seats_Grey_Bench_Frontal_1", x + n, y + 14);
  };
  const access = (x: number, top: number, bottom: number) => {
    box(x, top, 40, bottom - top, "#436d7c");
    box(x + 6, top, 28, bottom - top, "#a6d3d5");
    for (let y = top; y < top + 48; y += 8) box(x + 6, y, 28, 2, "#436d7c");
    for (let y = bottom - 48; y < bottom; y += 8) box(x + 6, y, 28, 2, "#436d7c");
  };
  const diagramPath = (points: readonly RailPoint[], color = "#dfb466", width = 4) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    points.forEach((p, i) => {
      if (i) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    });
    ctx.stroke();
  };
  const onPath = (path: RailPoint[], t: number) => {
    const total = pathLength(path),
      parts = trainParts("Grey", false),
      length = trainLength("Grey", false);
    const head = shuttle(t, length + 24, total - 24);
    let offset = 0;
    for (const p of [...parts].reverse()) {
      const at = atDistance(path, head - offset - p.length / 2);
      const name = at.vertical
        ? p.name
            .replace("Exterior_Train_Grey_", "Train_Grey_")
            .replace("Left", "Front_Down")
            .replace("Middle", "Middle_Down")
            .replace("Right", "Back_Down")
        : p.name;
      const b = sprite(name).bounds,
        w = required(b[2]) - required(b[0]),
        h = required(b[3]) - required(b[1]);
      piece(name, at.x - w / 2, at.vertical ? at.y - h / 2 : at.y - h + 15, true);
      if (geometry) {
        ctx.strokeStyle = "#ffe783";
        ctx.strokeRect(at.x - w / 2, at.y - h / 2, w, h);
      }
      offset += p.length;
    }
  };
  if (c.scene === "motion") {
    const vertical = c.direction === "north" || c.direction === "south";
    const pos = motionPosition(
      time,
      c.direction ?? "east",
      vertical ? size.height : size.width,
      trainLength(c.color ?? "Grey", vertical),
    );
    rail(
      vertical ? size.width / 2 : 0,
      vertical ? 0 : size.height / 2,
      vertical ? size.height : size.width,
      vertical,
    );
    train(
      c.color ?? "Grey",
      vertical ? size.width / 2 : pos,
      vertical ? pos : size.height / 2,
      vertical,
    );
  } else if (c.scene === "patterns") {
    for (const y of [160, 320, 416]) rail(64, y, 608, false, c.railColor);
    for (const x of [816, 960]) rail(x, 64, 640, true, c.railColor);
  } else if (c.scene === "corners") {
    const corners = ["Left_Up", "Right_Up", "Left_Bottom", "Right_Bottom"];
    corners.forEach((name, i) => {
      const x = 160 + (i % 2) * 544,
        y = 160 + Math.floor(i / 2) * 352;
      const left = name.startsWith("Left"),
        up = name.endsWith("Up");
      // Native corner endpoints: left/right vertical rail centered 16/32,
      // upper/lower horizontal rail centered 16/32 within the 48px crop.
      rail(left ? x + 48 : x - 128, y + (up ? 16 : 32), 128);
      rail(x + (left ? 16 : 32), up ? y + 48 : y - 96, 96, true);
      piece(`Grey_Rail_${name}_Corner`, x, y);
    });
  } else if (c.scene === "junction-art") {
    for (const [i, color] of ["Grey", "Brown"].entries())
      for (const [j, side] of ["Left", "Right"].entries())
        piece(`${color}_Rail_Horizontal_Crossed_${side}`, 240 + j * 480, 144 + i * 320);
  } else if (c.scene === "bend" || c.scene === "crossover" || c.scene === "terminal") {
    const path = c.scene === "bend" ? BEND : CROSSOVER;
    if (c.scene !== "bend") {
      rail(32, 300, 1088);
      rail(32, 420, 1088);
    }
    diagramPath(path, "#6c5b40", 34);
    diagramPath(path, "#dfb466", 26);
    diagramPath(path, "#6c5b40", 20);
    if (c.scene === "terminal") {
      platform(720, 224, 400);
      platform(720, 448, 400);
      box(1110, 276, 12, 48, "#b85d45");
    }
    onPath(path, time);
    if (c.scene === "terminal") access(1000, 176, 544);
  } else if (c.scene === "through" || c.scene === "hub") {
    box(0, 624, 1152, 80, "#717b79");
    box(0, 608, 1152, 16, "#c8c7b7");
    platform(192, 300, 768);
    platform(192, 504, 768);
    rail(0, 380, 1152);
    rail(0, 472, 1152);
    const through = (t: number, length: number) => {
      const phase = ((t % 24) + 24) % 24;
      if (phase < 8) {
        const f = phase / 8;
        return -length + (576 + length) * (2 * f - f * f);
      }
      if (phase < 12) return 576;
      const f = (phase - 12) / 12;
      return 576 + (576 + length) * f * f;
    };
    train("Grey", 1152 - through(time, trainLength("Grey", false)), 380);
    train("Blue", through(time + 4, trainLength("Blue", false)), 472);
    if (c.scene === "hub") {
      rail(0, 144, 1152);
      rail(0, 236, 1152);
      train("White", motionPosition(time, "east", 1152, 352, 144), 236);
      train("White", motionPosition(time, "west", 1152, 352, 144), 144);
    }
    access(112, c.scene === "hub" ? 80 : 288, 640);
    box(152, 316, 56, 24, "#a6d3d5");
    box(152, 520, 56, 24, "#a6d3d5");
  } else if (c.scene === "bridge") {
    box(384, 0, 384, 768, "#6b9baa");
    for (const y of [304, 432]) {
      box(352, y - 52, 448, 96, "#5a6874");
      box(352, y - 40, 448, 72, "#a3b6bf");
      rail(0, y, 1152);
    }
    train("White", motionPosition(time, "east", 1152, 352, 112), 432);
    train("Grey", motionPosition(time, "west", 1152, 256), 304);
    if (geometry)
      for (const x of [384, 720]) {
        ctx.strokeStyle = "#ffef80";
        ctx.strokeRect(x, 492, 32, 112);
      }
  } else if (c.scene === "tunnel") {
    rail(528, 0, 768, true);
    rail(600, 0, 768, true);
    train("White", 600, motionPosition(time, "south", 768, trainLength("White", true)), true);
    train("Grey", 528, motionPosition(time, "north", 768, trainLength("Grey", true)), true);
    ctx.save();
    ctx.globalAlpha = cutaway ? 0.22 : 1;
    box(0, 0, 1152, 304, "#747b6d");
    ctx.restore();
    piece("High_Double_Tunnel_Cornice", 484, 284);
  } else if (c.scene === "network") {
    box(0, 360, 1152, 60, "#7eafa8");
    for (const y of [264, 288])
      diagramPath(
        [
          { x: 48, y },
          { x: 1104, y },
        ],
        "#dfb466",
        5,
      );
    for (const y of [132, 156])
      diagramPath(
        [
          { x: 48, y },
          { x: 1104, y },
        ],
        "#8bd7ed",
        5,
      );
    diagramPath(
      [
        { x: 576, y: 288 },
        { x: 736, y: 472 },
        { x: 928, y: 472 },
      ],
      "#dfb466",
      7,
    );
    for (const [x, y, w] of [
      [128, 304, 160],
      [480, 304, 160],
      [864, 304, 160],
      [864, 496, 160],
    ]) {
      box(x ?? 0, y ?? 0, w ?? 160, 88, "#c0bfad");
      box((x ?? 0) + 24, (y ?? 0) + 16, 40, 32, "#737f69");
      box((x ?? 0) + 88, (y ?? 0) + 16, 48, 48, "#737f69");
      box(x ?? 0, (y ?? 0) - 12, w ?? 160, 8, "#eddfb2");
    }
    access(160, 104, 344);
    access(912, 104, 344);
    access(592, 248, 344);
    box(640, 352, 96, 80, "#7897a6");
  }
  if (geometry) {
    ctx.strokeStyle = "#f6dc7250";
    ctx.lineWidth = 1;
    for (let x = 0; x < size.width; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size.height);
      ctx.stroke();
    }
    for (let y = 0; y < size.height; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size.width, y);
      ctx.stroke();
    }
  }
  canvas.dataset.railTime = time.toFixed(3);
  canvas.dataset.railScene = c.scene;
}
