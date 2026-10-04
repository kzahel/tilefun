import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const PILOTS = ["fox", "elephant", "rabbit"];
const PREFERRED = [
  "fox",
  "elephant",
  "rabbit",
  "giraffe",
  "mallard-duck",
  "robin",
  "fish",
  "butterfly",
  "ant",
  "king-cobra",
  "frog",
  "gorilla",
  "kangaroo",
  "crab",
  "octopus",
  "penguin",
  "harbor-seal",
  "manta-ray",
  "jellyfish",
];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const read = (path) => JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));

export function safeArtifact(root, path) {
  if (
    typeof path !== "string" ||
    !/^(art-source\/wildlife-v2\/|public\/demos\/wildlife-v2\/)/.test(path)
  )
    throw new Error("Artifact must belong to the fresh wildlife-v2 namespace");
  const absolute = resolve(root, path),
    rel = relative(root, absolute);
  if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("Artifact leaves workspace");
  return absolute;
}

export function receiptErrors(root, receipt, id) {
  const errors = [];
  if (
    !receipt ||
    receipt.id !== id ||
    receipt.status !== "draft-ready" ||
    receipt.reviewStatus !== "pending"
  )
    return ["No fresh pending draft receipt"];
  if (receipt.model !== "gpt-6.1-sol" || receipt.effort !== "high")
    errors.push("Wrong model/effort");
  if (typeof receipt.sessionId !== "string" || !receipt.sessionId)
    errors.push("Missing actual session identity");
  const review = receipt.visualReview;
  if (!["coordinator", "production-agent"].includes(review?.observer))
    errors.push("Missing agent visual reviewer");
  for (const check of [
    "projection",
    "anatomy",
    "headVolume",
    "contacts",
    "continuousPlayback",
    "sceneScale",
  ])
    if (typeof review?.checks?.[check] !== "string" || review.checks[check].trim().length < 24)
      errors.push(`Missing concrete visual observation: ${check}`);
  const artifacts = Object.entries(receipt.artifacts ?? {});
  if (artifacts.length < 6) errors.push("Insufficient retained artifacts");
  for (const suffix of [
    ".blend",
    "guides.json",
    "masters.json",
    "sheet.png",
    "sprite.json",
    "preview.gif",
  ])
    if (!artifacts.some(([path]) => path.endsWith(suffix))) errors.push(`Missing ${suffix}`);
  if (!artifacts.some(([path]) => /scene(?:-native)?\.png$/.test(path)))
    errors.push("Missing native scene comparison");
  for (const [path, expected] of artifacts) {
    try {
      if (
        !/^[a-f0-9]{64}$/.test(expected) ||
        hash(readFileSync(safeArtifact(root, path))) !== expected
      )
        errors.push(`Changed or invalid artifact: ${path}`);
    } catch {
      errors.push(`Missing or unsafe artifact: ${path}`);
    }
  }
  return errors;
}

export function gateErrors(root, gate, receipts) {
  if (gate?.reviewer !== "coordinator" || gate.model !== "gpt-6.1-sol" || gate.effort !== "high")
    return ["Supervised coordinator pilot gate is absent"];
  const errors = [];
  for (const id of PILOTS) {
    const receipt = receipts[id];
    if (receipt?.visualReview?.observer !== "coordinator")
      errors.push(`${id}: coordinator review absent`);
    errors.push(...receiptErrors(root, receipt, id).map((e) => `${id}: ${e}`));
    if (gate.receiptSha256?.[id] !== hash(JSON.stringify(receipt)))
      errors.push(`${id}: changed pilot receipt`);
  }
  try {
    if (hash(readFileSync(safeArtifact(root, gate.cameraPath))) !== gate.cameraSha256)
      errors.push("Camera contract changed");
  } catch {
    errors.push("Missing fresh camera contract");
  }
  return errors;
}

export function queue(root = ROOT) {
  const roster = read(resolve(root, "art-source/wildlife-v2/roster.json"));
  const statePath = resolve(root, "data/wildlife-campaign-v2/progress.json");
  const state = existsSync(statePath) ? read(statePath) : { receipts: {}, tasks: {} };
  const gatePath = resolve(root, "data/wildlife-campaign-v2/pilot-gate.json");
  const gate = existsSync(gatePath) ? read(gatePath) : null;
  const animals = [...roster.animals].sort((a, b) => {
    const ia = PREFERRED.indexOf(a.id),
      ib = PREFERRED.indexOf(b.id);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  const receipts = state.receipts ?? {},
    statuses = state.tasks ?? {};
  const prototype = new Map();
  const tasks = animals.map((animal) => {
    const key = `${animal.form}:${animal.family ?? ""}:${animal.bodyPlan}:${animal.media.join("+")}:${(animal.locomotion ?? []).join("+")}`;
    const leader = prototype.get(key);
    if (!leader) prototype.set(key, animal.id);
    const errors = receiptErrors(root, receipts[animal.id], animal.id);
    return {
      ...animal,
      prototype: leader ?? animal.id,
      valid: errors.length === 0,
      errors,
      state: statuses[animal.id]?.status ?? "queued",
    };
  });
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const errors = gateErrors(root, gate, receipts);
  const next = errors.length
    ? null
    : tasks.find(
        (task) =>
          !task.valid &&
          task.state === "queued" &&
          (task.prototype === task.id || byId.get(task.prototype).valid),
      );
  return {
    tasks,
    errors,
    next: next ?? null,
    valid: tasks.filter((t) => t.valid).length,
    total: tasks.length,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = queue();
  if (process.argv.includes("--next")) console.log(JSON.stringify(result.next, null, 2));
  else
    console.log(
      JSON.stringify(
        {
          total: result.total,
          freshDrafts: result.valid,
          backgroundAllowed: result.errors.length === 0,
          gateErrors: result.errors,
          next: result.next?.id ?? null,
        },
        null,
        2,
      ),
    );
  if (process.argv.includes("--assert-gate") && result.errors.length) process.exitCode = 1;
}
