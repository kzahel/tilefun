import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import roster from "../../art-source/wildlife-v2/autonomous-147.json" with { type: "json" };
import { FAUNA_PROFILES } from "../../src/wildlife/Fauna.js";
import { PREDATOR_PROFILES } from "../../src/wildlife/Predator.js";
import { ANIMAL_BROWSER_ENTRIES } from "../../src/workshop/AnimalBrowserData.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const ledgerPath = resolve(root, "art-source/wildlife-v2/behavior-campaign.json");
const reportPath = resolve(root, "docs/wildlife-behavior-status.md");
const browserPath = resolve(root, "src/workshop/animal-behavior-status.json");
const rosterId = (id) => (id === "brown-bear" ? "bear" : id === "mallard" ? "mallard-duck" : id);
const columns = ["audit", "design", "ai", "animation", "integration", "validation"];
const stages = new Set(["not-audited", "planned", "in-progress", "verified", "not-required"]);
const phases = new Set(["unclassified", "land", "air", "amphibious", "aquatic"]);
const reviews = new Set(["not-requested", "pending", "needs-changes", "approved"]);
const text = (s) =>
  String(s)
    .replaceAll("|", "/")
    .replace(/[\r\n]+/g, " ");

function inventory() {
  return Object.fromEntries(
    ANIMAL_BROWSER_ENTRIES.map((animal) => {
      const fauna = FAUNA_PROFILES.find((p) => p.species === animal.id);
      const predator = PREDATOR_PROFILES.find((p) => p.species === animal.id);
      const originalId = rosterId(animal.id);
      return [
        animal.id,
        {
          name: animal.name,
          rosterId: Object.hasOwn(roster.tasks, originalId) ? originalId : null,
          runtimeType: animal.type,
          family: animal.family,
          variantOf: fauna?.variantOf ?? null,
          phase: "unclassified",
          inventoryFacts: {
            system: fauna ? "shared-fauna" : predator ? "shared-hunter" : animal.id,
            habitat: fauna?.habitat ?? predator?.expansion?.habitat ?? null,
            rideable: Boolean(fauna?.rideSpeed),
            specialistHunterProfile: predator?.fierce?.kind ?? null,
          },
          progress: Object.fromEntries(columns.map((c) => [c, "not-audited"])),
          humanReview: { behavior: "not-requested", animation: "not-requested" },
          audit: { findings: [], sourceRefs: ["src/workshop/AnimalBrowserData.ts"] },
          plan: null,
          evidence: [],
          notRequiredReasons: {},
          nextAction: "Audit existing behavior and assign phase; specify a signature mechanic.",
        },
      ];
    }),
  );
}

if (process.argv.includes("--seed")) {
  // Exclusive creation protects all subsequent human-authored audits and plans.
  const campaign = {
    version: 1,
    id: "wildlife-distinct-behaviors",
    updated: "2026-10-20",
    state: "inventory-seeded",
    scope:
      "All current animal entries; land and air first, amphibious scope explicit, aquatic later.",
    topic: "docs/topics/wildlife-behaviors.md",
    ideas: [
      {
        id: "dog-ball-fetch",
        targets: ["dog"],
        status: "requested-idea",
        description:
          "Retrieve a thrown ball, carry it back and visibly release it near the player.",
      },
      {
        id: "crow-object-carrying",
        targets: ["crow"],
        status: "requested-idea",
        description:
          "Pick up, carry and drop suitable loose objects; respect held objects and ownership.",
      },
      {
        id: "bird-nesting",
        targets: [],
        status: "requested-idea",
        description:
          "Appropriate bird species choose nest sites, gather material and visibly build/use nests. Species assignment needs audit.",
      },
      {
        id: "visible-foraging",
        targets: [],
        status: "requested-idea",
        description:
          "Seek and visibly collect/eat suitable food, including fruit. Record resource use and observable world changes; species assignment needs audit.",
      },
    ],
    animals: inventory(),
  };
  writeFileSync(ledgerPath, `${JSON.stringify(campaign, null, 2)}\n`, { flag: "wx" });
}

const campaign = JSON.parse(readFileSync(ledgerPath, "utf8"));
if (campaign.version !== 1 || !campaign.animals) throw Error("Unsupported behavior ledger");
const live = inventory();
const ids = Object.keys(campaign.animals);
if (
  ids.length !== ANIMAL_BROWSER_ENTRIES.length ||
  new Set(ANIMAL_BROWSER_ENTRIES.map((a) => a.id)).size !== ids.length
)
  throw Error("Animal inventory count/identity mismatch");
const covered = new Set();
for (const [id, animal] of Object.entries(campaign.animals)) {
  if (
    !live[id] ||
    animal.runtimeType !== live[id].runtimeType ||
    animal.rosterId !== live[id].rosterId ||
    animal.variantOf !== live[id].variantOf
  )
    throw Error(`Animal identity changed or is missing: ${id}`);
  if (animal.rosterId) covered.add(animal.rosterId);
  if (!phases.has(animal.phase)) throw Error(`Invalid phase: ${id}`);
  for (const key of columns) {
    const stage = animal.progress[key];
    if (!stages.has(stage)) throw Error(`Invalid ${key} state: ${id}`);
    if (stage === "not-required" && !animal.notRequiredReasons?.[key])
      throw Error(`Missing ${key} exemption reason: ${id}`);
    if (stage === "verified" && !animal.evidence.some((e) => e.area === key && e.ref))
      throw Error(`Missing ${key} evidence: ${id}`);
  }
  for (const area of ["behavior", "animation"]) {
    const state = animal.humanReview[area];
    if (!reviews.has(state)) throw Error(`Invalid human review: ${id}`);
    if (
      ["approved", "needs-changes"].includes(state) &&
      !animal.evidence.some((e) => e.area === `human-${area}-review` && e.ref)
    )
      throw Error(`Missing recorded human ${area} feedback: ${id}`);
  }
}
if (Object.keys(roster.tasks).some((id) => !covered.has(id)))
  throw Error("Original roster coverage missing");

const count = (predicate) => Object.values(campaign.animals).filter(predicate).length;
const lines = [
  "# Animal behavior progress",
  "",
  "Generated from [the canonical ledger](../art-source/wildlife-v2/behavior-campaign.json). [Plan and completion rules](topics/wildlife-behaviors.md).",
  "",
  `**${ids.length} animal entries: ${covered.size} original roster entries and ${ids.length - covered.size} additional entries.** Inventory coverage is checked against the current Animal Browser. This is not a completed behavior audit.`,
  "",
  "| Work area | Not audited | Planned | In progress | Verified | Not required |",
  "| --- | --- | --- | --- | --- | --- |",
  ...columns.map(
    (key) =>
      `| ${key} | ${[...stages].map((s) => count((a) => a.progress[key] === s)).join(" | ")} |`,
  ),
  "",
  `Phase assignment: ${[...phases].map((p) => `${p}: ${count((a) => a.phase === p)}`).join("; ")}.`,
  "",
  "| Human review | Not requested | Pending | Needs changes | Approved |",
  "| --- | --- | --- | --- | --- |",
  ...["behavior", "animation"].map(
    (area) =>
      `| ${area} | ${[...reviews].map((s) => count((a) => a.humanReview[area] === s)).join(" | ")} |`,
  ),
  "",
  "Requested ideas are proposals, not completed designs: dog ball fetching, crow object carrying, appropriate bird nesting, and visible food/fruit foraging.",
  "",
  "| Animal | Phase | Audit | Design | AI | Animation | Integration | Validation | Next action |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...ids.map((id) => {
    const a = campaign.animals[id];
    return `| ${text(a.name)} (${id}) | ${a.phase} | ${columns.map((key) => a.progress[key]).join(" | ")} | ${text(a.nextAction)} |`;
  }),
  "",
  "Regenerate: `npx tsx scripts/wildlife/behavior-status.mjs`. Check inventory and report freshness: append `--check`. Seeding is one-time and refuses to overwrite an existing ledger. Edit animal audits/plans in the ledger; do not hand-edit this generated report. Human approval must reference actual recorded feedback; generated counts do not certify approvals.",
  "",
];
const report = lines.join("\n");
const browser = `${JSON.stringify(
  Object.fromEntries(
    ids.map((id) => {
      const a = campaign.animals[id];
      return [
        id,
        {
          phase: a.phase,
          ai: a.progress.ai,
          animation: a.progress.animation,
          validation: a.progress.validation,
          description: a.plan?.signature ?? null,
          scene: a.plan?.scenario ?? null,
          review: a.humanReview.animation,
        },
      ];
    }),
  ),
  null,
  2,
)}\n`;
if (process.argv.includes("--check")) {
  if (readFileSync(reportPath, "utf8") !== report)
    throw Error("Animal behavior report stale; regenerate it");
  if (readFileSync(browserPath, "utf8") !== browser)
    throw Error("Animal browser behavior data stale; regenerate it");
} else {
  writeFileSync(reportPath, report);
  writeFileSync(browserPath, browser);
}
console.log(
  `Behavior ledger: ${ids.length} current animals; ${covered.size}/${Object.keys(roster.tasks).length} original roster covered; ${count((a) => a.progress.audit === "verified")} behavior audits verified.`,
);
