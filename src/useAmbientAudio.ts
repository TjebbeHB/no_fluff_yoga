import { AmbientSound, SOUND_SOURCES } from "./soundCatalog";
import { useEffect, useState, useCallback } from "react";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
export const AMBIENT_VOLUME = 0.18;
export function useAmbientAudio(
  enabled: boolean,
  sound: AmbientSound = "rain",
  ducking = false,
) {
  const player = useAudioPlayer(SOUND_SOURCES[sound]);
  const status = useAudioPlayerStatus(player);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    })
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    try {
      player.loop = true;
      if (enabled && ready && status.isLoaded) {
        player.volume = 0;
        player.play();
      } else player.pause();
    } catch {
      setError(true);
    }
  }, [player, enabled, ready, status.isLoaded]);
  useEffect(() => {
    if (!enabled || !ready || !status.isLoaded) return;
    const start = player.volume,
      time = Date.now();
    const target = AMBIENT_VOLUME * (ducking ? 0.2 : 1);
    const ramp = setInterval(() => {
      const progress = Math.min(1, (Date.now() - time) / 900);
      player.volume = start + (target - start) * progress;
      if (progress === 1) clearInterval(ramp);
    }, 50);
    return () => clearInterval(ramp);
  }, [player, enabled, ready, status.isLoaded, ducking]);
  const stop = useCallback(() => {
    player.pause();
  }, [player]);
  return {
    loaded: status.isLoaded,
    error,
    stop,
    clearError: () => setError(false),
  };
}
