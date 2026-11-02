// Voice packs in the browser preview: kept in Cache Storage and played from
// object URLs, so installed voices also work offline there.
import {
  InstallProgress,
  parseManifest,
  usableLines,
  VoiceId,
  VoicePack,
  VOICES,
  voiceUrl,
} from "./voices";

const CACHE = "verdant-voices-1";
const open = () => caches.open(CACHE);
async function cachedManifest(voice: VoiceId) {
  try {
    const hit = await (await open()).match(voiceUrl(voice, "manifest.json"));
    return hit ? parseManifest(await hit.json(), voice) : null;
  } catch {
    return null;
  }
}
export async function installedVoices(): Promise<VoiceId[]> {
  if (typeof caches === "undefined") return [];
  const found = await Promise.all(
    VOICES.map(async (v) => ((await cachedManifest(v.id)) ? v.id : null)),
  );
  return found.filter((id): id is VoiceId => !!id);
}
export async function installVoice(
  voice: VoiceId,
  onProgress: InstallProgress,
): Promise<void> {
  if (typeof caches === "undefined")
    throw new Error("This browser cannot store voices.");
  const response = await fetch(voiceUrl(voice, "manifest.json"));
  if (!response.ok) throw new Error("The voice could not be downloaded.");
  const text = await response.text();
  const manifest = parseManifest(JSON.parse(text), voice);
  // Start clean so no recording from an earlier version is kept.
  await removeVoice(voice);
  const cache = await open();
  const entries = Object.values(manifest.lines);
  let done = 0;
  const queue = entries.slice();
  const worker = async () => {
    for (let entry = queue.shift(); entry; entry = queue.shift()) {
      const url = voiceUrl(voice, entry.file);
      const clip = await fetch(url);
      if (!clip.ok) throw new Error("The voice could not be downloaded.");
      await cache.put(url, clip);
      done += entry.bytes;
      onProgress(done / Math.max(1, manifest.bytes));
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  // The manifest goes in last: a voice counts as installed only when complete.
  await cache.put(
    voiceUrl(voice, "manifest.json"),
    new Response(text, { headers: { "Content-Type": "application/json" } }),
  );
  onProgress(1);
}
export async function removeVoice(voice: VoiceId): Promise<void> {
  forget(voice);
  if (typeof caches === "undefined") return;
  const cache = await open();
  const prefix = voiceUrl(voice, "");
  for (const request of await cache.keys())
    if (request.url.startsWith(prefix)) await cache.delete(request);
}
// Object URLs are made once per voice and reused by every practice.
const opened = new Map<VoiceId, Promise<{ pack: VoicePack; urls: string[] } | null>>();
function forget(voice: VoiceId) {
  const previous = opened.get(voice);
  opened.delete(voice);
  void previous?.then((entry) => entry?.urls.forEach(URL.revokeObjectURL));
}
export async function openVoicePack(voice: VoiceId): Promise<VoicePack | null> {
  if (!opened.has(voice))
    opened.set(
      voice,
      (async () => {
        const manifest = await cachedManifest(voice);
        if (!manifest) return null;
        const cache = await open();
        const uris = new Map<string, string>();
        for (const [id, entry] of usableLines(manifest)) {
          const hit = await cache.match(voiceUrl(voice, entry.file));
          if (hit) uris.set(id, URL.createObjectURL(await hit.blob()));
        }
        return {
          pack: { clip: (id: string) => uris.get(id) ?? null },
          urls: [...uris.values()],
        };
      })().catch(() => null),
    );
  const entry = await opened.get(voice)!;
  if (!entry) opened.delete(voice);
  return entry?.pack ?? null;
}
