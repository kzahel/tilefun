import * as THREE from "three";
import { CHUNK_SIZE_PX } from "../../config/constants.js";
import { rigMatrix, type XrRig } from "../../xr/XrRig.js";
import { type FirstPersonEye, lookDirection } from "./FirstPersonCamera.js";
import { obliqueProjection } from "./ObliqueCamera.js";

/** A headset's place in a view frame (252). */
export interface HeadsetFrame {
  /** The headset's room in the world; the head pose is the session's. */
  readonly rig: XrRig;
  /**
   * Tabletop: the world is a miniature cut to a square of `half` world pixels
   * around a point, standing on a base, without fog. Chunks and the sun's map
   * centre on the point instead of the eye.
   */
  readonly table?: { readonly x: number; readonly y: number; readonly half: number } | undefined;
}

/** The room around a tabletop miniature. */
export const TABLE_BACKGROUND = 0x1b222c;
const TABLE_BASE = 0x4a3b2c;
/** The base's thickness, and how far its top sits under the ground. World pixels. */
const BASE_DEPTH = 24;
const BASE_GAP = 0.5;
/** The headset's near plane, and the least its far plane reaches. Metres. */
const HEADSET_NEAR = 0.05;
const HEADSET_FAR = 30;

/**
 * The cameras a view frame can be drawn through: the seat's eye, the fixed
 * view's oblique camera (251) and a headset's (252).
 */
export class ViewCameras {
  private readonly eye = new THREE.PerspectiveCamera(70, 1, 2, 4000);
  /** The fixed view's projection; see `ObliqueCamera`. */
  private readonly oblique = new THREE.Camera();
  /** The headset's room in the scene. The renderer replaces `headset` with the
   * eyes' cameras, whose poses are relative to this parent. */
  private readonly room = new THREE.Group();
  private readonly headset = new THREE.PerspectiveCamera();
  private readonly base = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: TABLE_BASE, fog: false }),
  );
  private readonly cut = [0, 1, 2, 3].map(() => new THREE.Plane());

  constructor(scene: THREE.Scene) {
    this.eye.up.set(0, 0, 1);
    this.room.matrixAutoUpdate = false;
    this.room.add(this.headset);
    this.base.visible = false;
    scene.add(this.room, this.base);
  }

  /** The frame's camera, with `fog` set for it. */
  place(
    frame: { readonly eye: FirstPersonEye; readonly drawRadius: number },
    topDown: { readonly scale: number } | undefined,
    headset: HeadsetFrame | undefined,
    target: { readonly width: number; readonly height: number },
    fog: THREE.Fog,
    fogEnd: number,
  ): THREE.Camera {
    if (topDown) return this.placeOblique(frame.eye, topDown.scale, target.width, target.height);
    if (headset) return this.placeHeadset(headset, frame.drawRadius, fog, fogEnd);
    const aspect = target.width / Math.max(1, target.height);
    return this.placeEye(frame.eye, aspect, frame.drawRadius, fog, fogEnd);
  }

  /** The seat's eye. Fog thins from 45% of `fogEnd`. */
  private placeEye(
    eye: FirstPersonEye,
    aspect: number,
    drawRadius: number,
    fog: THREE.Fog,
    fogEnd: number,
  ): THREE.Camera {
    this.base.visible = false;
    fog.near = fogEnd * 0.45;
    fog.far = fogEnd;
    const camera = this.eye;
    camera.aspect = aspect;
    camera.far = drawRadius + CHUNK_SIZE_PX;
    camera.updateProjectionMatrix();
    const dir = lookDirection(eye.yaw, eye.pitch);
    camera.position.set(eye.x, -eye.y, eye.z);
    camera.lookAt(eye.x + dir.x, -(eye.y + dir.y), eye.z + dir.z);
    return camera;
  }

  /** The fixed view's camera: no rotation, and a projection that shears height
   * into screen Y. */
  private placeOblique(
    centre: { x: number; y: number },
    scale: number,
    width: number,
    height: number,
  ): THREE.Camera {
    this.base.visible = false;
    const camera = this.oblique;
    camera.position.set(centre.x, -centre.y, 0);
    camera.projectionMatrix.fromArray(obliqueProjection(scale, width, height)).transpose();
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    return camera;
  }

  /**
   * A headset: the room is placed in the world and the eyes follow the head.
   * The eyes' view space is in metres, so the fog's distances are too.
   */
  private placeHeadset(
    frame: HeadsetFrame,
    drawRadius: number,
    fog: THREE.Fog,
    fogEnd: number,
  ): THREE.Camera {
    const metre = frame.rig.pixelsPerMetre;
    fog.near = (fogEnd * 0.45) / metre;
    fog.far = fogEnd / metre;
    this.room.matrix.fromArray(rigMatrix(frame.rig));
    this.room.matrixWorldNeedsUpdate = true;
    this.headset.near = HEADSET_NEAR;
    this.headset.far = Math.max(HEADSET_FAR, (drawRadius + CHUNK_SIZE_PX) / metre);
    const { table } = frame;
    this.base.visible = !!table;
    if (table) {
      this.base.scale.set(table.half * 2, table.half * 2, BASE_DEPTH);
      this.base.position.set(table.x, -table.y, -BASE_GAP - BASE_DEPTH / 2);
    }
    return this.headset;
  }

  /** Planes (scene axes) that keep a tabletop's square; none for other frames. */
  cutFor(frame: HeadsetFrame | undefined): THREE.Plane[] {
    const table = frame?.table;
    if (!table) return [];
    const [west, east, south, north] = this.cut;
    west?.set(new THREE.Vector3(1, 0, 0), -(table.x - table.half));
    east?.set(new THREE.Vector3(-1, 0, 0), table.x + table.half);
    south?.set(new THREE.Vector3(0, 1, 0), -(-table.y - table.half));
    north?.set(new THREE.Vector3(0, -1, 0), -table.y + table.half);
    return this.cut;
  }

  dispose(): void {
    this.base.geometry.dispose();
    (this.base.material as THREE.Material).dispose();
  }
}
