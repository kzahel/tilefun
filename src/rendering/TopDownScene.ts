import type { Spritesheet } from "../assets/Spritesheet.js";
import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import type { Camera } from "./Camera.js";
import { collectWorldSprites } from "./collectScene.js";
import { NORTH_YAW } from "./firstperson/FirstPersonCamera.js";
import type { FirstPersonInterior } from "./firstperson/FirstPersonInterior.js";
import { FirstPersonView, type FirstPersonWorld } from "./firstperson/FirstPersonView.js";
import { grown, obliqueGround } from "./firstperson/ObliqueCamera.js";
import { SceneFrame } from "./SceneFrame.js";
import type { SpriteItem } from "./SceneItem.js";
import type { View3dHost } from "./View3dHost.js";
import type { RenderRegion } from "./ViewLayout.js";

/** Non-simulating previews use the same scene and actor collector as play. */
export class TopDownScene {
  private readonly scene: FirstPersonView;
  private readonly frame = new SceneFrame();
  constructor(sheets: ReadonlyMap<string, Spritesheet>) {
    this.scene = new FirstPersonView(sheets);
  }
  get stats() {
    return this.scene.stats;
  }
  draw(
    target: View3dHost,
    camera: Camera,
    world: FirstPersonWorld,
    props: readonly Prop[],
    entities: readonly Entity[] = [],
    options: { region?: RenderRegion; background?: string; interior?: FirstPersonInterior } = {},
  ): boolean {
    const ground = obliqueGround(camera, camera.viewportWidth, camera.viewportHeight);
    const items = this.frame.begin(false);
    try {
      collectWorldSprites({
        entities,
        props,
        world,
        alpha: 1,
        cull: grown(ground, 96, 384),
        items,
        frame: this.frame,
        depthShadows: true,
      });
      return target.draw(options.region, (output) =>
        this.scene.render(
          {
            world,
            realm: null,
            props,
            sprites: items.filter((i): i is SpriteItem => i.kind === "sprite"),
            eye: { x: camera.x, y: camera.y, z: 0, yaw: NORTH_YAW, pitch: 0 },
            topDown: { scale: camera.scale },
            drawRadius: Math.hypot(ground.right - ground.left, ground.bottom - ground.top) / 2,
            groundNearest: true,
            background: options.background,
            interior: options.interior,
          },
          output,
        ),
      );
    } finally {
      this.frame.release();
    }
  }
  dispose() {
    this.frame.clear();
    this.scene.dispose();
  }
}
