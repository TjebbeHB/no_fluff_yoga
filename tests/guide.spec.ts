/// <reference types="node" />
import { test, expect, Page } from "@playwright/test";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { GUIDE_LINES, guideEvents, guideLines } from "../src/guideScript";
import { createVoiceGuide, CHIME_LEAD_MS, LINE_GAP_MS } from "../src/voiceGuide";
import { poseLibrary, Routine, routines } from "../src/routines";
import { parseManifest, usableLines, VOICE_BASE_URL, VOICES } from "../src/voices";

const PACKS = path.resolve("voices/paradee-1.2");
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const library = (...ids: string[]): Routine => ({
  ...routines[0],
  poses: ids.map((id) => poseLibrary.find((p) => p.id === id)!),
});

test("every move has guidance in both styles", () => {
  const everything = { ...routines[0], poses: poseLibrary };
  for (const routine of [...routines, everything])
    for (const style of ["detailed", "brief"] as const) {
      const ids = [
        ...guideLines(routine, { kind: "start" }, style),
        ...routine.poses.flatMap((_, index) => [
          ...guideLines(routine, { kind: "change", index }, style),
          ...guideLines(routine, { kind: "hold", index }, style),
          ...guideLines(routine, { kind: "closing", index }, style),
        ]),
        ...guideLines(routine, { kind: "complete" }, style),
      ];
      for (const id of ids) expect(GUIDE_LINES[id], id).toBeTruthy();
    }
});

test("detailed guidance describes the movement, brief guidance names it", () => {
  const routine = library("tree-left", "tree-right", "mountain", "reach");
  const say = (event: Parameters<typeof guideLines>[1], style: "detailed" | "brief") =>
    guideLines(routine, event, style).map((id) => GUIDE_LINES[id]);
  expect(say({ kind: "start" }, "brief")).toEqual([
    "Let's begin with low tree, left side.",
  ]);
  expect(say({ kind: "start" }, "detailed")[0]).toMatch(/^Welcome/);
  expect(say({ kind: "start" }, "detailed")[1]).toMatch(
    /^Low tree, left side\. Shift your weight onto your left foot/,
  );
  // The same pose on the other side is a switch, not a new pose.
  expect(say({ kind: "change", index: 1 }, "brief")).toEqual([
    "Now the other side.",
  ]);
  expect(say({ kind: "change", index: 1 }, "detailed")).toEqual([
    GUIDE_LINES.switch,
    GUIDE_LINES["tree-right.enter"],
  ]);
  // Brief lines alternate so a long practice does not repeat itself.
  expect(say({ kind: "change", index: 2 }, "brief")).toEqual([
    "Next, mountain pose.",
  ]);
  expect(say({ kind: "change", index: 3 }, "brief")).toEqual([
    "Now, upward reach.",
  ]);
  expect(say({ kind: "hold", index: 2 }, "detailed")).toEqual([
    GUIDE_LINES["mountain.hold"],
  ]);
  expect(say({ kind: "hold", index: 2 }, "brief")).toEqual([]);
  expect(say({ kind: "closing", index: 2 }, "brief")).toEqual([]);
  expect(say({ kind: "complete" }, "brief")).toEqual([
    "That's your practice. Well done.",
  ]);
});

test("timeline changes become guide moments", () => {
  expect(guideEvents(null, { index: 0, phase: "hold" })).toEqual([
    { kind: "start" },
  ]);
  expect(
    guideEvents({ index: 0, phase: "hold" }, { index: 1, phase: "move" }),
  ).toEqual([{ kind: "change", index: 1 }]);
  expect(
    guideEvents({ index: 1, phase: "move" }, { index: 1, phase: "hold" }),
  ).toEqual([{ kind: "hold", index: 1 }]);
  expect(
    guideEvents({ index: 1, phase: "reposition" }, { index: 1, phase: "hold" }),
  ).toEqual([{ kind: "hold", index: 1 }]);
  // Reduced motion arrives straight in the hold.
  expect(
    guideEvents({ index: 1, phase: "hold" }, { index: 2, phase: "hold" }),
  ).toEqual([
    { kind: "change", index: 2 },
    { kind: "hold", index: 2 },
  ]);
  expect(
    guideEvents({ index: 2, phase: "hold" }, { index: 3, phase: "complete" }),
  ).toEqual([{ kind: "complete" }]);
  expect(
    guideEvents({ index: 3, phase: "complete" }, { index: 3, phase: "complete" }),
  ).toEqual([]);
});

test("the voice guide plays recordings, falls back to speech and cancels cleanly", async () => {
  const log: string[] = [];
  const speaking: boolean[] = [];
  let finishClip: ((done: boolean) => void) | null = null;
  let problems = 0;
  const guide = createVoiceGuide({
    clip: async (id) =>
      id === "intro" ? "file:///intro.m4a" : id === "rest.hold" ? "file:///broken.m4a" : null,
    playClip: (uri) => {
      log.push(`clip ${uri}`);
      if (uri.includes("broken")) return Promise.reject(new Error("decode"));
      return new Promise((resolve) => (finishClip = resolve));
    },
    speak: async (text) => {
      log.push(`speak ${text}`);
      if (text === GUIDE_LINES["mountain.enter"]) throw new Error("engine");
      return true;
    },
    stopVoice: () => {
      log.push("stop");
      finishClip?.(false);
    },
    chime: async () => {
      log.push("chime");
    },
    stopChime: () => {},
    onSpeaking: (value) => speaking.push(value),
    onProblem: () => problems++,
  });
  let done = 0;
  guide.say(["intro", "mountain.enter", "mountain.hold"], {
    chime: true,
    onDone: () => done++,
  });
  await wait(50);
  expect(log).toEqual(["chime"]);
  await wait(CHIME_LEAD_MS);
  expect(log).toEqual(["chime", "clip file:///intro.m4a"]);
  expect(speaking.at(-1)).toBe(true);
  finishClip!(true);
  await wait(2 * LINE_GAP_MS + 100);
  // A line the voice cannot say is reported and skipped.
  expect(log.slice(2)).toEqual([
    `speak ${GUIDE_LINES["mountain.enter"]}`,
    `speak ${GUIDE_LINES["mountain.hold"]}`,
  ]);
  expect(problems).toBe(1);
  expect(done).toBe(1);
  expect(speaking.at(-1)).toBe(false);

  // A recording that cannot play is read by the device voice instead.
  guide.say(["rest.hold"]);
  await wait(30);
  expect(log.slice(-2)).toEqual([
    "clip file:///broken.m4a",
    `speak ${GUIDE_LINES["rest.hold"]}`,
  ]);
  expect(problems).toBe(1);

  // A new pose cuts off whatever is still being said.
  guide.say(["intro", "outro"], { onDone: () => done++ });
  await wait(30);
  expect(log.at(-1)).toBe("clip file:///intro.m4a");
  guide.say(["reach.enter"], { replace: true, onDone: () => done++ });
  await wait(30);
  expect(log.slice(-2)).toEqual(["stop", `speak ${GUIDE_LINES["reach.enter"]}`]);
  expect(log).not.toContain(`speak ${GUIDE_LINES.outro}`);
  expect(done).toBe(2);

  guide.dispose();
  guide.say(["outro"]);
  await wait(30);
  expect(log).not.toContain(`speak ${GUIDE_LINES.outro}`);
});

test("voice packs hold every line in its current wording", () => {
  for (const voice of VOICES) {
    const dir = path.join(PACKS, voice.id);
    const manifest = parseManifest(
      JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8")),
      voice.id,
    );
    expect(usableLines(manifest).length, voice.id).toBe(
      Object.keys(GUIDE_LINES).length,
    );
    let total = 0;
    for (const entry of Object.values(manifest.lines)) {
      expect(statSync(path.join(dir, entry.file)).size).toBe(entry.bytes);
      total += entry.bytes;
    }
    expect(manifest.bytes).toBe(total);
    // The size shown on the Install button.
    expect(Math.abs(total / 1e6 - voice.megabytes)).toBeLessThan(0.15);
  }
});

// Serves the voice packs from this checkout instead of GitHub.
async function serveVoices(page: Page) {
  await page.route(`${VOICE_BASE_URL}/**`, (route) => {
    const file = path.join(
      PACKS,
      route.request().url().slice(VOICE_BASE_URL.length + 1),
    );
    if (!file.startsWith(PACKS) || !existsSync(file))
      return route.fulfill({ status: 404 });
    return route.fulfill({
      path: file,
      contentType: file.endsWith(".json") ? "application/json" : "audio/mp4",
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
}
// Records which sounds and words the page plays. Speech finishes when the
// test says so, unless `autoEnd` is set (in milliseconds of page time).
async function listen(page: Page, autoEnd?: number) {
  await page.addInitScript((autoEnd) => {
    const w = window as any;
    w.__spoken = [];
    w.__clips = [];
    w.__chimes = 0;
    w.SpeechSynthesisUtterance = class {};
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        speaking: false,
        getVoices: () => [
          {
            voiceURI: "test-English",
            lang: "en-US",
            name: "Test",
            localService: true,
            default: true,
          },
        ],
        cancel: () => {
          const current = w.__utterance;
          w.__utterance = null;
          current?.onerror?.({ error: "interrupted" });
        },
        speak: (utterance: any) => {
          w.__spoken.push(utterance.text);
          w.__utterance = utterance;
          utterance.onstart?.({});
          if (autoEnd)
            setTimeout(() => {
              if (w.__utterance !== utterance) return;
              w.__utterance = null;
              utterance.onend?.({});
            }, autoEnd);
        },
      },
    });
    w.__finishSpeech = () => {
      const current = w.__utterance;
      w.__utterance = null;
      current?.onend?.({});
    };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.loop) w.__ambient = this;
      else if (this.src.startsWith("blob:")) w.__clips.push(this.src);
      else if (this.src) w.__chimes++;
      return play.call(this);
    };
  }, autoEnd);
}
const spoken = (page: Page) =>
  page.evaluate(() => (window as any).__spoken as string[]);
function store(page: Page, preferences: object, steps: object[]) {
  return page.addInitScript(
    ({ preferences, steps }) =>
      localStorage.setItem(
        "verdant.library.v1",
        JSON.stringify({
          version: 1,
          routines: [{ id: "custom-guide", name: "Guided", steps }],
          preferences: {
            ambient: "rain",
            ambientEnabled: false,
            chime: false,
            ...preferences,
          },
        }),
      ),
    { preferences, steps },
  );
}
async function startGuided(page: Page) {
  await page.goto("/");
  await page.getByRole("tab", { name: "My routines" }).click();
  await page.getByRole("radio", { name: /Guided/ }).click();
  await page.getByRole("button", { name: "Start yoga" }).click();
}

test("settings install, preview and remove a Paradee voice", async ({ page }) => {
  await serveVoices(page);
  await listen(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("switch", { name: "Audio guide" }).check();
  await page.getByRole("radio", { name: "Brief guidance" }).click();
  await expect(page.getByRole("radio", { name: "Heart voice" })).toBeDisabled();
  // A failed download leaves nothing half installed.
  await page.route(`${VOICE_BASE_URL}/am_puck/**`, (route) => route.abort());
  await page.getByRole("button", { name: "Install Puck voice" }).click();
  await expect(page.getByText(/could not be installed/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Install Puck voice" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Install Heart voice" }).click();
  await expect(
    page.getByRole("button", { name: "Remove Heart voice" }),
  ).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/could not be installed/)).toHaveCount(0);
  // Installing a voice also chooses it.
  await expect(page.getByRole("radio", { name: "Heart voice" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/guide/settings.png", fullPage: true });
  // The sample plays from the installed copy.
  await page.getByRole("button", { name: "Listen to Heart" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__clips.length))
    .toBe(1);
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(
    page.getByRole("button", { name: "Audio guide on. Open settings" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Audio guide" })).toBeChecked();
  await expect(
    page.getByRole("radio", { name: "Brief guidance" }),
  ).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Remove Heart voice" }).click();
  await expect(
    page.getByRole("button", { name: "Install Heart voice" }),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: "Device voice" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("the guide leads with the screen off and finishes with its closing words", async ({
  page,
}) => {
  await listen(page);
  await store(
    page,
    { ambientEnabled: true, chime: true, guide: true, guideStyle: "brief" },
    [
      { poseId: "tree-left", seconds: 15 },
      { poseId: "tree-right", seconds: 15 },
    ],
  );
  await startGuided(page);
  await expect
    .poll(() => spoken(page))
    .toEqual(["Let's begin with low tree, left side."]);
  await expect(
    page.getByText("Audio guide on · you can lock your screen"),
  ).toBeVisible();
  // Nature sounds step back while the guide speaks.
  await expect
    .poll(() => page.evaluate(() => (window as any).__ambient?.volume))
    .toBeCloseTo(0.036, 2);
  await page.evaluate(() => (window as any).__finishSpeech());
  await expect
    .poll(() => page.evaluate(() => (window as any).__ambient?.volume))
    .toBeCloseTo(0.18, 2);
  // Hiding the app does not pause a guided practice.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(300);
  await expect(page.getByRole("button", { name: "Pause practice" })).toBeVisible();
  // The bell rings, then the guide names the change.
  await page.getByRole("button", { name: "Skip to next pose" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__chimes))
    .toBe(1);
  await expect
    .poll(() => spoken(page))
    .toEqual(["Let's begin with low tree, left side.", "Now the other side."]);
  await page.evaluate(() => (window as any).__finishSpeech());
  await page.getByRole("button", { name: "Finish practice" }).click();
  await expect
    .poll(() => spoken(page))
    .toContain("That's your practice. Well done.");
  // The practice ends once the guide has said goodbye.
  await expect(page.getByText("WELL DONE", { exact: true })).toBeVisible();
  await expect(page.getByText("PRACTICE COMPLETE", { exact: true })).toHaveCount(0);
  await page.evaluate(() => (window as any).__finishSpeech());
  await expect(
    page.getByText("PRACTICE COMPLETE", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as any).__ambient?.paused))
    .toBe(true);
});

test("installed voices play their recordings, with the device voice as a stand-in", async ({
  page,
}) => {
  await serveVoices(page);
  await listen(page);
  await store(page, { guide: true, guideStyle: "brief" }, [
    { poseId: "tree-left", seconds: 15 },
    { poseId: "tree-right", seconds: 15 },
  ]);
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Install Isabella voice" }).click();
  await expect(
    page.getByRole("button", { name: "Remove Isabella voice" }),
  ).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: "Close settings" }).click();
  // Damage one recording: that line is read by the device voice instead.
  await page.evaluate(async (base) => {
    const cache = await caches.open("verdant-voices-1");
    await cache.put(
      `${base}/bf_isabella/tree-left.first.m4a`,
      new Response("not audio", { headers: { "Content-Type": "audio/mp4" } }),
    );
  }, VOICE_BASE_URL);
  await page.getByRole("tab", { name: "My routines" }).click();
  await page.getByRole("radio", { name: /Guided/ }).click();
  await page.getByRole("button", { name: "Start yoga" }).click();
  await expect
    .poll(() => spoken(page))
    .toEqual(["Let's begin with low tree, left side."]);
  expect(await page.evaluate(() => (window as any).__clips.length)).toBe(1);
  await page.evaluate(() => (window as any).__finishSpeech());
  await page.getByRole("button", { name: "Skip to next pose" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__clips.length))
    .toBe(2);
  expect(await spoken(page)).toHaveLength(1);
});

test.describe("with movement", () => {
  test.use({ reducedMotion: "no-preference" });
  test("a guided change of position carries on by itself", async ({ page }) => {
    await listen(page, 1000);
    await store(page, { guide: true, guideStyle: "detailed" }, [
      { poseId: "reach", seconds: 15 },
      { poseId: "rest", seconds: 15 },
    ]);
    await page.clock.install();
    await startGuided(page);
    await page.clock.runFor(2000);
    await page.getByRole("button", { name: "Skip to next pose" }).click();
    await expect(
      page.getByRole("button", { name: "Start pose hold" }),
    ).toBeVisible();
    await expect(page.getByText(/The hold begins on its own/)).toBeVisible();
    await page.clock.runFor(1500);
    expect((await spoken(page)).at(-1)).toBe(GUIDE_LINES["rest.enter"]);
    // Still waiting while the guide gives a moment to settle.
    await page.clock.runFor(2000);
    await expect(
      page.getByRole("button", { name: "Start pose hold" }),
    ).toBeVisible();
    await page.clock.runFor(3000);
    await expect(
      page.getByRole("button", { name: "Start pose hold" }),
    ).toHaveCount(0);
    await expect
      .poll(() => spoken(page))
      .toContain(GUIDE_LINES["rest.hold"]);
  });
});
