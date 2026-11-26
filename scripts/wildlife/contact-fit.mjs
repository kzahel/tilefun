// Run from the repository root with node --import tsx. See docs/wildlife-contact-fit.md.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs, promisify } from "node:util";
import { PNG } from "pngjs";
import { AnimationMixer, Box3, MeshBasicMaterial, Ray, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { getEntityAABB } from "../../src/entities/collision.ts";
import { ENTITY_DEFS } from "../../src/entities/EntityDefs.ts";
import { WILDLIFE_DEFAULT_MODELS } from "../../src/wildlife/WildlifeModelReviewBank.ts";
import { verifyLanding } from "./contact-landing.mjs";
import { contactOverlay } from "./contact-overlay.mjs";

const { positionals: types, values } = parseArgs({
  allowPositionals: true,
  options: { out: { type: "string" }, before: { type: "string" }, landing: { type: "boolean" } },
});
if (!types.length || !values.out)
  throw Error("Usage: --out DIRECTORY [--before report.json] [--landing] TYPE...");
await mkdir(values.out, { recursive: true });
const previous = values.before ? JSON.parse(await readFile(values.before, "utf8")) : {};
const trunk = /^(body|torso|chest|pelvis|rump|spine([._]?\d+)?)$/i;
const round = (n) => Math.round(n * 10) / 10;

function torsoVertex(mesh, index) {
  const { skinIndex, skinWeight } = mesh.geometry.attributes;
  let strongest = 0;
  for (let slot = 1; slot < 4; slot++) {
    if (skinWeight.getComponent(index, slot) > skinWeight.getComponent(index, strongest))
      strongest = slot;
  }
  return trunk.test(mesh.skeleton.bones[skinIndex.getComponent(index, strongest)].name);
}

async function readPaint(buffer) {
  const png = new PNG();
  return promisify(png.parse.bind(png))(Buffer.from(buffer));
}

async function sourceParts(model) {
  const bytes = await readFile(`public/demos/wildlife-3d/${model.id}/model.glb`);
  const loader = new GLTFLoader().register(() => ({
    name: "contact-geometry",
    loadMaterial: async () => new MeshBasicMaterial(),
  }));
  const { scene, animations, parser } = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  const meshes = [];
  scene.traverse((mesh) => {
    if (mesh.isSkinnedMesh) meshes.push(mesh);
  });
  if (!meshes.length) throw Error(`No skinned geometry in ${model.id}`);
  const parts = [];
  for (const mesh of meshes) {
    const { geometry } = mesh;
    const count = geometry.attributes.position.count;
    const isTorso = Array.from({ length: count }, (_, i) => torsoVertex(mesh, i));
    const indices = geometry.index?.array ?? Array.from({ length: count }, (_, i) => i);
    const { meshes: meshIndex, primitives: primitiveIndex } = parser.associations.get(mesh) ?? {};
    const materialIndex = parser.json.meshes[meshIndex]?.primitives[primitiveIndex]?.material;
    const pbr = parser.json.materials?.[materialIndex]?.pbrMetallicRoughness;
    const texture = parser.json.textures?.[pbr?.baseColorTexture?.index];
    const image = parser.json.images?.[texture?.source];
    const paint =
      image?.mimeType === "image/png"
        ? await readPaint(await parser.getDependency("bufferView", image.bufferView))
        : undefined;
    const faces = [];
    for (let i = 0; i < indices.length; i += 3) {
      const ids = Array.from(indices.slice(i, i + 3));
      let rgb = [168, 164, 145];
      if (paint && geometry.attributes.uv) {
        const uv = geometry.attributes.uv;
        const at = (axis, size) =>
          Math.max(
            0,
            Math.min(
              size - 1,
              Math.floor((size * ids.reduce((sum, id) => sum + uv.getComponent(id, axis), 0)) / 3),
            ),
          );
        const start = 4 * (at(1, paint.height) * paint.width + at(0, paint.width));
        rgb = Array.from(paint.data.subarray(start, start + 3));
      }
      faces.push({ ids, torso: ids.every((index) => isTorso[index]), rgb });
    }
    parts.push({ mesh, count, faces });
  }
  return { parts, scene, animations };
}

// World x, y, z for the down-facing model. The skinned batch applies its
// camera-specific x/z scale in model space before changing the heading.
function posedFaces(parts, model) {
  return parts.flatMap(({ mesh, count, faces }) => {
    const vertices = Array.from({ length: count }, (_, i) => {
      const p = mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld);
      return new Vector3(
        p.x * model.topDown.width,
        -p.z,
        p.y * model.topDown.height,
      ).multiplyScalar(model.scale);
    });
    return faces.map(({ ids, torso, rgb }) => ({
      points: ids.map((i) => vertices[i]),
      torso,
      rgb,
    }));
  });
}

function sampleBack(faces, box, model) {
  const torso = faces.filter((f) => f.torso);
  if (!torso.length) throw Error("No recognizable torso faces. Inspect the rig before fitting.");
  const bounds = new Box3();
  for (const { points } of torso) for (const p of points) bounds.expandByPoint(p);
  const ray = new Ray(new Vector3(), new Vector3(0, 0, -1));
  const hit = new Vector3();
  function surfaceAt(x, y) {
    ray.origin.set(x, y, bounds.max.z + 1);
    let top = -Infinity;
    for (const {
      points: [a, b, c],
    } of torso) {
      if (ray.intersectTriangle(a, b, c, false, hit)) top = Math.max(top, hit.z);
    }
    return top;
  }
  const heights = [];
  // Median of upper surfaces on an evenly spaced central patch. A vertex
  // percentile would overweight extra triangles around eyes, seams and feet.
  for (let col = 0; col < 9; col++) {
    for (let row = 0; row < 9; row++) {
      const fraction = (i) => 0.25 + i / 16;
      const top = surfaceAt(
        bounds.min.x + fraction(col) * (bounds.max.x - bounds.min.x),
        bounds.min.y + fraction(row) * (bounds.max.y - bounds.min.y),
      );
      if (Number.isFinite(top)) heights.push(top);
    }
  }
  if (!heights.length) throw Error("No support samples. Inspect the central torso patch.");
  heights.sort((a, b) => a - b);
  // Fraction of the fixed box over visible torso in the worst cardinal
  // heading and camera. Inverse-rotate each footprint point into model space.
  let minimumCoverage = 100;
  for (const xScale of [1, model.topDown.width]) {
    const counts = [0, 0, 0, 0];
    for (let col = 0; col < 5; col++) {
      for (let row = 0; row < 5; row++) {
        const x = box.left + ((col + 0.5) * (box.right - box.left)) / 5;
        const y = box.top + ((row + 0.5) * (box.bottom - box.top)) / 5;
        const points = [
          [x, y],
          [-x, -y],
          [y, -x],
          [-y, x],
        ];
        for (const [heading, [u, v]] of points.entries()) {
          if (Number.isFinite(surfaceAt(u * xScale, v))) counts[heading]++;
        }
      }
    }
    minimumCoverage = Math.min(minimumCoverage, ...counts.map((count) => count * 4));
  }
  return {
    back: heights[Math.floor(heights.length / 2)],
    hits: heights.length,
    bounds,
    minimumCoverage,
  };
}

const report = {};
for (const type of types) {
  const model = WILDLIFE_DEFAULT_MODELS.find((m) => m.type === type);
  const collider = ENTITY_DEFS[type]?.collider;
  if (!model || !collider) throw Error(`Unknown modeled entity: ${type}`);
  if (values.before && previous[type]?.model !== model.id) {
    throw Error(`Baseline must contain the current model ${model.id} for ${type}`);
  }
  const box = { ...getEntityAABB({ wx: 0, wy: 0 }, collider), height: collider.physicalHeight };
  const { scene, animations, parts } = await sourceParts(model);
  const mixer = new AnimationMixer(scene);
  const samples = [];
  const names = [...new Set(["idle", model.classicTravel ?? "walk"])];
  for (const name of names) {
    const clip = animations.find((a) => a.name === (model.actions?.[name] ?? name));
    if (!clip) continue;
    const action = mixer.clipAction(clip).reset().play();
    for (const phase of [0, 0.25, 0.5, 0.75]) {
      mixer.setTime(phase * clip.duration);
      scene.updateMatrixWorld(true);
      const faces = posedFaces(parts, model);
      const { back, hits, bounds, minimumCoverage } = sampleBack(faces, box, model);
      if (!samples.length) {
        const svg = contactOverlay(model.name, faces, box, previous[type]?.box);
        await writeFile(join(values.out, `${type}.svg`), svg);
      }
      samples.push({
        clip: name,
        phase,
        topDown: round(back),
        firstPerson: round(back / model.topDown.height),
        torsoWidth: round(bounds.max.x - bounds.min.x),
        torsoLength: round(bounds.max.y - bounds.min.y),
        firstPersonTorsoWidth: round((bounds.max.x - bounds.min.x) / model.topDown.width),
        hits,
        minimumCoverage,
      });
    }
    action.stop();
  }
  if (!samples.length) throw Error(`No idle or walk clip in ${model.id}`);
  const landing = values.landing ? await verifyLanding(type, collider) : undefined;
  const worstHeightError = round(
    Math.max(
      ...samples.flatMap((s) => [
        Math.abs(s.topDown - box.height),
        Math.abs(s.firstPerson - box.height),
      ]),
    ),
  );
  const worstCoverage = Math.min(...samples.map((s) => s.minimumCoverage));
  report[type] = { model: model.id, box, samples, landing, worstHeightError, worstCoverage };
  console.log(
    `${type}  box ${box.right - box.left} × ${box.bottom - box.top} × ${box.height}  back (TD/FP) ${samples[0].topDown}/${samples[0].firstPerson}  torso ${samples[0].torsoWidth} × ${samples[0].torsoLength}  max gap ${worstHeightError} px  min coverage ${worstCoverage}%  clips ${[...new Set(samples.map((s) => s.clip))].join(", ")}`,
  );
}
await writeFile(join(values.out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
