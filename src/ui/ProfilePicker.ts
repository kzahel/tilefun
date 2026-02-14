import type { PlayerProfile } from "../persistence/PlayerProfileStore.js";

const OVERLAY_STYLE = `
  position: fixed; inset: 0; z-index: 250;
  background: rgba(10, 10, 30, 0.95);
  display: flex; flex-direction: column; align-items: center;
  justify-content: center;
  padding: 32px 16px; overflow-y: auto;
  font-family: monospace; color: #fff;
`;

const TITLE_STYLE = `
  font-size: 28px; font-weight: bold; letter-spacing: 4px;
  margin-bottom: 8px; color: #8cf;
`;

const SUBTITLE_STYLE = `
  font-size: 14px; color: #888; margin-bottom: 24px;
`;

const CARD_STYLE = `
  width: 180px; padding: 20px 16px;
  background: rgba(255,255,255,0.08); border: 1px solid #555;
  border-radius: 8px; cursor: pointer; user-select: none;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  transition: background 0.15s;
`;

const AVATAR_STYLE = `
  width: 64px; height: 64px; border-radius: 50%;
  background: rgba(255,255,255,0.15); border: 2px solid #666;
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; color: #aaa;
`;

const BTN_STYLE = `
  font: bold 14px monospace; padding: 8px 16px;
  background: rgba(255,255,255,0.12); color: #fff;
  border: 1px solid #888; border-radius: 4px;
  cursor: pointer; user-select: none;
`;

const INPUT_STYLE = `
  font: 14px monospace; padding: 8px;
  background: rgba(255,255,255,0.1); color: #fff;
  border: 1px solid #888; border-radius: 4px; outline: none;
  text-align: center; width: 160px;
`;

const AVATAR_ICONS = [
  "\u{1F9D1}",
  "\u{1F47E}",
  "\u{1F431}",
  "\u{1F43B}",
  "\u{1F985}",
  "\u{1F422}",
  "\u{1F41D}",
  "\u{1F984}",
];

function avatarForProfile(index: number): string {
  return AVATAR_ICONS[index % AVATAR_ICONS.length] ?? "\u{1F9D1}";
}

export class ProfilePicker {
  private overlay: HTMLDivElement;

  onSelect: ((profile: PlayerProfile) => void) | null = null;
  onCreate: ((name: string) => void) | null = null;

  constructor() {
    this.overlay = document.createElement("div");
    this.overlay.style.cssText = OVERLAY_STYLE;
    this.overlay.style.display = "none";

    // Prevent game keyboard shortcuts while picker is open
    this.overlay.addEventListener("keydown", (e) => e.stopPropagation());
    this.overlay.addEventListener("keyup", (e) => e.stopPropagation());

    document.body.appendChild(this.overlay);
  }

  get visible(): boolean {
    return this.overlay.style.display !== "none";
  }

  show(profiles: PlayerProfile[]): void {
    this.overlay.style.display = "";
    this.overlay.innerHTML = "";

    const title = document.createElement("div");
    title.style.cssText = TITLE_STYLE;
    title.textContent = "Who's playing?";
    this.overlay.appendChild(title);

    const subtitle = document.createElement("div");
    subtitle.style.cssText = SUBTITLE_STYLE;
    subtitle.textContent = "Choose your player profile";
    this.overlay.appendChild(subtitle);

    const grid = document.createElement("div");
    grid.style.cssText =
      "display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; margin-bottom: 24px;";

    for (const [i, profile] of profiles.entries()) {
      grid.appendChild(this.createProfileCard(profile, i));
    }

    // "New Player" card
    grid.appendChild(this.createNewPlayerCard(profiles.length));

    this.overlay.appendChild(grid);
  }

  hide(): void {
    this.overlay.style.display = "none";
  }

  private createProfileCard(profile: PlayerProfile, index: number): HTMLDivElement {
    const card = document.createElement("div");
    card.style.cssText = CARD_STYLE;
    card.addEventListener("mouseenter", () => {
      card.style.background = "rgba(255,255,255,0.15)";
    });
    card.addEventListener("mouseleave", () => {
      card.style.background = "rgba(255,255,255,0.08)";
    });

    const avatar = document.createElement("div");
    avatar.style.cssText = AVATAR_STYLE;
    avatar.textContent = avatarForProfile(index);

    const name = document.createElement("div");
    name.style.cssText =
      "font-weight: bold; font-size: 15px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px;";
    name.textContent = profile.name;

    card.append(avatar, name);

    if (profile.pin) {
      const lock = document.createElement("div");
      lock.style.cssText = "font-size: 11px; color: #888;";
      lock.textContent = "\u{1F512} PIN protected";
      card.appendChild(lock);
    }

    card.addEventListener("click", () => {
      if (profile.pin) {
        this.showPinPrompt(profile);
      } else {
        this.onSelect?.(profile);
      }
    });

    return card;
  }

  private createNewPlayerCard(profileCount: number): HTMLDivElement {
    const card = document.createElement("div");
    card.style.cssText = CARD_STYLE;
    card.style.borderStyle = "dashed";
    card.addEventListener("mouseenter", () => {
      card.style.background = "rgba(255,255,255,0.15)";
    });
    card.addEventListener("mouseleave", () => {
      card.style.background = "rgba(255,255,255,0.08)";
    });

    const avatar = document.createElement("div");
    avatar.style.cssText = AVATAR_STYLE;
    avatar.style.borderStyle = "dashed";
    avatar.textContent = "+";
    avatar.style.fontSize = "32px";
    avatar.style.color = "#666";

    const label = document.createElement("div");
    label.style.cssText = "font-size: 14px; color: #888;";
    label.textContent = "New Player";

    card.append(avatar, label);

    card.addEventListener("click", () => {
      this.showCreatePrompt(profileCount);
    });

    return card;
  }

  private showPinPrompt(profile: PlayerProfile): void {
    this.overlay.innerHTML = "";

    const title = document.createElement("div");
    title.style.cssText = TITLE_STYLE;
    title.textContent = profile.name;
    this.overlay.appendChild(title);

    const subtitle = document.createElement("div");
    subtitle.style.cssText = SUBTITLE_STYLE;
    subtitle.textContent = "Enter your PIN to continue";
    this.overlay.appendChild(subtitle);

    const pinInput = document.createElement("input");
    pinInput.type = "password";
    pinInput.maxLength = 4;
    pinInput.placeholder = "____";
    pinInput.style.cssText = `${INPUT_STYLE} font-size: 24px; letter-spacing: 8px; width: 120px;`;

    const error = document.createElement("div");
    error.style.cssText = "color: #f66; font-size: 12px; margin-top: 8px; min-height: 16px;";

    const tryPin = () => {
      if (pinInput.value === profile.pin) {
        this.onSelect?.(profile);
      } else {
        error.textContent = "Wrong PIN";
        pinInput.value = "";
        pinInput.focus();
      }
    };

    pinInput.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") tryPin();
    });
    pinInput.addEventListener("keyup", (e) => e.stopPropagation());

    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display: flex; gap: 8px; margin-top: 16px;";

    const backBtn = document.createElement("button");
    backBtn.textContent = "Back";
    backBtn.style.cssText = BTN_STYLE;
    backBtn.addEventListener("click", () => {
      // Re-show profile list — caller must call show() again
      // For simplicity, just emit a null select to signal "go back"
      this.onSelect?.(null as unknown as PlayerProfile);
    });

    const okBtn = document.createElement("button");
    okBtn.textContent = "OK";
    okBtn.style.cssText = `${BTN_STYLE} background: rgba(100,200,255,0.2);`;
    okBtn.addEventListener("click", tryPin);

    btnRow.append(backBtn, okBtn);
    this.overlay.append(pinInput, error, btnRow);

    pinInput.focus();
  }

  private showCreatePrompt(profileCount: number): void {
    this.overlay.innerHTML = "";

    const title = document.createElement("div");
    title.style.cssText = TITLE_STYLE;
    title.textContent = "New Player";
    this.overlay.appendChild(title);

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Enter your name...";
    nameInput.value = `Player ${profileCount + 1}`;
    nameInput.style.cssText = INPUT_STYLE;

    const doCreate = () => {
      const name = nameInput.value.trim() || `Player ${profileCount + 1}`;
      this.onCreate?.(name);
    };

    nameInput.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") doCreate();
    });
    nameInput.addEventListener("keyup", (e) => e.stopPropagation());

    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display: flex; gap: 8px; margin-top: 16px;";

    const backBtn = document.createElement("button");
    backBtn.textContent = "Back";
    backBtn.style.cssText = BTN_STYLE;
    backBtn.addEventListener("click", () => {
      this.onSelect?.(null as unknown as PlayerProfile);
    });

    const createBtn = document.createElement("button");
    createBtn.textContent = "Create";
    createBtn.style.cssText = `${BTN_STYLE} background: rgba(100,200,255,0.2);`;
    createBtn.addEventListener("click", doCreate);

    btnRow.append(backBtn, createBtn);
    this.overlay.append(nameInput, btnRow);

    nameInput.focus();
    nameInput.select();
  }
}
