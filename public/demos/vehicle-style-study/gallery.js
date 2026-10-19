const routeRoot = document.querySelector("#routes");
const angle = document.querySelector("#angle");
const scale = document.querySelector("#scale");
const stage = document.querySelector("#stage");
const play = document.querySelector("#play");
const status = document.querySelector("#status");
let timer;
let manifest;

function assetUrl(path) {
  return window.vehicleStudyOffline?.assets[path] ?? path;
}

function update() {
  document.querySelector("#heading").textContent = `${Number(angle.value) * 45}°`;
  for (const img of document.querySelectorAll(".car")) {
    img.src = assetUrl(`${img.dataset.route}/${stage.value}-${angle.value}.png`);
    img.style.width = `${128 * Number(scale.value)}px`;
    img.style.height = `${128 * Number(scale.value)}px`;
    img.style.transform = stage.value === "raw" ? `translateY(${28 * Number(scale.value)}px)` : "";
    img.classList.toggle("raw", stage.value === "raw");
  }
  for (const img of document.querySelectorAll(".reference-cars img")) {
    img.style.width = `${Number(img.dataset.width) * Number(scale.value)}px`;
  }
}

function element(tag, text, className) {
  const result = document.createElement(tag);
  if (text) result.textContent = text;
  if (className) result.className = className;
  return result;
}

async function start() {
  if (window.vehicleStudyOffline) {
    manifest = window.vehicleStudyOffline.manifest;
  } else {
    const response = await fetch("manifest.json");
    if (!response.ok) throw Error("Comparison evidence is not available yet.");
    manifest = await response.json();
  }
  for (const route of manifest.routes) {
    const card = element("article", null, "route");
    card.id = route.id;
    const head = element("header");
    head.append(
      element("span", route.number, "number"),
      element("h2", route.title),
      element("p", route.description, "description"),
    );
    const viewport = element("div", null, "viewport");
    const img = element("img", null, "car");
    img.dataset.route = route.id;
    img.alt = `${route.title}: red sports coupe`;
    viewport.append(img);
    const footer = element("footer");
    const metrics = element("p", null, "metrics");
    metrics.append(
      element("span", `${route.triangles.toLocaleString()} triangles`),
      element("span", `${route.colors} colours`),
      element("span", "128px canvas"),
    );
    const links = element("div", null, "links");
    for (const [label, file] of [
      ["Process sheet", "comparison.png"],
      ["Turntable", "turntable.gif"],
      ["Sprite sheet", "sheet.png"],
      ["Report", "report.json"],
    ]) {
      const link = element("a", label);
      link.href = assetUrl(`${route.id}/${file}`);
      if (window.vehicleStudyOffline) link.download = `${route.id}-${file}`;
      links.append(link);
    }
    footer.append(metrics, links);
    card.append(head, viewport, footer);
    routeRoot.append(card);
  }
  for (const reference of manifest.references) {
    const figure = element("figure");
    const img = element("img");
    img.src = assetUrl(reference.file);
    img.dataset.width = reference.width;
    img.alt = reference.title;
    figure.append(img, element("figcaption", reference.title));
    document.querySelector("#references").append(figure);
  }
  status.textContent = "Four finished experiments · direction and zoom stay synchronized";
  update();
  window.vehicleStyleStudyReady = true;
}

for (const input of [angle, scale, stage]) input.addEventListener("input", update);
play.addEventListener("click", () => {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  } else {
    timer = setInterval(() => {
      angle.value = String((Number(angle.value) + 1) % 8);
      update();
    }, 450);
  }
  play.textContent = timer ? "Pause rotation" : "Play rotation";
  play.setAttribute("aria-pressed", String(Boolean(timer)));
});
start().catch((error) => {
  status.textContent = error.message;
});
