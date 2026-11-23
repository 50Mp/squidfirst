import {AlertTriangle,ChevronRight} from 'lucide-react';
import {useResource,navigate,shortId,gameName,type Row} from '../api';
import {ReadNotice} from './read-notice';

interface ChatIssueContextProps {readonly customerId:string}
export function ChatIssueContext({customerId}:Readonly<ChatIssueContextProps>){
 const {data,error}=useResource('/orders?'+new URLSearchParams({customer_id:customerId,status:'issue',limit:'50'}));
 if(!error&&!data?.data.length)return null;
 return <section className="chat-issue-context" aria-label="ออเดอร์ที่มีปัญหาของลูกค้าคนนี้"><ReadNotice error={error} cached={!!data}/>{data?.data.length>0&&<><div className="chat-issue-caption"><span><AlertTriangle size={15}/>ออเดอร์ที่มีปัญหา · {data.next_cursor?'50+':data.data.length} รายการ</span><button className="quiet" onClick={()=>navigate('/customers/'+customerId)}>ดูทั้งหมด</button></div><div className="chat-issue-orders">{data.data.slice(0,3).map((o:Row)=><button key={o.id} onClick={()=>navigate('/orders/'+o.id)}><span><strong>#{shortId(o.id)}</strong><small>{gameName(o.details.game_id)} · {o.details.name} · {o.details.zone?.toUpperCase()}</small></span><ChevronRight size={17}/></button>)}</div></>}</section>;
}
