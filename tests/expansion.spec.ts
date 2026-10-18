import { test, expect } from "@playwright/test";
import { createGuidanceController } from "../src/guidanceController";
test("custom routines save, reload, edit, run and delete", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("tab", { name: "My routines" }).click();
  await page.getByRole("button", { name: "Create a routine" }).click();
  await page.getByRole("button", { name: "Save routine", exact: true }).click();
  await expect(page.getByText("Give your routine a name.")).toBeVisible();
  await page.getByLabel("Routine name").fill("A small reset");
  await page.getByRole("button", { name: "Add a move" }).click();
  await page.getByLabel("Search moves").fill("Tree");
  await page
    .getByRole("button", { name: "Add Low tree left", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add Low tree right", exact: true })
    .click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/expansion/move-picker.png" });
  await page.getByRole("button", { name: "Close move library" }).click();
  await page
    .getByRole("button", { name: "Move 2 earlier", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Lengthen move 1", exact: true })
    .click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/expansion/builder.png" });
  await page.getByRole("button", { name: "Save routine", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: /A small reset/ }),
  ).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("verdant.library.v1")!),
  );
  expect(saved.routines[0].steps[0].poseId).toContain("right");
  expect(saved.routines[0].steps[0].seconds).toBe(60);
  await page.reload();
  await page.getByRole("tab", { name: "My routines" }).click();
  await page.getByRole("radio", { name: /A small reset/ }).click();
  await page.getByRole("button", { name: "Edit routine", exact: true }).click();
  await page.getByLabel("Routine name").fill("My balance");
  await page.getByRole("button", { name: "Save routine", exact: true }).click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/expansion/my-routines.png" });
  await page.getByRole("button", { name: "Start yoga" }).click();
  await page.getByRole("button", { name: "Pause practice" }).click();
  await expect(page.getByText("RIGHT SIDE", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuemax",
    "105",
  );
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/expansion/custom-practice.png" });
  await page.getByRole("button", { name: "Skip to next pose" }).click();
  await expect(page.getByText("LEFT SIDE", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Finish practice" }).click();
  await expect(
    page.getByText("PRACTICE COMPLETE", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to your practice" }).click();
  await page
    .getByRole("button", { name: "Delete routine", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete saved routine", exact: true })
    .click();
  await expect(page.getByRole("radio", { name: /My balance/ })).toHaveCount(0);
  await page.reload();
  await page.getByRole("tab", { name: "My routines" }).click();
  await expect(page.getByRole("radio")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("settings persist and switching audio releases old recording", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__audios = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.loop && !(window as any).__audios.includes(this))
        (window as any).__audios.push(this);
      return play.call(this);
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Sound & guidance" }).click();
  await page.getByRole("radio", { name: "Forest birds", exact: true }).click();
  await page.getByRole("switch", { name: "Soft transition chime" }).uncheck();
  await page.getByRole("switch", { name: "Spoken move names" }).check();
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/expansion/settings.png" });
  await page.getByRole("button", { name: "Listen to sound" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__audios.at(-1)?.currentTime ?? 0),
    )
    .toBeGreaterThan(0.1);
  await page.getByRole("radio", { name: "Quiet stream", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__audios.length))
    .toBe(2);
  expect(await page.evaluate(() => (window as any).__audios[0].paused)).toBe(
    true,
  );
  await page.getByRole("button", { name: "Close sound settings" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Sound & guidance" }).click();
  await expect(
    page.getByRole("radio", { name: "Quiet stream" }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByRole("switch", { name: "Spoken move names" }),
  ).toBeChecked();
  await expect(
    page.getByRole("switch", { name: "Soft transition chime" }),
  ).not.toBeChecked();
  await page.getByRole("switch", { name: "Spoken move names" }).uncheck();
  // The character's look follows the switches everywhere it is drawn.
  const art = page.locator('svg[aria-label$="pose illustration"]').first();
  expect(await art.evaluate((e) => e.outerHTML)).toContain("#46705A");
  await page.getByRole("switch", { name: "Open smile" }).uncheck();
  await page.getByRole("switch", { name: "Striped tee" }).uncheck();
  await page.getByRole("switch", { name: "Hair in a bun" }).check();
  expect(await art.evaluate((e) => e.outerHTML)).not.toContain("#46705A");
  await page.getByRole("button", { name: "Close sound settings" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Sound & guidance" }).click();
  await expect(
    page.getByRole("switch", { name: "Open smile" }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("switch", { name: "Striped tee" }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("switch", { name: "Hair in a bun" }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Close sound settings" }).click();
  await page.getByRole("button", { name: "Start yoga" }).click();
  await expect(page.getByText("Quiet stream", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sound & guidance" }).click();
  await page.getByRole("button", { name: "Close sound settings" }).click();
  await expect(
    page.getByRole("button", { name: "Resume practice" }),
  ).toBeVisible();
});
test("guidance cancels stale speech, includes side, and restores ducking", async () => {
  const spoken: { text: string; options: any }[] = [];
  const states: any[] = [];
  let stopCount = 0,
    chimes = 0;
  const controller = createGuidanceController({
    stop: async () => {
      stopCount++;
    },
    voices: async () => [{ identifier: "english", language: "en-US" }],
    speak: (text, options) => {
      spoken.push({ text, options });
    },
    playChime: async () => {
      chimes++;
    },
    stopChime: () => {},
    onState: (state) => states.push(state),
  });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 10));
  const input = {
    poseKey: "1",
    text: "Tree pose, left side",
    active: true,
    chime: true,
    speech: true,
  };
  controller.update(input);
  await settle();
  expect(spoken[0].text).toBe(input.text);
  expect(states.at(-1).ducking).toBe(true);
  spoken[0].options.onDone();
  expect(states.at(-1).ducking).toBe(false);
  controller.update({ ...input, active: false });
  await settle();
  controller.update(input);
  await settle();
  expect(spoken).toHaveLength(1);
  controller.update({ ...input, poseKey: "2", text: "Old move" });
  controller.update({ ...input, poseKey: "3", text: "Tree pose, right side" });
  await settle();
  expect(spoken.map((s) => s.text)).toEqual([
    input.text,
    "Tree pose, right side",
  ]);
  spoken[1].options.onError();
  expect(states.at(-1).ducking).toBe(false);
  expect(states.at(-1).speechStatus).toContain("unavailable");
  controller.dispose();
  await settle();
  expect(stopCount).toBeGreaterThanOrEqual(6);
  expect(chimes).toBe(3);
});
test("cold voice initialization never announces an abandoned pose", async () => {
  let resolveVoices!: (voices: any[]) => void;
  const ready = new Promise<any[]>((resolve) => (resolveVoices = resolve));
  const spoken: string[] = [];
  const controller = createGuidanceController({
    stop: async () => {},
    voices: () => ready,
    speak: (text) => spoken.push(text),
    playChime: async () => {},
    stopChime: () => {},
    onState: () => {},
  });
  const input = {
    poseKey: "first",
    text: "Old pose",
    active: true,
    chime: false,
    speech: true,
  };
  controller.update(input);
  await new Promise((resolve) => setTimeout(resolve, 5));
  controller.update({ ...input, active: false });
  resolveVoices([{ identifier: "en", language: "en-US" }]);
  await new Promise((resolve) => setTimeout(resolve, 5));
  expect(spoken).toEqual([]);
  controller.update({ ...input, poseKey: "second", text: "New pose" });
  await new Promise((resolve) => setTimeout(resolve, 5));
  expect(spoken).toEqual(["New pose"]);
  controller.dispose();
});
test("player connects speech, ducking, side cues and lifecycle cancellation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "verdant.library.v1",
      JSON.stringify({
        version: 1,
        routines: [
          {
            id: "custom-speech",
            name: "Voice test",
            steps: [
              { poseId: "tree-left", seconds: 15 },
              { poseId: "tree-right", seconds: 15 },
            ],
          },
        ],
        preferences: {
          ambient: "rain",
          ambientEnabled: true,
          chime: true,
          speech: true,
        },
      }),
    );
    const w = window as any;
    w.SpeechSynthesisUtterance = class {};
    w.__spoken = [];
    w.__cancel = 0;
    w.__speechActive = false;
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        getVoices: () => [
          {
            voiceURI: "test-English",
            lang: "en-US",
            name: "Test",
            localService: true,
            default: true,
          },
        ],
        cancel: () => {
          w.__cancel++;
          w.__speechActive = false;
        },
        speak: (utterance: any) => {
          w.__spoken.push(utterance.text);
          w.__speechActive = true;
          w.__utterance = utterance;
          utterance.onstart?.({});
        },
      },
    });
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.loop) w.__ambient = this;
      else w.__chimes = (w.__chimes ?? 0) + 1;
      return play.call(this);
    };
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "My routines" }).click();
  await page.getByRole("radio", { name: /Voice test/ }).click();
  await page.getByRole("button", { name: "Start yoga" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__spoken))
    .toEqual(["Low tree, left side"]);
  await expect
    .poll(() => page.evaluate(() => (window as any).__ambient?.volume))
    .toBeCloseTo(0.036, 2);
  await page.evaluate(() => {
    const w = window as any;
    w.__utterance.onend({});
    w.__speechActive = false;
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).__ambient?.volume))
    .toBeCloseTo(0.18, 2);
  await page.getByRole("button", { name: "Skip to next pose" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__spoken))
    .toEqual(["Low tree, left side", "Low tree, right side"]);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(
    page.getByRole("button", { name: "Resume practice" }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as any).__speechActive))
    .toBe(false);
  await page.getByRole("button", { name: "Leave practice" }).click();
  await page.getByRole("button", { name: "End practice", exact: true }).click();
  expect(await page.evaluate(() => (window as any).__chimes)).toBe(2);
});
