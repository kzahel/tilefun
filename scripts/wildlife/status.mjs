import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { queue, ROOT } from "./campaign.mjs";
import { fierceReceiptErrors } from "./check-fierce.mjs";
import { petReceiptErrors } from "./check-pets.mjs";
import { predatorReceiptErrors } from "./check-predators.mjs";
import { tigerReceiptErrors } from "./check-tiger.mjs";

const read = (path) => JSON.parse(readFileSync(resolve(ROOT, path), "utf8").replace(/^\uFEFF/, ""));
export function writeStatus() {
  const state = read("data/wildlife-campaign-v2/progress.json");
  const result = queue();
  const now = new Date();
  const active = existsSync(resolve(ROOT, "data/wildlife-campaign-v2/active-session.json"))
    ? read("data/wildlife-campaign-v2/active-session.json")
    : { name: "background-01-worker" };
  if (!/^[a-z0-9-]+$/.test(active.name)) throw new Error("Invalid active session identity");
  const sessionBase = `data/wildlife-campaign-v2/${active.name}`;
  const activity = ["checkpoint.md", "events.jsonl", "launch.json"].find((file) =>
    existsSync(resolve(ROOT, `${sessionBase}/${file}`)),
  );
  const sessionLink = activity ? ` · [Latest session activity](../${sessionBase}/${activity})` : "";
  const clean = (value) =>
    String(value ?? "")
      .replaceAll("|", "/")
      .replace(/[\r\n]+/g, " ");
  const status = (task) =>
    task.qualityHold
      ? "Motion review required"
      : task.state === "paused"
        ? "Paused"
        : task.valid
          ? "Draft ready"
          : task.state === "draft-ready"
            ? "Receipt needs checking"
            : task.state === "in-progress"
              ? "In progress"
              : task.state === "blocked"
                ? "Previous draft rejected"
                : task.state === "out-of-scope"
                  ? "Out of scope"
                  : "Queued";
  const counts = {};
  for (const task of result.tasks) counts[status(task)] = (counts[status(task)] ?? 0) + 1;
  const rank = {
    "Motion review required": 0,
    Paused: 1,
    "Draft ready": 0,
    "In progress": 1,
    "Previous draft rejected": 2,
    "Receipt needs checking": 3,
    Queued: 4,
    "Out of scope": 5,
  };
  const tasks = [...result.tasks].sort((a, b) => rank[status(a)] - rank[status(b)]);
  const lines = [
    "# Wildlife production status",
    "",
    `Snapshot: ${now.toISOString()} (${now.toLocaleString("en-GB", { timeZone: "Europe/Berlin" })} Berlin).`,
    "",
    "Automatically regenerated at task checkpoints and handoffs. Reopen this file to load the latest snapshot. It covers the whole fresh roster.",
    "",
    "Draft ready means retained sprite sheets/animation sources and a validated production-review receipt. It does not mean the animal is integrated into gameplay or human-approved. Preview links open the actual local animation files. Previous draft rejected means that historical revision failed its visual checks. It is retained as evidence, not a current work blocker; consult the latest run above for current progress.",
    "",
    `**${result.valid}/${result.total} draft ready; ${counts["Motion review required"] ?? 0} require motion review; ${counts["In progress"] ?? 0} in progress; ${counts.Paused ?? 0} paused; ${counts["Previous draft rejected"] ?? 0} previous drafts rejected; ${counts.Queued ?? 0} queued.**`,
    ...(result.productionHold && result.productionHold.active !== false
      ? [
          "",
          `**Historical campaign paused:** ${clean(result.productionHold.reason)} The separately authorized four-pet batch is tracked below.`,
        ]
      : []),
    ...(result.scope?.allowNewAnimals === false
      ? [
          "",
          `**Historical roster scope: existing frozen-torso repairs.** ${counts["Out of scope"] ?? 0} unfinished roster entries stay outside production. Named pet/tiger exceptions are tracked separately below.`,
        ]
      : []),
    "",
    `[Overall decisions and evidence](topics/wildlife.md) · [Execution history](tactical/060-wildlife-fresh-production.md)${sessionLink}`,
    "",
    "## Historical work and rejected drafts",
    "",
    "| Animal | Historical state | Recorded stage / reason |",
    "| --- | --- | --- |",
  ];
  for (const task of tasks.filter((t) => !t.valid && t.state !== "queued")) {
    const details = state.tasks[task.id] ?? {};
    const detail = task.qualityHold
      ? task.qualityHold
      : task.state === "blocked"
        ? (details.summary ?? details.detail)
        : `${details.stage ?? "In progress"}. ${details.detail ?? ""}`;
    lines.push(
      `| ${clean(task.name)} | ${status(task)} | ${clean(detail ?? task.errors.join("; "))} |`,
    );
  }
  lines.push(
    "",
    "## Historical whole roster",
    "",
    "| Animal | Family | State | Revision | Ready animations | Preview / inspection |",
    "| --- | --- | --- | --- | --- | --- |",
  );
  for (const task of tasks) {
    const receipt = state.receipts[task.id];
    const revision = receipt?.revision ?? state.tasks[task.id]?.revision ?? "";
    const base =
      receipt?.acceptedReferencePath ??
      (revision ? `public/demos/wildlife-v2/${task.id}/${revision}` : null);
    let clips = "";
    let links = "";
    if (base && existsSync(resolve(ROOT, `${base}/sprite.json`)) && task.valid)
      clips = Object.keys(read(`${base}/sprite.json`).clips ?? {}).join(", ");
    if (base && existsSync(resolve(ROOT, `${base}/preview.gif`)))
      links = `[${task.valid ? "Animation" : task.qualityHold ? "Needs motion review" : "Unaccepted attempt"}](../${base}/preview.gif)`;
    if (base && existsSync(resolve(ROOT, `${base}/review-observations.md`)))
      links += `${links ? " · " : ""}[Notes](../${base}/review-observations.md)`;
    lines.push(
      `| ${clean(task.name)} | ${clean(task.family)} | ${status(task)} | ${clean(revision) || "-"} | ${clean(clips) || "-"} | ${links || "-"} |`,
    );
  }
  lines.push(
    "",
    "## Refresh",
    "",
    "Generated from the fresh roster, atomic progress state and validated receipt hashes. Historical/rejected revisions are not counted. Queued family members remain gated until their required prototype passes.",
    "",
    "Agents refresh this table after task selection, meaningful checkpoints, completion, blocking or receipt revision, and before final handoff. Persist the progress state first. Checkpoint helpers can call the exported writeStatus() function; other agents run:",
    "",
    "```sh",
    "node scripts/wildlife/status.mjs",
    "```",
    "",
  );
  const petPath = resolve(ROOT, "art-source/wildlife-v2/pet-batch.json");
  if (existsSync(petPath)) {
    const batch = read("art-source/wildlife-v2/pet-batch.json");
    const section = [
      "## Authorized common-pet batch",
      "",
      "Separate from the historical roster and its stopped queue. [Scope and evidence](tactical/084-common-pets-and-variations.md). All human approvals remain pending.",
      "",
      "| Pet | State | Gameplay | Inspection |",
      "| --- | --- | --- | --- |",
      ...batch.pets.map((pet) => {
        const base = `public/demos/wildlife-v2/${pet.id}/${batch.revision}`;
        const links = existsSync(resolve(ROOT, `${base}/index.html`))
          ? `[Playback](../${base}/index.html) · [Observations](../${base}/review-observations.md)`
          : "-";
        const state =
          pet.state === "draft-ready" && petReceiptErrors(pet, batch.revision).length
            ? "Receipt needs checking"
            : pet.state;
        return `| ${clean(pet.name)} | ${clean(state)} | ${pet.gameplay ? "Provisional" : "Pending"} | ${links} |`;
      }),
      "",
    ];
    lines.splice(lines.indexOf("## Historical whole roster"), 0, ...section);
  }
  if (existsSync(resolve(ROOT, "art-source/wildlife-v2/tiger-batch.json"))) {
    const batch = read("art-source/wildlife-v2/tiger-batch.json");
    const base = `public/demos/wildlife-v2/${batch.animalId}/${batch.revision}`;
    const errors = batch.state === "draft-ready" ? tigerReceiptErrors() : [];
    const state = errors.length ? "Receipt needs checking" : batch.state;
    const links = existsSync(resolve(ROOT, `${base}/index.html`))
      ? `[Playback](../${base}/index.html) · [Observations](../${base}/review-observations.md)`
      : "-";
    lines.splice(
      lines.indexOf("## Historical whole roster"),
      0,
      "## Authorized tiger pilot",
      "",
      "[Tactical 131](tactical/131-predators-and-prehistoric-creatures.md): tiger-only Blender/pixel art. Historical repair holds remain active. Human review is pending; gameplay is a separate slice.",
      "",
      "| Animal | State | Current stage | Inspection |",
      "| --- | --- | --- | --- |",
      `| ${clean(batch.name)} | ${clean(state)} | ${clean(batch.stage)} | ${links} |`,
      "",
    );
  }
  if (existsSync(resolve(ROOT, "art-source/wildlife-v2/predator-batch.json"))) {
    const batch = read("art-source/wildlife-v2/predator-batch.json");
    lines.splice(
      lines.indexOf("## Historical whole roster"),
      0,
      "## Authorized predator gameplay and art",
      "",
      "[Tactical 132](tactical/132-predator-hunting-and-replacement.md). Separate bounded authorization; historical holds remain active and human art review stays pending.",
      "",
      "| Predator | State | Stage | Gameplay |",
      "| --- | --- | --- | --- |",
      ...batch.animals.map((p) => {
        const state =
          p.state === "draft-ready" && predatorReceiptErrors(p.id).length
            ? "Receipt needs checking"
            : p.state;
        const base = `public/demos/wildlife-v2/${p.id}/${p.revision}`;
        const link = existsSync(resolve(ROOT, `${base}/index.html`))
          ? ` · [Playback](../${base}/index.html)`
          : "";
        return `| ${clean(p.id)} | ${clean(state)} | ${clean(p.stage)}${link} | ${p.gameplay ? "Provisional" : "Pending"} |`;
      }),
      "",
    );
  }
  if (existsSync(resolve(ROOT, "art-source/wildlife-v2/fantasy-batch.json"))) {
    const batch = read("art-source/wildlife-v2/fantasy-batch.json");
    lines.splice(
      lines.indexOf("## Historical whole roster"),
      0,
      "## Authorized fierce creatures",
      "",
      "[Tactical 137](tactical/137-fierce-creatures-and-food-web.md). Five named creatures only; explicit food web and natural-only replacement. Human art review remains pending.",
      "",
      "| Creature | State | Gameplay |",
      "| --- | --- | --- |",
      ...batch.animals.map(
        (p) =>
          `| ${clean(p.id)} | ${clean(p.state === "draft-ready" && fierceReceiptErrors(p.id).length ? "Receipt needs checking" : p.state)} | ${p.gameplay ? "Provisional" : "Pending"} |`,
      ),
      "",
    );
  }
  if (existsSync(resolve(ROOT, "art-source/wildlife-v2/horse-motion-study.json"))) {
    const study = read("art-source/wildlife-v2/horse-motion-study.json");
    lines.splice(
      lines.indexOf("## Historical whole roster"),
      0,
      "## Focused horse motion study",
      "",
      "[Tactical 139](tactical/139-horse-motion-study.md). Owner accepted this clay prototype in chat and authorized completing both animals; the active finished banks are listed below.",
      "",
      "| Animal | State | Review |",
      "| --- | --- | --- |",
      `| Horse | ${clean(study.state)} | ${clean(study.reviewStatus)} · [Playback](../public/demos/wildlife-v2/horse/${study.revision}/index.html) |`,
      "",
    );
  }
  if (existsSync(resolve(ROOT, "art-source/wildlife-v2/long-legged-repairs.json"))) {
    const repairs = read("art-source/wildlife-v2/long-legged-repairs.json");
    lines.splice(
      lines.indexOf("## Historical whole roster"),
      0,
      "## Completed horse and giraffe motion repairs",
      "",
      "[Tactical 139](tactical/139-horse-motion-study.md). Owner accepted the horse prototype and authorized completing/activating both animals. New final pixels have distinct pending review identities; other historical holds remain.",
      "",
      "| Animal | State | Gameplay |",
      "| --- | --- | --- |",
      ...repairs.scope.map(
        (animal) =>
          `| ${clean(animal)} | ${clean(repairs.state)} · [Playback](../public/demos/wildlife-v2/${animal}/${repairs.revision}/index.html) | ${repairs.gameplay ? "Active" : "Checking"} |`,
      ),
      "",
    );
  }
  const output = resolve(ROOT, "docs/wildlife-status.md");
  if (existsSync(resolve(ROOT, "art-source/wildlife-v2/autonomous-140.json"))) {
    const latestRun = existsSync(resolve(ROOT, "art-source/wildlife-v2/autonomous-147.json"))
      ? "autonomous-147"
      : "autonomous-140";
    const run = read(`art-source/wildlife-v2/${latestRun}.json`);
    const entries = Object.entries(run.tasks);
    const finished = entries.filter(([, t]) => t.state === "finished-game-active");
    const active = entries.filter(([, t]) => t.state === "in-progress");
    lines.splice(
      2,
      0,
      "## Latest autonomous completion run",
      "",
      `[Current tactical](tactical/${run.tactical ?? "140-autonomous-wildlife-completion.md"}): owner-authorized full-roster work supersedes the historical expansion/sequencing holds below. Deadline ${clean(run.deadlineUtc)}. State: ${clean(run.state)}.`,
      "",
      `**${finished.length} newly completed; ${active.length} in progress; ${entries.filter(([, t]) => t.state === "blocked").length} currently blocked; ${entries.filter(([, t]) => t.state === "queued").length} queued; ${entries.filter(([, t]) => t.state === "already-completed").length} completed before this run.** Final pixels retain their own human-review status.`,
      "",
      "| Animal | Current state | Inspection |",
      "| --- | --- | --- |",
      ...entries
        .filter(([, t]) => ["in-progress", "finished-game-active", "blocked"].includes(t.state))
        .map(
          ([id, t]) =>
            `| ${clean(t.name)} | ${clean(t.state)} | ${t.revision && existsSync(resolve(ROOT, `public/demos/wildlife-v2/${id}/${t.revision}/index.html`)) ? `[Playback](../public/demos/wildlife-v2/${id}/${t.revision}/index.html)` : clean(t.detail ?? "Source/animation work")} |`,
        ),
      "",
      "## Historical campaign snapshot",
      "",
      "The records below describe earlier revisions. Rejected drafts and old production holds do not override the current work ledger above.",
      "",
    );
  }
  if (existsSync(resolve(ROOT, "art-source/wildlife-v2/gorilla-shoulder-study.json"))) {
    const study = read("art-source/wildlife-v2/gorilla-shoulder-study.json");
    const historical = lines.indexOf("## Historical campaign snapshot");
    lines.splice(
      historical < 0 ? 2 : historical,
      0,
      "## Current gorilla shoulder study",
      "",
      `Owner-requested focused revision: ${clean(study.state)}. The silver saddle follows the torso surface and the shoulder contour is lower. New pixels await human review.`,
      "",
      `Gorilla · [Animation](../public/demos/wildlife-v2/gorilla/${study.revision}/index.html) · [Source and checks](../art-source/wildlife-v2/gorilla/${study.revision}/README.md). Gameplay still uses the preserved roster-v2 bank.`,
      "",
    );
  }
  lines.splice(
    2,
    0,
    "[Animal browser and AI playground](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-tiger&landscape=balanced#/tool/world-geometry)",
    "",
  );
  const behaviorPath = resolve(ROOT, "art-source/wildlife-v2/behavior-campaign.json");
  if (existsSync(behaviorPath)) {
    const animals = Object.values(read("art-source/wildlife-v2/behavior-campaign.json").animals);
    const verified = animals.filter((a) => a.progress.validation === "verified");
    const active = animals.filter((a) => Object.values(a.progress).includes("in-progress"));
    lines.splice(
      4,
      0,
      "## Distinct animal behaviors",
      "",
      `${verified.length}/${animals.length} entries game/lab verified; ${active.length} in progress. Inherited coat entries count as coverage, not additional distinct mechanics. Human behavior/art review remains separate.`,
      "",
      "[Current behavior ledger and progress](wildlife-behavior-status.md) · [Planning and completion rules](topics/wildlife-behaviors.md)",
      "",
    );
  }
  const temporary = `${output}.${process.pid}.tmp`;
  writeFileSync(temporary, lines.join("\n"));
  renameSync(temporary, output);
  return {
    updatedUtc: now.toISOString(),
    rows: tasks.length,
    counts,
    path: "docs/wildlife-status.md",
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(writeStatus()));
}
