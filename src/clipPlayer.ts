// Plays one recording at a time and reports when it has finished.
import { createAudioPlayer } from "expo-audio";
import { after } from "./clock";

export type ClipPlayer = {
  // Resolves true when the recording finished and false when it was stopped;
  // rejects when it cannot be played at all.
  play: (uri: string) => Promise<boolean>;
  stop: () => void;
  release: () => void;
};
export function createClipPlayer(volume = 1): ClipPlayer {
  // Keep the audio session alive between lines: with the screen locked, a
  // deactivated session would let the system suspend the guide.
  const player = createAudioPlayer(null, {
    keepAudioSessionActive: true,
    updateInterval: 100,
  });
  let pending: {
    resolve: (done: boolean) => void;
    reject: (error: Error) => void;
  } | null = null;
  let cancelGuard = () => {};
  const settle = (outcome: boolean | Error) => {
    cancelGuard();
    const current = pending;
    pending = null;
    if (outcome instanceof Error) current?.reject(outcome);
    else current?.resolve(outcome);
  };
  const subscription = player.addListener("playbackStatusUpdate", (status) => {
    if (status.didJustFinish) settle(true);
    // iOS reports a failed item, Android an error message.
    else if (
      status.playbackState === "failed" ||
      (status as { error?: string }).error
    )
      settle(new Error("This recording could not be played."));
  });
  return {
    play(uri) {
      settle(false);
      return new Promise((resolve, reject) => {
        pending = { resolve, reject };
        cancelGuard = after(30000, () => settle(false));
        try {
          player.replace({ uri });
          player.volume = volume;
          player.play();
        } catch (error) {
          settle(error instanceof Error ? error : new Error(String(error)));
        }
      });
    },
    stop() {
      try {
        player.pause();
      } catch {
        /* Already released. */
      }
      settle(false);
    },
    release() {
      settle(false);
      subscription.remove();
      try {
        player.remove();
      } catch {
        /* Already released. */
      }
    },
  };
}
