import {useState} from 'react';
import {ArrowUpRight,Clock3,AlertTriangle,Activity,Coins,MessagesSquare,Package,Globe2,ReceiptText} from 'lucide-react';
import {useResource,navigate,dollars,type Row} from '../api';
import {PageHeader,Panel,Loading,Empty,OrderRow,Toggle} from '../components';
import {ReadNotice} from '../components/read-notice';

const shortcuts=[
 {path:'/chats',Icon:MessagesSquare,title:'แชทลูกค้า',description:'ตอบกลับและดูทุกออเดอร์'},
 {path:'/store/products',Icon:Package,title:'เกมและแพ็กเกจ',description:'ตรวจแพ็กเกจที่เปิดขาย'},
 {path:'/store/sources',Icon:Globe2,title:'ร้านต้นทาง',description:'เปิด–ปิดร้านที่ใช้เทียบราคา'},
 {path:'/store/fx',Icon:Coins,title:'อัตราแลกเปลี่ยน',description:'LFX หรือเรทที่กำหนดเอง'},
] as const;
interface OverviewProps {}
export function Overview(_:Readonly<OverviewProps>){
 const [mock,setMock]=useState(false);
 const summary=useResource('/overview?include_mock='+mock),orders=useResource('/orders?active_only=true&include_mock='+mock),customers=useResource('/customers');
 const urgentOrders=useResource('/orders?status=payment_review&limit=1&include_mock='+mock);
 const s=summary.data;
 const count=(status:string)=>s?(s.outstanding??[]).find((r:Row)=>r.status===status)?.count??0:'—';
 const rows:Row[]=(orders.data?.data??[]).filter((o:Row)=>!['completed','cancelled','refunded'].includes(o.status)&&(mock||!o.details?.mock));
 const urgent=urgentOrders.data?.data?.[0],unread:Row[]=(customers.data?.data??[]).filter((c:Row)=>c.unread>0);
 const queues=[
  {status:'payment_review',Icon:ReceiptText,title:'รอตรวจสลิป',aria:'เปิดคิวตรวจสลิป'},
  {status:'paid',Icon:Clock3,title:'รอรับงาน',aria:'เปิดคิวรอรับงาน'},
  {status:'processing',Icon:Activity,title:'กำลังเติม',aria:'เปิดคิวกำลังเติม'},
  {status:'issue',Icon:AlertTriangle,title:'พบปัญหา',aria:'เปิดคิวพบปัญหา'},
 ] as const;
 return <><PageHeader title="วันนี้ร้านเป็นอย่างไร" subtitle={new Date().toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',weekday:'long',day:'numeric',month:'long'})}/>
  <div className="overview-toolbar"><span className="eyebrow">ภาพรวมการทำงาน · USD</span><Toggle label="รวมรายการทดสอบ" checked={mock} onChange={setMock}/></div>
  <ReadNotice error={summary.error} cached={!!s}/>
  <ReadNotice error={urgentOrders.error} cached={!!urgentOrders.data}/>
  {urgent&&<section className="urgent-panel"><div className="section-title"><h2><ReceiptText size={22}/>คิวด่วน · รอตรวจชำระเงิน</h2><span className="urgent-badge">ตรวจด้วยมือ</span></div><OrderRow order={urgent}/><button className="primary wide" onClick={()=>navigate('/orders/'+urgent.id)}>เปิดออเดอร์และดูสลิป<ArrowUpRight size={18}/></button></section>}
  <div className="metric-grid"><section className="metric-card"><span>ยอดขายที่เติมสำเร็จ <Coins size={19}/></span><strong>{dollars(s?.revenue_usd)}</strong><small>ยอดวันนี้ · ไม่รวมรายการคืนเงิน</small></section><section className="metric-card"><span>กำไรขั้นต้น <Activity size={19}/></span><strong>{dollars(s?.estimated_gross_profit_usd)}</strong><small>{s?.missing_cost_count?'ข้อมูลต้นทุนไม่ครบ ยังสรุปไม่ได้':'ราคาขายหักต้นทุน ก่อนค่าใช้จ่ายอื่น'}</small></section></div>
  <Panel title="คิวออเดอร์ที่ต้องดูแล" aside={<span className="muted small">{s?s.total_orders+' ออเดอร์วันนี้':'กำลังโหลด'}</span>}><div className="queue-grid">{queues.map(({status,Icon,title,aria})=><button key={status} className={'queue-card '+status} aria-label={aria} onClick={()=>navigate('/orders?status='+status+'&include_mock='+mock)}><Icon size={21}/><strong>{count(status)}</strong><span>{title}</span><ArrowUpRight size={15}/></button>)}</div><p className="small muted queue-note">คิวค้างรวมทุกวัน · รับงานแล้ว {count('accepted')} · รอชำระเงิน {count('awaiting_payment')}</p></Panel>
  <div className="overview-columns"><section><div className="section-title"><h2>งานที่ต้องทำ</h2><button className="text-link" onClick={()=>navigate('/orders')}>ดูออเดอร์ทั้งหมด<ArrowUpRight size={16}/></button></div><ReadNotice error={orders.error} cached={!!orders.data}/><Panel>{orders.loading&&!orders.data?<Loading/>:orders.data?rows.length?rows.slice(0,6).map(o=><OrderRow key={o.id} order={o}/>):<Empty title="ไม่มีงานค้างในรายการนี้" text={mock?'ออเดอร์ใหม่จะแสดงเมื่อมีลูกค้าสั่งซื้อ':'เปิดตัวกรองรายการทดสอบเพื่อดูข้อมูลสำหรับทดสอบ'}/>:null}</Panel></section>
  <section><div className="section-title"><h2>แชทที่ยังไม่อ่าน</h2><button className="text-link" onClick={()=>navigate('/chats')}>เปิดหน้าแชท<ArrowUpRight size={16}/></button></div><ReadNotice error={customers.error} cached={!!customers.data}/><Panel>{customers.loading&&!customers.data?<Loading/>:customers.data?unread.length?<div className="live-chat-list">{unread.slice(0,3).map(c=><button key={c.id} onClick={()=>navigate('/chats/'+c.id)}><span className="avatar">{c.username.slice(0,2).toUpperCase()}</span><span><strong>{c.username}</strong><small>{c.last_message??'เปิดห้องลูกค้า'}</small></span><b className="unread">{c.unread}</b></button>)}</div>:<Empty title="อ่านข้อความครบแล้ว" text="ห้องที่มีข้อความใหม่จะแสดงที่นี่"/>:null}</Panel></section></div>
  <section><div className="section-title"><h2>ทางลัดการจัดการ</h2></div><div className="shortcut-grid">{shortcuts.map(({path,Icon,title,description})=><button key={path} onClick={()=>navigate(path)}><span className="tile-icon"><Icon size={25}/></span><strong>{title}</strong><small>{description}</small></button>)}</div></section>
  <p className="footnote">ยอดตามวันที่สร้างออเดอร์ UTC+7 · แสดงงานล่าสุดในคิว · กำไรขั้นต้นไม่ใช่กำไรสุทธิ · {mock?'รวม':'ไม่รวม'}รายการทดสอบในยอดสรุป</p>
 </>;
}
