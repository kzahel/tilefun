import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { GROUND_BLOCK_CHUNKS, GroundTops } from "./FirstPersonGround.js";
import { shadeMaterial } from "./FirstPersonMaterials.js";
import { buildTerrainChunk, CHUNK_TOP_VERTICES } from "./FirstPersonTerrain.js";

const flat = {
  getHeight: () => 0,
  getTerrain: () => 1,
  getRoad: () => 0,
  getCollision: () => 0,
};
const tops = (cx: number, cy = 0) => buildTerrainChunk(flat, cx, cy, () => 0).tops;
const mesh = (ground: GroundTops, block = 0) => ground.root.children[block] as THREE.Mesh;
const attribute = (ground: GroundTops, name: string, block = 0) =>
  mesh(ground, block).geometry.getAttribute(name) as THREE.BufferAttribute;
/** The floats of one chunk's slot. */
const slot = (ground: GroundTops, name: string, index: number, block = 0) => {
  const a = attribute(ground, name, block);
  const count = CHUNK_TOP_VERTICES * a.itemSize;
  return (a.array as Float32Array).subarray(index * count, (index + 1) * count);
};
const PAGE = { layer: 3, x: 512, y: 256, width: 256, height: 256 };
const make = () => new GroundTops(new THREE.Group(), new THREE.MeshBasicMaterial());

describe("the 3D ground (250, merged since 251)", () => {
  it("gives raised ground's textured cliffs a mesh of their own on the chunk's page", () => {
    const made: THREE.Mesh[] = [];
    const ground = new GroundTops(new THREE.Group(), new THREE.MeshBasicMaterial(), (m) =>
      made.push(m),
    );
    const raised = { ...flat, getHeight: (_lx: number, ly: number) => (ly < 4 ? 1 : 0) };
    const { tops: raisedTops, cliffs } = buildTerrainChunk(raised, 0, 0, () => 0);
    ground.set("0,0", raisedTops, cliffs);
    ground.set("1,0", tops(1), buildTerrainChunk(flat, 1, 0, () => 0).cliffs);
    // One block of tops and one cliff mesh: flat chunks have none.
    expect(ground.meshes).toBe(2);
    expect(made).toHaveLength(1);
    const cliffMesh = made[0] as THREE.Mesh;
    const page = () => [...(cliffMesh.geometry.getAttribute("groundPage").array as Float32Array)];
    expect(page().every((v) => v === -1)).toBe(true);
    ground.bind("0,0", PAGE);
    expect(page().slice(0, 3)).toEqual([512, 256, 3]);
    expect(slot(ground, "groundShade", 0).some((v) => v < 1)).toBe(true);
    // Replaced without cliffs, then removed: the mesh goes.
    ground.set("0,0", tops(0));
    expect(ground.meshes).toBe(1);
    expect(cliffMesh.parent).toBeNull();
    ground.set("0,0", raisedTops, cliffs);
    ground.delete("0,0");
    expect(ground.meshes).toBe(1);
  });

  it("starts a chunk on flat colours and follows its page", () => {
    const ground = make();
    expect(ground.meshes).toBe(0);
    ground.set("0,0", tops(0));
    expect(ground.meshes).toBe(1);
    expect(mesh(ground).geometry.drawRange.count).toBe(CHUNK_TOP_VERTICES);
    // Layer −1 keeps the vertex colour.
    expect(new Set(slot(ground, "groundPage", 0))).toEqual(new Set([-1]));
    const page = attribute(ground, "groundPage");
    const version = page.version;
    ground.bind("0,0", PAGE);
    expect([page.getX(0), page.getY(0), page.getZ(0)]).toEqual([512, 256, 3]);
    const last = CHUNK_TOP_VERTICES - 1;
    expect([page.getX(last), page.getZ(last)]).toEqual([512, 3]);
    expect(page.version).toBeGreaterThan(version); // uploaded again
    ground.bind("0,0", undefined);
    expect(new Set(slot(ground, "groundPage", 0))).toEqual(new Set([-1]));
    // A chunk the ground does not hold is ignored.
    ground.bind("9,9", PAGE);
    ground.delete("9,9");
    expect(ground.count).toBe(1);
  });

  it("gives every chunk its own slot of one mesh and uploads only that slot", () => {
    const ground = make();
    ground.set("0,0", tops(0));
    ground.set("1,0", tops(1));
    ground.bind("0,0", PAGE);
    expect(ground.count).toBe(2);
    expect(ground.meshes).toBe(1);
    expect(mesh(ground).geometry.drawRange.count).toBe(2 * CHUNK_TOP_VERTICES);
    expect(slot(ground, "position", 1)[0]).toBe(256); // the second chunk's west edge
    for (const name of ["position", "color", "groundTexel", "groundPage"])
      attribute(ground, name).clearUpdateRanges(); // as after an upload
    // The second chunk's page arrives: one slot of one attribute.
    ground.bind("1,0", { ...PAGE, layer: 5 });
    expect(attribute(ground, "groundPage").updateRanges).toEqual([
      { start: CHUNK_TOP_VERTICES * 3, count: CHUNK_TOP_VERTICES * 3 },
    ]);
    expect(attribute(ground, "position").updateRanges).toEqual([]);
    expect(slot(ground, "groundPage", 0)[2]).toBe(3);
    expect(slot(ground, "groundPage", 1)[2]).toBe(5);
    // An edited chunk keeps its slot and goes back to flat colours until bound again.
    attribute(ground, "groundPage").clearUpdateRanges();
    const edited = attribute(ground, "position").version;
    ground.set("0,0", tops(0));
    expect(attribute(ground, "position").version).toBeGreaterThan(edited);
    expect(slot(ground, "groundPage", 0)[2]).toBe(-1);
    expect(slot(ground, "groundPage", 1)[2]).toBe(5);
    expect(attribute(ground, "position").updateRanges).toEqual([
      { start: 0, count: CHUNK_TOP_VERTICES * 3 },
    ]);
  });

  it("draws nothing for a chunk that left and gives its slot to the next one", () => {
    const ground = make();
    for (let cx = 0; cx < 3; cx++) ground.set(`${cx},0`, tops(cx));
    const position = attribute(ground, "position");
    position.clearUpdateRanges();
    const version = position.version;
    ground.delete("1,0");
    expect(ground.count).toBe(2);
    // The emptied slot, and only it, is uploaded.
    expect(position.version).toBeGreaterThan(version);
    expect(position.updateRanges).toEqual([
      { start: CHUNK_TOP_VERTICES * 3, count: CHUNK_TOP_VERTICES * 3 },
    ]);
    // Every corner in one place: no triangle has area.
    expect(new Set(slot(ground, "position", 1))).toEqual(new Set([0]));
    expect(mesh(ground).geometry.drawRange.count).toBe(3 * CHUNK_TOP_VERTICES);
    ground.set("7,0", tops(7));
    expect(slot(ground, "position", 1)[0]).toBe(7 * 256);
    // The last slot leaving shortens the draw; the last chunk leaving frees the mesh.
    ground.delete("2,0");
    expect(mesh(ground).geometry.drawRange.count).toBe(2 * CHUNK_TOP_VERTICES);
    ground.delete("0,0");
    ground.delete("7,0");
    expect(ground.meshes).toBe(0);
  });

  it("adds a mesh when its slots run out, without touching the full one", () => {
    const ground = make();
    for (let cx = 0; cx < GROUND_BLOCK_CHUNKS; cx++) ground.set(`${cx},0`, tops(cx));
    expect(ground.meshes).toBe(1);
    const first = mesh(ground).geometry;
    for (const name of ["position", "color", "groundTexel", "groundPage"])
      attribute(ground, name).clearUpdateRanges();
    const version = attribute(ground, "position").version;
    ground.set("99,0", tops(99));
    expect(ground.meshes).toBe(2);
    expect(mesh(ground).geometry).toBe(first);
    expect(attribute(ground, "position").version).toBe(version); // nothing uploaded again
    expect(attribute(ground, "position").updateRanges).toEqual([]);
    expect(slot(ground, "position", 0, 1)[0]).toBe(99 * 256);
    expect(mesh(ground, 1).geometry.drawRange.count).toBe(CHUNK_TOP_VERTICES);
    ground.bind("99,0", PAGE);
    expect(slot(ground, "groundPage", 0, 1)[2]).toBe(3);
    // A gap in the first mesh is filled before the second grows.
    ground.delete("5,0");
    ground.set("100,0", tops(100));
    expect(slot(ground, "position", 5)[0]).toBe(100 * 256);
    // The second mesh goes when its last chunk does; a later chunk makes a new one.
    ground.delete("99,0");
    expect(ground.meshes).toBe(1);
    ground.set("101,0", tops(101));
    expect(ground.meshes).toBe(2);
    expect(ground.count).toBe(GROUND_BLOCK_CHUNKS + 1);
    ground.dispose();
    expect(ground.meshes).toBe(0);
    expect(ground.count).toBe(0);
  });

  it("refuses tops that are not one textured quad per tile", () => {
    const ground = make();
    const { positions, colors } = tops(0);
    expect(() => ground.set("0,0", { positions, colors })).toThrow();
    expect(() => ground.set("0,0", { ...tops(0), positions: positions.subarray(0, 18) })).toThrow();
    expect(ground.count).toBe(0);
  });

  it("edits the built-in shader where its anchors still exist", () => {
    // The shading is spliced into three.js's own shader text. A three.js upgrade
    // that renames an anchor would otherwise silently draw flat ground.
    const atlas = { value: null };
    const material = shadeMaterial(new THREE.MeshBasicMaterial({ vertexColors: true }), {
      ground: atlas,
    });
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: THREE.ShaderLib.basic.vertexShader,
      fragmentShader: THREE.ShaderLib.basic.fragmentShader,
    };
    material.onBeforeCompile(
      shader as unknown as THREE.WebGLProgramParametersWithUniforms,
      undefined as unknown as THREE.WebGLRenderer,
    );
    expect(shader.uniforms.groundAtlas).toBe(atlas);
    expect(shader.vertexShader).toContain("attribute vec3 groundPage;");
    expect(shader.vertexShader).toContain("vGroundPage = groundPage;");
    expect(shader.fragmentShader).toContain("uniform highp sampler2DArray groundAtlas;");
    expect(shader.fragmentShader).toContain("diffuseColor.rgb = groundArt(groundDx, groundDy);");
    // Derivatives are taken before the branch, and lookups name their level.
    expect(shader.fragmentShader.indexOf("dFdx(vGroundTexel)")).toBeLessThan(
      shader.fragmentShader.indexOf("if (vGroundPage.z"),
    );
    expect(shader.fragmentShader).not.toContain("texture(groundAtlas");
    // The decode it calls is three.js's own, declared in every fragment prefix.
    expect(THREE.ShaderChunk.colorspace_pars_fragment).toContain("vec4 sRGBTransferEOTF(");
    // Offsets are float literals: GLSL ES has no implicit int conversion.
    expect(shader.fragmentShader).not.toMatch(/[^.\d]\d+ \* d[xy]/);
    // A different program from the plain flat material's.
    expect(material.customProgramCacheKey()).toContain("ground");
  });
});
