// Apply Stitch's returned DOM edits to archived design assets, never the live app.
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const eventsPath = process.argv[2] || '.stitch/mobile-dom-edits-3.json';
let events = JSON.parse(await fs.readFile(eventsPath, 'utf8'));
if (process.argv.includes('--all')) {
  const manifest = JSON.parse(await fs.readFile('.stitch/mobile-v2-assets.json', 'utf8'));
  const operations = new Map(events.map(event => [event.screen_id, event.dom_operations]));
  events = manifest.map(screen => ({ screen_id: screen.id, title: screen.title, dom_operations: operations.get(screen.id) || [] }));
}
const only = process.argv.find(argument => argument.startsWith('--only='))?.split('=')[1]?.split(',');
if (only) events = events.filter(event => only.includes(event.screen_id));
const directory = path.join(root, '.stitch/designs/mobile-v2');
const homeHtml = await fs.readFile(path.join(directory, '34b9fdeb804e40639a921ba74b1b3657.html'), 'utf8');
const canonicalNav = homeHtml.match(/<nav\b[\s\S]*?<\/nav>/)?.[0];
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const event of events) {
    const id = event.screen_id;
    const source = path.join(directory, `${id}.html`);
    const original = await fs.readFile(source, 'utf8');
    const backup = path.join(directory, `${id}.original.html`);
    try { await fs.writeFile(backup, original, { flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await page.setContent(original, { waitUntil: 'load', timeout: 45000 });
    const result = await page.evaluate(({ operations, screenId, title, canonicalNav }) => {
      const failures = [];
      for (const operation of operations) {
        const element = document.querySelector(operation.selector);
        if (!element) { failures.push({ selector: operation.selector, action: operation.action }); continue; }
        switch (operation.action) {
          case 'remove_element': element.remove(); break;
          case 'replace_content': element.innerHTML = operation.content || ''; break;
          case 'prepend_child': element.insertAdjacentHTML('afterbegin', operation.content || ''); break;
          case 'append_child': element.insertAdjacentHTML('beforeend', operation.content || ''); break;
          case 'remove_class': element.classList.remove(...(operation.class_name || '').split(/\s+/).filter(Boolean)); break;
          case 'add_class': element.classList.add(...(operation.class_name || '').split(/\s+/).filter(Boolean)); break;
          case 'set_attribute': element.setAttribute(operation.attr_name, operation.attr_value); break;
          case 'remove_attribute': element.removeAttribute(operation.attr_name); break;
          default: failures.push({ action: operation.action, selector: operation.selector });
        }
      }
      document.documentElement.lang = 'th';
      const titles = {
        '4433616a0ab54832b7eedf663996b094': 'เกมและแพ็กเกจ',
        'ce9dbe8e5165466f8df0b90ca75cbf45': 'ตรวจข้อมูลผู้เล่น',
        '05120508d80842c08f6895b8d9f95742': 'เทียบต้นทุน',
        'd7a3a171ea474030836a5dffc867dcdd': 'ตั้งราคาแพ็กเกจ',
        'a459f4edc0f940518e95f2031b56cd97': 'ร้านต้นทาง',
        'add2b0bd357f44be89caeb7287df6c19': 'บัญชีแอดมิน',
      };
      document.title = titles[screenId] ? `Mobile v2 — ${titles[screenId]}` : title || document.title;
      const navIndex = screenId === '34b9fdeb804e40639a921ba74b1b3657' ? 0
        : screenId === '0bfd8b266e424f8ca949b8764a01d4a6' ? 1
        : screenId === '7000516a38384fcb9a13bb7341f56066' ? 2
        : /จัดการร้าน.*Store Hub/.test(title || '') ? 3 : -1;
      if (navIndex >= 0 && canonicalNav) {
        document.querySelectorAll('nav').forEach(element => element.remove());
        document.body.insertAdjacentHTML('beforeend', canonicalNav);
        document.querySelectorAll('nav a').forEach((element, index) => {
          element.classList.remove('text-[#0000FF]', 'text-slate-500', 'font-semibold');
          element.classList.add(index === navIndex ? 'text-[#0000FF]' : 'text-slate-500');
          if (index === navIndex) element.setAttribute('aria-current', 'page'); else element.removeAttribute('aria-current');
        });
        const labels = ['ภาพรวม', 'ออเดอร์', 'แชทลูกค้า', 'จัดการร้าน'];
        const currentHeader = document.querySelector('header');
        if (currentHeader) currentHeader.outerHTML = `<header class="fixed top-0 inset-x-0 z-50 bg-white border-b border-slate-200" style="padding-top:env(safe-area-inset-top,0px)"><div class="h-14 px-4 flex items-center justify-between gap-3"><div class="flex items-center gap-3 min-w-0"><div class="h-9 w-9 shrink-0 rounded-xl bg-[#0000FF] text-white flex items-center justify-center text-sm font-bold">SQ</div><div><h1 class="font-semibold text-slate-900">${labels[navIndex]}</h1><div class="text-xs text-slate-500">Squid first</div></div></div><button type="button" aria-label="บัญชีแอดมิน" title="บัญชีแอดมิน" class="h-12 w-12 shrink-0 flex items-center justify-center text-[#0000FF]"><svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/></svg></button></div></header>`;
        document.querySelectorAll('main h1').forEach(element => {
          if (/^(ออเดอร์และการจัดส่ง|แชทลูกค้า|จัดการร้าน|ภาพรวม)$/.test(element.textContent.trim())) element.remove();
        });
      }
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (['SCRIPT','STYLE'].includes(node.parentElement?.tagName)) continue;
        node.textContent = node.textContent
          .replace(/24\s*ต\.ค\.\s*2024/g, '20 พ.ย. 2026')
          .replace(/24\s*(?:Oct|October)\s*2024/g, '20 Nov 2026')
          .replace(/jorjee-reseller\.demo\/api-feed/g, 'jorjeegamestore.com')
          .replace(/ggxgstore\.demo\/api-feed/g, 'ggxgstore.com')
          .replace(/@alex_lin_ops/g, 'บัญชีเจ้าของร้าน (ตัวอย่าง)')
          .replace(/กำลังใช้งาน\s*\(LIVE\)/g, 'ตัวอย่างสถิติย้อนหลัง')
          .replace(/ทุกวันทำการ/g, 'ตามรอบที่กำหนด')
          .replace(/฿349\.00\s*\(~\$10\.00\s*USD\)/g, '226,754.30 LAK ($10.00 USD)')
          .replace(/ยอดที่ตรวจพบ:\s*฿349\.00/g, 'ยอดที่ตรวจพบ: 226,754.30 LAK');
      }
      if (screenId === 'c8f86d84730746f0af0c4b337318158b') {
        const header = document.querySelector('header');
        if (header) header.innerHTML = '<div class="h-14 flex items-center gap-3 px-4 border-b border-slate-200 bg-white"><button aria-label="กลับจัดการร้าน" title="กลับจัดการร้าน" class="w-12 h-12 flex items-center justify-center text-[#0000FF]"><svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button><h1 class="text-lg font-semibold text-slate-900">อัตราแลกเปลี่ยน</h1></div>';
        document.querySelectorAll('span').forEach(element => {
          if (/^\+0\.12%/.test(element.textContent.trim())) element.textContent='เรทตัวอย่าง';
        });
      }
      if (screenId === 'afdfee269be84859a55d842733652a0b') {
        document.querySelectorAll('span').forEach(element => {
          if (element.children.length === 0 && /กำลังใช้งาน|^\(LIVE\)$|^LIVE$/.test(element.textContent.trim())) element.textContent='ตัวอย่างย้อนหลัง';
        });
      }
      if (screenId === '462022736c564ae4bbbffb1e7bf24a11') {
        const textNodes = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let textNode;
        while ((textNode=textNodes.nextNode())) {
          if (['STYLE','SCRIPT'].includes(textNode.parentElement?.tagName)) continue;
          if (/[ก-๙]/.test(textNode.textContent)) textNode.textContent=textNode.textContent.replace(/\s*\([A-Za-z][A-Za-z &/.-]{4,}\)/g,'');
          textNode.textContent=textNode.textContent.replace('ดึงข้อมูลใหม่','รีเฟรชหน้าจอ');
        }
      }
      if (screenId === 'b198eda757044b8abce15ef97b5d4a9e') {
        const main = document.querySelector('main');
        const shell = main?.firstElementChild;
        const header = shell?.querySelector('header');
        const orders = document.getElementById('orderList');
        const orderSection = orders?.closest('section');
        const status = orderSection?.nextElementSibling;
        const messages = status?.nextElementSibling;
        const composer = messages?.nextElementSibling;
        if (main && shell && messages && composer) {
          main.style.cssText += ';height:100dvh;min-height:0;overflow:hidden;padding:0;';
          shell.style.cssText += ';height:100%;min-height:0;overflow:hidden;';
          header.style.cssText += ';flex-shrink:0;position:relative;';
          orderSection.style.cssText += ';flex-shrink:0;';
          orders.classList.add('hidden');
          if (status) status.style.display = 'none';
          messages.style.cssText += ';flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;';
          messages.id = 'conversation-messages';
          composer.style.cssText += ';position:relative;flex-shrink:0;margin-top:0;';
          messages.querySelectorAll('img').forEach(image => {
            if (image.closest('.relative')) image.style.cssText += ';max-height:130px;object-fit:cover;';
          });
          orders.querySelectorAll('.truncate').forEach(element => element.classList.remove('truncate'));
          orders.querySelectorAll('.flex.items-center.gap-1').forEach(element => {element.style.flexWrap='wrap';});
          const input = composer.querySelector('textarea');
          if (input) { input.value='รับเรื่องแล้วครับ กำลังตรวจสอบให้ครับ'; input.textContent=input.value; input.style.minWidth='0'; }
          // Hardware-keyboard behavior belongs in implementation, not a mobile chat hint.
          document.querySelector('#composerContainer > div:last-child')?.remove();
          messages.querySelectorAll('span').forEach(element => {
            if (element.textContent.includes('ยอดสลิป:')) element.textContent='ภาพสลิปตัวอย่าง • รอตรวจด้วยมือ';
          });
        } else { failures.push({ action: 'chat-layout', selector: 'conversation shell' }); }
      }
      const font = document.createElement('link');
      font.rel = 'stylesheet'; font.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap';
      document.head.append(font);
      const style = document.createElement('style');
      style.id = 'mobile-v2-polish';
      style.textContent = `html,body{max-width:100%}body{overflow-wrap:break-word}body,input,textarea,select,button{font-family:'Noto Sans Thai',sans-serif}p,label,input,textarea,select{font-size:16px!important}input[type=checkbox],input[type=radio]{accent-color:#0000ff}button,a[role=button],nav a,label:has(input[type=checkbox]),label:has(input[type=radio]){min-height:48px}img,video{max-width:100%;object-fit:contain}h1,h2,h3{white-space:normal;overflow:visible;text-overflow:unset;text-wrap:balance}header h1{font-size:18px!important;line-height:24px!important}header>div{gap:8px}main{scroll-padding-top:64px;scroll-padding-bottom:96px}.text-primary,.text-primary-container{color:#0000ff!important}.bg-primary,.bg-primary-container,.bg-blue-600{background-color:#0000ff!important}.border-primary{border-color:#0000ff!important}`;
      document.head.append(style);
      return { failures, title: document.title, text: document.body.innerText.slice(0,150) };
    }, { operations: event.dom_operations, screenId: id, title: event.title, canonicalNav });
    if (result.failures.length) throw new Error(JSON.stringify({ id, failures: result.failures }));
    await page.waitForTimeout(1000);
    await page.evaluate(() => document.fonts.ready);
    // Expand the captured viewport vertically for a complete design canvas.
    const height = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, 844));
    await page.setViewportSize({ width: 390, height: Math.min(height, 5000) });
    await page.screenshot({ path: path.join(directory, `${id}.revised.png`), fullPage: true });
    await fs.writeFile(path.join(directory, `${id}.revised.html`), await page.content());
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    const narrow = [];
    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      narrow.push(await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        headerOverlap: (() => { const h=document.querySelector('header h1'); if(!h)return false; const a=h.getBoundingClientRect();return [...document.querySelectorAll('header button,header a')].some(e=>{const b=e.getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;}); })(),
        navLabels: [...document.querySelectorAll('nav a')].map(e=>e.innerText.trim()).filter(Boolean) })));
    }
    results.push({ id, ...result, overflow, narrow, screenshot: `${id}.revised.png` });
    console.log(JSON.stringify(results.at(-1)));
    await page.close();
  }
  let previous = [];
  if (only) { try { previous = JSON.parse(await fs.readFile('.stitch/dom-edit-review.json','utf8')); } catch {} }
  const combined = new Map(previous.map(result => [result.id,result]));
  results.forEach(result => combined.set(result.id,result));
  await fs.writeFile(path.join(root, '.stitch/dom-edit-review.json'), JSON.stringify([...combined.values()], null, 2));
} finally { await browser.close(); }
