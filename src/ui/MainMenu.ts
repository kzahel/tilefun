import {
  createDescriptor,
  descriptorChoice,
  GENERATOR_CATALOG,
  type GenerationDescriptor,
  type GenerationRequest,
  type GeneratorChoice,
  requireCurrentGeneration,
  resolveDescriptor,
  seedFromText,
} from "../generation/GenerationDescriptor.js";
import { DEFAULT_ROAD_PARAMS } from "../generation/RoadGenerator.js";
import type { WorldType } from "../persistence/WorldRegistry.js";
import type { RoomDirectory, RoomInfo } from "../rooms/RoomDirectory.js";
import type { RealmInfo } from "../shared/protocol.js";
import { createHostingButtons, createQRCode, type HostingInfo } from "./HostingBanner.js";
import { PlayerModelPicker } from "./PlayerModelPicker.js";
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
  readonly characterPicker = new PlayerModelPicker();
  private overlay: HTMLDivElement;
  private listEl: HTMLDivElement;
  private worldCount = 0;
  private currentRealms: RealmInfo[] = [];
  private creationError = document.createElement("p");
  /** Map from worldId to the player-count badge element for live updates. */
  private playerCountBadges = new Map<string, HTMLSpanElement>();
  /** The world the local player is currently in (shown as "You are here"). */
  currentWorldId: string | null = null;

  roomDirectory: RoomDirectory | null = null;
  private hostingSection: HTMLDivElement;

  onSelect: ((worldId: string) => void) | null = null;
  onCreate:
    | ((name: string, worldType: WorldType, seed?: number, generation?: GenerationRequest) => void)
    | null = null;
  onRecreate: ((id: string) => void) | null = null;
  onDelete: ((worldId: string) => void) | null = null;
  onRename: ((worldId: string, name: string) => void) | null = null;
  onClose: (() => void) | null = null;
  onSwitchProfile: (() => void) | null = null;
  onHostP2P: (() => void) | null = null;

  constructor() {
    this.overlay = document.createElement("div");
    this.overlay.style.cssText = OVERLAY_STYLE;
    this.overlay.style.display = "none";

    const title = document.createElement("div");
    title.style.cssText = TITLE_STYLE;
    title.textContent = "TILEFUN";
    this.overlay.appendChild(title);

    const explorerLink = document.createElement("a");
    const explorerUrl = new URL(`${import.meta.env.BASE_URL}world-explorer.html`, location.href);
    const serverParam = new URL(location.href).searchParams.get("server");
    if (serverParam) explorerUrl.searchParams.set("server", serverParam);
    else if (new URL(location.href).searchParams.has("multiplayer"))
      explorerUrl.searchParams.set("server", `${location.host}/ws`);
    explorerLink.href = explorerUrl.href;
    explorerLink.textContent = "World atlas · regional preview ↗";
    explorerLink.style.cssText = "color: #d8bd87; font: 12px monospace; margin-bottom: 20px;";
    this.overlay.appendChild(explorerLink);
    const toolsLink = document.createElement("a");
    toolsLink.href = `${import.meta.env.BASE_URL}workshop.html`;
    toolsLink.textContent = "Tilefun Workshop ↗";
    toolsLink.style.cssText = "color: #d8bd87; font: 12px monospace; margin-bottom: 20px;";
    this.overlay.appendChild(toolsLink);

    this.overlay.appendChild(this.characterPicker.element);
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
    typeSelect.setAttribute("aria-label", "World type");
    typeSelect.style.cssText = `
      font: 14px monospace; padding: 6px 8px;
      background: rgba(255,255,255,0.1); color: #fff;
      border: 1px solid #888; border-radius: 4px; outline: none;
    `;
    for (const entry of GENERATOR_CATALOG) {
      const opt = document.createElement("option");
      opt.value = entry.choice;
      opt.textContent = entry.label;
      opt.style.background = "#222";
      typeSelect.appendChild(opt);
    }

    const seedInput = document.createElement("input");
    seedInput.type = "text";
    seedInput.setAttribute("aria-label", "World seed");
    seedInput.placeholder = "Seed (random)";
    seedInput.style.cssText = `${INPUT_STYLE} width: 120px; flex: none;`;

    typeSelect.addEventListener("change", () => {
      seedInput.style.display = typeSelect.value === "flat" ? "none" : "";
    });
    typeSelect.addEventListener("keydown", (e) => e.stopPropagation());

    optRow.append(typeSelect, seedInput);

    let imported: GenerationDescriptor | null = null;
    try {
      const serialized = new URL(location.href).searchParams.get("generation");
      if (serialized) {
        imported = requireCurrentGeneration(resolveDescriptor(JSON.parse(serialized)));
        typeSelect.value = descriptorChoice(imported);
        seedInput.value = String(imported.seed);
        nameInput.value = "Explorer world";
      }
    } catch (error) {
      this.showCreationError(String(error));
    }
    const settingsRow = document.createElement("div");
    settingsRow.style.cssText = "display:flex; flex-wrap:wrap; gap:8px; font:12px monospace;";
    const roads = imported?.type === "classic" ? { ...imported.roads } : { ...DEFAULT_ROAD_PARAMS };
    for (const [key, label, min, max, step] of [
      ["spacing", "Road spacing", 8, 256, 1],
      ["density", "Road density", 0, 1, 0.05],
      ["width", "Road width", 1, 16, 1],
    ] as const) {
      const wrapper = document.createElement("label");
      wrapper.textContent = label;
      const input = document.createElement("input");
      input.type = "number";
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(roads[key]);
      input.setAttribute("aria-label", label);
      input.style.cssText = `${INPUT_STYLE} width:65px; display:block;`;
      input.onchange = () => {
        if (input.checkValidity()) roads[key] = Number(input.value);
        else input.reportValidity();
      };
      input.addEventListener("keydown", (event) => event.stopPropagation());
      input.addEventListener("keyup", (event) => event.stopPropagation());
      wrapper.append(input);
      settingsRow.append(wrapper);
    }
    const showSettings = () => {
      settingsRow.style.display = ["classic", "island"].includes(typeSelect.value)
        ? "flex"
        : "none";
    };
    typeSelect.addEventListener("change", showSettings);
    showSettings();
    this.creationError.setAttribute("role", "alert");
    this.creationError.style.cssText = "color:#ffb5a0; font:12px monospace; margin:0;";
    const doCreate = () => {
      try {
        const name = nameInput.value.trim() || `World ${this.worldCount + 1}`;
        const choice = typeSelect.value as GeneratorChoice;
        const seedVal = seedInput.value.trim();
        const seed = seedVal
          ? imported && seedVal === String(imported.seed)
            ? imported.seed
            : seedFromText(seedVal)
          : undefined;
        const generation: GenerationRequest =
          seed === undefined ? { choice, roads } : createDescriptor(choice, seed, roads);
        this.creationError.textContent = "";
        this.onCreate?.(name, choice === "classic" ? "generated" : choice, seed, generation);
      } catch (error) {
        this.showCreationError(String(error));
      }
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

    newSection.append(nameRow, optRow, settingsRow, this.creationError);
    this.overlay.appendChild(newSection);

    // Hosting info section (hidden unless hosting)
    this.hostingSection = document.createElement("div");
    this.hostingSection.style.cssText =
      "display: none; flex-direction: column; gap: 6px; width: 320px; margin-top: 12px; padding: 10px 12px; background: rgba(79,195,247,0.1); border: 1px solid #4fc3f7; border-radius: 6px;";
    this.overlay.appendChild(this.hostingSection);

    // Bottom button group — constrained to same width as world list
    const btnGroup = document.createElement("div");
    btnGroup.style.cssText =
      "display: flex; flex-direction: column; gap: 8px; width: 320px; margin-top: 16px;";

    // Resume button to close menu and return to game
    const resumeBtn = document.createElement("button");
    resumeBtn.textContent = "Resume";
    resumeBtn.style.cssText = `${BTN_STYLE} width: 100%; font-size: 16px; padding: 10px 16px; background: rgba(100,160,255,0.2); border-color: #68f;`;
    resumeBtn.addEventListener("click", () => this.onClose?.());
    btnGroup.appendChild(resumeBtn);

    // Secondary buttons row
    const secondaryRow = document.createElement("div");
    secondaryRow.style.cssText = "display: flex; gap: 8px;";

    const switchBtn = document.createElement("button");
    switchBtn.textContent = "Switch Player";
    switchBtn.style.cssText = `${BTN_STYLE} flex: 1; color: #aaa;`;
    switchBtn.addEventListener("click", () => this.onSwitchProfile?.());

    const hostBtn = document.createElement("button");
    hostBtn.textContent = "Host P2P";
    hostBtn.style.cssText = `${BTN_STYLE} flex: 1; color: #4fc3f7;`;
    hostBtn.addEventListener("click", () => {
      if (this.onHostP2P) {
        this.onHostP2P();
      } else {
        const url = new URL(window.location.href);
        url.searchParams.delete("host");
        url.searchParams.delete("multiplayer");
        url.searchParams.delete("server");
        url.searchParams.delete("join");
        window.location.href = `${url.toString()}${url.search ? "&" : "?"}host`;
      }
    });

    secondaryRow.append(switchBtn, hostBtn);
    btnGroup.appendChild(secondaryRow);

    // Browse Public Games button
    const browseBtn = document.createElement("button");
    browseBtn.textContent = "Browse Public Games";
    browseBtn.style.cssText = `${BTN_STYLE} width: 100%; color: #fc4;`;
    browseBtn.addEventListener("click", () => this.showBrowsePanel());
    btnGroup.appendChild(browseBtn);

    this.overlay.appendChild(btnGroup);

    // About section
    const aboutEl = document.createElement("div");
    aboutEl.style.cssText = "margin-top: 24px; font-size: 12px; color: #666; text-align: center;";
    const link = document.createElement("a");
    link.href = "https://github.com/kzahel/tilefun";
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "github.com/kzahel/tilefun";
    link.style.cssText = "color: #68f; text-decoration: none;";
    link.addEventListener("mouseenter", () => {
      link.style.textDecoration = "underline";
    });
    link.addEventListener("mouseleave", () => {
      link.style.textDecoration = "none";
    });
    aboutEl.append("Tilefun \u00B7 ", link);
    this.overlay.appendChild(aboutEl);

    // Prevent keyboard shortcuts from firing while interacting with menu
    this.overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") return; // let Escape bubble to close menu
      e.stopPropagation();
    });
    this.overlay.addEventListener("keyup", (e) => {
      if (e.key === "Escape") return; // let Escape bubble so ActionManager clears keysDown
      e.stopPropagation();
    });

    document.body.appendChild(this.overlay);
  }

  get visible(): boolean {
    return this.overlay.style.display !== "none";
  }

  showCreationError(message: string): void {
    this.creationError.textContent = message;
  }

  show(realms: RealmInfo[]): void {
    this.characterPicker.setVisible(true);
    this.worldCount = realms.length;
    this.currentRealms = realms;
    this.playerCountBadges.clear();
    this.overlay.style.display = "flex";
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

  set hostingInfo(info: HostingInfo | null) {
    this.hostingSection.innerHTML = "";
    if (!info) {
      this.hostingSection.style.display = "none";
      return;
    }
    this.hostingSection.style.display = "flex";

    const label = document.createElement("div");
    label.style.cssText = "color: #4fc3f7; font-weight: bold; font-size: 13px;";
    label.textContent = "Hosting P2P Game";

    const urlEl = document.createElement("div");
    urlEl.style.cssText = "word-break: break-all; color: #aaa; font-size: 11px;";
    urlEl.textContent = info.joinUrl;

    const qr = createQRCode(info.joinUrl);

    const btnRow = createHostingButtons(info);

    this.hostingSection.append(label, urlEl, qr, btnRow);
  }

  hide(): void {
    this.characterPicker.setVisible(false);
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

    // "You are here" indicator for current world
    const hereBadge = document.createElement("span");
    hereBadge.style.cssText =
      "font-size: 11px; color: #8cf; background: rgba(100,160,255,0.2); padding: 1px 6px; border-radius: 8px; white-space: nowrap;";
    hereBadge.textContent = "You are here";
    if (realm.id !== this.currentWorldId) {
      hereBadge.style.display = "none";
    }

    nameRow.append(nameEl, badge, hereBadge);

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

    const generationEl = document.createElement("div");
    generationEl.style.cssText = "font:12px monospace; color:#b8d0b8;";
    if (realm.generation)
      generationEl.textContent = `${descriptorChoice(realm.generation)} · seed ${realm.generation.seed} · ${realm.generation.version}`;
    const inspect = document.createElement("a");
    const inspectUrl = new URL(`${import.meta.env.BASE_URL}world-explorer.html`, location.href);
    inspectUrl.searchParams.set("worldId", realm.id);
    if (realm.generation)
      inspectUrl.searchParams.set("generation", JSON.stringify(realm.generation));
    const serverParam = new URL(location.href).searchParams.get("server");
    if (serverParam) inspectUrl.searchParams.set("server", serverParam);
    else if (new URL(location.href).searchParams.has("multiplayer"))
      inspectUrl.searchParams.set("server", `${location.host}/ws`);
    inspect.href = inspectUrl.href;
    inspect.textContent = "Inspect saved world ↗";
    inspect.style.cssText = "color:#d8bd87;font:12px monospace";
    inspect.onclick = (event) => event.stopPropagation();
    info.append(nameRow, generationEl, timeEl, inspect);

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

    if (realm.incompatibleReason) {
      const reason = document.createElement("p");
      reason.textContent = realm.incompatibleReason;
      reason.style.cssText = "color:#edc680;font:12px monospace;margin:6px 0;";
      const recreate = document.createElement("button");
      recreate.textContent = "Recreate with same seed";
      recreate.style.cssText = BTN_STYLE;
      recreate.title =
        "Create a fresh world using the current generator. The old world is kept; edits and saved characters are not copied.";
      recreate.addEventListener("click", (event) => {
        event.stopPropagation();
        this.onRecreate?.(realm.id);
      });
      const explanation = document.createElement("small");
      explanation.textContent =
        "Starts fresh. Old world kept; edits and characters are not copied.";
      info.append(reason, recreate, explanation);
      inspect.remove();
    }
    card.append(info, delBtn);

    // Click card to select world
    card.addEventListener("click", () => {
      if (!realm.incompatibleReason) this.onSelect?.(realm.id);
    });

    return card;
  }

  private async showBrowsePanel(): Promise<void> {
    if (!this.roomDirectory) return;

    // Create a modal overlay for the room list
    const panel = document.createElement("div");
    panel.style.cssText = `
      position: fixed; inset: 0; z-index: 250;
      background: rgba(10, 10, 30, 0.95);
      display: flex; flex-direction: column; align-items: center;
      padding: 32px 16px; overflow-y: auto;
      font-family: monospace; color: #fff;
    `;

    const header = document.createElement("div");
    header.style.cssText = "font-size: 24px; font-weight: bold; color: #fc4; margin-bottom: 16px;";
    header.textContent = "Public Games";

    const roomListEl = document.createElement("div");
    roomListEl.style.cssText =
      "display: flex; flex-direction: column; gap: 8px; width: 320px; margin-bottom: 16px;";

    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display: flex; gap: 8px;";

    const refreshBtn = document.createElement("button");
    refreshBtn.textContent = "Refresh";
    refreshBtn.style.cssText = `${BTN_STYLE} color: #fc4;`;
    refreshBtn.addEventListener("click", () => loadRooms());

    const backBtn = document.createElement("button");
    backBtn.textContent = "Back";
    backBtn.style.cssText = BTN_STYLE;
    backBtn.addEventListener("click", () => panel.remove());

    btnRow.append(refreshBtn, backBtn);
    panel.append(header, roomListEl, btnRow);

    panel.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        panel.remove();
        return;
      }
      e.stopPropagation();
    });
    panel.addEventListener("keyup", (e) => e.stopPropagation());

    document.body.appendChild(panel);

    const loadRooms = async () => {
      roomListEl.innerHTML = "";
      const loading = document.createElement("div");
      loading.style.cssText = "color: #888; text-align: center; padding: 16px;";
      loading.textContent = "Loading...";
      roomListEl.appendChild(loading);

      const rooms = (await this.roomDirectory?.listRooms()) ?? [];
      roomListEl.innerHTML = "";

      if (rooms.length === 0) {
        const empty = document.createElement("div");
        empty.style.cssText = "color: #888; text-align: center; padding: 16px;";
        empty.textContent = "No public games found";
        roomListEl.appendChild(empty);
        return;
      }

      for (const room of rooms) {
        roomListEl.appendChild(this.createRoomCard(room));
      }
    };

    loadRooms();
  }

  private createRoomCard(room: RoomInfo): HTMLDivElement {
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

    const nameEl = document.createElement("div");
    nameEl.style.cssText =
      "font-weight: bold; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
    nameEl.textContent = room.name;

    const detailEl = document.createElement("div");
    detailEl.style.cssText = "font-size: 12px; color: #999;";
    detailEl.textContent = `Host: ${room.hostName} · ${room.playerCount} player${room.playerCount !== 1 ? "s" : ""}`;

    info.append(nameEl, detailEl);

    const joinBtn = document.createElement("button");
    joinBtn.textContent = "Join";
    joinBtn.style.cssText = `
      font: bold 12px monospace; padding: 4px 12px;
      background: rgba(100, 255, 100, 0.2); color: #8f8;
      border: 1px solid #8f8; border-radius: 4px;
      cursor: pointer; flex-shrink: 0;
    `;
    joinBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const url = new URL(window.location.href);
      url.searchParams.delete("host");
      url.searchParams.delete("multiplayer");
      url.searchParams.delete("server");
      url.searchParams.set("join", room.peerId);
      window.location.href = url.toString();
    });

    card.append(info, joinBtn);
    card.addEventListener("click", () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("host");
      url.searchParams.delete("multiplayer");
      url.searchParams.delete("server");
      url.searchParams.set("join", room.peerId);
      window.location.href = url.toString();
    });

    return card;
  }
}
