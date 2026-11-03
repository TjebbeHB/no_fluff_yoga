// Draws every app icon from the Verdant mark in src/brand.ts.
//   node scripts/generate_icons.cjs
// Uses Playwright's Chromium (npx playwright install chromium).
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    filename,
  );
const { chromium } = require("@playwright/test");
const {
  ANDROID_ICON_SCALE,
  BRAND,
  MARK,
  MARK_CANVAS,
} = require("../src/brand.ts");

const C = MARK_CANVAS / 2;
const gradient = `<linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
  <stop offset="0" stop-color="${BRAND.icon.top}"/>
  <stop offset="1" stop-color="${BRAND.icon.bottom}"/>
</linearGradient>`;
const mark = (colors, scale = 1) =>
  `<g transform="translate(${C} ${C}) scale(${scale}) translate(${-C} ${-C})">
    <path d="${MARK.left}" fill="${colors.left}"/>
    <path d="${MARK.right}" fill="${colors.right}"/>
    <circle cx="${MARK.sun.cx}" cy="${MARK.sun.cy}" r="${MARK.sun.r}" fill="${colors.sun}"/>
  </g>`;
const white = { left: "#FFFFFF", right: "#FFFFFF", sun: "#FFFFFF" };
const full = `0 0 ${MARK_CANVAS} ${MARK_CANVAS}`;
const { x, y, size } = MARK.bounds;

const ICONS = [
  // iOS and the store listing: square and opaque; the system rounds the corners.
  {
    file: "icon.png",
    size: 1024,
    body: `<defs>${gradient}</defs><rect width="100%" height="100%" fill="url(#bg)"/>${mark(BRAND.icon)}`,
  },
  // Android adaptive icon: the mark sits well inside the 66 dp safe circle.
  {
    file: "android-icon-background.png",
    size: 1024,
    body: `<defs>${gradient}</defs><rect width="100%" height="100%" fill="url(#bg)"/>`,
  },
  {
    file: "android-icon-foreground.png",
    size: 1024,
    transparent: true,
    body: mark(BRAND.icon, ANDROID_ICON_SCALE),
  },
  // Android 13+ themed icons use only the shape.
  {
    file: "android-icon-monochrome.png",
    size: 1024,
    transparent: true,
    body: mark(white, ANDROID_ICON_SCALE),
  },
  // Browser tab: the icon with its corners already rounded, the mark a little
  // larger so it still reads at 16 px.
  {
    file: "favicon.png",
    size: 64,
    transparent: true,
    body: `<defs>${gradient}</defs><rect width="100%" height="100%" rx="232" fill="url(#bg)"/>${mark(BRAND.icon, 1.14)}`,
  },
  // Launch screen: the mark alone on the app's ivory paper.
  {
    file: "splash-icon.png",
    size: 1024,
    transparent: true,
    viewBox: `${x} ${y} ${size} ${size}`,
    body: mark(BRAND.paper),
  },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const icon of ICONS) {
    await page.setViewportSize({ width: icon.size, height: icon.size });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">` +
        `<svg xmlns="http://www.w3.org/2000/svg" width="${icon.size}" height="${icon.size}" viewBox="${icon.viewBox ?? full}">${icon.body}</svg>` +
        `</body></html>`,
    );
    const out = path.join(__dirname, "..", "assets", icon.file);
    await page.screenshot({ path: out, omitBackground: !!icon.transparent });
    console.log(`assets/${icon.file}`);
  }
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
