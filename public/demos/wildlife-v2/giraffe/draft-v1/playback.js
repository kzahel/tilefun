// Fresh giraffe-draft-v1: 16-pose gait and 8-pose tail/ear action.
const metadata = await fetch("sprite.json").then((response) => response.json());
const load = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
const [sheet, background, explorer] = await Promise.all([
  load("sheet.png"),
  load("scene-background.png"),
  load("../../../pixel-characters/person-32.png"),
]);
const canvas = document.querySelector("#playback");
const sprites = document.querySelector("#sprites");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const spriteCtx = sprites.getContext("2d", { willReadFrequently: true });
ctx.imageSmoothingEnabled = false;
spriteCtx.imageSmoothingEnabled = false;
const sequence = [
  ...Array.from({ length: 3 }, () => ["idle", 0]),
  ...Array.from({ length: 32 }, (_, i) => ["walk", i % 16]),
  ...Array.from({ length: 8 }, (_, i) => ["action", i]),
  ...Array.from({ length: 3 }, () => ["idle", 0]),
];
let start = performance.now();
let paused = false;
let pausedAt = 0;
function draw(now) {
  const elapsed = Math.max(0, (paused ? pausedAt : now) - start);
  const chosen = document.querySelector("#clip").value;
  const index = Math.floor(elapsed / 200);
  const [clip, pose] =
    chosen === "sequence"
      ? sequence[index % sequence.length]
      : [chosen, index % metadata.clips[chosen].count];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(background, 0, 0);
  spriteCtx.fillStyle = "#879b82";
  spriteCtx.fillRect(0, 0, sprites.width, sprites.height);
  Object.keys(metadata.facings).forEach((_facing, row) => {
    const column = metadata.clips[clip].start + pose;
    const w = metadata.frameWidth;
    ctx.drawImage(sheet, column * w, row * w, w, w, 24 + row * 152, 43, w, w);
    ctx.drawImage(explorer, 0, row * 32, 32, 32, 35 + row * 152, 142, 32, 32);
    spriteCtx.drawImage(sheet, column * w, row * w, w, w, row * w, 0, w, w);
  });
  canvas.dataset.clip = clip;
  canvas.dataset.pose = pose;
  canvas.dataset.sequenceIndex = index % sequence.length;
  window.giraffeDraft.ready = true;
  document.querySelector("#status").textContent =
    `${clip} ${pose + 1} / ${metadata.clips[clip].count}`;
  requestAnimationFrame(draw);
}
function scale() {
  const factor = Number(document.querySelector("#scale").value);
  for (const c of [canvas, sprites]) {
    c.style.width = `${c.width * factor}px`;
    c.style.height = `${c.height * factor}px`;
  }
}
document.querySelector("#scale").addEventListener("change", scale);
document.querySelector("#reset").addEventListener("click", () => {
  start = performance.now();
  paused = false;
  document.querySelector("#pause").textContent = "Pause";
});
document.querySelector("#clip").addEventListener("change", () => {
  start = performance.now();
});
document.querySelector("#pause").addEventListener("click", (event) => {
  if (paused) start += performance.now() - pausedAt;
  else pausedAt = performance.now();
  paused = !paused;
  event.target.textContent = paused ? "Resume" : "Pause";
});
scale();
window.giraffeDraft = { ready: false, identity: metadata.identity, sequenceDurationMs: 9200 };
requestAnimationFrame(draw);
