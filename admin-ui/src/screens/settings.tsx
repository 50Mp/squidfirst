import {StitchIcon} from '../components/stitch-icon';
import {ReadNotice} from '../components/read-notice';
import {ArrowLeftRight,ClipboardList,Database,History,MessageSquare,Package,Settings2,Store} from 'lucide-react';
import {useRef,useState} from 'react';import {api,useResource,key,navigate,refreshAll,dateTime,shortId,type Row} from '../api';import {PageHeader,Panel,Field,Toggle,ErrorBox,Empty,Loading} from '../components';
type Versioned<T>={value:T;revision:number};
type BankAccount={bank:string;name:string;number:string};
type PaymentSettings={instructions:string;accounts:BankAccount[]};
interface ShopSettingsData {
 pricing:Versioned<{default_markup_bps:number}>;
 payments:Versioned<PaymentSettings>;
 alerts:Versioned<{enabled:boolean}>;
}

function useSettingDraft<T>(remote:Versioned<T>|undefined){
 const [draft,setDraft]=useState<Versioned<T>>();
 const [acknowledged,setAcknowledged]=useState<Versioned<T>>();
 const current=acknowledged&&(!remote||remote.revision<acknowledged.revision)?acknowledged:remote;
 return {
  value:(draft??current)?.value,
  revision:(draft??current)?.revision,
  dirty:!!draft,
  edit(value:T){
   if(current)setDraft(previous=>({value,revision:previous?.revision??current.revision}));
  },
  accept(value:T,revision:number){
   setAcknowledged({value,revision});
   setDraft(undefined);
  },
 };
}

export function ShopSettings({pricing=false}:{pricing?:boolean}){
 const {data,error,loading}=useResource<ShopSettingsData>('/settings');
 const markup=useSettingDraft(data?.pricing&&{value:String(data.pricing.value.default_markup_bps/100),revision:data.pricing.revision});
 const payments=useSettingDraft(data?.payments);
 const alerts=useSettingDraft(data?.alerts&&{value:data.alerts.value.enabled,revision:data.alerts.revision});
 const [failure,setFailure]=useState('');
 const [saved,setSaved]=useState(false);
 const [busy,setBusy]=useState(false);
 const saving=useRef(false);
 const requests=useRef<Partial<Record<keyof ShopSettingsData,{signature:string;key:string}>>>({});
 const locked=loading||!!error||busy;

 async function save(id:keyof ShopSettingsData,expectedRevision:number|undefined,value:unknown,accept:(revision:number)=>void){
  if(!data||locked||saving.current||expectedRevision===undefined)return;
  saving.current=true;
  setBusy(true);
  setFailure('');
  setSaved(false);
  const input={value,expected_revision:expectedRevision};
  const signature=JSON.stringify(input);
  const previous=requests.current[id];
  const request=previous?.signature===signature?previous:{signature,key:key()};
  requests.current[id]=request;
  try{
   const result=await api<{revision:number}>('/settings/'+id,'PATCH',{...input,idempotency_key:request.key});
   accept(result.revision);
   delete requests.current[id];
   setSaved(true);
   refreshAll();
  }catch(e){
   setFailure((e as Error).message);
  }finally{
   saving.current=false;
   setBusy(false);
  }
 }

 const payment=payments.value;
 function editPayments(value:PaymentSettings){payments.edit(value);setSaved(false);}
 const currentMarkup=markup.value??'';
 const enabled=alerts.value??false;
 return <div className="store-detail shop-settings">
  <PageHeader back="/store" title={pricing?'กำไรเริ่มต้น':'ตั้งค่าร้าน'} subtitle={pricing?'เปอร์เซ็นต์บวกจากทุน สำหรับแพ็กเกจที่เลือกใช้ค่าเริ่มต้น':'ข้อมูลรับเงินและการแจ้งเตือนภายในร้าน'}/>
  <ReadNotice error={error} cached={!!data}/>
  <ErrorBox message={failure}/>
  {loading&&!data?<Loading/>:data?<fieldset className="fx-settings-fields" disabled={locked}>
   {pricing?<Panel>
    <Field label="บวกจากทุน (%)"><input type="number" min="0" max="100" step="0.01" value={currentMarkup} onChange={e=>{markup.edit(e.target.value);setSaved(false);}}/></Field>
    <div className="notice">ทุน $10.00 + {currentMarkup||0}% → ราคาขาย ${(10*(1+Number(currentMarkup)/100)).toFixed(2)}<br/>10% บวกจากทุน เท่ากับกำไร 9.09% ของยอดขาย ก่อนค่าใช้จ่ายอื่น</div>
    <button className="primary" disabled={!markup.dirty} onClick={()=>save('pricing',markup.revision,{default_markup_bps:Math.round(Number(currentMarkup)*100)},revision=>markup.accept(currentMarkup,revision))}>บันทึกกำไรเริ่มต้น</button>
    <p className="footnote">ออเดอร์เดิมใช้ราคาเดิม แพ็กเกจที่กำหนดกำไรแยกจะไม่เปลี่ยน</p>
   </Panel>:payment&&<>
    <Panel title="ข้อมูลรับชำระเงิน">
     {payment.accounts.map((account,index)=><div className="bank-block" key={index}>
      {(['bank','name','number'] as const).map((field,fieldIndex)=><Field key={field} label={['ธนาคาร','ชื่อบัญชี','เลขบัญชี'][fieldIndex]}>
       <input value={account[field]} maxLength={150} onChange={e=>editPayments({...payment,accounts:payment.accounts.map((row,i)=>i===index?{...row,[field]:e.target.value}:row)})}/>
      </Field>)}
      <button className="quiet danger" onClick={()=>editPayments({...payment,accounts:payment.accounts.filter((_,i)=>i!==index)})}>ลบบัญชีนี้</button>
     </div>)}
     <button className="secondary" disabled={payment.accounts.length>=5} onClick={()=>editPayments({...payment,accounts:[...payment.accounts,{bank:'',name:'',number:''}]})}>เพิ่มบัญชีรับเงิน</button>
     <Field label="คำแนะนำการชำระเงิน"><textarea rows={4} maxLength={2000} value={payment.instructions} onChange={e=>editPayments({...payment,instructions:e.target.value})}/></Field>
     <button className="primary" disabled={!payments.dirty} onClick={()=>save('payments',payments.revision,payment,revision=>payments.accept(payment,revision))}>บันทึกข้อมูลรับเงิน</button>
    </Panel>
    <Panel title="การแจ้งเตือนระบบ">
     <Toggle label="แจ้งเตือนเมื่อร้านต้นทางดึงข้อมูลไม่สำเร็จ" checked={enabled} onChange={value=>{alerts.edit(value);setSaved(false);}}/>
     <p className="footnote">การตั้งค่านี้ไม่ปิดการแจ้งออเดอร์และข้อความลูกค้า</p>
     <button className="secondary" disabled={!alerts.dirty} onClick={()=>save('alerts',alerts.revision,{enabled},revision=>alerts.accept(enabled,revision))}>บันทึกการแจ้งเตือน</button>
    </Panel>
   </>}
  </fieldset>:null}
  {saved&&<p role="status" className="success-line">บันทึกเรียบร้อยแล้ว</p>}
 </div>;
}
const auditLabels:Readonly<Record<string,string>>={
 'order.approve':'ยืนยันรับเงิน','order.accept':'รับงาน','order.start':'เริ่มเติม',
 'order.complete':'เติมสำเร็จ','order.reopen':'เปิดออเดอร์อีกครั้ง','order.issue':'แจ้งปัญหา',
 'order.resume':'ดำเนินงานต่อ','order.cancel':'ยกเลิกออเดอร์','order.refund':'บันทึกการคืนเงิน',
 'source.toggle':'เปลี่ยนสถานะร้านต้นทาง','source.sync':'ดึงข้อมูลร้านต้นทาง',
 'fx.select':'เปลี่ยนอัตราแลกเปลี่ยน','settings.update':'แก้ไขการตั้งค่าร้าน',
 'product.create':'สร้างแพ็กเกจ','product.update':'แก้ไขแพ็กเกจ',
 'game.toggle':'เปลี่ยนสถานะเกม','zone.toggle':'เปลี่ยนสถานะโซน',
 'chat.public':'ตอบข้อความลูกค้า','chat.internal':'เพิ่มบันทึกภายใน','backup.create':'สร้างสำเนาสำรอง',
};
const auditEntities:Readonly<Record<string,{label:string;icon:typeof History}>>={
 order:{label:'ออเดอร์',icon:ClipboardList},customer:{label:'ลูกค้า',icon:MessageSquare},
 source:{label:'ร้านต้นทาง',icon:Store},product:{label:'สินค้า',icon:Package},
 settings:{label:'การตั้งค่า',icon:Settings2},fx:{label:'อัตราแลกเปลี่ยน',icon:ArrowLeftRight},
};
const auditFxModes:Readonly<Record<string,string>>={manual:'กำหนดเอง',lfx:'LFX อัตโนมัติ'};
export function Audit({search}:Readonly<{search?:string}>){
 const filters=new URLSearchParams(search);
 const fromFx=filters.get('from')==='fx';
 const categories:ReadonlyArray<readonly [string,string]>=[['','ทั้งหมด'],['payment','ตรวจสลิป'],['order','สถานะออเดอร์'],['pricing','อัปเดตราคา/ต้นทุน']];
 const visibleCategories=fromFx||filters.get('category')==='fx'?[['fx','อัตราแลกเปลี่ยน'] as const,...categories]:categories;
 const category=visibleCategories.find(([value])=>value===filters.get('category'))?.[0]??'';
 const before=filters.get('before')??'';
 const query=new URLSearchParams();
 if(category)query.set('category',category);
 if(before)query.set('before',before);
 const {data,error,loading}=useResource('/audit'+(query.size?'?'+query:''),{resetOnPathChange:true});
 const entries:Row[]=data?.data??[];
 function openPage(nextCategory:string,cursor=''){
  const params=new URLSearchParams();
  if(nextCategory)params.set('category',nextCategory);
  if(cursor)params.set('before',cursor);
  if(fromFx)params.set('from','fx');
  navigate('/store/audit'+(params.size?'?'+params:''));
 }
 return <div className="stitch-audit">
  <PageHeader back={fromFx?'/store/fx':'/store'} backIcon="arrow_back" title="กิจกรรมล่าสุด">
   <button className="secondary" onClick={refreshAll}><StitchIcon name="sync" size={16}/>รีเฟรช</button>
  </PageHeader>
  <div className="audit-intro"><span>บันทึกประวัติและขั้นตอนการดำเนินงาน</span>{data&&<small>{entries.length} กิจกรรม</small>}</div>
  <div className="audit-filters" role="group" aria-label="ประเภทกิจกรรม">
   {visibleCategories.map(([value,label])=><button key={value} type="button" aria-pressed={category===value} onClick={()=>openPage(value)}>{label}</button>)}
  </div>
  <ReadNotice error={error} cached={!!data}/>
   {loading&&!data?<Loading/>:data?(entries.length?<ul className="audit-list" aria-label="ประวัติกิจกรรม">
    {entries.map(entry=>{
     const entity=Object.hasOwn(auditEntities,entry.entity_type)?auditEntities[entry.entity_type]:undefined;
     const Icon=entry.action==='backup.create'?Database:entity?.icon??History;
     const label=Object.hasOwn(auditLabels,entry.action)?auditLabels[entry.action]:entry.action;
     const orderId=String(entry.entity_id);
     const nextMode=entry.action==='fx.select'?auditFxModes[entry.after_data?.mode]:undefined;
     const previousMode=nextMode?auditFxModes[entry.before_data?.mode]:undefined;
     return <li className="audit-row" key={entry.id}>
      <div className="audit-meta">
       <span className="audit-kind"><Icon size={14} aria-hidden="true"/>{entity?.label??entry.entity_type}</span>
       <time dateTime={entry.created_at}>{dateTime(entry.created_at)}</time>
      </div>
      <strong>{label}</strong>
      {nextMode&&<p className="audit-fx-change">{previousMode&&previousMode!==nextMode?previousMode+' → ':''}{nextMode}</p>}
      <div className="audit-row-footer">
       <span>{entry.channel==='telegram'?'Telegram':entry.channel==='miniapp'?'Mini App':entry.channel} · {shortId(orderId)}</span>
       {entry.entity_type==='order'&&<button className="secondary" onClick={()=>navigate('/orders/'+encodeURIComponent(orderId))}>ดูออเดอร์<StitchIcon name="arrow_forward" size={15}/></button>}
      </div>
     </li>;
    })}
   </ul>:<Empty title="ยังไม่มีประวัติในหน้านี้"/>):null}
  <div className="button-row">
   {before&&<button className="secondary" onClick={()=>openPage(category)}>กลับไปกิจกรรมล่าสุด</button>}
   {entries.length===100&&<button className="secondary" onClick={()=>openPage(category,String(entries.at(-1)?.id))}>ประวัติก่อนหน้า</button>}
  </div>
 </div>;
}
export function Backups(){const {data,error,loading}=useResource('/backups'),[failure,setFailure]=useState(''),[busy,setBusy]=useState(false);async function create(){if(!data||loading||error||busy)return;setFailure('');setBusy(true);try{await api('/backups','POST',{idempotency_key:key()});refreshAll();}catch(e:any){setFailure(e.message);}finally{setBusy(false);}}return <div className="store-detail backup-settings"><PageHeader back="/store" title="สำรองข้อมูล" subtitle="สำเนาฐานข้อมูลและสลิปที่เข้ารหัส เก็บบนเซิร์ฟเวอร์"/><ReadNotice error={error} cached={!!data}/><ErrorBox message={failure}/><Panel><p className="muted">เจ้าของร้านสร้างสำเนาได้ การกู้คืนทำผ่านเครื่องมือเซิร์ฟเวอร์เพื่อป้องกันการเขียนทับข้อมูลที่กำลังใช้งาน</p><button className="primary" disabled={busy||loading||!!error||!data?.configured} onClick={create}>สร้างสำเนาสำรอง</button>{data&&!data.configured&&<div className="notice">ต้องตั้ง ADMIN_BACKUP_KEY บนเซิร์ฟเวอร์ก่อนสร้างสำเนา</div>}</Panel><Panel title="สำเนาล่าสุด">{loading&&!data?<Loading/>:data?data.data.length?data.data.map((b:Row)=><div className="history-line" key={b.id}><span><strong>{b.status==='completed'?'สำรองสำเร็จ':b.status==='failed'?'ไม่สำเร็จ':'กำลังสำรอง'}</strong><small>{dateTime(b.created_at)}</small></span><small>{b.manifest?.receipt_count??'—'} สลิป</small></div>):<Empty title="ยังไม่มีสำเนาสำรอง"/>:null}</Panel></div>;}
