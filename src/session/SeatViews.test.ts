import { describe, expect, it, vi } from "vitest";
import type { RemoteStateView } from "../client/ClientStateView.js";
import type { Entity } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { Camera } from "../rendering/Camera.js";
import { DeviceSession } from "./DeviceSession.js";
import { seatBody, seatEntity } from "./SeatFocus.js";
import { SPLIT_ZOOM, seatLayout } from "./SeatViews.js";
import { followSeat, View } from "./View.js";

const requester = async () => ({}) as never;

function device(entities: Entity[] = []) {
  const player = { ...createPlayer(100, 100), id: 1 };
  const replica = {
    playerEntity: player,
    presentedPlayerEntity: player,
    cameraPresentation: { time: 0, domain: "remote" as const },
    serverEntities: [player, ...entities],
    entities: [player, ...entities],
    seats: { entities: new Map<number, number>([[0, 1]]) },
    setPredictor: vi.fn(),
  };
  const camera = new Camera();
  camera.pixelSnap = true;
  const host = new View(followSeat({ verticalFollow: () => true }), camera);
  const session = new DeviceSession(replica as unknown as RemoteStateView, { view: host });
  return { session, host, replica };
}

async function join(session: DeviceSession, seat: number) {
  await session.seats.join(requester, seat, seat, {
    steering: false,
    held: () => false,
    sample: () => ({}) as never,
    clear: () => {},
    dispose: () => {},
  });
}

describe("one view per seat (226)", () => {
  it("lays out 1, 2 side by side and 2×2 for 3–4 seats, zoomed out to 0.75", async () => {
    const { session, host } = device();
    expect(session.views).toEqual([host]);
    expect(session.layoutViews(1280, 800, true)).toEqual([host]);
    expect(host.region).toEqual({ x: 0, y: 0, width: 1280, height: 800 });
    await join(session, 1);
    const two = session.layoutViews(1280, 800, true);
    expect(two.map((v) => [v.seat, v.region.x, v.region.width, v.zoomScale])).toEqual([
      [0, 0, 640, 1],
      [1, 640, 640, 1],
    ]);
    expect(session.views).toEqual(two);
    const guest = two[1] as View;
    expect(guest.camera.pixelSnap).toBe(true);
    expect([guest.camera.viewportWidth, guest.camera.viewportHeight]).toEqual([640, 800]);
    await join(session, 3);
    const three = session.layoutViews(1280, 800, true);
    expect(three.map((v) => [v.seat, v.region.x, v.region.y, v.zoomScale])).toEqual([
      [0, 0, 0, SPLIT_ZOOM],
      [1, 640, 0, SPLIT_ZOOM],
      [3, 0, 400, SPLIT_ZOOM],
    ]);
    expect(three[1]).toBe(guest); // a guest keeps its view (and camera) while it plays
    expect([seatLayout(1), seatLayout(2), seatLayout(3), seatLayout(4)]).toEqual([
      "1",
      "2",
      "4",
      "4",
    ]);
  });

  it("a new guest view starts where seat 0 looks, then snaps to its seat", async () => {
    const { session, host } = device();
    host.camera.snapTo(700, 500);
    await join(session, 1);
    const [, guest] = session.layoutViews(1280, 800, true) as View[];
    expect([guest?.camera.x, guest?.camera.y]).toEqual([700, 500]);
  });

  it("keeps regions while nothing changes, and drops a view with its seat", async () => {
    const { session } = device();
    await join(session, 1);
    const [, guest] = session.layoutViews(1280, 800, true);
    const region = guest?.region;
    const setRegion = vi.spyOn(guest as View, "setRegion");
    session.layoutViews(1280, 800, true);
    expect(setRegion).not.toHaveBeenCalled();
    expect(guest?.region).toBe(region);
    session.seats.drop(1);
    expect(session.layoutViews(1280, 800, true).map((v) => v.seat)).toEqual([0]);
    await join(session, 1);
    expect(session.layoutViews(1280, 800, true)[1]).not.toBe(guest);
  });

  it("outside play seat 0 is shown alone on the whole canvas; guests start afresh", async () => {
    const { session, host } = device();
    await join(session, 1);
    const [, guest] = session.layoutViews(1280, 800, true);
    expect(session.layoutViews(1280, 800, false)).toEqual([host]);
    expect(host.region).toEqual({ x: 0, y: 0, width: 1280, height: 800 });
    expect(host.zoomScale).toBe(1);
    expect(session.layoutViews(1280, 800, true)[1]).not.toBe(guest);
  });

  it("labs without seat views keep their own views and regions", () => {
    const replica = { setPredictor: vi.fn() } as unknown as RemoteStateView;
    const session = new DeviceSession(replica);
    const view = new View(followSeat());
    view.setRegion({ x: 0, y: 0, width: 960, height: 640 });
    session.views.push(view);
    expect(session.layoutViews(100, 100, true)).toEqual([view]);
    expect(view.region.width).toBe(960);
  });
});

describe("a guest's view follows its seat (226)", () => {
  it("follows the body the guest controls: predicted, its vehicle when driving", async () => {
    const guest = { ...createPlayer(500, 300), id: 7 };
    const car = { ...createPlayer(900, 300), id: 8 };
    const { session, replica, host } = device([guest, car]);
    replica.seats.entities.set(1, 7);
    await join(session, 1);
    const [, view] = session.layoutViews(1280, 800, true) as View[];
    if (!view) throw new Error("no guest view");
    view.policy.tick(view.camera, session); // a new camera snaps to its subject
    expect([view.camera.x, view.camera.y]).toEqual([500, 300]);
    expect(seatEntity(session, 1)).toBe(guest);
    expect(seatEntity(session, 0)).toBe(replica.playerEntity);
    // The predictor's published pose leads the replica's.
    const predicted = { ...guest, position: { wx: 520, wy: 300 } };
    const prediction = {
      publishedBody: (id: number) => ({ tick: 1, body: id === 7 ? predicted : undefined }),
    };
    const predicting = { replica: session.replica, prediction } as unknown as DeviceSession;
    expect(seatBody(predicting, 1)).toBe(predicted);
    // Driving: the guest's parent.
    guest.parentId = 8;
    expect(seatBody(session, 1)).toBe(car);
    view.camera.requestSnap();
    view.policy.tick(view.camera, session);
    expect([view.camera.x, view.camera.y]).toEqual([900, 300]);
    // Vertical follow carries over from seat 0's policy, on ticks and presentation.
    car.wz = 40;
    view.camera.requestSnap();
    view.policy.tick(view.camera, session);
    expect(view.camera.y).toBe(260);
    view.camera.savePrev();
    view.policy.present(view.camera, session, 1);
    expect(view.camera.y).toBeLessThan(300);
    view.camera.restoreActual();
    car.wz = 0;
    // Ticks follow the predicted pose; presentation the presented one (the replica's
    // entities inside its presentation).
    const ahead = { ...car, position: { wx: 960, wy: 300 } };
    const shown = { ...car, position: { wx: 930, wy: 300 } };
    const presenting = {
      replica: {
        ...session.replica,
        serverEntities: replica.serverEntities,
        seats: replica.seats,
        entities: [guest, shown],
      },
      prediction: {
        publishedBody: (id: number) => ({ tick: 1, body: id === 8 ? ahead : undefined }),
      },
    } as unknown as DeviceSession;
    view.camera.requestSnap();
    view.policy.tick(view.camera, presenting);
    expect(view.camera.x).toBe(960);
    view.camera.snapTo(930, 300);
    view.camera.savePrev();
    view.policy.present(view.camera, presenting, 1);
    expect(view.camera.x).toBe(930);
    view.camera.restoreActual();
    // Another seat's framing from a guest's policy frames that seat.
    const other = view.policy.forSeat?.(0);
    view.camera.requestSnap();
    other?.tick(view.camera, session);
    expect([view.camera.x, view.camera.y]).toEqual([100, 100]); // seat 0, not the car
    // A seat in no frame (another realm, or not yet streamed) keeps its camera.
    replica.seats.entities.delete(1);
    expect([seatBody(session, 1), seatEntity(session, 1)]).toEqual([undefined, undefined]);
    view.camera.snapTo(1, 2);
    view.policy.tick(view.camera, session);
    view.policy.present(view.camera, session, 0.5);
    expect([view.camera.x, view.camera.y]).toEqual([1, 2]);
    view.camera.restoreActual();
    expect(host.seat).toBe(0);
  });
});
