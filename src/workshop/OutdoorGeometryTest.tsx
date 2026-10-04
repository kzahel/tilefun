import { useEffect, useRef, useState } from "react";
import { closeAssets, type GameAssets, loadSceneAssets } from "../assets/GameAssets.js";
import {
  type OutdoorAsset,
  type OutdoorMetadata,
  outdoorProp,
} from "../assets/outdoor/OutdoorCatalog.js";
import { Spritesheet } from "../assets/Spritesheet.js";
import { TileVariants } from "../assets/TileVariants.js";
import { PIXEL_SCALE } from "../config/constants.js";
import { getEntityAABB } from "../entities/collision.js";
import type { Camera } from "../rendering/Camera.js";
import { interpolatePosition } from "../rendering/collectScene.js";
import type { OverlayFrame } from "../rendering/OverlayFrame.js";
import { outdoorRecipe } from "../scenarios/OutdoorRecipe.js";
import { ScenarioPresentationHost } from "../scenarios/ScenarioPresentationHost.js";

/** Each host owns its walker bitmap; the catalog's HTML image is borrowed. */
async function geometryAssets(image: HTMLImageElement): Promise<GameAssets> {
  const sheet = new Spritesheet(image, 16, 16);
  const assets: GameAssets = {
    sheets: new Map([["me-complete", sheet]]),
    blendSheets: [],
    variants: new TileVariants(sheet),
  };
  try {
    await loadSceneAssets(assets, new Set(["person1"]));
    return assets;
  } catch (error) {
    closeAssets(assets);
    throw error;
  }
}

function drawRect(
  frame: OverlayFrame,
  camera: Camera,
  r: readonly [number, number, number, number],
  color: string,
) {
  const p = camera.worldToScreen(r[0], r[1]);
  frame.rect(p.sx, p.sy, r[2] * camera.scale, r[3] * camera.scale, "", color);
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
    const c = canvas.current;
    if (!c) return;
    let active = true;
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

    const prop = outdoorProp(asset, metadata, 0, 0);
    const width = Math.max(240, asset.rect[2] + 100);
    const height = Math.max(180, asset.rect[3] + 120);
    const scale = Math.min(3, 720 / width);
    const reportError = (e: unknown) => {
      if (active) {
        c.dataset.ready = "false";
        setError(String(e));
      }
    };
    const presentation = new ScenarioPresentationHost(c, outdoorRecipe(asset, metadata), {
      width: Math.ceil(width * scale),
      height: Math.ceil(height * scale),
      fixedCamera: { wx: 0, wy: -asset.rect[3] / 3 },
      terrain: false,
      pixelExactShadows: true,
      loadAssets: () => geometryAssets(image),
      settings: () => ({ paused: false, zoom: scale / PIXEL_SCALE, terrainPacing: "throughput" }),
      input: () => {
        let dx =
          Number(keys.current.has("ArrowRight") || keys.current.has("d")) -
          Number(keys.current.has("ArrowLeft") || keys.current.has("a"));
        let dy =
          Number(keys.current.has("ArrowDown") || keys.current.has("s")) -
          Number(keys.current.has("ArrowUp") || keys.current.has("w"));
        const length = Math.hypot(dx, dy);
        if (length) {
          dx /= length;
          dy /= length;
        }
        return { dx, dy, jump: keys.current.has(" "), sprinting: false };
      },
      underlay: (frame, { camera }) => {
        // Whole grid lines avoid drawing every shared tile edge twice.
        const right = -width + Math.ceil((2 * width) / 16) * 16;
        const bottom = -height + Math.ceil((100 + height) / 16) * 16;
        for (let x = -width; x <= right; x += 16) {
          const a = camera.worldToScreen(x, -height),
            b = camera.worldToScreen(x, bottom);
          frame.line(a.sx, a.sy, b.sx, b.sy, "#afc0ad");
        }
        for (let y = -height; y <= bottom; y += 16) {
          const a = camera.worldToScreen(-width, y),
            b = camera.worldToScreen(right, y);
          frame.line(a.sx, a.sy, b.sx, b.sy, "#afc0ad");
        }
      },
      overlay: (frame, host) => {
        const { camera } = host;
        const [vx, vy, vw, vh] = asset.visualBounds;
        drawRect(
          frame,
          camera,
          [vx - metadata.anchor[0], vy - metadata.anchor[1], vw, vh],
          "#3472aa",
        );
        if (metadata.footprint) drawRect(frame, camera, metadata.footprint, "#229b61");
        for (const wall of prop.walls ?? []) {
          const b = getEntityAABB(prop.position, wall);
          drawRect(frame, camera, [b.left, b.top, b.right - b.left, b.bottom - b.top], "#e54c49");
        }
        const player = host.session.view.playerEntity;
        const position = interpolatePosition(
          player.position,
          player.prevPosition,
          host.presentationAlpha,
        );
        if (player.collider) {
          const b = getEntityAABB(position, player.collider);
          drawRect(frame, camera, [b.left, b.top, b.right - b.left, b.bottom - b.top], "#374956");
        }
        const p = camera.worldToScreen(0, 0);
        frame.rect(p.sx - 3, p.sy - 3, 6, 6, "#f4b032");
        const depth = camera.worldToScreen(0, metadata.depthOffset);
        frame.line(depth.sx - 40, depth.sy, depth.sx + 40, depth.sy, "#a84ac2");
      },
      onFrame: (host) => {
        const player = host.session.view.playerEntity;
        c.dataset.playerX = String(player.position.wx);
        c.dataset.playerY = String(player.position.wy);
        c.dataset.cameraX = String(host.camera.x);
        c.dataset.cameraY = String(host.camera.y);
      },
      onError: reportError,
    });
    void presentation.ready
      .then(() => {
        if (active) c.dataset.ready = "true";
      })
      .catch(reportError);
    reset.current = () => {
      keys.current.clear();
      void presentation
        .command({ kind: "teleport", position: { wx: 0, wy: 40 } })
        .catch(reportError);
    };
    const clearKeys = () => keys.current.clear();
    window.addEventListener("blur", clearKeys);
    document.addEventListener("visibilitychange", clearKeys);
    return () => {
      active = false;
      c.dataset.ready = "false";
      reset.current = () => {};
      keys.current.clear();
      presentation.dispose();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clearKeys);
      document.removeEventListener("visibilitychange", clearKeys);
    };
  }, [asset, metadata, image]);
  const press = (k: string) => keys.current.add(k),
    release = (k: string) => keys.current.delete(k);
  return (
    <section className="geometry-test">
      <h3>Walk around this asset</h3>
      <div className="geometry-viewport">
        <canvas
          ref={canvas}
          tabIndex={0}
          aria-label="Asset movement test"
          onBlur={() => keys.current.clear()}
        />
      </div>
      <p>
        Tap the scene, then use arrows / WASD. Blue: image · green: footprint · red: collision ·
        yellow: anchor · purple: depth.
      </p>
      <div className="preview-controls">
        {(
          [
            ["←", "ArrowLeft"],
            ["↑", "ArrowUp"],
            ["↓", "ArrowDown"],
            ["→", "ArrowRight"],
          ] as const
        ).map(([label, k]) => (
          <button
            key={k}
            type="button"
            aria-label={`Walk ${k}`}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              press(k);
            }}
            onPointerUp={() => release(k)}
            onPointerCancel={() => release(k)}
            onLostPointerCapture={() => release(k)}
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
