import { useEffect, useRef, useState } from "react";
import {
  CLOSING_MIN_HOLD,
  CLOSING_SECONDS,
  guideEvents,
  guideLines,
  GuideStyle,
  Snapshot,
} from "./guideScript";
import { createVoiceGuide, VoiceGuide } from "./voiceGuide";
import { createClipPlayer } from "./clipPlayer";
import { speak, stopSpeech } from "./deviceSpeech";
import { openVoicePack } from "./voicePacks";
import { GuideVoice, VoicePack } from "./voices";
import { useCue } from "./useCue";
import { Routine } from "./routines";
import { PracticeTimeline } from "./practiceTimeline";
import { after } from "./clock";

// After describing a change of position, how long to leave before the hold
// begins on its own when nobody is looking at the screen.
export const SETTLE_MS = { detailed: 4000, brief: 6000 };
export const RESUME_SETTLE_MS = 10000;
const MAX_REPOSITION_MS = 30000;
const MAX_OUTRO_MS = 20000;

export function useAudioGuide({
  routine,
  state,
  paused,
  enabled,
  style,
  voice,
  chime,
  onReady,
  onFinished,
}: {
  routine: Routine;
  state: PracticeTimeline;
  paused: boolean;
  enabled: boolean;
  style: GuideStyle;
  voice: GuideVoice;
  chime: boolean;
  onReady: () => void;
  onFinished: () => void;
}) {
  const cue = useCue();
  const [speaking, setSpeaking] = useState(false);
  const [problem, setProblem] = useState(false);
  const pack = useRef<Promise<VoicePack | null>>(Promise.resolve(null));
  const guide = useRef<VoiceGuide | null>(null);
  const callbacks = useRef({ onReady, onFinished });
  callbacks.current = { onReady, onFinished };
  // Cancels the pending "hold begins" and "practice finished" timers.
  const cancelReady = useRef(() => {});
  const cancelFinish = useRef(() => {});
  const previous = useRef<Snapshot | null>(null);
  // The pose the guide last introduced, so a pose reached while paused is
  // still introduced on resume.
  const announced = useRef(-1);
  const closing = useRef(-1);
  const finished = useRef(false);

  // Lines wait for the pack to open, so the first words are in the chosen
  // voice too.
  useEffect(() => {
    setProblem(false);
    pack.current =
      enabled && voice !== "device"
        ? openVoicePack(voice).catch(() => null)
        : Promise.resolve(null);
  }, [enabled, voice]);
  useEffect(() => {
    const player = createClipPlayer();
    guide.current = createVoiceGuide({
      clip: async (id) => (await pack.current)?.clip(id) ?? null,
      playClip: player.play,
      speak,
      stopVoice: () => {
        player.stop();
        void stopSpeech().catch(() => {});
      },
      chime: cue.play,
      stopChime: cue.stop,
      onSpeaking: setSpeaking,
      onProblem: () => setProblem(true),
    });
    return () => {
      guide.current?.dispose();
      guide.current = null;
      player.release();
      cancelReady.current();
      cancelFinish.current();
    };
  }, [cue]);

  const scheduleReady = (ms: number) => {
    cancelReady.current();
    cancelReady.current = after(ms, () => callbacks.current.onReady());
  };
  // Introduces a new pose. A change of position is talked through, then the
  // hold begins on its own after a moment to settle.
  const introduce = (lines: string[], repositioning: boolean) => {
    announced.current = state.index;
    guide.current?.say(lines, {
      replace: true,
      chime,
      onDone: repositioning ? () => scheduleReady(SETTLE_MS[style]) : undefined,
    });
    if (repositioning) scheduleReady(MAX_REPOSITION_MS);
  };
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    cancelFinish.current();
    callbacks.current.onFinished();
  };

  useEffect(() => {
    const snapshot = { index: state.index, phase: state.phase };
    const events = guideEvents(previous.current, snapshot);
    previous.current = snapshot;
    if (state.phase !== "reposition") cancelReady.current();
    for (const event of events) {
      if (event.kind === "complete") {
        if (!enabled) {
          finish();
          continue;
        }
        guide.current?.say(guideLines(routine, event, style), {
          replace: true,
          onDone: finish,
        });
        cancelFinish.current = after(MAX_OUTRO_MS, finish);
        continue;
      }
      if (paused) continue;
      const lines = enabled ? guideLines(routine, event, style) : [];
      if (event.kind === "change") {
        // A soft bell marks the end of each hold, guide or no guide.
        if (!enabled) {
          if (chime) void cue.play().catch(() => {});
          continue;
        }
        introduce(lines, state.phase === "reposition");
      } else if (lines.length) {
        if (event.kind === "start") announced.current = state.index;
        guide.current?.say(lines, { replace: event.kind === "start" });
      }
    }
    // Only position changes speak: hold time ticking is handled below.
  }, [state.index, state.phase]);

  // Pausing silences the guide. Resuming a change of position gives a calm
  // moment to finish moving before the hold begins.
  useEffect(() => {
    if (paused) {
      guide.current?.stop();
      cancelReady.current();
      return;
    }
    if (!enabled || state.phase === "complete" || !previous.current) return;
    if (announced.current !== state.index)
      introduce(
        guideLines(routine, { kind: "change", index: state.index }, style),
        state.phase === "reposition",
      );
    else if (state.phase === "reposition") scheduleReady(RESUME_SETTLE_MS);
  }, [paused]);
  useEffect(() => {
    if (!enabled) {
      guide.current?.stop();
      cancelReady.current();
    }
  }, [enabled]);

  // A few breaths before a longer hold ends, detailed guidance says so.
  const pose = routine.poses[state.index];
  const remaining = pose ? pose.seconds - state.time : 0;
  useEffect(() => {
    if (
      !enabled ||
      paused ||
      style !== "detailed" ||
      state.phase !== "hold" ||
      !pose ||
      pose.seconds < CLOSING_MIN_HOLD ||
      remaining > CLOSING_SECONDS ||
      remaining < 2 ||
      closing.current === state.index
    )
      return;
    closing.current = state.index;
    guide.current?.say(
      guideLines(routine, { kind: "closing", index: state.index }, style),
    );
  }, [Math.ceil(remaining), state.phase, enabled, paused, style]);

  return { speaking, problem };
}
