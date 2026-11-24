import {AlertTriangle,ChevronRight,ShoppingBag} from 'lucide-react';
import {useResource,navigate,shortId,gameName,dollars,type Row} from '../api';
import {Status} from '../components';
import {ReadNotice} from './read-notice';

interface ChatIssueContextProps {readonly customerId:string}
export function ChatIssueContext({customerId}:Readonly<ChatIssueContextProps>){
 const {data,error}=useResource('/orders?'+new URLSearchParams({customer_id:customerId,status:'issue',limit:'50'}));
 const recent=useResource(data&&!data.data.length?'/orders?'+new URLSearchParams({customer_id:customerId,limit:'2'}):null);
 if(!error&&!data?.data.length){
  const orders:Row[]=recent.data?.data??[];
  if(!orders.length&&!recent.error)return null;
  return <details className="stitch-chat-orders">
   <summary><ShoppingBag size={16}/> ออเดอร์ล่าสุดของลูกค้า</summary>
   <ReadNotice error={recent.error} cached={!!recent.data}/>
   {orders.map(o=><button key={o.id} className="stitch-chat-order" onClick={()=>navigate('/orders/'+o.id)}>
    <span><strong>#{shortId(o.id)}</strong> · {gameName(o.details.game_id)}<small>{o.details.name}</small></span>
    <span><strong>{dollars(o.details.price_usd)}</strong><Status value={o.status}/></span>
   </button>)}
   <button className="text-link" onClick={()=>navigate('/customers/'+customerId)}>ดูทุกออเดอร์ <ChevronRight size={16}/></button>
  </details>;
 }
 return <section className="chat-issue-context" aria-label="ออเดอร์ที่มีปัญหาของลูกค้าคนนี้"><ReadNotice error={error} cached={!!data}/>{data?.data.length>0&&<><div className="chat-issue-caption"><span><AlertTriangle size={15}/>ออเดอร์ที่มีปัญหา · {data.next_cursor?'50+':data.data.length} รายการ</span><button className="quiet" onClick={()=>navigate('/customers/'+customerId)}>ดูทั้งหมด</button></div><div className="chat-issue-orders">{data.data.slice(0,3).map((o:Row)=><button key={o.id} onClick={()=>navigate('/orders/'+o.id)}><span><strong>#{shortId(o.id)}</strong><small>{gameName(o.details.game_id)} · {o.details.name} · {o.details.zone?.toUpperCase()}</small></span><ChevronRight size={17}/></button>)}</div></>}</section>;
}
