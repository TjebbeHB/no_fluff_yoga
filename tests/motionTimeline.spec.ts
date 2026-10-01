import { test, expect } from "@playwright/test";
import {
  advanceTimeline,
  initialTimeline,
  nextPose,
  confirmPosition,
} from "../src/practiceTimeline";
import { planMotion } from "../src/motion";
import { poseLibrary, Routine, Pose } from "../src/routines";

const pose = (shape: Pose["shape"]) => ({
  ...poseLibrary.find((p) => p.shape === shape)!,
  seconds: 15,
});
const routine = (...shapes: Pose["shape"][]): Routine => ({
  id: "test",
  name: "Timeline",
  minutes: shapes.length / 4,
  mood: "",
  description: "",
  color: "#fff",
  art: shapes[0],
  poses: shapes.map(pose),
});

test("movement time is additional, with a full hold after arrival and exact completion", () => {
  const r = routine("mountain", "reach");
  const duration = planMotion(r.poses[0], r.poses[1]).duration;
  expect(duration).toBeGreaterThan(0);
  let s = advanceTimeline(initialTimeline(), 15, r, false);
  expect(s.phase).toBe("move");
  expect(s.time).toBe(0);
  s = advanceTimeline(s, duration, r, false);
  expect(s.phase).toBe("hold");
  expect(s.time).toBe(0);
  expect(s.activeSeconds).toBeCloseTo(15 + duration);
  s = advanceTimeline(s, 14.75, r, false);
  expect(s.phase).toBe("hold");
  expect(s.time).toBeCloseTo(14.75);
  s = advanceTimeline(s, 0.25, r, false);
  expect(s.phase).toBe("complete");
  expect(s.activeSeconds).toBeCloseTo(30 + duration);
});

test("skip in flight queues from the reached endpoint without changing the current frame time", () => {
  const r = routine("mountain", "reach", "mountain");
  let s = nextPose(initialTimeline(), r, false);
  const duration = s.plan!.duration;
  s = advanceTimeline(s, duration / 2, r, false);
  const before = s;
  s = nextPose(s, r, false);
  expect(s.index).toBe(before.index);
  expect(s.time).toBe(before.time);
  expect(s.plan).toBe(before.plan);
  expect(s.queuedIndex).toBe(2);
  s = advanceTimeline(s, duration / 2, r, false);
  expect(s.index).toBe(2);
  expect(s.time).toBe(0);
  expect(s.phase).toBe("move");
  s = advanceTimeline(s, s.plan!.duration, r, false);
  expect(s.phase).toBe("hold");
  expect(s.time).toBe(0);
});

test("manual reposition cannot consume the hold and skips do not assume unconfirmed posture", () => {
  const r = routine("tree", "rest", "mountain");
  let s = nextPose(initialTimeline(), r, false);
  expect(s.phase).toBe("reposition");
  expect(advanceTimeline(s, 300, r, false)).toEqual(s);
  s = nextPose(s, r, false);
  expect(s.phase).toBe("reposition");
  expect(s.index).toBe(2);
  s = confirmPosition(s);
  expect(s.phase).toBe("hold");
  expect(s.time).toBe(0);
  s = advanceTimeline(s, 14, r, false);
  expect(s.phase).toBe("hold");
  expect(s.time).toBe(14);
});

test("enabling reduced motion settles pending movement without using any hold time", () => {
  const r = routine("mountain", "reach");
  let s = nextPose(initialTimeline(), r, false);
  s = advanceTimeline(s, s.plan!.duration / 2, r, false);
  const active = s.activeSeconds;
  s = advanceTimeline(s, 0, r, true);
  expect(s.phase).toBe("hold");
  expect(s.time).toBe(0);
  expect(s.activeSeconds).toBe(active);
  expect(nextPose(initialTimeline(), r, true).phase).toBe("hold");
});

test.describe("animated session integration", () => {
  test.use({ reducedMotion: "no-preference" });
  test("pause freezes the actual moving frame and resume completes movement before decrementing hold", async ({
    page,
  }) => {
    await page.clock.install();
    await page.goto("/");
    await page.getByRole("button", { name: "Start yoga" }).click();
    await page.getByRole("button", { name: "Skip to next pose" }).click();
    await expect(
      page.getByText("Moving into position", { exact: true }),
    ).toBeVisible();
    const svg = page.locator('svg[aria-label$="pose illustration"]').first();
    await page.clock.runFor(500);
    await page.getByRole("button", { name: "Pause practice" }).click();
    const frame = await svg.evaluate((e) => e.outerHTML);
    const timer = page.getByLabel(/seconds remaining/);
    const time = await timer.getAttribute("aria-label");
    await page.clock.runFor(3000);
    expect(await svg.evaluate((e) => e.outerHTML)).toBe(frame);
    expect(await timer.getAttribute("aria-label")).toBe(time);
    await page.getByRole("button", { name: "Resume practice" }).click();
    await page.clock.runFor(300);
    expect(await svg.evaluate((e) => e.outerHTML)).not.toBe(frame);
    expect(await timer.getAttribute("aria-label")).toBe(time);
    const r = routine("mountain", "reach");
    await page.clock.runFor(
      planMotion(r.poses[0], r.poses[1]).duration * 1000 + 100,
    );
    await expect(
      page.getByText("Breathe naturally", { exact: true }),
    ).toBeVisible();
    await expect(timer).toHaveAttribute("aria-label", /59|60/);
  });
});

test.describe("position changes and interruptions", () => {
  test.use({ reducedMotion: "no-preference" });
  test("unsupported change waits for confirmation and background freezes movement", async ({
    page,
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        "verdant.library.v1",
        JSON.stringify({
          version: 1,
          routines: [
            {
              id: "custom-routing",
              name: "Routing",
              steps: [
                { poseId: "mountain", seconds: 15 },
                { poseId: "reach", seconds: 15 },
                { poseId: "rest", seconds: 15 },
              ],
            },
          ],
          preferences: {
            ambient: "rain",
            ambientEnabled: false,
            chime: false,
            speech: false,
          },
        }),
      ),
    );
    await page.clock.install();
    await page.goto("/");
    await page.getByRole("tab", { name: "My routines" }).click();
    await page.getByRole("radio", { name: /Routing/ }).click();
    await page.getByRole("button", { name: "Start yoga" }).click();
    await page.getByRole("button", { name: "Skip to next pose" }).click();
    await page.clock.runFor(400);
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
    const svg = page.locator('svg[aria-label$="pose illustration"]').first();
    const frozen = await svg.evaluate((e) => e.outerHTML);
    await page.clock.runFor(5000);
    expect(await svg.evaluate((e) => e.outerHTML)).toBe(frozen);
    await page.getByRole("button", { name: "Resume practice" }).click();
    await page.clock.runFor(3000);
    await page.getByRole("button", { name: "Skip to next pose" }).click();
    await expect(
      page.getByRole("button", { name: "Start pose hold" }),
    ).toBeVisible();
    await page.clock.runFor(30000);
    await expect(page.getByLabel("15 seconds remaining")).toBeVisible();
    await page.getByRole("button", { name: "Start pose hold" }).click();
    await page.clock.runFor(15100);
    await expect(
      page.getByText("PRACTICE COMPLETE", { exact: true }),
    ).toBeVisible();
  });
});
