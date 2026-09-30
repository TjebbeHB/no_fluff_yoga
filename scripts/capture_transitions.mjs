import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});await page.clock.install();await page.goto('http://localhost:8081');await page.getByRole('button',{name:'Start yoga'}).click();await page.getByRole('button',{name:'Pause practice'}).click();await page.clock.runFor(1100);
const rows=[];
for(let i=0;i<9;i++){
 const svg=page.locator('svg[aria-label$="pose illustration"]').first();const from=await svg.getAttribute('aria-label');
 const frames=[await svg.evaluate(e=>e.outerHTML)];await page.getByRole('button',{name:'Skip to next pose'}).click();await page.clock.runFor(450);frames.push(await svg.evaluate(e=>e.outerHTML));await page.clock.runFor(550);frames.push(await svg.evaluate(e=>e.outerHTML));const to=await svg.getAttribute('aria-label');
 if([1,2,3,6,7,8].includes(i))rows.push(`<h3>${from.split(' ')[0]} → ${to.split(' ')[0]}</h3><div class="row">${frames.map((f,j)=>`<div>${f}<p>${['Start','450 ms','Settled'][j]}</p></div>`).join('')}</div>`);
}
const html=`<html><head><style>body{margin:24px;background:#F8F5ED;color:#293D30;font-family:Georgia}.row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.row>div{height:270px;text-align:center}.row svg{height:240px}h3{font-weight:normal;font-size:20px;margin:20px 0 0}p{margin:0;font:11px sans-serif}</style></head><body><h1>Pose transition review</h1>${rows.join('')}</body></html>`;await writeFile('artifacts/visual-upgrade/transitions.html',html);await page.setViewportSize({width:1080,height:2000});await page.setContent(html);await page.screenshot({path:'artifacts/visual-upgrade/transitions.png',fullPage:true});await browser.close();
