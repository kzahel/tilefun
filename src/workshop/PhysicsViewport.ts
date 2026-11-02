import * as THREE from "three";
import { DEFAULT_PHYSICAL_HEIGHT } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import { interpolatePosition, interpolateWz } from "../rendering/EntityInterpolation.js";
import type { ScenarioReplica } from "../scenarios/ScenarioReplica.js";

/** Read-only visualization of the actual replicated/predicted collider data. */
export class PhysicsViewport {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-140, 140, 105, -105, 1, 1000);
  private grid = new THREE.GridHelper(512, 32, 0x64826a, 0x8eaa8a);
  private meshes = new Map<number, THREE.Mesh>();
  private geometry = new THREE.BoxGeometry(1, 1, 1);
  private materials = [0x5c9cdd, 0xe2a65c, 0x929ca1].map(
    (color) => new THREE.MeshLambertMaterial({ color }),
  );
  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene.background = new THREE.Color(0xb7ced5);
    this.camera.position.set(180, 240, 260);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x4d6b45, 2));
    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(-50, 200, 100);
    this.scene.add(light);
    this.grid.position.y = -0.1;
    this.scene.add(this.grid);
  }
  render(
    replica: ScenarioReplica,
    alpha: number,
    now: number,
    paused: boolean,
    hostId: number,
    guestId: number,
  ) {
    const width = Math.max(1, this.canvas.clientWidth),
      height = Math.max(1, this.canvas.clientHeight);
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    if (size.x !== width || size.y !== height) {
      this.renderer.setSize(width, height, false);
      this.camera.left = (-105 * width) / height;
      this.camera.right = (105 * width) / height;
      this.camera.updateProjectionMatrix();
    }
    const view = replica.view;
    view.beginPresentation(now, alpha, paused);
    const seen = new Set<number>();
    try {
      for (const entity of view.entities) {
        if (!entity.collider || entity.parentId !== undefined) continue;
        seen.add(entity.id);
        let mesh = this.meshes.get(entity.id);
        if (!mesh) {
          mesh = new THREE.Mesh(
            this.geometry,
            this.materials[entity.id === hostId ? 0 : entity.id === guestId ? 1 : 2],
          );
          this.meshes.set(entity.id, mesh);
          this.scene.add(mesh);
        }
        // Entity IDs can be reused by a replacement world with different roles.
        mesh.material =
          this.materials[entity.id === hostId ? 0 : entity.id === guestId ? 1 : 2] ?? mesh.material;
        this.place(mesh, entity, alpha);
      }
      for (const [id, mesh] of this.meshes)
        if (!seen.has(id)) {
          this.scene.remove(mesh);
          this.meshes.delete(id);
        }
      this.renderer.render(this.scene, this.camera);
    } finally {
      view.endPresentation();
    }
  }
  private place(mesh: THREE.Mesh, entity: Entity, alpha: number) {
    const c = entity.collider;
    if (!c) return;
    const p = interpolatePosition(entity.position, entity.prevPosition, alpha),
      h = c.physicalHeight ?? DEFAULT_PHYSICAL_HEIGHT;
    mesh.scale.set(c.width, h, c.height);
    mesh.position.set(
      p.wx + c.offsetX,
      (interpolateWz(entity, alpha) ?? 0) + h / 2,
      p.wy + c.offsetY - c.height / 2,
    );
  }
  dispose() {
    this.geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.meshes.clear();
    this.scene.clear();
    this.renderer.dispose();
    this.grid.dispose();
  }
}
