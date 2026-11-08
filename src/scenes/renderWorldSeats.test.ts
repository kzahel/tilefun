import { describe, expect, it, vi } from "vitest";
import type { GameContext } from "../core/GameScene.js";
import { createPlayer } from "../entities/Player.js";
import { followSeat, View } from "../session/View.js";

const drawn = vi.hoisted(() => ({ scenes: [] as unknown[], rooms: [] as unknown[] }));
vi.mock("../session/ViewRender.js", async (actual) => ({
  ...(await actual<typeof import("../session/ViewRender.js")>()),
  drawViewScene: (
    _renderer: unknown,
    camera: unknown,
    _frame: unknown,
    fades: unknown,
    scene: unknown,
  ) => drawn.scenes.push({ camera, fades, scene }),
}));
vi.mock("./renderInterior.js", () => ({
  renderInterior: (_gc: unknown, _alpha: number, _particles: unknown, camera: unknown) =>
    drawn.rooms.push(camera),
}));

const { renderEntities } = await import("./renderWorld.js");

describe("each view draws for its own seat (226)", () => {
  const host = { ...createPlayer(0, 0), id: 1 };
  const guest = { ...createPlayer(300, 0), id: 2 };
  const stateView = {
    playerEntity: host,
    entities: [host, guest],
    props: [],
    world: {},
    interior: null as unknown,
    seats: {
      entities: new Map([
        [0, 1],
        [1, 2],
      ]),
    },
  };
  const hostView = new View(followSeat());
  const guestView = new View(followSeat({ seat: 1 }), undefined, 1);
  const gc = {
    view: hostView,
    camera: hostView.camera,
    stateView,
    session: { replica: stateView, views: [hostView, guestView] },
    spriteCatalog: new Map([["player", {}]]),
    sceneFrame: {},
    renderer: {},
  } as unknown as GameContext;

  it("cutaways follow the view's seat, with the view's camera and fades", () => {
    drawn.scenes.length = 0;
    renderEntities(gc, 1, [], hostView);
    renderEntities(gc, 1, [], guestView);
    expect(drawn.scenes).toEqual([
      {
        camera: hostView.camera,
        fades: hostView.fades,
        scene: expect.objectContaining({ collectObserver: host, surfaceObserver: host }),
      },
      {
        camera: guestView.camera,
        fades: guestView.fades,
        scene: expect.objectContaining({ collectObserver: guest, surfaceObserver: guest }),
      },
    ]);
  });

  it("rooms draw once per view, each with its own camera", () => {
    stateView.interior = { parentWorldId: "w", featureId: "f" };
    renderEntities(gc, 1, [], hostView);
    renderEntities(gc, 1, [], guestView);
    expect(drawn.rooms).toEqual([hostView.camera, guestView.camera]);
    stateView.interior = null;
  });
});
