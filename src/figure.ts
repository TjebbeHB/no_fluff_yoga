// Drawing geometry for the figure: turns a posed skeleton into 2D shapes,
// keeping depth so limbs layer correctly and the head turns in 3D.
import type { MotionFrame } from "./motion";
import type { Vec } from "./poseGeometry";
import {
  add,
  Basis,
  cross,
  mul,
  Skeleton,
  sub,
  unit,
  Vec3,
} from "./rig";

const DEG = Math.PI / 180;
export type Figure = Skeleton & { depth: boolean };
const n2 = (v: number) => Math.round(v * 100) / 100;
export const pt = (p: Vec | Vec3) => `${n2(p[0])} ${n2(p[1])}`;
const flat = (p: Vec3): Vec => [p[0], p[1]];
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

// Legacy target drawings have no depth: they are read as a flat front view.
export function figureOf(frame: MotionFrame, side?: "left" | "right"): Figure {
  if (frame.rig) return { ...frame.rig.view, depth: true };
  const p = frame.points,
    j = frame.joints;
  const v = (i: number): Vec3 => [p[i], p[i + 1], 0];
  const z = (q: Vec): Vec3 => [q[0], q[1], 0];
  const tilt = p[22] * DEG;
  const up: Vec3 = [Math.sin(tilt), -Math.cos(tilt), 0];
  const turned = side === "left" ? -1 : 1;
  // Side-on drawings get a three-quarter face so her features stay readable.
  const forward: Vec3 =
    p[25] < 0.5
      ? unit([
          Math.cos(tilt) * turned * 0.85,
          Math.sin(tilt) * turned * 0.85,
          0.53,
        ])
      : [0, 0, 1];
  const basis = (u: Vec3, f: Vec3): Basis => ({
    up: u,
    forward: f,
    left: cross(u, f),
  });
  const head = v(0),
    elbows: [Vec3, Vec3] = [v(6), v(10)],
    wrists: [Vec3, Vec3] = [v(8), v(12)];
  const hand = (i: 0 | 1): Vec3 =>
    wrists[i][1] >= 270 && elbows[i][1] < 255 && head[1] < 200
      ? [turned, 0, 0]
      : unit(sub(wrists[i], elbows[i]));
  const toe = (a: number): Vec3 => [Math.cos(a * DEG), Math.sin(a * DEG), 0];
  const sole = (a: number): Vec3 => [Math.sin(a * DEG), -Math.cos(a * DEG), 0];
  return {
    head,
    chest: v(2),
    pelvis: v(4),
    shoulders: [z(j.leftShoulder), z(j.rightShoulder)],
    hips: [z(j.leftHip), z(j.rightHip)],
    elbows,
    wrists,
    knees: [v(14), v(18)],
    ankles: [v(16), v(20)],
    hands: [hand(0), hand(1)],
    toes: [toe(p[23]), toe(p[24])],
    soles: [sole(p[23]), sole(p[24])],
    chestBasis: basis(unit(sub(v(2), v(4))), [0, 0, 1]),
    headBasis: basis(up, forward),
    depth: false,
  };
}

// ---------------------------------------------------------------- paths
export function smooth(points: Vec[], closed = true, tension = 1): string {
  const n = points.length;
  if (n < 2) return "";
  const at = (i: number) =>
    closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))];
  let d = `M${pt(points[0])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1),
      p1 = at(i),
      p2 = at(i + 1),
      p3 = at(i + 2);
    const c1: Vec = [
      p1[0] + ((p2[0] - p0[0]) / 6) * tension,
      p1[1] + ((p2[1] - p0[1]) / 6) * tension,
    ];
    const c2: Vec = [
      p2[0] - ((p3[0] - p1[0]) / 6) * tension,
      p2[1] - ((p3[1] - p1[1]) / 6) * tension,
    ];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return closed ? `${d}Z` : d;
}
export function hull(points: Vec[]): Vec[] {
  const p = points
    .filter((q) => Number.isFinite(q[0]) && Number.isFinite(q[1]))
    .slice()
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const turn = (o: Vec, a: Vec, b: Vec) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Vec[] = [],
    upper: Vec[] = [];
  for (const q of p) {
    while (lower.length > 1 && turn(lower.at(-2)!, lower.at(-1)!, q) <= 0)
      lower.pop();
    lower.push(q);
  }
  for (const q of p.slice().reverse()) {
    while (upper.length > 1 && turn(upper.at(-2)!, upper.at(-1)!, q) <= 0)
      upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
// A tapered band along a polyline, for clumps of hair.
export function ribbon(points: Vec[], widths: number[]): string {
  const left: Vec[] = [],
    right: Vec[] = [];
  points.forEach((p, i) => {
    const a = points[Math.max(0, i - 1)],
      c = points[Math.min(points.length - 1, i + 1)];
    const l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
    const tx = (c[0] - a[0]) / l,
      ty = (c[1] - a[1]) / l,
      w = widths[i] / 2;
    left.push([p[0] - ty * w, p[1] + tx * w]);
    right.push([p[0] + ty * w, p[1] - tx * w]);
  });
  return smooth([...left, ...right.reverse()], true, 0.9);
}

// ---------------------------------------------------------------- torso
// Half-widths along the spine (0 = shoulders, 1 = hip joints) seen from the
// front, and from the side for the chest-facing and back-facing edges.
const TORSO_T = [-0.08, 0, 0.12, 0.28, 0.45, 0.6, 0.78, 0.92, 1.02, 1.1];
const FRONT_W = [8, 15.6, 15.4, 13.6, 11.6, 11.4, 14.4, 17, 16.6, 11];
const CHEST_W = [7, 11.5, 15.6, 14.4, 10.8, 10, 11.4, 12, 11, 7];
const BACK_W = [7, 12.6, 13.2, 12, 10.6, 10.2, 13.6, 15.6, 14.6, 8];
const table = (w: number[], t: number) => {
  if (t <= TORSO_T[0]) return w[0];
  for (let i = 1; i < TORSO_T.length; i++)
    if (t <= TORSO_T[i]) {
      const k = (t - TORSO_T[i - 1]) / (TORSO_T[i] - TORSO_T[i - 1]);
      const s = k * k * (3 - 2 * k);
      return mix(w[i - 1], w[i], s);
    }
  return w[w.length - 1];
};
export type TorsoArt = {
  body: string;
  shirt: string;
  hem: string;
  waist: string;
  neckline: string;
  stripes: string;
  stripeOpacity: number;
  shade: string;
};
export function torsoArt(fig: Figure): TorsoArt {
  const s = flat(fig.chest),
    p = flat(fig.pelvis);
  const length = Math.hypot(p[0] - s[0], p[1] - s[1]) || 1;
  const u: Vec = [(p[0] - s[0]) / length, (p[1] - s[1]) / length];
  const n: Vec = [-u[1], u[0]];
  const f = fig.chestBasis.forward;
  const facing = f[0] * n[0] + f[1] * n[1];
  const side = clamp(Math.abs(facing) * 1.2),
    front = facing >= 0 ? 1 : -1;
  const width = (t: number, sign: number) =>
    mix(table(FRONT_W, t), table(sign === front ? CHEST_W : BACK_W, t), side);
  const at = (t: number, w: number): Vec => [
    s[0] + u[0] * t * length + n[0] * w,
    s[1] + u[1] * t * length + n[1] * w,
  ];
  const edge = (from: number, to: number, sign: number, grow = 0) => {
    const out: Vec[] = [];
    const steps = 9;
    for (let i = 0; i <= steps; i++) {
      const t = mix(from, to, i / steps);
      out.push(at(t, sign * (width(t, sign) + grow)));
    }
    return out;
  };
  // Skin shows only around the neckline; clothes cover the rest.
  const body = smooth([
    ...edge(-0.04, 0.35, 1),
    ...edge(0.35, -0.04, -1),
    at(-0.11, 0),
  ]);
  const hemT = 0.9;
  const neckDip = 0.08 + 0.05 * (1 - side);
  const neckShift = side * front * 5;
  const shirtTop: Vec[] = [
    at(-0.05, -width(-0.05, -1) * 0.55),
    at(neckDip, neckShift),
    at(-0.05, width(-0.05, 1) * 0.55),
  ];
  const shirt = smooth(
    [
      ...edge(0.02, hemT, 1, 0.7),
      at(hemT + 0.035, 0),
      ...edge(hemT, 0.02, -1, 0.7),
      at(-0.06, -width(-0.06, -1) * 0.8),
      ...shirtTop,
      at(-0.06, width(-0.06, 1) * 0.8),
    ],
    true,
    0.9,
  );
  const hem = `M${pt(at(hemT - 0.01, -width(hemT, -1) - 0.6))} Q${pt(at(hemT + 0.05, 0))} ${pt(at(hemT - 0.01, width(hemT, 1) + 0.6))}`;
  const waist = smooth([
    ...edge(0.8, 1.05, 1, 0.4),
    at(1.11, 0),
    ...edge(1.05, 0.8, -1, 0.4),
  ]);
  const neckline = `M${pt(shirtTop[0])} Q${pt(at(neckDip + 0.04, neckShift))} ${pt(shirtTop[2])}`;
  // Breton stripes run across the body at a steady pitch.
  const pitch = 6.4 / length;
  let stripes = "";
  // Start below the neckline so no stripe crosses the skin there.
  for (let t = neckDip + 0.06; t < hemT - 0.03; t += pitch) {
    const a = at(t, -width(t, -1) - 0.2),
      b = at(t, width(t, 1) + 0.2);
    const bow = at(t + (0.9 / Math.max(length, 24)) * (1 - side), 0);
    stripes += `M${pt(a)} Q${pt(bow)} ${pt(b)}`;
  }
  const shade = `M${pt(at(0.08, front * width(0.08, front) * 0.3))} Q${pt(at(0.5, front * 2))} ${pt(at(0.85, front * width(0.85, front) * 0.35))}`;
  return {
    body,
    shirt,
    hem,
    waist,
    neckline,
    stripes,
    // A torso seen end-on would squeeze stripes together; fade them instead.
    stripeOpacity: clamp((length - 24) / 20),
    shade,
  };
}

// ----------------------------------------------------------------- head
// The head is built in its own frame: x toward the viewer's right when she
// faces you, y down, z out of the face. Features live on a skull sphere and
// are projected, so the face turns, nods and hangs upside down convincingly.
const SKULL: Vec3 = [0, -3, -1.5];
export const SKULL_R = 14.2;
type Sprite = { m: string; o: number; flip: boolean };
export type HeadArt = {
  skull: { c: Vec; r: number };
  face: string;
  jaw: string;
  neck: [Vec, Vec, Vec];
  eyes: Sprite[];
  brows: Sprite[];
  cheeks: Sprite[];
  freckles: Vec[];
  nose: { ridge: string; tip: string; ridgeOpacity: number } | null;
  mouth: {
    open: string;
    teeth: string;
    upper: string;
    lower: string;
    closed: string;
  } | null;
  bangs: string[];
  part: string | null;
  clumps: { d: string; strand: string; front: boolean; z: number }[];
  // Hair up: a round bun high on the back of the head instead of long hair.
  bun: { c: Vec; r: number; shine: string; front: boolean } | null;
  shine: string;
  earrings: Vec[];
  // With hair up the ears show, turned with the head.
  ears: { c: Vec; angle: number }[];
  // Facing away (hanging in a fold): long hair falls over the head instead.
  away: boolean;
};
export function headArt(fig: Figure, bunned = false): HeadArt {
  const b = fig.headBasis;
  const ex = mul(b.left, -1),
    ey = mul(b.up, -1),
    ez = b.forward;
  const local = (q: Vec3): Vec3 =>
    add(fig.head, add(add(mul(ex, q[0]), mul(ey, q[1])), mul(ez, q[2])));
  const at = (q: Vec3): Vec => flat(local(q));
  const facing = (nrm: Vec3) =>
    nrm[0] * ex[2] + nrm[1] * ey[2] + nrm[2] * ez[2];
  const dir = (lon: number, lat: number): Vec3 => [
    Math.sin(lon * DEG) * Math.cos(lat * DEG),
    -Math.sin(lat * DEG),
    Math.cos(lon * DEG) * Math.cos(lat * DEG),
  ];
  const centre = at(SKULL);
  // Surface points behind the skull are pulled onto its outline instead.
  const sphere = (lon: number, lat: number, r = SKULL_R): Vec => {
    const d = dir(lon, lat);
    const q = at(add(SKULL, mul(d, r)));
    if (facing(d) >= 0) return q;
    const dx = q[0] - centre[0],
      dy = q[1] - centre[1];
    const l = Math.hypot(dx, dy) || 1;
    const rim = Math.min(r, SKULL_R);
    return [centre[0] + (dx / l) * rim, centre[1] + (dy / l) * rim];
  };
  // Long hair hangs in tapered clumps from ear level around the head. Each
  // puffs out a little from the skull and then falls with gravity, so it
  // frames her face when upright and drapes toward the mat in a fold.
  const upright = -b.up[1];
  const tipLevel = fig.head[1] + 46 + 14 * clamp(-upright);
  const clumps: HeadArt["clumps"] = [];
  // longitude, latitude, width, extra length, puff away from the skull
  const CLUMPS: [number, number, number, number, number][] = [
    [180, 10, 11.5, 3, 2],
    [-146, 7, 10, 1, 2.2],
    [146, 7, 10, 1, 2.2],
    [-110, 18, 9.5, 0, 2.2],
    [110, 18, 9.5, 0, 2.2],
    [-92, 22, 7.6, -2, 1],
    [92, 22, 7.6, -2, 1],
  ];
  for (const [lon, lat, width, extra, puff] of bunned ? [] : CLUMPS) {
    const d = dir(lon, lat);
    // Roots sit just inside the crown so each clump grows out of it.
    const root = at(add(SKULL, mul(d, SKULL_R - 1.2)));
    const out3 = add(mul(ex, d[0]), mul(ez, d[2]));
    const ol = Math.hypot(out3[0], out3[1]);
    const out: Vec = ol > 0.05 ? [out3[0] / ol, out3[1] / ol] : [0, 0];
    const side = Math.sign(out[0] || lon);
    const length = Math.max(8, tipLevel - root[1] + extra);
    const wave = (k: number): Vec => [-out[1] * k * side, out[0] * k * side];
    const along = (k: number, puff: number, w: number): Vec => {
      const q: Vec = [
        root[0] + out[0] * puff + wave(w)[0],
        root[1] + out[1] * puff + wave(w)[1] + length * k,
      ];
      // Hair pools on the mat rather than passing through it.
      return q[1] <= 285 ? q : [q[0] + side * (q[1] - 285) * 0.6, 285];
    };
    const points = [
      root,
      along(0.12, puff * 0.7, 0),
      along(0.42, puff, 0.7),
      along(0.76, puff * 0.8, -0.6),
      along(1, puff * 0.3, 0.3),
    ];
    clumps.push({
      d: ribbon(points, [0.35, 1, 1, 0.7, 0.18].map((k) => k * width)),
      strand: smooth(
        [
          along(0.14, puff * 0.5, 0),
          along(0.45, puff * 0.8, 0.5),
          along(0.8, puff * 0.6, -0.4),
        ],
        false,
      ),
      front: Math.abs(lon) < 100 && facing(d) > -0.05,
      z: facing(d),
    });
  }
  clumps.sort((a, c) => a.z - c.z);

  // Face skin, clipped to the skull, then the jaw and chin below it.
  const hairline: [number, number][] = [
    [-84, -34],
    [-80, -8],
    [-74, 10],
    [-60, 26],
    [-38, 35],
    [-14, 38],
    [0, 36],
    [14, 38],
    [38, 35],
    [60, 26],
    [74, 10],
    [80, -8],
    [84, -34],
    [55, -75],
    [0, -88],
    [-55, -75],
  ];
  const face = smooth(
    hairline.map(([lon, lat]) => sphere(lon, lat)),
    true,
    0.8,
  );
  const jawPoints: Vec3[] = [
    [-13.3, 0.5, 4.2],
    [13.3, 0.5, 4.2],
    [-12.4, 5.6, 4],
    [12.4, 5.6, 4],
    [-10.4, 9.8, 3.2],
    [10.4, 9.8, 3.2],
    [-6, 14, 7.6],
    [6, 14, 7.6],
    [-2.8, 15.5, 9],
    [2.8, 15.5, 9],
    [0, 15.9, 9.4],
    [-8, 11, -3],
    [8, 11, -3],
    [0, 11.5, -5],
  ];
  const jaw = smooth(hull(jawPoints.map(at)), true, 0.9);

  // Features sit on small tangent planes so they foreshorten as she turns.
  const sprite = (
    lon: number,
    lat: number,
    r: number,
    flip = false,
  ): Sprite | null => {
    const d = dir(lon, lat);
    const o = facing(d);
    if (o < 0.08) return null;
    const p = at(add(SKULL, mul(d, r)));
    const tx: Vec3 = [Math.cos(lon * DEG), 0, -Math.sin(lon * DEG)];
    const X = add(mul(ex, tx[0]), mul(ez, tx[2])),
      Y = ey;
    return {
      m: `matrix(${n2(X[0])} ${n2(X[1])} ${n2(Y[0])} ${n2(Y[1])} ${n2(p[0])} ${n2(p[1])})`,
      o: clamp((o - 0.08) * 4),
      flip,
    };
  };
  const keep = <T,>(list: (T | null)[]) => list.filter((x): x is T => !!x);
  const eyes = keep([sprite(-21, -14.5, 13.9, true), sprite(21, -14.5, 13.9)]);
  const brows = keep([sprite(-22, 5, 14.3, true), sprite(22, 5, 14.3)]);
  const cheeks = keep([sprite(-44, -27, 13.6, true), sprite(44, -27, 13.6)]);
  const freckles = (
    [
      [-4, -12],
      [3, -13],
      [-1, -16],
      [6, -15],
      [-17, -18],
      [-23, -22],
      [-13, -24],
      [-28, -16],
      [-20, -27],
      [18, -19],
      [25, -23],
      [14, -25],
      [30, -17],
      [21, -28],
      [9, -21],
      [-8, -21],
    ] as [number, number][]
  )
    .filter(([lon, lat]) => facing(dir(lon, lat)) > 0.3)
    .map(([lon, lat]) => at(add(SKULL, mul(dir(lon, lat), 13.95))));

  const front = facing([0, 0.15, 1]);
  const profile = Math.min(1, Math.hypot(ez[0], ez[1]));
  let nose: HeadArt["nose"] = null,
    mouth: HeadArt["mouth"] = null;
  if (front > 0.05) {
    const bridge = at([0, -0.8, 13.1]),
      tipTop = at([0, 3.6, 15.1]),
      tip = at([0, 5, 15.2]),
      base = at([0, 6.3, 13.5]);
    const wings = [at([-2, 5.6, 12.7]), at([2, 5.6, 12.7])];
    nose = {
      ridge: `M${pt(bridge)} Q${pt(tipTop)} ${pt(tip)} Q${pt(at([0, 6.2, 14.6]))} ${pt(base)} L${pt(at([0, 5.8, 12.6]))}Z`,
      tip: `M${pt(wings[0])} Q${pt(at([0, 6.6, 14.2]))} ${pt(wings[1])}`,
      ridgeOpacity: profile,
    };
    // A broad, open smile; far points slide toward the middle when hidden.
    const centreMouth: Vec3 = [0, 9.2, 12.4];
    const m = (q: Vec3): Vec => {
      const nrm = unit([q[0], (q[1] - 4) * 0.25, q[2] + 2]);
      if (facing(nrm) > 0.02) return at(q);
      return at(q.map((v, i) => mix(v, centreMouth[i], 0.55)) as Vec3);
    };
    const cl = m([-5, 8.6, 9.3]),
      cr = m([5, 8.6, 9.3]);
    const uq = [m([-2.6, 7.9, 11.6]), m([2.6, 7.9, 11.6])],
      um = m([0, 8.2, 12.5]);
    const lq = [m([-2.9, 11.5, 10.7]), m([2.9, 11.5, 10.7])],
      lm = m([0, 12.3, 11.5]);
    const tq = [m([-2.8, 9.6, 11.6]), m([2.8, 9.6, 11.6])],
      tm = m([0, 10, 12.3]);
    mouth = {
      open: smooth([cl, uq[0], um, uq[1], cr, lq[1], lm, lq[0]], true, 0.9),
      teeth: smooth([cl, uq[0], um, uq[1], cr, tq[1], tm, tq[0]], true, 0.9),
      upper: smooth([cl, uq[0], um, uq[1], cr], false),
      lower: smooth([cl, lq[0], lm, lq[1], cr], false),
      // A soft closed smile along the same mouth, corners turned up.
      closed: smooth(
        [
          m([-4.6, 8.4, 9.5]),
          m([-2.4, 9.5, 11.7]),
          m([0, 9.9, 12.5]),
          m([2.4, 9.5, 11.7]),
          m([4.6, 8.4, 9.5]),
        ],
        false,
      ),
    };
  }

  // Curtain bangs part in the middle and sweep out past the cheekbones.
  const bang = (s: number): string | null => {
    const path: [number, number][] = [
      [3, 47],
      [26, 50],
      [52, 42],
      [72, 26],
      [83, 8],
      [79, -6],
      [70, -2],
      [57, 6],
      [41, 13],
      [24, 21],
      [9, 30],
    ];
    // Seen from above (a nodding head) the parting closes, so the bangs read
    // as one fringe instead of two dark lenses over the eyes.
    const shut = clamp((facing(dir(0, 50)) - 0.72) / 0.2);
    path.forEach((q) => (q[0] -= shut * Math.min(q[0], 10)));
    const vis = path.reduce(
      (n, [lon, lat]) => n + facing(dir(s * lon, lat)),
      0,
    );
    if (vis / path.length < -0.2) return null;
    return smooth(
      path.map(([lon, lat]) => sphere(s * lon, lat, SKULL_R + 0.9)),
      true,
      0.85,
    );
  };
  const bangs = keep([bang(-1), bang(1)]);
  const part =
    facing(dir(0, 55)) > 0.35
      ? `M${pt(sphere(0, 70, SKULL_R + 0.6))} Q${pt(sphere(1, 58, SKULL_R + 0.8))} ${pt(sphere(2, 45, SKULL_R + 0.8))}`
      : null;

  const shine =
    facing(dir(-28, 66)) > 0.2 && facing(dir(-52, 52)) > 0
      ? `M${pt(sphere(-52, 52, SKULL_R - 0.6))} Q${pt(sphere(-28, 66, SKULL_R - 0.4))} ${pt(sphere(-4, 70, SKULL_R - 0.6))}`
      : "";
  // Small hoops hang from the lobes, below the jaw line.
  const lobe = (s: number): Vec3 =>
    bunned ? [13.5 * s, 7.4, -1.6] : [12.6 * s, 11.6, -1];
  const earrings = keep(
    [-1, 1].map((s) =>
      facing(unit([s, 0.25, -0.1])) > -0.35 ? at(lobe(s)) : null,
    ),
  ).map((q): Vec => [q[0], q[1] + 1.9]);
  const ears = bunned
    ? keep(
        [-1, 1].map((s) =>
          facing(unit([s, 0, -0.15])) > -0.4
            ? {
                c: at([13.7 * s, 2.8, -1.6]),
                angle: Math.atan2(b.up[0], -b.up[1]) / DEG,
              }
            : null,
        ),
      )
    : [];
  let bun: HeadArt["bun"] = null;
  if (bunned) {
    const d = dir(180, 38);
    const c = at(add(SKULL, mul(d, SKULL_R + 3.2)));
    const z = facing(d);
    bun = {
      c,
      r: 7.6,
      shine: `M${pt([c[0] - 4.6, c[1] - 1.5])} Q${pt([c[0] - 2.5, c[1] - 5.2])} ${pt([c[0] + 1.8, c[1] - 5.6])}`,
      front: z > 0.25,
    };
  }
  return {
    skull: { c: centre, r: SKULL_R },
    face,
    jaw,
    neck: [flat(fig.chest), at([0, 4, -3.5]), at([0, 9.5, -3])],
    eyes,
    brows,
    cheeks,
    freckles,
    nose,
    mouth,
    bangs,
    part,
    clumps,
    bun,
    shine,
    earrings,
    ears,
    away: front < -0.1,
  };
}

// --------------------------------------------------------------- layering
export type ArmPart = "whole" | "upper" | "lower";
export type Layer =
  | { kind: "arm"; i: 0 | 1; back: boolean; part: ArmPart }
  | { kind: "leg"; i: 0 | 1; back: boolean }
  | { kind: "hair" }
  | { kind: "torso" }
  | { kind: "head" };
// Painter's order from depth. Legs and limbs behind the torso are drawn
// first; anything reaching in front can pass over the torso or the head. An
// arm crossing the body splits at the elbow: the upper arm (and sleeve) stays
// behind while the forearm comes forward, as in prayer.
export function layers(fig: Figure): Layer[] {
  const z = (p: Vec3) => p[2];
  const torso = (z(fig.chest) + z(fig.pelvis)) / 2;
  const legZ = (i: 0 | 1) =>
    (z(fig.hips[i]) + z(fig.knees[i]) * 2 + z(fig.ankles[i])) / 4;
  const upperZ = (i: 0 | 1) => (z(fig.shoulders[i]) + z(fig.elbows[i])) / 2;
  const lowerZ = (i: 0 | 1) => (z(fig.elbows[i]) + z(fig.wrists[i]) * 3) / 4;
  const near = (a: number, b: number) => (a >= b ? 1 : 0);
  if (!fig.depth)
    return [
      { kind: "arm", i: 1, back: true, part: "whole" },
      { kind: "hair" },
      { kind: "leg", i: 1, back: true },
      { kind: "leg", i: 0, back: false },
      { kind: "arm", i: 0, back: false, part: "upper" },
      { kind: "torso" },
      { kind: "head" },
      { kind: "arm", i: 0, back: false, part: "lower" },
    ];
  const legNear = near(legZ(0), legZ(1));
  const armNear = near(lowerZ(0), lowerZ(1));
  const behind: { z: number; layer: Layer }[] = [];
  const inFront: { z: number; layer: Layer }[] = [];
  const place = (key: number, layer: Layer) =>
    (key > torso + 3 ? inFront : behind).push({ z: key, layer });
  ([0, 1] as const).forEach((i) => {
    behind.push({
      z: legZ(i),
      layer: { kind: "leg", i, back: legNear !== i },
    });
    const back = armNear !== i;
    const upper = upperZ(i),
      lower = lowerZ(i);
    if (upper > torso + 3 === lower > torso + 3)
      place(lower, { kind: "arm", i, back, part: "whole" });
    else {
      place(upper, { kind: "arm", i, back, part: "upper" });
      place(lower, { kind: "arm", i, back, part: "lower" });
    }
  });
  behind.push({ z: fig.head[2] - 9, layer: { kind: "hair" } });
  inFront.push({ z: fig.head[2] + 2, layer: { kind: "head" } });
  const order = (list: typeof behind) =>
    list.sort((a, b) => a.z - b.z).map((x) => x.layer);
  return [...order(behind), { kind: "torso" }, ...order(inFront)];
}
// Hands and feet are small side-view drawings turned to their 3D direction.
export function handTransform(fig: Figure, i: 0 | 1): string {
  const w = fig.wrists[i],
    h = fig.hands[i];
  const l = Math.hypot(h[0], h[1]);
  const a = Math.atan2(h[1], h[0]) / DEG;
  return `translate(${pt(w)}) rotate(${n2(a)}) scale(${n2(Math.max(0.5, l))} 1)`;
}
export function footTransform(fig: Figure, i: 0 | 1): string {
  const ankle = fig.ankles[i],
    t = fig.toes[i],
    s = fig.soles[i];
  const l = Math.hypot(t[0], t[1]);
  const a = l < 0.05 ? 90 : Math.atan2(t[1], t[0]) / DEG;
  // The top of the foot must face the sole's "up"; flip when it would not.
  const upX = Math.sin(a * DEG),
    upY = -Math.cos(a * DEG);
  const flip = s[0] * upX + s[1] * upY < 0 ? -1 : 1;
  return `translate(${pt(ankle)}) rotate(${n2(a)}) scale(${n2(Math.max(0.55, l))} ${flip})`;
}
