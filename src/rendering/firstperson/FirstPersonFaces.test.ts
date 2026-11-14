import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { type FacePart, MergedFaces } from "./FirstPersonFaces.js";

const material = new THREE.MeshBasicMaterial();
const parent = new THREE.Group();
/** `triangles` triangles whose every coordinate is `value`. */
const part = (bucket: unknown, triangles: number, value: number, textured = false): FacePart => ({
  bucket,
  material,
  parent,
  positions: new Array(triangles * 9).fill(value),
  colors: new Array(triangles * 9).fill(value / 10),
  uvs: textured ? new Array(triangles * 6).fill(value / 100) : undefined,
});
const vertices = (mesh: THREE.Object3D | undefined) =>
  (mesh as THREE.Mesh).geometry.getAttribute("position").count;

describe("merged static faces (251)", () => {
  it("draws every owner's part of a bucket as one mesh", () => {
    const faces = new MergedFaces();
    const root = new THREE.Group();
    faces.replace("0,0:props", [{ ...part("flat:0,0", 2, 1), parent: root }]);
    faces.replace("1,0:props", [{ ...part("flat:0,0", 1, 2), parent: root }]);
    expect(faces.flush()).toBe(9);
    expect(faces.count).toBe(1);
    expect(root.children).toHaveLength(1);
    const mesh = root.children[0] as THREE.Mesh;
    expect(mesh.material).toBe(material);
    expect(Array.from(mesh.geometry.getAttribute("position").array)).toEqual([
      ...new Array(18).fill(1),
      ...new Array(9).fill(2),
    ]);
    expect(mesh.geometry.getAttribute("color").getX(6)).toBeCloseTo(0.2, 6);
    expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
    expect(mesh.geometry.boundingSphere).not.toBeNull();
    // Nothing changed: nothing is put together again.
    expect(faces.flush()).toBe(0);
  });

  it("puts together only the buckets an owner touched", () => {
    const faces = new MergedFaces();
    const oak = new THREE.Texture(),
      shop = new THREE.Texture();
    faces.replace("0,0:props", [part(oak, 1, 1, true), part("flat:0,0", 1, 1)]);
    faces.replace("5,5:props", [part(shop, 4, 2, true), part("flat:1,1", 2, 2)]);
    faces.flush();
    expect(faces.count).toBe(4);
    const made: THREE.Mesh[] = [];
    // One chunk's props change: its artwork and its area, nobody else's.
    faces.replace("0,0:props", [part(oak, 2, 3, true), part("flat:0,0", 1, 3)]);
    expect(faces.flush((mesh) => made.push(mesh))).toBe(9);
    expect(made).toHaveLength(2);
    expect(made.map(vertices).sort()).toEqual([3, 6]);
    expect(made.find((mesh) => vertices(mesh) === 6)?.geometry.getAttribute("uv").count).toBe(6);
  });

  it("merges the same artwork across chunks, and drops a bucket nobody is in", () => {
    const faces = new MergedFaces();
    const root = new THREE.Group();
    const shop = new THREE.Texture();
    for (const owner of ["0,0:props", "9,9:props"])
      faces.replace(owner, [{ ...part(shop, 2, 1, true), parent: root }]);
    faces.flush();
    expect(root.children).toHaveLength(1);
    expect(vertices(root.children[0])).toBe(12);
    faces.remove("0,0:props");
    faces.flush();
    expect(vertices(root.children[0])).toBe(6);
    // An owner whose new props have no faces leaves its buckets too.
    faces.replace("9,9:props", [part(shop, 0, 0, true)]);
    faces.flush();
    expect(root.children).toHaveLength(0);
    expect(faces.count).toBe(0);
    faces.remove("never there");
  });

  it("keeps one mesh object per bucket across rebuilds and frees everything on dispose", () => {
    const faces = new MergedFaces();
    const root = new THREE.Group();
    faces.replace("a", [{ ...part("walls:0,0", 1, 1), parent: root }]);
    faces.flush();
    const mesh = root.children[0] as THREE.Mesh;
    const first = mesh.geometry;
    faces.replace("b", [{ ...part("walls:0,0", 1, 2), parent: root }]);
    faces.flush();
    expect(root.children[0]).toBe(mesh);
    expect(mesh.geometry).not.toBe(first);
    faces.dispose();
    expect(root.children).toHaveLength(0);
    expect(faces.count).toBe(0);
  });
});
