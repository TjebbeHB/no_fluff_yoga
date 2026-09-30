import { AmbientSound, SOUND_SOURCES } from "./soundCatalog";
import { useCallback, useEffect, useRef, useState } from "react";
import { Asset } from "expo-asset";
export const AMBIENT_VOLUME = 0.18;
// The browser implementation handles the asynchronous play promise explicitly,
// including quick pause/navigation while the recording is still loading.
export function useAmbientAudio(
  enabled: boolean,
  sound: AmbientSound = "rain",
  ducking = false,
) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [loaded, setLoaded] = useState(false),
    [error, setError] = useState(false);
  useEffect(() => {
    setLoaded(false);
    setError(false);
    const audio = new Audio(Asset.fromModule(SOUND_SOURCES[sound]).uri);
    ref.current = audio;
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
    const onLoad = () => setLoaded(true),
      onError = () => setError(true);
    audio.addEventListener("canplay", onLoad);
    audio.addEventListener("error", onError);
    audio.load();
    return () => {
      audio.pause();
      audio.removeEventListener("canplay", onLoad);
      audio.removeEventListener("error", onError);
      audio.removeAttribute("src");
      audio.load();
      ref.current = null;
    };
  }, [sound]);
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    let cancelled = false;
    if (enabled && loaded) {
      audio.volume = 0;
      void audio.play().catch((e) => {
        if (!cancelled && e.name !== "AbortError") setError(true);
      });
    } else audio.pause();
    return () => {
      cancelled = true;
    };
  }, [enabled, loaded]);
  useEffect(() => {
    const audio = ref.current;
    if (!audio || !enabled || !loaded) return;
    const target = AMBIENT_VOLUME * (ducking ? 0.2 : 1);
    const start = audio.volume,
      time = Date.now();
    const ramp = setInterval(() => {
      const progress = Math.min(1, (Date.now() - time) / 900);
      audio.volume = start + (target - start) * progress;
      if (progress === 1) clearInterval(ramp);
    }, 50);
    return () => clearInterval(ramp);
  }, [ducking, enabled, loaded, sound]);
  const stop = useCallback(() => ref.current?.pause(), []);
  return { loaded, error, stop, clearError: () => setError(false) };
}
