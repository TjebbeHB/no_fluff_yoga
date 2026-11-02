// What the audio guide says. Every line has a stable id: Paradee voice packs
// hold one recording per id, and the device voice reads the same text, so
// both voices always say exactly the same thing.
import { Routine } from "./routines";
import type { PracticeTimeline } from "./practiceTimeline";

export type GuideStyle = "detailed" | "brief";
export type GuideEvent =
  | { kind: "start" }
  | { kind: "change"; index: number }
  | { kind: "hold"; index: number }
  | { kind: "closing"; index: number }
  | { kind: "complete" };

type Side = "left" | "right";
type Script = {
  // Spoken name; written out so voices never read "II" as letters.
  name: string;
  // How to move into the pose, described for someone not looking at a screen.
  enter: (side: Side | undefined) => string;
  // What to feel and do while holding it.
  hold: string;
};
const other = (side?: Side) => (side === "left" ? "right" : "left");
const SCRIPTS: Record<string, Script> = {
  mountain: {
    name: "Mountain pose",
    enter: () =>
      "Come to stand with your feet about hip-width apart and your arms resting by your sides. Lengthen up through the top of your head.",
    hold: "Feel your feet grounded on the mat. Soften your knees, let your shoulders settle, and breathe slowly.",
  },
  reach: {
    name: "Upward reach",
    enter: () =>
      "Breathing in, sweep both arms out to the sides and up toward the sky. Reach gently through your fingertips.",
    hold: "Keep your shoulders soft and away from your ears. Let your ribs stay easy as you breathe.",
  },
  fold: {
    name: "Standing fold",
    enter: () =>
      "Soften your knees and hinge forward from your hips. Let your upper body hang down toward the mat.",
    hold: "Let your head feel heavy and your arms dangle. Bend your knees as much as you like.",
  },
  seated: {
    name: "Easy seat",
    enter: () =>
      "Come down to sit on your mat and cross your legs comfortably. A cushion under your hips can help.",
    hold: "Lengthen through your spine and rest your hands on your knees. Let each breath slow down.",
  },
  child: {
    name: "Child's pose",
    enter: () =>
      "Come onto your hands and knees. Sink your hips back toward your heels, and walk your hands forward as your forehead comes down to the mat.",
    hold: "Rest your forehead, on a cushion if you need one. Breathe into your back.",
  },
  rest: {
    name: "Rest",
    enter: () =>
      "Lie down on your back. Let your legs stretch out, and rest your arms a little away from your body, palms facing up.",
    hold: "Let your whole body feel heavy. There's nothing to do now but breathe.",
  },
  lunge: {
    name: "Low lunge",
    enter: (side) =>
      `Step your ${side} foot forward between your hands, and lower your ${other(side)} knee onto the mat, with some padding if you like. Lift your chest.`,
    hold: "Let your hips sink gently forward. Keep your front knee above your ankle, and breathe.",
  },
  warrior: {
    name: "Warrior two",
    enter: (side) =>
      `Step your feet wide apart. Turn your ${side} foot out and bend your ${side} knee over your ankle. Stretch both arms out wide, and look past your ${side} hand.`,
    hold: "Press into the outer edge of your back foot. Keep your shoulders relaxed, and breathe steadily.",
  },
  triangle: {
    name: "Triangle pose",
    enter: (side) =>
      `With your feet wide, turn your ${side} foot out and straighten both legs. Reach forward over your ${side} leg, rest your lower hand on your shin or a block, and lift your other arm toward the sky.`,
    hold: "Keep both sides of your waist long. Look up only if your neck feels comfortable.",
  },
  chair: {
    name: "Chair pose",
    enter: () =>
      "Bend your knees and sit your hips back, as if lowering onto a chair. Raise your arms alongside your ears.",
    hold: "Keep your weight in your heels and your chest lifting. Breathe steadily.",
  },
  tree: {
    name: "Low tree",
    enter: (side) =>
      `Shift your weight onto your ${side} foot. Turn your ${other(side)} knee out and rest that heel against your ${side} ankle, toes on the mat. Bring your palms together at your heart.`,
    hold: "Find a still point to look at. A wall nearby can help with balance. Breathe calmly.",
  },
  sidebend: {
    name: "Seated side bend",
    enter: (side) =>
      `Sit tall with your legs crossed. Place your ${side} hand on the mat beside you, sweep your ${other(side)} arm up, and lean gently to the ${side}.`,
    hold: "Keep both sitting bones grounded. Breathe into the long side of your body.",
  },
  butterfly: {
    name: "Butterfly seat",
    enter: () =>
      "Sitting tall, bring the soles of your feet together and let your knees fall open. Hold your feet or ankles.",
    hold: "Let your knees soften outward, with cushions underneath if you like. Breathe slowly.",
  },
  tabletop: {
    name: "Tabletop",
    enter: () =>
      "Come onto your hands and knees, with your hands under your shoulders and your knees under your hips.",
    hold: "Keep your neck long and your back level. Breathe evenly.",
  },
};
// Every move a routine can contain, as `shape` or `shape-side`.
const MOVES: [string, Side | undefined][] = Object.keys(SCRIPTS).flatMap(
  (shape) =>
    ["lunge", "warrior", "triangle", "tree", "sidebend"].includes(shape)
      ? ([
          [shape, "left"],
          [shape, "right"],
        ] as [string, Side][])
      : [[shape, undefined] as [string, Side | undefined]],
);
const moveId = (shape: string, side?: string) =>
  shape + (side ? `-${side}` : "");
const named = (shape: string, side?: Side) =>
  SCRIPTS[shape].name.toLowerCase() + (side ? `, ${side} side` : "");

const GENERAL: Record<string, string> = {
  intro:
    "Welcome. Find a comfortable spot on your mat, and let your breath settle.",
  outro:
    "That's the end of your practice. Stay here as long as you like. When you're ready, roll onto your side and come up slowly.",
  "outro.brief": "That's your practice. Well done.",
  switch: "Gently release, and let's do the other side.",
  "switch.brief": "Now the other side.",
  "breaths.0": "Stay for a few more breaths.",
  "breaths.1": "Two more slow breaths here.",
  "breaths.2": "Just a little longer. Keep breathing softly.",
  sample: "Hello. I'll guide you through your practice, one pose at a time.",
};
function buildLines(): Record<string, string> {
  const lines: Record<string, string> = { ...GENERAL };
  for (const [shape, side] of MOVES) {
    const id = moveId(shape, side),
      script = SCRIPTS[shape];
    const title = script.name + (side ? `, ${side} side` : "");
    lines[`${id}.first`] = `Let's begin with ${named(shape, side)}.`;
    lines[`${id}.next`] = `Next, ${named(shape, side)}.`;
    lines[`${id}.now`] = `Now, ${named(shape, side)}.`;
    lines[`${id}.enter`] = `${title}. ${script.enter(side)}`;
    lines[`${id}.hold`] = script.hold;
  }
  return lines;
}
export const GUIDE_LINES: Readonly<Record<string, string>> = buildLines();

// Which lines to say for a moment in the practice. Brief guidance names the
// next pose; detailed guidance also describes how to move into it and what
// to notice while holding it.
export function guideLines(
  routine: Routine,
  event: GuideEvent,
  style: GuideStyle,
): string[] {
  const detailed = style === "detailed";
  const id = (i: number) => {
    const pose = routine.poses[i];
    return pose ? moveId(pose.shape, pose.side) : undefined;
  };
  switch (event.kind) {
    case "start": {
      const first = id(0);
      if (!first) return [];
      return detailed
        ? ["intro", `${first}.enter`, `${first}.hold`]
        : [`${first}.first`];
    }
    case "change": {
      const move = id(event.index);
      if (!move) return [];
      const previous = routine.poses[event.index - 1],
        pose = routine.poses[event.index];
      const sideSwitch =
        !!previous &&
        previous.shape === pose.shape &&
        previous.side !== pose.side;
      if (detailed)
        return sideSwitch ? ["switch", `${move}.enter`] : [`${move}.enter`];
      if (sideSwitch) return ["switch.brief"];
      return [event.index % 2 ? `${move}.now` : `${move}.next`];
    }
    case "hold": {
      const move = id(event.index);
      return detailed && move ? [`${move}.hold`] : [];
    }
    case "closing":
      return detailed ? [`breaths.${event.index % 3}`] : [];
    case "complete":
      return [detailed ? "outro" : "outro.brief"];
  }
}
// The few seconds before a hold ends when detailed guidance invites a couple
// more breaths; shorter holds go straight to the next pose.
export const CLOSING_SECONDS = 9;
export const CLOSING_MIN_HOLD = 30;
export type Snapshot = Pick<PracticeTimeline, "index" | "phase">;
// Turns timeline changes into the moments the guide speaks at. A pose reached
// without any movement (the same pose again, or reduced motion) is both a
// change and the start of its hold.
export function guideEvents(
  previous: Snapshot | null,
  next: Snapshot,
): GuideEvent[] {
  if (next.phase === "complete")
    return previous?.phase === "complete" ? [] : [{ kind: "complete" }];
  if (!previous) return next.index === 0 ? [{ kind: "start" }] : [];
  if (previous.index !== next.index)
    return next.phase === "hold"
      ? [
          { kind: "change", index: next.index },
          { kind: "hold", index: next.index },
        ]
      : [{ kind: "change", index: next.index }];
  if (previous.phase !== next.phase && next.phase === "hold")
    return [{ kind: "hold", index: next.index }];
  return [];
}
