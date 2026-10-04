const canvas = document.querySelector("#playback");
const context = canvas.getContext("2d", { willReadFrequently: true });
const status = document.querySelector("#status");
const selection = document.querySelector("#clip");
const scale = document.querySelector("#scale");
const directions = ["down", "up", "left", "right"];
const sequence = [
  ...Array(4).fill(["idle", 0]),
  ...Array.from({ length: 24 }, (_, i) => ["walk", i % 12]),
  ...Array.from({ length: 8 }, (_, i) => ["action", i]),
  ...Array(4).fill(["idle", 0]),
];
let paused = false;
let start = performance.now();
let frozen = 0;
let drawState;
async function loadImage(src) {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}
async function main() {
  const [sheet, background, person] = await Promise.all([
    loadImage("sheet.png"),
    loadImage("scene-background.png"),
    loadImage("../../../pixel-characters/person-32.png"),
  ]);
  drawState = (clip, pose) => {
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, 320, 208);
    context.drawImage(background, 0, 0);
    const column = clip === "idle" ? 0 : (clip === "walk" ? 1 : 13) + pose;
    for (let row = 0; row < directions.length; row++) {
      const x = 76 + row * 64;
      context.drawImage(person, 0, row * 32, 32, 32, x - 16, 39, 32, 32);
      context.drawImage(sheet, column * 48, row * 48, 48, 48, x - 24, 71, 48, 48);
    }
    status.textContent = `${clip} · pose ${pose + 1} · four facings · 10 fps · fixed anchor (24,36)`;
    canvas.dataset.clip = clip;
    canvas.dataset.pose = String(pose);
  };
  // Deterministic sample access for the local capture runner, not review approval.
  window.deerDraft = { draw: drawState, ready: true };
  function tick(now) {
    const elapsed = paused ? frozen : now - start;
    const frame = Math.floor(elapsed / 100);
    const clip = selection.value;
    const state =
      clip === "sequence"
        ? sequence[frame % sequence.length]
        : [clip, clip === "idle" ? 0 : frame % (clip === "action" ? 8 : 12)];
    drawState(...state);
    canvas.dataset.sequenceIndex = String(frame % sequence.length);
    canvas.dataset.cycle = String(Math.floor(frame / sequence.length));
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
document.querySelector("#pause").addEventListener("click", (event) => {
  if (!paused) frozen = performance.now() - start;
  else start = performance.now() - frozen;
  paused = !paused;
  event.target.textContent = paused ? "Resume" : "Pause";
});
document.querySelector("#reset").addEventListener("click", () => {
  start = performance.now();
  frozen = 0;
});
selection.addEventListener("change", () => {
  start = performance.now();
  frozen = 0;
});
function setScale() {
  canvas.style.width = `${320 * Number(scale.value)}px`;
  canvas.style.height = `${208 * Number(scale.value)}px`;
}
scale.addEventListener("change", setScale);
setScale();
main().catch((error) => {
  status.textContent = `Load failed: ${error.message}`;
});
