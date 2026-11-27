import type { OverviewResult } from "../generation/Overview.js";
export function drawDestinations(
  ctx: CanvasRenderingContext2D,
  result: OverviewResult,
  sx: (x: number) => number,
  sy: (y: number) => number,
  width: number,
  height: number,
  zoom: number,
  placed: { x: number; y: number; width: number }[],
) {
  for (const place of result.outings ?? []) {
    const x = sx(place.arrival.x),
      y = sy(place.arrival.y);
    if (x < -12 || y < -12 || x > width + 12 || y > height + 12) continue;
    ctx.font = "16px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      {
        salvage: "⚙️",
        cemetery: "🪦",
        hospital: "🏥",
        clinic: "⚕️",
        post: "✉️",
        "postal-depot": "📦",
        fire: "🚒",
        school: "🏫",
        nursery: "🌷",
        camp: "⛺",
        garden: "🌳",
        play: "🛝",
        beach: "⛱️",
      }[place.kind],
      x,
      y,
    );
  }
  // Depot markers remain visible independently of the road overlay. Their
  // data comes from the exact same admitted infield plan as real generation.
  for (const depot of [...(result.vehicleDepots ?? []), ...(result.constructionYards ?? [])]) {
    const x = sx(depot.center.x),
      y = sy(depot.center.y);
    if (x < -120 || x > width + 120 || y < -24 || y > height + 24) continue;
    ctx.fillStyle = "#ed942d";
    ctx.strokeStyle = "#503b27";
    ctx.lineWidth = 1.5;
    ctx.fillRect(x - 11, y - 5, 15, 9);
    ctx.strokeRect(x - 11, y - 5, 15, 9);
    ctx.fillRect(x + 4, y - 9, 8, 13);
    ctx.strokeRect(x + 4, y - 9, 8, 13);
    ctx.fillStyle = "#293e44";
    ctx.fillRect(x + 6, y - 7, 4, 4);
    for (const dx of [-7, 8]) {
      ctx.beginPath();
      ctx.arc(x + dx, y + 5, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const label = depot.name;
    ctx.font = "600 11px system-ui";
    const w = ctx.measureText(label).width + 12;
    const labelY = y + 36 * zoom + 14;
    ctx.fillStyle = "#fff4deee";
    ctx.beginPath();
    ctx.roundRect(x - w / 2, labelY - 10, w, 20, 4);
    ctx.fill();
    ctx.fillStyle = "#684522";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, labelY);
    placed.push({ x, y: labelY, width: w });
  }
}
