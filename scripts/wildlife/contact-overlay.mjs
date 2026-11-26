import { Vector3 } from "three";

const views = ["Side elevation", "Footprint facing down", "Footprint facing right"];
const fmt = (n) => n.toFixed(2);
const escapeText = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const stroke = { current: "#087d62", previous: "#b45125" };

function project(p, view) {
  if (view === 0) return [p.y, -p.z, p.x];
  if (view === 1) return [p.x, p.y, p.z];
  return [p.y, -p.x, p.z];
}

function rectangle(box, side) {
  return side ? [box.top, -box.height, box.bottom, 0] : [box.left, box.top, box.right, box.bottom];
}

function label(x, y, text, size, bold = false) {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${bold ? 700 : 400}">${escapeText(text)}</text>`;
}

/** Orthographic geometry inspection at the in-game top-down model scale. */
export function contactOverlay(name, faces, current, previous) {
  const boxes = previous ? [previous, current] : [current];
  const panels = views.map((_, view) => {
    const triangles = faces.map(({ points, rgb }) => {
      const normal = new Vector3()
        .crossVectors(
          new Vector3().subVectors(points[1], points[0]),
          new Vector3().subVectors(points[2], points[0]),
        )
        .normalize();
      const shade = 0.87 + 0.13 * normal.dot(new Vector3(-0.3, -0.3, 0.9));
      return {
        points: points.map((p) => project(p, view)),
        rgb: rgb.map((c) => Math.round(c * shade)),
      };
    });
    const xs = [],
      ys = [];
    for (const { points } of triangles)
      for (const [x, y] of points) {
        xs.push(x);
        ys.push(y);
      }
    for (const box of boxes) {
      const [x, y, r, b] = rectangle(box, view === 0);
      xs.push(x, r);
      ys.push(y, b);
    }
    const xMin = Math.min(...xs),
      xMax = Math.max(...xs),
      yMin = Math.min(...ys),
      yMax = Math.max(...ys);
    return {
      triangles,
      xMid: (xMin + xMax) / 2,
      yMid: (yMin + yMax) / 2,
      zoom: Math.min(310 / (xMax - xMin), 185 / (yMax - yMin)),
    };
  });
  const zoom = Math.min(...panels.map((p) => p.zoom));
  const pieces = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="398" viewBox="0 0 1120 398"><rect width="1120" height="398" fill="#faf8f2"/><g fill="#24312c" font-family="Arial, sans-serif">',
  ];
  pieces.push(
    label(30, 42, `${name} · landing surface`, 29, true),
    label(30, 72, "Idle pose at the top-down game scale. All three views use the same scale.", 17),
  );
  panels.forEach(({ triangles, xMid, yMid }, view) => {
    const left = 30 + 368 * view;
    const sx = (x) => fmt(left + 162 + (x - xMid) * zoom),
      sy = (y) => fmt(234 + (y - yMid) * zoom);
    pieces.push(label(left, 113, views[view], 19, true));
    triangles.sort(
      (a, b) => a.points.reduce((s, p) => s + p[2], 0) - b.points.reduce((s, p) => s + p[2], 0),
    );
    for (const t of triangles) {
      const pts = t.points.map(([x, y]) => `${sx(x)},${sy(y)}`).join(" ");
      const color = `rgb(${t.rgb.join(",")})`;
      pieces.push(
        `<polygon points="${pts}" fill="${color}" stroke="${color}" stroke-width="0.4"/>`,
      );
    }
    for (const box of boxes) {
      const [x, y, r, b] = rectangle(box, view === 0);
      const old = box === previous;
      pieces.push(
        `<rect x="${sx(x)}" y="${sy(y)}" width="${fmt((r - x) * zoom)}" height="${fmt((b - y) * zoom)}" fill="none" stroke="${old ? stroke.previous : stroke.current}" stroke-width="2.5" ${old ? 'stroke-dasharray="6 4"' : ""}/>`,
      );
    }
  });
  let x = 30;
  for (const box of boxes) {
    const old = box === previous;
    pieces.push(
      `<path d="M ${x} 367 h 34" stroke="${old ? stroke.previous : stroke.current}" stroke-width="3" ${old ? 'stroke-dasharray="6 4"' : ""}/>`,
    );
    pieces.push(
      label(
        x + 44,
        373,
        `${old ? "Previous box" : "Current box"}   ${box.right - box.left} × ${box.bottom - box.top} × ${box.height} px`,
        17,
      ),
    );
    x += 370;
  }
  pieces.push("</g></svg>");
  return pieces.join("\n");
}
