import { required } from "../art/ArtCatalog.js";
import { reviewContext2D } from "../art/reviewCanvas.js";
import type { GameAssets } from "../assets/GameAssets.js";
import { Spritesheet } from "../assets/Spritesheet.js";
import { PIXEL_SCALE } from "../config/constants.js";
import { getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import type { Prop } from "../entities/Prop.js";
import { createGenerator } from "../generation/Generator.js";
import { Camera } from "../rendering/Camera.js";
import { drawScene2D } from "../rendering/Canvas2DRenderer.js";
import { collectScene } from "../rendering/collectScene.js";
import { TileRenderer } from "../rendering/TileRenderer.js";
import { CHARACTER_TEST_BLOCKS, characterObstacles } from "../scenarios/CharacterRecipe.js";
import { World } from "../world/World.js";
import {
  type CharacterDefinition,
  type CharacterSettings,
  createCharacterEntity,
} from "./CharacterCatalog.js";

export { CHARACTER_TEST_BLOCKS } from "../scenarios/CharacterRecipe.js";

export class CharacterTestScene {
  readonly actor: Entity;
  readonly reference = createPlayer(-105, 6);
  readonly props: Prop[] = [];
  readonly camera = new Camera();
  readonly sheets: GameAssets["sheets"];
  private readonly world = new World(
    createGenerator({ type: "flat", version: "flat-v1", seed: 1, preset: "grass" }).terrain,
  );
  private readonly tiles = new TileRenderer();
  constructor(
    readonly definition: CharacterDefinition,
    public settings: CharacterSettings,
    image: HTMLImageElement,
    playerImage: HTMLImageElement,
  ) {
    this.actor = createCharacterEntity(definition, settings, 0, 8);
    this.reference.id = 2;
    this.sheets = new Map([
      [definition.sheetKey, new Spritesheet(image, 32, 32)],
      ["player", new Spritesheet(playerImage, 16, 16)],
    ]);
    for (const [i, b] of CHARACTER_TEST_BLOCKS.entries()) {
      const c = document.createElement("canvas");
      c.width = b.w;
      c.height = b.d + b.z + b.base;
      const ctx = reviewContext2D(c);
      ctx.fillStyle = i < 3 ? "#64778b" : "#93816a";
      ctx.fillRect(0, 0, b.w, b.d + b.z);
      ctx.fillStyle = i < 3 ? "#9baebd" : "#c5b597";
      ctx.fillRect(0, 0, b.w, b.d);
      ctx.strokeStyle = "#42505b";
      ctx.strokeRect(0.5, 0.5, b.w - 1, b.d + b.z - 1);
      const key = `character-test-block-${i}`;
      this.sheets.set(key, new Spritesheet(c, c.width, c.height));
      this.props.push(required(characterObstacles()[i]));
    }
  }
  update(settings: CharacterSettings) {
    this.settings = settings;
    const configured = createCharacterEntity(this.definition, settings);
    Object.assign(required(this.actor.sprite), {
      drawOffsetY: settings.drawOffsetY,
      frameDuration: 1000 / settings.fps,
    });
    this.actor.collider = configured.collider;
    this.actor.sortOffsetY = settings.sortOffsetY;
  }
  reset() {
    Object.assign(this.actor, createCharacterEntity(this.definition, this.settings, 0, 8));
    delete this.actor.jumpVZ;
    delete this.actor.jumpZ;
    delete this.actor.groundZ;
  }
  draw(canvas: HTMLCanvasElement, overlays: boolean, zoom: number, labels = true) {
    if (canvas.width !== 288 * zoom) canvas.width = 288 * zoom;
    if (canvas.height !== 192 * zoom) canvas.height = 192 * zoom;
    const ctx = reviewContext2D(canvas);
    this.camera.setViewport(canvas.width, canvas.height);
    this.camera.zoom = zoom / PIXEL_SCALE;
    this.camera.snapTo(0, -12);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#d4dfcc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const rect = (x: number, y: number, w: number, h: number, color: string) => {
      const p = this.camera.worldToScreen(x, y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(p.sx, p.sy, w * zoom, h * zoom);
    };
    for (let y = -112; y < 90; y += 16)
      for (let x = -144; x < 144; x += 16) rect(x, y, 16, 16, "#b7c9b1");
    const items = collectScene(
      [this.actor, this.reference],
      this.props,
      this.world,
      this.camera,
      this.camera.getVisibleChunkRange(),
      1,
      this.tiles,
      [],
      false,
    );
    drawScene2D(ctx, this.camera, items, this.sheets, undefined, true);
    // Text is a UI aid, not review art: system fonts vary across platforms.
    if (labels) {
      ctx.font = `${4 * zoom}px sans-serif`;
      ctx.fillStyle = "#243529";
      for (const b of CHARACTER_TEST_BLOCKS) {
        const p = this.camera.worldToScreen(b.x - b.w / 2, b.y + 7);
        ctx.fillText(b.name, p.sx, p.sy);
      }
      const r = this.camera.worldToScreen(-120, 14);
      ctx.fillText("Current player", r.sx, r.sy);
    }
    if (overlays) {
      const a = this.actor,
        s = this.settings,
        z = a.wz ?? 0;
      const box = getEntityAABB(a.position, required(a.collider));
      rect(a.position.wx - 16, a.position.wy - z - 32 + s.drawOffsetY, 32, 32, "#2675d8");
      rect(box.left, box.top - z, s.width, s.depth, "#159144");
      rect(box.left, box.top - z - s.physicalHeight, s.width, s.depth, "#d62f85");
      for (const x of [box.left, box.right])
        for (const y of [box.top, box.bottom])
          rect(x, y - z - s.physicalHeight, 0, s.physicalHeight, "#d62f85");
      rect(a.position.wx - 20, a.position.wy + s.sortOffsetY, 40, 0, "#9343ae");
      const p = this.camera.worldToScreen(a.position.wx, a.position.wy - z);
      ctx.fillStyle = "#f59d00";
      ctx.fillRect(p.sx - 3, p.sy - 3, 6, 6);
      for (const prop of this.props) {
        const b = getEntityAABB(prop.position, required(prop.collider));
        rect(b.left, b.top, b.right - b.left, b.bottom - b.top, "#bd4b2d");
      }
    }
    canvas.dataset.x = String(this.actor.position.wx);
    canvas.dataset.y = String(this.actor.position.wy);
    canvas.dataset.z = String(this.actor.wz ?? 0);
    canvas.dataset.direction = String(required(this.actor.sprite).direction);
    canvas.dataset.frame = String(required(this.actor.sprite).frameCol);
    canvas.dataset.moving = String(required(this.actor.sprite).moving);
    canvas.dataset.ready = "true";
  }
}
