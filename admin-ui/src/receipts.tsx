import {StitchIcon} from './components/stitch-icon';
import {useRef,useState} from 'react';import {Download} from 'lucide-react';import {dateTime,type Row} from './api';import {ErrorBox} from './components';
export function Receipt({receipt:r,preview}:{receipt:Row;preview?:Readonly<{caption:string;amount:string;status:string}>}){
 const dialog=useRef<HTMLDialogElement>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [opened,setOpened]=useState(false);
 const [imageFailed,setImageFailed]=useState(false);
 const [imageAttempt,setImageAttempt]=useState(0);
 function openImage(){
  setImageFailed(false);
  setOpened(true);
  dialog.current?.showModal();
 }
 function retryImage(){
  setImageFailed(false);
  setImageAttempt(attempt=>attempt+1);
 }
 const imageUrl=imageAttempt?r.url+(r.url.includes('?')?'&':'?')+'image_retry='+imageAttempt:r.url;
 async function download(){setBusy(true);setError('');try{const response=await fetch(r.url,{credentials:'same-origin'});if(!response.ok)throw Error('เปิดสลิปไม่ได้ กรุณาตรวจเซสชันและลองใหม่');const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download='payment-receipt.pdf';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 return <>
  <ErrorBox message={error}/>
  {r.mime==='application/pdf'
   ?<button className="secondary wide" disabled={busy} onClick={download}><Download size={17} aria-hidden="true"/>ดาวน์โหลดสลิป PDF{preview?' · '+preview.caption:''}</button>
   :<>
    <button className="receipt" onClick={openImage}>
     <img src={r.url} alt="สลิปชำระเงินของออเดอร์"/>
     {preview?<><span className="receipt-caption"><strong>{preview.caption}</strong><span>{preview.amount}</span></span>
      <small><span><StitchIcon name="receipt_long" size={16}/> {preview.status}</span><span>ขยาย <StitchIcon name="fullscreen" size={14}/></span></small>
     </>:<><span className="receipt-caption"><strong>สลิปชำระเงิน</strong><time dateTime={r.created_at}>{dateTime(r.created_at)}</time></span>
      <small><StitchIcon name="fullscreen" size={16}/> เปิดดูหลักฐานแบบเต็ม</small>
     </>}
    </button>
    <dialog ref={dialog} aria-label="สลิปชำระเงินขนาดเต็ม" className="receipt-dialog" onClose={()=>setOpened(false)} onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close();}}>
     <div className="receipt-viewer">
      <header className="receipt-viewer-header">
       <h2>รูปสลิปต้นฉบับ</h2>
       <button className="quiet icon-button" aria-label="ปิดสลิป" onClick={()=>dialog.current?.close()}><StitchIcon name="close" size={18}/></button>
      </header>
      <div className="receipt-viewer-image" role="region" aria-label="เลื่อนดูรูปสลิปต้นฉบับ" tabIndex={0}>
       {opened&&(imageFailed?<div className="receipt-viewer-error">
        <p role="alert">โหลดรูปสลิปไม่สำเร็จ</p>
        <button className="secondary" onClick={retryImage}>ลองใหม่</button>
       </div>:<img src={imageUrl} alt="สลิปชำระเงินขนาดเต็ม" onError={()=>setImageFailed(true)}/>)}
      </div>
      <footer className="receipt-viewer-footer"><span>วันที่ส่งสลิป</span><time dateTime={r.created_at}>{dateTime(r.created_at)}</time></footer>
     </div>
    </dialog>
   </>}
 </>;
}
