// Deterministic live-app motion evidence: transition frames, contact sheets and video.
// Run after starting Expo web: node scripts/capture_motion.cjs
const { chromium } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const baseURL = process.env.MOTION_URL || 'http://localhost:8081';
const out = path.resolve(process.env.MOTION_OUT || 'artifacts/motion');
const stepMs = Number(process.env.MOTION_STEP_MS || 100);
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,filename);
const {planMotion}=require('../src/motion.ts');
const target = id => ({shape:id.split('-')[0],side:id.split('-')[1]});
let cases = [
  ['reach', 'mountain', 'reach'],
  ['chair', 'mountain', 'chair'],
  ['fold', 'mountain', 'fold'],
  ['tree', 'mountain', 'tree-left'],
  ['floor', 'tabletop', 'child'],
  ['floor-return', 'child', 'tabletop'],
  ['side-change', 'warrior-left', 'warrior-right'],
  ['floor-change', 'tree-left', 'rest'],
];
if(process.env.MOTION_ALL === '1') {
 const {routines}=require('../src/routines.ts');
 const id=p=>p.shape+(p.side?'-'+p.side:'');
 const seen=new Set(cases.map(c=>c.slice(1).join('>')));
 for(const routine of routines) for(let i=1;i<routine.poses.length;i++){
  const from=id(routine.poses[i-1]),to=id(routine.poses[i]);
  if(!seen.has(from+'>'+to)){cases.push([routine.id+'-'+i,from,to]);seen.add(from+'>'+to);}
 }
}
if(process.env.MOTION_CASES) cases=cases.filter(c=>process.env.MOTION_CASES.split(',').includes(c[0]));
(async () => {
 await fs.mkdir(out, { recursive: true });
 const browser = await chromium.launch();
 const errors = [];
 for (const [name, from, to] of cases) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  await context.addInitScript(({ from, to }) => localStorage.setItem('verdant.library.v1', JSON.stringify({ version: 1, routines: [{ id: 'custom-motion', name: 'Movement review', steps: [{ poseId: from, seconds: 15 }, { poseId: to, seconds: 15 }] }], preferences: { ambient: 'rain', ambientEnabled: false, chime: false, speech: false } })), { from, to });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  await page.clock.install();
  await page.goto(baseURL);
  await page.getByRole('tab', { name: 'My routines' }).click();
  await page.getByRole('radio', { name: 'Movement review, 0.5 minutes' }).click();
  await page.getByRole('button', { name: 'Start yoga' }).click();
  await page.clock.runFor(100);
  const ready = page.getByRole('button', { name: 'Start pose hold' });
  if (await ready.isVisible()) await ready.click();
  const svg = page.locator('svg[aria-label$="pose illustration"]').first();
  const frames = [{ time: 0, svg: await svg.evaluate(e => e.outerHTML) }];
  await page.getByRole('button', { name: 'Skip to next pose' }).click();
  const motionSeconds = planMotion(target(from),target(to)).duration;
  const caseDuration = Math.max(600, motionSeconds*1000+300);
  for (let time = stepMs; time <= caseDuration; time += stepMs) {
   await page.clock.runFor(stepMs);
   frames.push({ time, svg: await svg.evaluate(e => e.outerHTML) });
  }
  await page.screenshot({ path: path.join(out, `${name}-app.png`) });
  await fs.writeFile(path.join(out, `${name}-frames.json`), JSON.stringify(frames));
  const activeFrames = frames.filter(f => f.time <= (motionSeconds + 0.3) * 1000);
  const selected = Array.from({length:12}, (_,i) => activeFrames[Math.round(i*(activeFrames.length-1)/11)]);
  const html = `<html><style>body{margin:24px;background:#F8F5ED;color:#293D30;font:16px sans-serif}h1{font:30px Georgia}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.grid svg{width:100%;height:220px}.frame{text-align:center}p{margin:4px}</style><h1>${from} → ${to}</h1><p>Live player sampled every ${stepMs}ms; selected frames below.</p><div class="grid">${selected.map(f => `<div class="frame">${f.svg}<p>${(f.time/1000).toFixed(1)} seconds</p></div>`).join('')}</div></html>`;
  await fs.writeFile(path.join(out, `${name}-sequence.html`), html);
  const render = await context.newPage();
  await render.setViewportSize({ width: 1120, height: 900 });
  await render.setContent(html);
  await render.screenshot({ path: path.join(out, `${name}-sequence.png`), fullPage: true });
  if (['reach', 'chair', 'floor'].includes(name)) {
   const frameDir = path.join(out, `${name}-video-frames`);
   await fs.mkdir(frameDir, { recursive: true });
   await render.setViewportSize({ width: 480, height: 470 });
   for (let i = 0; i < frames.length; i++) {
    await render.setContent(`<html><style>body{margin:0;background:#F8F5ED;color:#293D30;text-align:center;font:18px Georgia}svg{width:460px;height:405px}p{margin:8px}</style><p>${from} → ${to}</p>${frames[i].svg}</html>`);
    await render.screenshot({ path: path.join(frameDir, `${String(i).padStart(4,'0')}.png`) });
   }
   const result = spawnSync('ffmpeg', ['-y','-framerate',String(1000/stepMs),'-i',path.join(frameDir,'%04d.png'),'-vf','format=yuv420p','-movflags','+faststart',path.join(out,`${name}.mp4`)],{encoding:'utf8'});
   if(result.status) throw new Error(result.stderr);
   const gif = spawnSync('ffmpeg', ['-y','-i',path.join(out,`${name}.mp4`),'-vf','fps=10,scale=400:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse','-loop','0',path.join(out,`${name}.gif`)],{encoding:'utf8'});
   if(gif.status) throw new Error(gif.stderr);
  }
  await context.close();
  console.log(`Captured ${name}`);
 }
 await fs.writeFile(path.join(out,'capture-report.json'),JSON.stringify({ baseURL, stepMs, cases: cases.map(([name,from,to])=>({name,from,to,...(({duration,manual})=>({duration,manual}))(planMotion(target(from),target(to)))})), errors },null,2));
 await browser.close();
 if(errors.length) throw new Error(errors.join('\n'));
})();
