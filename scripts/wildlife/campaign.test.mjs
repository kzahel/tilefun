import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { gateErrors, queue, receiptErrors, safeArtifact } from "./campaign.mjs";

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
