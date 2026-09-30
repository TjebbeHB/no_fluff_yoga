export type Shape =
  | "mountain"
  | "reach"
  | "fold"
  | "lunge"
  | "warrior"
  | "triangle"
  | "seated"
  | "child"
  | "rest"
  | "chair"
  | "tree"
  | "sidebend"
  | "butterfly"
  | "tabletop";
export type Pose = {
  name: string;
  shape: Shape;
  cue: string;
  side?: "left" | "right";
  seconds: number;
};
export type Routine = {
  id: string;
  custom?: boolean;
  name: string;
  minutes: number;
  mood: string;
  description: string;
  color: string;
  art: Shape;
  poses: Pose[];
};
const p = (
  name: string,
  shape: Shape,
  cue: string,
  seconds = 60,
  side?: "left" | "right",
): Pose => ({ name, shape, cue, seconds, side });
const mountain = p(
  "Mountain pose",
  "mountain",
  "Feet grounded. Soften your knees and let your shoulders settle.",
);
const reach = p(
  "Upward reach",
  "reach",
  "Reach gently overhead. Keep your ribs soft and breathe freely.",
);
const fold = p(
  "Standing fold",
  "fold",
  "Bend your knees and hinge from your hips. Let your head feel heavy.",
);
const seated = p(
  "Easy seat",
  "seated",
  "Sit comfortably, with support if you like. Lengthen through your spine.",
);
const child = p(
  "Child’s pose",
  "child",
  "Ease your hips toward your heels. Rest your forehead on a cushion if needed.",
);
const rest = p(
  "Rest",
  "rest",
  "Lie comfortably on your back. Let your arms, legs, and breath soften.",
);
const warrior = (side: "left" | "right") =>
  p(
    "Warrior II",
    "warrior",
    `Turn your ${side} foot out. Bend that knee over your ankle and reach both arms wide.`,
    60,
    side,
  );
const lunge = (side: "left" | "right") =>
  p(
    "Low lunge",
    "lunge",
    `Step your ${side} foot forward. Lower your back knee onto padding and lift your chest.`,
    60,
    side,
  );
const triangle = (side: "left" | "right") =>
  p(
    "Triangle pose",
    "triangle",
    `Reach toward your ${side} foot. Rest your lower hand on your shin or a block; keep both sides long.`,
    60,
    side,
  );
const chair = p(
  "Chair pose",
  "chair",
  "Sit your hips back a little. Keep your knees comfortable and your weight in your feet.",
);
const tree = (side: "left" | "right") =>
  p(
    "Low tree",
    "tree",
    `Balance on your ${side} leg. Rest your other toes on the floor, heel at your ankle. Use a wall for support.`,
    45,
    side,
  );
const sidebend = (side: "left" | "right") =>
  p(
    "Seated side bend",
    "sidebend",
    `Keep both sitting bones grounded. Lean gently to your ${side}, with your lower hand supporting you.`,
    45,
    side,
  );
const butterfly = p(
  "Butterfly seat",
  "butterfly",
  "Bring the soles of your feet together. Let your knees soften outward, with cushions underneath if needed.",
);
const tabletop = p(
  "Tabletop",
  "tabletop",
  "Place your hands below your shoulders and knees below your hips. Pad your knees and keep your neck long.",
);
export const poseLibrary: Array<Pose & { id: string }> = [
  mountain,
  reach,
  fold,
  seated,
  child,
  rest,
  lunge("left"),
  lunge("right"),
  warrior("left"),
  warrior("right"),
  triangle("left"),
  triangle("right"),
  chair,
  tree("left"),
  tree("right"),
  sidebend("left"),
  sidebend("right"),
  butterfly,
  tabletop,
].map((pose) => ({
  ...pose,
  id: `${pose.shape}${pose.side ? `-${pose.side}` : ""}`,
}));
export const totalSeconds = (routine: Routine) =>
  routine.poses.reduce((sum, pose) => sum + pose.seconds, 0);
export const durationLabel = (seconds: number) =>
  seconds % 60 === 0
    ? `${seconds / 60} min`
    : `${Math.floor(seconds / 60)} min ${seconds % 60} sec`;
export const routines: Routine[] = [
  {
    id: "morning",
    name: "Morning flow",
    minutes: 10,
    mood: "AWAKEN & ENERGIZE",
    description: "A little movement. A brighter beginning.",
    color: "#EEDBC6",
    art: "lunge",
    poses: [
      mountain,
      reach,
      fold,
      lunge("left"),
      warrior("left"),
      lunge("right"),
      warrior("right"),
      fold,
      seated,
      rest,
    ],
  },
  {
    id: "gentle",
    name: "Gentle stretch",
    minutes: 15,
    mood: "RELEASE & RESTORE",
    description: "Make a little space in your body and your day.",
    color: "#DFE4D5",
    art: "triangle",
    poses: [
      seated,
      mountain,
      reach,
      triangle("left"),
      warrior("left"),
      triangle("right"),
      warrior("right"),
      fold,
      child,
      rest,
    ].map((p) => ({ ...p, seconds: 90 })),
  },
  {
    id: "evening",
    name: "Evening unwind",
    minutes: 12,
    mood: "SLOW DOWN & EXHALE",
    description: "Let the day settle. Find your softer pace.",
    color: "#E9D7C9",
    art: "seated",
    poses: [
      seated,
      reach,
      fold,
      lunge("left"),
      lunge("right"),
      child,
      seated,
      rest,
    ].map((p) => ({ ...p, seconds: 90 })),
  },
  {
    id: "grounded",
    name: "Find your balance",
    minutes: 6,
    mood: "STEADY & GROUNDED",
    description: "A short standing practice to find your centre.",
    color: "#DDE3CF",
    art: "tree",
    poses: [mountain, chair, tree("left"), tree("right"), reach, mountain].map(
      (pose) => ({ ...pose, seconds: 60 }),
    ),
  },
  {
    id: "seated-softness",
    name: "Seated softness",
    minutes: 7,
    mood: "SPACE & SOFTNESS",
    description: "Stay close to the earth. Make room to breathe.",
    color: "#E9D7C9",
    art: "sidebend",
    poses: [
      { ...seated, seconds: 60 },
      { ...sidebend("left"), seconds: 60 },
      { ...sidebend("right"), seconds: 60 },
      { ...butterfly, seconds: 90 },
      { ...rest, seconds: 150 },
    ],
  },
  {
    id: "little-reset",
    name: "A little reset",
    minutes: 5,
    mood: "PAUSE & RESET",
    description: "Five quiet minutes, from hands and knees to rest.",
    color: "#DFE4D5",
    art: "tabletop",
    poses: [tabletop, child, seated, butterfly, rest],
  },
];
export function locatePose(routine: Routine, elapsed: number) {
  let start = 0;
  for (let index = 0; index < routine.poses.length; index++) {
    const pose = routine.poses[index];
    if (elapsed < start + pose.seconds)
      return {
        index,
        remaining: Math.ceil(start + pose.seconds - elapsed),
        start,
      };
    start += pose.seconds;
  }
  return { index: routine.poses.length, remaining: 0, start };
}
export const formatTime = (seconds: number) =>
  `${Math.floor(Math.max(0, seconds) / 60)
    .toString()
    .padStart(2, "0")}:${Math.ceil(Math.max(0, seconds) % 60)
    .toString()
    .padStart(2, "0")}`;
