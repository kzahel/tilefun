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
const context = canvas.getContext("2d", { willReadFrequently: true });
const spriteContext = sprites.getContext("2d", { willReadFrequently: true });
const size = metadata.frameWidth;
canvas.width = background.width;
canvas.height = background.height;
sprites.width = size * 4;
sprites.height = size;
context.imageSmoothingEnabled = spriteContext.imageSmoothingEnabled = false;
const sequence = [
  ...Array.from({ length: 3 }, () => ["idle", 0]),
  ...Array.from({ length: metadata.clips.walk.count * 2 }, (_, i) => [
    "walk",
    i % metadata.clips.walk.count,
  ]),
  ...["sniff", "display"].flatMap((clip) =>
    Array.from({ length: metadata.clips[clip].count }, (_, i) => [clip, i]),
  ),
  ...Array.from({ length: 3 }, () => ["idle", 0]),
];
const duration = sequence.reduce((sum, [clip]) => sum + metadata.clips[clip].frameDuration, 0);
let started = performance.now();
let paused = false;
let pausedAt = 0;
let inspected;

function draw(clip, pose, travel = 0) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(background, 0, 0);
  spriteContext.fillStyle = "#879b82";
  spriteContext.fillRect(0, 0, sprites.width, sprites.height);
  Object.keys(metadata.facings).forEach((facing, row) => {
    const yaw = (metadata.cameraContract.modelYawDegrees[facing] * Math.PI) / 180;
    const dx = Math.round(-Math.sin(yaw) * travel);
    const dy = Math.round(-Math.sin((40 * Math.PI) / 180) * Math.cos(yaw) * travel);
    const x = (metadata.clips[clip].start + pose) * size;
    context.drawImage(sheet, x, row * size, size, size, 70 + row * 195 + dx, 58 + dy, size, size);
    context.drawImage(explorer, 0, row * 32, 32, 32, 30 + row * 195, 106, 32, 32);
    spriteContext.drawImage(sheet, x, row * size, size, size, row * size, 0, size, size);
  });
  canvas.dataset.clip = clip;
  canvas.dataset.pose = String(pose);
  canvas.dataset.travel = String(travel);
  document.querySelector("#status").textContent =
    `${clip} ${pose + 1} / ${metadata.clips[clip].count}`;
}

function tick(now) {
  if (inspected) draw(...inspected);
  else {
    const elapsed = Math.max(0, (paused ? pausedAt : now) - started);
    const selected = document.querySelector("#clip").value;
    let clip = selected;
    let pose;
    let cycles;
    if (selected === "sequence") {
      let remaining = elapsed % duration;
      let i = 0;
      while (remaining >= metadata.clips[sequence[i][0]].frameDuration) {
        remaining -= metadata.clips[sequence[i][0]].frameDuration;
        i++;
      }
      [clip, pose] = sequence[i];
      cycles = Math.max(0, i - 3) / metadata.clips.walk.count;
    } else {
      const i = Math.floor(elapsed / metadata.clips[clip].frameDuration);
      pose = i % metadata.clips[clip].count;
      cycles = (i % (metadata.clips.walk.count * 2)) / metadata.clips.walk.count;
    }
    draw(
      clip,
      pose,
      clip === "walk" && document.querySelector("#travel").checked
        ? cycles * metadata.rootTravelPixelsPerCycle
        : 0,
    );
  }
  requestAnimationFrame(tick);
}

function scale() {
  const factor = Number(document.querySelector("#scale").value);
  for (const element of [canvas, sprites]) {
    element.style.width = `${element.width * factor}px`;
    element.style.height = `${element.height * factor}px`;
  }
}

document.querySelector("#scale").addEventListener("change", scale);
document.querySelector("#clip").addEventListener("change", () => {
  inspected = undefined;
  started = paused ? pausedAt : performance.now();
});
document.querySelector("#reset").addEventListener("click", () => {
  inspected = undefined;
  started = performance.now();
  paused = false;
  document.querySelector("#pause").textContent = "Pause";
});
document.querySelector("#pause").addEventListener("click", (event) => {
  inspected = undefined;
  if (paused) started += performance.now() - pausedAt;
  else pausedAt = performance.now();
  paused = !paused;
  event.target.textContent = paused ? "Resume" : "Pause";
});
window.tigerDraft = {
  ready: true,
  identity: metadata.identity,
  sequenceDurationMs: duration,
  inspect(clip, pose, travel = 0) {
    if (!metadata.clips[clip] || pose < 0 || pose >= metadata.clips[clip].count)
      throw new Error("Unknown tiger pose");
    inspected = [clip, pose, travel];
    draw(clip, pose, travel);
  },
};
scale();
requestAnimationFrame(tick);
