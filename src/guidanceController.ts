/** Platform-independent sequencing, also exercised by the functional tests. */
export type GuidanceInput = {
  poseKey: string;
  text: string;
  active: boolean;
  chime: boolean;
  speech: boolean;
};
type Voice = { identifier: string; language: string; quality?: string };
export type GuidanceDependencies = {
  stop: () => Promise<void>;
  voices: () => Promise<Voice[]>;
  speak: (
    text: string,
    options: {
      language: string;
      voice?: string;
      rate: number;
      pitch: number;
      volume: number;
      useApplicationAudioSession: boolean;
      onDone: () => void;
      onStopped: () => void;
      onError: (error?: unknown) => void;
    },
  ) => void;
  playChime: () => Promise<void>;
  stopChime: () => void;
  onState: (state: { ducking: boolean; speechStatus: string | null }) => void;
};
export function createGuidanceController(deps: GuidanceDependencies) {
  let generation = 0;
  let disposed = false;
  let lastSpoken = "",
    lastChimed = "";
  let stopQueue = Promise.resolve();
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let voiceTimer: ReturnType<typeof setTimeout> | undefined;
  const clearTimers = () => {
    clearTimeout(watchdog);
    clearTimeout(voiceTimer);
  };
  // Every speak waits for every previous stop: rapid skips cannot queue stale names.
  const stop = () => {
    stopQueue = stopQueue.catch(() => {}).then(() => deps.stop());
    return stopQueue;
  };
  const cancel = () => {
    generation++;
    clearTimers();
    deps.stopChime();
    return stop();
  };
  return {
    update(input: GuidanceInput) {
      if (disposed) return;
      const stopped = cancel();
      const token = generation;
      const current = () => !disposed && token === generation;
      deps.onState({ ducking: false, speechStatus: null });
      // Turning a feature on midway through a pose gives its cue once.
      if (!input.speech) lastSpoken = "";
      if (!input.chime) lastChimed = "";
      if (!input.active) {
        void stopped.catch(() => {});
        return;
      }
      if (input.chime && input.poseKey !== lastChimed) {
        lastChimed = input.poseKey;
        void deps.playChime().catch(() => {});
      }
      if (!input.speech || input.poseKey === lastSpoken || !input.text.trim()) {
        void stopped.catch(() => {});
        return;
      }
      const finish = (speechStatus: string | null = null) => {
        if (!current()) return;
        clearTimeout(watchdog);
        deps.onState({ ducking: false, speechStatus });
      };
      void (async () => {
        try {
          await stopped;
          if (!current()) return;
          // Wait for engine readiness before speaking: Android can retain utterances queued before initialization.
          let enumerationTimer: ReturnType<typeof setTimeout> | undefined;
          const voices = await Promise.race([
            deps.voices(),
            new Promise<Voice[]>((_, reject) => {
              enumerationTimer = setTimeout(
                () => reject(new Error("Voice engine not ready")),
                8000,
              );
              voiceTimer = enumerationTimer;
            }),
          ]);
          clearTimeout(enumerationTimer);
          if (!current()) return;
          await stop();
          if (!current()) return;
          const english = voices.filter((v) =>
            /^en(?:[-_]|$)/i.test(v.language),
          );
          const voice =
            english.find((v) => v.quality === "Enhanced") ?? english[0];
          lastSpoken = input.poseKey;
          deps.onState({ ducking: true, speechStatus: null });
          // Missing engine callbacks must not leave nature sound permanently quiet.
          watchdog = setTimeout(() => {
            if (!current()) return;
            void stop().catch(() => {});
            finish(
              "Voice guidance is unavailable. Check your device’s text-to-speech settings.",
            );
          }, 12000);
          deps.speak(input.text.slice(0, 300), {
            language: voice?.language ?? "en-US",
            voice: voice?.identifier,
            rate: 0.88,
            pitch: 1,
            volume: 0.7,
            useApplicationAudioSession: true,
            onDone: () => finish(),
            onStopped: () => finish(),
            onError: () =>
              finish(
                "Voice guidance is unavailable. Check your device’s text-to-speech settings.",
              ),
          });
        } catch {
          finish(
            "Voice guidance is unavailable. Check your device’s text-to-speech settings.",
          );
        }
      })();
    },
    dispose() {
      disposed = true;
      void cancel().catch(() => {});
    },
  };
}
