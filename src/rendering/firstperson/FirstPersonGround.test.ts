import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { bindGroundPage, groundMesh } from "./FirstPersonGround.js";
import { shadeMaterial } from "./FirstPersonMaterials.js";
import { buildTerrainChunk } from "./FirstPersonTerrain.js";

const flat = {
  getHeight: () => 0,
  getTerrain: () => 1,
  getRoad: () => 0,
  getCollision: () => 0,
};

describe("first-person ground pages (250)", () => {
  it("starts on flat colours and follows its chunk's page", () => {
    const mesh = groundMesh(
      buildTerrainChunk(flat, 0, 0, () => 0),
      new THREE.MeshBasicMaterial(),
    );
    const page = mesh.geometry.getAttribute("groundPage") as THREE.BufferAttribute;
    const texel = mesh.geometry.getAttribute("groundTexel");
    expect(page.count).toBe(mesh.geometry.getAttribute("position").count);
    expect(texel.count).toBe(page.count);
    // Layer −1 keeps the vertex colour.
    expect(new Set(page.array)).toEqual(new Set([-1]));
    const version = page.version;
    bindGroundPage(mesh, { layer: 3, x: 512, y: 256, width: 256, height: 256 });
    expect([page.getX(0), page.getY(0), page.getZ(0)]).toEqual([512, 256, 3]);
    expect([page.getX(page.count - 1), page.getZ(page.count - 1)]).toEqual([512, 3]);
    expect(page.version).toBeGreaterThan(version); // uploaded again
    bindGroundPage(mesh, undefined);
    expect(new Set(page.array)).toEqual(new Set([-1]));
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
