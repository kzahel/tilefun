const garden = document.querySelector("#garden");
const context = garden.getContext("2d");
const status = document.querySelector("#status");
const patrol = document.querySelector("#patrol");
const animate = document.querySelector("#animate");
const fps = document.querySelector("#fps");
const artStyle = document.querySelector("#art-style");
const spriteSize = document.querySelector("#sprite-size");
const nativeScale = document.querySelector("#native-scale");
const directions = ["down", "up", "left", "right"];
const keys = new Set();
const mapping = {
  ArrowUp: "up",
  w: "up",
  ArrowDown: "down",
  s: "down",
  ArrowLeft: "left",
  a: "left",
  ArrowRight: "right",
  d: "right",
};
const sheet = new Image();
sheet.src = "tiger-walk.png";
const finished32 = new Image();
finished32.src = "tiger-finished-32.png";
const finished16 = new Image();
finished16.src = "tiger-finished-16.png";
const render16 = document.createElement("canvas");
render16.width = 128;
render16.height = 64;
const assets = {
  render: { 32: sheet, 16: render16 },
  pixels: { 32: finished32, 16: finished16 },
};
const cards = [...document.querySelectorAll("canvas[data-row]")];
const comparisons = [...document.querySelectorAll("canvas[data-compare]")];
let x = 166;
let y = 132;
let facing = "down";
let walkTime = 0;
let galleryTime = 0;
let last = 0;
let targetIndex = 0;
const targets = [
  [214, 132],
  [214, 164],
  [166, 164],
  [166, 132],
];

function background() {
  context.fillStyle = "#789765";
  context.fillRect(0, 0, 384, 224);
  context.fillStyle = "#849e6e";
  for (let i = 0; i < 130; i++) {
    const gx = (i * 53 + 7) % 384;
    const gy = (i * 37 + 13) % 224;
    context.fillRect(gx, gy, 2, 2);
  }
  context.fillStyle = "#c7b487";
  context.fillRect(48, 90, 288, 92);
  context.fillStyle = "#d9c699";
  context.fillRect(52, 94, 280, 84);
  context.fillStyle = "#cbb88c";
  for (let i = 0; i < 52; i++) context.fillRect(54 + ((i * 31) % 276), 98 + ((i * 23) % 76), 2, 1);
  for (const [tx, ty] of [
    [35, 48],
    [326, 38],
    [300, 194],
    [64, 204],
  ]) {
    context.fillStyle = "#5b7750";
    context.fillRect(tx, ty, 26, 10);
    context.fillStyle = "#456748";
    context.fillRect(tx + 3, ty - 12, 20, 17);
    context.fillStyle = "#93ac6e";
    context.fillRect(tx + 5, ty - 14, 14, 5);
    context.fillStyle = "#ecce91";
    context.fillRect(tx + 9, ty - 4, 3, 3);
  }
}

function drawSprite(
  ctx,
  frame,
  row,
  dx,
  dy,
  scale,
  style = artStyle.value,
  size = Number(spriteSize.value),
) {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    assets[style][size],
    frame * size,
    row * size,
    size,
    size,
    dx,
    dy,
    size * scale,
    size * scale,
  );
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
  last = now;
  const tempo = Number(fps.value);
  const size = Number(spriteSize.value);
  const frameCount = artStyle.value === "pixels" ? 4 : 8;
  const poseRate = (frameCount * tempo) / 8;
  let dx = Number(keys.has("right")) - Number(keys.has("left"));
  let dy = Number(keys.has("down")) - Number(keys.has("up"));
  if (patrol.checked && !keys.size) {
    const [tx, ty] = targets[targetIndex];
    if (Math.abs(tx - x) < 0.7 && Math.abs(ty - y) < 0.7) {
      x = tx;
      y = ty;
      targetIndex = (targetIndex + 1) % targets.length;
    } else if (Math.abs(tx - x) >= 0.7) dx = Math.sign(tx - x);
    else dy = Math.sign(ty - y);
  }
  const moving = dx !== 0 || dy !== 0;
  if (moving) {
    facing = dx ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    const magnitude = Math.hypot(dx, dy);
    // Match travel to the rendered foot stride; tempo changes both cadence and speed.
    const speed = (12 * tempo) / 8;
    x = Math.max(40, Math.min(344, x + (dx / magnitude) * speed * dt));
    y = Math.max(78, Math.min(202, y + (dy / magnitude) * speed * dt));
    walkTime += dt;
  } else walkTime = 0;
  if (animate.checked) galleryTime += dt;
  const frame = moving ? Math.floor(walkTime * poseRate) % frameCount : 0;
  background();
  context.fillStyle = "#7e785c";
  context.fillRect(Math.round(x) - 9, Math.round(y) - 2, 18, 4);
  drawSprite(
    context,
    frame,
    directions.indexOf(facing),
    Math.round(x) - 32,
    Math.round(y) - (size === 16 ? 56 : 54),
    64 / size,
  );
  for (const card of cards) {
    const ctx = card.getContext("2d");
    ctx.clearRect(0, 0, 32, 32);
    drawSprite(
      ctx,
      Math.floor(galleryTime * poseRate) % frameCount,
      Number(card.dataset.row),
      0,
      0,
      32 / size,
    );
  }
  const finishedFrame = Math.floor((galleryTime * 4 * tempo) / 8) % 4;
  for (const card of comparisons) {
    const ctx = card.getContext("2d");
    ctx.clearRect(0, 0, 80, 40);
    const scale = nativeScale.checked ? 1 : 32 / size;
    const height = size * scale;
    drawSprite(
      ctx,
      finishedFrame * 2,
      Number(card.dataset.compare),
      4,
      (40 - height) / 2,
      scale,
      "render",
      size,
    );
    drawSprite(
      ctx,
      finishedFrame,
      Number(card.dataset.compare),
      44,
      (40 - height) / 2,
      scale,
      "pixels",
      size,
    );
  }
  document.querySelector("#fps-label").textContent = `${poseRate} fps`;
  status.textContent = `${moving ? "Walking" : "Standing"} ${facing}`;
  garden.dataset.x = x.toFixed(2);
  garden.dataset.y = y.toFixed(2);
  garden.dataset.facing = facing;
  garden.dataset.frame = String(frame);
  garden.dataset.style = artStyle.value;
  garden.dataset.size = String(size);
  requestAnimationFrame(tick);
}

window.addEventListener("keydown", (event) => {
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLSelectElement ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  )
    return;
  const direction = mapping[event.key];
  if (!direction) return;
  event.preventDefault();
  patrol.checked = false;
  keys.add(direction);
});
window.addEventListener("keyup", (event) => {
  const direction = mapping[event.key];
  if (direction) keys.delete(direction);
});
window.addEventListener("blur", () => keys.clear());
document.addEventListener("visibilitychange", () => {
  keys.clear();
  last = 0;
});
for (const button of document.querySelectorAll("button[data-direction]")) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    patrol.checked = false;
    keys.add(button.dataset.direction);
    button.setPointerCapture(event.pointerId);
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    button.addEventListener(event, () => keys.delete(button.dataset.direction));
  button.addEventListener("click", () => {
    patrol.checked = false;
    facing = button.dataset.direction;
  });
}
document.querySelector("#reset").addEventListener("click", () => {
  x = 166;
  y = 132;
  targetIndex = 0;
  walkTime = 0;
  keys.clear();
});
nativeScale.addEventListener("change", () => {
  document.querySelector(".comparisons").classList.toggle("actual", nativeScale.checked);
});
for (const selector of [artStyle, spriteSize]) {
  selector.addEventListener("change", () => {
    galleryTime = 0;
    walkTime = 0;
  });
}
Promise.all([sheet.decode(), finished32.decode(), finished16.decode()])
  .then(() => {
    const small = render16.getContext("2d");
    small.imageSmoothingEnabled = false;
    small.drawImage(sheet, 0, 0, 128, 64);
    garden.dataset.ready = "true";
    requestAnimationFrame(tick);
  })
  .catch(() => {
    document.querySelector("#error").hidden = false;
    document.querySelector("#error").textContent =
      "The tiger sprite could not load. Reload this page to try again.";
    status.textContent = "Sprite unavailable";
  });
