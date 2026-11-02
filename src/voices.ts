// Paradee voices for the audio guide. Each voice pack holds every guide line
// rendered by Paradee (Apache-2.0, distilled from Kokoro-82M) and is only
// downloaded when someone taps Install, so the app itself stays small.
import { GUIDE_LINES } from "./guideScript";

export type VoiceId = "af_heart" | "bf_isabella" | "am_puck" | "bm_fable";
export type GuideVoice = "device" | VoiceId;
export const VOICES: {
  id: VoiceId;
  name: string;
  accent: string;
  megabytes: number;
}[] = [
  { id: "af_heart", name: "Heart", accent: "American", megabytes: 3.5 },
  { id: "bf_isabella", name: "Isabella", accent: "British", megabytes: 3.8 },
  { id: "am_puck", name: "Puck", accent: "American", megabytes: 3.3 },
  { id: "bm_fable", name: "Fable", accent: "British", megabytes: 4 },
];
export const isVoiceId = (value: unknown): value is VoiceId =>
  VOICES.some((voice) => voice.id === value);
// Packs live with the app's source; a build can point elsewhere (for example
// a local server while testing) with EXPO_PUBLIC_VOICE_BASE_URL.
export const VOICE_BASE_URL = (
  process.env.EXPO_PUBLIC_VOICE_BASE_URL ??
  "https://raw.githubusercontent.com/TjebbeHB/no_fluff_yoga/main/voices/paradee-1.2"
).replace(/\/$/, "");
export const voiceUrl = (voice: VoiceId, file: string) =>
  `${VOICE_BASE_URL}/${voice}/${file}`;
export type VoiceManifest = {
  format: 1;
  voice: string;
  bytes: number;
  lines: Record<
    string,
    { file: string; bytes: number; seconds: number; text: string }
  >;
};
export function parseManifest(raw: unknown, voice: VoiceId): VoiceManifest {
  const m = raw as VoiceManifest;
  if (!m || m.format !== 1 || m.voice !== voice || typeof m.lines !== "object")
    throw new Error("This voice pack is not one the app understands.");
  for (const entry of Object.values(m.lines))
    if (!/^[\w.-]+\.m4a$/.test(entry.file))
      throw new Error("This voice pack has an unexpected file.");
  return m;
}
// Only recordings of the exact current wording are used; anything missing
// or outdated is read by the device voice instead.
export function usableLines(manifest: VoiceManifest) {
  return Object.entries(manifest.lines).filter(
    ([id, entry]) => GUIDE_LINES[id] === entry.text,
  );
}
export type VoicePack = { clip: (id: string) => string | null };
export type InstallProgress = (fraction: number) => void;
