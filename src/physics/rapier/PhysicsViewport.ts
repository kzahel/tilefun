import * as THREE from "three";
import {
  bridgeFixture,
  PLAYER_HALF_HEIGHT,
  PLAYER_RADIUS,
  SLAB_INDICES,
  slabVertices,
} from "./BridgeFixture.js";
import { POSE_STRIDE } from "./PhysicsProtocol.js";
import type { PhysicsMotorState } from "./RapierWorld.js";

interface Pose {
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
}

/** Schematic backend diagnostic. Meshes use the exact collider source vertices. */
export class PhysicsViewport {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-14, 14, 10, -10, 0.1, 180);
  private readonly staticMeshes: THREE.Mesh[] = [];
  private readonly meshes = new Map<number, THREE.Mesh>();
  private readonly previous = new Map<number, Pose>();
  private readonly current = new Map<number, Pose>();
  private readonly materials = new Map<number, THREE.MeshLambertMaterial>();
  private readonly frustum = new THREE.Frustum();
  private readonly matrix = new THREE.Matrix4();
  private readonly target = new THREE.Vector3(-11, 0, 0);
  private received = 0;
  private focus: number | "shared" = 0;
  private zoom = 1;
  private cutaway = false;
  private predicted: PhysicsMotorState | undefined;
  private platformY: number | undefined;
  private readonly ghost: THREE.Mesh;
  readonly canvas: HTMLCanvasElement;

  constructor(
    private readonly element: HTMLElement,
    sections: number,
    private readonly pair = false,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setClearColor(0xb7ced5);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas = this.renderer.domElement;
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute(
      "aria-label",
      "3D physics playground. Arrow keys or WASD to walk; Space to jump.",
    );
    this.element.append(this.canvas);
    this.ghost = new THREE.Mesh(
      new THREE.CapsuleGeometry(PLAYER_RADIUS, PLAYER_HALF_HEIGHT * 2, 3, 8),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.7,
      }),
    );
    this.ghost.visible = false;
    this.scene.add(this.ghost);
    this.scene.add(new THREE.HemisphereLight(0xf4f4e8, 0x4a5948, 2.2));
    const light = new THREE.DirectionalLight(0xffe2b0, 2.5);
    light.position.set(-8, 20, 10);
    this.scene.add(light);
    for (const shape of bridgeFixture(sections)) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(slabVertices(shape), 3));
      geometry.setIndex(SLAB_INDICES);
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, this.material(shape.color));
      mesh.position.set(shape.x, shape.y, shape.z);
      mesh.updateMatrixWorld();
      this.staticMeshes.push(mesh);
      this.scene.add(mesh);
    }
  }

  private material(color: number) {
    let material = this.materials.get(color);
    if (!material) {
      material = new THREE.MeshLambertMaterial({ color, flatShading: true });
      this.materials.set(color, material);
    }
    return material;
  }

  accept(data: Float32Array, now: number): void {
    this.previous.clear();
    for (const [id, pose] of this.current) this.previous.set(id, pose);
    this.current.clear();
    for (let i = 0; i < data.length; i += POSE_STRIDE) {
      const id = data[i] ?? 0;
      const pose = {
        position: new THREE.Vector3(data[i + 1], data[i + 2], data[i + 3]),
        rotation: new THREE.Quaternion(data[i + 4], data[i + 5], data[i + 6], data[i + 7]),
      };
      this.current.set(id, pose);
      if (!this.meshes.has(id)) {
        const geometry =
          id === 0 || id === -1
            ? new THREE.CapsuleGeometry(PLAYER_RADIUS, PLAYER_HALF_HEIGHT * 2, 3, 8)
            : id === 1
              ? new THREE.BoxGeometry(3, 0.2, 3)
              : id % 2
                ? new THREE.SphereGeometry(0.28, 10, 7)
                : new THREE.BoxGeometry(
                    this.pair ? 0.8 : 0.56,
                    this.pair ? 0.8 : 0.56,
                    this.pair ? 0.8 : 0.56,
                  );
        const mesh = new THREE.Mesh(
          geometry,
          this.material(
            id === -1
              ? 0xf08cba
              : id === 0
                ? 0xffd358
                : id === 1
                  ? 0x5bafad
                  : id % 2
                    ? 0xf38961
                    : 0x9674c3,
          ),
        );
        this.meshes.set(id, mesh);
        this.scene.add(mesh);
      }
    }
    for (const [id, mesh] of this.meshes)
      if (!this.current.has(id)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        this.meshes.delete(id);
      }
    const player = this.current.get(0);
    if (player && this.target.distanceTo(player.position) > 8) this.target.copy(player.position);
    this.received = now;
  }

  setFocus(focus: number | "shared") {
    this.focus = focus;
  }

  setZoom(delta: number) {
    this.zoom = THREE.MathUtils.clamp(this.zoom * delta, 0.35, 2.5);
  }

  setPrediction(
    motor: PhysicsMotorState | undefined,
    platformY: number | undefined,
    authority: PhysicsMotorState | undefined,
    ghost: boolean,
  ) {
    this.predicted = motor;
    this.platformY = platformY;
    this.ghost.visible = ghost && authority !== undefined;
    if (authority) this.ghost.position.set(authority.x, authority.y, authority.z);
  }

  toggleCutaway() {
    this.cutaway = !this.cutaway;
    for (const color of [0xadc5cd, 0x94b5c2, 0xe2ce98]) {
      const material = this.material(color);
      material.transparent = this.cutaway;
      material.opacity = this.cutaway ? 0.25 : 1;
      material.depthWrite = !this.cutaway;
      material.needsUpdate = true;
    }
  }

  draw(now: number) {
    const width = this.element.clientWidth,
      height = this.element.clientHeight;
    const size = this.renderer.getSize(new THREE.Vector2());
    if (size.x !== width || size.y !== height) this.renderer.setSize(width, height, false);
    const alpha = Math.min(1, Math.max(0, (now - this.received) / (1000 / (this.pair ? 60 : 30))));
    for (const [id, current] of this.current) {
      const mesh = this.meshes.get(id);
      if (!mesh) continue;
      const previous = this.previous.get(id) ?? current;
      mesh.position.lerpVectors(previous.position, current.position, alpha);
      mesh.quaternion.slerpQuaternions(previous.rotation, current.rotation, alpha);
    }
    const player = this.meshes.get(0);
    if (player && this.predicted)
      player.position.set(this.predicted.x, this.predicted.y, this.predicted.z);
    if (this.platformY !== undefined) this.meshes.get(1)?.position.set(-3, this.platformY, 6.5);
    const followed = this.meshes.get(this.focus === "shared" ? 0 : this.focus);
    if (followed) {
      const center = followed.position.clone();
      const other = this.meshes.get(-1);
      if (this.focus === "shared" && other) center.add(other.position).multiplyScalar(0.5);
      this.target.lerp(center, 0.18);
    }
    const aspect = width / Math.max(1, height),
      span = 10 / this.zoom;
    this.camera.left = -span * aspect;
    this.camera.right = span * aspect;
    this.camera.top = span;
    this.camera.bottom = -span;
    this.camera.position.copy(this.target).add(new THREE.Vector3(0, 23, 17));
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.matrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.matrix);
    let visible = 0;
    for (const mesh of this.staticMeshes) {
      mesh.visible = this.frustum.intersectsObject(mesh);
      if (mesh.visible) visible++;
    }
    this.renderer.render(this.scene, this.camera);
    return {
      visible,
      total: this.staticMeshes.length,
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
    };
  }

  dispose() {
    this.ghost.geometry.dispose();
    (this.ghost.material as THREE.Material).dispose();
    for (const mesh of [...this.staticMeshes, ...this.meshes.values()]) mesh.geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
