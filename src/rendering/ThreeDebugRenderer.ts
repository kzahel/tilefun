import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  CHUNK_SIZE,
  DEFAULT_PHYSICAL_HEIGHT,
  ELEVATION_PX,
  TILE_SIZE,
} from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import type { Prop, PropCollider } from "../entities/Prop.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { World } from "../world/World.js";

/**
 * Convert game world coordinates to Three.js position.
 * Game: wx→right, wy→down, wz→up
 * Three.js: X→right, Y→up, Z→wy (not negated, so top-down view matches 2D)
 */
function toThree(wx: number, wy: number, wz: number): THREE.Vector3 {
  return new THREE.Vector3(wx, wz, wy);
}

// Reusable materials (allocated once)
const MAT_ENTITY = new THREE.LineBasicMaterial({ color: 0xff3333 });
const MAT_PROP_FINITE = new THREE.LineBasicMaterial({ color: 0xff8800 });
const MAT_PROP_INFINITE = new THREE.LineBasicMaterial({ color: 0xff6644 });
const MAT_PROP_WALKABLE = new THREE.LineBasicMaterial({ color: 0x00ccaa });
const MAT_TERRAIN_WIRE = new THREE.MeshBasicMaterial({
  color: 0x448844,
  wireframe: true,
});
const MAT_TERRAIN_SOLID = new THREE.MeshBasicMaterial({
  color: 0x336633,
  transparent: true,
  opacity: 0.3,
  side: THREE.DoubleSide,
});
const MAT_GROUND = new THREE.MeshBasicMaterial({
  color: 0x223322,
  side: THREE.DoubleSide,
});

/** Maximum z-height for "infinite" walls in the 3D view. */
const INFINITE_WALL_HEIGHT = 48;

/** Initial camera orbit distance from the target. */
const INITIAL_ORBIT_DISTANCE = 400;

/** Initial camera tilt angle (radians from +Y). ~55 degrees = nice 3/4 view. */
const INITIAL_POLAR_ANGLE = Math.PI / 3.2;

export class ThreeDebugRenderer {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private active = false;

  // Scene groups
  private terrainGroup = new THREE.Group();
  private entityGroup = new THREE.Group();
  private propGroup = new THREE.Group();

  // Terrain chunk cache
  private chunkMeshes = new Map<string, THREE.Mesh[]>();
  private onResize = (): void => this.resize();

  constructor(private gameCanvas: HTMLCanvasElement) {}

  setEnabled(enabled: boolean): void {
    if (enabled && !this.active) {
      this.activate();
    } else if (!enabled && this.active) {
      this.deactivate();
    }
  }

  private activate(): void {
    this.active = true;

    // Create WebGL renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setClearColor(0x1a1a2e);
    const threeCanvas = this.renderer.domElement;

    // Split-screen layout
    this.gameCanvas.style.position = "fixed";
    this.gameCanvas.style.left = "0";
    this.gameCanvas.style.top = "0";
    this.gameCanvas.style.width = "50%";
    this.gameCanvas.style.height = "100%";

    threeCanvas.style.position = "fixed";
    threeCanvas.style.right = "0";
    threeCanvas.style.top = "0";
    threeCanvas.style.width = "50%";
    threeCanvas.style.height = "100%";
    document.body.appendChild(threeCanvas);

    // Size the renderer to actual pixel dimensions
    const w = Math.floor(window.innerWidth / 2);
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.add(this.terrainGroup);
    this.scene.add(this.entityGroup);
    this.scene.add(this.propGroup);

    // Lighting
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight.position.set(100, 200, -100);
    this.scene.add(dirLight);

    // Grid helper on ground plane
    const gridSize = CHUNK_SIZE * TILE_SIZE * 4;
    this.scene.add(new THREE.GridHelper(gridSize, gridSize / TILE_SIZE, 0x444444, 0x333333));

    // Axes
    this.scene.add(new THREE.AxesHelper(32));

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, w / h, 1, 10000);
    this.camera.position.set(
      0,
      INITIAL_ORBIT_DISTANCE * Math.cos(INITIAL_POLAR_ANGLE),
      INITIAL_ORBIT_DISTANCE * Math.sin(INITIAL_POLAR_ANGLE),
    );
    this.camera.lookAt(0, 0, 0);

    // Orbit controls
    this.controls = new OrbitControls(this.camera, threeCanvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;

    // Listen for window resize to keep both canvases in sync
    window.addEventListener("resize", this.onResize);

    // Trigger 2D canvas resize
    this.resizeGameCanvas();
  }

  private deactivate(): void {
    this.active = false;
    window.removeEventListener("resize", this.onResize);

    // Remove Three.js canvas
    if (this.renderer) {
      this.renderer.domElement.remove();
      this.renderer.dispose();
      this.renderer = null;
    }

    // Clear scene
    this.clearGroup(this.terrainGroup);
    this.clearGroup(this.entityGroup);
    this.clearGroup(this.propGroup);
    this.chunkMeshes.clear();
    this.scene = null;
    this.camera = null;

    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }

    // Restore 2D canvas
    this.gameCanvas.style.position = "";
    this.gameCanvas.style.left = "";
    this.gameCanvas.style.top = "";
    this.gameCanvas.style.width = "";
    this.gameCanvas.style.height = "";

    this.resizeGameCanvas();
  }

  render(
    gameCameraX: number,
    gameCameraY: number,
    entities: readonly Entity[],
    props: readonly Prop[],
    world: World,
    visible: ChunkRange,
  ): void {
    if (!this.active || !this.renderer || !this.scene || !this.camera || !this.controls) return;

    // Sync orbit target to 2D camera center
    const target = toThree(gameCameraX, gameCameraY, 0);
    this.controls.target.copy(target);
    this.controls.update();

    // Update scene contents
    this.updateTerrain(world, visible);
    this.updateEntityColliders(entities);
    this.updatePropColliders(props);

    this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    if (!this.active || !this.renderer || !this.camera) return;
    const w = Math.floor(window.innerWidth / 2);
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.deactivate();
  }

  // ── Terrain ──────────────────────────────────────────────

  private updateTerrain(world: World, visible: ChunkRange): void {
    // Track which chunk keys are currently visible
    const visibleKeys = new Set<string>();

    for (let cy = visible.minCy; cy <= visible.maxCy; cy++) {
      for (let cx = visible.minCx; cx <= visible.maxCx; cx++) {
        const key = `${cx},${cy}`;
        visibleKeys.add(key);

        const chunk = world.getChunkIfLoaded(cx, cy);
        if (!chunk) continue;

        // Skip if already cached (terrain doesn't change often; rebuild on toggle is fine)
        if (this.chunkMeshes.has(key)) continue;

        const meshes = this.buildChunkMeshes(cx, cy, chunk);
        for (const m of meshes) this.terrainGroup.add(m);
        this.chunkMeshes.set(key, meshes);
      }
    }

    // Remove meshes for chunks no longer visible
    for (const [key, meshes] of this.chunkMeshes) {
      if (!visibleKeys.has(key)) {
        for (const m of meshes) {
          this.terrainGroup.remove(m);
          m.geometry.dispose();
        }
        this.chunkMeshes.delete(key);
      }
    }
  }

  private buildChunkMeshes(
    cx: number,
    cy: number,
    chunk: { getHeight(lx: number, ly: number): number },
  ): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    const baseWx = cx * CHUNK_SIZE * TILE_SIZE;
    const baseWy = cy * CHUNK_SIZE * TILE_SIZE;

    // Ground plane for this chunk
    const groundGeo = new THREE.PlaneGeometry(CHUNK_SIZE * TILE_SIZE, CHUNK_SIZE * TILE_SIZE);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMesh = new THREE.Mesh(groundGeo, MAT_GROUND);
    const groundCenter = toThree(
      baseWx + (CHUNK_SIZE * TILE_SIZE) / 2,
      baseWy + (CHUNK_SIZE * TILE_SIZE) / 2,
      0,
    );
    groundMesh.position.copy(groundCenter);
    meshes.push(groundMesh);

    // Elevated tiles as boxes
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const h = chunk.getHeight(lx, ly);
        if (h <= 0) continue;

        const tileWx = baseWx + lx * TILE_SIZE;
        const tileWy = baseWy + ly * TILE_SIZE;
        const heightPx = h * ELEVATION_PX;

        const boxGeo = new THREE.BoxGeometry(TILE_SIZE, heightPx, TILE_SIZE);
        const boxMesh = new THREE.Mesh(boxGeo, MAT_TERRAIN_SOLID);
        const center = toThree(tileWx + TILE_SIZE / 2, tileWy + TILE_SIZE / 2, heightPx / 2);
        boxMesh.position.copy(center);
        meshes.push(boxMesh);

        // Wireframe overlay
        const wireGeo = new THREE.BoxGeometry(TILE_SIZE, heightPx, TILE_SIZE);
        const wireMesh = new THREE.Mesh(wireGeo, MAT_TERRAIN_WIRE);
        wireMesh.position.copy(center);
        meshes.push(wireMesh);
      }
    }

    return meshes;
  }

  // ── Entity colliders ─────────────────────────────────────

  private updateEntityColliders(entities: readonly Entity[]): void {
    this.clearGroup(this.entityGroup);

    for (const e of entities) {
      if (!e.collider) continue;

      const c = e.collider;
      const wx = e.position.wx + c.offsetX;
      const wy = e.position.wy + c.offsetY;
      const wz = e.wz ?? 0;
      const physH = c.physicalHeight ?? DEFAULT_PHYSICAL_HEIGHT;

      const boxGeo = new THREE.BoxGeometry(c.width, physH, c.height);
      const edges = new THREE.EdgesGeometry(boxGeo);
      const line = new THREE.LineSegments(edges, MAT_ENTITY);

      const center = toThree(wx + c.width / 2, wy + c.height / 2, wz + physH / 2);
      line.position.copy(center);
      this.entityGroup.add(line);

      boxGeo.dispose();
    }
  }

  // ── Prop colliders ───────────────────────────────────────

  private updatePropColliders(props: readonly Prop[]): void {
    this.clearGroup(this.propGroup);

    for (const p of props) {
      if (p.walls) {
        for (const w of p.walls) {
          this.addPropColliderWireframe(p.position.wx, p.position.wy, w);
        }
      } else if (p.collider) {
        this.addPropColliderWireframe(p.position.wx, p.position.wy, p.collider);
      }
    }
  }

  private addPropColliderWireframe(propWx: number, propWy: number, c: PropCollider): void {
    const wx = propWx + c.offsetX;
    const wy = propWy + c.offsetY;
    const zBase = c.zBase ?? 0;
    const zHeight = c.zHeight ?? INFINITE_WALL_HEIGHT;
    const isWalkable = c.walkableTop === true;
    const isInfinite = c.zHeight === undefined;

    const mat = isWalkable ? MAT_PROP_WALKABLE : isInfinite ? MAT_PROP_INFINITE : MAT_PROP_FINITE;

    const boxGeo = new THREE.BoxGeometry(c.width, zHeight, c.height);
    const edges = new THREE.EdgesGeometry(boxGeo);
    const line = new THREE.LineSegments(edges, mat);

    const center = toThree(wx + c.width / 2, wy + c.height / 2, zBase + zHeight / 2);
    line.position.copy(center);
    this.propGroup.add(line);

    // Draw walkable top surface as a semi-transparent plane
    if (isWalkable) {
      const planeGeo = new THREE.PlaneGeometry(c.width, c.height);
      planeGeo.rotateX(-Math.PI / 2);
      const planeMat = new THREE.MeshBasicMaterial({
        color: 0x00ccaa,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
      });
      const plane = new THREE.Mesh(planeGeo, planeMat);
      const topCenter = toThree(wx + c.width / 2, wy + c.height / 2, zBase + zHeight);
      plane.position.copy(topCenter);
      this.propGroup.add(plane);
    }

    boxGeo.dispose();
  }

  // ── Utilities ────────────────────────────────────────────

  private clearGroup(group: THREE.Group): void {
    while (group.children.length > 0) {
      const child = group.children[0]!;
      group.remove(child);
      if (child instanceof THREE.LineSegments) {
        child.geometry.dispose();
      } else if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          // Only dispose one-off materials (not shared ones)
          if (
            child.material !== MAT_TERRAIN_SOLID &&
            child.material !== MAT_TERRAIN_WIRE &&
            child.material !== MAT_GROUND
          ) {
            child.material.dispose();
          }
        }
      }
    }
  }

  private resizeGameCanvas(): void {
    // Dispatch a resize event so GameClient picks up the new canvas dimensions
    window.dispatchEvent(new Event("resize"));
  }
}
