import {useEffect,useState} from 'react';
import {ChevronDown,CheckCircle2} from 'lucide-react';
import {actions} from '../api';

interface OrderActionsProps {readonly status:string;readonly allowed:readonly string[];readonly busy:boolean;readonly onAction:(action:string)=>void}
const nextByStatus:Record<string,string>={payment_review:'approve',paid:'accept',accepted:'start',processing:'complete',issue:'resume'};
export function OrderActions({status,allowed,busy,onAction}:Readonly<OrderActionsProps>){
 const [more,setMore]=useState(false);
 useEffect(()=>setMore(false),[status]);
 const primary=allowed.includes(nextByStatus[status])?nextByStatus[status]:null;
 const destructive=allowed.filter(a=>a==='cancel'||a==='refund');
 const secondary=allowed.filter(a=>a!==primary&&a!=='cancel'&&a!=='refund');
 return <div className="action-dock" aria-label="ดำเนินการออเดอร์">
  {primary&&<button className="primary next-order-action" disabled={busy} onClick={()=>onAction(primary)}>{primary==='complete'&&<CheckCircle2 size={18}/>} {actions[primary]}</button>}
  {secondary.map(a=><button key={a} className={'secondary'+(a==='issue'?' danger':'')} disabled={busy} onClick={()=>onAction(a)}>{actions[a]}</button>)}
  {destructive.length>0&&<div className="order-more-actions"><button className="quiet" aria-expanded={more} disabled={busy} onClick={()=>setMore(!more)}>การดำเนินการอื่น<ChevronDown size={16}/></button>{more&&<div className="destructive-order-actions" role="group" aria-label="ยกเลิกหรือบันทึกคืนเงิน">{destructive.map(a=><button key={a} className="secondary danger" disabled={busy} onClick={()=>onAction(a)}>{actions[a]}</button>)}</div>}</div>}
  {!allowed.length&&<span className="muted">ออเดอร์นี้ไม่มีงานที่ต้องดำเนินการแล้ว</span>}
 </div>;
}
