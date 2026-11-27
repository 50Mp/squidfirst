import {StitchIcon} from './stitch-icon';

import {dateTime,gameName,navigate,shortId,type Row} from '../api';
import {Status,displayText} from '../components';

interface ChatCardProps {readonly customer:Row;readonly active?:boolean;readonly compact?:boolean}
export function ChatCard({customer:c,active=false,compact=false}:Readonly<ChatCardProps>){
 const id=encodeURIComponent(c.id);
 const order=c.matched_order??c.latest_order;
 if(compact)return <article className="chat-card support-queue-row" data-active={active}>
  <button aria-label="เปิดแชทตอบกลับ" aria-current={active?'page':undefined} onClick={()=>navigate('/chats/'+id)}>
   <span className="avatar" aria-hidden="true">{c.username.slice(0,2).toUpperCase()}</span>
   <span className="support-queue-copy">
    <span className="support-queue-identity"><strong>{c.username}</strong>{c.last_message_at&&<time dateTime={c.last_message_at}>{dateTime(c.last_message_at)}</time>}</span>
    <span className="support-queue-preview">{c.last_message??'ยังไม่มีข้อความ'}</span>
    <span className="support-queue-meta"><small>{order?'#'+shortId(order.id):c.order_count+' ออเดอร์'}</small>{c.unread>0&&<b aria-label={c.unread+' ข้อความที่ยังไม่อ่าน'}>{c.unread}</b>}</span>
   </span>
  </button>
 </article>;
 return <article className={'chat-card'+(c.unread>0?' has-unread':'')} data-active={active}>
  <div className="chat-card-heading">
   <a className="chat-card-customer" href={'#/customers/'+id} aria-label={'รายละเอียดลูกค้า '+c.username}>
    <span className="avatar" aria-hidden="true">{c.username.slice(0,2).toUpperCase()}</span>
    <span className="chat-card-identity"><strong>{c.username}</strong><small>{c.order_count} ออเดอร์ · {c.disabled?'บัญชีถูกระงับ':'บัญชีลูกค้า'}</small></span>
   </a>
   <span className="stitch-chat-card-meta">{c.unread>0?<span className="chat-unread-label">ยังไม่อ่าน <b>{c.unread}</b></span>:<span className="read-label">อ่านแล้ว</span>}{c.last_message_at&&<time dateTime={c.last_message_at}>{dateTime(c.last_message_at)}</time>}</span>
  </div>
  {order&&<a className="chat-card-order" href={'#/orders/'+encodeURIComponent(order.id)} onClick={event=>{
   if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   event.preventDefault();navigate('/orders/'+encodeURIComponent(order.id));
  }}><StitchIcon name="sports_esports" size={16}/><strong>#{shortId(order.id)}</strong><span>{gameName(order.game_id)} · {displayText(order.name)}</span><Status value={order.status}/></a>}
  <p className="chat-preview">{c.last_message??'ยังไม่มีข้อความ'}</p>
  <div className="chat-card-actions"><button className="primary chat-reply" aria-current={active?'page':undefined} onClick={()=>navigate('/chats/'+id)}><StitchIcon name="chat" size={17}/>เปิดแชทตอบกลับ</button></div>
 </article>;
}
