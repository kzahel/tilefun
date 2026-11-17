import * as THREE from "three";
import { deckOpacity } from "./FirstPersonDeckFade.js";
import type { OverheadDeck } from "./FirstPersonPropMeshes.js";
import type { FirstPersonFrame } from "./FirstPersonView.js";

/** A deck and its precomposed grid share one opacity and depth ownership. */
export class DeckMaterials {
  readonly materials = new Map<
    string,
    { face: THREE.MeshBasicMaterial; grid: THREE.LineBasicMaterial }
  >();
  constructor(
    private readonly shade: (material: THREE.MeshBasicMaterial) => THREE.MeshBasicMaterial,
  ) {}
  get(id: string) {
    let pair = this.materials.get(id);
    if (!pair) {
      pair = {
        face: this.shade(
          new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
        ),
        grid: new THREE.LineBasicMaterial({
          vertexColors: true,
          depthWrite: true,
          toneMapped: false,
        }),
      };
      this.materials.set(id, pair);
    }
    return pair;
  }
  update(
    chunks: Iterable<{ props?: { decks: readonly OverheadDeck[] } }>,
    cutaway: FirstPersonFrame["cutaway"],
    root: THREE.Group,
  ) {
    const live = new Set<string>();
    const orders = new Map<THREE.Material, number>();
    for (const chunk of chunks)
      for (const deck of chunk.props?.decks ?? []) {
        live.add(deck.id);
        const pair = this.get(deck.id);
        const opacity = deckOpacity(deck, cutaway);
        for (const material of [pair.face, pair.grid]) {
          material.visible = opacity > 0;
          if (material.transparent !== opacity < 1) {
            material.transparent = opacity < 1;
            material.needsUpdate = true;
          }
          material.opacity = opacity;
        }
        // The grid has the finished line colour, writes depth first, and prevents
        // the slab behind it blending a second time. Both follow actors/effects.
        orders.set(pair.grid, 3);
        orders.set(pair.face, 4);
      }
    for (const [id, pair] of this.materials)
      if (!live.has(id)) {
        pair.face.dispose();
        pair.grid.dispose();
        this.materials.delete(id);
      }
    for (const child of root.children)
      if (
        (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) &&
        !Array.isArray(child.material)
      )
        child.renderOrder = orders.get(child.material) ?? 0;
  }
  dispose() {
    for (const pair of this.materials.values()) {
      pair.face.dispose();
      pair.grid.dispose();
    }
    this.materials.clear();
  }
}
