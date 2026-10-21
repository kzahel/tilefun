import { describe, expect, it } from "vitest";
import { actionHint, noteInputSource } from "./InputHints.js";

describe("semantic action hints", () => {
  it("matches gameplay bindings and hides physical hints for touch", () => {
    noteInputSource("controller");
    expect(
      ["jump", "throw", "enter_place", "context_actions", "sprint", "reverse", "honk"].map(
        (action) => actionHint(action as import("./ActionMap.js").ActionName),
      ),
    ).toEqual(["A", "X", "Y", "B", "RT", "LT", "RB"]);
    noteInputSource("keyboard");
    expect(actionHint("context_actions")).toBe("Q");
    expect(actionHint("jump")).toBe("Space");
    noteInputSource("touch");
    expect(actionHint("context_actions")).toBe("");
    noteInputSource("keyboard");
  });
});
