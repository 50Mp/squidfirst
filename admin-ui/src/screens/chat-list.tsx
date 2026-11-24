import {useState,useDeferredValue,useEffect} from 'react';
import {Search,MessagesSquare,MailOpen} from 'lucide-react';
import {useResource,type Row} from '../api';
import {PageHeader,Loading,Empty} from '../components';
import {ChatCard} from '../components/chat-card';
import {ReadNotice} from '../components/read-notice';

interface ChatsProps {}
export function Chats(_:Readonly<ChatsProps>){
 const [search,setSearch]=useState(()=>sessionStorage.getItem('squid-chat-search')??''),[unreadOnly,setUnreadOnly]=useState(()=>sessionStorage.getItem('squid-chat-unread')==='true'),query=useDeferredValue(search);
 useEffect(()=>{sessionStorage.setItem('squid-chat-search',search);sessionStorage.setItem('squid-chat-unread',String(unreadOnly));},[search,unreadOnly]);
 const {data,error,loading}=useResource('/customers?search='+encodeURIComponent(query));
 const customers:Row[]=data?.data??[],unread=customers.filter(c=>c.unread>0),visible=unreadOnly?unread:customers;
 return <div className="stitch-chat-list"><PageHeader title="ห้องสนทนาล่าสุด" subtitle="จัดการบทสนทนา บริการช่วยเหลือ และแจ้งปัญหาออเดอร์ลูกค้า"/>
  <div className="chat-stats"><div><MessagesSquare size={20}/><span>ยังไม่อ่าน</span><strong>{data?unread.length:'—'} <small>ห้อง</small></strong></div><div><MailOpen size={20}/><span>ห้องในรายการ</span><strong>{data?customers.length:'—'} <small>ห้อง</small></strong></div></div>
  <div className="search-bar"><Search size={20}/><input aria-label="ค้นหาลูกค้า" placeholder="ค้นหาชื่อลูกค้า…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
  <div className="filter-chips" aria-label="ตัวกรองห้องแชท"><button aria-pressed={!unreadOnly} onClick={()=>setUnreadOnly(false)}>ทั้งหมด {data&&<span>{customers.length}</span>}</button><button aria-pressed={unreadOnly} onClick={()=>setUnreadOnly(true)}>ยังไม่อ่าน {data&&<span>{unread.length}</span>}</button></div>
  <ReadNotice error={error} cached={!!data}/>
  {loading&&!data?<Loading/>:data?<div className="chat-card-list">{visible.length?visible.map(c=><ChatCard key={c.id} customer={c}/>):<Empty title={search?'ไม่พบลูกค้า':unreadOnly?'อ่านข้อความครบแล้ว':'ยังไม่มีลูกค้าในรายการ'} text={search?'ลองค้นหาด้วยชื่อลูกค้าอื่น':'ข้อความและออเดอร์ของลูกค้าคนเดิมอยู่ในห้องเดียวกัน'}/>}</div>:null}
  <p className="footnote">จำนวนห้องตามผลค้นหา สูงสุด 100 ห้อง · ยังไม่อ่านหมายถึงข้อความลูกค้าที่แอดมินยังไม่ได้เปิดอ่าน</p>
 </div>;
}
