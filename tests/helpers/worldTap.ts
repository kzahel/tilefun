import type { Page } from "@playwright/test";

/** A native short tap without a protocol round trip while the finger is held. */
export async function worldTap(page: Page, x: number, y: number): Promise<void> {
  const session = await page.context().newCDPSession(page);
  try {
    // CDP preserves command order on this session. Queue both events before
    // awaiting either, avoiding protocol latency during the held contact.
    await Promise.all([
      session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y, id: 1 }],
      }),
      session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }),
    ]);
  } finally {
    await session.detach();
  }
}
