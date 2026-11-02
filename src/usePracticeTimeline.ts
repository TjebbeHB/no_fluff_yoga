import { useEffect, useState } from "react";
import { AccessibilityInfo, AppState } from "react-native";
import { Routine } from "./routines";
import {
  advanceTimeline,
  confirmPosition,
  initialTimeline,
  nextPose,
} from "./practiceTimeline";
import { onTick } from "./clock";
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
  // Animation frames stop with the screen off, so time advances on an
  // interval: smooth while visible, a few times a second in the background
  // (enough for the audio guide to stay on cue). Android stops intervals in
  // the background too, so audio status updates also move time along.
  const [visible, setVisible] = useState(AppState.currentState !== "background");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) =>
      setVisible(next === "active"),
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (paused) return;
    let previous = performance.now();
    const step = () => {
      const now = performance.now();
      const seconds = Math.max(0, (now - previous) / 1000);
      previous = now;
      if (seconds > 0)
        setState((s) => advanceTimeline(s, seconds, routine, reduced));
    };
    const timer = setInterval(step, visible ? 1000 / 30 : 250);
    const unsubscribe = onTick(step);
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [paused, reduced, routine, visible]);
  return {
    state,
    reduced,
    skip: () => setState((s) => nextPose(s, routine, reduced)),
    ready: () => setState(confirmPosition),
  };
}
