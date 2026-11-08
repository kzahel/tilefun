import type { ConsoleEngine } from "../console/ConsoleEngine.js";
import type { SceneManager } from "../core/SceneManager.js";
import { captureIdea, type IdeaSnapshot } from "../ideas/captureIdea.js";
import { ideaToast } from "../ideas/IdeaDialog.js";
import { inputHint, keyboardHint } from "../input/InputHints.js";
import type { RenderHost } from "../rendering/RenderHost.js";
import { IdeaScene } from "../scenes/IdeaScene.js";
import { InteriorCatalogScene } from "../scenes/InteriorCatalogScene.js";
import { PropEditorScene } from "../scenes/PropEditorScene.js";
import type { MainMenu } from "../ui/MainMenu.js";
import { activateMenu, deactivateMenu } from "../ui/MenuNavigation.js";
import { OptionsDialog } from "../ui/OptionsDialog.js";
import type { RemoteStateView } from "./ClientStateView.js";
import type { GameClientOptions } from "./GameClient.js";
import type { PlayInputController } from "./PlayInputController.js";

type ProfileUpdates = Parameters<
  NonNullable<NonNullable<GameClientOptions["profileStore"]>["updateProfile"]>
>[1];

/** Client state and actions the menu chrome reads lazily. */
export interface MenuChromeHost {
  readonly canvas: HTMLCanvasElement;
  readonly renderHost: RenderHost;
  readonly stateView: RemoteStateView;
  readonly mainMenu: MainMenu;
  readonly scenes: SceneManager;
  readonly consoleEngine: ConsoleEngine;
  readonly profile: NonNullable<GameClientOptions["profile"]> | null;
  readonly profileStore: GameClientOptions["profileStore"];
  readonly doorBusy: boolean;
  toggleMenu(): Promise<void>;
  toggleWorldMap(): void;
  toggleEditor(): void;
  toggleDebug(): void;
}

const MENU_BTN_STYLE = `
      font: bold 14px monospace; padding: 10px 16px;
      background: none; color: #fff; border: none;
      cursor: pointer; user-select: none; text-align: left;
      width: 100%;
    `;

function menuButton(text: string, css: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.textContent = text;
  button.style.cssText = css;
  return button;
}

/**
 * In-game menu chrome: the hamburger side panel and its tools, the Options
 * dialog and gear button, the world-map button, the VR entry and the storage
 * status notice.
 */
export class GameMenuChrome {
  readonly optionsDialog: OptionsDialog;
  optionsButton: HTMLButtonElement | null = null;
  mapButton: HTMLButtonElement | null = null;
  /** Edit/Play toggle in the side panel; scenes relabel it. */
  editorButton: HTMLButtonElement | null = null;
  private hamburgerOpen = false;
  private panelOpen = false;
  private ideaSnapshot: IdeaSnapshot | undefined;
  private readonly backdrop = document.createElement("div");
  private readonly panel = document.createElement("div");
  private storagePausedState = false;
  private storageNotice: HTMLDivElement | undefined;
  private storageNoticeTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly host: MenuChromeHost,
    private readonly playInput: PlayInputController,
  ) {
    this.optionsDialog = new OptionsDialog(
      async (mode) => {
        playInput.setMovementMode(mode);
        if (host.profile) host.profile.touchMovement = mode;
        await this.saveProfile({ touchMovement: mode });
      },
      () => playInput.clearPlayInput(),
      async (enabled) => {
        playInput.setPinchZoom(enabled);
        if (host.profile) host.profile.pinchZoom = enabled;
        await this.saveProfile({ pinchZoom: enabled });
      },
      async (style) => {
        playInput.setCarDriving(style);
        if (host.profile) host.profile.carDriving = style;
        await this.saveProfile({ carDriving: style });
      },
      async (enabled) => {
        // The cvar owns the live state (V key, console, ?view=fps); the profile remembers it.
        host.consoleEngine.cvars.get("r_firstperson")?.set(enabled);
        if (host.profile) host.profile.firstPerson = enabled;
        await this.saveProfile({ firstPerson: enabled });
      },
    );
  }

  /** The hamburger panel or the Options dialog is open. */
  get menuOpen(): boolean {
    return this.hamburgerOpen || this.optionsDialog.visible;
  }

  /** Authority paused saving; play gestures wait until it resumes. */
  get storagePaused(): boolean {
    return this.storagePausedState;
  }

  showStorageStatus(message: string, paused: boolean): void {
    this.storagePausedState = paused;
    clearTimeout(this.storageNoticeTimer);
    if (!message) {
      this.storageNotice?.remove();
      this.storageNotice = undefined;
      return;
    }
    const notice = this.storageNotice ?? document.createElement("div");
    notice.dataset.testid = "storage-status";
    notice.setAttribute("role", "status");
    notice.style.cssText =
      "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:10000;background:#312619;color:#fff;padding:12px 20px;border:1px solid #edbd73;border-radius:8px;max-width:85vw;text-align:center;font:16px sans-serif;pointer-events:none";
    notice.textContent = message;
    document.body.append(notice);
    this.storageNotice = notice;
    if (!paused)
      this.storageNoticeTimer = setTimeout(() => this.showStorageStatus("", false), 6000);
  }

  openOptions(opener: HTMLElement): void {
    if (this.host.doorBusy) return;
    this.playInput.clearPlayInput();
    this.optionsDialog.show(
      this.playInput.movementMode,
      opener,
      this.playInput.pinchZoom,
      this.playInput.carDriving,
      this.host.consoleEngine.cvars.get("r_firstperson")?.get() === true,
    );
  }

  /** Keep the map button's controller/keyboard hint current. */
  updateMapHint(): void {
    if (!this.mapButton) return;
    const hint = inputHint(keyboardHint("toggle_world_map"), "View");
    const label = `Map${hint ? ` · ${hint}` : ""}`;
    if (this.mapButton.textContent !== label) this.mapButton.textContent = label;
  }

  /** Build the hamburger panel, gear, map and VR buttons and the menu tools. */
  mount(): void {
    // Backdrop overlay (click to close)
    this.backdrop.style.cssText =
      "position: fixed; inset: 0; z-index: 180; background: rgba(0,0,0,0.3); display: none;";
    this.backdrop.addEventListener("click", () => this.closePanel());

    // Slide-in panel
    this.panel.style.cssText = `
      position: fixed; top: 0; left: 0; bottom: 0; width: 200px;
      background: rgba(0,0,0,0.85); z-index: 190;
      display: flex; flex-direction: column; padding: 60px 8px 8px;
      transform: translateX(-100%); transition: transform 0.2s ease-out;
    `;
    this.panel.inert = true;

    const hamburger = this.createHamburger();
    this.optionsButton = this.createGearButton();
    this.mapButton = this.createMapButton();
    const items = this.createPanelItems(hamburger);
    this.host.mainMenu.setTools([
      {
        label: "Idea",
        run: () => {
          this.host.mainMenu.onClose?.();
          this.openPanel();
          items.idea.click();
        },
      },
      {
        label: "Debug",
        run: () => {
          this.host.mainMenu.onClose?.();
          items.debug.click();
        },
      },
      {
        label: "Interiors",
        run: () => {
          this.host.mainMenu.onClose?.();
          items.interiors.click();
        },
      },
    ]);
    document.body.append(this.backdrop, this.panel, hamburger);
  }

  private saveProfile(updates: ProfileUpdates): Promise<void> {
    const { profile, profileStore } = this.host;
    if (!profile || !profileStore?.updateProfile) throw new Error("No profile storage");
    return profileStore.updateProfile(profile.id, updates);
  }

  private openMenu(): void {
    void this.host
      .toggleMenu()
      .catch((error) => this.host.consoleEngine.output.printError(String(error)));
  }

  private openPanel(): void {
    this.panel.inert = false;
    this.playInput.clearPlayInput();
    this.hamburgerOpen = true;
    try {
      const position = this.host.stateView.playerEntity.position;
      this.ideaSnapshot = captureIdea(
        this.host.renderHost.captureFrame?.() ?? this.host.canvas,
        this.host.mainMenu.currentWorldId ?? "",
        position.wx,
        position.wy,
      );
    } catch {
      this.ideaSnapshot = undefined;
    }
    activateMenu(this.panel, this.closePanel);
    this.panelOpen = true;
    this.backdrop.style.display = "";
    this.panel.style.transform = "translateX(0)";
  }

  private readonly closePanel = (): void => {
    deactivateMenu(this.panel);
    this.panel.inert = true;
    this.hamburgerOpen = false;
    this.playInput.clearPlayInput();
    this.panelOpen = false;
    this.backdrop.style.display = "none";
    this.panel.style.transform = "translateX(-100%)";
  };

  private createHamburger(): HTMLButtonElement {
    const hamburger = document.createElement("button");
    hamburger.textContent = "☰";
    hamburger.setAttribute("data-testid", "main-menu-toggle");
    hamburger.style.cssText = `
      position: fixed; top: 8px; left: 8px; z-index: 200;
      width: 44px; height: 44px; font-size: 24px;
      background: rgba(0,0,0,0.6); color: #fff;
      border: 1px solid #888; border-radius: 4px;
      cursor: pointer; user-select: none; line-height: 1;
    `;
    hamburger.addEventListener("click", () => {
      if (window.tilefunDesktop) {
        this.openMenu();
        return;
      }
      if (this.panelOpen) this.closePanel();
      else this.openPanel();
    });
    return hamburger;
  }

  private createGearButton(): HTMLButtonElement {
    const gear = document.createElement("button");
    gear.textContent = "⚙";
    gear.setAttribute("aria-label", "Options");
    gear.style.cssText =
      "position:fixed;top:max(8px,env(safe-area-inset-top));left:calc(max(8px,env(safe-area-inset-left)) + 52px);z-index:200;width:48px;height:48px;font:26px system-ui;color:white;background:#243a32;border:1px solid #9ab59c;border-radius:8px;cursor:pointer;";
    gear.onclick = () => {
      this.closePanel();
      this.openOptions(gear);
    };
    document.body.append(gear);
    return gear;
  }

  private createMapButton(): HTMLButtonElement {
    const mapBtn = document.createElement("button");
    mapBtn.textContent = "Map · G";
    mapBtn.setAttribute("aria-label", "Open world map");
    mapBtn.setAttribute("data-testid", "open-world-map");
    mapBtn.style.cssText =
      "position:fixed;top:8px;right:8px;z-index:90;min-height:44px;padding:8px 14px;color:#fff;background:#243a32;border:1px solid #9ab59c;border-radius:6px;font:14px system-ui;cursor:pointer;";
    mapBtn.onclick = () => {
      this.closePanel();
      this.host.toggleWorldMap();
    };
    document.body.append(mapBtn);
    return mapBtn;
  }

  /** Side-panel menu items, appended in display order. */
  private createPanelItems(hamburger: HTMLButtonElement): {
    idea: HTMLButtonElement;
    debug: HTMLButtonElement;
    interiors: HTMLButtonElement;
  } {
    const { scenes } = this.host;
    const optionsBtn = menuButton("Options", `${MENU_BTN_STYLE} min-height:48px;`);
    optionsBtn.onclick = () => {
      this.closePanel();
      this.openOptions(hamburger);
    };
    const ideaBtn = menuButton("💡 Idea", MENU_BTN_STYLE);
    ideaBtn.onclick = () => {
      this.closePanel();
      if (!this.ideaSnapshot) {
        ideaToast("Couldn't take a game picture. Open the menu and try again.");
        return;
      }
      scenes.push(new IdeaScene(this.ideaSnapshot));
    };
    const editBtn = menuButton("Play", MENU_BTN_STYLE);
    editBtn.addEventListener("click", () => {
      this.closePanel();
      this.host.toggleEditor();
    });
    this.editorButton = editBtn;

    const menuBtn = menuButton("Menu", MENU_BTN_STYLE);
    menuBtn.addEventListener("click", () => {
      this.closePanel();
      this.openMenu();
    });

    const debugBtn = menuButton("Debug", MENU_BTN_STYLE);
    debugBtn.addEventListener("click", () => {
      this.closePanel();
      this.host.toggleDebug();
    });

    const propEditorBtn = menuButton("Prop Editor", MENU_BTN_STYLE);
    propEditorBtn.addEventListener("click", () => {
      this.closePanel();
      if (scenes.has(PropEditorScene)) {
        scenes.pop();
      } else {
        scenes.push(new PropEditorScene());
      }
    });

    const interiorsBtn = menuButton("Interiors", MENU_BTN_STYLE);
    interiorsBtn.setAttribute("data-testid", "open-interiors-catalog");
    interiorsBtn.addEventListener("click", () => {
      this.closePanel();
      if (scenes.has(InteriorCatalogScene)) {
        scenes.pop();
      } else {
        scenes.push(new InteriorCatalogScene());
      }
    });

    const workbenchBtn = menuButton("Indoor Workbench", MENU_BTN_STYLE);
    workbenchBtn.setAttribute("data-testid", "open-indoor-workbench");
    workbenchBtn.addEventListener("click", () => {
      window.location.href = "interior-workbench.html";
    });

    const toolsLink = document.createElement("a");
    toolsLink.href = `${import.meta.env.BASE_URL}workshop.html`;
    toolsLink.textContent = "Tilefun Workshop";
    toolsLink.setAttribute("data-testid", "open-tools-index");
    toolsLink.style.cssText = `${MENU_BTN_STYLE} display: block; text-decoration: none;`;
    this.panel.append(
      optionsBtn,
      ideaBtn,
      editBtn,
      menuBtn,
      toolsLink,
      debugBtn,
      propEditorBtn,
      interiorsBtn,
      workbenchBtn,
    );
    return { idea: ideaBtn, debug: debugBtn, interiors: interiorsBtn };
  }
}
