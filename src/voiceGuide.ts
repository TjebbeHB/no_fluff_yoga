// Plays guide lines one after another: a Paradee recording when the voice
// pack has one, otherwise the device's own speech. Platform independent, so
// the sequencing is covered by the functional tests.
import { GUIDE_LINES } from "./guideScript";
import { after } from "./clock";

export type VoiceGuideDeps = {
  // The installed recording for a line, if any.
  clip: (id: string) => Promise<string | null> | string | null;
  // Resolves when playback finished or was stopped; rejects when the
  // recording cannot be played.
  playClip: (uri: string) => Promise<boolean>;
  speak: (text: string, isCurrent: () => boolean) => Promise<boolean>;
  stopVoice: () => void;
  chime: () => Promise<void>;
  stopChime: () => void;
  onSpeaking: (speaking: boolean) => void;
  // A line could not be played or spoken at all.
  onProblem?: () => void;
};
export type SayOptions = {
  // Cancel whatever is being said (a new pose) instead of queueing after it.
  replace?: boolean;
  chime?: boolean;
  onDone?: () => void;
};
export const CHIME_LEAD_MS = 1100;
export const LINE_GAP_MS = 450;

export function createVoiceGuide(deps: VoiceGuideDeps) {
  let generation = 0,
    disposed = false,
    chain: Promise<void> = Promise.resolve();
  const sleepers = new Set<() => void>();
  // Pauses end early when the guide is interrupted.
  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const wake = () => {
        stopTimer();
        sleepers.delete(wake);
        resolve();
      };
      const stopTimer = after(ms, wake);
      sleepers.add(wake);
    });
  const cancel = () => {
    generation++;
    for (const wake of [...sleepers]) wake();
    deps.stopChime();
    deps.stopVoice();
    deps.onSpeaking(false);
  };
  return {
    say(lines: string[], options: SayOptions = {}) {
      if (disposed) return;
      if (options.replace) cancel();
      const token = generation;
      const current = () => !disposed && token === generation;
      chain = chain
        .then(async () => {
          if (!current()) return;
          if (options.chime) {
            void deps.chime().catch(() => {});
            await sleep(CHIME_LEAD_MS);
          }
          let first = true;
          for (const id of lines) {
            const text = GUIDE_LINES[id];
            if (!current()) return;
            if (!text) continue;
            if (!first) await sleep(LINE_GAP_MS);
            first = false;
            if (!current()) return;
            deps.onSpeaking(true);
            const uri = await Promise.resolve(deps.clip(id)).catch(() => null);
            if (!current()) return;
            // A recording that cannot be played is read by the device voice
            // instead, and a line that cannot be spoken at all must not stop
            // the rest of the guidance or the practice moving on.
            const played =
              !!uri &&
              (await deps.playClip(uri).then(
                () => true,
                () => false,
              ));
            if (!played && current())
              await deps.speak(text, current).catch(() => {
                if (current()) deps.onProblem?.();
              });
            if (current()) deps.onSpeaking(false);
          }
          if (current()) options.onDone?.();
        })
        .catch(() => {
          if (current()) deps.onSpeaking(false);
        });
    },
    stop: cancel,
    dispose() {
      disposed = true;
      cancel();
    },
  };
}
export type VoiceGuide = ReturnType<typeof createVoiceGuide>;
