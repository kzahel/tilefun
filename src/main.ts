import { GameClient } from "./client/GameClient.js";
import type { PlayerProfile } from "./persistence/PlayerProfileStore.js";
import { PlayerProfileStore } from "./persistence/PlayerProfileStore.js";
import { GameServer } from "./server/GameServer.js";
import { PeerGuestTransport } from "./transport/PeerGuestTransport.js";
import { PeerHostTransport } from "./transport/PeerHostTransport.js";
import { SerializingTransport } from "./transport/SerializingTransport.js";
import { WebSocketClientTransport } from "./transport/WebSocketClientTransport.js";
import { HostingBanner } from "./ui/HostingBanner.js";
import { ProfilePicker } from "./ui/ProfilePicker.js";

const canvasEl = document.getElementById("game") as HTMLCanvasElement | null;
if (!canvasEl) throw new Error("Canvas element #game not found");
const canvas: HTMLCanvasElement = canvasEl;

// ?server=host:port      → connect to a specific standalone server
// ?multiplayer           → connect to game server on same host (Vite plugin uses /ws path)
// ?server=host:port/ws   → explicit path also works
// ?host                  → P2P host: run server in-browser, accept WebRTC guests
// ?join=PEER_ID          → P2P guest: connect to host via WebRTC DataChannel
// (neither)              → single-player, in-browser server
const params = new URLSearchParams(window.location.search);
const serverParam = params.get("server"); // e.g. "localhost:3001"
const multiplayer = params.has("multiplayer");
const hostP2P = params.has("host");
const joinPeerId = params.get("join");

const ACTIVE_PROFILE_KEY = "tilefun-active-profile";

let client: GameClient;
let server: GameServer | null = null;
let hostingBanner: HostingBanner | null = null;

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

async function start() {
  // Resolve player profile first
  const profileStore = new PlayerProfileStore();
  await profileStore.open();
  const profile = await resolveProfile(profileStore);
  const playerId = profile.id;
  console.log(`[tilefun] Playing as "${profile.name}" (${playerId})`);

  if (joinPeerId) {
    // P2P Guest mode: connect to host via WebRTC DataChannel
    console.log(`[tilefun] Joining P2P host: ${joinPeerId}`);
    const peerTransport = new PeerGuestTransport(joinPeerId, playerId);
    await peerTransport.ready();
    console.log("[tilefun] Connected to P2P host");
    client = new GameClient(canvas, peerTransport, null, {
      mode: "serialized",
      profile,
      profileStore,
    });
    // biome-ignore lint/suspicious/noExplicitAny: debug/test hook
    (canvas as any).__game = client;
    await client.init();
  } else if (serverParam || multiplayer) {
    // Multiplayer mode: connect via WebSocket.
    // ?multiplayer uses /ws path (Vite plugin shares HTTP server with HMR).
    // ?server=host:port connects to standalone server (no path needed).

    const baseWsUrl = serverParam ? `ws://${serverParam}` : `ws://${window.location.host}/ws`;
    const wsUrl = `${baseWsUrl}${baseWsUrl.includes("?") ? "&" : "?"}uuid=${encodeURIComponent(playerId)}`;
    console.log(`[tilefun] Connecting as ${playerId} to ${baseWsUrl}...`);
    const wsTransport = new WebSocketClientTransport(wsUrl);
    await wsTransport.ready();
    console.log("[tilefun] Connected to server");
    client = new GameClient(canvas, wsTransport, null, {
      mode: "serialized",
      profile,
      profileStore,
    });
    // biome-ignore lint/suspicious/noExplicitAny: debug/test hook
    (canvas as any).__game = client;
    await client.init();
  } else if (hostP2P) {
    // P2P Host mode: local server + PeerJS for remote guests
    const peerHost = new PeerHostTransport();
    const peerId = await peerHost.ready();
    console.log(`[tilefun] Hosting P2P game. Peer ID: ${peerId}`);
    server = new GameServer(peerHost.serverSide);
    client = new GameClient(canvas, peerHost.clientSide, null, {
      mode: "serialized",
      profile,
      profileStore,
    });
    // biome-ignore lint/suspicious/noExplicitAny: debug/test hook
    (canvas as any).__game = client;
    await server.init();
    peerHost.triggerConnect();
    await client.init();
    server.startLoop();
    hostingBanner = new HostingBanner(peerId);
  } else {
    // Single-player mode: local server + SerializingTransport
    const transport = new SerializingTransport();
    server = new GameServer(transport.serverSide);
    client = new GameClient(canvas, transport.clientSide, null, {
      mode: "serialized",
      profile,
      profileStore,
    });
    // biome-ignore lint/suspicious/noExplicitAny: debug/test hook
    (canvas as any).__game = client;
    await server.init();
    transport.triggerConnect();
    await client.init();
    server.startLoop();
  }
}

start().catch((err) => console.error("[tilefun] init failed:", err));

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    client?.destroy();
    server?.destroy();
    hostingBanner?.destroy();
  });
}
