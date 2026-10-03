interface SpeechResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<SpeechResult> }) => void) | null;
  onaudiostart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionConstructor = new () => Recognition;
const speechWindow = window as unknown as {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};
export const recognitionConstructor = () =>
  speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
export function speakIdea(text: string, language: string) {
  if (!("speechSynthesis" in window)) return false;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;
  utterance.rate = 0.9;
  speechSynthesis.speak(utterance);
  return true;
}
export type SpeechState = "idle" | "starting" | "listening" | "finishing";
export class IdeaSpeech {
  state: SpeechState = "idle";
  private recognition: Recognition | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private change: (state: SpeechState, message: string) => void,
    private result: (text: string) => void,
    private ready: () => void,
  ) {}
  private set(state: SpeechState, message: string) {
    this.state = state;
    this.change(state, message);
  }
  start(language: string) {
    if (this.state !== "idle") return;
    const Constructor = recognitionConstructor();
    if (!Constructor) return;
    window.speechSynthesis?.cancel();
    const recognition = new Constructor();
    this.recognition = recognition;
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    let finalText = "";
    recognition.onaudiostart = () => {
      // A provider may finish opening the microphone after a release/cancel
      // during its permission prompt. Close that late capture as well.
      if (this.recognition !== recognition) {
        recognition.abort();
        return;
      }
      if (this.state === "finishing") {
        recognition.stop();
        return;
      }
      if (this.state !== "starting") return;
      this.set("listening", "Listening… let go when you're done.");
      this.ready();
    };
    recognition.onresult = (event) => {
      if (this.recognition !== recognition) return;
      finalText = Array.from(event.results)
        .filter((r) => r.isFinal)
        .map((r) => r[0].transcript)
        .join(" ")
        .trim();
    };
    recognition.onerror = (event) => {
      if (this.recognition !== recognition) return;
      const message =
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Microphone or speech access was denied. Ask a grown-up, or type your idea."
          : "I couldn't hear your idea. Please try again, or type it.";
      this.cancel(message);
    };
    recognition.onend = () => {
      if (this.recognition !== recognition) return;
      clearTimeout(this.timer);
      this.recognition = undefined;
      this.set(
        "idle",
        finalText
          ? "Tap the speech bubble to hear your idea."
          : "I didn't catch any words. Hold and try again.",
      );
      if (finalText) this.result(finalText);
    };
    this.set("starting", "Getting ready… wait for the chime.");
    try {
      // Let recognition request permission in the record gesture itself. A
      // separate getUserMedia stream would have an independent mic lifetime.
      recognition.start();
      this.timer = setTimeout(() => this.stop(), 60_000);
    } catch {
      this.cancel("Speech couldn't start. Please try again, or type your idea.");
    }
  }
  stop() {
    if (!this.recognition || this.state === "finishing") return;
    if (this.state === "starting") {
      this.cancel("Hold until you hear the chime, then speak.");
      return;
    }
    this.set("finishing", "Finishing your words…");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.cancel("Speech took too long. Please try again."), 6000);
    try {
      // stop() ends microphone capture now, while allowing already captured
      // audio to produce its final transcript during the finishing state.
      this.recognition.stop();
    } catch {
      this.cancel("Please hold and try again.");
    }
  }
  cancel(message = "Recording stopped. Hold to try again.") {
    const recognition = this.recognition;
    this.recognition = undefined;
    clearTimeout(this.timer);
    recognition?.abort();
    this.set("idle", message);
  }
}
