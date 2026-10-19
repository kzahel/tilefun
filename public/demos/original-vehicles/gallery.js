async function start() {
  const response = await fetch("manifest.json");
  if (!response.ok) throw Error("Vehicle collection unavailable");
  const manifest = await response.json();
  const prefix = "demos/original-vehicles/";
  for (const candidate of manifest.candidates) {
    if (!candidate.url.startsWith(prefix) || candidate.url.includes(".."))
      throw Error("Invalid vehicle review path");
    const path = candidate.url.slice(prefix.length);
    const link = document.createElement("a");
    link.className = "vehicle";
    link.href = path;
    link.setAttribute("aria-label", `Inspect ${candidate.name}`);
    const preview = document.createElement("div");
    preview.className = "preview";
    const image = document.createElement("img");
    image.src = path.replace(/index\.html$/, "captures/engine-2.png");
    image.alt = `${candidate.name}, rendered at native game pixels`;
    image.loading = "lazy";
    preview.append(image);
    const heading = document.createElement("h2");
    heading.textContent = candidate.name;
    const metadata = document.createElement("p");
    metadata.className = "metadata";
    metadata.textContent = `${candidate.audit.triangles.toLocaleString()} triangles · native pixels · interactive review`;
    const action = document.createElement("p");
    action.className = "action";
    action.textContent = "Inspect vehicle →";
    link.append(preview, heading, metadata, action);
    document.querySelector("#vehicles").append(link);
  }
  document.querySelector("#status").textContent =
    `${manifest.candidates.length} vehicle review snapshots`;
}
start().catch((error) => {
  document.querySelector("#status").textContent = error.message;
});
