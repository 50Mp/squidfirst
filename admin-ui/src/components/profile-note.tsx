import {useEffect,useId,useRef,useState} from 'react';
import {api,key,refreshAll} from '../api';
import {ErrorBox} from '../components';

interface ProfileNoteProps {
 readonly customerId:string;
 readonly latest:string|null;
}

const drafts=new Map<string,{text:string;requestKey:string}>();

export function ProfileNote({customerId,latest}:ProfileNoteProps){
 const inputId=useId();
 const visibilityId=useId();
 const [draft,setDraft]=useState(()=>drafts.get(customerId));
 const [acknowledged,setAcknowledged]=useState<{previous:string|null;text:string}>();
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [saved,setSaved]=useState(false);
 const saving=useRef(false);
 const current=acknowledged?.previous===latest?acknowledged.text:latest??'';
 useEffect(()=>{
  if(acknowledged&&latest!==acknowledged.previous)setAcknowledged(undefined);
 },[acknowledged,latest]);

 async function save(){
  if(!draft?.text.trim()||saving.current)return;
  const text=draft.text.trim();
  saving.current=true;
  setBusy(true);
  setError('');
  try{
   await api('/customers/'+encodeURIComponent(customerId)+'/chat','POST',{
    text,visibility:'internal',idempotency_key:draft.requestKey,
   });
   if(drafts.get(customerId)===draft)drafts.delete(customerId);
   setAcknowledged({previous:latest,text});
   setDraft(undefined);
   setSaved(true);
   refreshAll();
  }catch(error){
   setError(error instanceof Error?error.message:'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง');
  }finally{
   saving.current=false;
   setBusy(false);
  }
 }

 return <form className="profile-note" onSubmit={event=>{event.preventDefault();void save();}}>
  <div className="profile-note-label">
   <label htmlFor={inputId}>บันทึกภายในร้าน (ข้อมูลเฉพาะลูกค้า)</label>
   <small id={visibilityId}>มองเห็นเฉพาะพนักงาน</small>
  </div>
  <textarea id={inputId} aria-describedby={visibilityId} rows={2} maxLength={2000} readOnly={busy}
   placeholder="เช่น ลูกค้าชอบให้ทักทางแชทก่อนส่งไอเทม, เติมประจำช่วงค่ำ…"
   value={draft?.text??current} onChange={event=>{
    const text=event.target.value;
    const next=text===current?undefined:{text,requestKey:key()};
    if(next)drafts.set(customerId,next);else drafts.delete(customerId);
    setDraft(next);
    setError('');
    setSaved(false);
   }}/>
  <ErrorBox message={error}/>
  {draft&&<button className="secondary" disabled={busy||!draft.text.trim()}>{busy?'กำลังบันทึก…':'บันทึกข้อความภายใน'}</button>}
  {saved&&<small role="status">บันทึกแล้ว</small>}
 </form>;
}
