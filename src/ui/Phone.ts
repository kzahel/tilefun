import type { SkyClockView } from "../sky/Sky.js";
import { type PhoneIcon, type PhoneScreen, phoneScreen } from "./phoneScreen.js";
import "./Phone.css";

const SVG = (body: string) =>
  `<svg viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges">${body}</svg>`;
const CLOUD = (fill: string) =>
  `<path fill="${fill}" d="M4 6h1V5h1V4h4v1h1v1h2v1h1v3h-1v1H3v-1H2V8h1V7h1z"/>`;
const DROPS = '<path fill="#8fd0ff" d="M4 12h1v2H4zM8 12h1v2H8zM12 12h1v2h-1z"/>';
/** Pixel icons: they do not depend on the device's emoji font. */
const ICONS: Record<PhoneIcon, string> = {
  sun: SVG(
    '<path fill="#ffd94a" d="M5 5h6v6H5z"/><path fill="#ffb52e" d="M7 1h2v2H7zM7 13h2v2H7zM1 7h2v2H1zM13 7h2v2h-2zM3 3h1v1H3zM12 3h1v1h-1zM3 12h1v1H3zM12 12h1v1h-1z"/>',
  ),
  moon: SVG(
    '<path fill="#f4f0c8" d="M6 2h4v1h1v1h1v2H9V5H8v5h1v1h3v1h-1v1h-1v1H6v-1H5v-1H4V4h1V3h1z"/><path fill="#fff" d="M13 3h1v1h-1zM2 13h1v1H2z"/>',
  ),
  cloud: SVG(CLOUD("#eef3f7")),
  rain: SVG(`${CLOUD("#b9c6d3")}${DROPS}`),
  storm: SVG(`${CLOUD("#8d98a8")}<path fill="#ffe14a" d="M8 10h3v2H9v1h1v1H8v1H7v-2h1v-1H7z"/>`),
};
const HANDSET = SVG(
  '<path fill="currentColor" d="M4 1h8v14H4z"/><path fill="#7fd1ff" d="M5 3h6v9H5z"/><path fill="#243a32" d="M7 13h2v1H7z"/>',
);

/**
 * The player's phone: the world's clock, the weather now and the forecast. It
 * shows on the play screen without taking input, so play goes on under it.
 */
export class Phone {
  readonly button = document.createElement("button");
  private readonly element = document.createElement("div");
  private readonly screen = document.createElement("div");
  private readonly time = document.createElement("div");
  private readonly day = document.createElement("div");
  private readonly weather = document.createElement("div");
  private readonly later = document.createElement("ul");
  private readonly hint = document.createElement("span");
  /** What the screen last showed. */
  private shown = "";

  constructor() {
    this.button.type = "button";
    this.button.className = "phone-button";
    this.button.dataset.testid = "phone-button";
    this.button.setAttribute("aria-label", "Phone: time and weather");
    this.button.setAttribute("aria-pressed", "false");
    this.button.innerHTML = HANDSET;
    this.button.append(this.hint);
    this.button.onclick = () => {
      this.toggle();
      // Keys go on to the game, not to a focused button.
      this.button.blur();
    };
    this.element.className = "phone";
    this.element.dataset.testid = "phone";
    this.element.setAttribute("role", "status");
    this.element.setAttribute("aria-label", "Phone");
    this.element.hidden = true;
    this.screen.className = "phone-screen";
    const now = document.createElement("div");
    now.className = "phone-now";
    this.time.className = "phone-time";
    this.time.dataset.testid = "phone-time";
    this.day.className = "phone-day";
    this.weather.className = "phone-weather";
    this.weather.dataset.testid = "phone-weather";
    this.later.className = "phone-later";
    this.later.setAttribute("aria-label", "Forecast");
    now.append(this.time, this.day, this.weather);
    this.screen.append(now, this.later);
    this.element.append(this.screen);
    document.body.append(this.button, this.element);
  }

  get open(): boolean {
    return !this.element.hidden;
  }

  toggle(): void {
    this.element.hidden = !this.element.hidden;
    this.button.setAttribute("aria-pressed", String(this.open));
  }

  /** Keep the screen and the button's key or pad hint current. */
  present(clock: SkyClockView | undefined, hint: string): void {
    if (this.hint.textContent !== hint) this.hint.textContent = hint;
    if (!this.open) return;
    const screen = clock ? phoneScreen(clock) : NO_SIGNAL;
    const key = JSON.stringify(screen);
    if (key === this.shown) return;
    this.shown = key;
    this.screen.dataset.sky = screen.sky;
    this.time.textContent = screen.time;
    this.day.textContent = screen.day;
    this.weather.innerHTML = `${ICONS[screen.now.icon]}<span></span>`;
    (this.weather.lastElementChild as HTMLElement).textContent = screen.now.label;
    this.later.replaceChildren(
      ...screen.later.flatMap((entry) => {
        const row = document.createElement("li");
        row.innerHTML = `<span class="phone-when"></span>${ICONS[entry.icon]}<span></span>`;
        (row.firstElementChild as HTMLElement).textContent = entry.when;
        (row.lastElementChild as HTMLElement).textContent = entry.label;
        if (!entry.tomorrow) return [row];
        const heading = document.createElement("li");
        heading.className = "phone-tomorrow";
        heading.textContent = "Tomorrow";
        return [heading, row];
      }),
    );
  }

  destroy(): void {
    this.button.remove();
    this.element.remove();
  }
}

/** A realm without a sky (a lab's world) has nothing to tell. */
const NO_SIGNAL: PhoneScreen = {
  time: "--:--",
  day: "No signal",
  sky: "night",
  now: { icon: "cloud", label: "No forecast" },
  later: [],
};
