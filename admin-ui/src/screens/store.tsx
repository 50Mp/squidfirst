import {StitchIcon} from '../components/stitch-icon';
import {FxExample} from '../components/fx-example';
import {ReadNotice} from '../components/read-notice';
import {useEffect,useRef,useState} from 'react';
import {api,useResource,dateTime,key,refreshAll,refreshAndWait,confirmAction,dollars,type Row} from '../api';import {PageHeader,Panel,ErrorBox,Empty,Loading,Field} from '../components';
export {Store} from './store-hub';
export {Sources} from './sources';
export function ExchangeRate(){
 const {data,error,loading}=useResource('/fx'),history=useResource<{data:Row[]}>('/fx/history'),[mode,setMode]=useState('lfx'),[rate,setRate]=useState(''),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[failure,setFailure]=useState(''),[preview,setPreview]=useState<any>(null),[saved,setSaved]=useState(false),baseRevision=useRef<number>(0);
 const saving=useRef(false);
 const request=useRef<{signature:string;key:string}|undefined>(undefined);
 useEffect(()=>{if(data&&!dirty){baseRevision.current=data.revision;setMode(data.mode);setRate(data.rate?.lak_per_usd??'');}},[data,dirty]);
 async function save(){
  if(!data||loading||error||saving.current)return;
  saving.current=true;
  setBusy(true);
  try{
   if(!await confirmAction('บันทึกเรทสำหรับราคาและออเดอร์ใหม่?\nราคาและเรทของออเดอร์เดิมจะไม่เปลี่ยน'))return;
   setFailure('');
   const input={mode,...mode==='manual'?{rate}:{},revision:baseRevision.current};
   const signature=JSON.stringify(input);
   if(request.current?.signature!==signature)request.current={signature,key:key()};
   await api('/fx','PATCH',{...input,idempotency_key:request.current.key});
   request.current=undefined;
   await refreshAndWait();
   setDirty(false);
   setSaved(true);
   setPreview(null);
  }catch(e:any){setFailure(e.message);}
  finally{saving.current=false;setBusy(false);}
 }
 async function showPreview(){if(!data||loading||error||busy)return;setFailure('');try{setPreview(await api('/fx/preview','POST',{rate}));}catch(e:any){setFailure(e.message);}}
 const unavailable=!data||loading||!!error||busy;
 const activeMode=data?.mode==='manual'?'กำหนดเอง':'LFX อัตโนมัติ';
 const activeRate=data?.rate?.lak_per_usd;
 const historyRows=history.data?.data.slice(0,12)??[];
 return <div className="stitch-fx">
  <PageHeader back="/store" backIcon="arrow_back_ios_new" title="อัตราแลกเปลี่ยน"/>
  <div className="fx-toolbar">
   <span><StitchIcon name="storefront" size={15}/>จัดการร้าน › กำหนดค่าเงิน</span>
   <button className="secondary" onClick={refreshAll}><StitchIcon name="refresh" size={15}/>รีเฟรชหน้าจอ</button>
  </div>
  <ReadNotice error={error} cached={!!data}/>
  <ErrorBox message={failure}/>
  {loading&&!data?<Loading/>:data&&<>
   <Panel title="รูปแบบการใช้เรท" aside={<small className="fx-mode-badge">ใช้งานอยู่ · {activeMode}</small>}>
    <fieldset className="fx-settings-fields" disabled={unavailable}>
     <legend className="sr-only">ตั้งค่าอัตราแลกเปลี่ยน</legend>
     <div className="mode-options">
      <label className={mode==='lfx'?'selected':''}>
       <input type="radio" name="fx-mode" value="lfx" checked={mode==='lfx'} onChange={()=>{setMode('lfx');setDirty(true);setSaved(false);setPreview(null);}}/>
       <span><strong>LFX อัตโนมัติ</strong><small>ใช้ USD ช่วง 15:00–16:00 ที่ดึงมาเก็บล่าสุด</small></span>
      </label>
      <label className={mode==='manual'?'selected':''}>
       <input type="radio" name="fx-mode" value="manual" checked={mode==='manual'} onChange={()=>{setMode('manual');setDirty(true);setSaved(false);setPreview(null);}}/>
       <span><strong>กำหนดเอง (Manual Override)</strong><small>ใช้เรทนี้จนกว่าจะสลับกลับ LFX</small></span>
      </label>
     </div>
    </fieldset>
   </Panel>
   <Panel>
    <div className="fx-card-heading"><h2><StitchIcon name="currency_exchange" size={18}/>เรทแลกเปลี่ยนปัจจุบันในระบบ</h2><span>{activeMode}</span></div>
    <div className="rate-display">
     <strong>1 USD = {activeRate?Number(activeRate).toLocaleString('en-US',{maximumFractionDigits:6}):'—'} LAK</strong>
     <p>กีบลาว (LAK) ต่อ ดอลลาร์สหรัฐ (USD)</p>
    </div>
    <dl className="fx-facts">
     <div><dt><StitchIcon name="schedule" size={15}/>รอบข้อมูล LFX</dt><dd>15:00–16:00 UTC+7</dd></div>
     <div><dt>{data.mode==='manual'?'บันทึก':'ดึงข้อมูล'}ล่าสุด</dt><dd>{dateTime(data.rate?.provided_at??data.rate?.fetched_at)}</dd></div>
    </dl>
   </Panel>
   <Panel>
    <div className="fx-card-heading"><h2><StitchIcon name="tune" size={18}/>ปรับแต่งเรท</h2></div>
    <fieldset className="fx-settings-fields" disabled={unavailable}>
     <legend className="sr-only">ปรับแต่งและบันทึกเรท</legend>
     {mode==='manual'&&<Field label="1 USD เท่ากับกี่ LAK"><div className="input-suffix">
      <input aria-label="เรท LAK ต่อ USD" inputMode="decimal" value={rate} onChange={e=>{setRate(e.target.value);setDirty(true);setSaved(false);setPreview(null);}}/><span>LAK</span>
     </div></Field>}
     {mode==='lfx'&&data.mode!=='lfx'&&<p className="notice">บันทึกโหมด LFX แล้วโหลดเรทล่าสุดก่อนคำนวณ</p>}
     <FxExample rate={mode==='manual'?rate:data.mode==='lfx'?activeRate??'':''} disabled={unavailable}/>
     <div className="button-row">
      {mode==='manual'&&<button className="secondary" onClick={showPreview}>ดูผลต่อราคาขาย</button>}
      <button className="primary" disabled={unavailable||!dirty} onClick={save}>บันทึกอัตราแลกเปลี่ยน</button>
     </div>
    </fieldset>
    {saved&&<p className="success-line"><StitchIcon name="check_circle" size={16}/>บันทึกเรทแล้ว ออเดอร์เดิมยังใช้เรทเดิม</p>}
   </Panel>
   {preview&&<Panel title="ตัวอย่างราคาก่อน–หลัง">
    {preview.data.length?preview.data.map((p:Row)=><div className="preview-line" key={p.id}>
     <span>{p.name}</span><strong>{dollars(p.before.details?.price_usd)} → {dollars(p.after.details?.price_usd)}</strong>
    </div>):<p className="muted">ยังไม่มีแพ็กเกจที่เผยแพร่ให้คำนวณตัวอย่าง</p>}
   </Panel>}
   <Panel title="ประวัติการปรับเรทล่าสุด" aside={history.data&&<small className="fx-history-count">{historyRows.length} รายการล่าสุด</small>}>
    <ReadNotice error={history.error} cached={!!history.data}/>
    {history.loading&&!history.data?<Loading/>:history.data&&(historyRows.length?historyRows.map(r=><div className="history-line" key={r.id}>
     <span><strong>{r.origin==='lfx'?'LFX อัตโนมัติ':'กำหนดเอง'}</strong><small><time dateTime={r.at}>{dateTime(r.at)}</time></small></span><b>{Number(r.lak_per_usd).toLocaleString('en-US',{maximumFractionDigits:6})} LAK</b>
    </div>):<Empty title="ยังไม่มีประวัติเรท"/>)}
    <a className="secondary fx-audit-link" href="#/store/audit?category=fx&from=fx">ดูกิจกรรมการเปลี่ยนเรท<StitchIcon name="chevron_right" size={16}/></a>
   </Panel>
   <p className="footnote">LFX ไม่ได้ระบุวันเผยแพร่ในข้อมูลที่ดึงมา เวลาที่แสดงคือเวลาดึงข้อมูลของระบบ</p>
  </>}
 </div>;
}
