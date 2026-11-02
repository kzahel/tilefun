import { describe, expect, it } from "vitest";
import { actionHint, noteInputSource } from "./InputHints.js";

describe("semantic action hints", () => {
  it("matches gameplay bindings and hides physical hints for touch", () => {
    noteInputSource("controller");
    expect(
      ["jump", "throw", "enter_place", "sprint", "reverse", "honk"].map((action) =>
        actionHint(action as import("./ActionMap.js").ActionName),
      ),
    ).toEqual(["A", "X", "Y", "RT", "LT", "RB"]);
    noteInputSource("keyboard");
    expect(actionHint("enter_place")).toBe("E");
    expect(actionHint("jump")).toBe("Space");
    expect(actionHint("honk")).toBe("Space");
    noteInputSource("touch");
    expect(actionHint("enter_place")).toBe("");
    noteInputSource("keyboard");
  });
});
