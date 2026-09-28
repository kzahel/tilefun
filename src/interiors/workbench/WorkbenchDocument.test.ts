import { describe, expect, it } from "vitest";
import {
  builtInDocuments,
  compileWorkbenchDocument,
  issueSnapshot,
  paintPlanRectangle,
  parseWorkbenchDocument,
} from "./WorkbenchDocument.js";

describe("indoor workbench documents", () => {
  it("paints rectangular semantic zones while preserving the grid size", () => {
    const source = "######\n#BBBB#\n#BBBB#\n##+###";
    const painted = paintPlanRectangle(source, 1, 1, 2, 2, "L");
    expect(painted).toBe("######\n#LLBB#\n#LLBB#\n##+###");
    expect(painted.split("\n").map((row) => row.length)).toEqual([6, 6, 6, 6]);
  });

  it("keeps the generated tile stack in a feedback snapshot", () => {
    const document = builtInDocuments()[0];
    if (!document) throw new Error("Small apartment fixture is missing");
    const { generated } = compileWorkbenchDocument(document);
    const snapshot = issueSnapshot(document.sketch, generated, 2, 0);
    expect(snapshot.planCell).toBe("#");
    expect(snapshot.semantic).toBe("wall");
    expect(snapshot.tiles.wall[0]).toMatch(/^room-builder\/3d-walls\//);
  });

  it("rejects incomplete imported feedback files", () => {
    expect(() => parseWorkbenchDocument({ version: 1, sketch: "###" })).toThrow(
      /needs version, name, sketch, overrides, and issues/,
    );
  });
});
