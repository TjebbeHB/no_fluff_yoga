import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const root='artifacts/visual-upgrade';await mkdir(root,{recursive:true});
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.PREVIEW_URL || 'http://localhost:8081');await page.getByText('Your practice.').waitFor();await page.screenshot({path:`${root}/after-home.png`});
const poses=new Map();
for(const routine of ['Morning flow, 10 minutes','Gentle stretch, 15 minutes']){
 await page.getByRole('radio',{name:routine}).click();await page.getByRole('button',{name:'Start yoga'}).click();await page.getByRole('button',{name:'Pause practice'}).click();
 for(let i=0;i<10;i++){
 const svg=page.locator('svg[aria-label$="pose illustration"]').first();await page.waitForTimeout(80);const name=await svg.getAttribute('aria-label');if(!poses.has(name)){poses.set(name,await svg.evaluate(e=>e.outerHTML));await svg.screenshot({path:`${root}/${name.split(' ')[0]}.png`});}
 if(name==='triangle pose illustration'&&i===3)await page.screenshot({path:`${root}/after-practice.png`});
 if(name==='warrior pose illustration'&&i===4)await page.screenshot({path:`${root}/warrior-screen.png`});
 if(i<9)await page.getByRole('button',{name:'Skip to next pose'}).click();
 }
 await page.getByRole('button',{name:'Leave practice'}).click();await page.getByRole('button',{name:'End practice',exact:true}).click();
}
const html=`<html><body style="margin:0;background:#F8F5ED;color:#293D30;font-family:Georgia;padding:32px"><div style="font-size:36px;margin:0 0 10px">Verdant · The illustration collection</div><p style="font:12px sans-serif;letter-spacing:2px;color:#7A7E70;margin-bottom:30px">NINE ANIMATED POSES · SAGE, IVORY & SOFT NATURAL LIGHT</p><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px">${[...poses].map(([name,svg])=>`<div style="background:#FDFBF6;border:1px solid #E4E4D8;border-radius:18px;overflow:hidden"><div style="height:300px">${svg}</div><p style="font-size:20px;text-align:center;margin:6px 0 18px">${name.split(' ')[0]}</p></div>`).join('')}</div></body></html>`;
await writeFile(`${root}/pose-gallery.html`,html);await page.setViewportSize({width:1200,height:1230});await page.setContent(html);await page.screenshot({path:`${root}/pose-gallery.png`,fullPage:true});console.log({poses:poses.size,errors});await browser.close();
