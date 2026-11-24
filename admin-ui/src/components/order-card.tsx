import {useState} from 'react';
import {Copy, Check, ChevronRight, UserRound} from 'lucide-react';
import {dateTime, dollars, gameName, navigate, shortId, type Row} from '../api';
import {displayText, GameMark, Status} from '../components';

interface OrderCardProps {readonly order:Row;readonly selected?:boolean}
export function OrderCard({order,selected=false}:Readonly<OrderCardProps>) {
 const d=order.details??order.public_snapshot??{};
 const [copyState,setCopyState]=useState('');
 const uid=d.player?.UID??d.player?.['Player ID'];
 async function copyUid(){
  try {await navigator.clipboard.writeText(String(uid));setCopyState('คัดลอก UID แล้ว');}
  catch {setCopyState('คัดลอกไม่สำเร็จ เลือก UID เพื่อคัดลอกเองได้');}
 }
 return <article className={'order-card'+(selected?' selected':'')} data-order-id={order.id}>
  <button className="order-card-summary" aria-current={selected?'true':undefined} onClick={()=>navigate('/orders/'+order.id)}>
   <span className="order-card-heading"><strong>#{shortId(order.id)}</strong><Status value={order.status}/></span>
   <small className="muted">{dateTime(order.created_at)}{d.mock&&<b className="mock-tag">ทดสอบ</b>}</small>
   <span className="order-card-product"><GameMark gameId={d.game_id}/><span><span className="product-tags"><b>{gameName(d.game_id)}</b><span>โซน: {d.zone?.toUpperCase()??'—'}</span></span><strong>{displayText(d.name)}</strong><span className="order-card-customer"><UserRound size={14}/>{order.username??'ลูกค้าทดสอบ'}</span></span><ChevronRight size={18}/></span>
  </button>
  <div className="uid-strip"><span>UID <strong className="selectable">{uid??'—'}</strong></span>{uid&&<button className="quiet" aria-label="คัดลอก UID" onClick={copyUid}>{copyState==='คัดลอก UID แล้ว'?<Check size={16}/>:<Copy size={16}/>}<span>คัดลอก UID</span></button>}</div>
  {copyState&&<p className="copy-feedback" role="status">{copyState}</p>}
  <div className="order-card-footer"><strong>{dollars(d.price_usd)} <small>USD</small></strong><button className="secondary" onClick={()=>navigate('/orders/'+order.id)}>ดูรายละเอียด / ตรวจสลิป<ChevronRight size={16}/></button></div>
 </article>;
}
