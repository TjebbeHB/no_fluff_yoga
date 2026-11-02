// The device's built-in voice, used until a Paradee voice is installed and
// for any line a voice pack does not cover.
import * as Speech from "expo-speech";
import { after } from "./clock";

type Voice = { identifier?: string; language: string };
let chosen: Promise<Voice> | null = null;
let stops: Promise<void> = Promise.resolve();
// Lines still being spoken. Stopping settles them at once rather than
// waiting for the engine to confirm, which some engines never do.
const speaking = new Set<(done: boolean) => void>();
// Wait for the engine before speaking: Android can keep utterances queued
// before initialization and read them out much later.
function englishVoice(): Promise<Voice> {
  chosen ??= Promise.race([
    Speech.getAvailableVoicesAsync(),
    new Promise<never>((_, reject) =>
      after(8000, () => reject(new Error("Voice engine not ready"))),
    ),
  ])
    .then((voices) => {
      const english = voices.filter((v) => /^en(?:[-_]|$)/i.test(v.language));
      const voice =
        english.find((v) => v.quality === "Enhanced") ?? english[0];
      return { identifier: voice?.identifier, language: voice?.language ?? "en-US" };
    })
    .catch((error) => {
      chosen = null;
      throw error;
    });
  return chosen;
}
// Every utterance waits for every earlier stop, so a quick skip can never let
// a stale line through.
export function stopSpeech() {
  for (const settle of [...speaking]) settle(false);
  stops = stops.catch(() => {}).then(() => Speech.stop());
  return stops;
}
export async function speak(
  text: string,
  isCurrent: () => boolean,
): Promise<boolean> {
  const voice = await englishVoice();
  if (!isCurrent()) return false;
  await stopSpeech();
  if (!isCurrent()) return false;
  return new Promise((resolve, reject) => {
    const settle = (done: boolean) => {
      cancelWatchdog();
      speaking.delete(settle);
      resolve(done);
    };
    // A missing engine callback must not stall the guide.
    const cancelWatchdog = after(5000 + text.length * 110, () => {
      void stopSpeech().catch(() => {});
      settle(false);
    });
    speaking.add(settle);
    Speech.speak(text, {
      language: voice.language,
      voice: voice.identifier,
      rate: 0.9,
      pitch: 1,
      volume: 0.85,
      useApplicationAudioSession: true,
      onDone: () => settle(true),
      onStopped: () => settle(false),
      onError: (error) => {
        cancelWatchdog();
        speaking.delete(settle);
        reject(error);
      },
    });
  });
}
