import { test, expect } from "@playwright/test";
test("bundled audio plays, pauses, resumes and stops on exit", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.loop) (window as any).__practiceAudio = this;
      return play.call(this);
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Start yoga" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__practiceAudio?.currentTime ?? 0),
    )
    .toBeGreaterThan(0.1);
  await expect
    .poll(() => page.evaluate(() => (window as any).__practiceAudio?.volume))
    .toBeCloseTo(0.18, 2);
  await page.evaluate(() => {
    const audio = (window as any).__practiceAudio;
    audio.currentTime = audio.duration - 0.15;
  });
  await page.waitForTimeout(400);
  expect(
    await page.evaluate(() => (window as any).__practiceAudio.currentTime),
  ).toBeLessThan(1);
  await page.getByRole("button", { name: "Pause practice" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__practiceAudio?.paused))
    .toBe(true);
  await page.getByRole("button", { name: "Resume practice" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__practiceAudio?.paused))
    .toBe(false);
  await page.getByRole("button", { name: "Mute ambient sound" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__practiceAudio?.paused))
    .toBe(true);
  await page.getByRole("button", { name: "Enable ambient sound" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__practiceAudio?.paused))
    .toBe(false);
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
    .poll(() => page.evaluate(() => (window as any).__practiceAudio?.paused))
    .toBe(true);
  await page.getByRole("button", { name: "Leave practice" }).click();
  await page.getByRole("button", { name: "End practice", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__practiceAudio?.paused))
    .toBe(true);
});
