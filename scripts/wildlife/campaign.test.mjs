import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { gateErrors, motionGateErrors, queue, receiptErrors, safeArtifact } from "./campaign.mjs";

const digest = (value) => createHash("sha256").update(value).digest("hex");
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "tilefun-fresh-wildlife-"));
  t.after(() => {
    assert.ok(
      root.startsWith(resolve(tmpdir()) + "/") || root.startsWith(resolve(tmpdir()) + "\\"),
    );
    rmSync(root, { recursive: true, force: true });
  });
  function write(path, value) {
    const full = join(root, path);
    mkdirSync(resolve(full, ".."), { recursive: true });
    writeFileSync(full, typeof value === "string" ? value : JSON.stringify(value));
  }
  function receipt(id) {
    const artifacts = {};
    for (const file of [
      "source.blend",
      "guides.json",
      "masters.json",
      "sheet.png",
      "sprite.json",
      "preview.gif",
      "scene.png",
    ]) {
      const path = `art-source/wildlife-v2/${id}/${file}`;
      write(path, `${id} ${file}`);
      artifacts[path] = digest(`${id} ${file}`);
    }
    return {
      id,
      status: "draft-ready",
      reviewStatus: "pending",
      model: "gpt-6.1-sol",
      effort: "high",
      sessionId: "actual-session",
      artifacts,
      visualReview: {
        observer: "coordinator",
        checks: Object.fromEntries(
          [
            "projection",
            "anatomy",
            "headVolume",
            "contacts",
            "continuousPlayback",
            "sceneScale",
          ].map((key) => [
            key,
            `Concrete inspected observation for ${key}, with actual retained image evidence.`,
          ]),
        ),
      },
    };
  }
  const receipts = Object.fromEntries(["fox", "elephant", "rabbit"].map((id) => [id, receipt(id)]));
  write("art-source/wildlife-v2/camera.json", "fixed-camera");
  const gate = {
    reviewer: "coordinator",
    model: "gpt-6.1-sol",
    effort: "high",
    cameraPath: "art-source/wildlife-v2/camera.json",
    cameraSha256: digest("fixed-camera"),
    receiptSha256: Object.fromEntries(
      Object.entries(receipts).map(([id, r]) => [id, digest(JSON.stringify(r))]),
    ),
  };
  return { root, write, receipts, receipt, gate };
}

test("background remains blocked without supervised pilot gate", (t) => {
  const f = fixture(t);
  assert.match(gateErrors(f.root, null, f.receipts)[0], /absent/);
});
test("changed camera or pilot pixels invalidate launch gate", (t) => {
  const f = fixture(t);
  assert.deepEqual(gateErrors(f.root, f.gate, f.receipts), []);
  f.write("art-source/wildlife-v2/fox/sheet.png", "changed pixels");
  assert.ok(gateErrors(f.root, f.gate, f.receipts).some((e) => e.includes("Changed")));
  f.write("art-source/wildlife-v2/camera.json", "different angle");
  assert.ok(gateErrors(f.root, f.gate, f.receipts).includes("Camera contract changed"));
});
test("worker review cannot stand in for supervised coordinator review", (t) => {
  const f = fixture(t);
  f.receipts.fox.visualReview.observer = "production-agent";
  assert.ok(
    gateErrors(f.root, f.gate, f.receipts).some((e) => /coordinator review absent/.test(e)),
  );
});
test("low reasoning and claimed approval fail fresh receipt", (t) => {
  const f = fixture(t);
  f.receipts.fox.effort = "low";
  assert.ok(receiptErrors(f.root, f.receipts.fox, "fox").includes("Wrong model/effort"));
  f.receipts.fox.reviewStatus = "approved";
  assert.match(receiptErrors(f.root, f.receipts.fox, "fox")[0], /pending/);
});
test("old campaign paths and traversal cannot count as fresh sources", (t) => {
  const f = fixture(t);
  assert.throws(() => safeArtifact(f.root, "public/demos/pixel-wildlife/fox/sheet.png"));
  assert.throws(() => safeArtifact(f.root, "art-source/wildlife-v2/../../../../secret"));
});
test("generic inspected claim and missing editable source do not unlock", (t) => {
  const f = fixture(t);
  f.receipts.fox.visualReview.checks.projection = "inspected";
  delete f.receipts.fox.artifacts["art-source/wildlife-v2/fox/source.blend"];
  const errors = receiptErrors(f.root, f.receipts.fox, "fox");
  assert.ok(errors.some((e) => e.includes("projection")));
  assert.ok(errors.includes("Missing .blend"));
});
test("fresh queue starts at next species and blocks an invalid prototype's siblings", (t) => {
  const f = fixture(t);
  const animals = ["fox", "elephant", "rabbit", "giraffe", "mallard-duck", "robin"].map((id) => ({
    id,
    form: "natural",
    bodyPlan:
      id === "rabbit" ? "hopper" : ["mallard-duck", "robin"].includes(id) ? "winged" : "quadruped",
    media: ["ground"],
  }));
  f.write("art-source/wildlife-v2/roster.json", { animals });
  f.write("data/wildlife-campaign-v2/progress.json", { receipts: f.receipts, tasks: {} });
  f.write("data/wildlife-campaign-v2/pilot-gate.json", f.gate);
  assert.equal(queue(f.root).next.id, "giraffe");
  f.write("data/wildlife-campaign-v2/progress.json", {
    receipts: f.receipts,
    tasks: { giraffe: { status: "blocked" }, "mallard-duck": { status: "blocked" } },
  });
  assert.equal(queue(f.root).next, null);
});

test("different animal families and gait sets require independent prototypes", (t) => {
  const f = fixture(t);
  f.write("art-source/wildlife-v2/roster.json", {
    animals: [
      {
        id: "rabbit",
        family: "Farm",
        form: "natural",
        bodyPlan: "hopper",
        media: ["ground"],
        locomotion: ["hop"],
      },
      {
        id: "kangaroo",
        family: "Marsupials",
        form: "natural",
        bodyPlan: "hopper",
        media: ["ground"],
        locomotion: ["hop"],
      },
      {
        id: "hare",
        family: "Farm",
        form: "natural",
        bodyPlan: "hopper",
        media: ["ground"],
        locomotion: ["run"],
      },
    ],
  });
  f.write("data/wildlife-campaign-v2/progress.json", { receipts: f.receipts, tasks: {} });
  f.write("data/wildlife-campaign-v2/pilot-gate.json", f.gate);
  const tasks = queue(f.root).tasks;
  assert.equal(tasks.find((task) => task.id === "kangaroo").prototype, "kangaroo");
  assert.equal(tasks.find((task) => task.id === "hare").prototype, "hare");
});

test("owner production hold prevents selecting or launching another animal", (t) => {
  const f = fixture(t);
  f.write("art-source/wildlife-v2/roster.json", {
    animals: ["fox", "elephant", "rabbit", "giraffe"].map((id) => ({
      id,
      form: "natural",
      bodyPlan: "quadruped",
      media: ["ground"],
    })),
  });
  f.write("data/wildlife-campaign-v2/progress.json", { receipts: f.receipts, tasks: {} });
  f.write("data/wildlife-campaign-v2/pilot-gate.json", f.gate);
  assert.equal(queue(f.root).next.id, "giraffe");
  f.write("data/wildlife-campaign-v2/production-hold.json", {
    active: true,
    reason: "Owner rejected rigid walking torsos; correction prototypes required.",
  });
  assert.equal(queue(f.root).next, null);
  assert.match(queue(f.root).errors.join(" "), /Production paused: Owner rejected/);
});

test("motion hold preserves the receipt but removes readiness and sibling gate", (t) => {
  const f = fixture(t);
  const giraffe = { ...f.receipt("giraffe"), revision: "draft-v1" };
  const preserved = JSON.stringify(giraffe);
  f.write("art-source/wildlife-v2/roster.json", {
    animals: ["fox", "elephant", "rabbit", "giraffe", "horse"].map((id) => ({
      id,
      family: ["giraffe", "horse"].includes(id) ? "Hoofed" : id,
      form: "natural",
      bodyPlan: "quadruped",
      media: ["ground"],
    })),
  });
  f.write("data/wildlife-campaign-v2/progress.json", {
    receipts: { ...f.receipts, giraffe },
    tasks: { giraffe: { status: "draft-ready" } },
  });
  f.write("data/wildlife-campaign-v2/pilot-gate.json", f.gate);
  assert.equal(queue(f.root).next.id, "horse");
  f.write("data/wildlife-campaign-v2/production-hold.json", {
    active: false,
    affected: { giraffe: { revision: "draft-v1", reason: "Torso transfer needs review." } },
  });
  const result = queue(f.root);
  assert.equal(result.tasks.find((task) => task.id === "giraffe").valid, false);
  assert.equal(result.valid, 3);
  assert.equal(result.next, null);
  assert.deepEqual(receiptErrors(f.root, giraffe, "giraffe"), []);
  assert.equal(JSON.stringify(giraffe), preserved);
});

test("new revision does not bypass an active global correction hold", (t) => {
  const f = fixture(t);
  const giraffe = { ...f.receipt("giraffe"), revision: "draft-v2" };
  f.write("art-source/wildlife-v2/roster.json", {
    animals: ["fox", "elephant", "rabbit", "giraffe"].map((id) => ({
      id,
      form: "natural",
      bodyPlan: "quadruped",
      media: ["ground"],
    })),
  });
  f.write("data/wildlife-campaign-v2/progress.json", {
    receipts: { ...f.receipts, giraffe },
    tasks: {},
  });
  f.write("data/wildlife-campaign-v2/pilot-gate.json", f.gate);
  const hold = {
    active: true,
    reason: "Coordinator has not reviewed correction pilots.",
    affected: { giraffe: { revision: "draft-v1", reason: "Old frozen torso." } },
  };
  f.write("data/wildlife-campaign-v2/production-hold.json", hold);
  assert.equal(queue(f.root).tasks.find((task) => task.id === "giraffe").qualityHold, null);
  assert.match(queue(f.root).errors.join(" "), /Production paused/);
  f.write("data/wildlife-campaign-v2/production-hold.json", { ...hold, active: false });
  assert.deepEqual(queue(f.root).errors, []);
});

test("malformed hold state fails closed instead of ignoring owner feedback", (t) => {
  const f = fixture(t);
  f.write("art-source/wildlife-v2/roster.json", { animals: [] });
  f.write("data/wildlife-campaign-v2/production-hold.json", "{broken");
  assert.throws(() => queue(f.root), SyntaxError);
});

function motionFixture(t) {
  const f = fixture(t);
  const contract = {
    identity: "body-motion-20261004",
    correctionPrototypes: ["sheep", "piglet"],
    affected: { sheep: { revision: "draft-v1" }, piglet: { revision: "draft-v1" } },
  };
  f.write("art-source/wildlife-v2/body-motion-contract.json", contract);
  const receipts = Object.fromEntries(
    contract.correctionPrototypes.map((id) => {
      const receipt = {
        ...f.receipt(id),
        revision: "draft-v2",
        motionContract: contract.identity,
      };
      receipt.visualReview.checks.weightTransfer =
        "Inspected all facings: native body rise and support transfer survive finishing and match travel contacts.";
      return [id, receipt];
    }),
  );
  const gate = {
    reviewer: "coordinator",
    model: "gpt-6.1-sol",
    effort: "high",
    contract: contract.identity,
    contractSha256: digest(JSON.stringify(contract)),
    receiptSha256: Object.fromEntries(
      Object.entries(receipts).map(([id, receipt]) => [id, digest(JSON.stringify(receipt))]),
    ),
  };
  return { ...f, contract, motionReceipts: receipts, motionGate: gate };
}

test("tracked motion contract blocks restart even if local owner hold is absent", (t) => {
  const f = motionFixture(t);
  f.write("art-source/wildlife-v2/roster.json", {
    animals: ["fox", "elephant", "rabbit", "giraffe"].map((id) => ({
      id,
      form: "natural",
      bodyPlan: "quadruped",
      media: ["ground"],
    })),
  });
  f.write("data/wildlife-campaign-v2/progress.json", { receipts: f.receipts, tasks: {} });
  f.write("data/wildlife-campaign-v2/pilot-gate.json", f.gate);
  assert.equal(queue(f.root).next, null);
  assert.match(queue(f.root).errors.join(" "), /body-motion correction gate is absent/);
});

test("motion gate pins corrected prototype pixels and contract bytes", (t) => {
  const f = motionFixture(t);
  assert.deepEqual(motionGateErrors(f.root, f.contract, f.motionGate, f.motionReceipts), []);
  f.write("art-source/wildlife-v2/sheep/sheet.png", "changed corrected pixels");
  assert.match(
    motionGateErrors(f.root, f.contract, f.motionGate, f.motionReceipts).join(" "),
    /Changed or invalid artifact/,
  );
  f.write("art-source/wildlife-v2/body-motion-contract.json", { ...f.contract, changed: true });
  assert.ok(
    motionGateErrors(f.root, f.contract, f.motionGate, f.motionReceipts).includes(
      "Body-motion contract changed",
    ),
  );
});

test("old revisions, worker claims and absent motion observations cannot unlock", (t) => {
  const f = motionFixture(t);
  f.motionReceipts.sheep.revision = "draft-v1";
  f.motionReceipts.piglet.visualReview.observer = "production-agent";
  delete f.motionReceipts.piglet.visualReview.checks.weightTransfer;
  const errors = motionGateErrors(f.root, f.contract, f.motionGate, f.motionReceipts);
  assert.ok(errors.includes("sheep: new coordinator-reviewed motion revision required"));
  assert.ok(errors.includes("piglet: new coordinator-reviewed motion revision required"));
  assert.ok(errors.includes("piglet: missing concrete weight-transfer review"));
  delete f.motionReceipts.sheep;
  assert.doesNotThrow(() => motionGateErrors(f.root, f.contract, f.motionGate, f.motionReceipts));
});

test("future walkers cannot count as ready without current motion review", (t) => {
  const f = motionFixture(t);
  const giraffe = { ...f.receipt("giraffe"), revision: "draft-v2" };
  f.write("art-source/wildlife-v2/roster.json", {
    animals: [
      {
        id: "giraffe",
        form: "natural",
        bodyPlan: "quadruped",
        media: ["ground"],
        locomotion: ["walk"],
      },
    ],
  });
  const save = () =>
    f.write("data/wildlife-campaign-v2/progress.json", {
      receipts: { ...f.receipts, ...f.motionReceipts, giraffe },
      tasks: {},
    });
  f.write("data/wildlife-campaign-v2/pilot-gate.json", f.gate);
  f.write("data/wildlife-campaign-v2/body-motion-gate.json", f.motionGate);
  save();
  assert.equal(queue(f.root).valid, 0);
  assert.match(queue(f.root).tasks[0].errors.join(" "), /body-motion contract/);
  giraffe.motionContract = f.contract.identity;
  giraffe.visualReview.checks.weightTransfer =
    "Observed native shoulder/pelvis transfer through both travel cycles in all four facings.";
  save();
  assert.equal(queue(f.root).valid, 1);
});

test("repair-only scope prevents new species selection after motion gates pass", (t) => {
  const f = motionFixture(t);
  f.write("art-source/wildlife-v2/roster.json", {
    animals: [
      {
        id: "sheep",
        family: "Farm",
        form: "natural",
        bodyPlan: "quadruped",
        media: ["ground"],
        locomotion: ["walk"],
      },
      { id: "robin", family: "Birds", form: "natural", bodyPlan: "winged", media: ["air"] },
    ],
  });
  f.write("data/wildlife-campaign-v2/progress.json", {
    receipts: { ...f.receipts, ...f.motionReceipts },
    tasks: {},
  });
  f.write("data/wildlife-campaign-v2/pilot-gate.json", f.gate);
  f.write("data/wildlife-campaign-v2/body-motion-gate.json", f.motionGate);
  assert.equal(queue(f.root).next.id, "robin");
  f.write("art-source/wildlife-v2/repair-scope.json", {
    allowNewAnimals: false,
    existingAnimalIds: ["sheep"],
    repairCandidates: ["sheep"],
    priority: ["sheep"],
  });
  const result = queue(f.root);
  assert.equal(result.next, null);
  assert.match(result.errors.join(" "), /New animal production disabled/);
  assert.equal(result.tasks.find((task) => task.id === "robin").state, "out-of-scope");
  assert.deepEqual(result.repairs, []);
});

test("repair list includes only unresolved candidates with existing source receipts", (t) => {
  const f = motionFixture(t);
  const sheep = { ...f.receipt("sheep"), revision: "draft-v1" };
  f.write("art-source/wildlife-v2/roster.json", {
    animals: ["sheep", "goat", "robin"].map((id) => ({
      id,
      form: "natural",
      bodyPlan: "quadruped",
      media: ["ground"],
      locomotion: ["walk"],
    })),
  });
  f.write("data/wildlife-campaign-v2/progress.json", {
    receipts: { ...f.receipts, sheep },
    tasks: {},
  });
  f.write("data/wildlife-campaign-v2/pilot-gate.json", f.gate);
  f.write("art-source/wildlife-v2/repair-scope.json", {
    allowNewAnimals: false,
    existingAnimalIds: ["sheep", "goat"],
    repairCandidates: ["sheep", "goat"],
    priority: ["goat", "sheep"],
  });
  assert.deepEqual(
    queue(f.root).repairs.map((task) => task.id),
    ["sheep"],
  );
});

test("coordinator inspection can preserve already-good pixels and old receipt", (t) => {
  const f = motionFixture(t);
  const sheep = { ...f.receipt("sheep"), revision: "draft-v1" };
  const preserved = JSON.stringify(sheep);
  f.write("art-source/wildlife-v2/roster.json", {
    animals: [
      {
        id: "sheep",
        form: "natural",
        bodyPlan: "quadruped",
        media: ["ground"],
        locomotion: ["walk"],
      },
    ],
  });
  f.write("data/wildlife-campaign-v2/progress.json", {
    receipts: { ...f.receipts, sheep },
    tasks: {},
  });
  f.write("data/wildlife-campaign-v2/pilot-gate.json", f.gate);
  f.write("art-source/wildlife-v2/repair-scope.json", {
    allowNewAnimals: false,
    existingAnimalIds: ["sheep"],
    repairCandidates: ["sheep"],
    priority: ["sheep"],
  });
  assert.equal(queue(f.root).valid, 0);
  const inspection = {
    result: "already-compliant",
    observer: "coordinator",
    revision: sheep.revision,
    motionContract: f.contract.identity,
    receiptSha256: digest(JSON.stringify(sheep)),
    contractSha256: digest(JSON.stringify(f.contract)),
    weightTransfer:
      "Coordinator inspected native/transferred body motion and planted contacts in every direction.",
  };
  const save = () =>
    f.write("data/wildlife-campaign-v2/body-motion-audits.json", {
      entries: { sheep: inspection },
    });
  save();
  assert.equal(queue(f.root).valid, 1);
  assert.deepEqual(queue(f.root).repairs, []);
  assert.equal(JSON.stringify(sheep), preserved);
  inspection.observer = "production-agent";
  save();
  assert.equal(queue(f.root).valid, 0);
  inspection.observer = "coordinator";
  inspection.receiptSha256 = "wrong receipt";
  save();
  assert.equal(queue(f.root).valid, 0);
});
