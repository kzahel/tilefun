const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const metadata = await (await fetch("sprite.json")).json();
const sheet = new Image();
sheet.src = "sheet.png";
await sheet.decode();
const select = document.querySelector("#clip"),
  range = document.querySelector("#pose");
let clip = metadata.defaultClip,
  index = 0,
  paused = true,
  speed = 1,
  previous = 0,
  elapsed = 0;
canvas.width = metadata.frameWidth * 4;
canvas.height = metadata.frameHeight;
ctx.imageSmoothingEnabled = false;
function inspect(name, pose) {
  clip = name;
  index = Math.min(metadata.clips[clip].count - 1, Math.max(0, pose));
  select.value = clip;
  range.max = String(metadata.clips[clip].count - 1);
  range.value = String(index);
  canvas.dataset.pose = String(index);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const w = metadata.frameWidth;
  for (let row = 0; row < 4; row++)
    ctx.drawImage(sheet, (metadata.clips[clip].start + index) * w, row * w, w, w, row * w, 0, w, w);
}
select.onchange = () => inspect(select.value, 0);
range.oninput = () => inspect(clip, Number(range.value));
document.querySelector("#step").onclick = () =>
  inspect(clip, (index + 1) % metadata.clips[clip].count);
document.querySelector("#speed").onchange = (e) => {
  speed = Number(e.target.value);
};
document.querySelector("#pause").onclick = (e) => {
  paused = !paused;
  e.target.textContent = paused ? "Play" : "Pause";
  elapsed = 0;
};
function tick(now) {
  if (!paused) {
    elapsed += Math.min(100, now - previous) * speed;
    const ms = metadata.clips[clip].frameDuration;
    while (elapsed >= ms) {
      inspect(clip, (index + 1) % metadata.clips[clip].count);
      elapsed -= ms;
    }
  }
  previous = now;
  requestAnimationFrame(tick);
}
inspect(clip, 0);
window.longLeggedMotion = { ready: true, inspect };
requestAnimationFrame(tick);
