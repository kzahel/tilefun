import { applyPlayerModel, normalizePlayerModel } from "../characters/PlayerModels.js";
import type { SceneManager } from "../core/SceneManager.js";
import type { GenerationRequest } from "../generation/GenerationDescriptor.js";
import type { WorldType } from "../persistence/WorldRegistry.js";
import { MenuScene } from "../scenes/MenuScene.js";
import type { View } from "../session/View.js";
import type { Arrival, ClientMessage } from "../shared/protocol.js";
import type { RequestMessage, RequestResponse } from "../shared/requests.js";
import { ACTIVE_PROFILE_KEY, TAB_SESSION_KEY } from "../shared/storageKeys.js";
import type { IClientTransport } from "../transport/Transport.js";
import type { MainMenu } from "../ui/MainMenu.js";
import { ProfilePicker } from "../ui/ProfilePicker.js";
import { requestSessionNavigation } from "../ui/sessionNavigation.js";
import type { RemoteStateView } from "./ClientStateView.js";
import type { GameClientOptions } from "./GameClient.js";

type ProfileStore = NonNullable<GameClientOptions["profileStore"]>;

/** Client state that world and session operations read lazily. */
export interface WorldSessionHost {
  readonly transport: IClientTransport;
  /** Seat 0's view: what it needs streamed (its rectangle, or a 3D view's radius). */
  readonly view: Pick<View, "interestRange">;
  readonly scenes: SceneManager;
  readonly mainMenu: MainMenu;
  readonly stateView: RemoteStateView;
  readonly profile: NonNullable<GameClientOptions["profile"]> | null;
  readonly profileStore: GameClientOptions["profileStore"];
  /** A door transition or the Options dialog prevents opening the menu. */
  readonly menuBlocked: boolean;
  clearPlayInput(): void;
  sendRequest<R extends RequestMessage>(msg: R): Promise<RequestResponse<R>>;
  takeRequestId(): number;
}

/**
 * World and session operations: realm menu actions (join, create, recreate,
 * delete, rename), profile switching, player model changes and the
 * session-level messages sent to authority (flush, visible range, debug).
 */
export class WorldSessionActions {
  /** Guard to prevent concurrent toggleMenu() calls from pushing duplicate MenuScenes. */
  private menuOpening = false;
  private lastVisibleRangeKey: string | null = null;
  /** Last debug flag key sent to server. */
  private lastDebugStateKey: string | null = null;
  /** Explorer handoff target from the page URL, read when the menu is bound. */
  private handoffWorldId: string | null = null;
  private handoffArrival: Arrival | undefined;

  constructor(private readonly host: WorldSessionHost) {}

  /** Open the realm menu with a fresh list, unless something blocks it. */
  async toggleMenu(): Promise<void> {
    if (this.host.menuBlocked) return;
    this.host.clearPlayInput();
    if (this.menuOpening) return;
    this.menuOpening = true;
    try {
      this.flushServer();
      const resp = await this.host.sendRequest({
        type: "list-realms",
        requestId: this.host.takeRequestId(),
      });
      this.host.scenes.push(new MenuScene(resp.realms));
    } finally {
      this.menuOpening = false;
    }
  }

  /**
   * Whether the page URL asks to open the menu once startup completes. Valid only after
   * `bindMainMenu()` has read the handoff world id from the URL (init calls it first).
   */
  get startupMenuRequested(): boolean {
    return (
      new URL(location.href).searchParams.has("generation") ||
      new URL(location.href).searchParams.has("desktop") ||
      !!this.handoffWorldId
    );
  }

  flushServer(): void {
    this.host.transport.send({ type: "flush" });
  }

  /** Send current visible chunk range to server when changed. */
  sendVisibleRange(force = false): void {
    const range = this.host.view.interestRange();
    const key = `${range.minCx},${range.minCy},${range.maxCx},${range.maxCy}`;
    if (!force && key === this.lastVisibleRangeKey) return;
    this.lastVisibleRangeKey = key;
    this.host.transport.send({
      type: "visible-range",
      minCx: range.minCx,
      minCy: range.minCy,
      maxCx: range.maxCx,
      maxCy: range.maxCy,
    });
  }

  /** Send debug flags to server when changed. */
  sendDebugState(paused: boolean, force = false): void {
    const key = `${paused ? 1 : 0}`;
    if (!force && key === this.lastDebugStateKey) return;
    this.lastDebugStateKey = key;
    this.host.transport.send({ type: "set-debug", paused });
  }

  bindCharacterPicker(): void {
    const { mainMenu, profileStore } = this.host;
    mainMenu.characterPicker.onSelect = async (model) => {
      const profile = this.host.profile;
      const previous = normalizePlayerModel(profile?.playerModel);
      // Persist before acknowledging the UI; restore the preference if authority rejects it.
      if (profile && profileStore?.updateProfile)
        await profileStore.updateProfile(profile.id, { playerModel: model });
      try {
        await this.host.sendRequest({
          type: "set-player-model",
          requestId: this.host.takeRequestId(),
          model,
        });
      } catch (error) {
        if (profile && profileStore?.updateProfile)
          await profileStore.updateProfile(profile.id, { playerModel: previous });
        throw error;
      }
      if (profile) profile.playerModel = model;
      // The menu pauses replica application; reflect the accepted appearance immediately.
      applyPlayerModel(this.host.stateView.playerEntity, model);
    };
  }

  /** Read the explorer handoff from the URL and wire the realm menu actions. */
  bindMainMenu(): void {
    const handoffParams = new URL(location.href).searchParams;
    this.handoffWorldId = handoffParams.get("worldId");
    try {
      const raw = handoffParams.get("arrival");
      if (raw) this.handoffArrival = JSON.parse(raw);
    } catch {
      this.host.mainMenu.showCreationError("Invalid explorer arrival.");
    }

    const menu = this.host.mainMenu;
    menu.onSelect = (id) => this.selectWorld(id);
    menu.onCreate = (name, worldType, seed, generation) =>
      this.createWorld(name, worldType, seed, generation);
    menu.onRecreate = (id) => this.recreateWorld(id);
    menu.onDelete = (id) => this.deleteWorld(id);
    menu.onRename = (id, name) => {
      void this.host
        .sendRequest({
          type: "rename-world",
          requestId: this.host.takeRequestId(),
          worldId: id,
          name,
        })
        .catch((error) => menu.showCreationError(String(error)));
    };
    menu.onClose = () => this.closeMenu();
    menu.onSwitchProfile = () => this.switchProfile();
  }

  private closeMenu(): void {
    if (this.host.scenes.has(MenuScene)) this.host.scenes.pop();
  }

  private selectWorld(id: string): void {
    // Already on this world — just close the menu
    if (this.host.mainMenu.currentWorldId === id && !this.handoffArrival) {
      this.closeMenu();
      return;
    }
    // realm-joined handler applies camera + clears state + sends visible range
    this.host
      .sendRequest({
        type: "join-realm",
        requestId: this.host.takeRequestId(),
        worldId: id,
        ...(this.handoffWorldId === id && this.handoffArrival
          ? { arrival: this.handoffArrival }
          : {}),
      })
      .then(() => this.closeMenu())
      .catch((error) => this.host.mainMenu.showCreationError(String(error)));
  }

  private createWorld(
    name: string,
    worldType: WorldType,
    seed?: number,
    generation?: GenerationRequest,
  ): void {
    const msg: ClientMessage & { requestId: number } = {
      type: "create-world",
      requestId: this.host.takeRequestId(),
      name,
    };
    if (worldType !== undefined) msg.worldType = worldType;
    if (seed !== undefined) msg.seed = seed;
    if (generation !== undefined) msg.generation = generation;
    this.host
      .sendRequest(msg)
      .then((resp) => {
        return this.host.sendRequest({
          type: "join-realm",
          requestId: this.host.takeRequestId(),
          worldId: resp.meta.id,
          ...(!this.handoffWorldId && this.handoffArrival ? { arrival: this.handoffArrival } : {}),
        });
      })
      .then(() => this.closeMenu())
      .catch((error) => this.host.mainMenu.showCreationError(String(error)));
  }

  private async recreateWorld(id: string): Promise<void> {
    try {
      const response = await this.host.sendRequest({
        type: "recreate-world",
        requestId: this.host.takeRequestId(),
        worldId: id,
      });
      await this.host.sendRequest({
        type: "join-realm",
        requestId: this.host.takeRequestId(),
        worldId: response.meta.id,
      });
      this.closeMenu();
    } catch (error) {
      this.host.mainMenu.showCreationError(String(error));
    }
  }

  private async deleteWorld(id: string): Promise<void> {
    try {
      await this.host.sendRequest({
        type: "delete-world",
        requestId: this.host.takeRequestId(),
        worldId: id,
      });
      const resp = await this.host.sendRequest({
        type: "list-realms",
        requestId: this.host.takeRequestId(),
      });
      this.host.mainMenu.show(resp.realms);
    } catch (error) {
      this.host.mainMenu.showCreationError(String(error));
    }
  }

  private switchProfile(): void {
    if (!this.host.profileStore) return;
    const picker = new ProfilePicker();
    picker.onCancel = () => picker.hide();
    const store: ProfileStore = this.host.profileStore;

    const showList = () => {
      store.listProfiles().then((profiles) => picker.show(profiles));
    };

    picker.onSelect = (profile) => {
      if (!profile) {
        // "Back" pressed from PIN/create screen — re-show list
        showList();
        return;
      }
      // Save selected profile, clear tab session, reload with new identity
      localStorage.setItem(ACTIVE_PROFILE_KEY, profile.id);
      sessionStorage.removeItem(TAB_SESSION_KEY);
      requestSessionNavigation(location.href);
    };

    picker.onCreate = (name) => {
      store.createProfile(name).then((newProfile) => {
        localStorage.setItem(ACTIVE_PROFILE_KEY, newProfile.id);
        sessionStorage.removeItem(TAB_SESSION_KEY);
        requestSessionNavigation(location.href);
      });
    };

    showList();
  }
}
