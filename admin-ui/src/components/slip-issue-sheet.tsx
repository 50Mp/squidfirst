import {useEffect,useRef,useState} from 'react';
import {ErrorBox} from '../components';
import {StitchIcon} from './stitch-icon';

const reasons=[
 {code:'amount_mismatch',label:'ยอดไม่ตรง',description:'ยอดโอนในสลิปไม่ตรงกับยอดที่สั่งซื้อ',message:'ยอดโอนไม่ตรงกับยอดคำสั่งซื้อ กรุณาส่งสลิปที่ถูกต้อง'},
 {code:'blurry_slip',label:'ภาพไม่ชัด',description:'สลิปเบลอ มืด หรือตัดมุม มองไม่เห็น QR Code และเวลา',message:'ภาพสลิปที่แนบมาไม่ชัดเจน กรุณาอัปโหลดสลิปใหม่อีกครั้ง'},
 {code:'duplicate_slip',label:'สลิปซ้ำ',description:'สลิปนี้ถูกใช้ยืนยันกับคำสั่งซื้ออื่นไปแล้ว',message:'สลิปการโอนนี้เคยถูกใช้งานไปแล้ว กรุณาแนบสลิปที่ถูกต้อง'},
 {code:'wrong_account',label:'บัญชีผู้รับไม่ตรง',description:'โอนเข้าผิดบัญชี หรือไม่ได้โอนเข้าบัญชีของร้าน',message:'กรุณาตรวจสอบบัญชีผู้รับและส่งหลักฐานการโอนใหม่'},
 {code:'other',label:'อื่น ๆ',description:'ระบุรายละเอียดเพิ่มเติมในข้อความแจ้งลูกค้า',message:''},
] as const;
type Reason=typeof reasons[number];

export interface SlipIssueDraft {reason:Reason['code'];customer_message:string;internal_note:string}
export function slipIssueLabel(code:string){return reasons.find(reason=>reason.code===code)?.label??'ปัญหาสลิป';}

interface SlipIssueSheetProps {
 readonly reference:string;
 readonly amount:string;
 readonly product:string;
 readonly customer?:string;
 readonly busy:boolean;
 readonly blocked:boolean;
 readonly error:string;
 readonly onSubmit:(issue:SlipIssueDraft)=>Promise<boolean>;
 readonly onClose:()=>void;
}
export function SlipIssueSheet({reference,amount,product,customer,busy,blocked,error,onSubmit,onClose}:SlipIssueSheetProps){
 const dialog=useRef<HTMLDialogElement>(null);
 const opener=useRef(document.activeElement instanceof HTMLElement?document.activeElement:null);
 const [reason,setReason]=useState<Reason>(reasons[0]);
 const [message,setMessage]=useState<string>(reasons[0].message);
 const [edited,setEdited]=useState(false);
 const [note,setNote]=useState('');
 useEffect(()=>{
  const modal=dialog.current;
  modal?.showModal();
  const target=opener.current;
  return ()=>{if(modal?.open)modal.close();if(target?.isConnected)target.focus({preventScroll:true});};
 },[]);

 return <dialog className="slip-issue-sheet" aria-labelledby="slip-issue-title" ref={dialog} onClose={onClose}
  onCancel={event=>{if(busy)event.preventDefault();}}>
  <form onSubmit={async event=>{
   event.preventDefault();
   if(!busy&&!blocked&&message.trim()&&await onSubmit({reason:reason.code,customer_message:message,internal_note:note}))dialog.current?.close();
  }}>
   <header className="slip-issue-header">
    <span className="slip-issue-handle" aria-hidden="true"/>
    <h2 id="slip-issue-title">แจ้งปัญหาสลิป</h2>
    <button type="button" className="quiet icon-button" aria-label="ปิด" disabled={busy} onClick={()=>dialog.current?.close()}><StitchIcon name="close" size={20}/></button>
   </header>
   <div className="slip-issue-body">
    <div className="slip-issue-order">
     <div><strong>#{reference}</strong><small>รอตรวจสอบสลิป</small><b>{amount}</b></div>
     <strong className="slip-issue-product" title={product}>{product}</strong>
     {customer&&<span>ลูกค้า: {customer}</span>}
    </div>
    <fieldset disabled={busy} className="slip-issue-reasons">
     <legend className="sr-only">สาเหตุที่พบปัญหา</legend>
     <div className="slip-issue-reason-heading" aria-hidden="true"><strong>สาเหตุที่พบปัญหา <span>*</span></strong><small>เลือก 1 ข้อ</small></div>
     {reasons.map((choice,index)=><label key={choice.code} className="slip-issue-option">
      <input type="radio" name="slip-issue-reason" value={choice.code} checked={reason.code===choice.code} onChange={()=>{
       setReason(choice);
       if(!edited)setMessage(choice.message);
      }}/>
      <span><strong>{index+1}. {choice.label}</strong><small>{choice.description}</small></span>
     </label>)}
    </fieldset>
    <label className="field"><span>ข้อความแจ้งเตือนลูกค้า</span><textarea rows={3} required maxLength={1000} value={message} readOnly={busy}
     onChange={event=>{setMessage(event.target.value);setEdited(true);}}/></label>
    <p className="footnote">{customer?'ลูกค้าจะเห็นข้อความนี้ในแชทและสามารถแนบสลิปใหม่ได้':'ลูกค้าจะเห็นข้อความนี้ในรายละเอียดออเดอร์และสามารถแนบสลิปใหม่ได้'}</p>
    <label className="field"><span>บันทึกภายใน <small>(ลูกค้าไม่เห็น)</small></span>
     <textarea rows={2} maxLength={1000} value={note} readOnly={busy} onChange={event=>setNote(event.target.value)}/>
    </label>
    <ErrorBox message={error}/>
   </div>
   <footer className="slip-issue-footer">
    <button type="submit" className="primary wide" disabled={busy||blocked||!message.trim()}><StitchIcon name="sync" size={18}/>{busy?'กำลังบันทึก…':'ขอส่งสลิปใหม่'}</button>
    <button type="button" className="secondary wide" disabled={busy} onClick={()=>dialog.current?.close()}>ยกเลิก</button>
   </footer>
  </form>
 </dialog>;
}
