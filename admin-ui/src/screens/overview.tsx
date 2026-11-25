import {useState} from 'react';
import {ArrowUpRight,Clock3,AlertTriangle,Activity,MessagesSquare,Package,Globe2,ReceiptText,Bell,CheckCircle2,Eye} from 'lucide-react';
import {useResource,navigate,dollars,api,key,refreshAndWait,confirmAction,gameName,dateTime,shortId,type Row} from '../api';
import {PageHeader,Panel,Loading,Empty,OrderRow,Toggle,displayText} from '../components';
import {ReadNotice} from '../components/read-notice';
import {useWideWorkspace} from '../hooks/use-wide-workspace';
import {OverviewDesktop} from './overview-desktop';

interface OverviewProps {}
export function Overview(_:Readonly<OverviewProps>){
 const [mock,setMock]=useState(false);
 const wide=useWideWorkspace();
 return wide?<OverviewDesktop mock={mock} setMock={setMock}/>:<OverviewMobile mock={mock} setMock={setMock}/>;
}
function OverviewMobile({mock,setMock}:Readonly<{mock:boolean;setMock:(value:boolean)=>void}>){
 const [busy,setBusy]=useState(false);
 const [actionError,setActionError]=useState('');
 const summary=useResource('/overview?include_mock='+mock),orders=useResource('/orders?include_mock='+mock),customers=useResource('/customers'),sources=useResource('/sources');
 const urgentOrders=useResource('/orders?status=payment_review&limit=1&include_mock='+mock);
 const s=summary.data;
 const count=(status:string)=>s?(s.outstanding??[]).find((r:Row)=>r.status===status)?.count??0:'—';
 const rows:Row[]=(orders.data?.data??[]).filter((o:Row)=>mock||!o.details?.mock);
 const urgent=urgentOrders.data?.data?.[0],unread:Row[]=(customers.data?.data??[]).filter((c:Row)=>c.unread>0);
 const urgentDetails=urgent?.details??urgent?.public_snapshot??{};

 async function approveUrgent(e:React.MouseEvent){
  e.stopPropagation();
  if(!urgent||busy)return;
  const ok=await confirmAction(`อนุมัติและยิงเครดิตสำหรับออเดอร์ #${shortId(urgent.id)} ใช่หรือไม่?`);
  if(!ok)return;
  setBusy(true);setActionError('');
  try{
   await api('/orders/'+encodeURIComponent(urgent.id)+'/actions','POST',{
    action:'approve',
    idempotency_key:key(),
    expected_revision:urgent.revision,
   });
   await refreshAndWait();
  }catch(err:any){
   setActionError(err.message);
  }finally{
   setBusy(false);
  }
 }

 const queues=[
  {status:'payment_review',Icon:ReceiptText,title:'รอตรวจสลิป',aria:'เปิดคิวตรวจสลิป'},
  {status:'paid',Icon:Clock3,title:'รอรับงาน',aria:'เปิดคิวรอรับงาน'},
  {status:'processing',Icon:Activity,title:'กำลังเติม',aria:'เปิดคิวกำลังเติม'},
  {status:'issue',Icon:AlertTriangle,title:'พบปัญหา',aria:'เปิดคิวพบปัญหา'},
 ] as const;
 return <div className="stitch-overview"><PageHeader title="ภาพรวม" subtitle={new Date().toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',weekday:'long',day:'numeric',month:'long'})}/>
  <ReadNotice error={summary.error} cached={!!s}/>
  <ReadNotice error={urgentOrders.error} cached={!!urgentOrders.data}/>
  {urgent&&(
   <div className="stitch-urgent-card" role="region" aria-label="คิวเร่งด่วน">
    <div className="stitch-urgent-header">
     <div className="stitch-urgent-title">
      <Bell size={18}/>
      <span>คิวเร่งด่วน: รอตรวจสลิป {count('payment_review')} รายการ</span>
     </div>
     <span className="stitch-urgent-badge">จำเป็นต้องตรวจ</span>
    </div>
    <button className="stitch-urgent-body" onClick={()=>navigate('/orders/'+urgent.id)} type="button">
     <div className="stitch-urgent-icon">
      <ReceiptText size={22}/>
     </div>
     <div className="stitch-urgent-info">
      <span className="stitch-urgent-name">คุณ{urgent.username??urgentDetails.player?.UID??'ลูกค้า'} • {gameName(urgentDetails.game_id)}</span>
      <span className="stitch-urgent-sub">{displayText(urgentDetails.name)} · โอนเข้า {dateTime(urgent.created_at)}</span>
     </div>
     <div className="stitch-urgent-amount">
      {dollars(urgentDetails.price_usd)}
     </div>
    </button>
    {actionError&&<p className="copy-feedback" role="alert" style={{color:'#b91c1c',margin:0}}>{actionError}</p>}
    <div className="stitch-urgent-actions">
     <button className="stitch-urgent-btn-primary" disabled={busy} onClick={approveUrgent} type="button">
      <CheckCircle2 size={16}/>
      <span>{busy?'กำลังดำเนินการ...':'อนุมัติและยิงเครดิต'}</span>
     </button>
     <button className="stitch-urgent-btn-secondary" onClick={()=>navigate('/orders/'+urgent.id)} type="button">
      <Eye size={16}/>
      <span>ดูสลิปต้นฉบับ</span>
     </button>
    </div>
   </div>
  )}
  <div className="metric-grid stitch-metrics">
   <section className="metric-card"><span>ยอดขายวันนี้</span><strong>{dollars(s?.revenue_usd)}</strong><small>จากออเดอร์ที่เติมสำเร็จ</small></section>
   <section className="metric-card"><span>กำไรขั้นต้น</span><strong>{dollars(s?.estimated_gross_profit_usd)}</strong><small>{s?.missing_cost_count?'ข้อมูลต้นทุนไม่ครบ':'ก่อนหักค่าใช้จ่ายอื่น'}</small></section>
   <section className="metric-card"><span>ออเดอร์สำเร็จ</span><strong>{s?s.counts?.completed??0:'—'}</strong></section>
   <section className="metric-card stitch-pending"><span>สลิปรอตรวจ</span><strong>{count('payment_review')}</strong></section>
  </div>
  <div className="shortcut-grid stitch-home-shortcuts">
   <button onClick={()=>navigate('/orders?status=payment_review&include_mock='+mock)}><span className="tile-icon"><ReceiptText size={20}/></span><strong>ตรวจสลิป</strong></button>
   <button onClick={()=>navigate('/store/products')}><span className="tile-icon"><Package size={20}/></span><strong>เกมและแพ็กเกจ</strong></button>
   <button onClick={()=>navigate('/store/sources')}><span className="tile-icon"><Globe2 size={20}/></span><strong>ร้านต้นทาง</strong></button>
   <button onClick={()=>navigate('/chats')}><span className="tile-icon"><MessagesSquare size={20}/></span><strong>แชทลูกค้า</strong></button>
  </div>
  <div className="overview-columns"><section><div className="section-title"><h2>ออเดอร์ล่าสุด</h2><button className="text-link" onClick={()=>navigate('/orders')}>ดูออเดอร์ทั้งหมด<ArrowUpRight size={16}/></button></div><ReadNotice error={orders.error} cached={!!orders.data}/><Panel>{orders.loading&&!orders.data?<Loading/>:orders.data?rows.length?rows.slice(0,6).map(o=><OrderRow key={o.id} order={o}/>):<Empty title="ยังไม่มีออเดอร์ในรายการนี้" text={mock?'ออเดอร์ใหม่จะแสดงเมื่อมีลูกค้าสั่งซื้อ':'เปิดตัวกรองรายการทดสอบเพื่อดูข้อมูลสำหรับทดสอบ'}/>:null}</Panel></section>
  <section><div className="section-title"><h2>แชทที่ยังไม่อ่าน</h2><button className="text-link" onClick={()=>navigate('/chats')}>เปิดหน้าแชท<ArrowUpRight size={16}/></button></div><ReadNotice error={customers.error} cached={!!customers.data}/><Panel>{customers.loading&&!customers.data?<Loading/>:customers.data?unread.length?<div className="live-chat-list">{unread.slice(0,3).map(c=><button key={c.id} onClick={()=>navigate('/chats/'+c.id)}><span className="avatar">{c.username.slice(0,2).toUpperCase()}</span><span><strong>{c.username}</strong><small>{c.last_message??'เปิดห้องลูกค้า'}</small></span><b className="unread">{c.unread}</b></button>)}</div>:<Empty title="อ่านข้อความครบแล้ว" text="ห้องที่มีข้อความใหม่จะแสดงที่นี่"/>:null}</Panel></section></div>
  <section className="stitch-source-status">
   <div className="section-title"><h2>สถานะซัพพลายเออร์</h2></div>
   <ReadNotice error={sources.error} cached={!!sources.data}/>
   <Panel>{sources.loading&&!sources.data?<Loading/>:sources.data?.data.length?sources.data.data.map((source:Row)=><button className="stitch-source-row" key={source.id??source.source_id} onClick={()=>navigate('/store/sources')}><strong>{source.name}</strong><span className={source.enabled?'dot-label online':'dot-label'}>{source.enabled?'เปิดใช้งาน':'ปิดใช้งาน'}</span></button>):sources.data?<Empty title="ยังไม่มีซัพพลายเออร์"/>:null}</Panel>
  </section>
  <Panel title="คิวออเดอร์ที่ต้องดูแล" aside={<span className="muted small">{s?s.total_orders+' ออเดอร์วันนี้':'กำลังโหลด'}</span>}><div className="queue-grid">{queues.map(({status,Icon,title,aria})=><button key={status} className={'queue-card '+status} aria-label={aria} onClick={()=>navigate('/orders?status='+status+'&include_mock='+mock)}><Icon size={21}/><strong>{count(status)}</strong><span>{title}</span><ArrowUpRight size={15}/></button>)}</div><p className="small muted queue-note">คิวค้างรวมทุกวัน · รับงานแล้ว {count('accepted')} · รอชำระเงิน {count('awaiting_payment')}</p></Panel>
  <div className="overview-toolbar"><span className="eyebrow">ภาพรวมการทำงาน · USD</span><Toggle label="รวมรายการทดสอบ" checked={mock} onChange={setMock}/></div>
  <p className="footnote">ยอดตามวันที่สร้างออเดอร์ UTC+7 · แสดงงานล่าสุดในคิว · กำไรขั้นต้นไม่ใช่กำไรสุทธิ · {mock?'รวม':'ไม่รวม'}รายการทดสอบในยอดสรุป</p>
 </div>;
}
