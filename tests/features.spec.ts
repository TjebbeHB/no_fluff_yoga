import { test, expect, Page } from "@playwright/test";

const KEY = "verdant.library.v1";
const saved = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY);
// Saved routines for a test, written once so they survive reloads.
function seed(page: Page, routines: object[]) {
  return page.addInitScript(
    ({ key, routines }) => {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          routines,
          preferences: { ambient: "rain", ambientEnabled: false, chime: false },
        }),
      );
    },
    { key: KEY, routines },
  );
}

test("the routine sheet lists every move in order and starts the practice", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("radio", { name: "Gentle stretch, 15 minutes" }).click();
  await page
    .getByRole("button", { name: "See the moves in Gentle stretch" })
    .click();
  await expect(page.getByLabel("1. Easy seat, 90 seconds")).toBeVisible();
  await expect(
    page.getByLabel("4. Triangle pose, left side, 90 seconds"),
  ).toBeVisible();
  await expect(page.getByLabel("10. Rest, 90 seconds")).toBeAttached();
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/features/routine-sheet.png" });
  await page.getByRole("button", { name: "Begin Gentle stretch" }).click();
  await expect(page.getByText("Easy seat", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuemax",
    "900",
  );
  expect(errors).toEqual([]);
});

test("a ready-made routine can be customised, saved and kept", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "Find your balance, 6 minutes" }).click();
  await page.getByRole("button", { name: "Customize Find your balance" }).click();
  await expect(page.getByLabel("Routine name")).toHaveValue(
    "Find your balance (my way)",
  );
  await expect(page.getByText("MOVE 6", { exact: true })).toBeVisible();
  // Hold the first tree pose twice, then add a seated rest at the end.
  await page.getByRole("button", { name: "Repeat move 3", exact: true }).click();
  await page.getByRole("button", { name: "Add a move" }).click();
  await page.getByLabel("Search moves").fill("butterfly");
  await page
    .getByRole("button", { name: "Add Butterfly seat", exact: true })
    .click();
  await expect(page.getByText(/Added Butterfly seat\./)).toBeVisible();
  await page.getByRole("button", { name: "Close move library" }).click();
  await page.getByRole("button", { name: "Save routine", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: /Find your balance \(my way\)/ }),
  ).toBeVisible();
  const { routines } = await saved(page);
  expect(routines).toHaveLength(1);
  expect(routines[0].steps.map((s: { poseId: string }) => s.poseId)).toEqual([
    "mountain",
    "chair",
    "tree-left",
    "tree-left",
    "tree-right",
    "reach",
    "mountain",
    "butterfly",
  ]);
  // The saved copy passes the app's own checks when it loads again.
  await page.reload();
  await page.getByRole("tab", { name: "My routines" }).click();
  await expect(
    page.getByRole("radio", { name: /Find your balance \(my way\)/ }),
  ).toBeVisible();
});

test("both sides are added together, and saved routines can be duplicated", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "My routines" }).click();
  await page.getByRole("button", { name: "Create a routine" }).click();
  await page.getByLabel("Routine name").fill("Strong legs");
  await page.getByRole("button", { name: "Add a move" }).click();
  await page.getByLabel("Search moves").fill("warrior");
  await page
    .getByRole("button", { name: "Add Warrior II, both sides", exact: true })
    .click();
  await expect(page.getByText("2 added", { exact: true })).toBeVisible();
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/features/move-picker.png" });
  await page.getByRole("button", { name: "Close move library" }).click();
  await expect(page.getByText("MOVE 2 · RIGHT SIDE", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save routine", exact: true }).click();
  await page.getByRole("button", { name: "Duplicate routine" }).click();
  await expect(page.getByRole("radio", { name: /Strong legs \(copy\)/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Strong legs \(copy\)/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/features/my-routines.png" });
  const { routines } = await saved(page);
  expect(routines.map((r: { name: string }) => r.name)).toEqual([
    "Strong legs",
    "Strong legs (copy)",
  ]);
  expect(routines[1].steps).toEqual(routines[0].steps);
  expect(routines[1].id).not.toBe(routines[0].id);
  expect(routines[0].steps.map((s: { poseId: string }) => s.poseId)).toEqual([
    "warrior-left",
    "warrior-right",
  ]);
});

test("practice again starts the same routine from the beginning", async ({
  page,
}) => {
  await seed(page, [
    {
      id: "custom-again",
      name: "Again",
      steps: [
        { poseId: "mountain", seconds: 15 },
        { poseId: "reach", seconds: 15 },
      ],
    },
  ]);
  await page.goto("/");
  await page.getByRole("tab", { name: "My routines" }).click();
  await page.getByRole("radio", { name: /Again/ }).click();
  await page.getByRole("button", { name: "Start yoga" }).click();
  await page.getByRole("button", { name: "Skip to next pose" }).click();
  await page.getByRole("button", { name: "Finish practice" }).click();
  await expect(page.getByText("PRACTICE COMPLETE", { exact: true })).toBeVisible();
  await expect(page.getByText("Again", { exact: true })).toBeVisible();
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/features/complete.png" });
  await page.getByRole("button", { name: "Practice again" }).click();
  await expect(page.getByText("Mountain pose", { exact: true })).toBeVisible();
  // From the start again, not where the last practice ended (30 s).
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    /^[0-3]$/,
  );
  await expect(page.getByRole("button", { name: "Pause practice" })).toBeVisible();
});
