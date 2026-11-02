// Voice packs on phones: downloaded into the app's documents folder, so the
// guide plays offline and with the screen locked.
import { Directory, File, Paths } from "expo-file-system";
import {
  InstallProgress,
  parseManifest,
  usableLines,
  VoiceId,
  VoiceManifest,
  VoicePack,
  VOICES,
  voiceUrl,
} from "./voices";

const folder = (voice: VoiceId) => new Directory(Paths.document, "voices", voice);
const manifestFile = (voice: VoiceId) => new File(folder(voice), "manifest.json");
function readManifest(voice: VoiceId): VoiceManifest | null {
  try {
    const file = manifestFile(voice);
    if (!file.exists) return null;
    const manifest = parseManifest(JSON.parse(file.textSync()), voice);
    // An interrupted install never writes its manifest; this also catches
    // files removed by the system.
    const complete = Object.values(manifest.lines).every((entry) => {
      const clip = new File(folder(voice), entry.file);
      return clip.exists && clip.size === entry.bytes;
    });
    return complete ? manifest : null;
  } catch {
    return null;
  }
}
export async function installedVoices(): Promise<VoiceId[]> {
  return VOICES.map((v) => v.id).filter((id) => !!readManifest(id));
}
export async function installVoice(
  voice: VoiceId,
  onProgress: InstallProgress,
): Promise<void> {
  const response = await fetch(voiceUrl(voice, "manifest.json"));
  if (!response.ok) throw new Error("The voice could not be downloaded.");
  const text = await response.text();
  const manifest = parseManifest(JSON.parse(text), voice);
  // Start clean so no recording from an earlier version is kept; the manifest
  // is written only once every recording is in place.
  const dir = folder(voice);
  if (dir.exists) dir.delete();
  dir.create({ intermediates: true, idempotent: true });
  const entries = Object.values(manifest.lines);
  let done = 0;
  const queue = entries.slice();
  const worker = async () => {
    for (let entry = queue.shift(); entry; entry = queue.shift()) {
      const target = new File(dir, entry.file);
      await File.downloadFileAsync(voiceUrl(voice, entry.file), target, {
        idempotent: true,
      });
      if (new File(dir, entry.file).size !== entry.bytes)
        throw new Error("A recording arrived incomplete. Please try again.");
      done += entry.bytes;
      onProgress(done / Math.max(1, manifest.bytes));
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  manifestFile(voice).write(text);
  onProgress(1);
}
export async function removeVoice(voice: VoiceId): Promise<void> {
  const dir = folder(voice);
  if (dir.exists) dir.delete();
}
export async function openVoicePack(voice: VoiceId): Promise<VoicePack | null> {
  const manifest = readManifest(voice);
  if (!manifest) return null;
  const uris = new Map(
    usableLines(manifest).map(([id, entry]) => [
      id,
      new File(folder(voice), entry.file).uri,
    ]),
  );
  return { clip: (id) => uris.get(id) ?? null };
}
