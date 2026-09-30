import { Shape } from "./routines";
// Head, shoulder, hip, left elbow/hand, right elbow/hand, left knee/foot, right knee/foot.
export const forms: Record<Shape, number[]> = {
  mountain: [
    180, 91, 180, 113, 180, 189, 151, 152, 153, 187, 208, 151, 206, 188, 168,
    235, 168, 280, 193, 235, 194, 280, 0, 0, 0, 1,
  ],
  reach: [
    180, 91, 180, 113, 180, 189, 152, 76, 163, 31, 208, 76, 197, 31, 168, 235,
    168, 280, 193, 235, 194, 280, 0, 0, 0, 1,
  ],
  warrior: [
    181, 105, 181, 127, 181, 195, 116, 132, 54, 130, 247, 131, 307, 128, 243,
    215, 251, 280, 126, 235, 79, 280, 0, 0, -15, 0,
  ],
  lunge: [
    205, 114, 197, 135, 169, 194, 218, 174, 227, 217, 181, 178, 193, 218, 236,
    210, 246, 280, 124, 270, 76, 279, -5, 0, -12, 0,
  ],
  triangle: [
    241, 152, 216, 166, 167, 187, 235, 209, 251, 254, 199, 120, 188, 67, 127,
    235, 89, 280, 216, 235, 250, 280, -20, -12, 0, 0,
  ],
  fold: [
    209, 209, 186, 185, 164, 142, 213, 231, 213, 275, 188, 231, 190, 273, 160,
    211, 156, 280, 179, 211, 180, 280, 115, 0, 0, 0,
  ],
  seated: [
    180, 144, 180, 166, 180, 232, 146, 210, 128, 248, 215, 207, 234, 248, 135,
    266, 203, 276, 225, 266, 155, 277, -5, 170, 10, 1,
  ],
  child: [
    238, 266, 210, 251, 149, 255, 259, 277, 300, 280, 257, 269, 293, 273, 193,
    277, 126, 279, 178, 278, 112, 280, 100, -12, -12, 0,
  ],
  rest: [
    85, 260, 117, 258, 194, 261, 139, 279, 176, 284, 142, 244, 176, 242, 237,
    262, 291, 279, 237, 249, 291, 266, -90, -90, -90, 0,
  ],
  chair: [
    192, 113, 184, 136, 156, 198, 205, 95, 210, 52, 230, 110, 242, 67, 204, 225,
    182, 280, 183, 227, 160, 280, 0, 0, 0, 0,
  ],
  tree: [
    180, 91, 180, 113, 180, 189, 144, 142, 177, 143, 216, 142, 183, 143, 164,
    235, 164, 280, 213, 231, 183, 286, 0, 0, 170, 1,
  ],
  sidebend: [
    209, 145, 192, 166, 180, 232, 144, 130, 199, 106, 239, 218, 267, 267, 135,
    266, 203, 276, 225, 266, 155, 277, 18, 170, 10, 1,
  ],
  butterfly: [
    180, 140, 180, 162, 180, 226, 151, 212, 173, 252, 210, 212, 187, 252, 122,
    255, 179, 278, 238, 255, 184, 278, 0, -90, -90, 1,
  ],
  tabletop: [
    253, 178, 231, 198, 151, 199, 235, 237, 236, 278, 217, 235, 216, 273, 145,
    272, 92, 279, 164, 264, 111, 271, 55, 0, 0, 0,
  ],
};
// Interpolate the spine in angle/length space rather than shrinking it through
// zero when moving from upright to a forward fold. Two-bone IK preserves limb
// lengths while the hand/foot targets travel toward the next illustrated pose.
export function interpolatePose(from: number[], to: number[], t: number) {
  if (t === 0) return from;
  const lerp = (a: number, b: number) => a + (b - a) * t;
  const next = to.map((v, i) => lerp(from[i], v));
  const polar = (child: number, parent: number) => {
    const ax = from[child] - from[parent],
      ay = from[child + 1] - from[parent + 1];
    const bx = to[child] - to[parent],
      by = to[child + 1] - to[parent + 1];
    const a = Math.atan2(ay, ax),
      b = Math.atan2(by, bx);
    const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
    const angle = a + delta * t,
      length = lerp(Math.hypot(ax, ay), Math.hypot(bx, by));
    next[child] = next[parent] + Math.cos(angle) * length;
    next[child + 1] = next[parent + 1] + Math.sin(angle) * length;
  };
  polar(2, 4);
  polar(0, 2);
  const solve = (root: number, joint: number, end: number) => {
    const length = (pose: number[], a: number, b: number) =>
      Math.hypot(pose[a] - pose[b], pose[a + 1] - pose[b + 1]);
    const upper = lerp(length(from, root, joint), length(to, root, joint));
    const lower = lerp(length(from, joint, end), length(to, joint, end));
    const dx = next[end] - next[root],
      dy = next[end + 1] - next[root + 1];
    const raw = Math.hypot(dx, dy) || 0.001;
    const distance = Math.max(
      Math.abs(upper - lower) + 0.001,
      Math.min(raw, upper + lower - 0.001),
    );
    const ux = dx / raw,
      uy = dy / raw;
    next[end] = next[root] + ux * distance;
    next[end + 1] = next[root + 1] + uy * distance;
    const along =
      (upper * upper - lower * lower + distance * distance) / (2 * distance);
    const height = Math.sqrt(Math.max(0, upper * upper - along * along));
    const refX = lerp(from[joint], to[joint]),
      refY = lerp(from[joint + 1], to[joint + 1]);
    const cx = next[root] + ux * along,
      cy = next[root + 1] + uy * along;
    const sign = (refX - cx) * -uy + (refY - cy) * ux >= 0 ? 1 : -1;
    next[joint] = cx - uy * height * sign;
    next[joint + 1] = cy + ux * height * sign;
  };
  solve(2, 6, 8);
  solve(2, 10, 12);
  solve(4, 14, 16);
  solve(4, 18, 20);
  return t === 1 ? to : next;
}
export type Vec = [number, number];
// A single closed contour follows each limb. Tangent normals and tapered radii
// keep elbows/knees soft while interpolating, including near-straight joints.
export function limbContour(
  a: Vec,
  b: Vec,
  c: Vec,
  r: [number, number, number],
) {
  const unit = (x: number, y: number): Vec => {
    const n = Math.hypot(x, y) || 1;
    return [x / n, y / n];
  };
  const u = unit(b[0] - a[0], b[1] - a[1]),
    v = unit(c[0] - b[0], c[1] - b[1]);
  const m = unit(u[0] + v[0], u[1] + v[1]);
  const n: Vec[] = [
    [-u[1], u[0]],
    [-m[1], m[0]],
    [-v[1], v[0]],
  ];
  const pos = (p: Vec, i: number, sign: number): Vec => [
    p[0] + n[i][0] * r[i] * sign,
    p[1] + n[i][1] * r[i] * sign,
  ];
  const A = pos(a, 0, 1),
    B = pos(b, 1, 1),
    C = pos(c, 2, 1),
    D = pos(c, 2, -1),
    E = pos(b, 1, -1),
    F = pos(a, 0, -1);
  const k = Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.3,
    l = Math.hypot(c[0] - b[0], c[1] - b[1]) * 0.3;
  const add = (p: Vec, d: Vec, t: number) =>
    `${p[0] + d[0] * t} ${p[1] + d[1] * t}`;
  return `M${A} C${add(A, u, k)} ${add(B, m, -k)} ${B} C${add(B, m, l)} ${add(C, v, -l)} ${C} Q${add(c, v, r[2])} ${D} C${add(D, v, -l)} ${add(E, m, l)} ${E} C${add(E, m, -k)} ${add(F, u, k)} ${F} Q${add(a, u, -r[0])} ${A}Z`;
}

// A small whitelist deliberately avoids suggesting a physical route between
// arbitrary custom poses. All other changes fade between stable target figures.
export function canMorphPose(
  from: Shape,
  to: Shape,
  fromSide?: string,
  toSide?: string,
) {
  if (fromSide !== toSide) return false;
  if (from === to) return true;
  return [
    ["mountain", "reach"],
    ["warrior", "triangle"],
  ].some((pair) => pair.includes(from) && pair.includes(to));
}
