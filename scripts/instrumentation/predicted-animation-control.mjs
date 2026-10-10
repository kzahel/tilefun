// Browser diagnostic prototype only; production PlayerPredictor stays unchanged.
export function predictedAnimationControl(code) {
  // The production clock supersedes this characterization prototype.
  if (code.includes("function predictionSprite(")) return code;
  const replace = (before, after) => {
    if (!code.includes(before)) throw Error("Predicted animation control source anchor changed");
    code = code.replace(before, after);
  };
  code = `import { tickSpriteAnimation } from "../entities/spriteAnimation.js";\n${code}`;
  replace(
    "this.applyInput(movement, dt, world, props, entities, this.physics());",
    "this.applyInput(movement, dt, world, props, entities, this.physics());\n    tickSpriteAnimation(this.predicted, dt);\n    if (this.predictedMount) tickSpriteAnimation(this.predictedMount, dt);",
  );
  // Replays apply movement, but never advance this local presentation clock again.
  replace(
    "const predMoving = this.predicted.sprite?.moving;",
    "const localSprite = this.predicted.sprite;\n    const predMoving = this.predicted.sprite?.moving;",
  );
  replace(
    "this.predicted.sprite = serverPlayer.sprite ? { ...serverPlayer.sprite } : null;",
    "this.predicted.sprite = __preserveLocalPhase(localSprite, serverPlayer.sprite);",
  );
  replace(
    "this.predictedMount.sprite = serverMount.sprite ? { ...serverMount.sprite } : null;",
    "this.predictedMount.sprite = __preserveLocalPhase(this.predictedMount.sprite, serverMount.sprite);",
  );
  return `${code}\nfunction __preserveLocalPhase(local, authoritative) {
    if (!authoritative) return null;
    const sprite = {...authoritative};
    if (local && local.sheetKey === sprite.sheetKey && local.frameCount === sprite.frameCount && local.clip === sprite.clip) {
      sprite.animTimer = local.animTimer;
      sprite.frameCol = local.frameCol;
    }
    return sprite;
  }`;
}
