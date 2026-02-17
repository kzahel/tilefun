import { GameClient } from "./client/GameClient.js";
import type { PlayerProfile } from "./persistence/PlayerProfileStore.js";
import { PlayerProfileStore } from "./persistence/PlayerProfileStore.js";
import { ROOM_DIRECTORY_URL } from "./rooms/config.js";
import { RoomDirectory } from "./rooms/RoomDirectory.js";
import { GameServer } from "./server/GameServer.js";
import { ACTIVE_PROFILE_KEY, TAB_SESSION_KEY } from "./shared/storageKeys.js";
import { generateUUID } from "./shared/uuid.js";
import { type PeerGuestStatus, PeerGuestTransport } from "./transport/PeerGuestTransport.js";
import { PeerHostTransport } from "./transport/PeerHostTransport.js";
import { SerializingTransport } from "./transport/SerializingTransport.js";
import { WebRtcClientTransport } from "./transport/WebRtcClientTransport.js";
import { WebSocketClientTransport } from "./transport/WebSocketClientTransport.js";
import { HostingBanner } from "./ui/HostingBanner.js";
import { ProfilePicker } from "./ui/ProfilePicker.js";

const canvasEl = document.getElementById("game") as HTMLCanvasElement | null;
if (!canvasEl) throw new Error("Canvas element #game not found");
const canvas: HTMLCanvasElement = canvasEl;

// ?server=host:port      → connect to a specific standalone server
// ?multiplayer           → connect to game server on same host (Vite plugin uses /ws path)
// ?server=host:port/ws   → explicit path also works
// ?transport=webrtc      → dedicated server WebRTC datachannel (WS signaling)
// ?signal=wss://...      → override signaling URL for dedicated WebRTC mode
// ?host                  → P2P host: run server in-browser, accept WebRTC guests
// ?join=PEER_ID          → P2P guest: connect to host via WebRTC DataChannel
// (neither)              → single-player, in-browser server
const params = new URLSearchParams(window.location.search);
const serverParam = params.get("server"); // e.g. "localhost:3001"
const multiplayer = params.has("multiplayer");
const hostP2P = params.has("host");
const joinPeerId = params.get("join");

let client: GameClient;
let server: GameServer | null = null;
let hostingBanner: HostingBanner | null = null;
let roomDirectory: RoomDirectory | null = null;

function resolveWebRtcSignalUrl(serverParam: string | null, wsProto: "ws" | "wss"): string {
  const signalOverride = params.get("signal");
  if (signalOverride) {
    return signalOverride;
  }

  const signalPath = params.get("signalPath") ?? "/rtc-signal";
  if (serverParam) {
    const base = new URL(serverParam.includes("://") ? serverParam : `ws://${serverParam}`);
    return `${base.protocol}//${base.host}${signalPath}`;
  }

  return `${wsProto}://${window.location.host}${signalPath}`;
}

/** Resolve the active player profile (auto-create or show picker). */
async function resolveProfile(profileStore: PlayerProfileStore): Promise<PlayerProfile> {
  const profiles = await profileStore.listProfiles();

  // Auto-create a default profile on first visit
  if (profiles.length === 0) {
    const profile = await profileStore.createProfile("Player 1");
    localStorage.setItem(ACTIVE_PROFILE_KEY, profile.id);
    return profile;
  }

  // Check if we have a saved active profile
  const activeId = localStorage.getItem(ACTIVE_PROFILE_KEY);
  if (activeId) {
    const active = profiles.find((p) => p.id === activeId);
    if (active && profiles.length === 1) {
      // Only one profile and it matches — skip picker
      return active;
    }
  }

  // Single profile, no saved preference — auto-select
  const singleProfile = profiles.length === 1 ? profiles[0] : undefined;
  if (singleProfile) {
    localStorage.setItem(ACTIVE_PROFILE_KEY, singleProfile.id);
    return singleProfile;
  }

  // Multiple profiles — show picker
  return showProfilePicker(profileStore, profiles);
}

function showProfilePicker(
  profileStore: PlayerProfileStore,
  profiles: PlayerProfile[],
): Promise<PlayerProfile> {
  return new Promise((resolve) => {
    const picker = new ProfilePicker();

    const showPicker = (list: PlayerProfile[]) => {
      picker.show(list);
    };

    picker.onSelect = (profile) => {
      if (!profile) {
        // "Back" button pressed from PIN/create screen — re-show list
        profileStore.listProfiles().then(showPicker);
        return;
      }
      localStorage.setItem(ACTIVE_PROFILE_KEY, profile.id);
      picker.hide();
      resolve(profile);
    };

    picker.onCreate = (name) => {
      profileStore.createProfile(name).then((newProfile) => {
        localStorage.setItem(ACTIVE_PROFILE_KEY, newProfile.id);
        picker.hide();
        resolve(newProfile);
      });
    };

    showPicker(profiles);
  });
}

const STATUS_LABELS: Record<PeerGuestStatus, string> = {
  "connecting-signaling": "Connecting to signaling server...",
  "signaling-open": "Searching for host...",
  "connecting-host": "Searching for host...",
  "ice-checking": "Establishing peer connection...",
  "ice-connected": "Opening data channel...",
  "datachannel-open": "Connected!",
  reconnecting: "Reconnecting to host...",
  failed: "Connection failed",
};

function createConnectionOverlay(onCancel: () => void) {
  const el = document.createElement("div");
  el.style.cssText = `
    position: fixed; inset: 0; z-index: 300;
    background: rgba(10, 10, 30, 0.95);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-family: monospace; color: #fff; gap: 16px;
  `;

  const statusEl = document.createElement("div");
  statusEl.style.cssText = "font-size: 18px; color: #8cf;";
  statusEl.textContent = "Connecting...";

  const detailEl = document.createElement("div");
  detailEl.style.cssText = "font-size: 13px; color: #888; min-height: 1.2em;";

  const spinner = document.createElement("div");
  spinner.style.cssText = "font-size: 24px; animation: spin 1s linear infinite;";
  spinner.textContent = "\u25E2";
  // Add keyframe via style element
  const style = document.createElement("style");
  style.textContent =
    "@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }";
  el.appendChild(style);

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.style.cssText = `
    font: bold 14px monospace; padding: 8px 24px; margin-top: 8px;
    background: rgba(255,255,255,0.1); color: #fff;
    border: 1px solid #888; border-radius: 4px; cursor: pointer;
  `;
  cancelBtn.addEventListener("click", onCancel);

  el.append(spinner, statusEl, detailEl, cancelBtn);

  return {
    el,
    update(status: PeerGuestStatus, detail?: string) {
      statusEl.textContent = STATUS_LABELS[status] || status;
      detailEl.textContent = detail || "";
      if (status === "failed") {
        spinner.style.animation = "none";
        spinner.textContent = "\u2717";
        statusEl.style.color = "#f88";
        cancelBtn.textContent = "Back";
      } else {
        // Reset to spinner state (for reconnecting after failure)
        spinner.style.animation = "spin 1s linear infinite";
        spinner.textContent = "\u25E2";
        statusEl.style.color = "#8cf";
        cancelBtn.textContent = "Cancel";
      }
    },
  };
}

async function start() {
  // Resolve player profile first
  const profileStore = new PlayerProfileStore();
  await profileStore.open();
  const profile = await resolveProfile(profileStore);
  const playerIdParam = params.get("playerid");
  const isMultiplayer = !!(joinPeerId || hostP2P || serverParam || multiplayer);

  // For multiplayer connections without explicit ?playerid, generate a per-tab
  // session UUID so multiple tabs on the same computer get separate sessions.
  // sessionStorage persists across page refresh within the same tab.
  let playerId: string;
  if (playerIdParam) {
    playerId = playerIdParam;
  } else if (isMultiplayer) {
    let tabId = sessionStorage.getItem(TAB_SESSION_KEY);
    if (!tabId) {
      tabId = generateUUID();
      sessionStorage.setItem(TAB_SESSION_KEY, tabId);
    }
    playerId = tabId;
  } else {
    playerId = profile.id;
  }

  console.log(
    `[tilefun] Playing as "${profile.name}" (${playerId}${playerIdParam ? ", overridden via ?playerid" : ""})`,
  );
  roomDirectory = new RoomDirectory(ROOM_DIRECTORY_URL);

  if (joinPeerId) {
    // P2P Guest mode: connect to host via WebRTC DataChannel
    console.log(`[tilefun] Joining P2P host: ${joinPeerId}`);
    const peerTransport = new PeerGuestTransport(joinPeerId, playerId);
    const abortCtrl = new AbortController();

    // Show connection overlay
    const overlay = createConnectionOverlay(() => {
      abortCtrl.abort();
      peerTransport.close();
      // Navigate back without ?join param
      const url = new URL(window.location.href);
      url.searchParams.delete("join");
      window.location.href = url.toString();
    });
    document.body.appendChild(overlay.el);

    peerTransport.onStatus = (status, detail) => {
      overlay.update(status, detail);
    };

    try {
      await peerTransport.ready(30_000, abortCtrl.signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      overlay.update("failed", err instanceof Error ? err.message : String(err));
      return; // stay on the overlay so user can read the error and cancel
    }
    overlay.el.remove();

    // Keep listening for reconnection events — re-show overlay if connection drops
    peerTransport.onStatus = (status, detail) => {
      if (status === "reconnecting" || status === "failed") {
        if (!overlay.el.parentNode) document.body.appendChild(overlay.el);
        overlay.update(status, detail);
      } else if (status === "datachannel-open") {
        overlay.el.remove();
      }
    };

    console.log("[tilefun] Connected to P2P host");
    client = new GameClient(canvas, peerTransport, null, {
      mode: "serialized",
      profile,
      profileStore,
      roomDirectory,
      autoJoinRealm: true,
      clientId: playerId,
    });
    // biome-ignore lint/suspicious/noExplicitAny: debug/test hook
    (canvas as any).__game = client;
    await client.init();
  } else if (hostP2P) {
    // P2P Host mode: local server + PeerJS for remote guests
    // Use profile ID as peer ID so the join URL survives host refreshes
    const peerHost = new PeerHostTransport(playerId);
    const peerId = await peerHost.ready();
    console.log(`[tilefun] Hosting P2P game. Peer ID: ${peerId}`);
    server = new GameServer(peerHost.serverSide);
    client = new GameClient(canvas, peerHost.clientSide, null, {
      mode: "serialized",
      profile,
      profileStore,
      roomDirectory,
      clientId: playerId,
    });
    // biome-ignore lint/suspicious/noExplicitAny: debug/test hook
    (canvas as any).__game = client;
    await server.init();
    peerHost.triggerConnect();
    await client.init();
    server.startLoop();
    hostingBanner = new HostingBanner(peerId, {
      directory: roomDirectory,
      getPlayerCount: () => peerHost.playerCount,
      hostName: profile.name,
    });
    client.setHostingInfo(hostingBanner.info);
  } else if (serverParam || multiplayer) {
    // Multiplayer mode: connect via WebSocket.
    // ?multiplayer uses /ws path (Vite plugin shares HTTP server with HMR).
    // ?server=host:port connects to standalone server (no path needed).

    const wsProto = window.location.protocol === "https:" ? "wss" : "ws";
    const transportParam = params.get("transport")?.toLowerCase();
    if (transportParam === "webrtc") {
      const signalUrl = resolveWebRtcSignalUrl(serverParam, wsProto);
      console.log(`[tilefun] Connecting as ${playerId} to ${signalUrl} (WebRTC signaling)...`);
      const rtcTransport = new WebRtcClientTransport({
        signalUrl,
        clientId: playerId,
      });
      await rtcTransport.ready();
      console.log("[tilefun] Connected to server (WebRTC datachannel)");
      client = new GameClient(canvas, rtcTransport, null, {
        mode: "serialized",
        profile,
        profileStore,
        roomDirectory,
        autoJoinRealm: true,
        clientId: playerId,
      });
    } else {
      const baseWsUrl = serverParam
        ? `ws://${serverParam}`
        : `${wsProto}://${window.location.host}/ws`;
      const wsUrl = `${baseWsUrl}${baseWsUrl.includes("?") ? "&" : "?"}uuid=${encodeURIComponent(playerId)}`;
      console.log(`[tilefun] Connecting as ${playerId} to ${baseWsUrl}...`);
      const wsTransport = new WebSocketClientTransport(wsUrl);
      await wsTransport.ready();
      console.log("[tilefun] Connected to server");
      client = new GameClient(canvas, wsTransport, null, {
        mode: "serialized",
        profile,
        profileStore,
        roomDirectory,
        autoJoinRealm: true,
        clientId: playerId,
      });
    }
    // biome-ignore lint/suspicious/noExplicitAny: debug/test hook
    (canvas as any).__game = client;
    await client.init();
  } else {
    // Single-player mode: local server + SerializingTransport
    const transport = new SerializingTransport();
    server = new GameServer(transport.serverSide);
    client = new GameClient(canvas, transport.clientSide, null, {
      mode: "serialized",
      profile,
      profileStore,
      roomDirectory,
      clientId: playerId,
    });
    // biome-ignore lint/suspicious/noExplicitAny: debug/test hook
    (canvas as any).__game = client;
    await server.init();
    transport.triggerConnect();
    await client.init();
    server.startLoop();
  }
}

/** Show a full-screen error overlay with recovery options. */
function showErrorOverlay(error: unknown): void {
  // Only show the first error
  if (document.getElementById("tilefun-error-overlay")) return;

  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error && error.stack ? error.stack : "";

  const overlay = document.createElement("div");
  overlay.id = "tilefun-error-overlay";
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(10, 10, 30, 0.95);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-family: monospace; color: #fff; padding: 32px;
  `;

  const title = document.createElement("div");
  title.style.cssText = "font-size: 24px; font-weight: bold; color: #f66; margin-bottom: 16px;";
  title.textContent = "Something went wrong";

  const msgEl = document.createElement("div");
  msgEl.style.cssText =
    "font-size: 14px; color: #faa; margin-bottom: 12px; max-width: 500px; text-align: center; word-break: break-word;";
  msgEl.textContent = message;

  const stackEl = document.createElement("details");
  stackEl.style.cssText =
    "font-size: 11px; color: #888; max-width: 500px; margin-bottom: 24px; cursor: pointer;";
  const summary = document.createElement("summary");
  summary.textContent = "Details";
  const pre = document.createElement("pre");
  pre.style.cssText =
    "margin-top: 8px; white-space: pre-wrap; word-break: break-word; max-height: 200px; overflow-y: auto;";
  pre.textContent = stack;
  stackEl.append(summary, pre);

  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display: flex; gap: 12px;";

  const btnStyle = `
    font: bold 14px monospace; padding: 10px 20px;
    border: 1px solid #888; border-radius: 4px;
    cursor: pointer; user-select: none;
  `;

  const reloadBtn = document.createElement("button");
  reloadBtn.textContent = "Reload";
  reloadBtn.style.cssText = `${btnStyle} background: rgba(100,160,255,0.2); color: #8cf;`;
  reloadBtn.addEventListener("click", () => window.location.reload());

  // If we're on a ?join= URL, offer going to single-player
  const singlePlayerBtn = document.createElement("button");
  if (joinPeerId || serverParam || multiplayer) {
    singlePlayerBtn.textContent = "Single Player";
    singlePlayerBtn.style.cssText = `${btnStyle} background: rgba(100,255,100,0.15); color: #8f8;`;
    singlePlayerBtn.addEventListener("click", () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("join");
      url.searchParams.delete("server");
      url.searchParams.delete("multiplayer");
      url.searchParams.delete("host");
      window.location.href = url.toString();
    });
  }

  btnRow.append(reloadBtn);
  if (joinPeerId || serverParam || multiplayer) {
    btnRow.append(singlePlayerBtn);
  }
  overlay.append(title, msgEl, stackEl, btnRow);
  document.body.appendChild(overlay);
}

// Catch init errors
start().catch((err) => {
  console.error("[tilefun] init failed:", err);
  showErrorOverlay(err);
});

// Catch runtime errors that happen after init
window.addEventListener("error", (event) => {
  console.error("[tilefun] uncaught error:", event.error);
  showErrorOverlay(event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[tilefun] unhandled rejection:", event.reason);
  showErrorOverlay(event.reason);
});

// Save UI state before page unload (Vite full-reload HMR path)
window.addEventListener("beforeunload", () => {
  client?.saveHMRState();
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    client?.saveHMRState();
    client?.destroy();
    server?.destroy();
    hostingBanner?.destroy();
    roomDirectory?.stopHeartbeat();
  });
}
