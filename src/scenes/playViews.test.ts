import { describe, expect, it, vi } from "vitest";
import type { RemoteStateView } from "../client/ClientStateView.js";
import type { GameContext } from "../core/GameScene.js";
import { createPlayer } from "../entities/Player.js";
import { Camera } from "../rendering/Camera.js";
import { DeviceSession } from "../session/DeviceSession.js";
import { followSeat, View } from "../session/View.js";
import type { ClientMessage } from "../shared/protocol.js";
import {
  beginViewTick,
  drawViewOverlays,
  endViewTick,
  followGuestViews,
  GuestFeedback,
  JOIN_HINT,
  presentViews,
  renderSoloFirstPerson,
  restoreViews,
} from "./playViews.js";

const requester = async () => ({}) as never;
const noInput = {
  steering: false,
  held: () => false,
  sample: () => ({}) as never,
  clear: () => {},
  dispose: () => {},
};

/** A recording 2D context: text drawn, in canvas pixels after translation. */
function recordingContext() {
  const texts: { text: string; x: number; y: number }[] = [];
  const clips: number[][] = [];
  let tx = 0;
  let ty = 0;
  const saved: [number, number][] = [];
  const ctx = new Proxy(
    {
      save: () => saved.push([tx, ty]),
      restore: () => {
        [tx, ty] = saved.pop() ?? [0, 0];
      },
      translate: (x: number, y: number) => {
        tx += x;
        ty += y;
      },
      rect: (...rect: number[]) => clips.push(rect),
      fillText: (text: string, x: number, y: number) => texts.push({ text, x: x + tx, y: y + ty }),
      measureText: (text: string) => ({ width: text.length * 8 }),
    } as Record<string, unknown>,
    { get: (target, key) => (key in target ? target[key as string] : () => {}) },
  );
  return { ctx: ctx as unknown as CanvasRenderingContext2D, texts, clips };
}

async function playing() {
  const host = { ...createPlayer(100, 100), id: 1 };
  const guest = { ...createPlayer(400, 100), id: 2 };
  const syncs = new Map<number, { gemsCollected: number; invincibilityTimer: number }>();
  const replica = {
    playerEntity: host,
    presentedPlayerEntity: host,
    cameraPresentation: { time: 0, domain: "remote" as const },
    serverEntities: [host, guest],
    entities: [host, guest],
    playerNames: { 1: "Host", 2: "Guest" },
    gemsCollected: 4,
    serverTick: 10,
    seats: {
      entities: new Map([
        [0, 1],
        [1, 2],
      ]),
      session: (seat: number) => syncs.get(seat),
    },
    setPredictor: vi.fn(),
  };
  const camera = new Camera();
  const view = new View(followSeat(), camera);
  const session = new DeviceSession(replica as unknown as RemoteStateView, { view });
  await session.seats.join(requester, 1, 1, noInput);
  const sent: ClientMessage[] = [];
  const recording = recordingContext();
  const gc = {
    canvas: { width: 1280, height: 800 },
    ctx: recording.ctx,
    camera,
    view,
    session,
    stateView: replica,
    debugPanel: { zoom: 1 },
    transport: { send: (message: ClientMessage) => sent.push(message) },
    gemSpriteCanvas: null,
    firstPerson: { hideView: vi.fn() },
  } as unknown as GameContext;
  return { gc, session, sent, syncs, recording, replica };
}

describe("play's split-screen views (226)", () => {
  it("lays out a view per seat each tick, zoomed from the chosen zoom", async () => {
    const { gc, session } = await playing();
    (gc.debugPanel as { zoom: number }).zoom = 2;
    const views = beginViewTick(gc);
    expect(views.map((v) => [v.seat, v.camera.zoom])).toEqual([
      [0, 2],
      [1, 2],
    ]);
    await session.seats.join(requester, 2, 2, noInput);
    expect(beginViewTick(gc).map((v) => v.camera.zoom)).toEqual([1.5, 1.5, 1.5]);
  });

  it("guests' cameras follow their seat and send its range in their envelope when it changes", async () => {
    const { gc, session, sent, replica } = await playing();
    beginViewTick(gc);
    followGuestViews(gc);
    const guest = session.views[1] as View;
    expect([guest.camera.x, guest.camera.y]).toEqual([400, 100]);
    const range = guest.camera.getVisibleChunkRange();
    expect(sent).toEqual([{ type: "seat", seat: 1, message: { type: "visible-range", ...range } }]);
    followGuestViews(gc);
    expect(sent).toHaveLength(1);
    session.clearPresentation(); // a world change: the range goes again
    followGuestViews(gc);
    expect(sent).toHaveLength(2);
    // After a party trip the guest's view lands on its body in one tick (no sweep
    // across the map) and sends one range.
    session.clearPresentation();
    const guestEntity = replica.serverEntities[1] as { position: { wx: number; wy: number } };
    guestEntity.position = { wx: 9_000, wy: 7_000 };
    followGuestViews(gc);
    expect([guest.camera.x, guest.camera.y]).toEqual([9_000, 7_000]);
    expect(sent).toHaveLength(3);
    followGuestViews(gc);
    expect(sent).toHaveLength(3);
    guestEntity.position = { wx: 400, wy: 100 };
    // A guest not yet streamed (or in no frame) sends no range around the origin.
    session.clearPresentation();
    replica.seats.entities.delete(1);
    followGuestViews(gc);
    expect(sent).toHaveLength(3);
    expect(session.views[0]?.camera.x).toBe(0); // seat 0's camera is the play scene's
  });

  it("a guest's hit shakes its own view and sounds, as its gems do", async () => {
    const { gc, session, syncs } = await playing();
    beginViewTick(gc);
    const feedback = new GuestFeedback();
    const sounds: string[] = [];
    const sound = (kind: string) => sounds.push(kind);
    syncs.set(1, { gemsCollected: 0, invincibilityTimer: 0 });
    feedback.update(gc, sound);
    syncs.set(1, { gemsCollected: 2, invincibilityTimer: 1.5 });
    feedback.update(gc, sound);
    expect(sounds).toEqual(["hit", "gem"]);
    const [host, guest] = session.views as View[];
    endViewTick(gc); // every view's shake steps once per tick
    expect(guest?.camera.shakeOffsetX || guest?.camera.shakeOffsetY).toBeTruthy();
    expect([host?.camera.shakeOffsetX, host?.camera.shakeOffsetY]).toEqual([0, 0]);
    feedback.update(gc, sound); // still invincible: no new hit
    expect(sounds).toHaveLength(2);
    for (let i = 0; i < 200; i++) endViewTick(gc);
    expect([guest?.camera.shakeOffsetX, guest?.camera.shakeOffsetY]).toEqual([0, 0]);
  });

  it("every view saves its pose each tick and is presented, then restored, each frame", async () => {
    const { gc, session, replica } = await playing();
    beginViewTick(gc);
    followGuestViews(gc);
    const guest = session.views[1] as View;
    guest.camera.snapTo(380, 100);
    guest.camera.x = 384; // moved since the last saved pose
    beginViewTick(gc);
    expect([guest.camera.prevX, guest.camera.prevY]).toEqual([384, 100]);
    followGuestViews(gc); // eases toward the guest at (400, 100)
    const ticked = guest.camera.x;
    expect(ticked).toBeGreaterThan(380);
    // Presentation moves toward the presented pose; every view is restored after.
    replica.entities = [
      replica.playerEntity,
      { ...replica.entities[1], position: { wx: 500, wy: 100 } },
    ] as never;
    presentViews(gc, 1);
    expect(guest.camera.x).toBeGreaterThan(ticked);
    const restored = session.views.map((view) => vi.spyOn(view.camera, "restoreActual"));
    restoreViews(gc);
    for (const spy of restored) expect(spy).toHaveBeenCalledOnce();
  });

  it("each view marks its partners, not itself, inside its own region, with a seat badge", async () => {
    const { gc, recording, syncs } = await playing();
    syncs.set(1, { gemsCollected: 7, invincibilityTimer: 0 });
    beginViewTick(gc);
    gc.camera.snapTo(100, 100);
    followGuestViews(gc);
    drawViewOverlays(gc, 1);
    const names = recording.texts.map((t) => t.text);
    expect(names.filter((n) => n === "Host")).toHaveLength(1); // in the guest's view
    expect(names.filter((n) => n === "Guest")).toHaveLength(1); // in seat 0's view
    expect(recording.texts.find((t) => t.text === "Guest")?.x).toBeLessThan(640);
    const hostMarker = recording.texts.find((t) => t.text === "Host");
    expect(hostMarker?.x).toBeGreaterThanOrEqual(640); // drawn in the guest's (right) region
    expect(recording.clips).toEqual([
      [0, 0, 640, 800],
      [640, 0, 640, 800],
    ]);
    expect(names).toEqual(expect.arrayContaining(["Player 1", "Player 2"]));
    // Each badge counts its own seat's gems.
    expect(recording.texts.filter((t) => t.text === "4").map((t) => t.x < 640)).toEqual([true]);
    expect(recording.texts.filter((t) => t.text === "7").map((t) => t.x >= 640)).toEqual([true]);
    expect(names).not.toContain(JOIN_HINT);
  });

  it("three players leave the grid's fourth corner showing how to join", async () => {
    const { gc, session, recording } = await playing();
    await session.seats.join(requester, 2, 2, noInput);
    beginViewTick(gc);
    drawViewOverlays(gc, 1);
    const hint = recording.texts.find((t) => t.text === JOIN_HINT);
    expect([hint?.x, hint?.y]).toEqual([960, 600]);
  });

  it("first person only while one seat plays", async () => {
    const { gc } = await playing();
    beginViewTick(gc);
    expect(renderSoloFirstPerson(gc, 1)).toBe(false);
    expect(gc.firstPerson?.hideView).toHaveBeenCalled();
  });
});
