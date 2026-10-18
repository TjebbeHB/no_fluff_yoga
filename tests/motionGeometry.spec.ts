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
import { BONES, FLOOR, Vec3 } from "../src/rig";
import { figureOf, headArt, torsoArt } from "../src/figure";
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
const name = (t: PoseTarget) => t.shape + (t.side ? `-${t.side}` : "");
const pairs = targets.flatMap((from) => targets.map((to) => [from, to]));
const dist = (a: Vec3, b: Vec3) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mid = (a: Vec3, b: Vec3): Vec3 => [
  (a[0] + b[0]) / 2,
  (a[1] + b[1]) / 2,
  (a[2] + b[2]) / 2,
];
const angle = (root: Vec3, joint: Vec3, tip: Vec3) => {
  const a = sub(root, joint),
    b = sub(tip, joint);
  const c = dot(a, b) / (Math.hypot(...a) * Math.hypot(...b));
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
};
function frames(from: PoseTarget, to: PoseTarget, steps = 80) {
  const plan = planMotion(from, to);
  return Array.from({ length: steps + 1 }, (_, i) => {
    try {
      return sampleMotion(plan, (plan.duration * i) / steps);
    } catch (e) {
      throw new Error(`${name(from)} → ${name(to)}, step ${i}: ${e}`);
    }
  });
}

test("the 3D skeleton keeps true bone lengths, planted contacts and the floor", () => {
  for (const [from, to] of pairs)
    for (const f of frames(from, to)) {
      assert(f.points.every(Number.isFinite));
      if (!f.rig) continue;
      const w = f.rig.world;
      const bones: [Vec3, Vec3, number][] = [
        [w.chest, w.pelvis, BONES.spine],
        [w.chest, w.head, BONES.neck],
        [w.chest, w.shoulders[0], BONES.shoulder],
        [w.pelvis, w.hips[1], BONES.hip],
      ];
      for (const i of [0, 1] as const)
        bones.push(
          [w.shoulders[i], w.elbows[i], BONES.upperArm],
          [w.elbows[i], w.wrists[i], BONES.forearm],
          [w.hips[i], w.knees[i], BONES.thigh],
          [w.knees[i], w.ankles[i], BONES.shin],
        );
      for (const [a, b, length] of bones)
        assert(
          Math.abs(dist(a, b) - length) < 1e-6,
          `${name(from)} → ${name(to)}: bone ${dist(a, b)} ≠ ${length}`,
        );
      const joint = {
        leftFoot: w.ankles[0],
        rightFoot: w.ankles[1],
        leftHand: w.wrists[0],
        rightHand: w.wrists[1],
        leftKnee: w.knees[0],
        rightKnee: w.knees[1],
      };
      for (const [k, anchor] of Object.entries(f.rig.contacts))
        assert(dist(joint[k as keyof typeof joint], anchor!) < 1e-6);
      for (const p of [
        w.head,
        w.chest,
        w.pelvis,
        ...w.elbows,
        ...w.wrists,
        ...w.knees,
        ...w.ankles,
      ])
        assert(
          p[1] <= FLOOR + 1,
          `${name(from)} → ${name(to)}: joint below the mat (${p[1]})`,
        );
    }
});

test("phases join seamlessly, start and finish at rest, and never jerk", () => {
  for (const [from, to] of pairs) {
    const plan = planMotion(from, to);
    if (plan.manual || !plan.duration) continue;
    let last = poseFrame(from);
    for (const phase of plan.phases) {
      const first = phase.sample(0);
      for (let i = 0; i < 22; i++)
        expect(
          first.points[i],
          `${name(from)}→${name(to)} ${phase.label} point${i}`,
        ).toBeCloseTo(last.points[i], 3);
      last = phase.sample(1);
    }
    const target = poseFrame(to);
    for (let i = 0; i < 22; i++)
      expect(
        last.points[i],
        `${name(from)}→${name(to)} final point${i}`,
      ).toBeCloseTo(target.points[i], 3);
    // Speeds come from finite differences of every joint, in px/s.
    const speed = (t: number, dt = 0.002) => {
      const a = sampleMotion(plan, Math.max(0, t)).points,
        b = sampleMotion(plan, Math.min(plan.duration, t + dt)).points;
      let fastest = 0;
      for (let i = 0; i < 22; i += 2)
        fastest = Math.max(fastest, Math.hypot(b[i] - a[i], b[i + 1] - a[i + 1]));
      return fastest / dt;
    };
    expect(speed(0, 0.0005)).toBeLessThan(4);
    expect(speed(plan.duration - 0.0005, 0.0005)).toBeLessThan(4);
    let t = 0;
    for (const phase of plan.phases) {
      t += phase.duration;
      if (t >= plan.duration - 1e-6) break;
      // Movement flows through a cue change instead of stopping or jumping.
      const before = speed(t - 0.004, 0.002),
        after = speed(t + 0.002, 0.002);
      expect(Math.abs(before - after), `${name(from)}→${name(to)} at ${phase.label}`).toBeLessThan(12);
    }
    for (let i = 0; i <= 200; i++)
      expect(
        speed((plan.duration * i) / 200),
        `${name(from)}→${name(to)} at ${i / 2}%`,
      ).toBeLessThan(240);
  }
});

test("knees track the toes, elbows stay outside the arms and joints stay in range", () => {
  for (const [from, to] of pairs)
    for (const f of frames(from, to, 40)) {
      if (!f.rig) continue;
      const w = f.rig.world;
      for (const i of [0, 1] as const) {
        const knee = angle(w.hips[i], w.knees[i], w.ankles[i]);
        const elbow = angle(w.shoulders[i], w.elbows[i], w.wrists[i]);
        assert(knee >= 25 && elbow >= 25, `${name(from)}→${name(to)}: folded joint`);
        // Standing knees bend toward the toes, never backward.
        if (knee < 175 && !f.rig.contacts.leftKnee) {
          const toe: Vec3 = [w.toes[i][0], 0, w.toes[i][2]];
          const offset = sub(w.knees[i], mid(w.hips[i], w.ankles[i]));
          assert(
            dot(offset, toe) > -0.5,
            `${name(from)}→${name(to)}: knee bends backward`,
          );
        }
        // Standing elbows fold behind the arm; on hands and knees they bend
        // back toward the knees or out to the side, clear of the mat.
        if (f.rig.contacts.leftKnee)
          assert(w.elbows[i][1] < FLOOR - 6, "Elbow drops onto the mat");
        else if (elbow < 175) {
          // Elbows never fold in toward the body's midline.
          const offset = sub(w.elbows[i], mid(w.shoulders[i], w.wrists[i]));
          const out = w.chestBasis.left.map((v) => v * (i === 0 ? 1 : -1)) as Vec3;
          assert(
            dot(offset, out) > -0.3 * Math.hypot(...offset) - 0.5,
            `${name(from)}→${name(to)}: elbow folds inward (${dot(offset, out)})`,
          );
        }
      }
    }
});

test("each step shifts weight first, lifts the foot and keeps contacts planted", () => {
  for (const [from, to] of pairs) {
    const plan = planMotion(from, to);
    for (const phase of plan.phases) {
      const samples = Array.from({ length: 41 }, (_, i) => phase.sample(i / 40));
      const start = samples[0].rig!;
      for (const f of samples)
        for (const [k, anchor] of Object.entries(start.contacts)) {
          const now = f.rig!.contacts[k as keyof typeof start.contacts];
          assert(
            !!now && dist(now, anchor!) < 1e-6,
            `${name(from)}→${name(to)}: ${k} slides in ${phase.label}`,
          );
        }
      const middle = phase.sample(0.5).rig!;
      ([0, 1] as const).forEach((i) => {
        const key = (["leftFoot", "rightFoot"] as const)[i];
        const other = (["leftFoot", "rightFoot"] as const)[1 - i];
        const travel = dist(start.world.ankles[i], samples[40].rig!.world.ankles[i]);
        if (start.contacts[key] || travel < 1) return;
        // A travelling foot clears the mat while the pelvis stays over the
        // standing foot.
        const highest = Math.min(...samples.map((f) => f.rig!.world.ankles[i][1]));
        assert(
          highest < Math.min(start.world.ankles[i][1], FLOOR) - 4,
          `${name(from)}→${name(to)}: foot drags in ${phase.label}`,
        );
        const stance = middle.contacts[other];
        if (stance)
          assert(
            Math.hypot(
              middle.world.pelvis[0] - stance[0],
              middle.world.pelvis[2] - stance[2],
            ) <= 20,
            `${name(from)}→${name(to)}: unbalanced in ${phase.label}`,
          );
      });
      ([0, 1] as const).forEach((i) => {
        const key = (["leftHand", "rightHand"] as const)[i];
        if (!start.contacts.leftKnee || start.contacts[key]) return;
        const travel = dist(start.world.wrists[i], samples[40].rig!.world.wrists[i]);
        if (travel < 1) return;
        assert(
          !!start.contacts[(["leftHand", "rightHand"] as const)[1 - i]],
          "The other palm supports each hand walk",
        );
        assert(
          Math.min(...samples.map((f) => f.rig!.world.wrists[i][1])) < FLOOR - 8,
          "Walking palm must lift clear",
        );
      });
    }
  }
});

test("side changes pivot on planted feet; floor changes ask for repositioning", () => {
  const side = planMotion(
    { shape: "warrior", side: "left" },
    { shape: "warrior", side: "right" },
  );
  expect(side.phases.length).toBeGreaterThanOrEqual(3);
  expect(side.duration).toBeLessThan(7);
  for (const phase of side.phases)
    expect(Object.keys(phase.sample(0.5).rig!.contacts)).toEqual([
      "leftFoot",
      "rightFoot",
    ]);
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
  for (const [from, to] of pairs) {
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

test("every pose and in-between frame draws finite shapes", () => {
  const check = (f: MotionFrame, side?: "left" | "right") => {
    const fig = figureOf(f, side);
    const art = JSON.stringify([
      headArt(fig),
      headArt(fig, true),
      torsoArt(fig),
    ]);
    assert(!/NaN|undefined|Infinity/.test(art), `Bad drawing for ${f.label}`);
  };
  for (const t of targets) check(poseFrame(t), t.side);
  for (const [from, to] of pairs)
    for (const f of frames(from, to, 12)) check(f, to.side);
});
