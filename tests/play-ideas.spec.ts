import { expect, type Page, test } from "@playwright/test";

test.use({ channel: "chromium" });

// Exercise the real dialog with a deterministic browser speech provider. No microphone/network STT in CI.
async function speechDouble(
  page: Page,
  options: { unsupported?: boolean; denied?: boolean; delayed?: boolean } = {},
) {
  await page.addInitScript((options) => {
    const state = {
      starts: 0,
      stops: 0,
      aborts: 0,
      tracksStopped: 0,
      spoken: [] as string[],
      text: "I want to go inside the tent",
      error: "",
      interimOnly: false,
      delayed: !!options.delayed,
    };
    const w = window as unknown as Record<string, unknown>;
    w.ideaTest = state;
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { speak: (u: { text: string }) => state.spoken.push(u.text), cancel: () => {} },
    });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        if (options.denied) throw new Error("Permission denied");
        return {
          getTracks: () => [
            {
              stop: () => {
                state.tracksStopped++;
              },
            },
          ],
        };
      },
    });
    class Recognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onaudiostart?: () => void;
      onend?: () => void;
      onerror?: (event: { error: string }) => void;
      onresult?: (event: { results: { isFinal: boolean; 0: { transcript: string } }[] }) => void;
      start() {
        state.starts++;
        w.ideaRecognition = this;
        if (!state.delayed) setTimeout(() => this.onaudiostart?.(), 20);
      }
      stop() {
        state.stops++;
        setTimeout(() => {
          if (state.error) this.onerror?.({ error: state.error });
          else
            this.onresult?.({
              results: [{ isFinal: !state.interimOnly, 0: { transcript: state.text } }],
            });
          this.onend?.();
        }, 80);
      }
      abort() {
        state.aborts++;
        setTimeout(() => this.onend?.(), 5);
      }
    }
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: options.unsupported ? undefined : Recognition,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      configurable: true,
      value: undefined,
    });
  }, options);
}
async function openIdea(page: Page) {
  await page.goto("/tilefun/");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  // Enter a small real world so the attachment is a rendered game, not a menu.
  await page.evaluate(async () => {
    const game = (
      document.querySelector("#game") as unknown as {
        __game: {
          gcSendRequest(message: unknown): Promise<{ meta: { id: string } }>;
          nextRequestId: number;
        };
      }
    ).__game;
    const generation = { type: "flat", version: "flat-v1", seed: 42, preset: "grass" };
    const created = await game.gcSendRequest({
      type: "create-world",
      requestId: game.nextRequestId++,
      name: "Idea test",
      generation,
    });
    await game.gcSendRequest({
      type: "join-realm",
      requestId: game.nextRequestId++,
      worldId: created.meta.id,
      arrival: { x: 40, y: 60, generation },
    });
  });
  await page.getByTestId("main-menu-toggle").click();
  await page.getByRole("button", { name: "💡 Idea", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "💡 Idea" })).toBeVisible();
}
async function record(page: Page) {
  await page.getByRole("button", { name: "Enable microphone" }).click();
  const mic = page.getByRole("button", { name: "Hold to speak" });
  const box = await mic.boundingBox();
  if (!box) throw new Error("Missing microphone");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.locator(".idea-status")).toContainText("Listening");
  await expect(page.getByRole("button", { name: "📨 Send", exact: true })).toBeHidden();
  // Drift outside the control while holding: pointer capture must keep ownership.
  await page.mouse.move(box.x - 5, box.y - 5);
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Listen to your idea" })).toContainText(
    "inside the tent",
  );
}

test("anonymous hold, exact readback, screenshot submission and private Workshop management", async ({
  page,
  browser,
}) => {
  await page.context().clearCookies();
  await speechDouble(page);
  await openIdea(page);
  const picture = await page.locator(".idea-picture").getAttribute("src");
  expect(picture).toMatch(/^data:image\/png;base64,/);
  await record(page);
  await page.getByRole("button", { name: "Listen to your idea" }).click();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { ideaTest: { spoken: string[]; tracksStopped: number } }).ideaTest,
    ),
  ).toMatchObject({
    tracksStopped: 1,
    spoken: expect.arrayContaining(["I want to go inside the tent"]),
  });
  const requestPromise = page.waitForRequest(
    (r) => r.url().endsWith("/api/play-ideas") && r.method() === "POST",
  );
  await page.getByRole("button", { name: "📨 Send", exact: true }).click();
  const request = await requestPromise;
  const payload = request.postDataJSON();
  expect(Object.keys(payload).sort()).toEqual(["context", "id", "language", "screenshot", "text"]);
  expect(payload.screenshot).toBe(picture);
  expect(payload.context.worldId).toBeTruthy();
  expect(payload.context.generation).toContain("flat-v1");
  await expect(page.locator(".idea-toast")).toContainText("was sent");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await page.request.get("/tilefun/api/play-ideas")).status()).toBe(401);
  expect((await page.request.get(`/tilefun/api/play-ideas/${payload.id}`)).status()).toBe(401);
  const owner = await browser.newContext({ storageState: "test-results/workshop-session.json" });
  try {
    const review = await owner.newPage();
    await review.goto("/tilefun/workshop.html#/play-ideas");
    await expect(review.getByRole("heading", { name: "Play ideas", exact: true })).toBeVisible();
    await review
      .getByRole("button", { name: /New · I want to go inside the tent/ })
      .first()
      .click();
    await expect(review.getByAltText("Game view attached to this idea")).toHaveAttribute(
      "src",
      picture ?? "",
    );
    await review.getByLabel("Idea status").selectOption("planned");
    await expect(review.getByLabel("Idea status")).toHaveValue("planned");
    await review.getByRole("button", { name: "Delete idea", exact: true }).click();
    await review.getByRole("button", { name: "Delete permanently" }).click();
    await expect(review.getByText("Idea deleted.", { exact: true })).toBeVisible();
  } finally {
    await owner.close();
  }
});

test("keeps offline submissions across reload and retries with the same ID", async ({ page }) => {
  await speechDouble(page, { unsupported: true });
  await openIdea(page);
  await page.getByLabel("Type your idea").fill("Let me pick flowers");
  let queuedId = "";
  await page.route("**/api/play-ideas", (route) => {
    queuedId = route.request().postDataJSON().id;
    return route.abort("internetdisconnected");
  });
  await page.getByRole("button", { name: "📨 Send", exact: true }).click();
  await expect(page.locator(".idea-toast")).toContainText("Saved on this device");
  await page.reload();
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("main-menu-toggle").click();
  await page.getByRole("button", { name: "💡 Idea", exact: true }).click();
  await expect(page.locator(".idea-pending")).toContainText("1 idea(s)");
  await page.unroute("**/api/play-ideas");
  const requestPromise = page.waitForRequest(
    (r) => r.url().endsWith("/api/play-ideas") && r.method() === "POST",
  );
  await page.getByRole("button", { name: "Retry sending saved ideas" }).click();
  const payload = (await requestPromise).postDataJSON();
  await expect(page.locator(".idea-pending")).toBeEmpty();
  expect(payload.text).toBe("Let me pick flowers");
  expect(payload.id).toBe(queuedId);
});

test("cancel, focus loss, recognition errors and interim results never submit unfinished words", async ({
  page,
}) => {
  await speechDouble(page);
  await openIdea(page);
  await page.getByRole("button", { name: "Enable microphone" }).click();
  const mic = page.getByRole("button", { name: "Hold to speak" });
  await mic.focus();
  await page.keyboard.down("Space");
  await expect(page.locator(".idea-status")).toContainText("Listening");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.keyboard.up("Space");
  await expect(page.getByRole("button", { name: "📨 Send", exact: true })).toBeHidden();
  await page.evaluate(() => {
    (window as unknown as { ideaTest: { interimOnly: boolean } }).ideaTest.interimOnly = true;
  });
  await mic.focus();
  await page.keyboard.down("Space");
  await expect(page.locator(".idea-status")).toContainText("Listening");
  await page.keyboard.up("Space");
  await expect(page.locator(".idea-status")).toContainText("didn't catch");
  await expect(page.getByRole("button", { name: "📨 Send", exact: true })).toBeHidden();
  await page.evaluate(() => {
    (window as unknown as { ideaTest: { error: string } }).ideaTest.error = "network";
  });
  await mic.focus();
  await page.keyboard.down("Space");
  await expect(page.locator(".idea-status")).toContainText("Listening");
  await page.keyboard.up("Space");
  await expect(page.locator(".idea-status")).toContainText("couldn't hear");
  await mic.focus();
  await page.keyboard.down("Space");
  await page.keyboard.press("Escape");
  await page.keyboard.up("Space");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("permission denial leaves typing usable and draft restores without triggering game shortcuts", async ({
  page,
}) => {
  await speechDouble(page, { denied: true });
  await openIdea(page);
  await page.getByRole("button", { name: "Enable microphone" }).click();
  await expect(page.locator(".idea-status")).toContainText("wasn't allowed");
  await page.getByText("Language & typing", { exact: true }).click();
  await page.getByLabel("Type your idea").fill("G for garden, Tab, and a tent");
  await page.getByRole("button", { name: "Back to game" }).click();
  await page.getByTestId("main-menu-toggle").click();
  await page.getByRole("button", { name: "💡 Idea", exact: true }).click();
  await expect(page.getByRole("button", { name: "Listen to your idea" })).toContainText(
    "G for garden",
  );
  await expect(page.locator(".idea-picture")).toBeVisible();
});

test("releasing before the microphone starts aborts and ignores late audio events", async ({
  page,
}) => {
  await speechDouble(page, { delayed: true });
  await openIdea(page);
  await page.getByRole("button", { name: "Enable microphone" }).click();
  const mic = page.getByRole("button", { name: "Hold to speak" });
  await mic.focus();
  await page.keyboard.down("Space");
  await expect(page.locator(".idea-status")).toContainText("Getting ready");
  await page.keyboard.up("Space");
  await expect(page.locator(".idea-status")).toContainText("Hold until");
  await page.evaluate(() => {
    (
      window as unknown as { ideaRecognition: { onaudiostart: () => void } }
    ).ideaRecognition.onaudiostart();
  });
  await expect(page.getByRole("button", { name: "📨 Send", exact: true })).toBeHidden();
  expect(
    await page.evaluate(
      () => (window as unknown as { ideaTest: { aborts: number } }).ideaTest.aborts,
    ),
  ).toBe(1);
});

test("sends directly if idea storage is unavailable, retaining the draft if the network also fails", async ({
  page,
}) => {
  await speechDouble(page, { unsupported: true });
  await page.addInitScript(() => {
    const original = indexedDB.open.bind(indexedDB);
    indexedDB.open = (name, version) => {
      if (name === "tilefun-play-ideas-v1")
        throw new DOMException("Storage denied", "SecurityError");
      return original(name, version);
    };
  });
  await openIdea(page);
  await page.getByLabel("Type your idea").fill("More butterflies please");
  await page.route("**/api/play-ideas", (route) => route.abort());
  await page.getByRole("button", { name: "📨 Send", exact: true }).click();
  await expect(page.locator(".idea-status")).toContainText("Keep this page open");
  await expect(page.getByRole("button", { name: "Listen to your idea" })).toContainText(
    "More butterflies",
  );
  await page.unroute("**/api/play-ideas");
  await page.getByRole("button", { name: "📨 Send", exact: true }).click();
  await expect(page.locator(".idea-toast")).toContainText("was sent");
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test.describe(`idea touch ${viewport.width}`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });
    test("large controls fit and touch hold ends on release", async ({ page }, testInfo) => {
      await speechDouble(page);
      await openIdea(page);
      await page.getByRole("button", { name: "Enable microphone" }).tap();
      // First real touch enters fullscreen after the dialog opened. It must stay
      // above the fullscreen root, not merely remain present in the DOM.
      await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
      await expect
        .poll(() =>
          page.locator(".idea-mic").evaluate((el) => {
            const r = el.getBoundingClientRect();
            return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          }),
        )
        .toBe(true);
      const mic = page.getByRole("button", { name: "Hold to speak" });
      const box = await mic.boundingBox();
      if (!box) throw new Error("Missing microphone");
      expect(box.width).toBeGreaterThan(250);
      const session = await page.context().newCDPSession(page);
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
      });
      await expect(page.locator(".idea-status")).toContainText("Listening");
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect(page.getByRole("button", { name: "Listen to your idea" })).toContainText(
        "inside the tent",
      );
      expect(
        await page.locator(".idea-dialog").evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      const sendBounds = await page
        .getByRole("button", { name: "📨 Send", exact: true })
        .boundingBox();
      expect(sendBounds).not.toBeNull();
      expect((sendBounds?.y ?? 0) + (sendBounds?.height ?? 0)).toBeLessThanOrEqual(viewport.height);
      await page.screenshot({ path: testInfo.outputPath("idea-dialog.png") });
      await session.detach();
    });
  });
}
