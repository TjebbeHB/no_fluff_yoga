import { Shape } from "./routines";
import { forms, Vec } from "./poseGeometry";
import {
  Arm,
  ARM_REACH,
  armFromWrist,
  Basis,
  Body,
  BONES,
  ELBOW,
  FLOOR,
  Foot,
  forearmLocal,
  LEG_REACH,
  restingPelvis,
  Skeleton,
  solve,
  Vec3,
  view,
  viewDirection,
} from "./rig";

export type PoseTarget = { shape: Shape; side?: "left" | "right" };
type ContactName =
  | "leftFoot"
  | "rightFoot"
  | "leftHand"
  | "rightHand"
  | "leftKnee"
  | "rightKnee";
export type MotionFrame = {
  points: number[];
  joints: {
    leftShoulder: Vec;
    rightShoulder: Vec;
    leftHip: Vec;
    rightHip: Vec;
  };
  contacts: Partial<Record<ContactName, Vec>>;
  canonical: boolean;
  label: string;
  // Rig poses keep the 3D skeleton: `world` for checking anatomy and contacts,
  // `view` (after the camera orbit) for drawing depth and foreshortening.
  rig?: {
    world: Skeleton;
    view: Skeleton;
    camera: number;
    contacts: Partial<Record<ContactName, Vec3>>;
  };
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
  spine: BONES.spine,
  neck: BONES.neck,
  upperArm: BONES.upperArm,
  forearm: BONES.forearm,
  thigh: BONES.thigh,
  shin: BONES.shin,
};
const DEG = Math.PI / 180;
type Side = "left" | "right";
// +1 toward the viewer's right; limb 1 is the right-hand limb on screen.
const dirOf = (side?: Side) => (side === "left" ? -1 : 1);
const limbOf = (side?: Side) => (side === "left" ? 0 : 1);
const sideName = (d: number) => (d > 0 ? "right" : "left");

// ---------------------------------------------------------------- poses
// Knees stay a little soft, so weight shifts never snap a leg straight.
const STAND = FLOOR - LEG_REACH + 0.6;
const foot = (x: number, out = 8): Foot => ({
  ankle: [x, FLOOR, 0],
  out,
  heel: 0,
  contact: true,
});
const hanging: Arm = { elev: 9, plane: 40, reach: 76 };
const overhead: Arm = { elev: 166, plane: 14, reach: 78 };
const forwardUp: Arm = { elev: 188, plane: 90, reach: 78 };
const wide: Arm = { elev: 90, plane: 0, reach: 79 };
const prayer: Arm = {
  elev: 46,
  plane: 124,
  reach: 30,
  pole: [1, -0.6, -0.3],
  hand: [-0.12, 1, 0.3],
};
const pair = <T>(a: T): [T, T] => [a, a];
const settle = (b: Body): Body => {
  const pelvis = restingPelvis(b);
  return {
    ...b,
    pelvis:
      pelvis[1] > b.pelvis[1]
        ? [pelvis[0], pelvis[1] + 0.8, pelvis[2]]
        : pelvis,
  };
};

function mountain(): Body {
  return {
    pelvis: [180, STAND, 0],
    feet: [foot(168), foot(192)],
    pitch: 0,
    roll: 0,
    twist: 0,
    neck: [-2, 0, 0],
    arms: pair(hanging),
    camera: 0,
  };
}
// Aim a free arm at a world point (a shin, the floor) from the posed chest.
function reachTo(b: Body, i: 0 | 1, wrist: Vec3, arm: Partial<Arm> = {}) {
  const sk = solve(b);
  const aim = armFromWrist(sk.shoulders[i], wrist, i === 0 ? 1 : -1, {
    ...sk.chestBasis,
  });
  b.arms[i] = {
    ...b.arms[i],
    ...arm,
    ...aim,
    reach: Math.min(aim.reach, ARM_REACH),
  };
}
function wideFeet(d: number, turned: boolean): [Foot, Foot] {
  const feet: [Foot, Foot] = [foot(180 - 54), foot(180 + 54)];
  if (turned) {
    const front = d > 0 ? 1 : 0;
    feet[front] = { ...feet[front], out: 90 };
    feet[1 - front] = { ...feet[1 - front], out: -15 };
  }
  return feet;
}
function straddle(side?: Side, arms = pair(wide)): Body {
  return settle({
    ...mountain(),
    pelvis: [180, STAND, 0],
    feet: wideFeet(dirOf(side), true),
    arms,
  });
}
function standing(target: PoseTarget): Body {
  const b = mountain(),
    d = dirOf(target.side),
    f = limbOf(target.side);
  switch (target.shape) {
    case "reach":
      b.arms = pair(overhead);
      b.neck = [-7, 0, 0];
      return b;
    case "chair":
      b.pelvis = [180, 210.6, -12.2];
      b.pitch = 34;
      b.neck = [-18, 0, 0];
      b.arms = pair(forwardUp);
      b.camera = 45;
      return b;
    case "fold": {
      b.pelvis = [180, 192, -9];
      b.pitch = 102;
      b.neck = [42, 0, 0];
      b.camera = 60;
      b.arms = pair({ ...hanging, plane: 90 });
      const sk = solve(b);
      ([0, 1] as const).forEach((i) => {
        const s = sk.shoulders[i];
        reachTo(b, i, [s[0] + (i ? -3 : 3), FLOOR - 5, s[2] + 8]);
      });
      return b;
    }
    case "tree": {
      const stance = b.feet[f].ankle[0];
      b.feet[1 - f] = {
        ankle: [stance - 7 * d, FLOOR - 9, 7],
        out: 75,
        heel: 55,
        knee: 12,
        contact: false,
      };
      b.pelvis = [stance - 1.5 * d, STAND, 0];
      b.arms = pair(prayer);
      return settle(b);
    }
    case "warrior":
      return settle({
        ...b,
        feet: wideFeet(d, true),
        pelvis: [180 + 6.8 * d, 204.4, 0],
        arms: pair(wide),
        neck: [-2, 0, -70 * d],
      });
    case "triangle": {
      const t = settle({
        ...b,
        feet: wideFeet(d, true),
        pelvis: [180 - 8 * d, STAND, 0],
        roll: -60 * d,
        neck: [0, 0, 22 * d],
        arms: pair(wide),
      });
      // The lower hand rests on the front shin; the upper arm continues the
      // same line toward the ceiling.
      const sk = solve(t);
      const shin = sk.knees[f].map(
        (v, k) => v + (sk.ankles[f][k] - v) * 0.45,
      ) as Vec3;
      reachTo(t, f as 0 | 1, [shin[0] + 6 * d, shin[1], shin[2] + 8]);
      const low = solve(t);
      const line = low.wrists[f].map((v, k) => v - low.shoulders[f][k]);
      const n = Math.hypot(...line);
      const top = low.shoulders[1 - f].map(
        (v, k) => v - (line[k] / n) * 78,
      ) as Vec3;
      reachTo(t, (1 - f) as 0 | 1, top);
      return t;
    }
  }
  return b;
}
const KNEE_Z = -40;
function kneeling(
  thigh: number,
  pitch: number,
  neck: number,
  wrists: [Vec3, Vec3],
  lifted?: 0 | 1,
): Body {
  const knee = (x: number): Foot => ({
    ankle: [x, FLOOR - 1, KNEE_Z - Math.sqrt(46 * 46 - 25)],
    out: 0,
    heel: 180,
    kneeAt: [x, FLOOR - 6, KNEE_Z],
    contact: true,
  });
  // Elbows point back toward the knees over the hands, and up and out once
  // the arms reach forward along the mat.
  const hand = (i: 0 | 1): Arm => {
    const k = Math.min(1, Math.max(0, (wrists[i][2] - 26) / 34));
    return {
      elev: 0,
      plane: 0,
      reach: 0,
      wrist: wrists[i],
      contact: lifted !== i,
      pole: [0.35 + 0.25 * k, -0.2 + 1.2 * k, -1 + 0.7 * k],
      hand: [0, 0, 1],
    };
  };
  return {
    pelvis: [180, 0, KNEE_Z],
    feet: [knee(168), knee(192)],
    thigh,
    pitch,
    roll: 0,
    twist: 0,
    neck: [neck, 0, 0],
    arms: [hand(0), hand(1)],
    camera: 60,
  };
}
const palms = (z: number): [Vec3, Vec3] => [
  [166, FLOOR - 2, z],
  [194, FLOOR - 2, z],
];
const CHILD_REACH = 60;
const tabletop = () => kneeling(0, 66, 14, palms(26));
const child = () => kneeling(52, 100, 14, palms(CHILD_REACH));
function posed(target: PoseTarget): Body | undefined {
  if (STANDING.includes(target.shape)) return standing(target);
  if (target.shape === "tabletop") return tabletop();
  if (target.shape === "child") return child();
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
const WIDE: Shape[] = ["warrior", "triangle"];

// ---------------------------------------------------------------- frames
const FEET = ["leftFoot", "rightFoot"] as const;
const HANDS = ["leftHand", "rightHand"] as const;
const KNEES = ["leftKnee", "rightKnee"] as const;
function toFrame(body: Body, label: string): MotionFrame {
  const world = solve(body),
    camera = body.camera;
  const at = (p: Vec3) => view(p, camera),
    turn = (d: Vec3) => viewDirection(d, camera);
  const both = (a: [Vec3, Vec3], f: (p: Vec3) => Vec3): [Vec3, Vec3] => [
    f(a[0]),
    f(a[1]),
  ];
  const basis = (b: Basis): Basis => ({
    left: turn(b.left),
    up: turn(b.up),
    forward: turn(b.forward),
  });
  const seen: Skeleton = {
    head: at(world.head),
    chest: at(world.chest),
    pelvis: at(world.pelvis),
    shoulders: both(world.shoulders, at),
    hips: both(world.hips, at),
    elbows: both(world.elbows, at),
    wrists: both(world.wrists, at),
    knees: both(world.knees, at),
    ankles: both(world.ankles, at),
    hands: both(world.hands, turn),
    toes: both(world.toes, turn),
    soles: both(world.soles, turn),
    chestBasis: basis(world.chestBasis),
    headBasis: basis(world.headBasis),
  };
  const contacts: NonNullable<MotionFrame["rig"]>["contacts"] = {};
  body.feet.forEach((f, i) => {
    if (!f.contact) return;
    contacts[FEET[i]] = f.ankle;
    if (f.kneeAt) contacts[KNEES[i]] = f.kneeAt;
  });
  body.arms.forEach((a, i) => {
    if (a.contact && a.wrist) contacts[HANDS[i]] = a.wrist;
  });
  const flat = (p: Vec3): Vec => [p[0], p[1]];
  const angle = (d: Vec3) => Math.atan2(d[1], d[0]) / DEG;
  const up = seen.headBasis.up;
  return {
    points: [
      ...[
        seen.head,
        seen.chest,
        seen.pelvis,
        seen.elbows[0],
        seen.wrists[0],
        seen.elbows[1],
        seen.wrists[1],
        seen.knees[0],
        seen.ankles[0],
        seen.knees[1],
        seen.ankles[1],
      ].flatMap(flat),
      Math.atan2(up[0], -up[1]) / DEG,
      angle(seen.toes[0]),
      angle(seen.toes[1]),
      Math.max(0, seen.headBasis.forward[2]),
    ],
    joints: {
      leftShoulder: flat(seen.shoulders[0]),
      rightShoulder: flat(seen.shoulders[1]),
      leftHip: flat(seen.hips[0]),
      rightHip: flat(seen.hips[1]),
    },
    contacts: Object.fromEntries(
      Object.entries(contacts).map(([k, p]) => [k, flat(at(p!))]),
    ),
    canonical: true,
    label,
    rig: { world, view: seen, camera, contacts },
  };
}
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
  const body = posed(target);
  return body ? toFrame(body, target.shape) : legacyFrame(target);
}

// ---------------------------------------------------------- choreography
// Each body part follows its own keys. Values pass through the keys on a
// monotone cubic, so movement flows through intermediate beats without
// overshooting a joint, and starts and finishes at rest. A foot or hand is
// planted for a stretch only when both surrounding keys plant it in place.
type Lower = Pick<Body, "pelvis" | "feet" | "thigh">;
type Torso = Pick<Body, "pitch" | "roll" | "twist" | "neck">;
type Parts = { lower: Lower; torso: Torso; arms: [Arm, Arm]; camera: number };
type PartName = keyof Parts;
const three = (v?: Vec3) => v ?? [0, 0, 0];
const flatten: { [K in PartName]: (v: Parts[K]) => number[] } = {
  lower: (l) => [
    ...l.pelvis,
    l.thigh ?? 0,
    ...l.feet.flatMap((f) => [
      ...f.ankle,
      f.out,
      f.heel,
      f.knee ?? 0,
      ...three(f.kneeAt),
    ]),
  ],
  torso: (t) => [t.pitch, t.roll, t.twist, ...t.neck],
  arms: (a) =>
    a.flatMap((x) => [
      x.elev,
      x.plane,
      x.reach,
      ...three(x.wrist),
      ...three(x.pole),
      ...three(x.hand),
    ]),
  camera: (c) => [c],
};
const same = (a?: Vec3, b?: Vec3) =>
  a === b || (!!a && !!b && a.every((v, i) => Math.abs(v - b[i]) < 1e-9));
class Track<T> {
  keys: { t: number; v: T; f: number[] }[] = [];
  private slopes?: number[][];
  constructor(private flat: (v: T) => number[]) {}
  push(t: number, v: T) {
    const last = this.keys[this.keys.length - 1];
    if (last && t < last.t - 1e-9) throw new Error("Keys must be in order");
    if (last && t < last.t + 1e-9) {
      last.v = v;
      last.f = this.flat(v);
    } else this.keys.push({ t, v, f: this.flat(v) });
    this.slopes = undefined;
  }
  get last() {
    return this.keys[this.keys.length - 1];
  }
  // The stretch between keys holding t. At a key, a phase's last sample
  // belongs to the stretch before it and the next phase's first to the one after.
  segment(t: number, end = false) {
    let i = 0;
    const edge = end ? -1e-9 : 1e-9;
    while (i < this.keys.length - 1 && this.keys[i + 1].t <= t + edge) i++;
    return i;
  }
  // Fritsch–Butland slopes keep every value monotone between its keys.
  private tangents() {
    const k = this.keys,
      n = k.length;
    return (this.slopes ??= k.map((key, i) =>
      key.f.map((_, c) => {
        if (i === 0 || i === n - 1) return 0;
        const h0 = key.t - k[i - 1].t,
          h1 = k[i + 1].t - key.t;
        const d0 = (key.f[c] - k[i - 1].f[c]) / h0,
          d1 = (k[i + 1].f[c] - key.f[c]) / h1;
        if (d0 * d1 <= 0) return 0;
        return (3 * (h0 + h1)) / ((2 * h1 + h0) / d0 + (h1 + 2 * h0) / d1);
      }),
    ));
  }
  values(t: number): number[] {
    const k = this.keys,
      i = this.segment(t);
    if (i === k.length - 1 || t <= k[0].t) return k[i].f;
    const m = this.tangents(),
      h = k[i + 1].t - k[i].t;
    const s = Math.min(1, Math.max(0, (t - k[i].t) / h)),
      s2 = s * s,
      s3 = s2 * s;
    return k[i].f.map(
      (a, c) =>
        (2 * s3 - 3 * s2 + 1) * a +
        (s3 - 2 * s2 + s) * h * m[i][c] +
        (3 * s2 - 2 * s3) * k[i + 1].f[c] +
        (s3 - s2) * h * m[i + 1][c],
    );
  }
  // The keys either side of t, for planted contacts and optional fields.
  around(t: number, end = false): [T, T] {
    const i = this.segment(t, end);
    return [this.keys[i].v, this.keys[Math.min(i + 1, this.keys.length - 1)].v];
  }
}
type Key<T> = { at: number; v?: T };
type Change = { [K in PartName]?: Parts[K] | Key<Parts[K]>[] };
const isKeys = <T>(v: T | Key<T>[]): v is Key<T>[] =>
  Array.isArray(v) && typeof (v[0] as Key<T>)?.at === "number";
// Every key carries an explicit elbow and hand direction, so both turn
// smoothly between poses; the forearm stands in for an unspecified hand.
const withHands = (arms: [Arm, Arm]): [Arm, Arm] =>
  arms.map((a, i) => ({
    ...a,
    pole: a.pole ?? ELBOW,
    hand: a.hand ?? forearmLocal(a, i === 0 ? 1 : -1),
  })) as [Arm, Arm];

class Choreo {
  t = 0;
  labels: { t: number; label: string; back: string }[] = [];
  tracks = {
    lower: new Track<Lower>(flatten.lower),
    torso: new Track<Torso>(flatten.torso),
    arms: new Track<[Arm, Arm]>(flatten.arms),
    camera: new Track<number>(flatten.camera),
  };
  constructor(public start: Body) {
    this.put(0, start);
  }
  private put(t: number, b: Body) {
    this.tracks.lower.push(t, { pelvis: b.pelvis, feet: b.feet, thigh: b.thigh });
    this.tracks.torso.push(t, {
      pitch: b.pitch,
      roll: b.roll,
      twist: b.twist,
      neck: b.neck,
    });
    this.tracks.arms.push(t, withHands(b.arms));
    this.tracks.camera.push(t, b.camera);
  }
  get now(): Body {
    const { lower, torso, arms, camera } = this.tracks;
    return {
      ...lower.last.v,
      ...torso.last.v,
      arms: arms.last.v,
      camera: camera.last.v,
    };
  }
  // One cue. Parts given as a value move across the beat; key lists place
  // values at fractions of it, may start late, or spill into the next beat.
  beat(duration: number, label: string, back: string, change: Change) {
    const t0 = this.t;
    this.labels.push({ t: t0, label, back });
    for (const name of Object.keys(change) as PartName[]) {
      const spec = change[name]!;
      const keys: Key<unknown>[] = isKeys(spec) ? spec : [{ at: 1, v: spec }];
      const track = this.tracks[name] as Track<unknown>;
      for (const key of keys) {
        const t = t0 + key.at * duration;
        if (key.v === undefined) {
          if (track.last.t < t - 1e-9) track.push(t, track.last.v);
          continue;
        }
        if (track.last.t < t0 - 1e-9) track.push(t0, track.last.v);
        track.push(t, name === "arms" ? withHands(key.v as [Arm, Arm]) : key.v);
      }
    }
    this.t = t0 + duration;
    return this;
  }
  to(body: Body, duration: number, label: string, back: string) {
    return this.beat(duration, label, back, {
      lower: { pelvis: body.pelvis, feet: body.feet, thigh: body.thigh },
      torso: {
        pitch: body.pitch,
        roll: body.roll,
        twist: body.twist,
        neck: body.neck,
      },
      arms: body.arms,
      camera: body.camera,
    });
  }
  // Plays another route backwards from where this one stands.
  reverse(other: Choreo) {
    const total = other.duration,
      t0 = this.t;
    for (const name of Object.keys(this.tracks) as PartName[]) {
      const source = other.tracks[name] as Track<unknown>;
      const target = this.tracks[name] as Track<unknown>;
      for (const key of source.keys.slice().reverse()) {
        const t = t0 + total - key.t;
        if (target.last.t < t0 - 1e-9) target.push(t0, target.last.v);
        target.push(t, key.v);
      }
    }
    const ends = other.labels.map((l, i) => other.labels[i + 1]?.t ?? total);
    for (let i = other.labels.length - 1; i >= 0; i--)
      this.labels.push({
        t: t0 + total - ends[i],
        label: other.labels[i].back,
        back: other.labels[i].label,
      });
    this.t = t0 + total;
    return this;
  }
  get duration() {
    return Math.max(
      this.t,
      ...Object.values(this.tracks).map((k) => (k as Track<unknown>).last.t),
    );
  }
  body(t: number, end = false): Body {
    const { lower, torso, arms, camera } = this.tracks;
    const lv = lower.values(t),
      [la, lb] = lower.around(t, end);
    const feet = la.feet.map((fa, j): Foot => {
      const fb = lb.feet[j],
        o = 4 + j * 9;
      const planted =
        fa.contact &&
        fb.contact &&
        same(fa.ankle, fb.ankle) &&
        same(fa.kneeAt, fb.kneeAt);
      if (planted)
        return { ...fa, out: lv[o + 3], heel: lv[o + 4], knee: lv[o + 5] };
      return {
        ankle: [lv[o], lv[o + 1], lv[o + 2]],
        out: lv[o + 3],
        heel: lv[o + 4],
        knee: lv[o + 5],
        kneeAt: fa.kneeAt && [lv[o + 6], lv[o + 7], lv[o + 8]],
        contact: false,
      };
    }) as [Foot, Foot];
    const tv = torso.values(t),
      av = arms.values(t),
      [aa, ab] = arms.around(t, end);
    const armsNow = aa.map((a, j): Arm => {
      const b = ab[j],
        o = j * 12;
      const planted = !!a.contact && !!b.contact && same(a.wrist, b.wrist);
      return {
        elev: av[o],
        plane: av[o + 1],
        reach: av[o + 2],
        wrist: a.wrist && (planted ? a.wrist : [av[o + 3], av[o + 4], av[o + 5]]),
        contact: planted,
        pole: [av[o + 6], av[o + 7], av[o + 8]],
        hand: [av[o + 9], av[o + 10], av[o + 11]],
      };
    }) as [Arm, Arm];
    return {
      pelvis: [lv[0], lv[1], lv[2]],
      thigh: la.thigh === undefined ? undefined : lv[3],
      feet,
      pitch: tv[0],
      roll: tv[1],
      twist: tv[2],
      neck: [tv[3], tv[4], tv[5]],
      arms: armsNow,
      camera: camera.values(t)[0],
    };
  }
  plan(from: PoseTarget, to: PoseTarget): MotionPlan {
    const total = this.duration;
    const phases = this.labels
      .map((l, i) => {
        const start = l.t,
          end = this.labels[i + 1]?.t ?? total;
        return {
          duration: end - start,
          label: l.label,
          sample: (p: number) =>
            toFrame(this.body(start + p * (end - start), p >= 1), l.label),
        };
      })
      .filter((p) => p.duration > 1e-6);
    return {
      from,
      to,
      phases,
      duration: phases.reduce((n, p) => n + p.duration, 0),
      manual: false,
      label: phases[0]?.label ?? "Ready",
    };
  }
}

// ----------------------------------------------------------------- routes
const lowerOf = (b: Body): Lower => ({
  pelvis: b.pelvis,
  feet: b.feet,
  thigh: b.thigh,
});
const torsoOf = (b: Body): Torso => ({
  pitch: b.pitch,
  roll: b.roll,
  twist: b.twist,
  neck: b.neck,
});
// A lifted foot travels on an arc: it peels off and clears the mat while the
// pelvis stays over the standing foot, then reaches down as weight follows.
function swing(
  b: Body,
  i: 0 | 1,
  to: Foot,
  pelvisMid: Vec3,
  pelvisEnd: Vec3,
  height = 12,
  travel = 0.5,
): Key<Lower>[] {
  const from = b.feet[i].ankle;
  const along = (k: number, lift: number, forward: number): Vec3 => [
    from[0] + (to.ankle[0] - from[0]) * k,
    Math.min(from[1], to.ankle[1]) - lift,
    from[2] + (to.ankle[2] - from[2]) * k + forward,
  ];
  const airborne = (ankle: Vec3, k: number, heel: number): Foot => ({
    ankle,
    out: b.feet[i].out + (to.out - b.feet[i].out) * k,
    heel,
    knee: to.knee,
    contact: false,
  });
  const feet = (f: Foot) =>
    (i === 0 ? [f, b.feet[1]] : [b.feet[0], f]) as [Foot, Foot];
  const late = 0.85;
  return [
    {
      at: 0.45,
      v: {
        pelvis: pelvisMid,
        feet: feet(
          airborne(
            along(travel, height, 6),
            0.5,
            Math.max(22, (b.feet[i].heel + to.heel) / 2),
          ),
        ),
      },
    },
    {
      at: 0.8,
      v: {
        pelvis: pelvisMid.map(
          (v, k) => v + (pelvisEnd[k] - v) * 0.7,
        ) as Vec3,
        feet: feet(airborne(along(late, 3, 2), 0.9, 8 + to.heel * 0.8)),
      },
    },
    { at: 1, v: { pelvis: pelvisEnd, feet: feet(to) } },
  ];
}
const withPelvis = (b: Body, pelvis: Vec3): Body => settle({ ...b, pelvis });

function fromMountain(c: Choreo, to: PoseTarget) {
  const end = standing(to),
    m = mountain();
  switch (to.shape) {
    case "reach":
      c.beat(2.4, "Sweep your arms up", "Lower your arms", {
        arms: end.arms,
        torso: [{ at: 0.3 }, { at: 1, v: torsoOf(end) }],
      });
      return;
    case "chair":
      c.beat(1.4, "Raise your arms forward", "Lower your arms", {
        arms: [{ at: 1.5, v: end.arms }],
        camera: [{ at: 2.2, v: end.camera }],
      });
      c.beat(2.1, "Bend your knees and sit back", "Straighten your legs", {
        lower: lowerOf(end),
        torso: torsoOf(end),
      });
      return;
    case "fold": {
      const soft = withPelvis(m, [180, STAND + 2.5, -3]);
      c.beat(1.0, "Soften your knees", "Stand tall", {
        lower: lowerOf(soft),
        arms: pair({ ...hanging, elev: 12, plane: 85 }),
        camera: [{ at: 2.8, v: end.camera }],
      });
      c.beat(2.6, "Hinge forward from your hips", "Roll up slowly", {
        lower: lowerOf(end),
        torso: [
          { at: 0.85, v: { ...torsoOf(end), neck: [10, 0, 0] } },
          { at: 1, v: torsoOf(end) },
        ],
        arms: end.arms,
      });
      return;
    }
    case "tree":
      treeFrom(c, to.side, true);
      return;
    case "warrior":
    case "triangle":
      stepWide(c, to.side);
      descend(c, to);
      return;
  }
}
// Shift onto the standing leg, then lift the other foot to rest against its
// ankle, knee turned out. Hands come together while the foot settles.
function treeFrom(c: Choreo, side: Side | undefined, hands: boolean) {
  const end = standing({ shape: "tree", side });
  const f = limbOf(side),
    d = dirOf(side);
  const shifted = withPelvis(c.now, [end.pelvis[0] + 1 * d, STAND, 0]);
  c.beat(1.0, `Shift onto your ${side} foot`, "Shift back to centre", {
    lower: lowerOf(shifted),
  });
  const lifted = end.feet[1 - f];
  c.beat(1.6, "Lift your foot to your ankle", "Lower your foot", {
    lower: swing(shifted, (1 - f) as 0 | 1, lifted, end.pelvis, end.pelvis, 10),
    // Hands gather in front of the belly before rising to the heart.
    ...(hands && {
      arms: [
        { at: 0.5 },
        { at: 1.05, v: pair<Arm>({ elev: 30, plane: 110, reach: 52 }) },
        { at: 1.6, v: end.arms },
      ],
    }),
  });
  if (hands)
    c.beat(1.0, "Bring your palms together", "Release your hands", {});
}
// Two side steps into a wide stance, then the front foot turns out.
function stepWide(c: Choreo, side?: Side) {
  const d = dirOf(side),
    f = limbOf(side),
    b = (1 - f) as 0 | 1;
  const front = sideName(d),
    back = sideName(-d);
  const m = c.now;
  const backX = m.feet[b].ankle[0];
  const shift = withPelvis(m, [backX + 4 * d, STAND, 0]);
  c.beat(0.9, `Shift onto your ${back} foot`, "Centre your weight", {
    lower: lowerOf(shift),
  });
  const out1 = foot(180 + 54 * d);
  const land1 = withPelvis(
    {
      ...shift,
      feet: (f === 1 ? [shift.feet[0], out1] : [out1, shift.feet[1]]) as [
        Foot,
        Foot,
      ],
    },
    [backX + 8 * d, STAND, 0],
  );
  c.beat(1.3, `Step your ${front} foot out`, `Step your ${front} foot in`, {
    lower: swing(
      shift,
      f as 0 | 1,
      out1,
      [backX + 5 * d, (shift.pelvis[1] + land1.pelvis[1]) / 2, 0],
      land1.pelvis,
    ),
  });
  const over = withPelvis(land1, [180 + 42 * d, STAND, 0]);
  c.beat(1.0, `Shift onto your ${front} foot`, `Shift onto your ${back} foot`, {
    lower: lowerOf(over),
  });
  const out2 = foot(180 - 54 * d);
  const feet2 = (f === 1 ? [out2, over.feet[1]] : [over.feet[0], out2]) as [
    Foot,
    Foot,
  ];
  const land2 = withPelvis({ ...over, feet: feet2 }, [180 + 6 * d, STAND, 0]);
  c.beat(1.4, `Step your ${back} foot out`, `Step your ${back} foot in`, {
    lower: swing(
      over,
      b,
      out2,
      [180 + 36 * d, over.pelvis[1] + 2, 0],
      land2.pelvis,
      9,
      0.4,
    ),
  });
  const open = straddle(side);
  c.beat(
    1.6,
    `Turn your ${front} foot out and open your arms`,
    `Turn your ${front} foot forward and lower your arms`,
    {
      lower: lowerOf(open),
      arms: [{ at: 0.1 }, { at: 1, v: open.arms }],
    },
  );
}
// From the wide stance into warrior or triangle on the same side.
function descend(c: Choreo, to: PoseTarget) {
  const end = standing(to),
    side = sideName(dirOf(to.side));
  if (to.shape === "warrior")
    c.beat(
      1.8,
      `Bend your ${side} knee and look past your ${side} hand`,
      `Straighten your ${side} leg`,
      {
        lower: lowerOf(end),
        torso: [{ at: 0.2 }, { at: 1, v: torsoOf(end) }],
      },
    );
  else
    c.beat(
      2.6,
      `Reach toward your ${side} foot and tilt sideways`,
      "Rise back up to standing",
      {
        lower: [{ at: 0.6, v: lowerOf(end) }],
        torso: [{ at: 0.1 }, { at: 1, v: torsoOf(end) }],
        arms: [{ at: 0.15 }, { at: 1, v: end.arms }],
      },
    );
}
function pivot(c: Choreo, to?: Side) {
  const end = straddle(to);
  c.beat(1.8, `Turn your feet toward the ${sideName(dirOf(to))}`, "Turn back", {
    lower: lowerOf(end),
  });
}
function along(build: (c: Choreo) => void, start: Body) {
  const c = new Choreo(start);
  build(c);
  return c;
}
// Narrow-stance poses with a direct route between them.
function direct(c: Choreo, from: PoseTarget, to: PoseTarget): boolean {
  const a = from.shape,
    b = to.shape;
  const run = (start: PoseTarget, build: (c: Choreo) => void) =>
    c.reverse(along(build, standing(start)));
  const forward = (x: Shape, y: Shape) => a === x && b === y;
  const backward = (x: Shape, y: Shape) => a === y && b === x;
  const swan = (k: Choreo) => {
    const end = standing({ shape: "fold" });
    // A swan dive: the arms open out like wings, then hang as she folds.
    const wings: Arm = { elev: 100, plane: 6, reach: 79 };
    const up = "Rise with your arms sweeping up";
    k.beat(3.8, "Sweep your arms out and fold", up, {
      lower: [{ at: 0.15 }, { at: 0.9, v: lowerOf(end) }],
      torso: [
        { at: 0.8, v: { ...torsoOf(end), neck: [12, 0, 0] } },
        { at: 1, v: torsoOf(end) },
      ],
      arms: [
        { at: 0.4, v: pair(wings) },
        { at: 1, v: end.arms },
      ],
      camera: [{ at: 0.3 }, { at: 0.95, v: end.camera }],
    });
  };
  const sit = (k: Choreo) => {
    const end = standing({ shape: "chair" });
    k.beat(3.0, "Bend your knees and sit back", "Straighten your legs", {
      lower: [{ at: 0.1 }, { at: 1, v: lowerOf(end) }],
      torso: [{ at: 0.1 }, { at: 1, v: torsoOf(end) }],
      arms: [{ at: 0.9, v: end.arms }],
      camera: [{ at: 0.8, v: end.camera }],
    });
  };
  const deepen = (k: Choreo) => {
    const end = standing({ shape: "fold" });
    k.beat(3.2, "Fold forward over your legs", "Rise into a squat", {
      lower: lowerOf(end),
      torso: [
        { at: 0.8, v: { ...torsoOf(end), neck: [14, 0, 0] } },
        { at: 1, v: torsoOf(end) },
      ],
      arms: end.arms,
      camera: end.camera,
    });
  };
  const heart = (side?: Side) => (k: Choreo) => {
    k.beat(1.8, "Bring your palms to your heart", "Sweep your arms up", {
      arms: pair(prayer),
      torso: torsoOf(mountain()),
    });
    treeFrom(k, side, false);
  };
  const rise = (side?: Side) => (k: Choreo) => {
    const m = mountain();
    // Palms meet overhead, then travel down the midline to the heart.
    const joined: Arm = { elev: 170, plane: 160, reach: 76, pole: [1, 0, -0.2] };
    k.beat(2.8, "Rise up and bring your palms together", "Sit back into chair", {
      lower: lowerOf(m),
      torso: torsoOf(m),
      arms: [
        { at: 0.35, v: pair(joined) },
        { at: 1, v: pair(prayer) },
      ],
      camera: [{ at: 0.6, v: m.camera }],
    });
    treeFrom(k, side, false);
  };
  if (forward("reach", "fold")) swan(c);
  else if (backward("reach", "fold")) run(to, swan);
  else if (forward("reach", "chair")) sit(c);
  else if (backward("reach", "chair")) run(to, sit);
  else if (forward("chair", "fold")) deepen(c);
  else if (backward("chair", "fold")) run(to, deepen);
  else if (forward("reach", "tree")) heart(to.side)(c);
  else if (backward("reach", "tree")) run(to, heart(from.side));
  else if (forward("chair", "tree")) rise(to.side)(c);
  else if (backward("chair", "tree")) run(to, rise(from.side));
  else if (a === "tree" && b === "tree") {
    // Hands stay at the heart while the feet change over.
    const start = standing(from),
      f = limbOf(from.side),
      lifted = (1 - f) as 0 | 1;
    const home = mountain().feet[lifted];
    const centre = withPelvis(
      {
        ...start,
        feet: (lifted === 1
          ? [start.feet[0], home]
          : [home, start.feet[1]]) as [Foot, Foot],
      },
      start.pelvis,
    );
    c.beat(1.4, "Lower your foot to the mat", "Lift your foot", {
      lower: swing(start, lifted, home, start.pelvis, centre.pelvis, 5),
    });
    treeFrom(c, to.side, false);
  } else return false;
  return true;
}

function standingRoute(from: PoseTarget, to: PoseTarget): Choreo {
  const c = new Choreo(standing(from));
  const wideFrom = WIDE.includes(from.shape),
    wideTo = WIDE.includes(to.shape);
  if (wideFrom && wideTo) {
    c.reverse(along((k) => descend(k, from), straddle(from.side)));
    if (dirOf(from.side) !== dirOf(to.side)) pivot(c, to.side);
    descend(c, to);
    return c;
  }
  if (wideFrom) {
    c.reverse(along((k) => descend(k, from), straddle(from.side)));
    c.reverse(along((k) => stepWide(k, from.side), mountain()));
    fromMountain(c, to);
    return c;
  }
  if (direct(c, from, to)) return c;
  if (from.shape !== "mountain")
    c.reverse(along((k) => fromMountain(k, from), mountain()));
  fromMountain(c, to);
  return c;
}
// Rock back from hands and knees, walk the hands forward one at a time, then
// rest the hips toward the heels. Knees and the supporting palm stay planted.
function floorRoute(): Choreo {
  const c = new Choreo(tabletop());
  const back = kneeling(12, 72, 14, palms(26));
  c.beat(1.3, "Ease your hips back", "Bring your hips over your knees", {
    lower: lowerOf(back),
    torso: torsoOf(back),
  });
  // The chest lowers a little with each hand so the reach stays comfortable.
  const walk = (i: 0 | 1, from: [Vec3, Vec3], pitch: number) => {
    const to = from.slice() as [Vec3, Vec3];
    to[i] = [from[i][0], from[i][1], CHILD_REACH];
    const mid = from.slice() as [Vec3, Vec3];
    mid[i] = [from[i][0], from[i][1] - 9, (from[i][2] + CHILD_REACH) / 2];
    c.beat(1.2, "Walk one hand forward", "Walk one hand back", {
      arms: [
        { at: 0.5, v: kneeling(12, pitch, 14, mid, i).arms },
        { at: 1, v: kneeling(12, pitch, 14, to).arms },
      ],
      torso: torsoOf(kneeling(12, pitch, 14, to)),
    });
    return to;
  };
  walk(1, walk(0, palms(26), 76), 80);
  const end = child();
  c.beat(1.8, "Rest back toward your heels", "Rise onto your hands and knees", {
    lower: lowerOf(end),
    torso: torsoOf(end),
  });
  return c;
}

export function planMotion(from: PoseTarget, to: PoseTarget): MotionPlan {
  const same = from.shape === to.shape && from.side === to.side;
  if (same)
    return { from, to, phases: [], duration: 0, manual: false, label: "Ready" };
  if (STANDING.includes(from.shape) && STANDING.includes(to.shape))
    return standingRoute(from, to).plan(from, to);
  const floor = ["tabletop", "child"];
  if (floor.includes(from.shape) && floor.includes(to.shape)) {
    const route = floorRoute();
    if (from.shape === "tabletop") return route.plan(from, to);
    return new Choreo(child()).reverse(route).plan(from, to);
  }
  return {
    from,
    to,
    phases: [],
    duration: 0,
    manual: true,
    label: "Change position at your own pace",
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
