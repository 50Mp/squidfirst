<<<<<<< HEAD
import {StitchIcon} from '../components/stitch-icon';

import {useResource,navigate,dollars,gameName,shortId,dateTime,type Row} from '../api';
import {PageHeader,Panel,Loading,Empty,Status,displayText} from '../components';
=======
import {useState} from 'react';
import {ArrowUpRight,Clock3,AlertTriangle,Activity,MessagesSquare,Package,Globe2,ReceiptText,Bell,CheckCircle2,Eye} from 'lucide-react';
import {useResource,navigate,dollars,api,key,refreshAndWait,confirmAction,gameName,dateTime,shortId,type Row} from '../api';
import {PageHeader,Panel,Loading,Empty,OrderRow,Toggle,displayText} from '../components';
>>>>>>> 6d236ea247287af2d4678031d3061f7c3b9fd22d
import {ReadNotice} from '../components/read-notice';
import {NavigationCount} from '../components/navigation-count';
import {useWideWorkspace} from '../hooks/use-wide-workspace';
import {OverviewDesktop} from './overview-desktop';

interface OverviewProps {readonly unreadChatRooms:number|null;readonly staleChatCount:boolean}
function RecentOrder({order}:Readonly<{order:Row}>){
 const details=order.details??order.public_snapshot??{};
 return <button className="stitch-recent-order" onClick={()=>navigate('/orders/'+order.id)}>
  <span className="stitch-recent-name">
   <span><strong>#{shortId(order.id)}</strong> <span>{gameName(details.game_id)} · {displayText(details.name)}</span></span>
   <small>{order.username??'ลูกค้า'} · {dateTime(order.created_at)}{details.mock?' · ทดสอบ':''}</small>
  </span>
  <span className="stitch-recent-total"><strong>{dollars(details.price_usd)}</strong><Status value={order.status}/></span>
  <StitchIcon name="chevron_right" size={16}/>
 </button>;
}
<<<<<<< HEAD
export function Overview(props:OverviewProps){
 const wide=useWideWorkspace();
 return wide?<OverviewDesktop/>:<OverviewMobile {...props}/>;
}
function OverviewMobile({unreadChatRooms,staleChatCount}:OverviewProps){
 const summary=useResource('/overview?include_mock=true'),orders=useResource('/orders?include_mock=true'),sources=useResource('/sources');
 const reviewQueue='/orders?status=payment_review&include_mock=true';
 const urgentOrders=useResource(reviewQueue+'&limit=1');
 const s=summary.data;
 const rows:Row[]=(orders.data?.data??[]);
 const queueCounts=urgentOrders.data?.counts;
 const slipCount:number|null=queueCounts?queueCounts.payment_review??0:null;
 const hasSlips=slipCount!==null&&slipCount>0;
 const urgent=hasSlips&&!urgentOrders.error?urgentOrders.data?.data?.[0]:null;
 return <div className="stitch-overview"><PageHeader title="ภาพรวม" subtitle={new Date().toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',weekday:'long',day:'numeric',month:'long'})}/>
  <ReadNotice error={summary.error} cached={!!s}/>
  <ReadNotice error={urgentOrders.error} cached={!!urgentOrders.data}/>
  <button className="stitch-urgent" data-urgent={hasSlips} onClick={()=>navigate(urgent?'/orders/'+encodeURIComponent(urgent.id):reviewQueue)}><span className="stitch-urgent-dot"/><span>{hasSlips?<><strong>งานด่วน:</strong> สลิปรอตรวจ {slipCount} รายการ</>:slipCount===0?'ไม่มีสลิปรอตรวจ':'คิวตรวจสลิป'}</span><StitchIcon name="chevron_right" size={17}/></button>
=======
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
>>>>>>> 6d236ea247287af2d4678031d3061f7c3b9fd22d
  <div className="metric-grid stitch-metrics">
   <section className="metric-card"><span>ยอดขายวันนี้</span><strong>{dollars(s?.revenue_usd)}</strong><small>จากออเดอร์ที่เติมสำเร็จ</small></section>
   <section className="metric-card"><span>กำไรขั้นต้น</span><strong>{dollars(s?.estimated_gross_profit_usd)}</strong><small>{s?.missing_cost_count?'ข้อมูลต้นทุนไม่ครบ':'ก่อนหักค่าใช้จ่ายอื่น'}</small></section>
   <section className="metric-card"><span>ออเดอร์สำเร็จ</span><strong>{s?s.counts?.completed??0:'—'}</strong></section>
   <section className="metric-card stitch-pending"><span>สลิปรอตรวจ</span><strong>{slipCount??'—'}</strong></section>
  </div>
  <div className="shortcut-grid stitch-home-shortcuts">
   <button aria-label="เปิดคิวตรวจสลิป" onClick={()=>navigate(reviewQueue)}><span className="tile-icon"><StitchIcon name="receipt_long" size={20}/>{hasSlips&&<b className="shortcut-count" data-kind="payment" aria-hidden="true">{slipCount>99?'99+':slipCount}</b>}</span><strong>ตรวจสลิป</strong></button>
   <button onClick={()=>navigate('/store/products')}><span className="tile-icon"><StitchIcon name="sports_esports" size={20}/></span><strong>เกมและแพ็กเกจ</strong></button>
   <button onClick={()=>navigate('/store/sources')}><span className="tile-icon"><StitchIcon name="compare_arrows" size={20}/></span><strong>ร้านต้นทาง</strong></button>
   <button aria-labelledby="shortcut-chats-label" aria-describedby="shortcut-count-chats" onClick={()=>navigate('/chats')}><span className="tile-icon"><StitchIcon name="chat_bubble_outline" size={20}/><NavigationCount kind="chats" placement="shortcut" count={unreadChatRooms} stale={staleChatCount}/></span><strong id="shortcut-chats-label">แชทลูกค้า</strong></button>
  </div>
  <div className="overview-columns"><section className="stitch-recent-orders"><div className="section-title"><h2>ออเดอร์ล่าสุด</h2><button className="text-link" onClick={()=>navigate('/orders')}>ดูทั้งหมด</button></div><ReadNotice error={orders.error} cached={!!orders.data}/><Panel>{orders.loading&&!orders.data?<Loading/>:orders.data?rows.length?rows.slice(0,3).map(o=><RecentOrder key={o.id} order={o}/>):<Empty title="ยังไม่มีออเดอร์ในรายการนี้" text="ออเดอร์ใหม่จะแสดงเมื่อมีลูกค้าสั่งซื้อ"/>:null}</Panel></section>
  <section className="stitch-source-status">
   <div className="section-title"><h2>สถานะซัพพลายเออร์</h2></div>
   <ReadNotice error={sources.error} cached={!!sources.data}/>
   <Panel>{sources.loading&&!sources.data?<Loading/>:sources.data?.data.length?sources.data.data.map((source:Row)=><button className="stitch-source-row" key={source.id??source.source_id} onClick={()=>navigate('/store/sources')}><span className="stitch-source-indicator" data-enabled={Boolean(source.enabled)} aria-hidden="true"/><span><strong>{source.name}</strong><small>{source.enabled?'เปิดใช้งาน':'ปิดใช้งาน'}</small></span>{source.package_count!=null&&<span className="stitch-source-package-count"><small>แพ็กเกจ</small><strong>{Number(source.package_count).toLocaleString('en-US')}</strong></span>}</button>):sources.data?<Empty title="ยังไม่มีซัพพลายเออร์"/>:null}</Panel>
  </section>
  </div>
 </div>;
}
