const garden = document.querySelector("#garden");
const context = garden.getContext("2d");
const status = document.querySelector("#status");
const patrol = document.querySelector("#patrol");
const animate = document.querySelector("#animate");
const fps = document.querySelector("#fps");
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
const cards = [...document.querySelectorAll("canvas[data-row]")];
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

function drawSprite(ctx, frame, row, dx, dy, scale) {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet, frame * 32, row * 32, 32, 32, dx, dy, 32 * scale, 32 * scale);
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
  last = now;
  const tempo = Number(fps.value);
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
  const frame = moving ? Math.floor(walkTime * tempo) % 8 : 0;
  background();
  context.fillStyle = "#7e785c";
  context.fillRect(Math.round(x) - 9, Math.round(y) - 2, 18, 4);
  drawSprite(context, frame, directions.indexOf(facing), Math.round(x) - 32, Math.round(y) - 54, 2);
  for (const card of cards) {
    const ctx = card.getContext("2d");
    ctx.clearRect(0, 0, 32, 32);
    drawSprite(ctx, Math.floor(galleryTime * tempo) % 8, Number(card.dataset.row), 0, 0, 1);
  }
  status.textContent = `${moving ? "Walking" : "Standing"} ${facing}`;
  garden.dataset.x = x.toFixed(2);
  garden.dataset.y = y.toFixed(2);
  garden.dataset.facing = facing;
  garden.dataset.frame = String(frame);
  requestAnimationFrame(tick);
}

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement || event.ctrlKey || event.metaKey || event.altKey)
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
fps.addEventListener("input", () => {
  document.querySelector("#fps-label").textContent = `${fps.value} fps`;
});
sheet
  .decode()
  .then(() => {
    garden.dataset.ready = "true";
    requestAnimationFrame(tick);
  })
  .catch(() => {
    document.querySelector("#error").hidden = false;
    document.querySelector("#error").textContent =
      "The tiger sprite could not load. Reload this page to try again.";
    status.textContent = "Sprite unavailable";
  });
