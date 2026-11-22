// Draw the original farm sprites directly on their native pixel grids.
import { writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const destination = new URL("../../../public/assets/farming/", import.meta.url);
const outline = "3c2931", foot = "dc963b", gold = "ffcb5d", beak = "ffd26c";
const red = "d13e36", redLight = "fa6250", dark = "251d29";
const brown = "9b4533", breast = "c26438", hackle = "e99546", light = "ffd283";
const tail = "275353", tailLight = "417d72", wing = "b65339";

function canvas(sheet, size, col, row, mirrored = false) {
  const ox = col * size, oy = row * size;
  function pixel(x, y, color) {
    const i = ((oy + y) * sheet.width + ox + (mirrored ? size - 1 - x : x)) * 4;
    sheet.data[i] = Number.parseInt(color.slice(0, 2), 16);
    sheet.data[i + 1] = Number.parseInt(color.slice(2, 4), 16);
    sheet.data[i + 2] = Number.parseInt(color.slice(4, 6), 16);
    sheet.data[i + 3] = 255;
  }
  function rect(x, y, width, height, color) {
    for (let j = y; j < y + height; j++)
      for (let i = x; i < x + width; i++) pixel(i, j, color);
  }
  function poly(points, color) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let inside = false;
        for (let a = 0, b = points.length - 1; a < points.length; b = a++) {
          const [ax, ay] = points[a], [bx, by] = points[b];
          if ((ay > y + 0.5) !== (by > y + 0.5) &&
              x + 0.5 < (bx - ax) * (y + 0.5 - ay) / (by - ay) + ax)
            inside = !inside;
        }
        if (inside) pixel(x, y, color);
      }
    }
  }
  return { rect, poly };
}

function feet(draw, left, right, frame, line) {
  const offsets = [[0, 0], [-1, 1], [-1, 0], [1, -1], [0, -1]];
  const [a, b] = offsets[frame] ?? offsets[0];
  draw.rect(left + a, line - 2, 1, 3, foot);
  draw.rect(left + a, line, 2, 1, gold);
  draw.rect(right + b, line - 2, 1, 3, foot);
  draw.rect(right + b, line, 2, 1, gold);
}

function roosterSide(draw, frame) {
  const { poly, rect } = draw;
  const neck = [0, 1, 0, 1, 0, -1, 2][frame];
  feet(draw, 13, 17, frame, 25);
  poly([[3,16],[3,11],[5,8],[10,7],[13,10],[14,13],[18,13],[19,22],[12,23],[8,20]], outline);
  poly([[4,16],[4,11],[6,9],[10,8],[12,11],[12,16],[16,19],[11,21],[8,19],[8,14],[6,11]], tail);
  poly([[4,12],[6,9],[10,8],[12,10],[11,11],[8,10],[6,10],[5,13]], tailLight);
  poly([[8,15],[15,12],[22,13],[24,17],[23,21],[19,23],[12,23],[9,21],[7,18]], outline);
  poly([[8,17],[11,15],[16,14],[21,14],[23,17],[22,21],[19,22],[12,22],[9,20]], brown);
  poly([[10,16],[16,15],[20,17],[18,20],[13,21],[10,20]], wing);
  poly([[11,17],[16,16],[19,17],[16,19],[13,19]], breast);
  rect(13, 17, 3, 1, hackle);
  poly([[17,18],[17,12+neck],[18,8+neck],[22,7+neck],[25,9+neck],[25,13+neck],[23,14+neck],[22,20],[19,22]], outline);
  poly([[18,18],[18,12+neck],[19,9+neck],[22,8+neck],[24,9+neck],[24,13+neck],[22,14+neck],[21,19],[19,21]], hackle);
  poly([[19,11+neck],[20,9+neck],[23,9+neck],[23,12+neck],[21,14+neck],[20,18],[19,16]], light);
  poly([[17,9+neck],[17,6+neck],[18,5+neck],[20,6+neck],[21,4+neck],[23,5+neck],[23,6+neck],[25,5+neck],[25,8+neck],[23,9+neck]], outline);
  poly([[18,7+neck],[18,6+neck],[20,7+neck],[21,5+neck],[22,5+neck],[23,7+neck],[24,6+neck],[24,8+neck],[19,9+neck]], red);
  rect(21, 6+neck, 1, 1, redLight);
  rect(22, 10+neck, 1, 1, dark);
  poly([[24,10+neck],[28,11+neck],[27,13+neck],[24,13+neck]], outline);
  rect(24, 11+neck, 3, 1, beak);
  rect(23, 13+neck, 2, 2, red);
}

function roosterFront(draw, frame, back) {
  const { poly, rect } = draw;
  const n = [0, 1, 0, 1, 0, -1, 2][frame];
  feet(draw, 12, 18, frame, 25);
  poly([[8,14],[12,11],[20,11],[24,14],[24,21],[21,24],[11,24],[8,21]], outline);
  poly([[9,15],[13,12],[19,12],[23,15],[23,21],[20,23],[12,23],[9,21]], back ? brown : breast);
  poly([[9,15],[12,14],[13,18],[12,22],[9,20]], back ? wing : brown);
  poly([[23,15],[20,14],[19,18],[20,22],[23,20]], back ? wing : brown);
  poly([[12,9+n],[14,7+n],[18,7+n],[20,9+n],[21,14+n],[20,18],[17,21],[14,20],[11,17],[11,13+n]], outline);
  poly([[13,9+n],[15,8+n],[18,8+n],[19,10+n],[20,14+n],[19,18],[16,20],[14,19],[12,16],[12,13+n]], hackle);
  rect(14, 9+n, 4, 2, light);
  poly([[12,8+n],[12,6+n],[14,5+n],[15,6+n],[16,4+n],[18,5+n],[18,6+n],[20,5+n],[20,8+n],[18,9+n],[14,9+n]], outline);
  poly([[13,7+n],[14,6+n],[15,7+n],[16,5+n],[17,5+n],[18,7+n],[19,6+n],[19,8+n],[13,8+n]], red);
  rect(16, 5+n, 1, 1, redLight);
  if (back) {
    poly([[11,23],[9,19],[9,15],[11,12],[16,10],[21,12],[23,15],[22,19],[20,23]], outline);
    poly([[12,22],[10,18],[11,14],[16,11],[21,14],[22,17],[19,22]], tail);
    poly([[12,18],[12,14],[16,12],[20,14],[18,15],[16,14],[14,15],[13,19]], tailLight);
  } else {
    rect(13, 11+n, 1, 1, dark);
    rect(18, 11+n, 1, 1, dark);
    rect(15, 12+n, 3, 2, beak);
    rect(15, 14+n, 2, 2, red);
  }
}

function chick(draw, frame, view) {
  const { poly, rect } = draw;
  const bob = [0, 1, 0, 1, 0, 0, 2][frame];
  const side = view >= 2;
  feet(draw, 13, 17, frame, 25);
  poly([[9,20],[11,17],[15,16],[20,18],[22,21],[20,24],[12,24],[9,22]], outline);
  poly([[10,20],[12,18],[15,17],[20,19],[21,21],[19,23],[12,23],[10,22]], "edac37");
  poly([[11,20],[13,18],[16,19],[17,21],[14,22],[11,21]], gold);
  const x = side ? 3 : 0;
  poly([[11+x,15+bob],[13+x,13+bob],[16+x,13+bob],[17+x,12+bob],[19+x,14+bob],[20+x,17+bob],[19+x,20+bob],[13+x,20+bob],[11+x,18+bob]], outline);
  poly([[12+x,15+bob],[14+x,14+bob],[17+x,14+bob],[18+x,15+bob],[19+x,17+bob],[18+x,19+bob],[13+x,19+bob],[12+x,17+bob]], gold);
  rect(14+x, 15+bob, 3, 1, "ffe38a");
  if (side) {
    rect(17+x, 16+bob, 1, 1, dark);
    rect(19+x, 17+bob, 2, 1, foot);
  } else if (view === 0) {
    rect(13, 16+bob, 1, 1, dark);
    rect(18, 16+bob, 1, 1, dark);
    rect(15, 17+bob, 3, 1, foot);
  } else rect(14, 19+bob, 3, 1, "edac37");
}

for (const [name, draw] of [
  ["rooster", (surface, frame, row) => row < 2 ? roosterFront(surface, frame, row === 1) : roosterSide(surface, frame)],
  ["chick", chick],
]) {
  const sheet = new PNG({ width: 7 * 32, height: 4 * 32 });
  for (let row = 0; row < 4; row++)
    for (let frame = 0; frame < 7; frame++) draw(canvas(sheet, 32, frame, row, row === 2), frame, row);
  writeFileSync(new URL(`${name}-v1.png`, destination), PNG.sync.write(sheet));
}

const egg = new PNG({ width: 3 * 16, height: 16 });
for (let frame = 0; frame < 3; frame++) {
  const { rect, poly } = canvas(egg, 16, frame, 0);
  poly([[1,12],[3,10],[6,10],[7,9],[10,10],[13,10],[15,12],[13,15],[3,15]], "765538");
  poly([[2,12],[5,11],[7,12],[10,11],[13,12],[14,13],[12,14],[4,14]], "b1854b");
  rect(3, 12, 4, 1, "d5aa62");
  rect(9, 13, 4, 1, "d5aa62");
  if (frame === 2) {
    poly([[3,9],[5,11],[6,9],[8,11],[7,13],[4,13]], outline);
    poly([[4,10],[5,12],[6,10],[7,11],[6,12],[4,12]], "ffecd0");
    poly([[9,10],[10,11],[12,9],[13,11],[12,13],[9,13]], outline);
    rect(10, 11, 2, 1, "ffdf9d");
  } else {
    poly([[4,9],[6,5],[8,4],[10,5],[12,9],[12,11],[10,13],[6,13],[4,11]], outline);
    poly([[5,9],[7,6],[8,5],[10,6],[11,9],[11,11],[10,12],[6,12],[5,11]], frame === 1 ? "fbd99d" : "e8c7a0");
    rect(7, 7, 2, 2, "fff2d2");
    rect(8, 11, 2, 1, "db9f64");
    if (frame === 1) rect(9, 9, 1, 1, "d88955");
  }
}
writeFileSync(new URL("egg-v1.png", destination), PNG.sync.write(egg));
