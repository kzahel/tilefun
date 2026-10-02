const garden = document.querySelector("#garden");
const context = garden.getContext("2d");
const characterSelect = document.querySelector("#character");
const sizeSelect = document.querySelector("#sprite-size");
const animate = document.querySelector("#animate");
const actual = document.querySelector("#native-scale");
const status = document.querySelector("#status");
const error = document.querySelector("#error");
const cards = [...document.querySelectorAll("canvas[data-row]")];
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
const heldKeys = new Set();
const pointers = new Map();
let registry = [];
let current = null;
let loadRevision = 0;
let x = 192;
let y = 146;
let facing = "down";
let walkTime = 0;
let cycleTime = 0;
let last = 0;

async function json(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  return response.json();
}

function showError(reason) {
  error.hidden = false;
  error.textContent = `${reason.message}. Reload the gallery to try again.`;
  status.textContent = "Sprites unavailable";
  garden.dataset.ready = "false";
  document.querySelector("#downloads").hidden = true;
}

function updateDetail() {
  const size = Number(sizeSelect.value);
  for (const card of cards) card.width = card.height = size;
  document.querySelector(".directions").style.setProperty("--pixel-size", `${size}px`);
  document.querySelector(".directions").classList.toggle("actual", actual.checked);
  cycleTime = walkTime = 0;
  if (current) document.querySelector("#sheet-link").href = current.metadata.versions[size].image;
}

async function selectCharacter() {
  const revision = ++loadRevision;
  current = null;
  garden.dataset.ready = "false";
  error.hidden = true;
  status.textContent = "Loading sprites…";
  heldKeys.clear();
  pointers.clear();
  document.querySelector("#downloads").hidden = true;
  const record = registry.find((entry) => entry.id === characterSelect.value);
  try {
    if (!record) throw new Error("This character is missing from the roster");
    const metadata = await json(record.metadata);
    const assets = {};
    await Promise.all(
      [32, 16].map(async (size) => {
        const contract = metadata.versions?.[size];
        if (
          !contract ||
          contract.frameWidth !== size ||
          contract.frameHeight !== size ||
          contract.columns !== 4 ||
          contract.rows !== 4 ||
          contract.fps !== 4
        )
          throw new Error("Unsupported sprite metadata");
        const image = new Image();
        image.src = contract.image;
        await image.decode();
        if (image.naturalWidth !== size * 4 || image.naturalHeight !== size * 4)
          throw new Error("Sprite sheet dimensions do not match its metadata");
        assets[size] = image;
      }),
    );
    if (revision !== loadRevision) return;
    current = { record, metadata, assets };
    document.querySelector("#description").textContent = record.description;
    document.querySelector("#contact-link").href = record.contactSheet;
    document.querySelector("#preview-link").href = record.preview;
    document.querySelector("#metadata-link").href = record.metadata;
    document.querySelector("#downloads").hidden = false;
    sizeSelect.disabled = false;
    updateDetail();
    garden.dataset.character = record.id;
    garden.dataset.ready = "true";
  } catch (reason) {
    if (revision === loadRevision) showError(reason);
  }
}

function sprite(ctx, size, frame, row, dx, dy, scale) {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    current.assets[size],
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
  if (current) {
    const held = new Set([...heldKeys].map((key) => mapping[key]).concat([...pointers.values()]));
    const dx = Number(held.has("right")) - Number(held.has("left"));
    const dy = Number(held.has("down")) - Number(held.has("up"));
    const moving = dx !== 0 || dy !== 0;
    if (moving) {
      facing = dx ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      const length = Math.hypot(dx, dy);
      x = Math.max(32, Math.min(352, x + (dx / length) * 48 * dt));
      y = Math.max(64, Math.min(208, y + (dy / length) * 48 * dt));
      walkTime += dt;
    } else walkTime = 0;
    if (animate.checked) cycleTime += dt;
    const size = Number(sizeSelect.value);
    const contract = current.metadata.versions[size];
    context.fillStyle = "#cbdcd0";
    context.fillRect(0, 0, 384, 224);
    context.fillStyle = "#e9ddbf";
    context.fillRect(20, 54, 344, 158);
    context.fillStyle = "#dfd0af";
    for (let gx = 20; gx < 364; gx += 32) context.fillRect(gx, 54, 1, 158);
    for (let gy = 54; gy < 212; gy += 32) context.fillRect(20, gy, 344, 1);
    context.fillStyle = "#b3ad97";
    context.fillRect(Math.round(x) - 10, Math.round(y) - 2, 20, 4);
    const scale = 64 / size;
    const frame = moving ? Math.floor(walkTime * contract.fps) % 4 : 0;
    sprite(
      context,
      size,
      frame,
      contract.directions[facing].row,
      Math.round(x) - contract.pivot[0] * scale,
      Math.round(y) - contract.pivot[1] * scale,
      scale,
    );
    for (const card of cards) {
      const ctx = card.getContext("2d");
      ctx.clearRect(0, 0, size, size);
      sprite(
        ctx,
        size,
        Math.floor(cycleTime * contract.fps) % 4,
        Number(card.dataset.row),
        0,
        0,
        1,
      );
    }
    garden.dataset.x = x.toFixed(2);
    garden.dataset.y = y.toFixed(2);
    garden.dataset.facing = facing;
    garden.dataset.size = String(size);
    garden.dataset.frame = String(frame);
    status.textContent = `${moving ? "Walking" : "Standing"} ${facing}`;
  } else context.clearRect(0, 0, 384, 224);
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
  if (!mapping[event.key]) return;
  event.preventDefault();
  heldKeys.add(event.key);
});
window.addEventListener("keyup", (event) => heldKeys.delete(event.key));
function release() {
  heldKeys.clear();
  pointers.clear();
  last = 0;
}
window.addEventListener("blur", release);
document.addEventListener("visibilitychange", release);
for (const button of document.querySelectorAll("button[data-direction]")) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    pointers.set(event.pointerId, button.dataset.direction);
    button.setPointerCapture(event.pointerId);
  });
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
    button.addEventListener(name, (event) => pointers.delete(event.pointerId));
}
document.querySelector("#reset").addEventListener("click", () => {
  release();
  x = 192;
  y = 146;
  facing = "down";
  walkTime = 0;
});
characterSelect.addEventListener("change", selectCharacter);
sizeSelect.addEventListener("change", updateDetail);
actual.addEventListener("change", updateDetail);
animate.addEventListener("change", () => {
  cycleTime = 0;
});
requestAnimationFrame(tick);
try {
  const data = await json("characters.json");
  if (!Array.isArray(data.characters) || !data.characters.length)
    throw new Error("No completed characters are available");
  registry = data.characters;
  for (const record of registry) characterSelect.add(new Option(record.name, record.id));
  if (registry.some((record) => record.id === "cat")) characterSelect.value = "cat";
  characterSelect.disabled = false;
  await selectCharacter();
} catch (reason) {
  showError(reason);
}
