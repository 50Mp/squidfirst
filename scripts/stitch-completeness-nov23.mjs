// Targeted updates to current user designs; no layout/theme redesign.
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const root=path.resolve('.stitch/2026-11-23');
const manifest=JSON.parse(await fs.readFile(path.join(root,'edit-manifest.json'),'utf8'));
const out=path.join(root,'reviewed'); await fs.mkdir(out,{recursive:true});
const docs=[];const report=[];
const browser=await chromium.launch({headless:true});
try {
 for(const screen of manifest){
  let original=await fs.readFile(path.join(root,'before',`${screen.id}.html`),'utf8');
  if(!/<html\b/i.test(original)){
   let revised=original.replaceAll('271,800','271,850').replaceAll('46,210','46,160').replaceAll('14.24%','14.22%');
   for(const [from,to] of [['142,500','74,200'],['98,200','112,400'],['51,800','98,600'],['32,000','39,300'],['43.9%','22.9%'],['30.3%','34.6%'],['16.0%','30.4%'],['9.8%','12.1%']])revised=revised.replaceAll(from,to);
   revised=revised.replace('Audited & Reconciled 100% (Week 47 Baseline)','ร่างข้อกำหนดและข้อมูลตัวอย่าง W47 ไม่ใช่ผลทดสอบระบบจริง');
   revised=revised.replace('ผ่านการทดสอบและกระทบยอดสมบูรณ์ 100% (Audited & Reconciled — Week 47)','ร่างดีไซน์และข้อมูลตัวอย่าง W47 ยังไม่ใช่หลักฐานการทดสอบระบบจริง');
   revised=revised.replaceAll('**กำไรขั้นต้นรับรู้จริง (Realized Gross Profit - GP):**','**กำไรหลังต้นทุนและค่าธรรมเนียม ก่อนโปรโมชั่น:**');
   revised=revised.replaceAll('**Realized Gross Profit (F):**','**Profit after COGS and fees, before promotions (F):**');
   revised += '\n\n## บันทึกตรวจความสอดคล้อง — 23 พ.ย. 2026\n\nเอกสารนี้เป็นร่างแบบและตัวอย่าง ไม่ใช่หลักฐานว่า API ซัพพลายเออร์, OCR, การโอนคืนเงิน, หรือบัญชีคู่ทำงานจริงแล้ว ต้องตรวจสัญญา API และการเชื่อมต่อก่อนนำไปใช้จริง เทคโนโลยีใน workspace ปัจจุบันคือ React + Vite, Fastify (TypeScript), PostgreSQL; รายการสแตกอื่นด้านบนเป็นทางเลือกการออกแบบในอนาคต\n\nใช้ตัวเลขอ้างอิงชุดเดียวกับรายงานมือถือ: รายรับ 324,500 THB, ต้นทุน 271,850 THB, กำไรก่อนค่าธรรมเนียม 52,650 THB, ค่าธรรมเนียม 6,490 THB, กำไรหลังค่าธรรมเนียมก่อนโปรโมชั่น 46,160 THB, โปรโมชั่น 3,310 THB, กำไรสุทธิ 42,850 THB ออเดอร์ทั้งหมด 1,024 รายการ แบ่งสำเร็จ 1,020 และคืนเงิน 4 รายการ\n\nสีหลัก #2563EB การดึงข้อมูลและเรท LFX เฉพาะ 15:00–16:00 UTC+7; รีเฟรชหน้าจอไม่ใช่การดึงข้อมูลต้นทาง การยกเลิกออเดอร์ไม่เท่ากับคืนเงินแล้ว ต้องมีสถานะรอคืนเงินและหลักฐานการโอนจริงก่อนยืนยันคืนเงินแล้ว\n';
   await fs.writeFile(path.join(out,`${screen.id}.revised.html`),revised);docs.push(screen);continue;
  }
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  await page.setContent(original,{waitUntil:'load',timeout:45000});
  const edits=await page.evaluate(({id})=>{
   let changes=0;const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
   while((n=w.nextNode())){
    if(['SCRIPT','STYLE'].includes(n.parentElement?.tagName))continue;
    let t=n.textContent;
    if(id==='d7fa95f30ae54fb785c5df37da66b0b5')t=t.replace(/16:00\s*[-–]\s*17:00/g,'15:00–16:00').replaceAll('อัปเดตข้อมูลสด','รีเฟรชหน้าจอ');
    if(id==='25c6b350cc1544a18099c83dfd4c9c92')t=t.replaceAll('ออเดอร์สำเร็จ','ออเดอร์ทั้งหมด').replaceAll('กำไรขั้นต้นก่อนหักเกตเวย์','กำไรหลังค่าธรรมเนียม ก่อนโปรโมชั่น').replaceAll('Gross Profit','Profit before promotions').replaceAll('316.90','316.89');
    if(id==='981e0b18f72c4170ab71bf7a8f9130f1')t=t.replaceAll('2894194012','294810291');
    if(t!==n.textContent){n.textContent=t;changes++;}
   }
   if(id==='62738ab1d11d4ed389259548d612189d'){
    const marker=[...document.querySelectorAll('span')].find(e=>e.children.length===0&&e.textContent.trim()==='Phonepaseuth');
    if(marker){let card=marker;while(card.parentElement&&!card.querySelector('button'))card=card.parentElement;
     for(const element of card.querySelectorAll('span'))if(element.textContent.trim()==='กำลังเติม'){element.textContent='พบปัญหา UID';changes++;}}
   }
   if(id==='981e0b18f72c4170ab71bf7a8f9130f1'){
    for(const p of document.querySelectorAll('p,span'))if(p.textContent.includes('สถานะออเดอร์จะเปลี่ยน')&&!p.querySelector('span')){
     p.textContent='การยืนยันนี้สร้างรายการรอคืนเงินเท่านั้น การยกเลิกออเดอร์ไม่ใช่การโอนเงินคืน แอดมินต้องโอนจริงและระบุเลขอ้างอิง เวลา และหลักฐานก่อนบันทึกสถานะคืนเงินแล้ว';changes++;
    }
    const action=document.getElementById('btn-submit-refund');
    if(action){const label=action.querySelector('span:last-child');if(label)label.textContent='สร้างรายการรอคืนเงิน';action.removeAttribute('onclick');action.dataset.action='request-refund';action.style.minHeight='48px';changes++;}
    for(const textarea of document.querySelectorAll('textarea'))if(textarea.value.includes('เรียบร้อยแล้ว')){textarea.value='ลูกค้าขอยกเลิกออเดอร์ รอดำเนินการโอนคืนเงินจริงและแนบหลักฐาน';textarea.textContent=textarea.value;changes++;}
   }
   return changes;
  },{id:screen.id});
  await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(350);
  let html=await page.content();
  // Update only legacy primary-color literals; retain semantic status colors.
  html=html.replace(/#(?:0000ff|1734cd)\b/gi,'#2563EB');
  await page.setContent(html,{waitUntil:'load',timeout:45000});await page.evaluate(()=>document.fonts.ready);
  const height=await page.evaluate(()=>Math.max(innerHeight,document.body.scrollHeight,document.documentElement.scrollHeight));
  await page.setViewportSize({width:390,height:Math.min(height,5000)});
  await fs.writeFile(path.join(out,`${screen.id}.revised.html`),html);
  await page.screenshot({path:path.join(out,`${screen.id}.revised.png`),fullPage:true});
  const checks=[];for(const width of [360,390]){await page.setViewportSize({width,height:844});checks.push(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})));}
  report.push({id:screen.id,edits,checks});console.log(JSON.stringify(report.at(-1)));await page.close();
 }
 await fs.writeFile(path.join(root,'ui-review.json'),JSON.stringify(report,null,2));
 await fs.writeFile(path.join(root,'documents.json'),JSON.stringify(docs,null,2));
  await fs.writeFile(path.join(root,'ui-manifest.json'),JSON.stringify(manifest.filter(s=>!docs.find(d=>d.id===s.id)&&report.find(r=>r.id===s.id)?.edits>0),null,2));
}finally{await browser.close();}
