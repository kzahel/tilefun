import type { AudioManager } from "../audio/AudioManager.js";
import type { IdeaSnapshot } from "./captureIdea.js";
import { flushIdeas, pendingIdeas, queueIdea, uploadIdea } from "./IdeaOutbox.js";
import { IdeaSpeech, recognitionConstructor, speakIdea } from "./IdeaSpeech.js";
import { IDEA_TEXT_LIMIT, type PlayIdeaSubmission } from "./PlayIdea.js";
import "./IdeaDialog.css";

const DRAFT_KEY = "tilefun.idea-draft.v1";
export function ideaToast(message: string) {
  document.querySelector(".idea-toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "idea-toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  document.body.append(toast);
  setTimeout(() => toast.remove(), 6000);
}
export function startIdeaDelivery() {
  let active = true;
  const sync = () => {
    void flushIdeas()
      .then((sent) => {
        if (active && sent) ideaToast("💡 Your saved ideas were sent!");
      })
      .catch(() => {});
  };
  window.addEventListener("online", sync);
  const timer = setInterval(sync, 60_000);
  sync();
  return () => {
    active = false;
    clearInterval(timer);
    window.removeEventListener("online", sync);
  };
}

export class IdeaDialog {
  private dialog = document.createElement("dialog");
  private speech: IdeaSpeech;
  private draft: PlayIdeaSubmission;
  private closed = false;
  private sending = false;
  private pointer: number | null = null;
  private keyHeld = false;
  private mic: HTMLButtonElement;
  private send: HTMLButtonElement;
  private bubble: HTMLButtonElement;
  private text: HTMLTextAreaElement;
  private status: HTMLParagraphElement;
  private language: HTMLSelectElement;
  private again: HTMLButtonElement;
  private storageWarning: HTMLParagraphElement;
  private onBlur = () => {
    this.pointer = null;
    this.keyHeld = false;
    if (this.speech.state !== "idle") this.speech.cancel();
    window.speechSynthesis?.cancel();
  };
  private onFullscreen = () => {
    // Fullscreen promotes its root into the top layer above already-open dialogs.
    // Reopen the same modal so it remains visible and keeps owning input.
    if (this.dialog.open) {
      // First-touch fullscreen can arrive just after release. Keep the final
      // transcript pending while stopping any hold still in progress.
      this.pointer = null;
      this.keyHeld = false;
      this.speech.stop();
      this.dialog.close();
      this.dialog.showModal();
    }
  };
  private onVisibility = () => {
    if (document.hidden) this.onBlur();
  };

  constructor(
    snapshot: IdeaSnapshot,
    private audio: AudioManager,
    private onClose: () => void,
  ) {
    this.draft = {
      ...snapshot,
      id: crypto.randomUUID(),
      text: "",
      language: navigator.language || "en-US",
    };
    let restored = false;
    try {
      const saved = JSON.parse(
        localStorage.getItem(DRAFT_KEY) ?? "null",
      ) as PlayIdeaSubmission | null;
      if (saved?.text && saved.context && typeof saved.screenshot === "string") {
        this.draft = saved;
        restored = true;
      }
    } catch {
      /* Continue with an in-memory draft; persistence reports failures below. */
    }
    const dialog = this.dialog;
    dialog.className = "idea-dialog";
    dialog.setAttribute("aria-labelledby", "idea-title");
    dialog.innerHTML = `
      <h1 id="idea-title">💡 Idea</h1>
      <img class="idea-picture" alt="The game when you opened the menu">
      <button type="button" class="idea-mic" aria-label="Hold to speak">🎤<br>Hold to speak</button>
      <p class="idea-status" role="status" aria-live="polite"></p>
      <button type="button" class="idea-bubble" aria-label="Listen to your idea" hidden></button>
      <div class="idea-actions"><button type="button" class="idea-again">🎤 Try again</button><button type="button" class="idea-send" disabled>📨 Send</button></div>
      <button type="button" class="idea-close">Back to game</button>
      <details><summary>Language & typing</summary><label>Speaking language <select aria-label="Speaking language"></select></label><label>Type your idea<textarea maxlength="${IDEA_TEXT_LIMIT}"></textarea></label></details>
      <p class="idea-pending"></p><button type="button" class="idea-retry" hidden>Retry sending saved ideas</button>
      <p class="idea-storage" role="alert"></p>
      <p class="idea-privacy">Sends these words and a game picture privately to the game's creator. Tilefun doesn't save audio. Your browser's speech service may process your voice online.</p>`;
    const get = <T extends Element>(selector: string): T => {
      const element = dialog.querySelector<T>(selector);
      if (!element) throw new Error(`Missing idea control ${selector}`);
      return element;
    };
    this.mic = get(".idea-mic");
    this.send = get(".idea-send");
    this.bubble = get(".idea-bubble");
    this.text = get("textarea");
    this.status = get(".idea-status");
    this.language = get("select");
    this.again = get(".idea-again");
    this.storageWarning = get(".idea-storage");
    get<HTMLImageElement>(".idea-picture").src = this.draft.screenshot;
    for (const [value, label] of new Map([
      [this.draft.language, this.draft.language],
      ["en-US", "English"],
      ["de-DE", "Deutsch"],
    ])) {
      this.language.add(new Option(label, value));
    }
    this.language.value = this.draft.language;
    this.language.onchange = () => {
      this.draft.language = this.language.value;
      this.persist();
    };
    this.text.value = this.draft.text;
    this.text.oninput = () => {
      this.draft.text = this.text.value;
      this.persist();
      this.render();
    };
    this.speech = new IdeaSpeech(
      (state, message) => {
        if (this.closed) return;
        this.status.textContent = message;
        this.mic.dataset.listening = String(state === "listening");
        this.render();
      },
      (text) => {
        if (this.closed) return;
        if (text.length > IDEA_TEXT_LIMIT) {
          this.status.textContent = "That idea was too long. Please try a shorter one.";
          return;
        }
        this.draft.text = text;
        this.text.value = text;
        this.persist();
        this.render();
        this.bubble.focus();
      },
      () => this.chime(),
    );
    this.mic.onpointerdown = (event) => {
      if (
        event.button !== 0 ||
        this.pointer !== null ||
        this.keyHeld ||
        this.speech.state !== "idle"
      )
        return;
      event.preventDefault();
      this.pointer = event.pointerId;
      this.mic.setPointerCapture(event.pointerId);
      this.begin();
    };
    this.mic.onpointerup = (event) => {
      if (this.pointer !== event.pointerId) return;
      this.pointer = null;
      this.speech.stop();
    };
    this.mic.onpointercancel = this.mic.onlostpointercapture = () => {
      if (this.pointer !== null) {
        this.pointer = null;
        this.speech.cancel();
      }
    };
    this.mic.onblur = () => {
      if (this.keyHeld) {
        this.keyHeld = false;
        this.speech.stop();
      }
    };
    this.mic.oncontextmenu = (event) => event.preventDefault();
    this.mic.onkeydown = (event) => {
      if ((event.key === " " || event.key === "Enter") && !event.repeat && this.pointer === null) {
        event.preventDefault();
        this.keyHeld = true;
        this.begin();
      }
    };
    this.mic.onkeyup = (event) => {
      if ((event.key === " " || event.key === "Enter") && this.keyHeld) {
        event.preventDefault();
        this.keyHeld = false;
        this.speech.stop();
      }
    };
    this.bubble.onclick = () => {
      if (!speakIdea(this.draft.text, this.draft.language))
        this.status.textContent = "Reading aloud isn't available in this browser.";
    };
    get<HTMLButtonElement>(".idea-again").onclick = () => {
      this.speech.cancel("Hold the microphone and tell me your idea again.");
      window.speechSynthesis?.cancel();
      this.draft.text = "";
      this.text.value = "";
      this.persist();
      this.render();
      this.mic.focus();
    };
    this.send.onclick = () => {
      void this.submit();
    };
    get<HTMLButtonElement>(".idea-close").onclick = () => this.onClose();
    dialog.oncancel = (event) => {
      event.preventDefault();
      this.onClose();
    };
    // Native modal blocks pointer input outside; stop keyboard shortcuts at the dialog.
    dialog.addEventListener("keydown", (event) => event.stopPropagation());
    dialog.addEventListener("keyup", (event) => event.stopPropagation());
    dialog.addEventListener("mousedown", (event) => event.stopPropagation());
    const retry = get<HTMLButtonElement>(".idea-retry");
    const refreshPending = async () => {
      try {
        const count = (await pendingIdeas()).length;
        if (this.closed) return;
        get(".idea-pending").textContent = count
          ? `${count} idea(s) saved on this device, waiting to send.`
          : "";
        retry.hidden = count === 0;
      } catch {
        this.storageWarning.textContent =
          "Device storage is unavailable. Keep this page open until your idea sends.";
      }
    };
    retry.onclick = () => {
      retry.disabled = true;
      void flushIdeas()
        .then(() => refreshPending())
        .catch((e: Error) => {
          this.status.textContent = e.message;
        })
        .finally(() => {
          retry.disabled = false;
        });
    };
    void refreshPending();
    const supported = !!recognitionConstructor();
    if (!supported) {
      get<HTMLDetailsElement>("details").open = true;
      this.status.textContent =
        "Speech isn't available here. You can type an idea with a grown-up.";
    } else
      this.status.textContent = restored
        ? "Your unfinished idea is here. Tap it to listen."
        : "Hold the big button. Speak after the chime.";
    document.body.append(dialog);
    dialog.showModal();
    this.render();
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVisibility);
    document.addEventListener("fullscreenchange", this.onFullscreen);
    speakIdea("Hold the microphone button and tell me your idea.", this.draft.language);
  }
  private render() {
    const busy = this.speech?.state !== "idle";
    this.send.disabled = busy || this.sending || !this.draft.text.trim();
    this.bubble.hidden = !this.draft.text;
    this.mic.hidden = !!this.draft.text;
    this.again.hidden = !this.draft.text;
    this.send.hidden = !this.draft.text;
    this.bubble.textContent = `🔊 ${this.draft.text}`;
    this.bubble.disabled = busy || this.sending;
    // Keep the held button enabled until pointerup, including while starting.
    this.mic.disabled =
      !recognitionConstructor() || this.sending || this.speech?.state === "finishing";
    this.text.disabled = busy || this.sending;
    this.language.disabled = busy || this.sending;
    this.again.disabled = busy || this.sending;
  }
  private persist() {
    try {
      if (this.draft.text) localStorage.setItem(DRAFT_KEY, JSON.stringify(this.draft));
      else localStorage.removeItem(DRAFT_KEY);
    } catch {
      this.storageWarning.textContent =
        "Couldn't save this draft on the device. Keep this page open until you send it.";
    }
  }
  private begin() {
    if (this.closed || this.sending || this.speech.state !== "idle") return;
    this.audio.tryResume();
    this.draft.text = "";
    this.text.value = "";
    this.persist();
    this.speech.start(this.draft.language);
  }
  private chime() {
    const ctx = this.audio.ensureContext();
    const oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    oscillator.frequency.value = 720;
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.1);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  private async submit() {
    if (this.send.disabled) return;
    this.sending = true;
    this.render();
    window.speechSynthesis?.cancel();
    try {
      let queued = false;
      try {
        await queueIdea(this.draft);
        queued = true;
      } catch {
        // Storage can be denied or full: a confirmed network send still works.
        // Until acknowledged, retain this draft and keep errors in the dialog.
        try {
          await uploadIdea(this.draft);
        } catch {
          throw new Error("Couldn't save on this device or send. Keep this page open and retry.");
        }
      }
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* Same ID makes a restored draft retry-safe. */
      }
      this.onClose();
      if (!queued) {
        ideaToast("💡 Your idea was sent. Thank you!");
        return;
      }
      ideaToast("💡 Saved on this device. Sending your idea…");
      void flushIdeas()
        .then(async () => {
          if ((await pendingIdeas()).some((idea) => idea.id === this.draft.id)) {
            ideaToast("💡 Saved on this device. Waiting to send.");
            return;
          }
          ideaToast("💡 Your idea was sent. Thank you!");
          if (!document.querySelector(".idea-dialog"))
            speakIdea("Your idea was sent. Thank you!", this.draft.language);
        })
        .catch(() => {
          ideaToast("💡 Saved on this device. We'll retry while the game is open.");
        });
    } catch (error) {
      this.status.textContent =
        error instanceof Error
          ? error.message
          : "Couldn't save. Keep this page open and try again.";
      this.sending = false;
      this.render();
    }
  }
  destroy() {
    this.closed = true;
    this.speech.cancel();
    window.speechSynthesis?.cancel();
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVisibility);
    document.removeEventListener("fullscreenchange", this.onFullscreen);
    this.dialog.close();
    this.dialog.remove();
  }
}
