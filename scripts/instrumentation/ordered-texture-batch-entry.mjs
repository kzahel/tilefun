// Exact WebGL output qualification; draw order and source pixels never change.
import * as THREE from "three";
import { GpuRasterSurface } from "../../src/rendering/GpuRasterSurface.ts";
import { touchRaster } from "../../src/rendering/RasterSurface.ts";

const canvas = document.querySelector("canvas"),
  surface = new GpuRasterSurface(canvas);
const sources = Array.from({ length: 12 }, (_, i) => {
  const c = document.createElement("canvas");
  c.width = 16 + i;
  c.height = 19;
  const ctx = c.getContext("2d");
  ctx.fillStyle = `rgb(${23 + i * 17},${210 - i * 11},${49 + i * 13})`;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.clearRect(1, 1, 3, 3);
  ctx.fillStyle = "rgba(45,100,230,0.5)";
  ctx.fillRect(5, 3, 6, 9);
  return c;
});
const large = document.createElement("canvas");
large.width = 1031;
large.height = 23;
const lctx = large.getContext("2d");
for (let x = 0; x < large.width; x++) {
  lctx.fillStyle = `rgb(${x % 256},${(x * 3) % 256},${(x * 7) % 256})`;
  lctx.fillRect(x, 0, 1, 23);
}
const editable = document.createElement("canvas");
editable.width = editable.height = 16;
const raw = new THREE.DataTexture(
  new Uint8Array([240, 43, 80, 180, 30, 210, 170, 255, 120, 45, 220, 128, 20, 40, 60, 0]),
  2,
  2,
);
const srgb = raw.clone();
srgb.colorSpace = THREE.SRGBColorSpace;
for (const texture of [raw, srgb]) {
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
}
const target = new THREE.WebGLRenderTarget(8, 8, { depthBuffer: false });
target.texture.colorSpace = THREE.SRGBColorSpace;
target.texture.magFilter = target.texture.minFilter = THREE.NearestFilter;
target.texture.generateMipmaps = false;
surface.renderer.setRenderTarget(target);
surface.renderer.setClearColor(0x76abcd, 0.65);
surface.renderer.clear();
surface.renderer.setRenderTarget(null);
surface.renderer.setClearColor(0, 0);

function images(n, count = 12) {
  for (let i = 0; i < n; i++) {
    surface.globalAlpha = i % 3 ? 1 : 128 / 255;
    surface.drawImage(
      sources[i % count],
      ((i * 7) % 270) + 45.25,
      ((i * 11) % 230) + 65.75,
      37,
      31,
    );
  }
  surface.globalAlpha = 1;
}
const scenes = [
  ["alternating twelve sources", () => images(120)],
  ["reused three sources", () => images(120, 3)],
  [
    "raw and sRGB with translucent overlap",
    () => {
      for (let i = 0; i < 90; i++) {
        surface.globalAlpha = i % 2 ? 0.65 : 1;
        surface.drawImage(sources[i % 12], 60 + i * 2, 100 + i, 45, 45);
        surface.drawTexture([raw, srgb, target.texture][i % 3], 80 + i, 130 + i, 51, 43);
        surface.fillStyle = "#597ea9";
        surface.fillRect(110 + i, 150 + i, 14, 12);
      }
      surface.globalAlpha = 1;
    },
  ],
  [
    "nested union clips",
    () => {
      surface.save();
      surface.beginPath();
      surface.rect(50, 80, 180, 190);
      surface.rect(100, 160, 190, 180);
      surface.clip();
      images(90);
      surface.save();
      surface.beginPath();
      surface.rect(180, 90, 90, 280);
      surface.clip();
      images(70, 4);
      surface.restore();
      images(30, 3);
      surface.restore();
    },
  ],
  ["capacity and partial final batch", () => images(4101, 2)],
  [
    "mutable source upload barrier",
    () => {
      const ctx = editable.getContext("2d");
      ctx.clearRect(0, 0, 16, 16);
      ctx.fillStyle = "#d04070";
      ctx.fillRect(0, 0, 16, 16);
      touchRaster(editable);
      images(3, 3);
      surface.drawImage(editable, 90, 100, 130, 110);
      images(3, 3);
      ctx.clearRect(0, 0, 16, 16);
      ctx.fillStyle = "#2ac879";
      ctx.fillRect(2, 2, 14, 14);
      touchRaster(editable);
      surface.drawImage(editable, 140, 160, 130, 110);
      images(3, 3);
    },
  ],
  [
    "page seam, flips and transforms",
    () => {
      surface.save();
      surface.translate(300.25, 190.75);
      surface.rotate(0.37);
      surface.scale(-1.3, 1.7);
      for (let i = 0; i < 12; i++) {
        surface.drawImage(large, 1010, 0, 21, 23, -40 + i * 3, -30 + i * 4, 63, 69);
        surface.drawImage(sources[i], -60 + i * 7, -60 + i * 5, 38, 27);
      }
      surface.restore();
    },
  ],
  [
    "resource reset and recovery",
    () => {
      images(20, 3);
      surface.flush();
      surface.clearResources();
      surface.recover();
      surface.beginFrame();
      images(45);
    },
  ],
  [
    "batch limit change drains pending quads",
    () => {
      images(35, 3);
      surface.setBatchTextureLimit(2);
      images(35, 3);
    },
  ],
];
function render(draw, limit) {
  surface.setBatchTextureLimit(limit);
  surface.beginFrame();
  surface.globalAlpha = 1;
  surface.fillStyle = "#596d7d";
  surface.fillRect(0, 0, 512, 512);
  draw();
  surface.flush();
  const gl = surface.renderer.getContext(),
    pixels = new Uint8Array(512 * 512 * 4);
  gl.readPixels(0, 0, 512, 512, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  if (gl.getError()) throw Error("GL error");
  return pixels;
}
window.run = async () => {
  let pairs = 0,
    totalMismatchingPixels = 0,
    maxChannelError = 0;
  const comparisons = [];
  try {
    for (const [name, draw] of scenes)
      for (const limit of [4, 8]) {
        render(draw, 1); // Warm source pages; these counts characterize steady submission.
        const before = surface.stats.drawCalls,
          reference = render(draw, 1),
          baselineDraws = surface.stats.drawCalls - before;
        const start = surface.stats.drawCalls,
          actual = render(draw, limit),
          batchedDraws = surface.stats.drawCalls - start;
        let mismatches = 0;
        for (let i = 0; i < actual.length; i += 4) {
          let wrong = false;
          for (let c = 0; c < 4; c++) {
            const delta = Math.abs(actual[i + c] - reference[i + c]);
            maxChannelError = Math.max(maxChannelError, delta);
            wrong ||= delta !== 0;
          }
          if (wrong) mismatches++;
        }
        totalMismatchingPixels += mismatches;
        pairs++;
        comparisons.push({ name, limit, baselineDraws, batchedDraws, mismatches });
      }
    return {
      pairs,
      totalMismatchingPixels,
      maxChannelError,
      comparisons,
      rows: [],
      preview: canvas.toDataURL(),
    };
  } finally {
    raw.dispose();
    srgb.dispose();
    target.dispose();
    surface.dispose();
  }
};
