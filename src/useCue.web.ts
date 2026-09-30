import { useCallback, useEffect, useMemo, useRef } from "react";
import { Asset } from "expo-asset";
export function useCue() {
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const audio = new Audio(
      Asset.fromModule(require("../assets/transition-bell.wav")).uri,
    );
    audio.preload = "auto";
    audio.volume = 0.24;
    ref.current = audio;
    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      ref.current = null;
    };
  }, []);
  const play = useCallback(async () => {
    const audio = ref.current;
    if (!audio) return;
    audio.currentTime = 0;
    // Caller consumes autoplay/abort rejections; never leave a dangling play promise.
    await audio.play();
  }, []);
  const stop = useCallback(() => {
    ref.current?.pause();
  }, []);
  return useMemo(() => ({ play, stop }), [play, stop]);
}
