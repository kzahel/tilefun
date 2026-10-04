const metadata = await fetch("sprite.json").then((r) => r.json());
const load = (src) =>
  new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
const [sheet, background, water, explorer] = await Promise.all([
  load("sheet.png"),
  load("scene-background.png"),
  load("scene-water-background.png"),
  load("../../../pixel-characters/person-32.png"),
]);
const canvas = document.querySelector("#playback"),
  sprites = document.querySelector("#sprites"),
  ctx = canvas.getContext("2d", { willReadFrequently: true }),
  spriteCtx = sprites.getContext("2d");
ctx.imageSmoothingEnabled = false;
spriteCtx.imageSmoothingEnabled = false;
const sequence = [
  ...Array.from({ length: 3 }, () => ["idle", 0]),
  ...Array.from({ length: 16 }, (_, i) => ["haul", i % 8]),
  ...Array.from({ length: 16 }, (_, i) => ["swim", i % 8]),
  ...Array.from({ length: 6 }, (_, i) => ["action", i]),
  ...Array.from({ length: 3 }, () => ["idle", 0]),
];
let start = performance.now(),
  paused = false,
  pausedAt = 0;
function draw(now) {
  const index = Math.floor(Math.max(0, (paused ? pausedAt : now) - start) / 160),
    chosen = document.querySelector("#clip").value;
  const [clip, pose] =
    chosen === "sequence"
      ? sequence[index % sequence.length]
      : [chosen, index % metadata.clips[chosen].count];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(clip === "swim" ? water : background, 0, 0);
  spriteCtx.fillStyle = "#879b82";
  spriteCtx.fillRect(0, 0, sprites.width, sprites.height);
  Object.keys(metadata.facings).forEach((_f, row) => {
    const column = metadata.clips[clip].start + pose,
      w = metadata.frameWidth;
    ctx.drawImage(sheet, column * w, row * w, w, w, 50 + row * 140, 58, w, w);
    ctx.drawImage(explorer, 0, row * 32, 32, 32, 26 + row * 140, 93, 32, 32);
    spriteCtx.drawImage(sheet, column * w, row * w, w, w, row * w, 0, w, w);
  });
  canvas.dataset.clip = clip;
  canvas.dataset.pose = pose;
  canvas.dataset.sequenceIndex = index % sequence.length;
  window.harborSealDraft.ready = true;
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
document.querySelector("#pause").addEventListener("click", (e) => {
  if (paused) start += performance.now() - pausedAt;
  else pausedAt = performance.now();
  paused = !paused;
  e.target.textContent = paused ? "Resume" : "Pause";
});
scale();
window.harborSealDraft = { ready: false, identity: metadata.identity, sequenceDurationMs: 7040 };
requestAnimationFrame(draw);
