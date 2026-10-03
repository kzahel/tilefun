import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createSpriteCatalog } from "../assets/SpriteCatalog.js";
import { Spritesheet } from "../assets/Spritesheet.js";
import { Camera } from "../rendering/Camera.js";
import { drawOverlayGeometry } from "../rendering/CanvasOverlayRenderer.js";
import { OverlayFrame } from "../rendering/OverlayFrame.js";
import { Chunk } from "../world/Chunk.js";
import type { World } from "../world/World.js";
import { collectEditorOverlay, collectRemoteCursors } from "./collectEditorOverlay.js";
import type { EditorMode } from "./EditorMode.js";
import { EditorModel } from "./EditorModel.js";

/** Record effective geometry/styles, excluding irrelevant save/restore mechanics. */
function recorder() {
  let state = {
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    globalAlpha: 1,
    font: "10px sans-serif",
    textAlign: "start",
    textBaseline: "alphabetic",
  };
  const stack: (typeof state)[] = [];
  let path: unknown[] = [];
  const operations: unknown[] = [];
  const ctx = new Proxy(
    {
      canvas: { width: 390, height: 844 },
      save: () => stack.push({ ...state }),
      restore: () => {
        const s = stack.pop();
        if (s) state = s;
      },
      beginPath: () => {
        path = [];
      },
      moveTo: (...a: number[]) => path.push(["move", ...a]),
      lineTo: (...a: number[]) => path.push(["line", ...a]),
      arc: (...a: number[]) => path.push(["arc", ...a]),
      stroke: () =>
        operations.push(["stroke", path, state.strokeStyle, state.lineWidth, state.globalAlpha]),
      fill: () => operations.push(["fill", path, state.fillStyle, state.globalAlpha]),
      fillRect: (...a: number[]) =>
        operations.push(["rect", ...a, state.fillStyle, state.globalAlpha]),
      strokeRect: (...a: number[]) =>
        operations.push(["border", ...a, state.strokeStyle, state.lineWidth, state.globalAlpha]),
      fillText: (...a: unknown[]) =>
        operations.push([
          "text",
          ...a,
          state.fillStyle,
          state.font,
          state.textAlign,
          state.textBaseline,
          state.globalAlpha,
        ]),
      drawImage: (_image: unknown, ...a: number[]) =>
        operations.push(["sprite", ...a, state.globalAlpha]),
    },
    {
      get(target, key) {
        return key in state ? state[key as keyof typeof state] : target[key as keyof typeof target];
      },
      set(_target, key, value) {
        (state as unknown as Record<PropertyKey, unknown>)[key] = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, operations };
}

// Effective draw operations captured from the pre-refactor renderer at d613cfd.
// Includes floating-point geometry, alpha, text alignment and brush overlap.
const originalHashes: Record<string, string> = {
  tile: "96671e7baddea42c3d62deec7c2186b11cf23c333419002699e45a31df234145",
  erase: "f775f7e2340b7397cb38ff278ff6e8dc81cfd67c03d6542f164e0ba6ef9cb18d",
  bridge: "647ed06376e762e20014e79ade4e8bb10b24b6bbd11306c650c66230d01da604",
  subgrid1: "f9a465eb0443d9df22fdcd7bf8163d9150fe867fd6851d8e0612158a6d978f06",
  subgrid2: "d920129f15ed01b0e9adf2d2e063298abc434243606eb0444465b78377c35b52",
  subgrid3: "1bb22973be24df69aac35dd31ab19d6a1d10ea19b074b569d014709a81a65333",
  cross: "7d052e452d127ead997b680a12c153c301c096fb35c6fbb229fd7da0401453fd",
  x: "1cc924c7b2993fbae21bc3aeb79466a73c8744647e96b4487b53d02c64b0208e",
  corner: "b38bed6d6f69aec21f3299842fa21f1e3010209f03198b73d7d468004daa3e64",
  cornerErase: "49a3da75918bb6e50f6b1dea00fcf596d0d59f6bdf1aa4412d317a3af57d2641",
  elevation: "53fc9aa2c5732bd8c4f86009e62ddd140166345c6c10024d6b33f9b1a77e09d4",
  props: "96671e7baddea42c3d62deec7c2186b11cf23c333419002699e45a31df234145",
  room: "d22889984a5f6806909219c9acd125a45e72f4e0f8e5af113f78d5ee9e54e896",
  roomError: "ee9b01ab1c9adb08454585d722b24f37eddde85184e6bcd95698e04b5e794822",
  pattern: "da0a923659a52d5495065e0aded19dc7a3247cae16461f05f6c9a19580723ff6",
  patternError: "41c41ba5f55bb1c06682b989eef00ef41c0750170725d96e727104dd565eb862",
};

const cases = [
  "tile",
  "erase",
  "bridge",
  "subgrid1",
  "subgrid2",
  "subgrid3",
  "cross",
  "x",
  "corner",
  "cornerErase",
  "elevation",
  "props",
  "room",
  "roomError",
  "pattern",
  "patternError",
];

describe("editor overlay geometry parity", () => {
  for (const name of cases)
    it(name, () => {
      const model = new EditorModel();
      if (name === "erase" || name === "cornerErase") model.paintMode = "unpaint";
      if (name === "bridge") model.bridgeDepth = 1;
      if (name.startsWith("subgrid")) {
        model.brushMode = "subgrid";
        model.subgridShape = Number(name.at(-1)) as 1 | 2 | 3;
      }
      if (name === "cross" || name === "x") model.brushMode = name;
      if (name.startsWith("corner")) model.brushMode = "corner";
      if (name === "elevation") {
        model.editorTab = "elevation";
        model.elevationGridSize = 3;
      }
      if (name === "props") {
        model.editorTab = "props";
        model.brushMode = "corner";
        model.paintMode = "unpaint";
      }
      if (name.startsWith("room")) {
        model.indoor = true;
        model.editorTab = "patterns";
      }
      if (name.startsWith("pattern")) model.editorTab = "patterns";
      const camera = new Camera();
      camera.setViewport(390, 844);
      camera.x = 1.25;
      camera.y = 9.5;
      camera.zoom = 0.6;
      const editor = {
        cursorTileX: 3,
        cursorTileY: 4,
        cursorSubgridX: 6,
        cursorSubgridY: 8,
        cursorCornerX: 6,
        cursorCornerY: 8,
        roomState: { document: { width: 5, height: 4 } },
        getRoomPreview: () => ({
          points: [{ x: 1, y: 2 }],
          error: name === "roomError" ? "Room error" : "",
        }),
        getPatternPreview: () => ({
          runs: [{ x: 2, y: 3, length: 4 }],
          points: [{ x: 2, y: 3 }],
          error: name === "patternError" ? "Pattern error" : "",
          erase: false,
        }),
      } as unknown as EditorMode;
      const chunk = new Chunk();
      chunk.setHeight(1, 1, 2);
      const world = {
        getChunkIfLoaded: (x: number, y: number) => (x === 0 && y === 0 ? chunk : undefined),
      } as unknown as World;
      const sheets = new Map([
        [
          "me-complete",
          new Spritesheet({ width: 4096, height: 4096 } as HTMLCanvasElement, 16, 16),
        ],
      ]);
      const visible = { minCx: 0, minCy: 0, maxCx: 0, maxCy: 0 };
      const cursors = [
        {
          editorTab: "natural",
          brushMode: "tile",
          tileX: 4,
          tileY: 5,
          color: "#12a3ef",
          displayName: "Parent",
        },
      ];
      const frame = new OverlayFrame();
      collectEditorOverlay(
        frame,
        camera,
        editor,
        model,
        visible,
        world,
        createSpriteCatalog(sheets),
      );
      collectRemoteCursors(frame, camera, cursors);
      const next = recorder();
      drawOverlayGeometry(next.ctx, frame.items, sheets);
      expect(createHash("sha256").update(JSON.stringify(next.operations)).digest("hex")).toBe(
        originalHashes[name],
      );
    });

  it("reuses warm records, clears strings and bounds oversized retention", () => {
    const frame = new OverlayFrame();
    frame.label("Old label", 0, 0, "red", "14px monospace");
    const first = frame.items[0];
    frame.release();
    expect(first?.text).toBe("");
    frame.rect(0, 0, 16, 16, "blue");
    expect(frame.items[0]).toBe(first);
    for (let i = 0; i < 4096; i++) frame.rect(i, 0, 1, 1, "red");
    const excess = frame.items[4096];
    frame.release();
    for (let i = 0; i < 4097; i++) frame.rect(i, 0, 1, 1, "red");
    expect(frame.items[4096]).not.toBe(excess);
    frame.clear();
    expect(frame.items).toEqual([]);
  });
});
