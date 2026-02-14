import type { RoomDirectory } from "../rooms/RoomDirectory.js";

export interface HostingInfo {
  peerId: string;
  joinUrl: string;
  directory: RoomDirectory | null;
  getPlayerCount?: (() => number) | undefined;
  hostName: string;
  isPublic: boolean;
  togglePublic: () => void;
}

/**
 * Small fixed-position overlay showing the P2P join URL when hosting.
 * Displayed in the bottom-right corner with a copy button.
 * Can be closed and the info is also available in the MainMenu.
 */
export class HostingBanner {
  private overlay: HTMLDivElement;
  readonly info: HostingInfo;

  constructor(
    peerId: string,
    options?: {
      directory?: RoomDirectory;
      getPlayerCount?: () => number;
      hostName?: string;
    },
  ) {
    const directory = options?.directory ?? null;

    const url = new URL(window.location.href);
    url.searchParams.delete("host");
    url.searchParams.delete("multiplayer");
    url.searchParams.delete("server");
    url.searchParams.set("join", peerId);
    const joinUrl = url.toString();

    this.info = {
      peerId,
      joinUrl,
      directory,
      getPlayerCount: options?.getPlayerCount,
      hostName: options?.hostName ?? "Player",
      isPublic: false,
      togglePublic: () => {
        if (!directory) return;
        if (this.info.isPublic) {
          this.info.isPublic = false;
          directory.stopHeartbeat();
        } else {
          this.info.isPublic = true;
          directory.startHeartbeat(
            peerId,
            {
              name: `${this.info.hostName}'s Game`,
              playerCount: options?.getPlayerCount?.() ?? 1,
              hostName: this.info.hostName,
            },
            options?.getPlayerCount,
          );
        }
      },
    };

    this.overlay = document.createElement("div");
    this.overlay.style.cssText = `
      position: fixed; bottom: 8px; right: 8px; z-index: 150;
      background: rgba(10, 10, 30, 0.9); border: 1px solid #4fc3f7;
      border-radius: 6px; padding: 8px 12px; font-family: monospace;
      color: #fff; font-size: 12px; display: flex; flex-direction: column;
      gap: 4px; max-width: 360px;
    `;

    const headerRow = document.createElement("div");
    headerRow.style.cssText = "display: flex; justify-content: space-between; align-items: center;";

    const label = document.createElement("div");
    label.style.cssText = "color: #4fc3f7; font-weight: bold;";
    label.textContent = "Hosting P2P Game";

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.style.cssText = `
      font: bold 16px monospace; padding: 0 4px; line-height: 1;
      background: transparent; color: #888; border: none;
      cursor: pointer;
    `;
    closeBtn.addEventListener("click", () => {
      this.overlay.style.display = "none";
    });

    headerRow.append(label, closeBtn);

    const urlEl = document.createElement("div");
    urlEl.style.cssText = "word-break: break-all; color: #aaa; font-size: 11px;";
    urlEl.textContent = joinUrl;

    const btnRow = createHostingButtons(this.info);

    this.overlay.append(headerRow, urlEl, btnRow);
    document.body.appendChild(this.overlay);
  }

  destroy(): void {
    if (this.info.isPublic) this.info.togglePublic();
    this.overlay.remove();
  }
}

/** Create the Copy Link + Go Public button row, reusable in banner and main menu. */
export function createHostingButtons(info: HostingInfo): HTMLDivElement {
  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display: flex; gap: 6px;";

  const copyBtn = document.createElement("button");
  copyBtn.textContent = "Copy Link";
  copyBtn.style.cssText = `
    font: bold 12px monospace; padding: 4px 10px;
    background: rgba(79, 195, 247, 0.2); color: #4fc3f7;
    border: 1px solid #4fc3f7; border-radius: 4px;
    cursor: pointer;
  `;
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(info.joinUrl).then(() => {
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.textContent = "Copy Link";
      }, 2000);
    });
  });
  btnRow.appendChild(copyBtn);

  if (info.directory) {
    const publicBtn = document.createElement("button");
    const updateStyle = () => {
      if (info.isPublic) {
        publicBtn.textContent = "Public ✓";
        publicBtn.style.background = "rgba(100, 255, 100, 0.2)";
        publicBtn.style.color = "#8f8";
        publicBtn.style.borderColor = "#8f8";
      } else {
        publicBtn.textContent = "Go Public";
        publicBtn.style.background = "rgba(255, 255, 255, 0.1)";
        publicBtn.style.color = "#aaa";
        publicBtn.style.borderColor = "#666";
      }
    };
    publicBtn.style.cssText = `
      font: bold 12px monospace; padding: 4px 10px;
      background: rgba(255, 255, 255, 0.1); color: #aaa;
      border: 1px solid #666; border-radius: 4px;
      cursor: pointer;
    `;
    updateStyle();
    publicBtn.addEventListener("click", () => {
      info.togglePublic();
      updateStyle();
    });
    btnRow.appendChild(publicBtn);
  }

  return btnRow;
}
