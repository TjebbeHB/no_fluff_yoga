import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({viewport:{width:1024,height:1024},deviceScaleFactor:1});
const leaves = `<path d="M336 733 Q585 553 665 271" fill="none" stroke="#35533D" stroke-width="17" stroke-linecap="round"/>
<path d="M414 669 Q242 620 304 464 Q440 491 414 669Z M490 594 Q472 412 362 377 Q307 554 490 594Z M557 482 Q407 365 470 265 Q593 339 557 482Z M611 375 Q554 222 659 194 Q723 289 611 375Z M449 642 Q617 709 668 552 Q525 522 449 642Z M532 534 Q711 557 726 415 Q594 403 532 534Z M599 414 Q766 405 753 290 Q661 294 599 414Z" fill="#7D8C6C"/>`;
for (const [name,background,size] of [['icon.png','#F8F5ED',1024],['android-icon-foreground.png','transparent',1024],['android-icon-monochrome.png','transparent',1024],['favicon.png','#F8F5ED',64]]) {
 await page.setViewportSize({width:size,height:size});
 await page.setContent(`<html><body style="margin:0;background:${background}"><svg width="${size}" height="${size}" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">${leaves}</svg></body></html>`);
 await page.screenshot({path:`assets/${name}`,omitBackground:background==='transparent'});
}
await browser.close();
