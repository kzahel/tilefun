import * as THREE from "three";
import { expect, it, vi } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { CarMeshAsset } from "./CarMeshAsset.js";

function fixture() {
  const scene = new THREE.Group();
  const map = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const material = new THREE.MeshBasicMaterial({ map });
  for (const [i, id] of ["FL", "FR", "RL", "RR"].entries()) {
    const steer = new THREE.Group();
    steer.name = `Wheel_${id}_Steer`;
    steer.position.set(i < 2 ? -17 : 15, 4.1, i % 2 ? 10 : -10);
    const roll = new THREE.Group();
    roll.name = `Wheel_${id}_Roll`;
    roll.userData = { wheel_radius: 4.1, roll_axis_gltf: [0, 0, -1] };
    roll.add(new THREE.Mesh(new THREE.BoxGeometry(8, 8, 2), material));
    steer.add(roll);
    scene.add(steer);
  }
  return { scene, map, material };
}

it("registers GLB axes and fixed lateral width while preserving tire/roof height and ground origin", () => {
  const { scene } = fixture();
  const asset = new CarMeshAsset(scene);
  asset.object.updateMatrixWorld(true);
  const world = (point: readonly [number, number, number]) =>
    scene.localToWorld(new THREE.Vector3(...point)).toArray();
  const close = (actual: number[], expected: number[]) => {
    expected.forEach((v, i) => {
      expect(actual[i]).toBeCloseTo(v);
    });
  };
  // GLB front, vertical and lateral axes become game +X, +Z and ground Y.
  close(world([-31, 0, 0]), [31, 0, 0]);
  close(world([0, 24, 0]), [0, 0, 24]);
  close(world([0, 0, -10]), [0, -13, 0]);
  close(world([0, 0, 0]), [0, 0, 0]);
  asset.object.rotation.z = Math.PI / 2;
  asset.object.updateMatrixWorld(true);
  close(world([-31, 0, 0]), [0, 31, 0]);
  close(world([0, 24, 0]), [0, 0, 24]);
  asset.dispose();
});

it("keeps fitted tire contacts on the ground through diagonal yaw and absolute wheel roll", () => {
  const { scene } = fixture();
  // Use a genuinely circular tire rather than the deliberately crude fixture box.
  for (const id of ["FL", "FR", "RL", "RR"]) {
    const roll = required(scene.getObjectByName(`Wheel_${id}_Roll`));
    const tire = roll.children[0] as THREE.Mesh;
    tire.geometry = new THREE.CylinderGeometry(4.1, 4.1, 2, 128);
    tire.geometry.rotateX(Math.PI / 2);
  }
  const asset = new CarMeshAsset(scene, 1.3, { heightScale: 0.631, contactShadow: true });
  for (let yaw = 0; yaw < Math.PI * 2; yaw += Math.PI / 4) {
    asset.object.rotation.z = yaw;
    for (const travel of [0, 7, -13, 0]) {
      asset.setTravel(travel);
      asset.object.updateMatrixWorld(true);
      for (const id of ["FL", "FR", "RL", "RR"]) {
        const tire = required(scene.getObjectByName(`Wheel_${id}_Roll`)).children[0] as THREE.Mesh;
        const points = tire.geometry.getAttribute("position");
        let bottom = Infinity;
        for (let i = 0; i < points.count; i++) {
          const p = new THREE.Vector3()
            .fromBufferAttribute(points, i)
            .applyMatrix4(tire.matrixWorld);
          bottom = Math.min(bottom, p.z);
        }
        expect(bottom).toBeGreaterThan(-0.001);
        expect(bottom).toBeLessThan(0.002);
      }
      const shadow = required(asset.object.getObjectByName("Game-contact-shadow"));
      expect(shadow.getWorldPosition(new THREE.Vector3()).z).toBeCloseTo(-0.01);
    }
  }
  asset.dispose();
});

it("applies absolute rigid wheel travel without moving pivots, then frees shared resources once", () => {
  const { scene, material, map } = fixture();
  const freeMaterial = vi.spyOn(material, "dispose");
  const freeMap = vi.spyOn(map, "dispose");
  const asset = new CarMeshAsset(scene);
  const roll = scene.getObjectByName("Wheel_FL_Roll");
  if (!roll) throw Error("Missing fixture wheel");
  asset.object.updateMatrixWorld(true);
  const center = roll.getWorldPosition(new THREE.Vector3()).clone();
  // Original +X radial point moves toward +Y after forward quarter roll
  // about local -Z with phase -distance/radius (two negative signs).
  asset.setTravel((Math.PI * 4.1) / 2);
  const radial = new THREE.Vector3(1, 0, 0).applyQuaternion(roll.quaternion);
  expect(radial.x).toBeCloseTo(0);
  expect(radial.y).toBeCloseTo(1);
  expect(roll.getWorldPosition(new THREE.Vector3()).distanceTo(center)).toBeCloseTo(0);
  asset.setTravel(0); // Next car/draw cannot inherit the preceding travel.
  expect(roll.quaternion.toArray()).toEqual([0, 0, 0, 1]);
  asset.setTravel(-(Math.PI * 4.1) / 2);
  expect(new THREE.Vector3(1, 0, 0).applyQuaternion(roll.quaternion).y).toBeCloseTo(-1);
  asset.dispose();
  expect(freeMaterial).toHaveBeenCalledTimes(1);
  expect(freeMap).toHaveBeenCalledTimes(1);
  expect(asset.object.children).toHaveLength(0);
});

it("compiles body and wheel siblings once, retains tagged light control and disposes every geometry once", () => {
  const { scene, material } = fixture();
  for (const id of ["FL", "FR", "RL", "RR"])
    required(scene.getObjectByName(`Wheel_${id}_Roll`)).add(
      new THREE.Mesh(new THREE.BoxGeometry(), material),
    );
  scene.add(
    new THREE.Mesh(new THREE.BoxGeometry(), material),
    new THREE.Mesh(new THREE.BoxGeometry(), material),
  );
  const lens = new THREE.Mesh(new THREE.BoxGeometry(), material);
  lens.userData = {
    tilefun_effect_schema: 1,
    tilefun_role: "emergency-light",
    tilefun_channel: "emergencyLights",
    tilefun_group: "left",
    tilefun_phase: 0,
  };
  scene.add(lens);
  const geometries = new Set<THREE.BufferGeometry>();
  scene.traverse((node) => {
    if (node instanceof THREE.Mesh) geometries.add(node.geometry);
  });
  const asset = new CarMeshAsset(scene, 1.3, { batch: true });
  expect(asset.meshCount).toBe(11);
  expect(asset.drawMeshCount).toBe(6);
  scene.traverse((node) => {
    if (node instanceof THREE.Mesh) geometries.add(node.geometry);
  });
  const frees = [...geometries].map((geometry) => vi.spyOn(geometry, "dispose"));
  asset.setEmergency(true, 0.05);
  expect((lens.material as THREE.MeshBasicMaterial).color.r).toBe(4);
  asset.setEmergency(false, 0.05);
  expect((lens.material as THREE.MeshBasicMaterial).color.r).toBe(1);
  asset.setTravel(7);
  asset.setTravel(0);
  for (const id of ["FL", "FR", "RL", "RR"])
    expect(required(scene.getObjectByName(`Wheel_${id}_Roll`)).quaternion.toArray()).toEqual([
      0, 0, 0, 1,
    ]);
  asset.dispose();
  asset.dispose();
  for (const free of frees) expect(free).toHaveBeenCalledTimes(1);
});

it("rolls every six-wheel axle by its own radius and resets absolute phases without moving body or pivots", () => {
  const { scene, material } = fixture();
  const body = new THREE.Mesh(new THREE.BoxGeometry(40, 10, 20), material);
  body.name = "Body";
  scene.add(body);
  for (const [i, id] of ["ML", "MR"].entries()) {
    const steer = new THREE.Group();
    steer.name = `Wheel_${id}_Steer`;
    steer.position.set(0, 6.5, i ? 8 : -8);
    const roll = new THREE.Group();
    roll.name = `Wheel_${id}_Roll`;
    roll.userData = { wheel_radius: 6.5, roll_axis_gltf: [0, 0, -1] };
    roll.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.2);
    roll.add(new THREE.Mesh(new THREE.BoxGeometry(13, 13, 2), material));
    steer.add(roll);
    scene.add(steer);
  }
  const rolls = ["FL", "FR", "ML", "MR", "RL", "RR"].map((id) =>
    required(scene.getObjectByName(`Wheel_${id}_Roll`)),
  );
  const rest = rolls.map((node) => node.quaternion.clone());
  const asset = new CarMeshAsset(scene, 1);
  asset.object.updateMatrixWorld(true);
  const centers = rolls.map((node) => node.getWorldPosition(new THREE.Vector3()));
  const bodyRest = body.matrixWorld.clone();
  for (const distance of [12, -12, 0, 7, 0]) {
    asset.setTravel(distance);
    asset.object.updateMatrixWorld(true);
    rolls.forEach((node, i) => {
      const phase = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, -1),
        -distance / node.userData.wheel_radius,
      );
      expect(node.quaternion.angleTo(required(rest[i]).clone().multiply(phase))).toBeLessThan(1e-7);
      expect(
        node.getWorldPosition(new THREE.Vector3()).distanceTo(required(centers[i])),
      ).toBeLessThan(1e-8);
    });
    expect(body.matrixWorld.equals(bodyRest)).toBe(true);
  }
  asset.dispose();
});
it.each(["radius", "parent", "duplicate"])(
  "rejects malformed additional wheel %s and disposes shared resources",
  (fault) => {
    const { scene, material, map } = fixture();
    const roll = required(scene.getObjectByName("Wheel_FL_Roll")).clone();
    roll.name = fault === "duplicate" ? "Wheel_FL_Roll" : "Wheel_ML_Roll";
    roll.userData.wheel_radius = fault === "radius" ? 0 : 6.5;
    const steer = new THREE.Group();
    steer.name = fault === "parent" ? "Wrong" : "Wheel_ML_Steer";
    steer.add(roll);
    scene.add(steer);
    const freeMaterial = vi.spyOn(material, "dispose"),
      freeMap = vi.spyOn(map, "dispose");
    expect(() => new CarMeshAsset(scene)).toThrow(/authored car wheel/);
    expect(freeMaterial).toHaveBeenCalledTimes(1);
    expect(freeMap).toHaveBeenCalledTimes(1);
  },
);

it("keeps source hierarchy by default and fails closed if a qualified batching surface disappears", () => {
  const { scene, material } = fixture();
  const body = new THREE.Mesh(new THREE.BoxGeometry(), material);
  body.name = "Body-panel";
  scene.add(body, new THREE.Mesh(new THREE.BoxGeometry(), material));
  const asset = new CarMeshAsset(scene);
  expect(asset.drawMeshCount).toBe(asset.meshCount);
  expect(scene.getObjectByName("Body-panel")).toBe(body);
  asset.dispose();
  const next = fixture();
  const free = vi.spyOn(next.material, "dispose");
  expect(
    () => new CarMeshAsset(next.scene, 1, { batch: true, preserveParts: ["missing"] }),
  ).toThrow("Missing qualified vehicle part");
  expect(free).toHaveBeenCalledTimes(1);
});

// Motorcycle-v1 branch: true F/R[/SC], own radii, same production asset.
function cycleFixture(sidecar = false) {
  const scene = new THREE.Group(),
    root = new THREE.Group();
  root.name = "Motorcycle_Root";
  const ids = sidecar ? ["F", "R", "SC"] : ["F", "R"];
  root.userData = { tilefun_motorcycle: 1, wheel_ids: ids };
  scene.add(root);
  const map = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const material = new THREE.MeshBasicMaterial({ map });
  const body = new THREE.Mesh(new THREE.BoxGeometry(20, 5, 8), material);
  body.name = "Cycle_fixed_body";
  body.position.y = 16;
  root.add(body);
  const radii: Record<string, number> = { F: 6, R: 8, SC: 4 };
  for (const [i, id] of ids.entries()) {
    const radius = required(radii[id]);
    const steer = new THREE.Group();
    steer.name = `Wheel_${id}_Steer`;
    steer.position.set(i === 0 ? -17 : i === 1 ? 14 : 0, radius, id === "SC" ? 14 : 0);
    const roll = new THREE.Group();
    roll.name = `Wheel_${id}_Roll`;
    roll.userData = { wheel_radius: radius, roll_axis_gltf: [0, 0, -1] };
    roll.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.2);
    const geometry = new THREE.CylinderGeometry(radius, radius, 2, 32);
    geometry.rotateX(Math.PI / 2);
    roll.add(new THREE.Mesh(geometry, material));
    steer.add(roll);
    root.add(steer);
  }
  return { scene, root, body, ids, map, material };
}

it.each([false, true])(
  "rolls genuine two/three-wheel cycles per radius through signed travel/reset (sidecar=%s)",
  (sidecar) => {
    const { scene, root, body, ids, map, material } = cycleFixture(sidecar);
    const rolls = ids.map((id) => required(root.getObjectByName(`Wheel_${id}_Roll`)));
    const rest = rolls.map((roll) => roll.quaternion.clone());
    const resources = new Set<THREE.BufferGeometry>();
    scene.traverse((node) => {
      if (node instanceof THREE.Mesh) resources.add(node.geometry);
    });
    const freeMaterial = vi.spyOn(material, "dispose"),
      freeMap = vi.spyOn(map, "dispose");
    const asset = new CarMeshAsset(scene, 1, { batch: true, preserveParts: ["Cycle_fixed_body"] });
    scene.traverse((node) => {
      if (node instanceof THREE.Mesh) resources.add(node.geometry);
    });
    const frees = [...resources].map((geometry) => vi.spyOn(geometry, "dispose"));
    asset.object.updateMatrixWorld(true);
    const centers = rolls.map((roll) => roll.getWorldPosition(new THREE.Vector3()));
    const bodyRest = body.matrixWorld.clone();
    for (const distance of [Math.PI * 3, -Math.PI * 3, 0, 13, 0]) {
      asset.setTravel(distance);
      asset.object.updateMatrixWorld(true);
      rolls.forEach((roll, i) => {
        const expected = required(rest[i])
          .clone()
          .multiply(
            new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(0, 0, -1),
              -distance / roll.userData.wheel_radius,
            ),
          );
        expect(roll.quaternion.angleTo(expected)).toBeLessThan(1e-7);
        expect(
          roll.getWorldPosition(new THREE.Vector3()).distanceTo(required(centers[i])),
        ).toBeLessThan(1e-8);
      });
      expect(body.matrixWorld.equals(bodyRest)).toBe(true);
    }
    expect(rolls[0]?.userData.wheel_radius).not.toBe(rolls[1]?.userData.wheel_radius);
    asset.dispose();
    asset.dispose();
    expect(freeMaterial).toHaveBeenCalledTimes(1);
    expect(freeMap).toHaveBeenCalledTimes(1);
    for (const free of frees) expect(free).toHaveBeenCalledTimes(1);
  },
);

const cycleFaults: [string, (fixture: ReturnType<typeof cycleFixture>) => void][] = [
  [
    "body outside marked root",
    ({ scene, body }) => {
      scene.add(body);
    },
  ],
  [
    "additional mesh outside marked root",
    ({ scene, body }) => {
      scene.add(body.clone());
    },
  ],
  [
    "missing marker",
    ({ root }) => {
      delete root.userData.tilefun_motorcycle;
    },
  ],
  [
    "boolean marker",
    ({ root }) => {
      root.userData.tilefun_motorcycle = true;
    },
  ],
  [
    "string marker",
    ({ root }) => {
      root.userData.tilefun_motorcycle = "1";
    },
  ],
  [
    "wrong numeric marker",
    ({ root }) => {
      root.userData.tilefun_motorcycle = 2;
    },
  ],
  [
    "misnamed root",
    ({ root }) => {
      root.name = "WrongRoot";
    },
  ],
  [
    "no motorcycle root",
    ({ root }) => {
      root.name = "Unmarked";
      delete root.userData.tilefun_motorcycle;
    },
  ],
  [
    "duplicate root",
    ({ scene }) => {
      const n = new THREE.Group();
      n.name = "Motorcycle_Root";
      n.userData.tilefun_motorcycle = 1;
      scene.add(n);
    },
  ],
  [
    "missing inventory",
    ({ root }) => {
      delete root.userData.wheel_ids;
    },
  ],
  [
    "string inventory",
    ({ root }) => {
      root.userData.wheel_ids = "F,R";
    },
  ],
  [
    "wrong inventory",
    ({ root }) => {
      root.userData.wheel_ids = ["FL", "FR", "RL", "RR"];
    },
  ],
  [
    "duplicate inventory",
    ({ root }) => {
      root.userData.wheel_ids = ["F", "R", "R"];
    },
  ],
  [
    "missing wheel",
    ({ root }) => {
      root.remove(required(root.getObjectByName("Wheel_R_Steer")));
    },
  ],
  [
    "extra wheel",
    ({ root }) => {
      const n = required(root.getObjectByName("Wheel_F_Steer")).clone(true);
      n.name = "Wheel_EXTRA_Steer";
      required(n.getObjectByName("Wheel_F_Roll")).name = "Wheel_EXTRA_Roll";
      root.add(n);
    },
  ],
  [
    "duplicate roll",
    ({ root }) => {
      const roll = required(root.getObjectByName("Wheel_F_Roll"));
      required(roll.parent).add(roll.clone(true));
    },
  ],
  [
    "duplicate steer",
    ({ root }) => {
      const n = new THREE.Group();
      n.name = "Wheel_F_Steer";
      root.add(n);
    },
  ],
  [
    "wrong parent",
    ({ root }) => {
      root.add(required(root.getObjectByName("Wheel_F_Roll")));
    },
  ],
  [
    "outside root",
    ({ scene, root }) => {
      scene.add(required(root.getObjectByName("Wheel_F_Steer")));
    },
  ],
  [
    "nested wheels",
    ({ root }) => {
      required(root.getObjectByName("Wheel_F_Roll")).add(
        required(root.getObjectByName("Wheel_R_Steer")),
      );
    },
  ],
  [
    "empty wheel",
    ({ root }) => {
      required(root.getObjectByName("Wheel_F_Roll")).clear();
    },
  ],
  [
    "stray metadata",
    ({ body }) => {
      body.userData.wheel_radius = 6;
    },
  ],
  [
    "zero radius",
    ({ root }) => {
      required(root.getObjectByName("Wheel_F_Roll")).userData.wheel_radius = 0;
    },
  ],
  [
    "negative radius",
    ({ root }) => {
      required(root.getObjectByName("Wheel_F_Roll")).userData.wheel_radius = -1;
    },
  ],
  [
    "infinite radius",
    ({ root }) => {
      required(root.getObjectByName("Wheel_F_Roll")).userData.wheel_radius = Infinity;
    },
  ],
  [
    "NaN radius",
    ({ root }) => {
      required(root.getObjectByName("Wheel_F_Roll")).userData.wheel_radius = NaN;
    },
  ],
  [
    "string radius",
    ({ root }) => {
      required(root.getObjectByName("Wheel_F_Roll")).userData.wheel_radius = "6";
    },
  ],
  [
    "boolean radius",
    ({ root }) => {
      required(root.getObjectByName("Wheel_F_Roll")).userData.wheel_radius = true;
    },
  ],
  [
    "missing radius",
    ({ root }) => {
      delete required(root.getObjectByName("Wheel_F_Roll")).userData.wheel_radius;
    },
  ],
  [
    "zero axis",
    ({ root }) => {
      required(root.getObjectByName("Wheel_F_Roll")).userData.roll_axis_gltf = [0, 0, 0];
    },
  ],
  [
    "short axis",
    ({ root }) => {
      required(root.getObjectByName("Wheel_F_Roll")).userData.roll_axis_gltf = [0, 0];
    },
  ],
  [
    "nonfinite axis",
    ({ root }) => {
      required(root.getObjectByName("Wheel_F_Roll")).userData.roll_axis_gltf = [0, Infinity, -1];
    },
  ],
  [
    "nonnumeric axis",
    ({ root }) => {
      required(root.getObjectByName("Wheel_F_Roll")).userData.roll_axis_gltf = [0, "0", -1];
    },
  ],
  [
    "missing axis",
    ({ root }) => {
      delete required(root.getObjectByName("Wheel_F_Roll")).userData.roll_axis_gltf;
    },
  ],
  [
    "boat ambiguity",
    ({ scene }) => {
      const boat = new THREE.Group();
      boat.name = "Boat_Root";
      boat.userData.tilefun_watercraft = 1;
      scene.add(boat);
    },
  ],
];
it.each(cycleFaults)(
  "rejects malformed cycle %s and disposes all reachable resources",
  (_label, mutate) => {
    const f = cycleFixture(true);
    mutate(f);
    const geometries = new Set<THREE.BufferGeometry>();
    f.scene.traverse((node) => {
      if (node instanceof THREE.Mesh) geometries.add(node.geometry);
    });
    const frees = [...geometries].map((geometry) => vi.spyOn(geometry, "dispose"));
    const freeMaterial = vi.spyOn(f.material, "dispose"),
      freeMap = vi.spyOn(f.map, "dispose");
    expect(() => new CarMeshAsset(f.scene, 1, { batch: true })).toThrow();
    expect(freeMaterial).toHaveBeenCalledTimes(1);
    expect(freeMap).toHaveBeenCalledTimes(1);
    for (const free of frees) expect(free).toHaveBeenCalledTimes(1);
  },
);

it("preserves zero-wheel marked-boat travel/reset with no cycle metadata", () => {
  const scene = new THREE.Group(),
    root = new THREE.Group();
  root.name = "Boat_Root";
  root.userData.tilefun_watercraft = 1;
  const material = new THREE.MeshBasicMaterial();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(20, 5, 8), material);
  hull.name = "Boat_Hull";
  const propeller = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 3), material);
  propeller.name = "Boat_Propeller";
  root.add(hull, propeller);
  scene.add(root);
  const asset = new CarMeshAsset(scene, 1);
  const rest = propeller.quaternion.clone();
  asset.setTravel(2);
  expect(propeller.quaternion.angleTo(rest)).toBeGreaterThan(0.1);
  asset.setTravel(0);
  expect(propeller.quaternion.angleTo(rest)).toBeLessThan(1e-7);
  asset.dispose();
});
