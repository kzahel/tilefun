import { afterEach, describe, expect, it } from "vitest";
import {
  codeForKey,
  eventCode,
  keyLabel,
  learnKeyLabel,
  loadLayoutLabels,
  resetLayoutLabels,
  usKey,
} from "./KeyLabels.js";

afterEach(() => resetLayoutLabels());

const press = (
  code: string,
  key: string,
  modifiers: { altKey?: boolean; shiftKey?: boolean } = {},
) => ({
  code,
  key,
  altKey: modifiers.altKey ?? false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: modifiers.shiftKey ?? false,
});

describe("physical key labels", () => {
  it("uses the code, falling back to the US position of the typed key", () => {
    expect(eventCode({ code: "KeyW", key: "," })).toBe("KeyW");
    expect(eventCode({ code: "", key: "e" })).toBe("KeyE");
    expect(eventCode({ code: "Unidentified", key: " " })).toBe("Space");
    expect(codeForKey("7")).toBe("Digit7");
    expect(codeForKey("ArrowUp")).toBe("ArrowUp");
  });

  it("labels keys by what they type on the player's layout once known", () => {
    expect(keyLabel("KeyE")).toBe("E");
    expect(keyLabel("ShiftLeft")).toBe("Shift");
    expect(keyLabel("Space")).toBe("Space");
    learnKeyLabel(press("KeyE", ".")); // Dvorak
    learnKeyLabel(press("KeyQ", "a")); // AZERTY
    expect(keyLabel("KeyE")).toBe(".");
    expect(keyLabel("KeyQ")).toBe("A");
  });

  it("labels the right-hand scheme's punctuation keys, following the layout once known (226)", async () => {
    expect(["Quote", "Semicolon", "Slash", "Period", "Comma"].map(keyLabel)).toEqual([
      "'",
      ";",
      "/",
      ".",
      ",",
    ]);
    learnKeyLabel(press("Quote", "ù")); // AZERTY
    expect(keyLabel("Quote")).toBe("Ù");
    await loadLayoutLabels({ getLayoutMap: async () => new Map([["Semicolon", "m"]]) });
    expect(keyLabel("Semicolon")).toBe("M");
  });

  it("maps physical keys to US key values for character-named lab input", () => {
    expect(usKey({ code: "KeyW", key: "," })).toBe("w");
    expect(usKey({ code: "Space", key: " " })).toBe(" ");
    expect(usKey({ code: "ShiftRight", key: "Shift" })).toBe("Shift");
    expect(usKey({ code: "ArrowUp", key: "ArrowUp" })).toBe("ArrowUp");
    expect(usKey({ code: "", key: "d" })).toBe("d");
  });

  it("does not learn shifted characters or override the browser's layout map", async () => {
    learnKeyLabel(press("KeyW", "<", { shiftKey: true })); // Dvorak Shift+W
    expect(keyLabel("KeyW")).toBe("W");
    await loadLayoutLabels({ getLayoutMap: async () => new Map([["KeyW", ","]]) });
    learnKeyLabel(press("KeyW", "x"));
    expect(keyLabel("KeyW")).toBe(",");
  });

  it("ignores modified and non-printing presses", () => {
    learnKeyLabel(press("KeyE", "€", { altKey: true }));
    learnKeyLabel(press("ArrowUp", "ArrowUp"));
    learnKeyLabel(press("Space", " "));
    expect(keyLabel("KeyE")).toBe("E");
    expect(keyLabel("ArrowUp")).toBe("↑");
  });

  it("reads the browser's keyboard layout map when available", async () => {
    await loadLayoutLabels({
      getLayoutMap: async () =>
        new Map([
          ["KeyW", ","],
          ["KeyA", "a"],
          ["Backslash", "\\\\"],
        ]),
    });
    expect(keyLabel("KeyW")).toBe(",");
    expect(keyLabel("KeyA")).toBe("A");
    await loadLayoutLabels({
      getLayoutMap: () => Promise.reject(new Error("blocked")),
    });
    expect(keyLabel("KeyW")).toBe(",");
    await loadLayoutLabels(undefined);
  });
});
