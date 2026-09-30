import { useCallback, useMemo, useRef } from "react";
import { useAudioPlayer } from "expo-audio";
export function useCue() {
  const player = useAudioPlayer(require("../assets/transition-bell.wav"));
  const generation = useRef(0);
  const stop = useCallback(() => {
    generation.current++;
    try {
      player.pause();
    } catch {
      /* Already released during unmount. */
    }
  }, [player]);
  const play = useCallback(async () => {
    const token = ++generation.current;
    player.volume = 0.24;
    player.loop = false;
    await player.seekTo(0);
    if (token === generation.current) player.play();
  }, [player]);
  return useMemo(() => ({ play, stop }), [play, stop]);
}
