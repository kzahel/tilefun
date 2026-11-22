import type { AudioManager } from "../audio/AudioManager.js";
import { WeatherAudio } from "../audio/WeatherAudio.js";
import { actionHint } from "../input/InputHints.js";
import { Phone } from "../ui/Phone.js";
import type { RemoteStateView } from "./ClientStateView.js";

/** The world's sky on this device outside its views: the phone and the weather's sound. */
export class ClientSky {
  readonly phone = new Phone();
  private audio: WeatherAudio | null = null;

  /** Read each tick: the client makes them after its chrome. */
  constructor(
    private readonly host: {
      readonly stateView: RemoteStateView;
      readonly audioManager: AudioManager;
    },
  ) {}

  /** Once per client tick. */
  update(): void {
    const state = this.host.stateView;
    const clock = state.sky.now;
    this.phone.present(clock, actionHint("toggle_phone"));
    const output = document.hidden ? null : this.host.audioManager.output;
    if (!output) {
      this.audio?.stop();
      return;
    }
    if (!this.audio || this.audio.output !== output)
      this.audio = new WeatherAudio(output.context, output);
    this.audio.update(clock, !!state.interior);
  }

  destroy(): void {
    this.audio?.stop();
    this.phone.destroy();
  }
}
