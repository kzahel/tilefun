import { describe, expect, it } from "vitest";
import { ConsoleEngine } from "./ConsoleEngine.js";

describe("ConsoleEngine completion", () => {
  it("treats trailing space as argument completion context", () => {
    const engine = new ConsoleEngine();
    engine.cvars.register({
      name: "cl_test_bool",
      description: "test boolean cvar",
      type: "boolean",
      defaultValue: false,
      category: "cl",
    });

    const detail = engine.completeDetailed("/cl_test_bool ");
    expect(detail.isNameCompletion).toBe(false);
    expect(detail.values).toEqual(["0", "1", "true", "false"]);
  });

  it("completes command/cvar names from slash-prefixed input", () => {
    const engine = new ConsoleEngine();
    engine.cvars.register({
      name: "cl_test_number",
      description: "test number cvar",
      type: "number",
      defaultValue: 5,
      min: 0,
      max: 10,
      category: "cl",
    });

    const names = engine.complete("/cl_test_n");
    expect(names).toContain("cl_test_number");
  });

  it("offers numeric cvar value hints (current/default/min/max)", () => {
    const engine = new ConsoleEngine();
    const cv = engine.cvars.register<number>({
      name: "cl_hint_num",
      description: "numeric hint cvar",
      type: "number",
      defaultValue: 3,
      min: 1,
      max: 9,
      category: "cl",
    });
    cv.set(7);

    const detail = engine.completeDetailed("/cl_hint_num ");
    expect(detail.isNameCompletion).toBe(false);
    expect(detail.values).toContain("7");
    expect(detail.values).toContain("3");
    expect(detail.values).toContain("1");
    expect(detail.values).toContain("9");
  });
});
