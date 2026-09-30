import { test, expect } from "@playwright/test";
import { routines, locatePose, formatTime } from "../src/routines";
test("routine durations and exact transition boundaries", () => {
  for (const r of routines) {
    expect(r.poses.reduce((sum, p) => sum + p.seconds, 0)).toBe(r.minutes * 60);
    expect(locatePose(r, 0).index).toBe(0);
    expect(locatePose(r, r.poses[0].seconds).index).toBe(1);
    expect(locatePose(r, r.minutes * 60).index).toBe(r.poses.length);
  }
  expect(formatTime(60)).toBe("01:00");
  expect(formatTime(9)).toBe("00:09");
});
test("select, practice, pause, audio, next pose, finish, and restart", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("Your practice.")).toBeVisible();
  await page.screenshot({ path: "artifacts/home.png" });
  await page.getByRole("radio", { name: "Gentle stretch, 15 minutes" }).click();
  await page.getByRole("button", { name: "Start yoga" }).click();
  await expect(page.getByText("Easy seat", { exact: true })).toBeVisible();
  await expect(page.getByText("Soft rain", { exact: true })).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Pause practice" }).click();
  const timer = page.getByLabel(/seconds remaining/);
  const pausedTime = await timer.getAttribute("aria-label");
  await page.waitForTimeout(1300);
  expect(await timer.getAttribute("aria-label")).toBe(pausedTime);
  await page.getByRole("button", { name: "Mute ambient sound" }).click();
  await expect(page.getByText("Sound off")).toBeVisible();
  await page.getByRole("button", { name: "Resume practice" }).click();
  await page.getByRole("button", { name: "Skip to next pose" }).click();
  await expect(page.getByText("Mountain pose", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Skip to next pose" }).click();
  await page.getByRole("button", { name: "Skip to next pose" }).click();
  await expect(page.getByText("LEFT SIDE", { exact: true })).toBeVisible();
  await page.waitForTimeout(1100);
  await page.screenshot({ path: "artifacts/practice.png", fullPage: true });
  for (let i = 0; i < 6; i++)
    await page.getByRole("button", { name: "Skip to next pose" }).click();
  await page.getByRole("button", { name: "Finish practice" }).click();
  await expect(
    page.getByText("PRACTICE COMPLETE", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to your practice" }).click();
  await expect(page.getByText("Your practice.")).toBeVisible();
  await page.getByRole("button", { name: "Start yoga" }).click();
  await expect(page.getByText("Easy seat", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Leave practice" }).click();
  await page.getByRole("button", { name: "End practice", exact: true }).click();
  await expect(page.getByText("Your practice.")).toBeVisible();
  expect(errors).toEqual([]);
});
test("timer advances automatically and modal can be cancelled", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Start yoga" }).click();
  await expect(page.getByText("Mountain pose", { exact: true })).toBeVisible();
  await page.clock.runFor(61000);
  await expect(page.getByText("Upward reach", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Leave practice" }).click();
  await page.getByRole("button", { name: "Keep practicing" }).click();
  await expect(
    page.getByRole("button", { name: "Pause practice" }),
  ).toBeVisible();
});
