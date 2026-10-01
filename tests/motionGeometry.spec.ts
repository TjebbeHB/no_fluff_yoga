import { poseLibrary } from "../src/routines";
import { test, expect } from "@playwright/test";
import {
  poseFrame,
  planMotion,
  sampleMotion,
  MotionFrame,
  PoseTarget,
  BONE_LENGTHS,
} from "../src/motion";
function assert(
  value: boolean,
  message = "Motion invariant failed",
): asserts value {
  if (!value) throw new Error(message);
}
const targets: PoseTarget[] = poseLibrary.map(({ shape, side }) => ({
  shape,
  side,
}));
function bones(frame: MotionFrame) {
  const p = frame.points,
    j = frame.joints;
  const v = (i: number): [number, number] => [p[i], p[i + 1]];
  return [
    [v(0), v(2), 22],
    [v(2), v(4), 70],
    [j.leftShoulder, v(6), 40],
    [v(6), v(8), 40],
    [j.rightShoulder, v(10), 40],
    [v(10), v(12), 40],
    [j.leftHip, v(14), 46],
    [v(14), v(16), 46],
    [j.rightHip, v(18), 46],
    [v(18), v(20), 46],
  ] as const;
}
test("canonical motion retains actual visible bone lengths and grounded anchors", () => {
  for (const from of targets)
    for (const to of targets) {
      const plan = planMotion(from, to);
      for (let i = 0; i <= 100; i++) {
        let f: MotionFrame;
        try {
          f = sampleMotion(plan, (plan.duration * i) / 100);
        } catch (e) {
          throw new Error(
            `${JSON.stringify(from)} → ${JSON.stringify(to)}, t=${i}: ${e}`,
          );
        }
        assert(f.points.every(Number.isFinite));
        if (!f.canonical) continue;
        for (const [a, b, length] of bones(f))
          assert(
            Math.abs(Math.hypot(a[0] - b[0], a[1] - b[1]) - length) < 0.00001,
          );
        const contactIndex = {
          leftFoot: 16,
          rightFoot: 20,
          leftHand: 8,
          rightHand: 12,
          leftKnee: 14,
          rightKnee: 18,
        };
        for (const [name, anchor] of Object.entries(f.contacts)) {
          const idx = contactIndex[name as keyof typeof contactIndex];
          assert(Math.abs(f.points[idx] - anchor![0]) < 0.00001);
          assert(Math.abs(f.points[idx + 1] - anchor![1]) < 0.00001);
        }
        for (let n = 1; n < 22; n += 2)
          assert(
            f.points[n] <= 281,
            `${JSON.stringify(from)} → ${JSON.stringify(to)} t=${i} joint${n}: ${f.points[n]}`,
          );
      }
    }
});
test("authored phase seams and target seams have no discontinuities", () => {
  for (const from of targets)
    for (const to of targets) {
      const plan = planMotion(from, to);
      if (plan.manual || !plan.duration) continue;
      let last = poseFrame(from);
      for (const phase of plan.phases) {
        const first = phase.sample(0);
        for (let i = 0; i < 26; i++)
          expect(
            first.points[i],
            `${from.shape}→${to.shape} ${phase.label} point${i}`,
          ).toBeCloseTo(last.points[i], 3);
        last = phase.sample(1);
      }
      const target = poseFrame(to);
      for (let i = 0; i < 26; i++)
        expect(
          last.points[i],
          `${from.shape}→${to.shape} final point${i}`,
        ).toBeCloseTo(target.points[i], 3);
    }
});
test("side changes route via neutral; floor changes ask for repositioning", () => {
  expect(
    planMotion(
      { shape: "warrior", side: "left" },
      { shape: "warrior", side: "right" },
    ).phases.length,
  ).toBeGreaterThan(3);
  expect(planMotion({ shape: "mountain" }, { shape: "rest" }).manual).toBe(
    true,
  );
  expect(planMotion({ shape: "tabletop" }, { shape: "child" }).manual).toBe(
    false,
  );
  expect(BONE_LENGTHS.thigh).toBe(BONE_LENGTHS.shin);
});

test("all selectable pairs use explicit supported routes or honest repositioning", () => {
  expect(targets).toHaveLength(19);
  const standing = new Set([
    "mountain",
    "reach",
    "chair",
    "fold",
    "tree",
    "warrior",
    "triangle",
  ]);
  const floor = new Set(["tabletop", "child"]);
  for (const from of targets)
    for (const to of targets) {
      const same = from.shape === to.shape && from.side === to.side;
      const supported =
        same ||
        (standing.has(from.shape) && standing.has(to.shape)) ||
        (floor.has(from.shape) && floor.has(to.shape));
      const plan = planMotion(from, to);
      assert(
        plan.manual === !supported,
        `${from.shape}→${to.shape} incorrectly classified`,
      );
      assert(same || plan.manual || plan.duration > 0);
    }
});
test("contacts remain stationary, swing limbs clear the mat, and knees never flip branch", () => {
  for (const from of targets)
    for (const to of targets) {
      const plan = planMotion(from, to);
      for (const phase of plan.phases) {
        const start = phase.sample(0),
          end = phase.sample(1),
          middle = phase.sample(0.5);
        const names = Object.keys(
          start.contacts,
        ) as (keyof MotionFrame["contacts"])[];
        const signs: number[] = [0, 0, 0, 0];
        for (let n = 0; n <= 50; n++) {
          const f = phase.sample(n / 50);
          for (const name of names) {
            const a = start.contacts[name]!,
              b = f.contacts[name];
            assert(
              !!b && Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.00001,
              `Sliding ${name} in ${phase.label}`,
            );
          }
          const p = f.points,
            j = f.joints;
          const limbs = [
            [j.leftShoulder, 6, 8],
            [j.rightShoulder, 10, 12],
            [j.leftHip, 14, 16],
            [j.rightHip, 18, 20],
          ] as const;
          limbs.forEach(([root, jointIndex, tipIndex], index) => {
            const ax = root[0] - p[jointIndex],
              ay = root[1] - p[jointIndex + 1];
            const bx = p[tipIndex] - p[jointIndex],
              by = p[tipIndex + 1] - p[jointIndex + 1];
            const angle =
              (Math.acos(
                Math.max(
                  -1,
                  Math.min(
                    1,
                    (ax * bx + ay * by) /
                      (Math.hypot(ax, ay) * Math.hypot(bx, by)),
                  ),
                ),
              ) *
                180) /
              Math.PI;
            assert(
              angle >= 25 && angle <= 180.0001,
              `Excessive joint flexion ${angle} in ${phase.label}`,
            );
            const cross = ax * by - ay * bx;
            if (Math.abs(cross) > 0.001) {
              const sign = Math.sign(cross);
              assert(
                !signs[index] || signs[index] === sign,
                `Bend branch flipped in ${phase.label}`,
              );
              signs[index] = sign;
            }
          });
        }
        for (const [name, other, index] of [
          ["leftFoot", "rightFoot", 16],
          ["rightFoot", "leftFoot", 20],
        ] as const) {
          if (
            Math.hypot(
              start.points[index] - end.points[index],
              start.points[index + 1] - end.points[index + 1],
            ) > 1
          ) {
            assert(!middle.contacts[name] && !!middle.contacts[other]);
            assert(
              middle.points[index + 1] <
                (start.points[index + 1] + end.points[index + 1]) / 2 - 10,
              "Swing foot must lift",
            );
            assert(
              Math.abs(middle.points[4] - middle.contacts[other]![0]) <= 16,
              "Pelvis must stay over stance foot during swing",
            );
          }
        }
        for (const [name, other, index] of [
          ["leftHand", "rightHand", 8],
          ["rightHand", "leftHand", 12],
        ] as const) {
          if (
            middle.contacts.leftKnee &&
            middle.contacts.rightKnee &&
            !middle.contacts[name]
          ) {
            assert(
              !!middle.contacts[other],
              "The other palm supports each hand walk",
            );
            assert(
              middle.points[index + 1] < 275,
              "Walking palm must lift clear",
            );
          }
        }
      }
    }
});

test("motion comes to rest at supported phase boundaries", () => {
  // Straight knees are an IK singularity. Quintic timing must also settle the
  // solved joint, not only the pelvis/foot controls that drive it.
  const epsilon = 0.0001;
  for (const from of targets)
    for (const to of targets) {
      for (const phase of planMotion(from, to).phases) {
        for (const [edge, near] of [
          [0, epsilon],
          [1, 1 - epsilon],
        ]) {
          const a = phase.sample(edge).points,
            b = phase.sample(near).points;
          for (let i = 0; i < 22; i += 2) {
            const averageSpeed =
              Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1]) /
              (epsilon * phase.duration);
            assert(
              averageSpeed < 4,
              `Joint ${i} fails to settle in ${phase.label}: ${averageSpeed}`,
            );
          }
        }
      }
    }
});
