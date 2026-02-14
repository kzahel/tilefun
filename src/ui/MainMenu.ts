import type { WorldType } from "../persistence/WorldRegistry.js";
import type { RealmInfo } from "../shared/protocol.js";
import { relativeTime } from "./relativeTime.js";

const OVERLAY_STYLE = `
  position: fixed; inset: 0; z-index: 200;
  background: rgba(10, 10, 30, 0.92);
  display: flex; flex-direction: column; align-items: center;
  padding: 32px 16px; overflow-y: auto;
  font-family: monospace; color: #fff;
`;

const TITLE_STYLE = `
  font-size: 32px; font-weight: bold; letter-spacing: 4px;
  margin-bottom: 24px; color: #8cf;
`;

const CARD_STYLE = `
  width: 320px; padding: 12px 16px;
  background: rgba(255,255,255,0.08); border: 1px solid #555;
  border-radius: 6px; cursor: pointer; user-select: none;
  display: flex; justify-content: space-between; align-items: center;
`;

const BTN_STYLE = `
  font: bold 14px monospace; padding: 8px 16px;
  background: rgba(255,255,255,0.12); color: #fff;
  border: 1px solid #888; border-radius: 4px;
  cursor: pointer; user-select: none;
`;

export class MainMenu {
  private overlay: HTMLDivElement;
  private listEl: HTMLDivElement;
  private worldCount = 0;
  private currentRealms: RealmInfo[] = [];
  /** Map from worldId to the player-count badge element for live updates. */
  private playerCountBadges = new Map<string, HTMLSpanElement>();

  onSelect: ((worldId: string) => void) | null = null;
  onCreate: ((name: string, worldType: WorldType, seed?: number) => void) | null = null;
  onDelete: ((worldId: string) => void) | null = null;
  onRename: ((worldId: string, name: string) => void) | null = null;
  onClose: (() => void) | null = null;

  constructor() {
    this.overlay = document.createElement("div");
    this.overlay.style.cssText = OVERLAY_STYLE;
    this.overlay.style.display = "none";

    const title = document.createElement("div");
    title.style.cssText = TITLE_STYLE;
    title.textContent = "TILEFUN";
    this.overlay.appendChild(title);

    this.listEl = document.createElement("div");
    this.listEl.style.cssText =
      "display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; width: 320px;";
    this.overlay.appendChild(this.listEl);

    // New World controls
    const newSection = document.createElement("div");
    newSection.style.cssText = "display: flex; flex-direction: column; gap: 8px; width: 320px;";

    const INPUT_STYLE = `
      flex: 1; font: 14px monospace; padding: 8px;
      background: rgba(255,255,255,0.1); color: #fff;
      border: 1px solid #888; border-radius: 4px; outline: none;
    `;

    // Name + Create button row
    const nameRow = document.createElement("div");
    nameRow.style.cssText = "display: flex; gap: 8px;";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "World name...";
    nameInput.style.cssText = INPUT_STYLE;

    const createBtn = document.createElement("button");
    createBtn.textContent = "New World";
    createBtn.style.cssText = BTN_STYLE;

    nameRow.append(nameInput, createBtn);

    // Type + Seed row
    const optRow = document.createElement("div");
    optRow.style.cssText = "display: flex; gap: 8px; align-items: center;";

    const typeSelect = document.createElement("select");
    typeSelect.style.cssText = `
      font: 14px monospace; padding: 6px 8px;
      background: rgba(255,255,255,0.1); color: #fff;
      border: 1px solid #888; border-radius: 4px; outline: none;
    `;
    for (const [value, label] of [
      ["generated", "Generated"],
      ["flat", "Flat Grass"],
      ["island", "Island"],
    ] as const) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      opt.style.background = "#222";
      typeSelect.appendChild(opt);
    }

    const seedInput = document.createElement("input");
    seedInput.type = "number";
    seedInput.placeholder = "Seed (random)";
    seedInput.style.cssText = `${INPUT_STYLE} width: 120px; flex: none;`;

    typeSelect.addEventListener("change", () => {
      seedInput.style.display = typeSelect.value === "flat" ? "none" : "";
    });
    typeSelect.addEventListener("keydown", (e) => e.stopPropagation());

    optRow.append(typeSelect, seedInput);

    const doCreate = () => {
      const name = nameInput.value.trim() || `World ${this.worldCount + 1}`;
      const worldType = typeSelect.value as WorldType;
      const seedVal = seedInput.value.trim();
      const seed = seedVal ? Number(seedVal) : undefined;
      nameInput.value = "";
      seedInput.value = "";
      this.onCreate?.(name, worldType, seed);
    };

    createBtn.addEventListener("click", doCreate);
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doCreate();
      e.stopPropagation();
    });
    nameInput.addEventListener("keyup", (e) => e.stopPropagation());
    seedInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doCreate();
      e.stopPropagation();
    });
    seedInput.addEventListener("keyup", (e) => e.stopPropagation());

    newSection.append(nameRow, optRow);
    this.overlay.appendChild(newSection);

    // Resume button to close menu and return to game
    const resumeBtn = document.createElement("button");
    resumeBtn.textContent = "Resume";
    resumeBtn.style.cssText = `${BTN_STYLE} width: 320px; margin-top: 12px; font-size: 16px; padding: 10px 16px;`;
    resumeBtn.addEventListener("click", () => this.onClose?.());
    this.overlay.appendChild(resumeBtn);

    // Prevent keyboard shortcuts from firing while interacting with menu
    this.overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") return; // let Escape bubble to close menu
      e.stopPropagation();
    });
    this.overlay.addEventListener("keyup", (e) => e.stopPropagation());

    document.body.appendChild(this.overlay);
  }

  get visible(): boolean {
    return this.overlay.style.display !== "none";
  }

  show(realms: RealmInfo[]): void {
    this.worldCount = realms.length;
    this.currentRealms = realms;
    this.playerCountBadges.clear();
    this.overlay.style.display = "";
    this.listEl.innerHTML = "";

    if (realms.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = "color: #888; text-align: center; padding: 16px;";
      empty.textContent = "No worlds yet. Create one below!";
      this.listEl.appendChild(empty);
      return;
    }

    for (const realm of realms) {
      this.listEl.appendChild(this.createCard(realm));
    }
  }

  hide(): void {
    this.overlay.style.display = "none";
  }

  /** Update a single realm's player count badge (live push). */
  updatePlayerCount(worldId: string, count: number): void {
    const badge = this.playerCountBadges.get(worldId);
    if (badge) {
      badge.textContent = count > 0 ? `${count} playing` : "";
      badge.style.display = count > 0 ? "" : "none";
    }
    // Also update the cached realm data
    for (const r of this.currentRealms) {
      if (r.id === worldId) {
        r.playerCount = count;
        break;
      }
    }
  }

  private createCard(realm: RealmInfo): HTMLDivElement {
    const card = document.createElement("div");
    card.style.cssText = CARD_STYLE;
    card.addEventListener("mouseenter", () => {
      card.style.background = "rgba(255,255,255,0.15)";
    });
    card.addEventListener("mouseleave", () => {
      card.style.background = "rgba(255,255,255,0.08)";
    });

    const info = document.createElement("div");
    info.style.cssText = "display: flex; flex-direction: column; gap: 2px; min-width: 0;";

    const nameRow = document.createElement("div");
    nameRow.style.cssText = "display: flex; align-items: center; gap: 8px;";

    const nameEl = document.createElement("div");
    nameEl.style.cssText =
      "font-weight: bold; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
    nameEl.textContent = realm.name;

    // Player count badge
    const badge = document.createElement("span");
    badge.style.cssText =
      "font-size: 11px; color: #8f8; background: rgba(100,255,100,0.15); padding: 1px 6px; border-radius: 8px; white-space: nowrap;";
    if (realm.playerCount > 0) {
      badge.textContent = `${realm.playerCount} playing`;
    } else {
      badge.style.display = "none";
    }
    this.playerCountBadges.set(realm.id, badge);

    nameRow.append(nameEl, badge);

    // Double-click to rename
    nameEl.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      const input = document.createElement("input");
      input.type = "text";
      input.value = realm.name;
      input.style.cssText = `
        font: bold 15px monospace; padding: 0; margin: 0;
        background: rgba(255,255,255,0.15); color: #fff;
        border: 1px solid #aaa; border-radius: 2px; outline: none;
        width: 180px;
      `;
      const finish = () => {
        const newName = input.value.trim();
        if (newName && newName !== realm.name) {
          this.onRename?.(realm.id, newName);
          nameEl.textContent = newName;
        } else {
          nameEl.textContent = realm.name;
        }
        input.replaceWith(nameEl);
      };
      input.addEventListener("blur", finish);
      input.addEventListener("keydown", (ke) => {
        ke.stopPropagation();
        if (ke.key === "Enter") input.blur();
        if (ke.key === "Escape") {
          input.value = realm.name;
          input.blur();
        }
      });
      input.addEventListener("keyup", (ke) => ke.stopPropagation());
      nameEl.replaceWith(input);
      input.focus();
      input.select();
    });

    const timeEl = document.createElement("div");
    timeEl.style.cssText = "font-size: 12px; color: #999;";
    timeEl.textContent = relativeTime(realm.lastPlayedAt);

    info.append(nameRow, timeEl);

    // Delete button with 2-click confirm
    const delBtn = document.createElement("button");
    delBtn.textContent = "X";
    delBtn.style.cssText = `
      font: bold 12px monospace; padding: 4px 8px;
      background: transparent; color: #888;
      border: 1px solid transparent; border-radius: 4px;
      cursor: pointer; flex-shrink: 0;
    `;
    let confirmTimer: ReturnType<typeof setTimeout> | null = null;
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (delBtn.dataset.confirm === "true") {
        if (confirmTimer) clearTimeout(confirmTimer);
        this.onDelete?.(realm.id);
        return;
      }
      delBtn.dataset.confirm = "true";
      delBtn.textContent = "Sure?";
      delBtn.style.color = "#f66";
      delBtn.style.borderColor = "#f66";
      confirmTimer = setTimeout(() => {
        delBtn.dataset.confirm = "";
        delBtn.textContent = "X";
        delBtn.style.color = "#888";
        delBtn.style.borderColor = "transparent";
      }, 2000);
    });

    card.append(info, delBtn);

    // Click card to select world
    card.addEventListener("click", () => {
      this.onSelect?.(realm.id);
    });

    return card;
  }
}
