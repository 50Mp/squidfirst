import {MessagesSquare,UserRound} from 'lucide-react';
import {navigate,type Row} from '../api';

interface ChatCardProps {readonly customer:Row}
export function ChatCard({customer:c}:Readonly<ChatCardProps>){
 return <article className={'chat-card'+(c.unread>0?' has-unread':'')}>
  <button className="chat-card-heading" onClick={()=>navigate('/chats/'+c.id)}><span className="avatar">{c.username.slice(0,2).toUpperCase()}</span><span className="chat-card-identity"><strong>{c.username}</strong><small>{c.order_count} ออเดอร์ · {c.disabled?'บัญชีถูกระงับ':'บัญชีลูกค้า'}</small></span>{c.unread>0?<span className="chat-unread-label">ยังไม่อ่าน <b>{c.unread}</b></span>:<span className="read-label">อ่านแล้ว</span>}</button>
  <p className="chat-preview">{c.last_message??'ยังไม่มีข้อความ'}</p>
  <div className="chat-card-actions"><button className="primary" onClick={()=>navigate('/chats/'+c.id)}><MessagesSquare size={19}/>เปิดแชทตอบกลับ</button><button className="secondary icon-button" aria-label="รายละเอียดลูกค้า" onClick={()=>navigate('/customers/'+c.id)}><UserRound size={19}/></button></div>
 </article>;
}
