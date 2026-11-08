import { useEffect, useRef, useState } from "react";
import { closeAssets, type GameAssets, loadSceneAssets } from "../assets/GameAssets.js";
import {
  type OutdoorAsset,
  type OutdoorMetadata,
  outdoorProp,
} from "../assets/outdoor/OutdoorCatalog.js";
import { Spritesheet } from "../assets/Spritesheet.js";
import { TileVariants } from "../assets/TileVariants.js";
import { LabView } from "../client/LabView.js";
import { PIXEL_SCALE } from "../config/constants.js";
import { getEntityAABB } from "../entities/collision.js";
import type { Camera } from "../rendering/Camera.js";
import { interpolatePosition } from "../rendering/collectScene.js";
import type { OverlayFrame } from "../rendering/OverlayFrame.js";
import { outdoorRecipe } from "../scenarios/OutdoorRecipe.js";
import { fixedCamera } from "../session/View.js";

/** Each lab owns its walker bitmap; the catalog's HTML image is borrowed. */
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
    const lab = new LabView(c, outdoorRecipe(asset, metadata), {
      width: Math.ceil(width * scale),
      height: Math.ceil(height * scale),
      camera: fixedCamera({ wx: 0, wy: -asset.rect[3] / 3 }),
      terrain: false,
      pixelExactShadows: true,
      loadAssets: () => geometryAssets(image),
      settings: () => ({ paused: false, zoom: scale / PIXEL_SCALE, terrainPacing: "throughput" }),
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
      overlay: (frame, { camera, presentedPlayer: player, presentationAlpha }) => {
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
        const position = interpolatePosition(
          player.position,
          player.prevPosition,
          presentationAlpha,
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
      onFrame: ({ client, camera }) => {
        const player = client.replica.playerEntity;
        c.dataset.playerX = String(player.position.wx);
        c.dataset.playerY = String(player.position.wy);
        c.dataset.cameraX = String(camera.x);
        c.dataset.cameraY = String(camera.y);
      },
      onError: reportError,
    });
    void lab.ready
      .then(() => {
        if (active) c.dataset.ready = "true";
      })
      .catch(reportError);
    reset.current = () => {
      void lab.command({ kind: "teleport", position: { wx: 0, wy: 40 } }).catch(reportError);
    };
    return () => {
      active = false;
      c.dataset.ready = "false";
      reset.current = () => {};
      lab.dispose();
    };
  }, [asset, metadata, image]);
  return (
    <section className="geometry-test">
      <h3>Walk around this asset</h3>
      <div className="geometry-viewport">
        <canvas
          ref={canvas}
          tabIndex={0}
          aria-label="Asset movement test"
          style={{ touchAction: "none" }}
        />
      </div>
      <p>
        Tap the scene, then use arrows / WASD or a controller; on touch screens drag on it. Blue:
        image · green: footprint · red: collision · yellow: anchor · purple: depth.
      </p>
      <div className="preview-controls">
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
