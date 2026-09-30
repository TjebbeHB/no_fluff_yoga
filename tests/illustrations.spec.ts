import { forms, interpolatePose } from "../src/poseGeometry";
import { test, expect } from "@playwright/test";
test("all routine transitions render finite SVG contours and reduced motion stays still", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const routine of [
    "Morning flow, 10 minutes",
    "Gentle stretch, 15 minutes",
    "Evening unwind, 12 minutes",
  ]) {
    await page.getByRole("radio", { name: routine }).click();
    await page.getByRole("button", { name: "Start yoga" }).click();
    await page.getByRole("button", { name: "Pause practice" }).click();
    const count = routine.startsWith("Evening") ? 8 : 10;
    for (let i = 0; i < count; i++) {
      const svg = page.locator('svg[aria-label$="pose illustration"]').first();
      await page.waitForTimeout(80);
      const markup = await svg.evaluate((e) => e.outerHTML);
      expect(markup).not.toMatch(/NaN|undefined|Infinity/);
      await page.waitForTimeout(40);
      expect(await svg.evaluate((e) => e.outerHTML)).toBe(markup);
      if (i < count - 1)
        await page.getByRole("button", { name: "Skip to next pose" }).click();
    }
    await page.getByRole("button", { name: "Leave practice" }).click();
    await page
      .getByRole("button", { name: "End practice", exact: true })
      .click();
  }
});
test("animated contours change smoothly then settle while paused", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Start yoga" }).click();
  const svg = page.locator('svg[aria-label$="pose illustration"]').first();
  await page.clock.runFor(1000);
  const before = await svg.evaluate((e) => e.outerHTML);
  await page.getByRole("button", { name: "Skip to next pose" }).click();
  await page.clock.runFor(400);
  const middle = await svg.evaluate((e) => e.outerHTML);
  expect(middle).not.toMatch(/NaN|undefined|Infinity/);
  expect(middle).not.toBe(before);
  await page.clock.runFor(650);
  const after = await svg.evaluate((e) => e.outerHTML);
  expect(after).not.toBe(middle);
  await page.getByRole("button", { name: "Pause practice" }).click();
  const paused = await svg.evaluate((e) => e.outerHTML);
  await page.clock.runFor(1000);
  expect(await svg.evaluate((e) => e.outerHTML)).toBe(paused);
});

test("spine and limb lengths are preserved through every pose interpolation", () => {
  const length = (p: number[], a: number, b: number) =>
    Math.hypot(p[a] - p[b], p[a + 1] - p[b + 1]);
  for (const from of Object.values(forms))
    for (const to of Object.values(forms))
      for (const t of [0.25, 0.5, 0.75]) {
        const points = interpolatePose(from, to, t);
        expect(points.every(Number.isFinite)).toBe(true);
        for (const [a, b] of [
          [2, 4],
          [0, 2],
          [2, 6],
          [6, 8],
          [2, 10],
          [10, 12],
          [4, 14],
          [14, 16],
          [4, 18],
          [18, 20],
        ]) {
          expect(length(points, a, b)).toBeCloseTo(
            length(from, a, b) * (1 - t) + length(to, a, b) * t,
            3,
          );
        }
      }
});
