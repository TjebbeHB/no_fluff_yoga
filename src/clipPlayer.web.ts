// Browser version: an audio element, handling the asynchronous play promise
// so a quick skip never leaves a rejected promise behind.
export type ClipPlayer = {
  // Resolves true when the recording finished and false when it was stopped;
  // rejects when it cannot be played at all.
  play: (uri: string) => Promise<boolean>;
  stop: () => void;
  release: () => void;
};
export function createClipPlayer(volume = 1): ClipPlayer {
  const audio = new Audio();
  audio.preload = "auto";
  let pending: {
    resolve: (done: boolean) => void;
    reject: (error: Error) => void;
  } | null = null;
  const settle = (outcome: boolean | Error) => {
    const current = pending;
    pending = null;
    if (outcome instanceof Error) current?.reject(outcome);
    else current?.resolve(outcome);
  };
  const ended = () => settle(true),
    failed = () => settle(new Error("This recording could not be played."));
  audio.addEventListener("ended", ended);
  audio.addEventListener("error", failed);
  return {
    play(uri) {
      settle(false);
      return new Promise((resolve, reject) => {
        pending = { resolve, reject };
        audio.src = uri;
        audio.volume = volume;
        void audio.play().catch((error: Error) => {
          // A quick stop interrupts the play request; that is not a failure.
          if (error.name !== "AbortError") failed();
        });
      });
    },
    stop() {
      audio.pause();
      settle(false);
    },
    release() {
      audio.pause();
      settle(false);
      audio.removeEventListener("ended", ended);
      audio.removeEventListener("error", failed);
      audio.removeAttribute("src");
      audio.load();
    },
  };
}
