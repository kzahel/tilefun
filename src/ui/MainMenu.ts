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
import type { RoomDirectory } from "../rooms/RoomDirectory.js";
import type { RealmInfo } from "../shared/protocol.js";
import { createHostingButtons, createQRCode, type HostingInfo } from "./HostingBanner.js";
import { activateMenu, deactivateMenu } from "./MenuNavigation.js";
import { PlayerModelPicker } from "./PlayerModelPicker.js";
import { relativeTime } from "./relativeTime.js";
import { requestSessionNavigation, sessionUrl } from "./sessionNavigation.js";

type Page =
  | "home"
  | "worlds"
  | "create"
  | "advanced"
  | "multiplayer"
  | "join"
  | "browse"
  | "character"
  | "tools"
  | "manage";

/** Shared mouse, touch and controller menu. World/settings state survives submenu travel. */
export class MainMenu {
  readonly characterPicker = new PlayerModelPicker();
  private overlay = document.createElement("div");
  private title = document.createElement("h1");
  private content = document.createElement("div");
  private creationError = document.createElement("p");
  private page: Page = "home";
  private firstOpen = true;
  private currentRealms: RealmInfo[] = [];
  private info: HostingInfo | null = null;
  private selected: RealmInfo | null = null;
  private name = document.createElement("input");
  private seed = document.createElement("input");
  private type = document.createElement("select");
  private roads = { ...DEFAULT_ROAD_PARAMS };
  private roadControls: HTMLLabelElement[] = [];
  private imported: GenerationDescriptor | null = null;
  private generationError = "";
  private browseVersion = 0;
  private resumeFocus: HTMLElement | null = null;
  private toolActions: { label: string; run: () => void }[] = [];
  currentWorldId: string | null = null;
  roomDirectory: RoomDirectory | null = null;
  onSelect: ((worldId: string) => void) | null = null;
  onCreate:
    | ((name: string, worldType: WorldType, seed?: number, generation?: GenerationRequest) => void)
    | null = null;
  onRecreate: ((id: string) => void) | null = null;
  onDelete: ((worldId: string) => void) | null = null;
  onRename: ((worldId: string, name: string) => void) | null = null;
  onClose: (() => void) | null = null;
  onOptions: ((opener: HTMLButtonElement) => void) | null = null;
  onSwitchProfile: (() => void) | null = null;
  onHostP2P: (() => void) | null = null;
  onBuild: (() => void) | null = null;

  constructor() {
    this.overlay.className = "game-menu";
    this.overlay.dataset.testid = "world-menu";
    this.overlay.hidden = true;
    this.overlay.setAttribute("role", "dialog");
    this.overlay.setAttribute("aria-modal", "true");
    this.title.id = "game-menu-title";
    this.overlay.setAttribute("aria-labelledby", this.title.id);
    this.content.className = "menu-page";
    this.creationError.setAttribute("role", "alert");
    this.creationError.className = "menu-danger";
    const help = document.createElement("div");
    help.className = "menu-help";
    help.textContent = "D-pad / stick: move   ·   A: select   ·   B: back";
    this.overlay.append(this.title, this.content, this.creationError, help);
    this.overlay.addEventListener("keydown", (e) => e.stopPropagation());
    this.overlay.addEventListener("keyup", (e) => e.stopPropagation());
    this.name.placeholder = "World name...";
    this.name.setAttribute("aria-label", "World name");
    this.seed.placeholder = "Seed (random)";
    this.seed.setAttribute("aria-label", "World seed");
    this.type.setAttribute("aria-label", "World type");
    for (const entry of GENERATOR_CATALOG) {
      const option = document.createElement("option");
      option.value = entry.choice;
      option.textContent = entry.label;
      this.type.append(option);
    }
    try {
      const raw = new URL(location.href).searchParams.get("generation");
      if (raw) {
        this.imported = requireCurrentGeneration(resolveDescriptor(JSON.parse(raw)));
        this.type.value = descriptorChoice(this.imported);
        this.seed.value = String(this.imported.seed);
        this.name.value = "Explorer world";
        if (this.imported.type === "classic") this.roads = { ...this.imported.roads };
      }
    } catch (error) {
      this.generationError = String(error);
    }
    for (const [key, label, min, max, step] of [
      ["spacing", "Road spacing", 8, 256, 1],
      ["density", "Road density", 0, 1, 0.05],
      ["width", "Road width", 1, 16, 1],
    ] as const) {
      const input = document.createElement("input");
      input.type = "number";
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(this.roads[key]);
      input.setAttribute("aria-label", label);
      input.onchange = () => {
        if (input.checkValidity()) this.roads[key] = Number(input.value);
        else input.reportValidity();
      };
      this.roadControls.push(this.label(label, input));
    }
    document.body.append(this.overlay);
  }
  get visible(): boolean {
    return !this.overlay.hidden;
  }
  setTools(actions: { label: string; run: () => void }[]): void {
    this.toolActions = actions;
  }
  showCreationError(message: string): void {
    this.creationError.textContent = message;
  }
  show(realms: RealmInfo[]): void {
    const opening = !this.visible;
    this.currentRealms = realms;
    this.overlay.hidden = false;
    if (opening) {
      this.resumeFocus = document.activeElement as HTMLElement;
      this.openPage(
        !realms.length ||
          (this.firstOpen &&
            new URL(location.href).searchParams.has("generation") &&
            !new URL(location.href).searchParams.has("worldId"))
          ? "create"
          : "home",
      );
      this.firstOpen = false;
    } else this.openPage(this.page);
  }
  hide(): void {
    this.overlay.hidden = true;
    deactivateMenu(this.overlay);
    this.characterPicker.setVisible(false);
    this.resumeFocus?.focus();
  }
  destroy(): void {
    this.hide();
    this.characterPicker.destroy();
    this.overlay.remove();
  }
  back(): void {
    if (this.page === "home") {
      if (this.currentWorldId) this.onClose?.();
    } else
      this.openPage(
        this.page === "advanced"
          ? "create"
          : this.page === "manage"
            ? "worlds"
            : ["join", "browse"].includes(this.page)
              ? "multiplayer"
              : "home",
      );
  }
  set hostingInfo(info: HostingInfo | null) {
    this.info = info;
    if (this.visible) this.openPage("multiplayer");
  }
  updatePlayerCount(id: string, count: number): void {
    const realm = this.currentRealms.find((r) => r.id === id);
    if (realm) realm.playerCount = count;
    const badge = this.content.querySelector<HTMLElement>(`[data-world-count="${CSS.escape(id)}"]`);
    if (badge) badge.textContent = count ? `${count} playing` : "";
  }
  openPage(page: Page): void {
    this.page = page;
    this.overlay.dataset.page = page;
    this.content.replaceChildren();
    this.creationError.textContent = "";
    this.characterPicker.setVisible(page === "character");
    this.browseVersion++;
    this.title.textContent = {
      home: "TILEFUN",
      worlds: "Worlds",
      create: "Create a world",
      advanced: "World settings",
      multiplayer: "Play together",
      join: "Join a game",
      browse: "Public games",
      character: "Character",
      tools: "More",
      manage: "World options",
    }[page];
    if (page === "home") {
      if (this.currentWorldId) {
        this.button("Resume", () => this.onClose?.(), "menu-primary");
        this.button("Build / Play", () => {
          this.onClose?.();
          this.onBuild?.();
        });
      }
      this.button("Worlds", () => this.openPage("worlds"));
      this.button("Multiplayer", () => this.openPage("multiplayer"));
      this.button("Options", (button) => this.onOptions?.(button));
      this.button("Character", () => this.openPage("character"));
      this.button("More", () => this.openPage("tools"));
      if (window.tilefunDesktop) this.button("Save and quit", () => window.tilefunDesktop?.quit());
    } else if (page === "worlds") {
      this.button("Create new world", () => this.openPage("create"), "menu-primary");
      if (!this.currentRealms.length) this.message("No worlds yet. Create your first world.");
      for (const realm of this.currentRealms) this.worldCard(realm);
    } else if (page === "create") {
      this.content.append(
        this.label("Name", this.name),
        this.label("World type", this.type),
        this.label("Seed (optional)", this.seed),
      );
      this.button("New World", () => this.create(), "menu-primary");
      this.button("Advanced settings", () => this.openPage("advanced"));
      this.showCreationError(this.generationError);
    } else if (page === "advanced") {
      if (["classic", "island"].includes(this.type.value))
        this.content.append(...this.roadControls);
    } else if (page === "multiplayer") {
      if (this.info) {
        this.message(`Hosting as ${this.info.hostName}`);
        this.message(`Join code: ${this.info.peerId}`);
        const link = this.message(this.info.joinUrl);
        link.style.overflowWrap = "anywhere";
        this.content.append(createQRCode(this.info.joinUrl), createHostingButtons(this.info));
        this.button("Stop hosting", () => requestSessionNavigation(sessionUrl("local")));
      } else {
        this.message(
          "Host your saved worlds, or join someone else's game. Internet is required to find peers.",
        );
        this.button(
          "Host P2P",
          () => (this.onHostP2P ? this.onHostP2P() : requestSessionNavigation(sessionUrl("host"))),
          "menu-primary",
        );
      }
      this.button("Join with code or link", () => this.openPage("join"));
      this.button("Browse Public Games", () => this.openPage("browse"));
      if (new URL(location.href).searchParams.has("join"))
        this.button("Leave multiplayer", () => requestSessionNavigation(sessionUrl("local")));
    } else if (page === "join") {
      const code = document.createElement("input");
      code.setAttribute("aria-label", "Join code or link");
      code.placeholder = "Code or invitation link";
      this.content.append(this.label("Join code or link", code));
      this.button(
        "Join game",
        () => {
          try {
            requestSessionNavigation(sessionUrl("join", code.value));
          } catch (error) {
            this.showCreationError(String(error));
          }
        },
        "menu-primary",
      );
    } else if (page === "browse") {
      this.button("Refresh", () => this.openPage("browse"));
      const status = this.message("Looking for games…");
      const version = this.browseVersion;
      if (!this.roomDirectory) status.textContent = "Public games are unavailable.";
      else
        void this.roomDirectory
          .listRooms()
          .then((rooms) => {
            if (version !== this.browseVersion || !this.visible) return;
            status.textContent = rooms.length
              ? "Choose a game to join."
              : "No public games found. You can also join with a code.";
            for (const room of rooms) {
              const b = document.createElement("button");
              b.textContent = `${room.name} · ${room.playerCount} playing · Join`;
              b.onclick = () => requestSessionNavigation(sessionUrl("join", room.peerId));
              status.before(b);
            }
          })
          .catch(() => {
            if (version === this.browseVersion)
              status.textContent = "Couldn't load public games. Check your connection and refresh.";
          });
    } else if (page === "character") {
      this.characterPicker.element.open = true;
      this.content.append(this.characterPicker.element);
    } else if (page === "tools") {
      this.button("Switch Player", () => this.onSwitchProfile?.());
      for (const action of this.toolActions)
        if (!window.tilefunDesktop || action.label === "Idea")
          this.button(action.label, action.run);
      if (!window.tilefunDesktop)
        for (const [label, path] of [
          ["World atlas", "world-explorer.html"],
          ["Tilefun Workshop", "workshop.html"],
        ]) {
          const link = document.createElement("a");
          link.textContent = label ?? "";
          link.href = `${import.meta.env.BASE_URL}${path}`;
          this.content.append(link);
        }
    } else if (page === "manage" && this.selected) {
      const realm = this.selected;
      const name = document.createElement("input");
      name.value = realm.name;
      name.setAttribute("aria-label", "World name");
      this.content.append(this.label("Name", name));
      this.button("Rename", () => {
        if (name.value.trim()) {
          this.onRename?.(realm.id, name.value.trim());
          realm.name = name.value.trim();
          this.openPage("worlds");
        }
      });
      this.button(
        "Delete world…",
        () => {
          this.title.textContent = "Delete world?";
          this.content.replaceChildren();
          this.message(`Delete “${realm.name}” permanently?`);
          this.button("Keep world", () => this.openPage("worlds"), "menu-primary");
          this.button(
            "Delete permanently",
            () => {
              this.selected = null;
              this.openPage("worlds");
              this.onDelete?.(realm.id);
            },
            "menu-danger",
          );
          activateMenu(this.overlay, () => this.openPage("worlds"));
        },
        "menu-danger",
      );
    }
    if (page !== "home") this.button("Back", () => this.back());
    activateMenu(this.overlay, () => this.back());
  }
  private button(
    text: string,
    action: (button: HTMLButtonElement) => void,
    cls = "",
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.className = cls;
    button.onclick = () => action(button);
    this.content.append(button);
    return button;
  }
  private label(text: string, control: HTMLElement): HTMLLabelElement {
    const label = document.createElement("label");
    label.append(text, control);
    return label;
  }
  private message(text: string): HTMLParagraphElement {
    const p = document.createElement("p");
    p.textContent = text;
    this.content.append(p);
    return p;
  }
  private create(): void {
    try {
      const choice = this.type.value as GeneratorChoice;
      const raw = this.seed.value.trim();
      const seed = raw
        ? this.imported && raw === String(this.imported.seed)
          ? this.imported.seed
          : seedFromText(raw)
        : undefined;
      const generation: GenerationRequest =
        seed === undefined
          ? { choice, roads: this.roads }
          : createDescriptor(choice, seed, this.roads);
      this.onCreate?.(
        this.name.value.trim() || `World ${this.currentRealms.length + 1}`,
        choice === "classic" ? "generated" : choice,
        seed,
        generation,
      );
    } catch (error) {
      this.showCreationError(String(error));
    }
  }
  private worldCard(realm: RealmInfo): void {
    const card = document.createElement("div");
    card.className = "menu-world";
    const name = document.createElement("strong");
    name.textContent = realm.name;
    const time = document.createElement("span");
    time.className = "menu-muted";
    time.textContent = `${relativeTime(realm.lastPlayedAt)}${realm.id === this.currentWorldId ? " · You are here" : ""}`;
    const count = document.createElement("span");
    count.dataset.worldCount = realm.id;
    count.textContent = realm.playerCount ? `${realm.playerCount} playing` : "";
    const play = document.createElement("button");
    play.textContent = realm.incompatibleReason ? "Recreate with same seed" : `Play ${realm.name}`;
    play.onclick = () =>
      realm.incompatibleReason ? this.onRecreate?.(realm.id) : this.onSelect?.(realm.id);
    card.append(name, time, count);
    if (realm.generation) {
      const generation = document.createElement("span");
      generation.className = "menu-muted";
      generation.textContent = `${descriptorChoice(realm.generation)} · seed ${realm.generation.seed} · ${realm.generation.version}`;
      card.append(generation);
    }
    if (realm.incompatibleReason) {
      const p = document.createElement("p");
      p.textContent = realm.incompatibleReason;
      card.append(p);
    }
    const manage = document.createElement("button");
    manage.textContent = `Options for ${realm.name}`;
    manage.onclick = () => {
      this.selected = realm;
      this.openPage("manage");
    };
    if (!realm.incompatibleReason && !window.tilefunDesktop) {
      const inspect = document.createElement("a");
      const url = new URL(`${import.meta.env.BASE_URL}world-explorer.html`, location.href);
      url.searchParams.set("worldId", realm.id);
      if (realm.generation) url.searchParams.set("generation", JSON.stringify(realm.generation));
      const server = new URL(location.href).searchParams.get("server");
      if (server) url.searchParams.set("server", server);
      else if (new URL(location.href).searchParams.has("multiplayer"))
        url.searchParams.set("server", `${location.host}/ws`);
      inspect.href = url.href;
      inspect.textContent = "Inspect saved world ↗";
      card.append(inspect);
    }
    card.append(play, manage);
    this.content.append(card);
  }
}
