async function start() {
  const offline = window.paintStudyOffline;
  const study = offline?.study ?? (await fetch("study.json").then((r) => r.json()));
  const select = document.querySelector("#paint");
  const camera = document.querySelector("#camera");
  const scale = document.querySelector("#scale");
  const heading = document.querySelector("#heading");
  const background = document.querySelector("#background");
  const frame = document.querySelector("#selected-frame");
  function draw() {
    const row = study.candidates.find((r) => r.id === select.value);
    if (!row) throw Error("Unknown paint scheme");
    const path = `${row.id}/captures/${camera.value}-${heading.value}.png`;
    frame.src = offline?.frames[path] ?? path;
    frame.alt = `${row.name}, ${Number(heading.value) * 22.5} degrees`;
    frame.width = frame.height = row.nativeSize * Number(scale.value);
    document.querySelector("#selected-name").textContent = row.name;
    document.querySelector("#heading-label").textContent = `${Number(heading.value) * 22.5}°`;
    document.querySelector("#stage").style.background = {
      neutral: "#e0e2e4",
      grass: "#88a96b",
      road: "#666b7b",
    }[background.value];
    document.querySelector("#view-note").textContent =
      `${camera.value === "engine" ? "Game camera" : "Elevated view"} · ${scale.value}× native pixels · fixed model scale`;
    const link = document.querySelector("#model-link");
    link.href = `${row.id}/index.html`;
    link.hidden = Boolean(offline);
    const swatches = document.querySelector("#swatches");
    swatches.replaceChildren();
    for (const color of row.scheme.swatches ?? []) {
      const swatch = document.createElement("span");
      swatch.style.background = `rgb(${color.join(",")})`;
      swatch.title = color.join(", ");
      swatches.append(swatch);
    }
    for (const card of document.querySelectorAll(".paint-card"))
      card.setAttribute("aria-pressed", String(card.dataset.id === row.id));
  }
  for (const control of [select, camera, scale, heading, background])
    control.addEventListener("input", draw);
  for (const card of document.querySelectorAll(".paint-card")) {
    card.addEventListener("click", () => {
      select.value = card.dataset.id;
      draw();
      document.querySelector(".studio").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  draw();
  window.paintStudyReady = true;
}
start().catch((error) => {
  document.querySelector("#selected-name").textContent = error.message;
  console.error(error);
});
