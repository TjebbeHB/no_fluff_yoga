import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { Routine } from "./routines";
import {
  advanceTimeline,
  confirmPosition,
  initialTimeline,
  nextPose,
} from "./practiceTimeline";
export function usePracticeTimeline(routine: Routine, paused: boolean) {
  const [state, setState] = useState(initialTimeline),
    [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (live) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  useEffect(() => {
    if (reduced) setState((s) => advanceTimeline(s, 0, routine, true));
  }, [reduced, routine]);
  useEffect(() => {
    if (paused) return;
    let previous = performance.now(),
      frame: number;
    const tick = (now: number) => {
      const seconds = Math.max(0, (now - previous) / 1000);
      if (seconds >= 1 / 30) {
        previous = now;
        setState((s) => advanceTimeline(s, seconds, routine, reduced));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused, reduced, routine]);
  return {
    state,
    reduced,
    skip: () => setState((s) => nextPose(s, routine, reduced)),
    ready: () => setState(confirmPosition),
  };
}
