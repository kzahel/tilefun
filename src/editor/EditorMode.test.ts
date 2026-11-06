import { afterEach, describe, expect, it, vi } from "vitest";
import { TILE_SIZE } from "../config/constants.js";
import type { ActionManager } from "../input/ActionManager.js";
import type { Camera } from "../rendering/Camera.js";
import { EditorMode } from "./EditorMode.js";
import { EditorModel } from "./EditorModel.js";

type Listener = (event: unknown) => void;

function touchEditor() {
  const listeners = new Map<string, Listener>();
  const canvas = {
    width: 400,
    height: 400,
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 }),
  };
  vi.stubGlobal("window", { addEventListener: () => {}, removeEventListener: () => {} });
  const camera: Pick<Camera, "screenToWorld"> = { screenToWorld: (sx, sy) => ({ wx: sx, wy: sy }) };
  const model = new EditorModel();
  model.editorTab = "natural";
  model.brushMode = "corner";
  const editor = new EditorMode(
    canvas as unknown as HTMLCanvasElement,
    camera as Camera,
    {} as ActionManager,
    model,
  );
  editor.attach();
  const tap = (x: number, y: number) => {
    const touch = { identifier: 1, clientX: x, clientY: y };
    const event = { changedTouches: [touch], touches: [], type: "touchend", preventDefault() {} };
    listeners.get("touchstart")?.({ ...event, type: "touchstart", touches: [touch] });
    listeners.get("touchend")?.(event);
  };
  return { editor, tap };
}

afterEach(() => vi.unstubAllGlobals());

describe("EditorMode touch painting", () => {
  it("paints separate corner taps without connecting them", () => {
    const { editor, tap } = touchEditor();
    tap(0, 0);
    tap(4 * TILE_SIZE, 0);
    expect(editor.consumePendingCornerEdits().map((e) => [e.gsx, e.gsy])).toEqual([
      [0, 0],
      [8, 0],
    ]);
    tap(4 * TILE_SIZE, 0);
    expect(editor.consumePendingCornerEdits()).toHaveLength(1);
  });
});
