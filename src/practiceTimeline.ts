import { Routine } from "./routines";
import { MotionPlan, planMotion } from "./motion";
export type PracticeTimeline = {
  index: number;
  phase: "hold" | "move" | "reposition" | "complete";
  time: number;
  activeSeconds: number;
  plan: MotionPlan | null;
  queuedIndex: number | null;
};
export const initialTimeline = (): PracticeTimeline => ({
  index: 0,
  phase: "hold",
  time: 0,
  activeSeconds: 0,
  plan: null,
  queuedIndex: null,
});
function enter(
  state: PracticeTimeline,
  routine: Routine,
  index: number,
  reduced: boolean,
): PracticeTimeline {
  if (index >= routine.poses.length)
    return { ...state, index, phase: "complete", time: 0, queuedIndex: null };
  const plan = planMotion(routine.poses[state.index], routine.poses[index]);
  return {
    ...state,
    index,
    time: 0,
    plan,
    queuedIndex: null,
    phase:
      reduced || (plan.duration === 0 && !plan.manual)
        ? "hold"
        : plan.manual
          ? "reposition"
          : "move",
  };
}
export function nextPose(
  state: PracticeTimeline,
  routine: Routine,
  reduced: boolean,
): PracticeTimeline {
  if (state.phase === "complete") return state;
  if (state.phase === "move")
    return {
      ...state,
      queuedIndex: Math.min(
        routine.poses.length,
        (state.queuedIndex ?? state.index) + 1,
      ),
    };
  if (state.phase === "reposition") {
    const index = state.index + 1;
    if (index >= routine.poses.length)
      return { ...state, index, phase: "complete", queuedIndex: null };
    // Position changes are user-controlled; do not assume an unconfirmed posture.
    return { ...state, index, time: 0, plan: null };
  }
  return enter(state, routine, state.index + 1, reduced);
}
export function confirmPosition(state: PracticeTimeline): PracticeTimeline {
  return state.phase === "reposition"
    ? { ...state, phase: "hold", time: 0, plan: null }
    : state;
}
function arrive(
  state: PracticeTimeline,
  routine: Routine,
  reduced: boolean,
): PracticeTimeline {
  const settled = { ...state, phase: "hold" as const, time: 0, plan: null };
  return state.queuedIndex === null
    ? settled
    : enter(settled, routine, state.queuedIndex, reduced);
}
export function advanceTimeline(
  state: PracticeTimeline,
  seconds: number,
  routine: Routine,
  reduced: boolean,
): PracticeTimeline {
  let next = state,
    remaining = Math.max(0, seconds);
  if (reduced && next.phase === "move") next = arrive(next, routine, true);
  while (remaining > 0 && (next.phase === "hold" || next.phase === "move")) {
    const duration =
      next.phase === "hold"
        ? routine.poses[next.index].seconds
        : next.plan!.duration;
    const used = Math.min(remaining, Math.max(0, duration - next.time));
    next = {
      ...next,
      time: next.time + used,
      activeSeconds: next.activeSeconds + used,
    };
    remaining -= used;
    if (next.time >= duration - 1e-8)
      next =
        next.phase === "move"
          ? arrive(next, routine, reduced)
          : enter(next, routine, next.index + 1, reduced);
    else break;
  }
  return next;
}
