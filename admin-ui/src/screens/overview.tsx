import {StitchIcon} from '../components/stitch-icon';

import {useResource,navigate,dollars,gameName,shortId,dateTime,type Row} from '../api';
import {PageHeader,Panel,Loading,Empty,Status,displayText} from '../components';
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
