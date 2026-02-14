import { describe, expect, it, vi } from "vitest";
import type { GameContext, GameScene } from "./GameScene.js";
import { SceneManager } from "./SceneManager.js";

/** Create a mock GameContext (only the SceneManager needs it for routing). */
function mockCtx(scenes: SceneManager): GameContext {
  return { scenes } as unknown as GameContext;
}

/** Create a spy-able scene with configurable transparency. */
function mockScene(transparent = false) {
  return {
    transparent,
    onEnter: vi.fn<(ctx: GameContext) => void>(),
    onExit: vi.fn<(ctx: GameContext) => void>(),
    onResume: vi.fn<(ctx: GameContext) => void>(),
    onPause: vi.fn<(ctx: GameContext) => void>(),
    update: vi.fn<(dt: number, ctx: GameContext) => void>(),
    render: vi.fn<(alpha: number, ctx: GameContext) => void>(),
  } satisfies GameScene;
}

describe("SceneManager", () => {
  it("throws if context not set", () => {
    const sm = new SceneManager();
    const scene = mockScene();
    expect(() => sm.push(scene)).toThrow("context not set");
  });

  it("push calls onEnter on the new scene", () => {
    const sm = new SceneManager();
    sm.setContext(mockCtx(sm));
    const scene = mockScene();
    sm.push(scene);
    expect(scene.onEnter).toHaveBeenCalledOnce();
    expect(sm.current).toBe(scene);
    expect(sm.size).toBe(1);
  });

  it("push calls onPause on the previous top scene", () => {
    const sm = new SceneManager();
    sm.setContext(mockCtx(sm));
    const a = mockScene();
    const b = mockScene();
    sm.push(a);
    sm.push(b);
    expect(a.onPause).toHaveBeenCalledOnce();
    expect(b.onEnter).toHaveBeenCalledOnce();
    expect(sm.current).toBe(b);
    expect(sm.size).toBe(2);
  });

  it("pop calls onExit on top and onResume on the scene below", () => {
    const sm = new SceneManager();
    sm.setContext(mockCtx(sm));
    const a = mockScene();
    const b = mockScene();
    sm.push(a);
    sm.push(b);
    const popped = sm.pop();
    expect(popped).toBe(b);
    expect(b.onExit).toHaveBeenCalledOnce();
    expect(a.onResume).toHaveBeenCalledOnce();
    expect(sm.current).toBe(a);
    expect(sm.size).toBe(1);
  });

  it("pop on empty stack returns undefined", () => {
    const sm = new SceneManager();
    sm.setContext(mockCtx(sm));
    expect(sm.pop()).toBeUndefined();
  });

  it("replace swaps top scene without onResume on scenes below", () => {
    const sm = new SceneManager();
    sm.setContext(mockCtx(sm));
    const a = mockScene();
    const b = mockScene();
    const c = mockScene();
    sm.push(a);
    sm.push(b);
    sm.replace(c);
    expect(b.onExit).toHaveBeenCalledOnce();
    expect(c.onEnter).toHaveBeenCalledOnce();
    // a should NOT get onResume — replace doesn't expose it
    expect(a.onResume).not.toHaveBeenCalled();
    expect(sm.current).toBe(c);
    expect(sm.size).toBe(2);
  });

  it("clear exits all scenes top-down", () => {
    const sm = new SceneManager();
    sm.setContext(mockCtx(sm));
    const a = mockScene();
    const b = mockScene();
    sm.push(a);
    sm.push(b);
    sm.clear();
    expect(b.onExit).toHaveBeenCalledOnce();
    expect(a.onExit).toHaveBeenCalledOnce();
    expect(sm.size).toBe(0);
    expect(sm.current).toBeNull();
  });

  it("update only calls the top scene", () => {
    const sm = new SceneManager();
    sm.setContext(mockCtx(sm));
    const a = mockScene();
    const b = mockScene(true); // transparent overlay
    sm.push(a);
    sm.push(b);
    sm.update(0.016);
    expect(a.update).not.toHaveBeenCalled();
    expect(b.update).toHaveBeenCalledOnce();
  });

  it("render walks down through transparent scenes", () => {
    const sm = new SceneManager();
    const ctx = mockCtx(sm);
    sm.setContext(ctx);
    const a = mockScene(false); // opaque
    const b = mockScene(true); // transparent overlay
    sm.push(a);
    sm.push(b);
    sm.render(0.5);
    // Both should render (b is transparent, so a renders too)
    expect(a.render).toHaveBeenCalledOnce();
    expect(b.render).toHaveBeenCalledOnce();
    // a renders before b (bottom-up)
    const aOrder = a.render.mock.invocationCallOrder[0] ?? 0;
    const bOrder = b.render.mock.invocationCallOrder[0] ?? 0;
    expect(aOrder).toBeLessThan(bOrder);
  });

  it("render stops at the first opaque scene", () => {
    const sm = new SceneManager();
    sm.setContext(mockCtx(sm));
    const a = mockScene(false); // opaque — bottom
    const b = mockScene(false); // opaque — top
    sm.push(a);
    sm.push(b);
    sm.render(0.5);
    expect(a.render).not.toHaveBeenCalled();
    expect(b.render).toHaveBeenCalledOnce();
  });

  it("render handles multiple transparent layers", () => {
    const sm = new SceneManager();
    sm.setContext(mockCtx(sm));
    const a = mockScene(false); // opaque base
    const b = mockScene(true); // transparent overlay 1
    const c = mockScene(true); // transparent overlay 2
    sm.push(a);
    sm.push(b);
    sm.push(c);
    sm.render(0.5);
    expect(a.render).toHaveBeenCalledOnce();
    expect(b.render).toHaveBeenCalledOnce();
    expect(c.render).toHaveBeenCalledOnce();
  });

  it("has() checks for scene type on the stack", () => {
    class MyScene implements GameScene {
      readonly transparent = false;
      onEnter = vi.fn();
      onExit = vi.fn();
      onResume = vi.fn();
      onPause = vi.fn();
      update = vi.fn();
      render = vi.fn();
    }
    const sm = new SceneManager();
    sm.setContext(mockCtx(sm));
    const scene = new MyScene();
    expect(sm.has(MyScene)).toBe(false);
    sm.push(scene);
    expect(sm.has(MyScene)).toBe(true);
  });

  it("render with empty stack does nothing", () => {
    const sm = new SceneManager();
    sm.setContext(mockCtx(sm));
    // Should not throw
    sm.render(0.5);
    sm.update(0.016);
  });
});
