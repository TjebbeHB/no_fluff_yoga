// Composes docs/images/verdant-yoga.png from live screenshots of the app.
// Start the web preview first (npx expo start --web --port 8081), then:
//   node scripts/capture_readme.cjs
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");

const ROOT = path.join(__dirname, "..");
const URL = process.env.APP_URL ?? "http://localhost:8081";
const b64 = (file, type) =>
  `data:${type};base64,${fs.readFileSync(file).toString("base64")}`;
const font = (pkg, file) =>
  b64(path.join(ROOT, "node_modules/@expo-google-fonts", pkg, file), "font/ttf");

(async () => {
  const browser = await chromium.launch();
  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  // A fixed morning, so the greeting matches the routine on show.
  await phone.clock.setFixedTime(new Date("2026-05-04T08:30:00"));
  const shots = {};
  await phone.goto(URL);
  await phone.getByText("Your practice.").waitFor();
  await phone.waitForTimeout(800);
  shots.home = await phone.screenshot();
  await phone.getByRole("button", { name: "Customize Morning flow" }).click();
  await phone.waitForTimeout(600);
  shots.builder = await phone.screenshot();
  await phone.getByRole("button", { name: "Cancel editing" }).click();
  await phone.getByRole("button", { name: "Discard changes" }).click();
  await phone.getByRole("radio", { name: "Find your balance, 6 minutes" }).click();
  await phone.getByRole("button", { name: "Start yoga" }).click();
  for (let i = 0; i < 2; i++)
    await phone.getByRole("button", { name: "Skip to next pose" }).click();
  await phone.waitForTimeout(1500);
  shots.practice = await phone.screenshot();
  await phone.close();

  const img = (buffer) => `data:image/png;base64,${buffer.toString("base64")}`;
  const icon = b64(path.join(ROOT, "assets/icon.png"), "image/png");
  const html = `<html><head><style>
    @font-face { font-family: Cormorant; src: url(${font("cormorant-garamond/500Medium", "CormorantGaramond_500Medium.ttf")}); }
    @font-face { font-family: DMSans; font-weight: 400; src: url(${font("dm-sans/400Regular", "DMSans_400Regular.ttf")}); }
    @font-face { font-family: DMSans; font-weight: 500; src: url(${font("dm-sans/500Medium", "DMSans_500Medium.ttf")}); }
    body { margin: 0; width: 1600px; height: 1050px; background: #EFEDE3; color: #23362A; font-family: DMSans; }
    header { display: flex; align-items: center; gap: 28px; padding: 64px 80px 0; }
    header img { width: 104px; height: 104px; border-radius: 24px; box-shadow: 0 10px 28px rgba(35,54,42,.18); }
    h1 { font-family: Cormorant; font-weight: 500; font-size: 64px; line-height: 1; margin: 0 0 10px; }
    p { margin: 0; font-size: 21px; color: #5C6557; }
    .brand { margin-left: auto; font-size: 15px; font-weight: 500; letter-spacing: 4px; color: #5C6557; }
    .phones { display: flex; justify-content: center; align-items: flex-start; gap: 56px; margin-top: 54px; }
    figure { margin: 0; text-align: center; }
    figure img { width: 300px; height: 649px; border-radius: 36px; border: 8px solid #FFFDF8;
      box-shadow: 0 2px 6px rgba(35,54,42,.08), 0 24px 48px rgba(35,54,42,.14); }
    figure.raised { margin-top: -26px; }
    figcaption { margin-top: 20px; font-size: 19px; font-weight: 500; }
  </style></head><body>
    <header>
      <img src="${icon}">
      <div><h1>Yoga, without ads or fluff.</h1><p>Pick a routine. Make it yours. Take a break.</p></div>
      <div class="brand">VERDANT YOGA</div>
    </header>
    <div class="phones">
      <figure><img src="${img(shots.home)}"><figcaption>Pick a routine</figcaption></figure>
      <figure class="raised"><img src="${img(shots.practice)}"><figcaption>Follow illustrated poses</figcaption></figure>
      <figure><img src="${img(shots.builder)}"><figcaption>Make it yours</figcaption></figure>
    </div>
  </body></html>`;
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1050 },
    deviceScaleFactor: 1,
  });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const out = path.join(ROOT, "docs/images/verdant-yoga.png");
  await page.screenshot({ path: out });
  console.log(path.relative(ROOT, out));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
