import { test, expect } from "@playwright/test";
import {
  ANDROID_ICON_SCALE,
  MARK,
  MARK_CANVAS,
  markOutline,
} from "../src/brand";
import {
  copyName,
  NAME_LIMIT,
  poseLibrary,
  routines,
  stepsOf,
} from "../src/routines";

const farthest = (points: [number, number][], cx: number, cy: number) =>
  Math.max(...points.map(([x, y]) => Math.hypot(x - cx, y - cy)));

test("the mark fits every space the platforms give it", () => {
  const points = markOutline(200);
  const { x, y, size } = MARK.bounds;
  // The in-app logo and splash image draw the mark inside its bounds.
  for (const [px, py] of points) {
    expect(px).toBeGreaterThanOrEqual(x);
    expect(px).toBeLessThanOrEqual(x + size);
    expect(py).toBeGreaterThanOrEqual(y);
    expect(py).toBeLessThanOrEqual(y + size);
  }
  // Android 12+ masks the splash image to a circle: nothing in the corners.
  expect(farthest(points, x + size / 2, y + size / 2)).toBeLessThanOrEqual(
    size / 2 + 0.5,
  );
  // Adaptive icons keep the middle 66 of 108 dp safe from every mask shape.
  const centre = MARK_CANVAS / 2;
  const safeRadius = (MARK_CANVAS * 66) / 108 / 2;
  expect(farthest(points, centre, centre) * ANDROID_ICON_SCALE).toBeLessThan(
    safeRadius * 0.75,
  );
  // On iOS the mark takes about half the icon, centred.
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const width = Math.max(...xs) - Math.min(...xs);
  expect(width / MARK_CANVAS).toBeGreaterThan(0.48);
  expect(width / MARK_CANVAS).toBeLessThan(0.6);
  expect(Math.abs((Math.max(...xs) + Math.min(...xs)) / 2 - centre)).toBeLessThan(1);
  expect(Math.abs((Math.max(...ys) + Math.min(...ys)) / 2 - centre)).toBeLessThan(4);
});

test("ready-made routines become valid saved steps, and copies get free names", () => {
  for (const routine of routines) {
    const steps = stepsOf(routine);
    expect(steps).toHaveLength(routine.poses.length);
    for (const [i, step] of steps.entries()) {
      const pose = poseLibrary.find((p) => p.id === step.poseId);
      expect(pose?.name).toBe(routine.poses[i].name);
      expect(pose?.side).toBe(routine.poses[i].side);
      expect(step.seconds % 15).toBe(0);
      expect(step.seconds).toBeGreaterThanOrEqual(15);
      expect(step.seconds).toBeLessThanOrEqual(180);
    }
  }
  expect(copyName("Morning flow", [])).toBe("Morning flow (copy)");
  expect(copyName("Morning flow", ["Morning flow (copy)"])).toBe(
    "Morning flow (copy 2)",
  );
  expect(copyName("Find your balance", [], "my way")).toBe(
    "Find your balance (my way)",
  );
  const long = copyName("A".repeat(NAME_LIMIT), []);
  expect(long.length).toBeLessThanOrEqual(NAME_LIMIT);
  expect(long.endsWith(" (copy)")).toBe(true);
});
