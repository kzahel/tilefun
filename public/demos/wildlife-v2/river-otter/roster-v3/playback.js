const metadata = await (await fetch("sprite.json")).json();
const load = async (url) => {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
};
const sheet = await load("sheet.png");
const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const size = metadata.frameWidth;
canvas.width = size * 4;
canvas.height = size;
ctx.imageSmoothingEnabled = false;
const clip = document.querySelector("#clip");
const pose = document.querySelector("#pose");
const pause = document.querySelector("#pause");
let playing = true,
  index = 0,
  carry = 0,
  last = performance.now();
function draw() {
  const data = metadata.clips[clip.value];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let row = 0; row < 4; row++)
    ctx.drawImage(
      sheet,
      (data.start + index) * size,
      row * size,
      size,
      size,
      row * size,
      0,
      size,
      size,
    );
  pose.max = String(data.count - 1);
  pose.value = String(index);
  document.querySelector("output").textContent = `${index + 1} / ${data.count}`;
  canvas.dataset.clip = clip.value;
  canvas.dataset.pose = String(index);
}
function inspect(name, frame) {
  if (!metadata.clips[name] || frame < 0 || frame >= metadata.clips[name].count)
    throw Error("Unknown pose");
  clip.value = name;
  index = frame;
  playing = false;
  pause.textContent = "Play";
  draw();
}
window.longLeggedMotion = { ready: true, identity: metadata.identity, inspect };
clip.addEventListener("change", () => {
  index = 0;
  carry = 0;
  draw();
});
pause.addEventListener("click", () => {
  playing = !playing;
  pause.textContent = playing ? "Pause" : "Play";
});
pose.addEventListener("input", () => inspect(clip.value, Number(pose.value)));
document
  .querySelector("#step")
  .addEventListener("click", () =>
    inspect(clip.value, (index + 1) % metadata.clips[clip.value].count),
  );
function tick(now) {
  if (playing) {
    carry += now - last;
    const duration =
      metadata.clips[clip.value].frameDuration / Number(document.querySelector("#speed").value);
    if (carry >= duration) {
      const count = Math.floor(carry / duration);
      carry -= count * duration;
      index = (index + count) % metadata.clips[clip.value].count;
      draw();
    }
  }
  last = now;
  requestAnimationFrame(tick);
}
draw();
requestAnimationFrame(tick);
