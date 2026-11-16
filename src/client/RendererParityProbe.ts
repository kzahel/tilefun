import { VIEW_BACKDROP_CSS } from "../config/constants.js";
import type { Prop } from "../entities/Prop.js";
import { collectWorldSprites } from "../rendering/collectScene.js";
import { NORTH_YAW } from "../rendering/firstperson/FirstPersonCamera.js";
import { propForm } from "../rendering/firstperson/FirstPersonProps.js";
import type { SceneLayers } from "../rendering/firstperson/FirstPersonView.js";
import { grown, obliqueGround } from "../rendering/firstperson/ObliqueCamera.js";
import { collectCameraGrass } from "../rendering/GrassBladeRenderer.js";
import {
  type CategoryParity,
  compareCategory,
  compareFrames,
  differencePicture,
  type FrameParity,
} from "../rendering/RendererParity.js";
import { SceneFrame } from "../rendering/SceneFrame.js";
import type { SceneItem, SpriteItem } from "../rendering/SceneItem.js";
import { drawViewScene, drawViewTerrain, renderViews } from "../session/ViewRender.js";
import type { GameTestHooks } from "./GameTestHooks.js";

export interface ParityOptions {
  /** Include PNG data URLs of both renderers' whole pictures and their difference. */
  pictures?: boolean;
}

export interface ParityReport {
  width: number;
  height: number;
  /** Screen pixels per world pixel. */
  scale: number;
  /** Whole pictures. `ground` is terrain alone; `together` is every kind of
   * content without grass or shadows; `played` is what each renderer shows in play. */
  frames: Record<"ground" | "together" | "played", FrameParity>;
  /** One kind of content at a time, over the ground. */
  categories: Record<
    "grass" | "solids" | "cards" | "actors" | "vehicles" | "shadows",
    CategoryParity
  >;
  /** How much each renderer was asked to draw. */
  content: { props: number; solids: number; cards: number; entities: number; chunks: number };
  pictures?: { fixed: string; scene: string; difference: string };
}

const NO_LAYERS: SceneLayers = {
  ground: true,
  solids: false,
  cards: false,
  actors: false,
  vehicles: false,
  grass: false,
};
/** Every kind of content but grass, which `together` and `shadowed` leave out. */
const ALL_LAYERS: SceneLayers = {
  ...NO_LAYERS,
  solids: true,
  cards: true,
  actors: true,
  vehicles: true,
};
/** What play draws. */
const PLAYED_LAYERS: SceneLayers = { ...ALL_LAYERS, grass: true };

/** What the fixed view is asked to draw for one picture. */
interface FixedContent {
  props?: readonly Prop[];
  entities?: boolean;
  /** Keep only mesh bodies (true) or only sprites (false) among the entities. */
  bodies?: boolean;
  grass?: boolean;
  shadows?: boolean;
}

/**
 * Renderer parity probe (tactical 251): draws the current moment of play through
 * the fixed view and through the 3D scene's top-down camera, one kind of content
 * at a time, and reports where the pictures differ. Everything is drawn in one
 * task, so no simulation step falls between two pictures.
 *
 * Needs outdoor play with `?view=topdown3d` (or `r_topdown3d`) already on screen
 * and settled. The next display frame redraws the canvas as usual.
 */
export function probeRendererParity(
  game: GameTestHooks,
  options: ParityOptions = {},
): ParityReport {
  const host = game.renderHost;
  const view = game.device.views.find((candidate) => candidate.seat === 0);
  const control = game.firstPerson;
  const scene = view && !view.look ? control.scene(view) : undefined;
  const { view3d } = host;
  const capture = host.captureFrame?.bind(host);
  if (!view || !scene || !view3d || !capture || !view.topDown3d)
    throw Error("The parity probe needs seat 0's top-down view drawn in the 3D scene");
  if (game.stateView.interior) throw Error("The parity probe compares outdoor views");
  const { stateView } = game;
  const { camera, region } = view;
  const { width, height } = region;
  const time = game.time.presentationSeconds;
  const player = stateView.playerEntity;
  // Whole screen pixels: the fixed view composes its picture at the camera's
  // fraction of a pixel, which is filtering, not placement.
  const actual = { x: camera.x, y: camera.y };
  const snap = (centre: number, size: number) =>
    (size / 2 - Math.round(size / 2 - centre * camera.scale)) / camera.scale;
  camera.x = snap(camera.x, width);
  camera.y = snap(camera.y, height);

  const read = (): Uint8ClampedArray => {
    const context = capture().getContext("2d");
    if (!context) throw Error("Parity readback unavailable");
    return context.getImageData(region.x, region.y, width, height).data;
  };

  // Mesh poses build up over frames (wheel travel, eased headings), so the fixed
  // view draws entities from the 3D views' own frame: both renderers then pose
  // every vehicle alike. Pictures without entities use a frame of their own;
  // collecting nothing into play's frame would forget its poses.
  const scratch = new SceneFrame();
  // A body is a mesh that is ready to draw, as the 3D scene decides it; a mesh
  // still loading draws its sprite in both renderers. Tow and bed groups go
  // with the item that carries them.
  const ready = (game.renderer as { meshes?: { ready: ReadonlySet<string> } }).meshes?.ready;
  const isBody = (item: SpriteItem) => !!item.mesh && (ready?.has(item.mesh.assetId) ?? true);

  const drawFixed = (content: FixedContent): Uint8ClampedArray => {
    host.beginFrame();
    const collected = (items: SceneItem[]) => {
      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (item?.kind !== "sprite") continue;
        if (content.bodies !== undefined && isBody(item) !== content.bodies) items.splice(i, 1);
        else if (!content.shadows) items[i] = withoutShadow(item);
      }
    };
    renderViews(
      {
        renderer: game.renderer,
        beginView: (viewCamera, viewRegion) => host.beginView(viewCamera, viewRegion),
        endView: () => host.endView(),
      },
      [view],
      { world: stateView.world, pacing: game.debugPanel.terrainPacing },
      () => {
        drawViewTerrain(game.renderer, camera, stateView.world, {
          background: VIEW_BACKDROP_CSS,
          pacing: game.debugPanel.terrainPacing,
          prepared: true,
        });
        drawViewScene(
          game.renderer,
          camera,
          content.entities ? control.frame : scratch,
          // Not the view's own slab fades: a picture without props would reset
          // them. Every slab draws at full opacity (the 3D scene has no cutaways).
          new Map(),
          {
            world: stateView.world,
            props: content.props ?? [],
            entities: content.entities ? stateView.entities : [],
            collectObserver: player,
            surfaceObserver: player,
          },
          {
            alpha: 1,
            particles: [],
            grass: !!content.grass && game.renderer.assets.has("grass-blades"),
            visibility: "auto",
            presentationTime: time,
            fadeSeconds: time,
            collected,
          },
        );
      },
    );
    return read();
  };

  const ground = obliqueGround({ x: camera.x, y: camera.y, scale: camera.scale }, width, height);
  const drawScene = (layers: SceneLayers, shadows: boolean): void => {
    host.beginFrame();
    Object.assign(scene.layers, layers);
    const frame = control.frame;
    frame.presentationTime = time;
    // As play collects them: the fixed view's blades for this camera. Bodies push
    // blades aside, so a picture without bodies has none pushed, as in `drawFixed`.
    const pushing = layers.actors || layers.vehicles ? stateView.entities : [];
    const grass =
      layers.grass && game.renderer.assets.has("grass-blades")
        ? collectCameraGrass(stateView.world, pushing, camera, time, frame.grass)
        : undefined;
    const items = frame.begin(!!grass?.length);
    try {
      collectWorldSprites({
        entities: stateView.entities,
        props: stateView.props,
        world: stateView.world,
        alpha: 1,
        cull: grown(ground, 96, 384),
        items,
        frame,
        depthShadows: shadows,
      });
      const drawn = view3d.draw(region, (target) =>
        scene.render(
          {
            eye: { x: camera.x, y: camera.y, z: 0, yaw: NORTH_YAW, pitch: 0 },
            world: stateView.world,
            realm: game.mainMenu.currentWorldId ?? null,
            props: stateView.props,
            sprites: items.filter((item): item is SpriteItem => item.kind === "sprite"),
            drawRadius: Math.hypot(width, height) / (2 * camera.scale),
            shadows,
            topDown: { scale: camera.scale },
            // As the player has it: `r_pixelcars3d` can turn vehicle images off.
            pixelBodies: control.pixelBodies,
            grass,
          },
          target,
        ),
      );
      if (!drawn) throw Error("The 3D scene could not draw (graphics lost?)");
    } finally {
      frame.release();
    }
  };
  const readScene = (layers: SceneLayers, shadows: boolean): Uint8ClampedArray => {
    drawScene(layers, shadows);
    return read();
  };

  try {
    // The snapped camera can bring a chunk into the scene's reach: build it first.
    // Ground pages upload a few per frame; chunks beyond the prepared ground
    // never get one, so wait for the count to stop rising.
    // Under the atlas's page age (120 frames), so the fixed view's pages stay.
    for (let i = 0, pages = -1, steady = 0; i < 100 && steady < 4; i++) {
      drawScene(ALL_LAYERS, false);
      steady = !scene.stats.builds && scene.stats.groundPages === pages ? steady + 1 : 0;
      pages = scene.stats.groundPages;
    }
    const solids: Prop[] = [],
      cards: Prop[] = [];
    for (const prop of stateView.props) (propForm(prop) === "solid" ? solids : cards).push(prop);
    const all = stateView.props;

    const fixed = {
      ground: drawFixed({}),
      grass: drawFixed({ grass: true }),
      solids: drawFixed({ props: solids }),
      cards: drawFixed({ props: cards }),
      actors: drawFixed({ entities: true, bodies: false }),
      vehicles: drawFixed({ entities: true, bodies: true }),
      together: drawFixed({ props: all, entities: true }),
      shadowed: drawFixed({ props: all, entities: true, shadows: true }),
      played: drawFixed({ props: all, entities: true, shadows: true, grass: true }),
    };
    const one = (layer: keyof SceneLayers) => readScene({ ...NO_LAYERS, [layer]: true }, false);
    const drawn = {
      ground: readScene(NO_LAYERS, false),
      grass: one("grass"),
      solids: one("solids"),
      cards: one("cards"),
      actors: one("actors"),
      vehicles: one("vehicles"),
      together: readScene(ALL_LAYERS, false),
      shadowed: readScene(ALL_LAYERS, true),
      // As the player has it: `r_fpshadows` can turn the 3D scene's shadows off.
      played: readScene(PLAYED_LAYERS, control.shadows),
    };
    const category = (name: "grass" | "solids" | "cards" | "actors" | "vehicles") =>
      compareCategory(
        { with: fixed[name], ground: fixed.ground },
        { with: drawn[name], ground: drawn.ground },
        width,
      );
    const report: ParityReport = {
      width,
      height,
      scale: camera.scale,
      frames: {
        ground: compareFrames(fixed.ground, drawn.ground, width),
        together: compareFrames(fixed.together, drawn.together, width),
        played: compareFrames(fixed.played, drawn.played, width),
      },
      categories: {
        grass: category("grass"),
        solids: category("solids"),
        cards: category("cards"),
        actors: category("actors"),
        vehicles: category("vehicles"),
        shadows: compareCategory(
          { with: fixed.shadowed, ground: fixed.together },
          { with: drawn.shadowed, ground: drawn.together },
          width,
        ),
      },
      content: {
        props: all.length,
        solids: solids.length,
        cards: cards.length,
        entities: stateView.entities.length,
        chunks: scene.stats.chunks,
      },
    };
    if (options.pictures) {
      const picture = (pixels: Uint8ClampedArray) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.putImageData(new ImageData(pixels.slice(), width, height), 0, 0);
        return canvas.toDataURL("image/png");
      };
      report.pictures = {
        fixed: picture(fixed.played),
        scene: picture(drawn.played),
        difference: picture(differencePicture(fixed.played, drawn.played)),
      };
    }
    return report;
  } finally {
    Object.assign(scene.layers, PLAYED_LAYERS);
    scratch.clear();
    camera.x = actual.x;
    camera.y = actual.y;
  }
}

/** A copy of a collected sprite that draws no shadow of any kind, nor do the
 * towed body and bed contents it carries. */
function withoutShadow(item: SpriteItem): SpriteItem {
  const { gpuShadow: _shadow, ...plain } = item;
  const copy: SpriteItem = { ...plain, hasShadow: false, meshGroundShadow: false };
  if (item.towGroup) copy.towGroup = withoutShadow(item.towGroup);
  if (item.bedGroup)
    copy.bedGroup = { ...item.bedGroup, contents: item.bedGroup.contents.map(withoutShadow) };
  return copy;
}
