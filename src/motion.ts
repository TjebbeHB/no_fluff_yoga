import { Shape } from "./routines";
import { forms, Vec } from "./poseGeometry";

export type PoseTarget = { shape: Shape; side?: "left" | "right" };
export type MotionFrame = {
  points: number[];
  joints: {
    leftShoulder: Vec;
    rightShoulder: Vec;
    leftHip: Vec;
    rightHip: Vec;
  };
  contacts: Partial<
    Record<
      | "leftFoot"
      | "rightFoot"
      | "leftHand"
      | "rightHand"
      | "leftKnee"
      | "rightKnee",
      Vec
    >
  >;
  canonical: boolean;
  label: string;
};
type Rig = {
  hip: Vec;
  spine: number;
  neck?: number;
  front?: number;
  feet: [Vec, Vec];
  knees?: [Vec, Vec];
  hands?: [Vec, Vec];
  arms: [number, number, number, number] | "hanging" | "floor";
  legBend: [number, number];
  contacts: MotionFrame["contacts"];
  footAngles?: [number, number];
};
export type MotionPhase = {
  duration: number;
  label: string;
  sample: (progress: number) => MotionFrame;
};
export type MotionPlan = {
  from: PoseTarget;
  to: PoseTarget;
  duration: number;
  manual: boolean;
  phases: MotionPhase[];
  label: string;
};
export const BONE_LENGTHS = {
  spine: 70,
  neck: 22,
  upperArm: 40,
  forearm: 40,
  thigh: 46,
  shin: 46,
};
const DEG = Math.PI / 180;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const vMix = (a: Vec, b: Vec, t: number): Vec => [
  mix(a[0], b[0], t),
  mix(a[1], b[1], t),
];
const offset = (p: Vec, dx: number, dy = 0): Vec => [p[0] + dx, p[1] + dy];
const ray = (p: Vec, length: number, degrees: number): Vec =>
  offset(p, length * Math.cos(degrees * DEG), length * Math.sin(degrees * DEG));
const smooth = (t: number) => t * t * t * (t * (6 * t - 15) + 10);
const footL: Vec = [168, 280],
  footR: Vec = [192, 280];
const normalArms: Rig["arms"] = [100, 80, 80, 100];
const raisedArms: Rig["arms"] = [250, 230, -70, -50];

// Endpoints are never clamped: a bad authored path is an error, not a sliding
// planted hand or changing body proportion. The branch is authored per limb.
function joint(root: Vec, end: Vec, a: number, b: number, bend: number): Vec {
  const dx = end[0] - root[0],
    dy = end[1] - root[1];
  const d = Math.hypot(dx, dy);
  if (d > a + b + 0.00001 || d < Math.abs(a - b) - 0.00001 || d < 0.001)
    throw new Error(`Unreachable authored contact: ${d.toFixed(3)} / ${a + b}`);
  const along = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - along * along));
  return [
    root[0] + (dx / d) * along - (dy / d) * h * bend,
    root[1] + (dy / d) * along + (dx / d) * h * bend,
  ];
}
function rigFrame(r: Rig, label: string): MotionFrame {
  const shoulder = ray(r.hip, 70, r.spine);
  const head = ray(shoulder, 22, r.neck ?? r.spine);
  // Persistent anatomical attachments. Width is the orthographic frontal
  // projection, independent of spine lean; the pelvis does not rotate with it.
  const ls = offset(shoulder, -14),
    rs = offset(shoulder, 14);
  const lh = offset(r.hip, -12),
    rh = offset(r.hip, 12);
  const lk = r.knees?.[0] ?? joint(lh, r.feet[0], 46, 46, r.legBend[0]);
  const rk = r.knees?.[1] ?? joint(rh, r.feet[1], 46, 46, r.legBend[1]);
  let le: Vec, re: Vec, lw: Vec, rw: Vec;
  if (Array.isArray(r.arms)) {
    le = ray(ls, 40, r.arms[0]);
    lw = ray(le, 40, r.arms[1]);
    re = ray(rs, 40, r.arms[2]);
    rw = ray(re, 40, r.arms[3]);
  } else {
    if (r.arms === "floor") {
      [lw, rw] = r.hands ?? [
        [218, 280],
        [246, 280],
      ];
    } else {
      lw = [ls[0], Math.min(ls[1] + 80 * Math.cos(10 * DEG), 278)];
      rw = [rs[0], Math.min(rs[1] + 80 * Math.cos(10 * DEG), 278)];
    }
    le = joint(ls, lw, 40, 40, r.arms === "floor" ? -1 : 1);
    re = joint(rs, rw, 40, 40, -1);
  }
  return {
    points: [
      ...head,
      ...shoulder,
      ...r.hip,
      ...le,
      ...lw,
      ...re,
      ...rw,
      ...lk,
      ...r.feet[0],
      ...rk,
      ...r.feet[1],
      (r.neck ?? r.spine) + 90,
      ...(r.footAngles ?? [0, 0]),
      r.front ?? 1,
    ],
    joints: { leftShoulder: ls, rightShoulder: rs, leftHip: lh, rightHip: rh },
    contacts: r.contacts,
    canonical: true,
    label,
  };
}
function neutral(): Rig {
  return {
    hip: [180, 188],
    spine: -90,
    feet: [footL, footR],
    arms: normalArms,
    legBend: [1, -1],
    contacts: { leftFoot: footL, rightFoot: footR },
  };
}
function standing(target: PoseTarget): Rig {
  const r = neutral(),
    left = target.side === "left";
  switch (target.shape) {
    case "reach":
      r.arms = raisedArms;
      break;
    case "chair":
      r.hip = [172, 207];
      r.spine = -66;
      r.arms = [274, 254, -46, -26];
      r.legBend = [-1, -1];
      break;
    case "fold":
      r.spine = 8;
      r.neck = 80;
      r.front = 0;
      r.arms = "hanging";
      break;
    case "tree": {
      r.hip = [left ? 172 : 188, 189];
      r.feet = left ? [footL, [173, 268]] : [[187, 268], footR];
      const elbow = joint([0, 0], [11, 32], 40, 40, 1);
      const upper = Math.atan2(elbow[1], elbow[0]) / DEG;
      const lower = Math.atan2(32 - elbow[1], 11 - elbow[0]) / DEG;
      r.arms = [upper, lower, 180 - upper, 180 - lower];
      r.contacts = left ? { leftFoot: footL } : { rightFoot: footR };
      r.footAngles = left ? [0, 65] : [65, 0];
      break;
    }
    case "warrior":
    case "triangle": {
      r.feet = left ? [[116, 280], footR] : [footL, [244, 280]];
      r.contacts = { leftFoot: r.feet[0], rightFoot: r.feet[1] };
      r.hip = [left ? 147 : 213, 195];
      r.arms = [180, 180, 0, 0];
      r.legBend = left ? [1, 1] : [-1, -1];
      if (target.shape === "triangle") {
        r.hip = [left ? 154 : 206, 280 - Math.sqrt(92 * 92 - 26 * 26)];
        r.spine = left ? -150 : -30;
        r.arms = left ? [-90, -90, 90, 90] : [90, 90, -90, -90];
      }
      break;
    }
  }
  return r;
}
function floorRig(
  t: number,
  hands: [Vec, Vec] = t === 1
    ? [
        [256, 280],
        [284, 280],
      ]
    : [
        [218, 280],
        [246, 280],
      ],
  movingHand?: 0 | 1,
): Rig {
  // Rock back around fixed knees; fixed shins and palms remain on the mat.
  const hip = ray([162, 274], 46, mix(-90, -144, t));
  const dx = Math.sqrt(46 * 46 - 6 * 6);
  const feet: [Vec, Vec] = [
    [150 - dx, 280],
    [174 - dx, 280],
  ];
  const contacts: Rig["contacts"] = {
    leftKnee: [150, 274],
    rightKnee: [174, 274],
  };
  if (movingHand !== 0) contacts.leftHand = hands[0];
  if (movingHand !== 1) contacts.rightHand = hands[1];
  return {
    hip,
    hands,
    front: 0,
    spine: mix(-22, 12, t),
    feet,
    knees: [
      [150, 274],
      [174, 274],
    ],
    arms: "floor",
    legBend: [1, 1],
    contacts,
    footAngles: [180, 180],
  };
}
const STANDING: Shape[] = [
  "mountain",
  "reach",
  "chair",
  "fold",
  "tree",
  "warrior",
  "triangle",
];
function legacyFrame(target: PoseTarget): MotionFrame {
  // These drawings are targets only: never run interpolation through them.
  const p = forms[target.shape].slice();
  if (target.side === "left") {
    for (let i = 0; i < 22; i += 2) p[i] = 360 - p[i];
    p[22] *= -1;
    p[23] *= -1;
    p[24] *= -1;
  }
  const length = Math.hypot(p[4] - p[2], p[5] - p[3]);
  const ux = (p[4] - p[2]) / length,
    uy = (p[5] - p[3]) / length;
  const attach = (x: number, y: number, w: number): Vec => [
    x - uy * w,
    y + ux * w,
  ];
  return {
    points: p,
    joints: {
      leftShoulder: attach(p[2], p[3], 14),
      rightShoulder: attach(p[2], p[3], -14),
      leftHip: attach(p[4], p[5], 6),
      rightHip: attach(p[4], p[5], -6),
    },
    contacts: {},
    canonical: false,
    label: "Target position",
  };
}
export function poseFrame(target: PoseTarget): MotionFrame {
  if (STANDING.includes(target.shape))
    return rigFrame(standing(target), target.shape);
  if (target.shape === "tabletop" || target.shape === "child")
    return rigFrame(floorRig(target.shape === "child" ? 1 : 0), target.shape);
  return legacyFrame(target);
}
function blendRig(a: Rig, b: Rig, t: number, lift?: 0 | 1): Rig {
  const feet: [Vec, Vec] = [
    vMix(a.feet[0], b.feet[0], t),
    vMix(a.feet[1], b.feet[1], t),
  ];
  if (lift !== undefined) feet[lift][1] -= 18 * Math.sin(Math.PI * t);
  let arms: Rig["arms"];
  if (Array.isArray(a.arms) && Array.isArray(b.arms))
    arms = a.arms.map((v, i) =>
      mix(v, (b.arms as number[])[i], t),
    ) as Rig["arms"];
  else arms = b.arms;
  const contacts: Rig["contacts"] = {};
  if (
    lift !== 0 &&
    a.feet[0][0] === b.feet[0][0] &&
    a.feet[0][1] === b.feet[0][1]
  )
    contacts.leftFoot = feet[0];
  if (
    lift !== 1 &&
    a.feet[1][0] === b.feet[1][0] &&
    a.feet[1][1] === b.feet[1][1]
  )
    contacts.rightFoot = feet[1];
  return {
    hip: vMix(a.hip, b.hip, t),
    spine: mix(a.spine, b.spine, t),
    neck: mix(a.neck ?? a.spine, b.neck ?? b.spine, t),
    front: mix(a.front ?? 1, b.front ?? 1, t),
    feet,
    arms,
    legBend: b.legBend,
    contacts,
    footAngles: [
      mix(a.footAngles?.[0] ?? 0, b.footAngles?.[0] ?? 0, t),
      mix(a.footAngles?.[1] ?? 0, b.footAngles?.[1] ?? 0, t),
    ],
  };
}
function phase(
  a: Rig,
  b: Rig,
  duration: number,
  label: string,
  lift?: 0 | 1,
): MotionPhase {
  return {
    duration,
    label,
    sample: (t) => rigFrame(blendRig(a, b, smooth(t), lift), label),
  };
}
function fromNeutral(target: PoseTarget): MotionPhase[] {
  const n = neutral(),
    end = standing(target);
  switch (target.shape) {
    case "mountain":
      return [];
    case "reach":
      return [phase(n, end, 2.6, "Raise your arms")];
    case "chair": {
      const reach = standing({ shape: "reach" });
      return [
        phase(n, reach, 2.4, "Raise your arms"),
        phase(reach, end, 2.4, "Bend your knees and sit back"),
      ];
    }
    case "fold": {
      // Neutral and hanging have identical wrists and elbow branches.
      const start = { ...n, arms: "hanging" as const };
      return [phase(start, end, 3.6, "Hinge at your hips")];
    }
    case "tree": {
      const load = { ...n, hip: end.hip };
      const lift = { ...end, arms: normalArms };
      return [
        phase(n, load, 1.0, "Shift your weight"),
        phase(
          load,
          lift,
          2.0,
          "Lift your foot gently",
          target.side === "left" ? 1 : 0,
        ),
        phase(lift, end, 1.4, "Bring your hands together"),
      ];
    }
    case "warrior":
    case "triangle": {
      const warrior = standing({ shape: "warrior", side: target.side });
      const load = {
        ...n,
        hip: [target.side === "left" ? 188 : 172, 213] as Vec,
        legBend: warrior.legBend,
      };
      const step = { ...load, feet: warrior.feet };
      const landed = { ...warrior, arms: normalArms };
      const phases = [
        phase(n, load, 1.8, "Bend your knees and shift your weight"),
        phase(
          load,
          step,
          2.4,
          "Lift and place your foot",
          target.side === "left" ? 0 : 1,
        ),
        phase(step, landed, 2.0, "Transfer weight with both feet grounded"),
        phase(landed, warrior, 1.8, "Open your arms"),
      ];
      if (target.shape === "triangle")
        phases.push(
          phase(
            warrior,
            end,
            3.0,
            "Lengthen your front leg and reach sideways",
          ),
        );
      return phases;
    }
    default:
      return [];
  }
}
function reversed(phases: MotionPhase[]): MotionPhase[] {
  return phases
    .slice()
    .reverse()
    .map((p) => ({
      duration: p.duration,
      label: "Return through a steady stance",
      sample: (t) => p.sample(1 - t),
    }));
}
export function planMotion(from: PoseTarget, to: PoseTarget): MotionPlan {
  const same = from.shape === to.shape && from.side === to.side;
  let phases: MotionPhase[] = [],
    manual = false;
  if (!same && STANDING.includes(from.shape) && STANDING.includes(to.shape)) {
    const sameWide =
      from.side === to.side &&
      ["warrior", "triangle"].includes(from.shape) &&
      ["warrior", "triangle"].includes(to.shape);
    if (sameWide)
      phases = [
        phase(
          standing(from),
          standing(to),
          3,
          "Keep both feet planted and reach",
        ),
      ];
    else phases = [...reversed(fromNeutral(from)), ...fromNeutral(to)];
  } else if (
    !same &&
    ["tabletop", "child"].includes(from.shape) &&
    ["tabletop", "child"].includes(to.shape)
  ) {
    const near: [Vec, Vec] = [
      [218, 280],
      [246, 280],
    ];
    const far: [Vec, Vec] = [
      [256, 280],
      [284, 280],
    ];
    const walk = (hand: 0 | 1): MotionPhase => ({
      duration: 1.5,
      label: "Walk one hand forward",
      sample: (t) => {
        const u = smooth(t);
        const hands: [Vec, Vec] =
          hand === 0
            ? [vMix(near[0], far[0], u), near[1]]
            : [far[0], vMix(near[1], far[1], u)];
        hands[hand] = [
          hands[hand][0],
          hands[hand][1] - 9 * Math.sin(Math.PI * u),
        ];
        return rigFrame(floorRig(0.5, hands, hand), "Walk one hand forward");
      },
    });
    phases = [
      {
        duration: 1.5,
        label: "Ease your hips back",
        sample: (t) =>
          rigFrame(floorRig(0.5 * smooth(t), near), "Ease your hips back"),
      },
      walk(0),
      walk(1),
      {
        duration: 1.8,
        label: "Rest back toward your heels",
        sample: (t) =>
          rigFrame(
            floorRig(0.5 + 0.5 * smooth(t), far),
            "Rest back toward your heels",
          ),
      },
    ];
    if (from.shape === "child")
      phases = phases
        .slice()
        .reverse()
        .map((p) => ({
          duration: p.duration,
          label: "Return onto hands and knees",
          sample: (t) => p.sample(1 - t),
        }));
  } else if (!same) manual = true;
  return {
    from,
    to,
    phases,
    duration: phases.reduce((n, p) => n + p.duration, 0),
    manual,
    label: manual
      ? "Change position at your own pace"
      : (phases[0]?.label ?? "Ready"),
  };
}
export function sampleMotion(
  plan: MotionPlan,
  elapsedSeconds: number,
): MotionFrame {
  if (plan.manual || elapsedSeconds >= plan.duration) return poseFrame(plan.to);
  let remaining = Math.max(0, elapsedSeconds);
  for (const p of plan.phases) {
    if (remaining <= p.duration) return p.sample(remaining / p.duration);
    remaining -= p.duration;
  }
  return poseFrame(plan.to);
}
