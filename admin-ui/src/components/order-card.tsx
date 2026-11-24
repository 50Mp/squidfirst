import {useState} from 'react';
import {AlertCircle,Check,CheckCircle2,ChevronRight,CircleX,Clock3,Copy,FileText,LoaderCircle,MessageSquare,Pencil} from 'lucide-react';
import {dateTime,dollars,gameName,navigate,shortId,statuses,type Row} from '../api';
import {displayText} from '../components';
import {GameMark} from './game-art';
const statusIcons:Record<string,typeof Clock3>={processing:LoaderCircle,completed:CheckCircle2,issue:AlertCircle,cancelled:CircleX,refunded:CircleX};
const elapsed=new Intl.RelativeTimeFormat('th',{numeric:'auto'});
function orderTime(value:string){
 const minutes=Math.floor((Date.now()-Date.parse(value))/60000);
 return minutes>=0&&minutes<60?elapsed.format(-minutes,'minute'):dateTime(value);
}

interface OrderCardProps {
 readonly order:Row;
 readonly selected?:boolean;
 readonly checked:boolean;
 readonly busy:boolean;
 readonly onSelect:(id:string)=>void;
 readonly onAction:(order:Row,action:string)=>void;
}

export function OrderCard({order,selected=false,checked,busy,onSelect,onAction}:Readonly<OrderCardProps>){
 const d=order.details??order.public_snapshot??{};
 const [copyState,setCopyState]=useState('');
 const uid=d.player?.UID??d.player?.['Player ID'];
 const status=String(order.status);
 const StatusIcon=statusIcons[status]??Clock3;
 const allowed:string[]=order.allowed_actions??[];
 const detail='/orders/'+encodeURIComponent(order.id);
 const open=()=>navigate(detail);
 const closed=['completed','cancelled','refunded'].includes(status);
 async function copyUid(){
  try{await navigator.clipboard.writeText(String(uid));setCopyState('คัดลอก UID แล้ว');}
  catch{setCopyState('คัดลอกไม่สำเร็จ เลือก UID เพื่อคัดลอกเองได้');}
 }
 return <article className={'order-card stitch-order-card'+(selected?' selected':'')} data-order-id={order.id}>
  <div className="stitch-order-meta">
   <label className="stitch-order-check"><input type="checkbox" checked={checked} disabled={busy} onChange={()=>onSelect(order.id)} aria-label={'เลือกออเดอร์ #'+shortId(order.id)}/></label>
   <button className="stitch-order-reference" onClick={open}><strong>#{shortId(order.id)}</strong><time dateTime={order.created_at} title={dateTime(order.created_at)}>• {orderTime(order.created_at)}</time></button>
   <span className={'status '+status}><StatusIcon size={13}/>{status==='refunded'?'คืนเงินแล้ว':statuses[status]??status}</span>
  </div>
  <button className="order-card-summary" aria-current={selected?'true':undefined} onClick={open}>
   <span className="stitch-order-product">
    <GameMark gameId={d.game_id} large/>
    <span className="stitch-order-product-copy">
     <span className="product-tags"><b>{gameName(d.game_id)}</b><span>โซน: {d.zone?.toUpperCase()??'—'}</span>{d.mock&&<b className="mock-tag">ทดสอบ</b>}</span>
     <strong>{displayText(d.name)}</strong>
     {order.supplier_name&&<span className="stitch-product-caption">ซัพพลายเออร์: <b>{order.supplier_name}</b></span>}
     {order.username&&<span className="stitch-product-caption">ลูกค้า: <b>{order.username}</b></span>}
     {d.player?.['Zone ID']&&<span className="stitch-product-caption">เซิร์ฟเวอร์: {d.player['Zone ID']}</span>}
    </span>
   </span>
  </button>
  {status==='refunded'&&<div className="stitch-order-notice"><CircleX size={16}/><strong>บันทึกคืนเงินแล้ว</strong></div>}
  {status==='issue'&&<div className="stitch-order-notice"><AlertCircle size={16}/><strong>พบปัญหาในการเติมเกม</strong></div>}
  <div className="uid-strip"><span>{status==='issue'?'UID เดิม:':'UID:'} <strong className="selectable">{uid??'—'}</strong></span>{uid&&<button className="quiet" aria-label="คัดลอก UID" onClick={copyUid}>{copyState==='คัดลอก UID แล้ว'?<Check size={14}/>:<Copy size={14}/>}<span>คัดลอก UID</span></button>}</div>
  {copyState&&<p className="copy-feedback" role="status">{copyState}</p>}
  <div className="order-card-footer">
   <strong>{dollars(d.price_usd)} <small>USD</small></strong>
   <div className="stitch-row-actions">
    {status==='processing'&&allowed.includes('complete')?<>
     {allowed.includes('issue')&&<button className="stitch-issue-button" disabled={busy} onClick={()=>onAction(order,'issue')}>แจ้งปัญหา</button>}
     <button className="stitch-complete-button" disabled={busy} onClick={()=>onAction(order,'complete')}><Check size={15}/>ยืนยันเติมสำเร็จ</button>
    </>:closed?<>
     <button className="secondary" onClick={()=>navigate(detail+'?section=history')}><Clock3 size={15}/>{status==='refunded'?'ประวัติคำสั่ง':'ดูประวัติ'}</button>
     {status==='refunded'&&<button className="secondary" disabled title="รายการนี้ไม่มีใบสำคัญคืนเงินในระบบ"><FileText size={15}/>ดูใบสำคัญคืนเงิน</button>}
    </>:status==='issue'?<>
     <button className="secondary" disabled={!order.customer_id} onClick={()=>navigate('/chats/'+order.customer_id)}><MessageSquare size={15}/>ติดต่อลูกค้า</button>
     <button className="stitch-edit-uid" disabled title="ระบบยังไม่รองรับการแก้ UID บนออเดอร์ที่สร้างแล้ว"><Pencil size={14}/>แก้ไข UID</button>
    </>:<>
     <button className="secondary" onClick={open}>{status==='payment_review'?'ตรวจสลิป':'ดูรายละเอียด'}<ChevronRight size={15}/></button>
    </>}
   </div>
  </div>
 </article>;
}
