import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { NORTH_YAW } from "../rendering/firstperson/FirstPersonCamera.js";
import {
  followAnchor,
  headFromMatrix,
  headHeading,
  rigMatrix,
  rigThrough,
  roomToWorld,
  SNAP_TURN,
  scaleTable,
  snapTurn,
  TABLE_DEAD_ZONE,
  TABLE_SCALE_MAX,
  TABLE_SCALE_MIN,
  type XrRig,
} from "./XrRig.js";

/** A rigid transform as WebXR gives it: yaw to the right, then pitch up. */
function pose(x: number, y: number, z: number, yawRight = 0, pitchUp = 0): number[] {
  const m = new THREE.Matrix4().makeRotationFromEuler(
    new THREE.Euler(pitchUp, -yawRight, 0, "YXZ"),
  );
  m.setPosition(x, y, z);
  return m.toArray();
}

describe("a headset's room in the world (252)", () => {
  it("reads the head's place, heading and pitch from its pose", () => {
    expect(headFromMatrix(pose(0.2, 1.5, -0.3))).toMatchObject({ x: 0.2, y: 1.5, z: -0.3 });
    expect(headFromMatrix(pose(0, 1, 0)).yaw).toBeCloseTo(0, 9);
    expect(headFromMatrix(pose(0, 1, 0, Math.PI / 2)).yaw).toBeCloseTo(Math.PI / 2, 9);
    expect(headFromMatrix(pose(0, 1, 0, -0.4)).yaw).toBeCloseTo(-0.4, 9);
    const up = headFromMatrix(pose(0, 1, 0, 0.3, 0.5));
    expect(up.pitch).toBeCloseTo(0.5, 9);
    expect(up.yaw).toBeCloseTo(0.3, 9);
  });

  it("puts the room's forward along the rig's heading, at its scale", () => {
    const north: XrRig = { x: 100, y: 200, z: 5, yaw: NORTH_YAW, pixelsPerMetre: 20 };
    // One metre ahead is north (smaller y); one to the right is east; one up is up.
    expect(roomToWorld(north, { x: 0, y: 0, z: -1 })).toMatchObject({ x: 100, y: 180, z: 5 });
    const right = roomToWorld(north, { x: 1, y: 0, z: 0 });
    expect(right.x).toBeCloseTo(120, 9);
    expect(right.y).toBeCloseTo(200, 9);
    expect(roomToWorld(north, { x: 0, y: 1.5, z: 0 }).z).toBeCloseTo(35, 9);
    // Facing east, right is south.
    const east = { ...north, yaw: 0 };
    expect(roomToWorld(east, { x: 0, y: 0, z: -1 }).x).toBeCloseTo(120, 9);
    expect(roomToWorld(east, { x: 1, y: 0, z: 0 }).y).toBeCloseTo(220, 9);
  });

  it("finds the rig that puts a room point on a world point", () => {
    const at = { x: 40, y: -30, z: 12 },
      point = { x: 0.3, y: 1.4, z: -0.7 };
    const rig = rigThrough(at, point, 0.8, 18);
    const back = roomToWorld(rig, point);
    expect(back.x).toBeCloseTo(at.x, 9);
    expect(back.y).toBeCloseTo(at.y, 9);
    expect(back.z).toBeCloseTo(at.z, 9);
    expect(rig).toMatchObject({ yaw: 0.8, pixelsPerMetre: 18 });
  });

  it("gives the scene the same transform as a matrix (game Y mirrored)", () => {
    const rig: XrRig = { x: 300, y: 120, z: 8, yaw: 2.1, pixelsPerMetre: 18 };
    const matrix = new THREE.Matrix4().fromArray(rigMatrix(rig));
    for (const p of [
      { x: 0, y: 0, z: 0 },
      { x: 0.5, y: 1.6, z: -2 },
      { x: -1, y: 0.2, z: 3 },
    ]) {
      const world = roomToWorld(rig, p);
      const scene = new THREE.Vector3(p.x, p.y, p.z).applyMatrix4(matrix);
      expect(scene.x).toBeCloseTo(world.x, 6);
      expect(scene.y).toBeCloseTo(-world.y, 6);
      expect(scene.z).toBeCloseTo(world.z, 6);
    }
    // A proper rotation with a uniform scale: nothing is mirrored for the eyes.
    expect(matrix.determinant()).toBeCloseTo(18 ** 3, 3);
  });

  it("adds the head's turn to the room's heading", () => {
    const rig: XrRig = { x: 0, y: 0, z: 0, yaw: NORTH_YAW, pixelsPerMetre: 18 };
    expect(headHeading(rig, headFromMatrix(pose(0, 1, 0, Math.PI / 2)))).toBeCloseTo(0, 9);
  });
});

describe("comfort turning", () => {
  it("turns once per flick of the stick and never while it is held", () => {
    const state = { armed: true };
    expect(snapTurn(state, 0.2)).toBe(0);
    expect(snapTurn(state, 0.9)).toBe(SNAP_TURN);
    expect(snapTurn(state, 1)).toBe(0);
    expect(snapTurn(state, 0.5)).toBe(0);
    // Back near the centre arms the next turn.
    expect(snapTurn(state, 0.1)).toBe(0);
    expect(snapTurn(state, -0.8)).toBe(-SNAP_TURN);
  });
});

describe("the tabletop's anchor", () => {
  it("stays put inside the dead zone and glides back over a player who leaves it", () => {
    const anchor = { x: 0, y: 0, z: 0 },
      state = { gliding: false };
    const half = 300;
    followAnchor(anchor, { x: half * TABLE_DEAD_ZONE - 1, y: 0, z: 0 }, half, 1 / 72, state);
    expect(anchor).toEqual({ x: 0, y: 0, z: 0 });
    const player = { x: 120, y: -40, z: 6 };
    followAnchor(anchor, player, half, 1 / 72, state);
    expect(state.gliding).toBe(true);
    expect(anchor.x).toBeGreaterThan(0);
    expect(anchor.x).toBeLessThan(20);
    for (let i = 0; i < 72; i++) followAnchor(anchor, player, half, 1 / 72, state);
    expect(Math.hypot(anchor.x - player.x, anchor.y - player.y)).toBeLessThan(1);
    expect(anchor.z).toBeCloseTo(6, 0);
    expect(state.gliding).toBe(false);
  });

  it("jumps to a player who is suddenly far away", () => {
    const anchor = { x: 0, y: 0, z: 0 },
      state = { gliding: true };
    followAnchor(anchor, { x: 5000, y: 100, z: 3 }, 300, 1 / 72, state);
    expect(anchor).toEqual({ x: 5000, y: 100, z: 3 });
    expect(state.gliding).toBe(false);
  });

  it("scales with the stick inside its limits", () => {
    expect(scaleTable(600, 0.1, 1)).toBe(600);
    expect(scaleTable(600, 1, 0.5)).toBeGreaterThan(600);
    expect(scaleTable(600, -1, 0.5)).toBeLessThan(600);
    expect(scaleTable(TABLE_SCALE_MAX, 1, 1)).toBe(TABLE_SCALE_MAX);
    expect(scaleTable(TABLE_SCALE_MIN, -1, 1)).toBe(TABLE_SCALE_MIN);
  });
});
