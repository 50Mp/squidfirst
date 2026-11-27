import {StitchIcon} from '../components/stitch-icon';
import {useState,useDeferredValue,useEffect} from 'react';
import {MessagesSquare,MailOpen} from 'lucide-react';
import {useResource,type Row} from '../api';
import {PageHeader,Loading,Empty} from '../components';
import {ChatCard} from '../components/chat-card';
import {ReadNotice} from '../components/read-notice';

interface ChatsProps {readonly embedded?:boolean;readonly activeCustomerId?:string}
interface ChatResults {data:Row[];counts:{total:number;unread:number;read:number}}
export function Chats({embedded=false,activeCustomerId}:Readonly<ChatsProps>){
 const [search,setSearch]=useState(()=>sessionStorage.getItem('squid-chat-search')??''),[unreadOnly,setUnreadOnly]=useState(()=>sessionStorage.getItem('squid-chat-unread')==='true');
 const term=search.trim(),query=useDeferredValue(term),switchingQuery=term!==query;
 useEffect(()=>{sessionStorage.setItem('squid-chat-search',search);sessionStorage.setItem('squid-chat-unread',String(unreadOnly));},[search,unreadOnly]);
 const result=useResource<ChatResults>('/customers?search='+encodeURIComponent(query)+(unreadOnly?'&unread_only=true':''),{resetOnPathChange:true});
 const data=switchingQuery?null:result.data,error=switchingQuery?'':result.error,loading=switchingQuery||result.loading;
 const customers=data?.data??[],counts=data?.counts;
 const searching=Boolean(term);
 const hiddenMatches=unreadOnly&&Boolean(counts?.total)&&customers.length===0;
 const emptyTitle=hiddenMatches
  ?searching?'ผลค้นหานี้ไม่มีแชทที่ยังไม่อ่าน':'อ่านข้อความครบแล้ว'
  :searching?'ไม่พบลูกค้า':'ยังไม่มีลูกค้าในรายการ';
 const emptyText=hiddenMatches
  ?'ดูแชททั้งหมดเพื่อเปิดห้องที่อ่านแล้ว'
  :searching?'ตรวจชื่อลูกค้า, UID หรือเลขออเดอร์แล้วลองอีกครั้ง':undefined;
 return <div className={'stitch-chat-list'+(embedded?' support-queue':'')}>
  {!embedded&&<><PageHeader title="ห้องสนทนาล่าสุด" subtitle="จัดการบทสนทนา บริการช่วยเหลือ และแจ้งปัญหาออเดอร์ลูกค้า"/>
  <div className="chat-stats"><div><MessagesSquare size={18}/><span>ยังไม่อ่าน</span><strong>{counts?.unread??'—'} <small>ห้อง</small></strong></div><div><StitchIcon name="done_all" size={18}/><span>อ่านแล้ว</span><strong>{counts?.read??'—'} <small>ห้อง</small></strong></div><div><MailOpen size={18}/><span>ห้องในรายการ</span><strong>{counts?.total??'—'} <small>ห้อง</small></strong></div></div></>}
  <div className="search-bar"><StitchIcon name="search" size={20}/><input type="search" aria-label="ค้นหาลูกค้า" placeholder="ค้นหาชื่อลูกค้า, UID หรือเลขออเดอร์…" maxLength={100} value={search} onChange={e=>setSearch(e.target.value)}/></div>
  <div className="filter-chips" aria-label="ตัวกรองห้องแชท"><button aria-pressed={!unreadOnly} onClick={()=>setUnreadOnly(false)}>ทั้งหมด {counts&&<span>{counts.total}</span>}</button><button aria-pressed={unreadOnly} onClick={()=>setUnreadOnly(true)}>ยังไม่อ่าน {counts&&<span>{counts.unread}</span>}</button></div>
  <ReadNotice error={error} cached={!!data}/>
  {loading&&!data?<Loading/>:data?<div className="chat-card-list">{customers.length?customers.map(c=><ChatCard key={c.id} customer={c} active={c.id===activeCustomerId} compact={embedded}/>):
   <Empty title={emptyTitle} text={emptyText}>
    {hiddenMatches&&<button className="secondary" onClick={()=>setUnreadOnly(false)}>{searching?'ดูผลค้นหาทั้งหมด':'ดูแชททั้งหมด'}</button>}
   </Empty>}</div>:null}
  {counts&&(unreadOnly?counts.unread:counts.total)>customers.length&&<p className="footnote">แสดงสูงสุด 100 ห้อง ใช้การค้นหาเพื่อดูห้องอื่น</p>}
 </div>;
}
