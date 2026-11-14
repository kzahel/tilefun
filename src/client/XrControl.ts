import { xrPad } from "../input/XrPad.js";
import {
  clampPitch,
  type FirstPersonLook,
  NORTH_YAW,
} from "../rendering/firstperson/FirstPersonCamera.js";
import type { HeadsetFrame } from "../rendering/firstperson/FirstPersonCameras.js";
import type { ImmersiveOutput, ScreenPlacement, View3dXr } from "../rendering/View3dHost.js";
import type { View } from "../session/View.js";
import type { ViewEye } from "../session/ViewEye.js";
import {
  followAnchor,
  headFromMatrix,
  rigThrough,
  roomToWorld,
  scaleTable,
  snapTurn,
  TABLE_DEAD_ZONE,
  type XrHead,
} from "../xr/XrRig.js";

/** How a headset shows play: a flat screen of the page's canvas, the player's
 * own eyes, or the world as a miniature on a table. */
export type XrMode = "screen" | "eye" | "tabletop";
const XR_MODES: readonly XrMode[] = ["eye", "tabletop", "screen"];
export const XR_MODE_LABELS: Readonly<Record<XrMode, string>> = {
  eye: "first person",
  tabletop: "tabletop",
  screen: "screen",
};

export const XR_FRAME_RATE = 72;
/** First person: world pixels a metre. A child's standing eye (about 1.1 m) is
 * then the player's (about 20 world pixels up). */
export const EYE_PIXELS_PER_METRE = 18;
/** First person on foot: the share of full stick speed, which reads as a run at
 * this scale. */
export const XR_WALK = 0.6;
/** The head may stray this far from where it was calibrated before the body's
 * place under it follows. Metres. */
const STRAY = 0.6;
const STRAY_RATE = 3;

/** Tabletop: half the width of the square table the miniature stands on. Metres. */
const TABLE_HALF = 0.5;
/** A table is never set lower than this above the floor. Metres. */
const TABLE_FLOOR = 0.3;
const TABLE_PIXELS_PER_METRE = 600;
/** Collection beyond the table's edge: bodies straddling it. World pixels. */
const TABLE_MARGIN = 48;
/** Rig height follows the body's with this rate, so a jump does not move the room. */
const HEIGHT_RATE = 8;

const SCREEN: ScreenPlacement = { below: 0.1, distance: 2.2, width: 2.6 };
/** A session that never reaches play ends after this long. */
const START_GRACE_MS = 4000;
/** Frame intervals kept for pacing reports. */
const PACING_FRAMES = 1200;

/** What the control needs of the client. */
export interface XrClient {
  /** The render host's headset outputs; undefined without a GPU host. */
  readonly output: View3dXr | undefined;
  readonly loop: { start(): void; stop(): void; externalTick(nowMs: number): void };
  /** Immersive modes hold seat 0 in the 3D scene for the session, whatever the
   * seat chose; a tabletop sets how far its view reaches. */
  readonly firstPerson: {
    hold(heading: number): void;
    unhold(): void;
    reach: number | undefined;
  };
  /** Free what the client set up for the control (listeners). */
  dispose?(): void;
  readonly controller: {
    /** The session's controllers as a pad, while it presents. */
    headset: (() => Gamepad | undefined) | null;
    /** Read every pad now: the page's own poll has no frames in a session. */
    poll(now: number): unknown;
  };
  /** Play is on top with no menu over it: all a session can show. */
  playing(): boolean;
  /** The heading seat 0's player faces, for a session's first look. */
  heading(): number | undefined;
  /** A session ended: lay the page out again. */
  restored(): void;
}

/** What a headset frame of play shows; see `firstPersonPlay`. */
export interface XrSeen {
  readonly eye: ViewEye;
  readonly cull: { left: number; right: number; top: number; bottom: number };
  readonly drawRadius: number;
  readonly headset: HeadsetFrame;
}

export interface XrPacing {
  frames: number;
  /** Milliseconds between headset frames. */
  interval: { p50: number; p95: number; p99: number; max: number };
  /** Milliseconds of the page's work in a headset frame: ticks and drawing. */
  work: { p50: number; p95: number; max: number };
  /** Frames that arrived more than one and a half intervals after the last. */
  missed: number;
}

/**
 * Play in a headset (tactical 252). One immersive WebXR session at a time, in
 * one of three modes. The session's frames drive the game loop while it lasts,
 * because the page has none then; its controllers are seat 0's pad.
 *
 * Menus are HTML and a session cannot show them: when anything but play is on
 * top the session ends, and `resume` remembers the mode for the way back.
 */
export class XrControl {
  /** Whether this browser offers immersive sessions; set by `detect()`. */
  supported = false;
  /** Whether it can also show a flat panel (WebXR layers), which the headset
   * screen is. */
  private panels = false;
  private handheld = false;
  /** The mode a pause ended; play's next user gesture may enter it again. */
  resume: XrMode | null = null;
  /**
   * Where a tabletop is set when a session starts: its middle this far below
   * the head and this far in front of it, the way the head faces. Metres.
   */
  readonly table = { drop: 0.5, distance: 0.6 };
  /**
   * The display rate a session asks its headset for, when the headset offers
   * it; 0 keeps the headset's own. A Quest 3's own 90 Hz misses 1–3% of first
   * person's frames in the city; 72 Hz holds them all (252).
   */
  frameRate = XR_FRAME_RATE;
  /** Counters for captures and device runs. */
  readonly stats = { frames: 0, posed: 0, inputs: 0, ended: 0 };
  private session: XRSession | null = null;
  private current: XrMode | null = null;
  private output: ImmersiveOutput | null = null;
  private starting = false;
  private played = false;
  private startedAt = 0;
  private disposed = false;
  /** This headset frame has a head pose, and some frame of the session drew. */
  private posed = false;
  private drew = false;
  private head: XrHead = { x: 0, y: 1.2, z: 0, yaw: 0, pitch: 0 };
  /** The room point that sits at the player's eye (the head's resting place) or,
   * for a tabletop, at the miniature's middle. Set from the session's first pose. */
  private placed: { x: number; y: number; z: number } | null = null;
  private straying = false;
  /** The heading the room's forward looks along: snap turns change it. */
  private yaw = 0;
  private readonly snap = { armed: true };
  private height: number | undefined;
  private readonly anchor = { x: 0, y: 0, z: 0 };
  private anchored = false;
  private readonly glide = { gliding: false };
  private tableScale = TABLE_PIXELS_PER_METRE;
  private lastFrame = 0;
  /** The last headset frame's length. */
  private frameSeconds = 1 / 72;
  private readonly intervals: number[] = [];
  private readonly work: number[] = [];

  constructor(private readonly client: XrClient) {}

  /** Ask the browser once; menus offer a headset only after this says so. */
  async detect(): Promise<boolean> {
    const xr = typeof navigator === "undefined" ? undefined : navigator.xr;
    if (!xr || !this.client.output) return false;
    this.supported = await xr.isSessionSupported("immersive-vr").catch(() => false);
    this.panels =
      typeof XRWebGLBinding !== "undefined" && "createQuadLayer" in XRWebGLBinding.prototype;
    // Standalone headsets' browsers do not call themselves Android or mobile.
    this.handheld = /Android|iPhone|iPad|Mobile/.test(navigator.userAgent ?? "");
    return this.supported;
  }

  /**
   * The modes menus offer. A phone's browser can report immersive sessions too
   * (a cardboard viewer); a children's menu does not list those. The console's
   * `xr` command still starts one anywhere the browser allows it.
   */
  get modes(): readonly XrMode[] {
    if (!this.supported || this.handheld) return [];
    return this.panels ? XR_MODES : XR_MODES.filter((mode) => mode !== "screen");
  }

  /** The presenting mode. */
  get mode(): XrMode | null {
    return this.session ? this.current : null;
  }

  /** A session is presenting the 3D scene through the head pose. */
  get immersive(): boolean {
    return !!this.output;
  }

  /** First person in the headset: on foot the player walks, not runs. */
  get walking(): boolean {
    return this.immersive && this.current === "eye";
  }

  /**
   * Start a session; call from a user gesture (a click or a key press), or the
   * browser refuses. Resolves true once the session presents.
   */
  async enter(mode: XrMode): Promise<boolean> {
    const { client } = this;
    const xr = typeof navigator === "undefined" ? undefined : navigator.xr;
    if (this.session || this.starting || !xr || !client.output) return false;
    this.starting = true;
    this.resume = null;
    let session: XRSession | undefined;
    try {
      session = await xr.requestSession(
        "immersive-vr",
        mode === "screen"
          ? { requiredFeatures: ["layers"], optionalFeatures: ["local-floor"] }
          : { optionalFeatures: ["local-floor", "layers"] },
      );
      const live = session;
      this.session = live;
      this.current = mode;
      this.played = this.drew = this.posed = false;
      this.startedAt = performance.now();
      this.lastFrame = 0;
      this.intervals.length = this.work.length = 0;
      Object.assign(this.stats, { frames: 0, posed: 0, inputs: 0 });
      live.addEventListener("end", this.onEnd, { once: true });
      // Not awaited: a headset may settle the change only once it is worn.
      const rate = this.frameRate;
      if (rate && live.supportedFrameRates?.includes(rate))
        void live.updateTargetFrameRate(rate).catch(() => {});
      // The page has no frames of its own in a session: this one's drive the loop.
      client.loop.stop();
      client.controller.headset = () => xrPad(live.inputSources, performance.now());
      if (mode === "screen") await client.output.screen(live, this.onFrame, SCREEN);
      else {
        this.placed = null;
        this.height = undefined;
        this.anchored = false;
        this.snap.armed = true;
        // First person starts looking the way the player faces; a tabletop
        // starts with north away from the player, like the top-down view.
        this.yaw = (mode === "eye" ? client.heading() : undefined) ?? NORTH_YAW;
        // Movement follows the look and the body leaves its own view, as in
        // first person on the page.
        client.firstPerson.hold(this.yaw);
        this.output = await client.output.immersive(live, this.onFrame);
        this.output.space.addEventListener?.("reset", () => this.recentre());
      }
      return true;
    } catch (error) {
      console.warn("[tilefun] Headset session unavailable", error);
      if (session && this.session === session) await session.end().catch(() => this.onEnd());
      return false;
    } finally {
      this.starting = false;
    }
  }

  /**
   * After a gesture, when a pause ended the session: enter again if play is
   * back on top and the gesture is one a session accepts (a click on Resume).
   */
  resumeInPlay(): void {
    const mode = this.resume;
    if (!mode || this.session || this.starting || !this.client.playing()) return;
    // Play is back: this is the one chance. A menu closed without a gesture (a
    // pad, Escape) stays on the page, and no later click starts a session.
    this.resume = null;
    if (navigator.userActivation?.isActive) void this.enter(mode);
  }

  /** The client is going away: end any session and leave its page alone. */
  dispose(): void {
    this.disposed = true;
    this.resume = null;
    this.client.dispose?.();
    this.exit();
  }

  /** End the session; the page's loop takes over again. */
  exit(): void {
    void this.session?.end().catch(() => {});
  }

  private readonly onEnd = (): void => {
    const { client } = this;
    if (!this.session) return;
    const immersive = this.current !== "screen";
    this.session = null;
    this.output = null;
    this.stats.ended++;
    client.controller.headset = null;
    if (immersive) {
      client.firstPerson.reach = undefined;
      client.firstPerson.unhold();
    }
    // A destroyed client has no page to go back to.
    if (this.disposed) return;
    client.restored();
    client.loop.start();
  };

  private readonly onFrame = (time: number, frame: XRFrame): void => {
    try {
      this.present(time, frame);
    } catch (error) {
      // A frame that throws would leave the headset on a frozen picture with
      // the page's loop stopped: go back to the page, where the fault shows.
      this.exit();
      throw error;
    }
  };

  private present(time: number, frame: XRFrame): void {
    const { client } = this;
    const session = this.session;
    if (!session) return;
    const began = performance.now();
    if (this.lastFrame) {
      this.keep(this.intervals, time - this.lastFrame);
      this.frameSeconds = Math.min(0.1, (time - this.lastFrame) / 1000);
    }
    this.lastFrame = time;
    this.stats.frames++;
    this.stats.inputs = session.inputSources.length;
    this.posed = false;
    if (this.output) {
      const pose = frame.getViewerPose(this.output.space);
      this.posed = !!pose;
      if (pose) {
        this.head = headFromMatrix(pose.transform.matrix);
        this.stats.posed++;
        if (!this.placed) this.place();
      }
    }
    client.controller.poll(time);
    client.loop.externalTick(time);
    this.keep(this.work, performance.now() - began);
    // Anything over play is HTML on the page: leave the headset to show it.
    const playing = client.playing();
    const late = began - this.startedAt > START_GRACE_MS;
    if (playing) this.played = true;
    else if (this.played || late) {
      if (this.played) this.resume = this.current;
      this.exit();
    }
    // Nothing reached the eyes (the 3D scene failed to load, graphics are lost):
    // the page can say so, a black headset cannot.
    if (this.output && !this.drew && late) this.exit();
  }

  /**
   * Take the head's place again from its next pose, keeping the way the player
   * faces: the eye returns under the head, a tabletop returns in front of it.
   * The headset's own recentre does this, because it moves the room's origin.
   */
  recentre(): void {
    if (!this.placed) return;
    this.yaw += this.head.yaw;
    this.placed = null;
  }

  private keep(list: number[], value: number): void {
    if (list.length >= PACING_FRAMES) list.shift();
    list.push(value);
  }

  /** Frame pacing since the session began or `resetPacing()`. */
  pacing(): XrPacing {
    const sorted = (list: number[]) => [...list].sort((a, b) => a - b);
    const at = (list: number[], share: number) =>
      list[Math.min(list.length - 1, Math.floor(list.length * share))] ?? 0;
    const intervals = sorted(this.intervals),
      work = sorted(this.work);
    const p50 = at(intervals, 0.5);
    return {
      frames: this.intervals.length,
      interval: {
        p50,
        p95: at(intervals, 0.95),
        p99: at(intervals, 0.99),
        max: intervals[intervals.length - 1] ?? 0,
      },
      work: { p50: at(work, 0.5), p95: at(work, 0.95), max: work[work.length - 1] ?? 0 },
      missed: this.intervals.filter((gap) => gap > p50 * 1.5).length,
    };
  }

  /** Draw this headset frame of the 3D scene; false while it cannot be drawn. */
  draw(draw: Parameters<ImmersiveOutput["draw"]>[0]): boolean {
    // Without a pose the eyes' cameras and textures are the last frame's.
    if (!this.posed || !this.output?.draw(draw)) return false;
    this.drew = true;
    return true;
  }

  resetPacing(): void {
    this.intervals.length = this.work.length = 0;
  }

  /**
   * Per fixed tick while immersive, in place of the page's look stick: the
   * right stick snap-turns (and scales a tabletop), and the seat's look becomes
   * the head's heading, which movement and aim follow.
   */
  tick(look: FirstPersonLook, dt: number, stick: { dx: number; dy: number }): void {
    this.yaw += snapTurn(this.snap, stick.dx);
    if (this.current === "tabletop") {
      this.tableScale = scaleTable(this.tableScale, stick.dy, dt);
      // Streamed around the player, who may stand off the table's middle by its
      // dead zone: reach the far corners from there.
      this.client.firstPerson.reach = this.tableHalf() * (Math.SQRT2 + TABLE_DEAD_ZONE);
    }
    look.yaw = this.yaw + this.head.yaw;
    look.pitch = clampPitch(this.head.pitch);
  }

  private tableHalf(): number {
    return TABLE_HALF * this.tableScale;
  }

  /**
   * The session's first pose places the room: wherever the headset's own origin
   * and forward are, the player starts by looking along the session's heading.
   * First person takes the head's place as the player's eye, seated or
   * standing; a tabletop is set in front of the head and below it.
   */
  private place(): void {
    const { head, table } = this;
    this.yaw -= head.yaw;
    this.straying = false;
    this.placed =
      this.current === "tabletop"
        ? {
            x: head.x + Math.sin(head.yaw) * table.distance,
            // Kept off the floor where the room has one. A room measured from
            // the head's start has the head near zero: the table goes below it.
            y:
              head.y > TABLE_FLOOR * 2
                ? Math.max(TABLE_FLOOR, head.y - table.drop)
                : head.y - table.drop,
            z: head.z - Math.cos(head.yaw) * table.distance,
          }
        : { x: head.x, y: head.y, z: head.z };
  }

  /**
   * What this headset frame shows. `eyeOf` is the view's camera policy: the
   * player's eye for a look, or a chase camera when they drive. `focusOf` gives
   * the body the view frames. `reach` is first person's view distance. Call once per
   * headset frame: the room's easing advances by the frame's time.
   */
  seen(
    view: Pick<View, "seat">,
    eyeOf: (look: FirstPersonLook) => ViewEye | undefined,
    focusOf: () => { x: number; y: number; z: number } | undefined,
    reach: number,
  ): XrSeen | undefined {
    if (!this.output || view.seat !== 0) return undefined;
    const { head } = this;
    const dt = this.frameSeconds;
    const heading = this.yaw + head.yaw;
    if (this.current === "tabletop") {
      const focus = focusOf();
      if (!focus) return undefined;
      if (this.anchored) followAnchor(this.anchor, focus, this.tableHalf(), dt, this.glide);
      else Object.assign(this.anchor, focus);
      this.anchored = true;
      const { anchor } = this;
      const rig = rigThrough(anchor, this.placed ?? head, this.yaw, this.tableScale);
      const half = this.tableHalf();
      const at = roomToWorld(rig, head);
      return {
        eye: { ...at, yaw: heading, pitch: head.pitch, own: undefined },
        cull: {
          left: anchor.x - half - TABLE_MARGIN,
          right: anchor.x + half + TABLE_MARGIN,
          top: anchor.y - half - TABLE_MARGIN,
          bottom: anchor.y + half + TABLE_MARGIN,
        },
        drawRadius: half * Math.SQRT2,
        headset: { rig, table: { x: anchor.x, y: anchor.y, half } },
      };
    }
    // A chase camera sits behind the vehicle along the room's heading, never the
    // head's: turning the head must not swing the room.
    const eye = eyeOf({ yaw: this.yaw, pitch: 0 });
    if (!eye) return undefined;
    this.follow(dt);
    const point = this.placed ?? head;
    // Height eases, so a jump or a kerb does not move the room under the player.
    this.height =
      this.height === undefined || Math.abs(eye.z - this.height) > 64
        ? eye.z
        : this.height + (eye.z - this.height) * (1 - Math.exp(-HEIGHT_RATE * dt));
    const rig = rigThrough(
      { x: eye.x, y: eye.y, z: this.height },
      point,
      this.yaw,
      EYE_PIXELS_PER_METRE,
    );
    const at = roomToWorld(rig, head);
    return {
      eye: { ...at, yaw: heading, pitch: head.pitch, own: eye.own },
      cull: { left: at.x - reach, right: at.x + reach, top: at.y - reach, bottom: at.y + reach },
      drawRadius: reach,
      headset: { rig },
    };
  }

  /** The eye's place in the room follows a head that walks away from it. */
  private follow(dt: number): void {
    const { head, placed: point } = this;
    if (!point) return;
    const away = Math.hypot(head.x - point.x, head.z - point.z);
    if (away > STRAY) this.straying = true;
    if (!this.straying) return;
    const step = 1 - Math.exp(-STRAY_RATE * dt);
    point.x += (head.x - point.x) * step;
    point.z += (head.z - point.z) * step;
    if (Math.hypot(head.x - point.x, head.z - point.z) < 0.1) this.straying = false;
  }
}
