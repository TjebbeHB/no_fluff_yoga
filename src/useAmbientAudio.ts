import { AmbientSound, SOUND_SOURCES } from "./soundCatalog";
import { useEffect, useRef, useState, useCallback } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { holdAudioMode } from "./audioSession";
import { tick } from "./clock";
export const AMBIENT_VOLUME = 0.18;
const SILENCE = require("../assets/silence.wav");
export type AmbientOptions = {
  // The nature recording is wanted (the person's sound preference).
  soundOn: boolean;
  sound?: AmbientSound;
  // Practice is running, not paused.
  active: boolean;
  ducking?: boolean;
  // Guided practice keeps going with the screen locked: the session stays
  // active, silence plays when nature sounds are off, and the lock screen
  // shows the current pose with play and pause.
  background?: boolean;
  nowPlaying?: { title: string; artist: string };
  // Called when someone plays or pauses from the lock screen or headphones.
  onRemote?: (playing: boolean) => void;
};
export function useAmbientAudio({
  soundOn,
  sound = "rain",
  active,
  ducking = false,
  background = false,
  nowPlaying,
  onRemote,
}: AmbientOptions) {
  const silent = background && !soundOn;
  const player = useAudioPlayer(silent ? SILENCE : SOUND_SOURCES[sound], {
    keepAudioSessionActive: background,
    updateInterval: 250,
  });
  // Status updates arrive from native code even while Android has paused
  // JavaScript timers, so they keep guided practice on time.
  useEffect(() => {
    if (!background) return;
    const subscription = player.addListener("playbackStatusUpdate", tick);
    return () => subscription.remove();
  }, [player, background]);
  const status = useAudioPlayerStatus(player);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(false);
  const playing = active && (soundOn || background) && ready && status.isLoaded;
  useEffect(() => {
    let live = true;
    setReady(false);
    const mode = holdAudioMode(background);
    void mode.ready
      .then(() => {
        if (live) setReady(true);
      })
      .catch(() => {
        if (live) setError(true);
      });
    return () => {
      live = false;
      mode.release();
    };
  }, [background]);
  // What the app asked for, so plays and pauses from elsewhere stand out.
  const intended = useRef({ playing: false, at: 0 });
  useEffect(() => {
    try {
      player.loop = true;
      intended.current = { playing, at: Date.now() };
      if (playing) {
        player.volume = 0;
        player.play();
      } else player.pause();
    } catch {
      setError(true);
    }
  }, [player, playing]);
  useEffect(() => {
    if (!playing || silent) return;
    const start = player.volume,
      time = Date.now();
    const target = AMBIENT_VOLUME * (ducking ? 0.2 : 1);
    const ramp = setInterval(() => {
      const progress = Math.min(1, (Date.now() - time) / 900);
      player.volume = start + (target - start) * progress;
      if (progress === 1) clearInterval(ramp);
    }, 50);
    return () => clearInterval(ramp);
  }, [player, playing, silent, ducking]);
  // Android needs lock-screen controls to keep playing in the background.
  const shown = background && !!nowPlaying;
  useEffect(() => {
    if (!shown) return;
    try {
      player.setActiveForLockScreen(
        true,
        { ...nowPlaying, albumTitle: "Verdant Yoga" },
        { showSeekBackward: false, showSeekForward: false, isLiveStream: true },
      );
    } catch {
      /* Lock-screen controls are a convenience. */
    }
    return () => {
      try {
        player.setActiveForLockScreen(false);
      } catch {
        /* Already released. */
      }
    };
  }, [player, shown]);
  useEffect(() => {
    if (!shown || !nowPlaying) return;
    try {
      player.updateLockScreenMetadata({
        ...nowPlaying,
        albumTitle: "Verdant Yoga",
      });
    } catch {
      /* Not shown. */
    }
  }, [player, shown, nowPlaying?.title, nowPlaying?.artist]);
  const remote = useRef(onRemote);
  remote.current = onRemote;
  useEffect(() => {
    if (!background || !status.isLoaded || status.isBuffering) return;
    const wanted = intended.current;
    if (status.playing === wanted.playing || Date.now() - wanted.at < 800)
      return;
    intended.current = { playing: status.playing, at: Date.now() };
    remote.current?.(status.playing);
  }, [background, status.playing, status.isLoaded, status.isBuffering]);
  const stop = useCallback(() => {
    intended.current = { playing: false, at: Date.now() };
    player.pause();
  }, [player]);
  return {
    loaded: status.isLoaded,
    error,
    stop,
    clearError: () => setError(false),
  };
}
