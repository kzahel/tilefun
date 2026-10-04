import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { queue, ROOT } from "./campaign.mjs";

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
                ? "Blocked"
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
    Blocked: 2,
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
    "Draft ready means retained sprite sheets/animation sources and a validated production-review receipt. It does not mean the animal is integrated into gameplay or human-approved. Preview links open the actual local animation files. Blocked attempts are retained and never counted as ready.",
    "",
    `**${result.valid}/${result.total} draft ready; ${counts["Motion review required"] ?? 0} require motion review; ${counts["In progress"] ?? 0} in progress; ${counts.Paused ?? 0} paused; ${counts.Blocked ?? 0} blocked; ${counts.Queued ?? 0} queued.**`,
    ...(result.productionHold && result.productionHold.active !== false
      ? ["", `**Production paused:** ${clean(result.productionHold.reason)}`]
      : []),
    ...(result.scope?.allowNewAnimals === false
      ? [
          "",
          `**Scope: repair existing frozen-torso walks only. No new animals.** ${counts["Out of scope"] ?? 0} unfinished roster entries are outside the current plan, not queued for production.`,
        ]
      : []),
    "",
    `[Overall decisions and evidence](topics/wildlife.md) · [Execution history](tactical/029-wildlife-fresh-production.md)${sessionLink}`,
    "",
    "## Current work, motion holds and blocked attempts",
    "",
    "| Animal | State | Current stage / reason |",
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
    "## Whole roster",
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
  const output = resolve(ROOT, "docs/wildlife-status.md");
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
