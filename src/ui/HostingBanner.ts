/**
 * Small fixed-position overlay showing the P2P join URL when hosting.
 * Displayed in the bottom-right corner with a copy button.
 */
export class HostingBanner {
  private overlay: HTMLDivElement;

  constructor(peerId: string) {
    const url = new URL(window.location.href);
    // Clean up other mode params, set join
    url.searchParams.delete("host");
    url.searchParams.delete("multiplayer");
    url.searchParams.delete("server");
    url.searchParams.set("join", peerId);
    const joinUrl = url.toString();

    this.overlay = document.createElement("div");
    this.overlay.style.cssText = `
      position: fixed; bottom: 8px; right: 8px; z-index: 150;
      background: rgba(10, 10, 30, 0.9); border: 1px solid #4fc3f7;
      border-radius: 6px; padding: 8px 12px; font-family: monospace;
      color: #fff; font-size: 12px; display: flex; flex-direction: column;
      gap: 4px; max-width: 360px;
    `;

    const label = document.createElement("div");
    label.style.cssText = "color: #4fc3f7; font-weight: bold;";
    label.textContent = "Hosting P2P Game";

    const urlEl = document.createElement("div");
    urlEl.style.cssText = "word-break: break-all; color: #aaa; font-size: 11px;";
    urlEl.textContent = joinUrl;

    const copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy Link";
    copyBtn.style.cssText = `
      font: bold 12px monospace; padding: 4px 10px;
      background: rgba(79, 195, 247, 0.2); color: #4fc3f7;
      border: 1px solid #4fc3f7; border-radius: 4px;
      cursor: pointer; align-self: flex-start;
    `;
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(joinUrl).then(() => {
        copyBtn.textContent = "Copied!";
        setTimeout(() => {
          copyBtn.textContent = "Copy Link";
        }, 2000);
      });
    });

    this.overlay.append(label, urlEl, copyBtn);
    document.body.appendChild(this.overlay);
  }

  destroy(): void {
    this.overlay.remove();
  }
}
