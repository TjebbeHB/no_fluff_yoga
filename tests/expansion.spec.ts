import { test, expect } from "@playwright/test";
test("custom routines save, reload, edit, run and delete", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("tab", { name: "My routines" }).click();
  await page.getByRole("button", { name: "Create a routine" }).click();
  await page.getByRole("button", { name: "Save routine", exact: true }).click();
  await expect(page.getByText("Give your routine a name.")).toBeVisible();
  await page.getByLabel("Routine name").fill("A small reset");
  await page.getByRole("button", { name: "Add a move" }).click();
  await page.getByLabel("Search moves").fill("Tree");
  await page
    .getByRole("button", { name: "Add Low tree left", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add Low tree right", exact: true })
    .click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/expansion/move-picker.png" });
  await page.getByRole("button", { name: "Close move library" }).click();
  await page
    .getByRole("button", { name: "Move 2 earlier", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Lengthen move 1", exact: true })
    .click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/expansion/builder.png" });
  await page.getByRole("button", { name: "Save routine", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: /A small reset/ }),
  ).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("verdant.library.v1")!),
  );
  expect(saved.routines[0].steps[0].poseId).toContain("right");
  expect(saved.routines[0].steps[0].seconds).toBe(60);
  await page.reload();
  await page.getByRole("tab", { name: "My routines" }).click();
  await page.getByRole("radio", { name: /A small reset/ }).click();
  await page.getByRole("button", { name: "Edit routine", exact: true }).click();
  await page.getByLabel("Routine name").fill("My balance");
  await page.getByRole("button", { name: "Save routine", exact: true }).click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/expansion/my-routines.png" });
  await page.getByRole("button", { name: "Start yoga" }).click();
  await page.getByRole("button", { name: "Pause practice" }).click();
  await expect(page.getByText("RIGHT SIDE", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuemax",
    "105",
  );
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/expansion/custom-practice.png" });
  await page.getByRole("button", { name: "Skip to next pose" }).click();
  await expect(page.getByText("LEFT SIDE", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Finish practice" }).click();
  await expect(
    page.getByText("PRACTICE COMPLETE", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to your practice" }).click();
  await page
    .getByRole("button", { name: "Delete routine", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete saved routine", exact: true })
    .click();
  await expect(page.getByRole("radio", { name: /My balance/ })).toHaveCount(0);
  await page.reload();
  await page.getByRole("tab", { name: "My routines" }).click();
  await expect(page.getByRole("radio")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("settings persist and switching audio releases old recording", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__audios = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.loop && !(window as any).__audios.includes(this))
        (window as any).__audios.push(this);
      return play.call(this);
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("radio", { name: "Forest birds", exact: true }).click();
  await page.getByRole("switch", { name: "Transition chime" }).uncheck();
  await page.getByRole("switch", { name: "Audio guide" }).check();
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/expansion/settings.png" });
  await page.getByRole("button", { name: "Listen to sound" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__audios.at(-1)?.currentTime ?? 0),
    )
    .toBeGreaterThan(0.1);
  await page.getByRole("radio", { name: "Quiet stream", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__audios.length))
    .toBe(2);
  expect(await page.evaluate(() => (window as any).__audios[0].paused)).toBe(
    true,
  );
  await page.getByRole("button", { name: "Close settings" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "Quiet stream" }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByRole("switch", { name: "Audio guide" }),
  ).toBeChecked();
  await expect(
    page.getByRole("switch", { name: "Transition chime" }),
  ).not.toBeChecked();
  await page.getByRole("switch", { name: "Audio guide" }).uncheck();
  // The character's look follows the switches everywhere it is drawn.
  const art = page.locator('svg[aria-label$="pose illustration"]').first();
  expect(await art.evaluate((e) => e.outerHTML)).toContain("#46705A");
  await page.getByRole("switch", { name: "Open smile" }).uncheck();
  await page.getByRole("switch", { name: "Striped tee" }).uncheck();
  await page.getByRole("switch", { name: "Hair in a bun" }).check();
  expect(await art.evaluate((e) => e.outerHTML)).not.toContain("#46705A");
  await page.getByRole("button", { name: "Close settings" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("switch", { name: "Open smile" }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("switch", { name: "Striped tee" }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("switch", { name: "Hair in a bun" }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Close settings" }).click();
  await page.getByRole("button", { name: "Start yoga" }).click();
  await expect(page.getByText("Quiet stream", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(
    page.getByRole("button", { name: "Resume practice" }),
  ).toBeVisible();
});
