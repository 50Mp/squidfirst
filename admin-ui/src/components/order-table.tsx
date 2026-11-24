import {useState} from 'react';
import {Check,Copy,Eye} from 'lucide-react';
import {dateTime,dollars,gameName,navigate,shortId,type Row} from '../api';
import {displayText,Status} from '../components';

interface OrderTableProps {
 readonly rows:readonly Row[];
 readonly total?:number;
 readonly activeId?:string;
 readonly selection:readonly string[];
 readonly busy:boolean;
 readonly onToggle:(id:string)=>void;
 readonly onToggleAll:()=>void;
}

export function OrderTable({rows,total,activeId,selection,busy,onToggle,onToggleAll}:OrderTableProps){
 const [copy,setCopy]=useState({id:'',message:''});
 const allSelected=rows.length>0&&rows.every(row=>selection.includes(row.id));
 async function copyUid(id:string,uid:string){
  try{
   await navigator.clipboard.writeText(uid);
   setCopy({id,message:'คัดลอก UID แล้ว'});
  }catch{
   setCopy({id:'',message:'คัดลอกไม่สำเร็จ เลือก UID เพื่อคัดลอกเองได้'});
  }
 }
 return <div className="desktop-orders-panel">
  <div className="desktop-orders-caption"><span>แสดง <strong>{rows.length}</strong>{total!==undefined?' จาก '+total:''} รายการ</span><span>ล่าสุดก่อน ↓</span></div>
  <div className="desktop-orders-scroll" tabIndex={0} role="region" aria-label="เลื่อนตารางออเดอร์">
   <table aria-label="รายการออเดอร์ทั้งหมด">
    <thead><tr>
     <th scope="col"><input type="checkbox" aria-label="เลือกออเดอร์ทั้งหมดในหน้านี้" checked={allSelected} disabled={busy} onChange={onToggleAll}/></th>
     <th scope="col">ออเดอร์และเวลา</th><th scope="col">ลูกค้า</th><th scope="col">เกมและแพ็กเกจ</th>
     <th scope="col">UID</th><th scope="col">ราคาขาย (USD)</th><th scope="col">ซัพพลายเออร์</th><th scope="col">สถานะ</th><th scope="col">ดำเนินการ</th>
    </tr></thead>
    <tbody>{rows.map(row=>{
     const details=row.details??{},uid=details.player?.UID??details.player?.['Player ID'];
     const checked=selection.includes(row.id),active=activeId===row.id;
     const open=()=>navigate('/orders/'+encodeURIComponent(row.id));
     return <tr key={row.id} data-order-id={row.id} data-checked={checked} data-active={active}>
      <td><input type="checkbox" aria-label={'เลือกออเดอร์ #'+shortId(row.id)} checked={checked} disabled={busy} onChange={()=>onToggle(row.id)}/></td>
      <th scope="row"><button className="order-card-summary desktop-order-link" aria-current={active?'true':undefined} onClick={open}>#{shortId(row.id)}<time dateTime={row.created_at}>{dateTime(row.created_at)}</time></button></th>
      <td>{row.username??'—'}</td>
      <td><strong>{gameName(details.game_id)}</strong><small>{displayText(details.name)}{details.zone?' · '+details.zone.toUpperCase():''}</small></td>
      <td><div className="desktop-order-uid"><span className="selectable">{uid??'—'}</span>{uid&&<button className="quiet" aria-label={'คัดลอก UID ออเดอร์ #'+shortId(row.id)} onClick={()=>void copyUid(row.id,String(uid))}>{copy.id===row.id?<Check size={15}/>:<Copy size={15}/>}</button>}</div></td>
      <td className="desktop-order-amount">{dollars(details.price_usd)}</td>
      <td>{row.supplier_name??'—'}</td>
      <td><Status value={row.status}/></td>
      <td><button className="secondary desktop-order-view" aria-label={'ดูออเดอร์ #'+shortId(row.id)} onClick={open}><Eye size={17}/></button></td>
     </tr>;
    })}</tbody>
   </table>
  </div>
  <p className="sr-only" role="status">{copy.message}</p>
 </div>;
}
