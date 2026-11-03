// The Verdant mark: two leaves opening into a V around a rising sun. It reads
// as a seedling, a sunrise and a figure reaching up, and it stays legible down
// to a 16 px favicon. This one geometry draws the logo in the app
// (components/Logo.tsx) and every generated icon (scripts/generate_icons.cjs).

export type Point = [number, number];
// The mark is drawn on a 1024 × 1024 canvas, the size of an app icon.
export const MARK_CANVAS = 1024;

const LEAF = {
  // Where both leaves grow from, and how far each opens from vertical (deg).
  base: [512, 786] as Point,
  angle: 27,
  length: 470,
  halfWidth: 88,
  // The edge facing away from the centre is fuller than the inner edge.
  outer: 1.12,
  inner: 0.86,
  // Each leaf curls outward toward its tip (deg at the tip), like a seedling.
  bend: 9,
  // Where along the leaf it is widest (0 base → 1 tip), and how quickly it
  // widens from the base.
  belly: 0.44,
  shoulder: 0.62,
};

export const SUN = { cx: 512, cy: 292, r: 56 };

// A point on the leaf: `u` across it (positive to the right of its axis when
// upright) and `v` along it from the base.
function leafPoint(side: -1 | 1, u: number, v: number): Point {
  const t = v / LEAF.length;
  const angle = ((side * LEAF.angle + side * LEAF.bend * t * t) * Math.PI) / 180;
  const s = Math.sin(angle),
    c = Math.cos(angle);
  const [bx, by] = LEAF.base;
  return [bx + u * c + v * s, by + u * s - v * c];
}

// The leaf outline as two cubic curves: up the outer edge, back down the inner.
export function leafCurves(side: -1 | 1): Point[][] {
  const { length: L, halfWidth: w, outer, inner, belly, shoulder } = LEAF;
  const out = w * outer * side,
    inn = -w * inner * side;
  const at = (u: number, v: number) => leafPoint(side, u, v);
  const base = at(0, 0),
    tip = at(0, L);
  return [
    [base, at(out * shoulder * 1.25, L * 0.16), at(out * 1.32, L * (belly + 0.12)), tip],
    [tip, at(inn * 1.32, L * (belly + 0.12)), at(inn * shoulder * 1.25, L * 0.16), base],
  ];
}

const round = (n: number) => Math.round(n * 10) / 10;
const pt = ([x, y]: Point) => `${round(x)} ${round(y)}`;
function leafPath(side: -1 | 1) {
  const [up, down] = leafCurves(side);
  return `M${pt(up[0])} C${pt(up[1])} ${pt(up[2])} ${pt(up[3])} C${pt(down[1])} ${pt(down[2])} ${pt(down[3])}Z`;
}

export const MARK = {
  left: leafPath(-1),
  right: leafPath(1),
  sun: SUN,
  // A square around the mark, with a little room, for drawing it on its own.
  bounds: { x: 216, y: 216, size: 592 },
};

// On Android the launcher shows the middle 72 of the icon's 108 dp and keeps
// a 66 dp circle safe from masks. At this scale the mark has the same weight
// as on iOS and stays well inside that circle.
export const ANDROID_ICON_SCALE = 0.7;

export const BRAND = {
  // The mark on the app's ivory paper.
  paper: { left: "#8FA078", right: "#2E4A39", sun: "#E3A174" },
  // The mark on the forest-green app icon.
  icon: {
    left: "#C3D1AC",
    right: "#F6F1E4",
    sun: "#EDB48A",
    top: "#3F604B",
    bottom: "#22392B",
  },
  paperColor: "#F8F5ED",
  forest: "#2E4A39",
};

// Every point of the outline, sampled finely: used to check the mark fits the
// spaces Android and iOS allow for it.
export function markOutline(samples = 64): Point[] {
  const points: Point[] = [];
  for (const side of [-1, 1] as const)
    for (const [p0, p1, p2, p3] of leafCurves(side))
      for (let i = 0; i <= samples; i++) {
        const t = i / samples,
          m = 1 - t;
        const a = m * m * m,
          b = 3 * m * m * t,
          c = 3 * m * t * t,
          d = t * t * t;
        points.push([
          a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
          a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
        ]);
      }
  for (let i = 0; i < samples; i++) {
    const angle = (i / samples) * Math.PI * 2;
    points.push([
      SUN.cx + SUN.r * Math.cos(angle),
      SUN.cy + SUN.r * Math.sin(angle),
    ]);
  }
  return points;
}
