// One audio mode for the whole app. Guided practice needs the session to keep
// playing with the screen locked; anything else that plays sound at the same
// time (the sound preview in Settings) must not switch that off.
import { setAudioModeAsync } from "expo-audio";

let background = 0;
let applied: Promise<void> = Promise.resolve();
function apply() {
  const wanted = background > 0;
  applied = applied
    .catch(() => {})
    .then(() =>
      setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: wanted,
        // Lock-screen controls need the session to itself.
        interruptionMode: wanted ? "doNotMix" : "mixWithOthers",
      }),
    );
  return applied;
}
export function holdAudioMode(keepPlaying: boolean) {
  if (keepPlaying) background++;
  const ready = apply();
  let released = false;
  return {
    ready,
    release() {
      if (released) return;
      released = true;
      if (keepPlaying) {
        background--;
        void apply().catch(() => {});
      }
    },
  };
}
