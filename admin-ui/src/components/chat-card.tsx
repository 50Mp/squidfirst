import {MessagesSquare} from 'lucide-react';
import {dateTime,navigate,type Row} from '../api';

interface ChatCardProps {readonly customer:Row}
export function ChatCard({customer:c}:Readonly<ChatCardProps>){
 const id=encodeURIComponent(c.id);
 return <article className={'chat-card'+(c.unread>0?' has-unread':'')}>
  <div className="chat-card-heading">
   <a className="chat-card-customer" href={'#/customers/'+id} aria-label={'รายละเอียดลูกค้า '+c.username}>
    <span className="avatar" aria-hidden="true">{c.username.slice(0,2).toUpperCase()}</span>
    <span className="chat-card-identity"><strong>{c.username}</strong><small>{c.order_count} ออเดอร์ · {c.disabled?'บัญชีถูกระงับ':'บัญชีลูกค้า'}</small></span>
   </a>
   <span className="stitch-chat-card-meta">{c.unread>0?<span className="chat-unread-label">ยังไม่อ่าน <b>{c.unread}</b></span>:<span className="read-label">อ่านแล้ว</span>}{c.last_message_at&&<time dateTime={c.last_message_at}>{dateTime(c.last_message_at)}</time>}</span>
  </div>
  <p className="chat-preview">{c.last_message??'ยังไม่มีข้อความ'}</p>
  <div className="chat-card-actions"><button className="secondary chat-reply" onClick={()=>navigate('/chats/'+id)}><MessagesSquare size={17} aria-hidden="true"/>เปิดแชทตอบกลับ</button></div>
 </article>;
}
