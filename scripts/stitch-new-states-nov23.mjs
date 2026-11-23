import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const root=path.resolve('.stitch/2026-11-23');
const screens=JSON.parse(await fs.readFile(path.join(root,'new-manifest.json'),'utf8'));
const output=path.join(root,'reviewed');await fs.mkdir(output,{recursive:true});
const report=[];const browser=await chromium.launch({headless:true});
try {
 for(const screen of screens){
  const html=await fs.readFile(path.join(root,'new',`${screen.id}.html`),'utf8');
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  await page.setContent(html,{waitUntil:'load',timeout:45000});
  await page.evaluate(({id})=>{
   document.documentElement.lang='th';
   const heading=document.querySelector('header h1');
   const headings={
    '5e053a803adc4d4d8bc54ebd8666ccc5':'ออเดอร์',
    '083ebddafad04467b8e753d081281282':'ออเดอร์',
    '7508c30d05224029ac0f201ea98f29b6':'ออเดอร์',
    '8012b01124454110a8bb0d7542b340c4':'Somchai K.',
    'd26cd132698347caa94757c423451288':'รอคืนเงิน',
    'b67e72d5e3d64449b00c9c7b6968c12e':'คืนเงินแล้ว',
    '6e074cae67824d08bab35936c6dff1c3':'เทียบต้นทุน',
    'd0578c47f0104298b81db4d0f09a5074':'เทียบต้นทุน',
   };
   if(heading&&headings[id])heading.textContent=headings[id];
   const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
   while((n=walker.nextNode())){
    if(['SCRIPT','STYLE'].includes(n.parentElement?.tagName))continue;
    n.textContent=n.textContent.replace(/18\s*ต\.ค\.\s*2024/g,'20 พ.ย. 2026').replace(/Audit Verified/g,'บันทึกหลักฐานแล้ว').replace(/API Gateway v2\.4\s*•\s*Direct Route/g,'ข้อมูลแพ็กเกจที่บันทึกไว้').replace(/Instant Topup Auto\s*•\s*Pool v4/g,'ข้อมูลแพ็กเกจที่บันทึกไว้');
    if(id==='7508c30d05224029ac0f201ea98f29b6')n.textContent=n.textContent.replaceAll('Free Fire 100 Diamond','Genshin 6,480 Genesis Crystals').replaceAll('$1.20','$90.00').replace(/บันทึกแคชเมื่อ\s*5\s*นาทีก่อนหน้า/g,'ข้อมูลแคช 20 พ.ย. 2026').replaceAll('ไม่สามารถเชื่อมต่อฐานข้อมูลคำสั่งซื้อแบบเรียลไทม์ได้','ไม่สามารถโหลดรายการออเดอร์ล่าสุดจากระบบได้').replaceAll('สถานะเซิร์ฟเวอร์หลัก: Gateway API (SG-Region) ตอบสนองช้ากว่า 5000ms','เมื่อกลับมาเชื่อมต่อได้ ให้กดลองใหม่');
    if(id==='6e074cae67824d08bab35936c6dff1c3')n.textContent=n.textContent.replaceAll('310.00 THB','204,078.87 LAK').replaceAll('$9.20 USD','$9.00 USD').replaceAll('ต้นทุนสกุล THB (ไทย)','ต้นทุนสกุล LAK (ลาว)').replaceAll('2.9%','5.1%').replaceAll('แคช 15:30 น.','แคช 20 พ.ย. 15:30 น.').replaceAll('แคช 15:35 น.','แคช 20 พ.ย. 15:35 น.').replaceAll('ปัจจุบันเวลา 16:20 น.','ปัจจุบัน 23 พ.ย. 2026 เวลา 16:20 น.');
    if(id==='d0578c47f0104298b81db4d0f09a5074')n.textContent=n.textContent.replaceAll('สามารถเชื่อมต่อ API คู่ค้าเพิ่มเติมในเมนูตั้งค่าร้านค้าได้ตลอดเวลา','ตรวจสอบแพ็กเกจและโซนของร้านต้นทางก่อนเปิดขาย');
   }
   if(id==='8012b01124454110a8bb0d7542b340c4'&&heading){
    const sub=document.createElement('span');sub.textContent='บัญชี @squid_slayer99';sub.style.cssText='font-size:12px;color:#64748b;display:block';heading.append(sub);
   }
   if(id==='d26cd132698347caa94757c423451288'){
    const modal=document.getElementById('refund-modal');
    const ref=document.getElementById('slip-ref');const time=document.getElementById('slip-time');
    if(!modal||!ref||!time)throw Error('Missing refund proof controls');
    ref.name='refund_reference';ref.required=true;ref.minLength=4;ref.maxLength=100;ref.autocapitalize='none';ref.spellcheck=false;
    time.name='refunded_at';time.type='datetime-local';time.required=true;time.value='';
    const fileLabel=[...modal.querySelectorAll('label')].find(e=>e.textContent.includes('แนบไฟล์หลักฐาน'));
    const fakeUpload=fileLabel?.parentElement?.querySelector('div');
    if(!fileLabel||!fakeUpload)throw Error('Missing refund attachment field');
    fileLabel.textContent='หลักฐานการโอนเงินจริง *';fileLabel.htmlFor='refund-proof';
    const proof=document.createElement('input');proof.type='file';proof.id='refund-proof';proof.name='refund_proof';proof.accept='image/*,application/pdf';proof.required=true;proof.style.cssText='display:block;width:100%;min-height:48px;font:inherit;font-size:16px;padding:12px 0';fakeUpload.replaceWith(proof);
    for(const field of [ref,time]){const label=field.parentElement.querySelector('label');if(label){label.htmlFor=field.id;if(!label.textContent.includes('*'))label.textContent+=' *';}field.style.fontSize='16px';field.style.minHeight='48px';}
    const card=modal.firstElementChild;const fieldContainer=ref.parentElement.parentElement;
    const submit=[...modal.querySelectorAll('button')].find(b=>b.getAttribute('onclick')?.includes('submitRefundSuccess'));
    const actions=submit?.parentElement;
    if(!submit||!actions||fieldContainer===card)throw Error('Unexpected refund proof form structure');
    const form=document.createElement('form');form.id='refund-proof-form';form.setAttribute('aria-label','บันทึกหลักฐานคืนเงินจริง');form.className='flex flex-col gap-4';form.method='post';
    fieldContainer.before(form);form.append(fieldContainer,actions);submit.removeAttribute('onclick');submit.type='submit';submit.textContent='บันทึกคืนเงินแล้ว';submit.style.minHeight='48px';
    const script=document.createElement('script');script.textContent=`document.getElementById('refund-proof-form').addEventListener('submit',function(e){e.preventDefault();if(!this.reportValidity())return;closeRefundModal();showToast('ตัวอย่าง: บันทึกคืนเงินพร้อมหลักฐานแล้ว');});`;document.body.append(script);
   }
  },{id:screen.id});
  await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(300);
  // Check the proof gate without sending any data or submitting a real payment.
  let proofGate;
  if(screen.id==='d26cd132698347caa94757c423451288'){
   await page.evaluate(()=>openRefundModal());
   proofGate=await page.evaluate(()=>({requiredFields:[...document.querySelectorAll('#refund-proof-form [required]')].map(e=>e.name),emptyFormValid:document.getElementById('refund-proof-form').checkValidity()}));
   if(proofGate.emptyFormValid||proofGate.requiredFields.length!==3)throw Error('Refund proof gate failed');
   await page.locator('#slip-ref').fill('REF-DEMO-20261120');await page.locator('#slip-time').fill('2026-11-20T16:35');
   await page.locator('#refund-proof').setInputFiles({name:'proof-demo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/r1sAAAAASUVORK5CYII=','base64')});
   proofGate.completedFormValid=await page.evaluate(()=>document.getElementById('refund-proof-form').checkValidity());
   if(!proofGate.completedFormValid)throw Error('Valid refund proof rejected');
   await page.locator('#slip-ref').fill('');await page.locator('#slip-time').fill('');await page.locator('#refund-proof').setInputFiles([]);await page.evaluate(()=>closeRefundModal());
  }
  const height=await page.evaluate(()=>Math.max(innerHeight,document.body.scrollHeight,document.documentElement.scrollHeight));
  await page.setViewportSize({width:390,height:Math.min(height,5000)});await page.waitForTimeout(350);
  await fs.writeFile(path.join(output,`${screen.id}.revised.html`),await page.content());
  await page.screenshot({path:path.join(output,`${screen.id}.revised.png`),fullPage:true});
  const checks=[];for(const width of [360,390]){await page.setViewportSize({width,height:844});checks.push(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})));}
  report.push({id:screen.id,title:screen.title,checks,proofGate});console.log(JSON.stringify(report.at(-1)));await page.close();
 }
 await fs.writeFile(path.join(root,'new-states-review.json'),JSON.stringify(report,null,2));
}finally{await browser.close();}
