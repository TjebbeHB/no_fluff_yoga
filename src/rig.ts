// A small 3D skeleton viewed by an orthographic camera. Limbs keep their true
// lengths in 3D; the drawing sees their projection, so a knee that bends toward
// the viewer foreshortens instead of swinging sideways across the picture.
// Coordinates: x right, y down (the mat is y = 280), z toward the viewer. The
// body faces +z; "left" limbs are on the viewer's left when she faces forward.
export type Vec3 = [number, number, number];
export const add = (a: Vec3, b: Vec3): Vec3 => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];
export const sub = (a: Vec3, b: Vec3): Vec3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
export const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const unit = (a: Vec3): Vec3 => mul(a, 1 / (length(a) || 1));
const axes = (a: Vec3, b: Vec3, c: Vec3, k: Vec3): Vec3 =>
  add(add(mul(a, k[0]), mul(b, k[1])), mul(c, k[2]));

export const BONES = {
  spine: 70,
  neck: 22,
  upperArm: 40,
  forearm: 40,
  thigh: 46,
  shin: 46,
  shoulder: 14,
  hip: 12,
};
export const FLOOR = 280;
const DEG = Math.PI / 180;
const UP: Vec3 = [0, -1, 0];
const FORWARD: Vec3 = [0, 0, 1];
const LEFT: Vec3 = [-1, 0, 0];

export type Foot = {
  ankle: Vec3;
  // Toe heading in the floor plane, turned outward for that leg (degrees).
  out: number;
  // Toes stay down while the heel lifts; 180 lays the top of the foot flat.
  heel: number;
  // Extra outward heading of the knee relative to the toes.
  knee?: number;
  // Kneeling: the knee rests here; the thigh angle places the pelvis.
  kneeAt?: Vec3;
  contact: boolean;
};
export type Arm = {
  // Wrist direction in the chest frame: elevation from hanging (0) through
  // horizontal (90) to overhead (180), in a plane from out (0) to forward (90).
  elev: number;
  plane: number;
  reach: number;
  // Planted or walking hands use a world-space wrist instead.
  wrist?: Vec3;
  contact?: boolean;
  // Elbow and hand directions in the arm's frame: [out, up, forward].
  pole?: Vec3;
  hand?: Vec3;
};
// Elbows naturally point out, down and back. The arm's own direction is
// removed from this before solving, so the elbow points out when the arm is
// overhead, down when it reaches forward and back when it hangs, without
// ever lining up with the arm and flipping.
export const ELBOW: Vec3 = [1, -1, -0.5];
export type Body = {
  pelvis: Vec3;
  feet: [Foot, Foot];
  // Kneeling only: thigh angle from vertical, hips moving back toward heels.
  thigh?: number;
  pitch: number;
  roll: number;
  twist: number;
  // Neck pitch (nod forward), roll (tilt toward left) and turn (toward left).
  neck: Vec3;
  arms: [Arm, Arm];
  // Camera orbit around the mat centre: 0 faces her, 90 shows her right side.
  camera: number;
};
export type Basis = { left: Vec3; up: Vec3; forward: Vec3 };
export type Skeleton = {
  head: Vec3;
  chest: Vec3;
  pelvis: Vec3;
  shoulders: [Vec3, Vec3];
  hips: [Vec3, Vec3];
  elbows: [Vec3, Vec3];
  wrists: [Vec3, Vec3];
  knees: [Vec3, Vec3];
  ankles: [Vec3, Vec3];
  hands: [Vec3, Vec3];
  toes: [Vec3, Vec3];
  soles: [Vec3, Vec3];
  chestBasis: Basis;
  headBasis: Basis;
};

const heading = (side: number, out: number): Vec3 =>
  add(mul(FORWARD, Math.cos(out * DEG)), mul(LEFT, side * Math.sin(out * DEG)));
export const LEG_REACH = BONES.thigh + BONES.shin - 0.4;
export const ARM_REACH = BONES.upperArm + BONES.forearm - 0.5;

// Two-bone IK in 3D. The middle joint bends toward the pole, so knees track the
// toes and elbows stay behind the arm. Authored endpoints are never stretched.
export function bend(
  root: Vec3,
  end: Vec3,
  a: number,
  b: number,
  pole: Vec3,
): Vec3 {
  const d = sub(end, root),
    distance = length(d);
  if (distance > a + b + 1e-6 || distance < Math.abs(a - b) - 1e-6)
    throw new Error(
      `Unreachable authored contact: ${distance.toFixed(3)} / ${a + b}`,
    );
  const u = mul(d, 1 / (distance || 1));
  const along = (a * a - b * b + distance * distance) / (2 * (distance || 1));
  const h = Math.sqrt(Math.max(0, a * a - along * along));
  let n = sub(pole, mul(u, dot(pole, u)));
  if (length(n) < 1e-6) n = cross(u, Math.abs(u[1]) < 0.9 ? UP : FORWARD);
  return add(add(root, mul(u, along)), mul(unit(n), h));
}
function rotate(a: Vec3, b: Vec3, degrees: number): [Vec3, Vec3] {
  // Turns the pair (a, b) together: a toward b by the given angle.
  const c = Math.cos(degrees * DEG),
    s = Math.sin(degrees * DEG);
  return [add(mul(a, c), mul(b, s)), sub(mul(b, c), mul(a, s))];
}
export function chestBasis(body: Body): Basis {
  let forward = heading(1, -body.twist),
    left = cross(UP, forward),
    up = UP;
  [up, forward] = rotate(up, forward, body.pitch);
  [up, left] = rotate(up, left, body.roll);
  return { left, up, forward };
}
// The wrist offset from its shoulder, in world space, for a chest-frame arm.
export function armDirection(arm: Arm, side: number, chest: Basis): Vec3 {
  const e = arm.elev * DEG,
    p = arm.plane * DEG;
  return axes(mul(chest.left, side), chest.up, chest.forward, [
    Math.sin(e) * Math.cos(p),
    -Math.cos(e),
    Math.sin(e) * Math.sin(p),
  ]);
}
// The forearm direction of a free arm in its own chest frame, so every key can
// carry an explicit hand direction and hands turn smoothly between poses.
export function forearmLocal(arm: Arm, side: number): Vec3 {
  const canon: Basis = { left: LEFT, up: UP, forward: FORWARD };
  const out = mul(LEFT, side);
  const wrist = mul(
    armDirection(arm, side, canon),
    Math.min(arm.reach, ARM_REACH),
  );
  const elbow = bend(
    [0, 0, 0],
    wrist,
    BONES.upperArm,
    BONES.forearm,
    axes(out, UP, FORWARD, arm.pole ?? ELBOW),
  );
  const d = unit(sub(wrist, elbow));
  return [dot(d, out), dot(d, UP), dot(d, FORWARD)];
}
// The chest-frame description of a world-space wrist, used to aim a free arm
// at a point such as a shin or the floor.
export function armFromWrist(
  shoulder: Vec3,
  wrist: Vec3,
  side: number,
  chest: Basis,
): Pick<Arm, "elev" | "plane" | "reach"> {
  const d = sub(wrist, shoulder),
    reach = length(d);
  const out = dot(d, mul(chest.left, side)) / reach,
    up = dot(d, chest.up) / reach,
    forward = dot(d, chest.forward) / reach;
  return {
    elev: Math.acos(Math.max(-1, Math.min(1, -up))) / DEG,
    plane: Math.atan2(forward, out) / DEG,
    reach,
  };
}

// Where the pelvis must sit: kneeling hips swing around the knees, while
// planted feet hold a standing pelvis low enough that no leg overstretches.
export function restingPelvis(body: Body): Vec3 {
  const pelvis = body.pelvis.slice() as Vec3;
  if (body.thigh !== undefined) {
    const k0 = body.feet[0].kneeAt!,
      k1 = body.feet[1].kneeAt!;
    const t = body.thigh * DEG;
    pelvis[0] = (k0[0] + k1[0]) / 2;
    pelvis[1] = (k0[1] + k1[1]) / 2 - BONES.thigh * Math.cos(t);
    pelvis[2] = (k0[2] + k1[2]) / 2 - BONES.thigh * Math.sin(t);
    return pelvis;
  }
  body.feet.forEach((foot, i) => {
    if (!foot.contact) return;
    const hip = add(pelvis, mul(LEFT, (i === 0 ? 1 : -1) * BONES.hip));
    const flat = Math.hypot(foot.ankle[0] - hip[0], foot.ankle[2] - hip[2]);
    if (flat > LEG_REACH)
      throw new Error(`Unreachable stance: ${flat.toFixed(2)}`);
    const highest = foot.ankle[1] - Math.sqrt(LEG_REACH ** 2 - flat ** 2);
    if (pelvis[1] < highest) pelvis[1] = highest;
  });
  return pelvis;
}

export function solve(body: Body): Skeleton {
  const pelvis = restingPelvis(body);
  const chest = chestBasis(body);
  const chestCentre = add(pelvis, mul(chest.up, BONES.spine));
  let neckUp = chest.up,
    face = chest.forward,
    side = chest.left;
  [neckUp, face] = rotate(neckUp, face, body.neck[0]);
  [neckUp, side] = rotate(neckUp, side, body.neck[1]);
  [face, side] = rotate(face, side, body.neck[2]);
  const head = add(chestCentre, mul(neckUp, BONES.neck));
  const limbs = [0, 1].map((i) => {
    const s = i === 0 ? 1 : -1;
    const shoulder = add(chestCentre, mul(chest.left, s * BONES.shoulder));
    const arm = body.arms[i];
    // Free arms are described in the chest frame; planted and walking hands
    // use the level body frame so the floor stays put while the spine moves.
    const frame: [Vec3, Vec3, Vec3] = arm.wrist
      ? [mul(LEFT, s), UP, FORWARD]
      : [mul(chest.left, s), chest.up, chest.forward];
    let wrist: Vec3;
    if (arm.wrist) {
      wrist = arm.wrist;
      const d = sub(wrist, shoulder);
      if (length(d) > ARM_REACH + 0.5) {
        if (arm.contact) throw new Error("Unreachable planted hand");
        wrist = add(shoulder, mul(unit(d), ARM_REACH));
      }
    } else {
      const reach = Math.min(arm.reach, ARM_REACH);
      wrist = add(shoulder, mul(armDirection(arm, s, chest), reach));
    }
    const pole = axes(...frame, arm.pole ?? ELBOW);
    const elbow = bend(shoulder, wrist, BONES.upperArm, BONES.forearm, pole);
    const hand = arm.hand
      ? unit(axes(...frame, arm.hand))
      : unit(sub(wrist, elbow));
    const foot = body.feet[i];
    const hip = add(pelvis, mul(LEFT, s * BONES.hip));
    let ankle = foot.ankle;
    const stretch = sub(ankle, hip);
    // A lifted foot is pulled in rather than stretching the leg.
    if (!foot.kneeAt && !foot.contact && length(stretch) > LEG_REACH)
      ankle = add(hip, mul(unit(stretch), LEG_REACH));
    const knee =
      foot.kneeAt ??
      bend(
        hip,
        ankle,
        BONES.thigh,
        BONES.shin,
        heading(s, foot.out + (foot.knee ?? 0)),
      );
    const toeHeading = heading(s, foot.out);
    const lift = foot.heel * DEG;
    const toe = add(
      mul(toeHeading, Math.cos(lift)),
      mul([0, 1, 0], Math.sin(lift)),
    );
    const sole = add(mul(UP, Math.cos(lift)), mul(toeHeading, Math.sin(lift)));
    return { shoulder, elbow, wrist, hand, hip, knee, ankle, toe, sole };
  });
  const pair = <K extends keyof (typeof limbs)[0]>(k: K) =>
    [limbs[0][k], limbs[1][k]] as [Vec3, Vec3];
  return {
    head,
    chest: chestCentre,
    pelvis,
    shoulders: pair("shoulder"),
    hips: pair("hip"),
    elbows: pair("elbow"),
    wrists: pair("wrist"),
    knees: pair("knee"),
    ankles: pair("ankle"),
    hands: pair("hand"),
    toes: pair("toe"),
    soles: pair("sole"),
    chestBasis: chest,
    headBasis: { left: side, up: neckUp, forward: face },
  };
}

// The camera orbits the vertical axis through the middle of the mat.
export const PIVOT: Vec3 = [180, 0, 0];
export function view(p: Vec3, camera: number): Vec3 {
  const c = Math.cos(camera * DEG),
    s = Math.sin(camera * DEG);
  const x = p[0] - PIVOT[0],
    z = p[2] - PIVOT[2];
  return [PIVOT[0] + x * c + z * s, p[1], -x * s + z * c];
}
export function viewDirection(d: Vec3, camera: number): Vec3 {
  const c = Math.cos(camera * DEG),
    s = Math.sin(camera * DEG);
  return [d[0] * c + d[2] * s, d[1], -d[0] * s + d[2] * c];
}
