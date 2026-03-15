import type { GameContext, GameScene } from "../core/GameScene.js";
import type { Prop, PropCollider } from "../entities/Prop.js";
import { createProp, getWallsForPropType, PROP_PALETTE } from "../entities/PropFactories.js";
import { drawCollisionBoxes } from "../rendering/DebugRenderer.js";

const COLLIDERS_PATH = "./assets/prop-colliders.json";

/** Serialize a PropCollider to a plain object with deterministic key order, omitting defaults. */
function serializeCollider(c: PropCollider): Record<string, number | boolean> {
  const obj: Record<string, number | boolean> = {
    offsetX: c.offsetX,
    offsetY: c.offsetY,
    width: c.width,
    height: c.height,
  };
  if (c.zBase !== undefined && c.zBase !== 0) obj.zBase = c.zBase;
  if (c.zHeight !== undefined) obj.zHeight = c.zHeight;
  if (c.walkableTop) obj.walkableTop = true;
  if (c.passable) obj.passable = true;
  return obj;
}

/** Build JSON-serializable object of all prop collision definitions. */
function serializeAllDefs(props: Prop[]): Record<string, unknown> {
  const defs: Record<string, unknown> = {};
  for (const prop of props) {
    const def: Record<string, unknown> = {};
    def.collider = prop.collider ? serializeCollider(prop.collider) : null;
    if (prop.walls && prop.walls.length > 0) {
      def.walls = prop.walls.map(serializeCollider);
    }
    defs[prop.type] = def;
  }
  return defs;
}

/** Apply loaded JSON overrides to props. */
function applyOverrides(props: Prop[], defs: Record<string, Record<string, unknown>>): void {
  for (const prop of props) {
    const def = defs[prop.type];
    if (!def) continue;
    if (def.collider && typeof def.collider === "object") {
      prop.collider = def.collider as PropCollider;
    } else if (def.collider === null) {
      prop.collider = null;
    }
    if (Array.isArray(def.walls)) {
      prop.walls = def.walls as PropCollider[];
    }
  }
}

/**
 * Standalone scene for visually editing prop collision boxes.
 * Entered via console command `prop_editor`. ESC to exit.
 *
 * Press C to copy all collision defs as JSON to clipboard.
 * Reads overrides from ./assets/prop-colliders.json on enter.
 * Workflow: adjust → C → `pbpaste | jq . > public/assets/prop-colliders.json`
 */
export class PropEditorScene implements GameScene {
  readonly transparent = false;

  private props: Prop[] = [];
  /** World X of each prop (for camera targeting). */
  private propPositions: number[] = [];
  private selectedIndex = 0;
  /** Which wall/collider within the selected prop is being edited. -1 = main collider. */
  private wallIndex = -1;

  private savedCameraX = 0;
  private savedCameraY = 0;
  private savedCameraZoom = 1;

  /** Tracks held keys for repeat handling. */
  private heldKeys = new Set<string>();
  private keyRepeatTimers = new Map<string, number>();
  private readonly KEY_REPEAT_DELAY = 0.35;
  private readonly KEY_REPEAT_RATE = 0.05;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyUpHandler: ((e: KeyboardEvent) => void) | null = null;

  onEnter(gc: GameContext): void {
    // Save camera state
    this.savedCameraX = gc.camera.x;
    this.savedCameraY = gc.camera.y;
    this.savedCameraZoom = gc.camera.zoom;

    // Create props in a grid layout
    const padding = 40;
    let wx = 0;
    for (const entry of PROP_PALETTE) {
      const prop = createProp(entry.type, wx, 0);
      // Reconstruct walls from definition
      const walls = getWallsForPropType(entry.type);
      if (walls) prop.walls = walls;
      this.props.push(prop);
      this.propPositions.push(wx);
      wx += Math.max(prop.sprite.spriteWidth, 120) + padding;
    }

    this.selectedIndex = 0;
    this.wallIndex = -1;
    this.focusCamera(gc);

    // Load overrides from JSON file (async, applies when ready)
    fetch(COLLIDERS_PATH)
      .then((r) => (r.ok ? r.json() : null))
      .then((defs) => {
        if (defs) {
          applyOverrides(this.props, defs as Record<string, Record<string, unknown>>);
          gc.console.output.print(`Loaded ${COLLIDERS_PATH}`);
        }
      })
      .catch(() => {});

    // Key handlers for editing
    this.keyHandler = (e: KeyboardEvent) => {
      // Don't intercept if console is open
      if (gc.consoleUI.visible) return;
      this.handleKeyDown(e, gc);
    };
    this.keyUpHandler = (e: KeyboardEvent) => {
      this.heldKeys.delete(e.key);
      this.keyRepeatTimers.delete(e.key);
    };
    window.addEventListener("keydown", this.keyHandler);
    window.addEventListener("keyup", this.keyUpHandler);
  }

  onExit(gc: GameContext): void {
    // Restore camera
    gc.camera.x = this.savedCameraX;
    gc.camera.y = this.savedCameraY;
    gc.camera.zoom = this.savedCameraZoom;
    gc.camera.savePrev();

    if (this.keyHandler) window.removeEventListener("keydown", this.keyHandler);
    if (this.keyUpHandler) window.removeEventListener("keyup", this.keyUpHandler);
    this.keyHandler = null;
    this.keyUpHandler = null;
    this.heldKeys.clear();
    this.keyRepeatTimers.clear();
    this.props = [];
    this.propPositions = [];
  }

  onResume(_gc: GameContext): void {}
  onPause(_gc: GameContext): void {}

  update(dt: number, gc: GameContext): void {
    gc.camera.savePrev();

    // Handle held-key repeats
    for (const key of this.heldKeys) {
      const elapsed = (this.keyRepeatTimers.get(key) ?? 0) + dt;
      this.keyRepeatTimers.set(key, elapsed);
      if (elapsed >= this.KEY_REPEAT_DELAY) {
        const repeatElapsed = elapsed - this.KEY_REPEAT_DELAY;
        const prevRepeats = Math.floor((repeatElapsed - dt) / this.KEY_REPEAT_RATE);
        const curRepeats = Math.floor(repeatElapsed / this.KEY_REPEAT_RATE);
        if (curRepeats > prevRepeats) {
          this.applyAdjustment(key, false, gc);
        }
      }
    }
  }

  render(alpha: number, gc: GameContext): void {
    gc.camera.applyInterpolation(alpha);
    const { ctx, camera, sheets } = gc;

    // Fill background
    ctx.save();
    ctx.fillStyle = "#5a8a32";
    ctx.fillRect(0, 0, gc.canvas.width, gc.canvas.height);
    ctx.restore();

    // Draw each prop sprite
    for (const prop of this.props) {
      const sheet = sheets.get(prop.sprite.sheetKey);
      if (!sheet) continue;
      const { spriteWidth, spriteHeight, frameCol, frameRow } = prop.sprite;
      const halfW = spriteWidth / 2;
      const screen = camera.worldToScreen(
        prop.position.wx - halfW,
        prop.position.wy - spriteHeight,
      );
      const destW = spriteWidth * camera.scale;
      const destH = spriteHeight * camera.scale;
      const region = sheet.getRegion(frameCol, frameRow);
      ctx.drawImage(
        sheet.image,
        region.x,
        region.y,
        spriteWidth,
        spriteHeight,
        Math.floor(screen.sx),
        Math.floor(screen.sy),
        destW,
        destH,
      );
    }

    // Draw collision boxes
    drawCollisionBoxes(ctx, camera, [], this.props);

    // Highlight selected prop
    const sel = this.props[this.selectedIndex];
    if (sel) {
      const { spriteWidth, spriteHeight } = sel.sprite;
      const halfW = spriteWidth / 2;
      const screen = camera.worldToScreen(sel.position.wx - halfW, sel.position.wy - spriteHeight);
      ctx.save();
      ctx.strokeStyle = "rgba(255, 255, 0, 0.8)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(
        Math.floor(screen.sx) - 2,
        Math.floor(screen.sy) - 2,
        spriteWidth * camera.scale + 4,
        spriteHeight * camera.scale + 4,
      );
      ctx.restore();
    }

    // Draw HUD
    this.drawHUD(ctx, gc);

    gc.camera.restoreActual();
  }

  private handleKeyDown(e: KeyboardEvent, gc: GameContext): void {
    const key = e.key;

    switch (key) {
      case "Escape":
        gc.scenes.pop();
        e.preventDefault();
        return;
      case "ArrowLeft":
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        this.wallIndex = -1;
        this.focusCamera(gc);
        e.preventDefault();
        return;
      case "ArrowRight":
        this.selectedIndex = Math.min(this.props.length - 1, this.selectedIndex + 1);
        this.wallIndex = -1;
        this.focusCamera(gc);
        e.preventDefault();
        return;
      case "Tab": {
        e.preventDefault();
        const prop = this.props[this.selectedIndex];
        if (!prop) return;
        const wallCount = prop.walls?.length ?? 0;
        if (wallCount > 0) {
          // Cycle: -1 (main collider) -> 0..wallCount-1 -> -1
          this.wallIndex++;
          if (this.wallIndex >= wallCount) this.wallIndex = -1;
        }
        return;
      }
      case "c":
      case "C":
        this.copyAllToClipboard(gc);
        e.preventDefault();
        return;
    }

    // Adjustment keys — handle first press + track for repeat
    if ("ijklIJKLuUoO,.<>-_=+".includes(key)) {
      if (!this.heldKeys.has(key)) {
        this.applyAdjustment(key, e.shiftKey, gc);
        this.heldKeys.add(key);
        this.keyRepeatTimers.set(key, 0);
      }
      e.preventDefault();
    }
  }

  private applyAdjustment(key: string, shift: boolean, _gc: GameContext): void {
    const collider = this.getSelectedCollider();
    if (!collider) return;

    const step = shift ? 8 : 1;
    const wStep = shift ? 8 : 2;

    switch (key.toLowerCase()) {
      case "j":
        collider.offsetX -= step;
        break;
      case "l":
        collider.offsetX += step;
        break;
      case "i":
        collider.offsetY -= step;
        break;
      case "k":
        collider.offsetY += step;
        break;
      case "u":
        collider.width = Math.max(2, collider.width - wStep);
        break;
      case "o":
        collider.width += wStep;
        break;
      case ",":
      case "<":
        collider.height = Math.max(2, collider.height - wStep);
        break;
      case ".":
      case ">":
        collider.height += wStep;
        break;
      case "-":
      case "_":
        if (collider.zHeight !== undefined) {
          collider.zHeight = Math.max(0, collider.zHeight - wStep);
        }
        break;
      case "=":
      case "+":
        collider.zHeight = (collider.zHeight ?? 0) + wStep;
        break;
    }
  }

  private getSelectedCollider(): PropCollider | null {
    const prop = this.props[this.selectedIndex];
    if (!prop) return null;

    if (this.wallIndex >= 0 && prop.walls && this.wallIndex < prop.walls.length) {
      return prop.walls[this.wallIndex] ?? null;
    }
    return prop.collider;
  }

  private focusCamera(gc: GameContext): void {
    const prop = this.props[this.selectedIndex];
    if (!prop) return;
    gc.camera.x = prop.position.wx;
    gc.camera.y = prop.position.wy - prop.sprite.spriteHeight / 2;
    gc.camera.zoom = 1;
    gc.camera.savePrev();
  }

  private copyAllToClipboard(gc: GameContext): void {
    const json = JSON.stringify(serializeAllDefs(this.props), null, 2);
    navigator.clipboard.writeText(json).then(
      () => gc.console.output.print(`Copied all ${this.props.length} prop defs to clipboard`),
      () => gc.console.output.print("Clipboard write failed (not HTTPS?)"),
    );
  }

  private drawHUD(ctx: CanvasRenderingContext2D, gc: GameContext): void {
    const prop = this.props[this.selectedIndex];
    if (!prop) return;

    const entry = PROP_PALETTE[this.selectedIndex];
    const collider = this.getSelectedCollider();

    const lines: string[] = [
      `[${this.selectedIndex + 1}/${this.props.length}] ${entry?.label ?? prop.type}  (${prop.type})`,
    ];

    if (prop.walls && prop.walls.length > 0) {
      lines.push(
        `Wall: ${this.wallIndex === -1 ? "main collider" : `${this.wallIndex + 1}/${prop.walls.length}`}  [Tab to cycle]`,
      );
    }

    if (collider) {
      lines.push(`  offsetX: ${collider.offsetX}  offsetY: ${collider.offsetY}`);
      lines.push(`  width: ${collider.width}  height: ${collider.height}`);
      if (collider.zBase !== undefined && collider.zBase !== 0) {
        lines.push(`  zBase: ${collider.zBase}`);
      }
      lines.push(
        `  zHeight: ${collider.zHeight ?? "∞"}${collider.walkableTop ? "  walkable" : ""}${collider.passable ? "  passable" : ""}`,
      );
    } else {
      lines.push("  (no collider)");
    }

    lines.push("");
    lines.push("←/→ Select   Tab Cycle wall   C Copy all JSON to clipboard");
    lines.push("IJKL Offset   U/O Width   ,/. Height   -/+ zHeight");
    lines.push("Shift = 8px step   ESC Exit");

    const lineHeight = 16;
    const panelW = gc.canvas.width;
    const panelH = lines.length * lineHeight + 12;
    const panelY = gc.canvas.height - panelH;

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, panelY, panelW, panelH);
    ctx.font = "13px monospace";
    ctx.fillStyle = "#00ff00";
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i] ?? "", 10, panelY + 14 + i * lineHeight);
    }
    ctx.restore();
  }
}
