/**
 * Physical key identity and its label on the player's own layout. Gameplay binds
 * `KeyboardEvent.code` (the key's position, e.g. "KeyW"), so WASD stays a cluster
 * on Dvorak, Colemak, AZERTY and others, and Shift cannot turn "w" into a "W" that
 * never releases. Hints show what that physical key types on the current layout.
 */

const NAMED: Record<string, string> = {
  Space: "Space",
  ShiftLeft: "Shift",
  ShiftRight: "Shift",
  Escape: "Escape",
  Tab: "Tab",
  Enter: "Enter",
  Backquote: "`",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

/** Punctuation keys (the right-hand scheme's among them) on a US layout, used until
 * the layout map or a press says what they type here. */
const PUNCTUATION: Record<string, string> = {
  Quote: "'",
  Semicolon: ";",
  Slash: "/",
  Period: ".",
  Comma: ",",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Minus: "-",
  Equal: "=",
};

/** Codes whose label follows the player's layout. */
const LAYOUT_CODE =
  /^(Key[A-Z]|Digit[0-9]|Quote|Semicolon|Slash|Period|Comma|Bracket(Left|Right)|Backslash|Minus|Equal)$/;

/** Unshifted characters per code: from the browser's layout map (authoritative), or
 * learned from plain presses where that API is unavailable. */
const layoutLabels = new Map<string, string>();
const learnedLabels = new Map<string, string>();

/**
 * The physical key for an event. Virtual keyboards and some IMEs send an empty or
 * "Unidentified" code; fall back to the US position of the typed character.
 */
export function eventCode(event: Pick<KeyboardEvent, "code" | "key">): string {
  if (event.code && event.code !== "Unidentified") return event.code;
  return codeForKey(event.key);
}

/** US-layout code for a typed key value ("e" → "KeyE", " " → "Space", "3" → "Digit3"). */
export function codeForKey(key: string): string {
  if (key === " ") return "Space";
  if (key === "Shift") return "ShiftLeft";
  if (key === "`") return "Backquote";
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
  if (/^[0-9]$/.test(key)) return `Digit${key}`;
  return key;
}

/**
 * The US-layout key value at an event's physical position ("KeyW" → "w"), for lab
 * code that names keys by character but must follow positions like the game.
 */
export function usKey(event: Pick<KeyboardEvent, "code" | "key">): string {
  const code = eventCode(event);
  const letter = /^Key([A-Z])$/.exec(code)?.[1];
  if (letter) return letter.toLowerCase();
  const digit = /^Digit([0-9])$/.exec(code)?.[1];
  if (digit) return digit;
  if (code === "Space") return " ";
  if (code === "ShiftLeft" || code === "ShiftRight") return "Shift";
  return event.key;
}

/** Label for a physical key, using the player's layout when it is known. */
export function keyLabel(code: string): string {
  const named = NAMED[code];
  if (named) return named;
  const known = layoutLabels.get(code) ?? learnedLabels.get(code);
  if (known) return known;
  const letter = /^Key([A-Z])$/.exec(code)?.[1];
  if (letter) return letter;
  const punctuation = PUNCTUATION[code];
  if (punctuation) return punctuation;
  return /^Digit([0-9])$/.exec(code)?.[1] ?? code;
}

/** Remember what a physical key typed unmodified, for browsers without a layout map.
 * Shifted or AltGr characters (Shift+W typing "<" on Dvorak) are not the key's label. */
export function learnKeyLabel(
  event: Pick<KeyboardEvent, "code" | "key" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey"> & {
    getModifierState?(key: string): boolean;
  },
): void {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.getModifierState?.("AltGraph")) return;
  if (!LAYOUT_CODE.test(event.code)) return;
  if (event.key.length !== 1 || event.key === " ") return;
  learnedLabels.set(event.code, event.key.toUpperCase());
}

interface KeyboardLayoutApi {
  getLayoutMap?: () => Promise<ReadonlyMap<string, string>>;
}

/** Chromium's Keyboard Map API answers every key before it is pressed. */
export async function loadLayoutLabels(
  keyboard: KeyboardLayoutApi | undefined = (
    globalThis.navigator as (Navigator & { keyboard?: KeyboardLayoutApi }) | undefined
  )?.keyboard,
): Promise<void> {
  try {
    const map = await keyboard?.getLayoutMap?.();
    for (const [code, key] of map ?? [])
      if (LAYOUT_CODE.test(code) && key.length === 1) layoutLabels.set(code, key.toUpperCase());
  } catch {
    // Unsupported or blocked (e.g. a cross-origin frame): observed keys still teach labels.
  }
}

/** Test seam: forget learned labels. */
export function resetLayoutLabels(): void {
  layoutLabels.clear();
  learnedLabels.clear();
}
