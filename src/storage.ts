import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { poseLibrary, Routine } from "./routines";
import { AmbientSound, SOUND_OPTIONS } from "./soundCatalog";
export type Preferences = {
  ambient: AmbientSound;
  ambientEnabled: boolean;
  chime: boolean;
  speech: boolean;
};
export type SavedRoutine = {
  id: string;
  name: string;
  steps: { poseId: string; seconds: number }[];
};
export type LibraryState = {
  version: 1;
  routines: SavedRoutine[];
  preferences: Preferences;
};
export const STORAGE_KEY = "verdant.library.v1";
export const DEFAULT_STATE: LibraryState = {
  version: 1,
  routines: [],
  preferences: {
    ambient: "rain",
    ambientEnabled: true,
    chime: true,
    speech: false,
  },
};
export function validRoutine(value: unknown): value is SavedRoutine {
  if (!value || typeof value !== "object") return false;
  const r = value as SavedRoutine;
  return (
    typeof r.id === "string" &&
    r.id.startsWith("custom-") &&
    typeof r.name === "string" &&
    r.name.trim().length > 0 &&
    r.name.length <= 40 &&
    Array.isArray(r.steps) &&
    r.steps.length > 0 &&
    r.steps.length <= 30 &&
    r.steps.every(
      (s) =>
        s &&
        poseLibrary.some((p) => p.id === s.poseId) &&
        Number.isInteger(s.seconds) &&
        s.seconds >= 15 &&
        s.seconds <= 180 &&
        s.seconds % 15 === 0,
    )
  );
}
export function decodeLibrary(raw: string | null): LibraryState {
  if (!raw) return DEFAULT_STATE;
  const value = JSON.parse(raw);
  if (
    value.version !== 1 ||
    !Array.isArray(value.routines) ||
    !value.routines.every(validRoutine) ||
    new Set(value.routines.map((r: SavedRoutine) => r.id)).size !==
      value.routines.length
  )
    throw new Error("Unrecognized saved routine data");
  const p = value.preferences ?? {};
  return {
    version: 1,
    routines: value.routines,
    preferences: {
      ambient: SOUND_OPTIONS.some((s) => s.id === p.ambient)
        ? p.ambient
        : "rain",
      ambientEnabled:
        typeof p.ambientEnabled === "boolean" ? p.ambientEnabled : true,
      chime: typeof p.chime === "boolean" ? p.chime : true,
      speech: typeof p.speech === "boolean" ? p.speech : false,
    },
  };
}
export function materialize(saved: SavedRoutine): Routine {
  const poses = saved.steps.map((step) => ({
    ...poseLibrary.find((p) => p.id === step.poseId)!,
    seconds: step.seconds,
  }));
  return {
    id: saved.id,
    name: saved.name,
    minutes: poses.reduce((n, p) => n + p.seconds, 0) / 60,
    mood: "MADE BY YOU",
    description: "Your moves. Your own pace.",
    color: "#E2E7D7",
    art: poses[0].shape,
    poses,
    custom: true,
  };
}
export function useLibrary() {
  const [state, setState] = useState<LibraryState>(DEFAULT_STATE),
    [ready, setReady] = useState(false),
    [error, setError] = useState<string | null>(null);
  const current = useRef(state),
    queue = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (active) {
          const loaded = decodeLibrary(raw);
          current.current = loaded;
          setState(loaded);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Saved data could not be read. Your stored copy has not been changed.",
          );
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const persist = (update: (previous: LibraryState) => LibraryState) => {
    const previous = current.current;
    const next = update(previous);
    current.current = next;
    setState(next);
    setError(null);
    const write = queue.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)));
    queue.current = write;
    return write.catch(() => {
      if (current.current === next) {
        current.current = previous;
        setState(previous);
      }
      setError("Changes could not be saved on this device. Please try again.");
      throw new Error("Could not save");
    });
  };
  return { state, ready, error, persist };
}
