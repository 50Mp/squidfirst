// Color-only revision of the current Stitch HTML, preserving structure and content.
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve('.stitch/designs/mobile-v2');
const manifest = JSON.parse(await fs.readFile('.stitch/mobile-v2-assets.json','utf8'));
const primary = '#1734CD';
const browser = await chromium.launch({ headless: true });
const report = [];
try {
  for (const screen of manifest) {
    const before = await fs.readFile(path.join(root, `${screen.id}.color-before.html`),'utf8');
    const matches = before.match(/#0000ff\b/gi) || [];
    if (!matches.length) throw new Error(`No primary color found: ${screen.id}`);
    const after = before.replace(/#0000ff\b/gi, primary);
    if (after.replace(/#1734cd\b/gi,'#0000ff') !== before.replace(/#0000ff\b/gi,'#0000ff')) {
      throw new Error(`Unexpected non-color difference: ${screen.id}`);
    }
    const originalImage = await fs.readFile(path.join(root,`${screen.id}.revised.png`));
    const height = originalImage.readUInt32BE(20) / 2;
    const page = await browser.newPage({viewport:{width:390,height:Math.ceil(height)},deviceScaleFactor:2});
    await page.setContent(after,{waitUntil:'load',timeout:45000});
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(350);
    await fs.writeFile(path.join(root,`${screen.id}.color.html`), after);
    await page.screenshot({path:path.join(root,`${screen.id}.color.png`),fullPage:true});
    report.push({id:screen.id,primary,replacements:matches.length,onlyPrimaryColorChanged:true});
    await page.close();
  }
  await fs.writeFile('.stitch/mobile-color-review.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({screens:report.length,primary,onlyPrimaryColorChanged:report.every(x=>x.onlyPrimaryColorChanged)}));
} finally {await browser.close();}
