import type { GameContext, GameScene } from "../core/GameScene.js";
import type { Prop, PropCollider } from "../entities/Prop.js";
import { createProp, getWallsForPropType, PROP_PALETTE } from "../entities/PropFactories.js";
import { drawCollisionBoxes } from "../rendering/DebugRenderer.js";

const COLLIDERS_PATH = "./assets/prop-colliders.json";

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

/** Copy text to clipboard, falling back to execCommand for plain HTTP. */
function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for insecure contexts (LAN HTTP)
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;left:-9999px;";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
  return Promise.resolve();
}

// ── DOM panel styles ──

const PANEL_STYLE = `
	position: fixed; top: 0; right: 0; bottom: 0; width: 260px;
	background: rgba(0,0,0,0.9); color: #ccc; z-index: 100;
	font: 13px monospace; overflow-y: auto;
	display: flex; flex-direction: column; padding: 8px;
	gap: 6px; box-sizing: border-box;
`;

const BTN_STYLE = `
	font: bold 12px monospace; padding: 4px 10px;
	background: #333; color: #ccc; border: 1px solid #555;
	border-radius: 3px; cursor: pointer; user-select: none;
`;

const BTN_PRIMARY = `${BTN_STYLE} background: #246; color: #8cf;`;

const SMALL_BTN = `
	font: bold 13px monospace; width: 28px; height: 24px;
	background: #333; color: #ccc; border: 1px solid #555;
	border-radius: 3px; cursor: pointer; user-select: none;
	display: inline-flex; align-items: center; justify-content: center;
	padding: 0;
`;

const ROW_STYLE = `
	display: flex; align-items: center; gap: 4px; height: 24px;
`;

const LABEL_STYLE = `
	width: 70px; text-align: right; color: #888; flex-shrink: 0;
`;

const VALUE_STYLE = `
	width: 40px; text-align: center; color: #fff;
`;

const SECTION_STYLE = `
	border-top: 1px solid #444; padding-top: 6px; margin-top: 2px;
`;

const NAV_BTN = `${BTN_STYLE} font-size: 16px; padding: 4px 12px;`;

/**
 * Standalone scene for visually editing prop collision boxes.
 * DOM button panel on the right, canvas rendering on the left.
 *
 * Reads overrides from ./assets/prop-colliders.json on enter.
 * Copy JSON to clipboard, then: `pbpaste | jq . > public/assets/prop-colliders.json`
 */
export class PropEditorScene implements GameScene {
  readonly transparent = false;

  private props: Prop[] = [];
  private selectedIndex = 0;
  private wallIndex = -1;

  private savedCameraX = 0;
  private savedCameraY = 0;
  private savedCameraZoom = 1;

  private panel: HTMLDivElement | null = null;
  private panelContent: HTMLDivElement | null = null;

  // Keyboard shortcuts (kept as accelerators)
  private heldKeys = new Set<string>();
  private keyRepeatTimers = new Map<string, number>();
  private readonly KEY_REPEAT_DELAY = 0.35;
  private readonly KEY_REPEAT_RATE = 0.05;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyUpHandler: ((e: KeyboardEvent) => void) | null = null;

  onEnter(gc: GameContext): void {
    this.savedCameraX = gc.camera.x;
    this.savedCameraY = gc.camera.y;
    this.savedCameraZoom = gc.camera.zoom;

    const padding = 40;
    let wx = 0;
    for (const entry of PROP_PALETTE) {
      const prop = createProp(entry.type, wx, 0);
      const walls = getWallsForPropType(entry.type);
      if (walls) prop.walls = walls;
      this.props.push(prop);
      wx += Math.max(prop.sprite.spriteWidth, 120) + padding;
    }

    this.selectedIndex = 0;
    this.wallIndex = -1;

    // Create DOM panel
    this.panel = document.createElement("div");
    this.panel.style.cssText = PANEL_STYLE;
    this.panelContent = document.createElement("div");
    this.panelContent.style.cssText = "display:flex;flex-direction:column;gap:6px;";
    this.panel.appendChild(this.panelContent);
    document.body.appendChild(this.panel);

    this.focusCamera(gc);
    this.refreshPanel(gc);

    // Load overrides
    fetch(COLLIDERS_PATH)
      .then((r) => (r.ok ? r.json() : null))
      .then((defs) => {
        if (defs) {
          applyOverrides(this.props, defs as Record<string, Record<string, unknown>>);
          gc.console.output.print(`Loaded ${COLLIDERS_PATH}`);
          this.refreshPanel(gc);
        }
      })
      .catch(() => {});

    // Keyboard shortcuts
    this.keyHandler = (e: KeyboardEvent) => {
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
    gc.camera.x = this.savedCameraX;
    gc.camera.y = this.savedCameraY;
    gc.camera.zoom = this.savedCameraZoom;
    gc.camera.savePrev();

    if (this.panel) {
      this.panel.remove();
      this.panel = null;
      this.panelContent = null;
    }
    if (this.keyHandler) window.removeEventListener("keydown", this.keyHandler);
    if (this.keyUpHandler) window.removeEventListener("keyup", this.keyUpHandler);
    this.keyHandler = null;
    this.keyUpHandler = null;
    this.heldKeys.clear();
    this.keyRepeatTimers.clear();
    this.props = [];
  }

  onResume(_gc: GameContext): void {}
  onPause(_gc: GameContext): void {}

  update(dt: number, gc: GameContext): void {
    gc.camera.savePrev();
    for (const key of this.heldKeys) {
      const elapsed = (this.keyRepeatTimers.get(key) ?? 0) + dt;
      this.keyRepeatTimers.set(key, elapsed);
      if (elapsed >= this.KEY_REPEAT_DELAY) {
        const repeatElapsed = elapsed - this.KEY_REPEAT_DELAY;
        const prevRepeats = Math.floor((repeatElapsed - dt) / this.KEY_REPEAT_RATE);
        const curRepeats = Math.floor(repeatElapsed / this.KEY_REPEAT_RATE);
        if (curRepeats > prevRepeats) {
          this.applyAdjustment(key, false);
          this.refreshPanel(gc);
        }
      }
    }
  }

  render(alpha: number, gc: GameContext): void {
    gc.camera.applyInterpolation(alpha);
    const { ctx, camera, sheets } = gc;

    ctx.save();
    ctx.fillStyle = "#5a8a32";
    ctx.fillRect(0, 0, gc.canvas.width, gc.canvas.height);
    ctx.restore();

    for (const prop of this.props) {
      const sheet = sheets.get(prop.sprite.sheetKey);
      if (!sheet) continue;
      const { spriteWidth, spriteHeight, frameCol, frameRow } = prop.sprite;
      const halfW = spriteWidth / 2;
      const screen = camera.worldToScreen(
        prop.position.wx - halfW,
        prop.position.wy - spriteHeight,
      );
      const region = sheet.getRegion(frameCol, frameRow);
      ctx.drawImage(
        sheet.image,
        region.x,
        region.y,
        spriteWidth,
        spriteHeight,
        Math.floor(screen.sx),
        Math.floor(screen.sy),
        spriteWidth * camera.scale,
        spriteHeight * camera.scale,
      );
    }

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

    gc.camera.restoreActual();
  }

  // ── DOM panel ──

  private refreshPanel(gc: GameContext): void {
    const container = this.panelContent;
    if (!container) return;
    container.innerHTML = "";

    const prop = this.props[this.selectedIndex];
    if (!prop) return;
    const entry = PROP_PALETTE[this.selectedIndex];

    // Navigation
    const nav = this.el("div", ROW_STYLE + " justify-content: space-between;");
    const prevBtn = this.btn("\u25C0", NAV_BTN, () => {
      this.selectProp(Math.max(0, this.selectedIndex - 1), gc);
    });
    const nextBtn = this.btn("\u25B6", NAV_BTN, () => {
      this.selectProp(Math.min(this.props.length - 1, this.selectedIndex + 1), gc);
    });
    const title = this.el("span", "color: #fff; font-weight: bold; text-align: center; flex: 1;");
    title.textContent = `${this.selectedIndex + 1}/${this.props.length}`;
    nav.append(prevBtn, title, nextBtn);
    container.appendChild(nav);

    // Prop name
    const name = this.el("div", "color: #8cf; text-align: center;");
    name.textContent = entry?.label ?? prop.type;
    container.appendChild(name);
    const typeName = this.el("div", "color: #666; text-align: center; font-size: 11px;");
    typeName.textContent = prop.type;
    container.appendChild(typeName);

    // Collider section
    const colliderSection = this.el("div", SECTION_STYLE);
    const colliderHeader = this.el("div", "color: #aaa; font-weight: bold; margin-bottom: 4px;");
    colliderHeader.textContent = "Collider";
    colliderSection.appendChild(colliderHeader);

    if (!prop.collider && (!prop.walls || prop.walls.length === 0)) {
      const addBtn = this.btn("Add Collider", BTN_PRIMARY, () => {
        prop.collider = { offsetX: 0, offsetY: 0, width: 16, height: 16 };
        this.wallIndex = -1;
        this.refreshPanel(gc);
      });
      colliderSection.appendChild(addBtn);
    } else {
      // Editing target selector
      if (prop.walls && prop.walls.length > 0) {
        const targetRow = this.el("div", ROW_STYLE);
        const targets: string[] = ["Main collider"];
        for (let i = 0; i < prop.walls.length; i++) {
          targets.push(`Wall ${i + 1}`);
        }
        const select = document.createElement("select");
        select.style.cssText =
          "font: 12px monospace; background: #222; color: #ccc; border: 1px solid #555; border-radius: 3px; padding: 2px 4px; flex: 1;";
        for (let i = 0; i < targets.length; i++) {
          const opt = document.createElement("option");
          opt.value = String(i - 1);
          opt.textContent = targets[i] ?? "";
          if (i - 1 === this.wallIndex) opt.selected = true;
          select.appendChild(opt);
        }
        select.addEventListener("change", () => {
          this.wallIndex = Number(select.value);
          this.refreshPanel(gc);
        });
        targetRow.appendChild(select);
        colliderSection.appendChild(targetRow);
      }

      const collider = this.getSelectedCollider();
      if (collider) {
        const c = collider as unknown as Record<string, unknown>;
        this.addNumberRow(colliderSection, "offsetX", c, "offsetX", 1, gc);
        this.addNumberRow(colliderSection, "offsetY", c, "offsetY", 1, gc);
        this.addNumberRow(colliderSection, "width", c, "width", 2, gc, 2);
        this.addNumberRow(colliderSection, "height", c, "height", 2, gc, 2);
        this.addNumberRow(colliderSection, "zBase", c, "zBase", 1, gc, 0, true);
        this.addZHeightRow(colliderSection, collider, gc);
        this.addCheckbox(colliderSection, "walkableTop", c, "walkableTop", gc);
        this.addCheckbox(colliderSection, "passable", c, "passable", gc);

        // Remove button
        const removeRow = this.el("div", "margin-top: 4px;");
        if (this.wallIndex >= 0 && prop.walls) {
          removeRow.appendChild(
            this.btn("Remove Wall", BTN_STYLE + " color: #f88;", () => {
              prop.walls?.splice(this.wallIndex, 1);
              if (!prop.walls?.length) prop.walls = null;
              this.wallIndex = -1;
              this.refreshPanel(gc);
            }),
          );
        } else if (prop.collider) {
          removeRow.appendChild(
            this.btn("Remove Collider", BTN_STYLE + " color: #f88;", () => {
              prop.collider = null;
              this.refreshPanel(gc);
            }),
          );
        }
        colliderSection.appendChild(removeRow);
      } else {
        // Main collider is selected but null
        colliderSection.appendChild(
          this.btn("Add Collider", BTN_PRIMARY, () => {
            prop.collider = { offsetX: 0, offsetY: 0, width: 16, height: 16 };
            this.refreshPanel(gc);
          }),
        );
      }
    }
    container.appendChild(colliderSection);

    // Walls section
    const wallSection = this.el("div", SECTION_STYLE);
    const wallHeader = this.el("div", "color: #aaa; font-weight: bold; margin-bottom: 4px;");
    wallHeader.textContent = `Walls (${prop.walls?.length ?? 0})`;
    wallSection.appendChild(wallHeader);
    wallSection.appendChild(
      this.btn("Add Wall", BTN_PRIMARY, () => {
        if (!prop.walls) prop.walls = [];
        prop.walls.push({ offsetX: 0, offsetY: 0, width: 16, height: 16, zHeight: 16 });
        this.wallIndex = prop.walls.length - 1;
        this.refreshPanel(gc);
      }),
    );
    container.appendChild(wallSection);

    // Actions
    const actionsSection = this.el(
      "div",
      SECTION_STYLE + " display: flex; gap: 6px; flex-wrap: wrap;",
    );
    actionsSection.appendChild(
      this.btn("Copy JSON", BTN_PRIMARY, () => {
        const json = JSON.stringify(serializeAllDefs(this.props), null, 2);
        copyToClipboard(json).then(
          () => gc.console.output.print(`Copied all ${this.props.length} prop defs to clipboard`),
          () => gc.console.output.print("Clipboard write failed"),
        );
      }),
    );
    actionsSection.appendChild(
      this.btn("Exit", BTN_STYLE, () => {
        gc.scenes.pop();
      }),
    );
    container.appendChild(actionsSection);
  }

  private addNumberRow(
    parent: HTMLElement,
    label: string,
    obj: Record<string, unknown>,
    key: string,
    step: number,
    gc: GameContext,
    min?: number,
    optional?: boolean,
  ): void {
    const row = this.el("div", ROW_STYLE);
    const lbl = this.el("span", LABEL_STYLE);
    lbl.textContent = label;
    const val = this.el("span", VALUE_STYLE);
    const current = obj[key] as number | undefined;
    val.textContent = current !== undefined ? String(current) : "-";
    const minus = this.btn("-", SMALL_BTN, () => {
      const cur = (obj[key] as number | undefined) ?? 0;
      obj[key] = min !== undefined ? Math.max(min, cur - step) : cur - step;
      this.refreshPanel(gc);
    });
    const plus = this.btn("+", SMALL_BTN, () => {
      if (optional && obj[key] === undefined) obj[key] = 0;
      obj[key] = ((obj[key] as number | undefined) ?? 0) + step;
      this.refreshPanel(gc);
    });
    row.append(lbl, minus, val, plus);
    parent.appendChild(row);
  }

  private addZHeightRow(parent: HTMLElement, collider: PropCollider, gc: GameContext): void {
    const row = this.el("div", ROW_STYLE);
    const lbl = this.el("span", LABEL_STYLE);
    lbl.textContent = "zHeight";
    const val = this.el("span", VALUE_STYLE);
    val.textContent = collider.zHeight !== undefined ? String(collider.zHeight) : "\u221E";
    const minus = this.btn("-", SMALL_BTN, () => {
      if (collider.zHeight !== undefined) {
        collider.zHeight = Math.max(0, collider.zHeight - 2);
      }
      this.refreshPanel(gc);
    });
    const plus = this.btn("+", SMALL_BTN, () => {
      collider.zHeight = (collider.zHeight ?? 0) + 2;
      this.refreshPanel(gc);
    });
    const infBtn = this.btn("\u221E", SMALL_BTN, () => {
      delete (collider as unknown as Record<string, unknown>).zHeight;
      this.refreshPanel(gc);
    });
    row.append(lbl, minus, val, plus, infBtn);
    parent.appendChild(row);
  }

  private addCheckbox(
    parent: HTMLElement,
    label: string,
    obj: Record<string, unknown>,
    key: string,
    gc: GameContext,
  ): void {
    const row = this.el("div", ROW_STYLE + " cursor: pointer;");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!obj[key];
    cb.style.cssText = "cursor: pointer;";
    const lbl = this.el("span", "color: #aaa; cursor: pointer;");
    lbl.textContent = label;
    cb.addEventListener("change", () => {
      if (cb.checked) {
        obj[key] = true;
      } else {
        delete obj[key];
      }
      this.refreshPanel(gc);
    });
    row.addEventListener("click", (e) => {
      if (e.target !== cb) cb.click();
    });
    row.append(cb, lbl);
    parent.appendChild(row);
  }

  // ── Helpers ──

  private el(tag: string, style: string): HTMLElement {
    const el = document.createElement(tag);
    el.style.cssText = style;
    return el;
  }

  private btn(text: string, style: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.style.cssText = style;
    btn.addEventListener("click", onClick);
    return btn;
  }

  private selectProp(index: number, gc: GameContext): void {
    this.selectedIndex = index;
    this.wallIndex = -1;
    this.focusCamera(gc);
    this.refreshPanel(gc);
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

  // ── Keyboard shortcuts ──

  private handleKeyDown(e: KeyboardEvent, gc: GameContext): void {
    const key = e.key;
    switch (key) {
      case "Escape":
        gc.scenes.pop();
        e.preventDefault();
        return;
      case "ArrowLeft":
        this.selectProp(Math.max(0, this.selectedIndex - 1), gc);
        e.preventDefault();
        return;
      case "ArrowRight":
        this.selectProp(Math.min(this.props.length - 1, this.selectedIndex + 1), gc);
        e.preventDefault();
        return;
      case "Tab": {
        e.preventDefault();
        const prop = this.props[this.selectedIndex];
        if (!prop) return;
        const wallCount = prop.walls?.length ?? 0;
        if (wallCount > 0) {
          this.wallIndex++;
          if (this.wallIndex >= wallCount) this.wallIndex = -1;
          this.refreshPanel(gc);
        }
        return;
      }
      case "c":
      case "C": {
        const json = JSON.stringify(serializeAllDefs(this.props), null, 2);
        copyToClipboard(json).then(
          () => gc.console.output.print(`Copied all ${this.props.length} prop defs to clipboard`),
          () => gc.console.output.print("Clipboard write failed"),
        );
        e.preventDefault();
        return;
      }
    }
    if ("ijklIJKLuUoO,.<>-_=+".includes(key)) {
      if (!this.heldKeys.has(key)) {
        this.applyAdjustment(key, e.shiftKey);
        this.heldKeys.add(key);
        this.keyRepeatTimers.set(key, 0);
        this.refreshPanel(gc);
      }
      e.preventDefault();
    }
  }

  private applyAdjustment(key: string, shift: boolean): void {
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
        if (collider.zHeight !== undefined)
          collider.zHeight = Math.max(0, collider.zHeight - wStep);
        break;
      case "=":
      case "+":
        collider.zHeight = (collider.zHeight ?? 0) + wStep;
        break;
    }
  }
}
