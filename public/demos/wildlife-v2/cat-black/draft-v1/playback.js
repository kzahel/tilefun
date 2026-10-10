const metadata = await fetch("sprite.json").then((r) => r.json());
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
ctx.imageSmoothingEnabled = spriteCtx.imageSmoothingEnabled = false;
const size = metadata.frameWidth;
const cat = size === 48;
canvas.width = background.width;
canvas.height = background.height;
sprites.width = size * 4;
sprites.height = size;
const walk = metadata.clips.walk;
const sequence = [
  ...Array.from({ length: 3 }, () => ["idle", 0]),
  ...Array.from({ length: walk.count * 2 }, (_, i) => ["walk", i % walk.count]),
  ...Array.from({ length: metadata.clips.action.count }, (_, i) => ["action", i]),
  ...Array.from({ length: 3 }, () => ["idle", 0]),
];
const duration = sequence.reduce((sum, [name]) => sum + metadata.clips[name].frameDuration, 0);
let start = performance.now();
let paused = false;
let pausedAt = 0;
let inspected;
function draw(clip, pose, travel = 0) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(background, 0, 0);
  spriteCtx.fillStyle = "#879b82";
  spriteCtx.fillRect(0, 0, sprites.width, sprites.height);
  Object.keys(metadata.facings).forEach((facing, row) => {
    const yaw = (metadata.cameraContract.modelYawDegrees[facing] * Math.PI) / 180;
    const dx = Math.round(-Math.sin(yaw) * travel);
    const dy = Math.round(-Math.sin((40 * Math.PI) / 180) * Math.cos(yaw) * travel);
    const sx = (metadata.clips[clip].start + pose) * size;
    const sy = row * size;
    ctx.drawImage(
      sheet,
      sx,
      sy,
      size,
      size,
      (cat ? 68 : 74) + row * (cat ? 150 : 170) + dx,
      88 + dy,
      size,
      size,
    );
    ctx.drawImage(
      explorer,
      0,
      row * 32,
      32,
      32,
      (cat ? 24 : 26) + row * (cat ? 150 : 170),
      cat ? 93 : 103,
      32,
      32,
    );
    spriteCtx.drawImage(sheet, sx, sy, size, size, row * size, 0, size, size);
  });
  canvas.dataset.clip = clip;
  canvas.dataset.pose = String(pose);
  document.querySelector("#status").textContent =
    `${clip} ${pose + 1} / ${metadata.clips[clip].count}`;
}
function tick(now) {
  if (inspected) {
    draw(...inspected);
    requestAnimationFrame(tick);
    return;
  }
  const elapsed = Math.max(0, (paused ? pausedAt : now) - start);
  const chosen = document.querySelector("#clip").value;
  let clip = chosen;
  let pose = 0;
  let cycles = 0;
  if (chosen === "sequence") {
    let remaining = elapsed % duration;
    let index = 0;
    while (remaining >= metadata.clips[sequence[index][0]].frameDuration) {
      remaining -= metadata.clips[sequence[index][0]].frameDuration;
      index++;
    }
    [clip, pose] = sequence[index];
    cycles = Math.max(0, index - 3) / walk.count;
  } else {
    const index = Math.floor(elapsed / metadata.clips[clip].frameDuration);
    pose = index % metadata.clips[clip].count;
    cycles = (index % (walk.count * 2)) / walk.count;
  }
  draw(
    clip,
    pose,
    clip === "walk" && document.querySelector("#travel").checked
      ? cycles * metadata.rootTravelPixelsPerCycle
      : 0,
  );
  requestAnimationFrame(tick);
}
function scale() {
  const factor = Number(document.querySelector("#scale").value);
  for (const c of [canvas, sprites]) {
    c.style.width = `${c.width * factor}px`;
    c.style.height = `${c.height * factor}px`;
  }
}
document.querySelector("#scale").addEventListener("change", scale);
document.querySelector("#clip").addEventListener("change", () => {
  inspected = undefined;
  start = paused ? pausedAt : performance.now();
});
document.querySelector("#reset").addEventListener("click", () => {
  inspected = undefined;
  start = performance.now();
  paused = false;
  document.querySelector("#pause").textContent = "Pause";
});
document.querySelector("#pause").addEventListener("click", (event) => {
  inspected = undefined;
  if (paused) start += performance.now() - pausedAt;
  else pausedAt = performance.now();
  paused = !paused;
  event.target.textContent = paused ? "Resume" : "Pause";
});
window.petDraft = {
  ready: true,
  identity: metadata.identity,
  sequenceDurationMs: duration,
  inspect(clip, pose, travel = 0) {
    inspected = [clip, pose, travel];
    paused = true;
    pausedAt = performance.now();
    start = pausedAt;
    document.querySelector("#clip").value = clip;
    draw(clip, pose, travel);
    // Freeze at the requested native frame for deterministic captures.
    start -= pose * metadata.clips[clip].frameDuration;
  },
};
scale();
requestAnimationFrame(tick);
