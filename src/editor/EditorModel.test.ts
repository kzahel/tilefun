import { describe, expect, it, vi } from "vitest";
import { EditorModel } from "./EditorModel.js";

describe("EditorModel", () => {
  it("starts with default state", () => {
    const model = new EditorModel();
    expect(model.editorTab).toBe("natural");
    expect(model.brushMode).toBe("tile");
    expect(model.paintMode).toBe("positive");
    expect(model.effectivePaintMode).toBe("positive");
    expect(model.brushSize).toBe(1);
    expect(model.bridgeDepth).toBe(0);
    expect(model.deleteMode).toBe(false);
  });

  it("setTab changes tab and resets non-natural brush/paint", () => {
    const model = new EditorModel();
    model.setBrushMode("subgrid");
    model.setPaintMode("unpaint");

    model.setTab("entities");
    expect(model.editorTab).toBe("entities");
    expect(model.brushMode).toBe("tile");
    expect(model.paintMode).toBe("positive");
    expect(model.deleteMode).toBe(false);
  });

  it("setTab('natural') preserves brush/paint mode", () => {
    const model = new EditorModel();
    model.setBrushMode("corner");
    model.setPaintMode("unpaint");

    model.setTab("natural");
    expect(model.brushMode).toBe("corner");
    expect(model.paintMode).toBe("unpaint");
  });

  it("toggleTab cycles through all tabs", () => {
    const model = new EditorModel();
    const visited: string[] = [model.editorTab];
    for (let i = 0; i < 6; i++) {
      model.toggleTab();
      visited.push(model.editorTab);
    }
    // Should cycle back to start after 6 toggles
    expect(visited[0]).toBe(visited[6]);
    // Should have visited all 6 unique tabs
    expect(new Set(visited).size).toBe(6);
  });

  it("toggleMode cycles through all brush modes", () => {
    const model = new EditorModel();
    expect(model.brushMode).toBe("tile");
    model.toggleMode();
    expect(model.brushMode).toBe("subgrid");
    model.toggleMode();
    expect(model.brushMode).toBe("corner");
    model.toggleMode();
    expect(model.brushMode).toBe("cross");
    model.toggleMode();
    expect(model.brushMode).toBe("x");
    model.toggleMode();
    expect(model.brushMode).toBe("tile");
  });

  it("effectivePaintMode returns unpaint when temporary unpaint active", () => {
    const model = new EditorModel();
    expect(model.effectivePaintMode).toBe("positive");

    model.setTemporaryUnpaint(true);
    expect(model.effectivePaintMode).toBe("unpaint");

    model.setTemporaryUnpaint(false);
    expect(model.effectivePaintMode).toBe("positive");
  });

  it("effectivePaintMode reflects base paint mode when no override", () => {
    const model = new EditorModel();
    model.setPaintMode("unpaint");
    expect(model.effectivePaintMode).toBe("unpaint");
  });

  it("cycleBrushShape cycles 1 → 2 → 3 → 1", () => {
    const model = new EditorModel();
    expect(model.subgridShape).toBe(1);
    model.cycleBrushShape();
    expect(model.subgridShape).toBe(2);
    model.cycleBrushShape();
    expect(model.subgridShape).toBe(3);
    model.cycleBrushShape();
    expect(model.subgridShape).toBe(1);
  });

  it("cycleBridgeDepth cycles 0 → 1 → 2 → 3 → 0", () => {
    const model = new EditorModel();
    expect(model.bridgeDepth).toBe(0);
    model.cycleBridgeDepth();
    expect(model.bridgeDepth).toBe(1);
    model.cycleBridgeDepth();
    expect(model.bridgeDepth).toBe(2);
    model.cycleBridgeDepth();
    expect(model.bridgeDepth).toBe(3);
    model.cycleBridgeDepth();
    expect(model.bridgeDepth).toBe(0);
  });

  it("consumeClearRequest returns pending value then null", () => {
    const model = new EditorModel();
    expect(model.consumeClearRequest()).toBeNull();

    model.requestClear();
    // Uses selectedTerrain as the clear value
    const result = model.consumeClearRequest();
    expect(result).toBe(model.selectedTerrain);
    expect(model.consumeClearRequest()).toBeNull();
  });

  it("consumeRoadClearRequest returns pending flag then false", () => {
    const model = new EditorModel();
    expect(model.consumeRoadClearRequest()).toBe(false);

    model.requestRoadClear();
    expect(model.consumeRoadClearRequest()).toBe(true);
    expect(model.consumeRoadClearRequest()).toBe(false);
  });

  it("brushSize returns subgridShape when numeric", () => {
    const model = new EditorModel();
    model.subgridShape = 2;
    expect(model.brushSize).toBe(2);
    model.subgridShape = 3;
    expect(model.brushSize).toBe(3);
  });

  it("isTerrainTab is true for natural, road, structure", () => {
    const model = new EditorModel();
    model.setTab("natural");
    expect(model.isTerrainTab).toBe(true);
    model.setTab("road");
    expect(model.isTerrainTab).toBe(true);
    model.setTab("structure");
    expect(model.isTerrainTab).toBe(true);
    model.setTab("entities");
    expect(model.isTerrainTab).toBe(false);
    model.setTab("props");
    expect(model.isTerrainTab).toBe(false);
    model.setTab("elevation");
    expect(model.isTerrainTab).toBe(false);
  });

  describe("listeners", () => {
    it("notifies listeners on mutations", () => {
      const model = new EditorModel();
      const listener = vi.fn();
      model.addListener(listener);

      model.setTab("road");
      expect(listener).toHaveBeenCalledTimes(1);

      model.setBrushMode("subgrid");
      expect(listener).toHaveBeenCalledTimes(2);

      model.setPaintMode("unpaint");
      expect(listener).toHaveBeenCalledTimes(3);
    });

    it("unsubscribe stops notifications", () => {
      const model = new EditorModel();
      const listener = vi.fn();
      const unsub = model.addListener(listener);

      model.setTab("road");
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      model.setTab("natural");
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("setTemporaryUnpaint only notifies on actual change", () => {
      const model = new EditorModel();
      const listener = vi.fn();
      model.addListener(listener);

      model.setTemporaryUnpaint(false); // already false — no notify
      expect(listener).toHaveBeenCalledTimes(0);

      model.setTemporaryUnpaint(true);
      expect(listener).toHaveBeenCalledTimes(1);

      model.setTemporaryUnpaint(true); // already true — no notify
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
