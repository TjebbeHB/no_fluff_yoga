// Timers for guided practice that keep running with the screen off. Android
// stops JavaScript timers while the app is in the background, but the audio
// player's status updates keep arriving from native code, so each one also
// calls tick() (see useAmbientAudio).
type Entry = { at: number; run: () => void };
const due = new Set<Entry>();
const listeners = new Set<() => void>();
function fire(entry: Entry) {
  if (due.delete(entry)) entry.run();
}
// Like setTimeout; returns a function that cancels it.
export function after(ms: number, run: () => void) {
  const entry = { at: performance.now() + ms, run };
  due.add(entry);
  const timer = setTimeout(() => fire(entry), ms);
  return () => {
    clearTimeout(timer);
    due.delete(entry);
  };
}
export function tick() {
  const now = performance.now();
  for (const entry of [...due]) if (entry.at <= now) fire(entry);
  for (const listener of [...listeners]) listener();
}
export function onTick(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
