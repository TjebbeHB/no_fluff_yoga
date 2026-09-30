import { useEffect, useRef, useState } from "react";
import * as Speech from "expo-speech";
import { createGuidanceController, GuidanceInput } from "./guidanceController";
import { useCue } from "./useCue";
export function useGuidance(input: GuidanceInput) {
  const cue = useCue();
  const [state, setState] = useState<{
    ducking: boolean;
    speechStatus: string | null;
  }>({
    ducking: false,
    speechStatus: null,
  });
  const controller = useRef<ReturnType<typeof createGuidanceController> | null>(
    null,
  );
  useEffect(() => {
    controller.current = createGuidanceController({
      stop: Speech.stop,
      voices: Speech.getAvailableVoicesAsync,
      speak: Speech.speak,
      playChime: cue.play,
      stopChime: cue.stop,
      onState: setState,
    });
    return () => {
      controller.current?.dispose();
      controller.current = null;
    };
  }, [cue]);
  useEffect(() => {
    controller.current?.update(input);
  }, [cue, input.poseKey, input.text, input.active, input.chime, input.speech]);
  return state;
}
