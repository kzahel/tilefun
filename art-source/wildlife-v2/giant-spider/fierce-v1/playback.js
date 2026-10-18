const metadata = await fetch("sprite.json").then((r) => r.json());
const load = async (path) => {
  const image = new Image();
  image.src = path;
  await image.decode();
  return image;
};
const [sheet, background, explorer] = await Promise.all([
  load("sheet.png"),
  load("scene-background.png"),
  load("../../../pixel-characters/person-32.png"),
]);
const canvas = document.querySelector("#playback"),
  sprites = document.querySelector("#sprites");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const sc = sprites.getContext("2d", { willReadFrequently: true });
const size = metadata.frameWidth;
canvas.width = background.width;
canvas.height = background.height;
sprites.width = size * 4;
sprites.height = size;
ctx.imageSmoothingEnabled = sc.imageSmoothingEnabled = false;
const select = document.querySelector("#clip");
for (const name of Object.keys(metadata.clips)) {
  const option = document.createElement("option");
  option.value = option.textContent = name;
  select.append(option);
}
const sequence = Object.entries(metadata.clips).flatMap(([name, clip]) =>
  Array.from({ length: clip.count }, (_, i) => [name, i]),
);
const duration = sequence.reduce((n, [name]) => n + metadata.clips[name].frameDuration, 0);
let started = performance.now(),
  paused = false,
  pausedAt = 0,
  inspected;
function draw(name, pose, travel = 0) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(background, 0, 0);
  sc.fillStyle = "#879b82";
  sc.fillRect(0, 0, sprites.width, sprites.height);
  Object.keys(metadata.facings).forEach((facing, row) => {
    const yaw = (metadata.cameraContract.modelYawDegrees[facing] * Math.PI) / 180;
    const dx = Math.round(-Math.sin(yaw) * travel),
      dy = Math.round(-Math.sin((40 * Math.PI) / 180) * Math.cos(yaw) * travel);
    const x = (metadata.clips[name].start + pose) * size;
    ctx.drawImage(
      sheet,
      x,
      row * size,
      size,
      size,
      110 + row * 230 - metadata.anchor[0] + dx,
      220 - metadata.anchor[1] + dy,
      size,
      size,
    );
    ctx.drawImage(explorer, 0, row * 32, 32, 32, 45 + row * 230, 192, 32, 32);
    sc.drawImage(sheet, x, row * size, size, size, row * size, 0, size, size);
  });
  canvas.dataset.clip = name;
  canvas.dataset.pose = String(pose);
  canvas.dataset.travel = String(travel);
  document.querySelector("#status").textContent =
    `${name} ${pose + 1} / ${metadata.clips[name].count}`;
}
function tick(now) {
  if (inspected) draw(...inspected);
  else {
    const elapsed = Math.max(0, (paused ? pausedAt : now) - started);
    let clip = select.value,
      pose,
      fraction;
    if (clip === "sequence") {
      let remaining = elapsed % duration,
        index = 0;
      while (remaining >= metadata.clips[sequence[index][0]].frameDuration) {
        remaining -= metadata.clips[sequence[index][0]].frameDuration;
        index++;
      }
      [clip, pose] = sequence[index];
      fraction = pose / metadata.clips[clip].count;
    } else {
      const clipData = metadata.clips[clip],
        frame = Math.floor(elapsed / clipData.frameDuration);
      pose = frame % clipData.count;
      fraction = (elapsed / (clipData.frameDuration * clipData.count)) % 2;
    }
    draw(
      clip,
      pose,
      document.querySelector("#travel").checked
        ? fraction * metadata.clips[clip].rootTravelPixelsPerCycle
        : 0,
    );
  }
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
select.addEventListener("change", () => {
  inspected = undefined;
  started = paused ? pausedAt : performance.now();
});
document.querySelector("#reset").addEventListener("click", () => {
  inspected = undefined;
  paused = false;
  started = performance.now();
  document.querySelector("#pause").textContent = "Pause";
});
document.querySelector("#pause").addEventListener("click", (event) => {
  inspected = undefined;
  if (paused) started += performance.now() - pausedAt;
  else pausedAt = performance.now();
  paused = !paused;
  event.target.textContent = paused ? "Resume" : "Pause";
});
window.fierceDraft = {
  ready: true,
  identity: metadata.identity,
  sequenceDurationMs: duration,
  inspect(clip, pose, travel = 0) {
    if (!metadata.clips[clip] || pose < 0 || pose >= metadata.clips[clip].count)
      throw Error("Unknown creature pose");
    inspected = [clip, pose, travel];
    draw(clip, pose, travel);
  },
};
scale();
requestAnimationFrame(tick);
