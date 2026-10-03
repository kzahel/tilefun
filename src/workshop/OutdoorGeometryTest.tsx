import { useEffect, useRef, useState } from "react";
import { type GameAssets, loadSceneAssets } from "../assets/GameAssets.js";
import {
  type OutdoorAsset,
  type OutdoorMetadata,
  outdoorProp,
} from "../assets/outdoor/OutdoorCatalog.js";
import { Spritesheet } from "../assets/Spritesheet.js";
import { TileVariants } from "../assets/TileVariants.js";
import { PIXEL_SCALE } from "../config/constants.js";
import { getEntityAABB } from "../entities/collision.js";
import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import { Camera } from "../rendering/Camera.js";
import { CanvasRenderBackend } from "../rendering/CanvasRenderBackend.js";
import { collectScene } from "../rendering/collectScene.js";
import { collectSceneOrder } from "../rendering/RenderFrame.js";
import { outdoorRecipe } from "../scenarios/OutdoorRecipe.js";
import { ScenarioClient } from "../scenarios/ScenarioClient.js";

const testAssets = new WeakMap<HTMLImageElement, Promise<GameAssets>>();
function geometryAssets(image: HTMLImageElement) {
  let pending = testAssets.get(image);
  if (!pending) {
    const sheet = new Spritesheet(image, 16, 16);
    const assets: GameAssets = {
      sheets: new Map([["me-complete", sheet]]),
      blendSheets: [],
      variants: new TileVariants(sheet),
    };
    pending = loadSceneAssets(assets, new Set(["person1"]))
      .then(() => assets)
      .catch((e) => {
        testAssets.delete(image);
        throw e;
      });
    testAssets.set(image, pending);
  }
  return pending;
}
export function OutdoorGeometryTest({
  asset,
  metadata,
  image,
}: {
  asset: OutdoorAsset;
  metadata: OutdoorMetadata;
  image: HTMLImageElement;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    keys = useRef(new Set<string>()),
    reset = useRef(() => {}),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true,
      frame = 0;
    let cleanup = () => {};
    setError("");
    reset.current = () => {};
    if (canvas.current) {
      canvas.current.dataset.ready = "false";
      delete canvas.current.dataset.playerX;
      delete canvas.current.dataset.playerY;
    }
    const down = (e: KeyboardEvent) => {
      if (canvas.current !== document.activeElement) return;
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", " "].includes(e.key)
      ) {
        keys.current.add(e.key);
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    void (async () => {
      const assets = await geometryAssets(image);
      if (!active || !canvas.current) return;
      const c = canvas.current,
        ctx = c.getContext("2d");
      if (!ctx) return;
      const player = ENTITY_FACTORIES.person1!(0, 40),
        prop = outdoorProp(asset, metadata, 0, 0);
      prop.id = 1;
      player.id = 2;
      const width = Math.max(240, asset.rect[2] + 100),
        height = Math.max(180, asset.rect[3] + 120),
        scale = Math.min(3, 720 / width);
      c.width = Math.ceil(width * scale);
      c.height = Math.ceil(height * scale);
      const camera = new Camera();
      camera.setViewport(c.width, c.height);
      camera.zoom = scale / PIXEL_SCALE;
      camera.snapTo(0, -asset.rect[3] / 3);
      const scenario = new ScenarioClient(outdoorRecipe(asset, metadata));
      cleanup = () => scenario.dispose();
      await scenario.ready;
      if (!active) {
        scenario.dispose();
        return;
      }
      c.dataset.ready = "true";
      const world = scenario.view.world,
        renderer = new CanvasRenderBackend(ctx, assets.sheets);
      cleanup = () => {
        renderer.dispose();
        scenario.dispose();
      };
      const order: number[] = [];
      reset.current = () => {
        void scenario.command({ kind: "teleport", position: { wx: 0, wy: 40 } }).catch((e) => {
          if (active) setError(String(e));
        });
      };
      let last = performance.now();
      const tick = (now: number) => {
        if (!active) return;
        const dt = Math.min(1 / 30, (now - last) / 1000);
        last = now;
        let dx =
            Number(keys.current.has("ArrowRight") || keys.current.has("d")) -
            Number(keys.current.has("ArrowLeft") || keys.current.has("a")),
          dy =
            Number(keys.current.has("ArrowDown") || keys.current.has("s")) -
            Number(keys.current.has("ArrowUp") || keys.current.has("w"));
        const len = Math.hypot(dx, dy);
        if (len) {
          dx /= len;
          dy /= len;
        }
        const before = { ...player.position };
        scenario.step({ dx, dy, jump: keys.current.has(" "), sprinting: false }, dt);
        Object.assign(player, structuredClone(scenario.view.playerEntity));
        const blocked =
          !!(dx || dy) &&
          Math.hypot(player.position.wx - before.wx, player.position.wy - before.wy) < 0.01;
        c.dataset.playerX = String(player.position.wx);
        c.dataset.playerY = String(player.position.wy);
        c.dataset.blocked = String(blocked);
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = "#cbd5c3";
        ctx.fillRect(0, 0, c.width, c.height);
        const drawRect = (r: number[], color: string) => {
          const p = camera.worldToScreen(r[0]!, r[1]!);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.strokeRect(p.sx, p.sy, r[2]! * scale, r[3]! * scale);
        };
        for (let y = -height; y < 100; y += 16)
          for (let x = -width; x < width; x += 16) drawRect([x, y, 16, 16], "#afc0ad");
        const scene = collectScene(
          [player],
          [prop],
          world,
          camera,
          camera.getVisibleChunkRange(),
          1,
          renderer,
          [],
          false,
        );
        renderer.submit(camera, {
          kind: "scene",
          items: scene,
          order: collectSceneOrder(scene, order),
          pixelExactShadows: true,
        });
        const [vx, vy, vw, vh] = asset.visualBounds;
        drawRect([vx - metadata.anchor[0], vy - metadata.anchor[1], vw, vh], "#3472aa");
        if (metadata.footprint) drawRect(metadata.footprint, "#229b61");
        for (const wall of prop.walls ?? []) {
          const b = getEntityAABB(prop.position, wall);
          drawRect([b.left, b.top, b.right - b.left, b.bottom - b.top], "#e54c49");
        }
        const b = getEntityAABB(player.position, player.collider!);
        drawRect([b.left, b.top, b.right - b.left, b.bottom - b.top], "#374956");
        const p = camera.worldToScreen(0, 0);
        ctx.fillStyle = "#f4b032";
        ctx.fillRect(p.sx - 3, p.sy - 3, 6, 6);
        const depth = camera.worldToScreen(0, metadata.depthOffset);
        ctx.strokeStyle = "#a84ac2";
        ctx.beginPath();
        ctx.moveTo(depth.sx - 40, depth.sy);
        ctx.lineTo(depth.sx + 40, depth.sy);
        ctx.stroke();
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      cleanup = () => {
        scenario.dispose();
      };
    })().catch((e) => {
      if (active) setError(String(e));
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      keys.current.clear();
      cleanup();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [asset, metadata, image]);
  const press = (k: string) => keys.current.add(k),
    release = (k: string) => keys.current.delete(k);
  return (
    <section className="geometry-test">
      <h3>Walk around this asset</h3>
      <canvas
        ref={canvas}
        tabIndex={0}
        aria-label="Asset movement test"
        onBlur={() => keys.current.clear()}
      />
      <p>
        Tap the scene, then use arrows / WASD. Blue: image · green: footprint · red: collision ·
        yellow: anchor · purple: depth.
      </p>
      <div className="preview-controls">
        {[
          ["←", "ArrowLeft"],
          ["↑", "ArrowUp"],
          ["↓", "ArrowDown"],
          ["→", "ArrowRight"],
        ].map(([label, k]) => (
          <button
            key={k}
            type="button"
            aria-label={`Walk ${k}`}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              press(k!);
            }}
            onPointerUp={() => release(k!)}
            onPointerCancel={() => release(k!)}
            onLostPointerCapture={() => release(k!)}
          >
            {label}
          </button>
        ))}
        <button type="button" onClick={() => reset.current()}>
          Reset walker
        </button>
      </div>
      {metadata.colliders === null ? (
        <p className="notice">
          Collision is unknown. This test does not assume the image is solid.
        </p>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
