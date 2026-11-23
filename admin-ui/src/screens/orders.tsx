import {OrderCard} from '../components/order-card';
import {ReadNotice} from '../components/read-notice';
import {Receipt} from '../receipts';
import {useState} from 'react';
import {Search,SlidersHorizontal,ExternalLink,MessageSquare,CheckCircle2,ReceiptText} from 'lucide-react';
import {api,useResource,navigate,statuses,actions,key,refreshAll,shortId,dollars,gameName,dateTime,confirmAction,type Row} from '../api';
import {PageHeader,Panel,ErrorBox,Empty,Loading,Status,OrderRow,Field,Toggle} from '../components';
export function Orders(){
 const params=new URLSearchParams(location.hash.split('?')[1]??'');
 const initialStatus=params.get('status')??'';
 const status=Object.hasOwn(statuses,initialStatus)?initialStatus:'';
 const [search,setSearch]=useState(params.get('search')??''),[cursor,setCursor]=useState('');
 const query=params.get('search')??'';
 const includeMock=params.get('include_mock')!=='false';
 const {data,error,loading}=useResource('/orders?'+new URLSearchParams({include_mock:String(includeMock),...status?{status}:{},...query?{search:query}:{},...cursor?{cursor}:{}}));
 function filter(value:string,term=query,mock=includeMock){setCursor('');navigate('/orders?'+new URLSearchParams({include_mock:String(mock),...value?{status:value}:{},...term?{search:term}:{}}));}
 return <><PageHeader title="ออเดอร์และการจัดส่ง" subtitle="ตรวจสลิป รับงาน และติดตามการเติมเกม"/>
  <form className="search-bar" onSubmit={e=>{e.preventDefault();filter(status,search);}}><Search size={20}/><input aria-label="ค้นหาออเดอร์" placeholder="ค้นหาเลขออเดอร์, UID, ชื่อลูกค้า…" value={search} onChange={e=>setSearch(e.target.value)}/><button type="submit" className="quiet">ค้นหา</button></form>
  <div className="filter-chips" aria-label="ตัวกรองด่วน">{[['','ทั้งหมด'],['payment_review','รอตรวจสลิป'],['paid','รอรับงาน'],['processing','กำลังเติม'],['issue','พบปัญหา'],['completed','สำเร็จ']].map(([value,label])=><button key={value} aria-pressed={status===value} onClick={()=>filter(value)}>{label}</button>)}</div>
  <div className="filters"><SlidersHorizontal size={17}/><select aria-label="กรองสถานะ" value={status} onChange={e=>filter(e.target.value)}><option value="">ทุกสถานะ</option>{Object.entries(statuses).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><span className="muted">{data?data.data.length+' รายการในหน้านี้':'—'}</span></div>
  <div className="mock-filter"><Toggle label="รวมรายการ MOCK" checked={includeMock} onChange={value=>filter(status,query,value)}/></div>
  <ReadNotice error={error} cached={!!data}/>
  {loading&&!data?<Loading/>:data?<div className="order-card-list">{data.data.length?data.data.map((o:Row)=><OrderCard key={o.id} order={o}/>):<Panel><Empty title={query||status?'ไม่พบออเดอร์ที่ตรงกัน':'ยังไม่มีออเดอร์'} text="ลองเปลี่ยนตัวกรองหรือคำค้นหา">{(query||status)&&<button className="secondary" onClick={()=>filter('','')}>ล้างตัวกรอง</button>}</Empty></Panel>}</div>:null}
  <div className="pagination">{cursor&&<button className="secondary" onClick={()=>setCursor('')}>กลับหน้าแรก</button>}{data?.next_cursor&&<button className="secondary" onClick={()=>setCursor(data.next_cursor)}>รายการถัดไป</button>}</div>
 </>;
}
export function OrderDetail({id}:{id:string}){
 const {data:o,error,loading}=useResource('/orders/'+encodeURIComponent(id));const [busy,setBusy]=useState(false),[actionError,setActionError]=useState('');
 async function act(action:string){
  if(!o)return;
  if(['complete','refund','cancel','reopen'].includes(action)&&!await confirmAction(`${actions[action]}\nออเดอร์ ${shortId(o.id)} · ${o.customer?.username??'ลูกค้า'}\n${o.details.name}\n${action==='refund'?'ยืนยันว่าได้คืนเงินจริงแล้ว ระบบนี้บันทึกสถานะเท่านั้น':'ตรวจข้อมูลแล้วดำเนินการใช่ไหม?'}`))return;
  setBusy(true);setActionError('');try{await api('/orders/'+id+'/actions','POST',{action,idempotency_key:key(),expected_revision:o.revision});refreshAll();}catch(e:any){setActionError(e.message);}finally{setBusy(false);}
 }
 if(loading&&!o)return <Loading/>;if(!o)return <ErrorBox message={error}/>;
 const d=o.details,i=o.internal;return <><PageHeader back="/orders" title={'ออเดอร์ #'+shortId(id)} subtitle={dateTime(o.created_at)}><Status value={o.status}/></PageHeader><ErrorBox message={error||actionError}/>{d.mock&&<div className="notice">🧪 ออเดอร์ MOCK สำหรับทดสอบ ไม่ต้องโอนเงินหรือเติมเกมจริง</div>}<div className="detail-grid"><div><Panel title="ข้อมูลการเติมเกม"><div className="detail-game"><span className="game-mark ff">{d.game_id==='free-fire'?'FF':'ML'}</span><div><h2>{gameName(d.game_id)}</h2><p>{d.name}</p></div></div><dl className="facts"><div><dt>UID / Player ID</dt><dd className="selectable">{d.player?.UID??'—'}</dd></div><div><dt>โซนเกม</dt><dd>{d.zone?.toUpperCase()}</dd></div>{d.player?.['Zone ID']&&<div><dt>Zone ID</dt><dd>{d.player['Zone ID']}</dd></div>}<div><dt>ราคาขาย</dt><dd className="accent">{dollars(d.price_usd)} USD</dd></div><div><dt>การชำระเงิน</dt><dd>{o.payment_verified?'ยืนยันรับเงินแล้ว':'ยังไม่ยืนยัน'}</dd></div><div><dt>ลูกค้า</dt><dd>{o.customer?.username??'บัญชีทดสอบเดิม'}</dd></div><div><dt>ผู้รับงาน</dt><dd>{o.assigned_admin_id?'เจ้าของร้าน':'ยังไม่มีผู้รับงาน'}</dd></div></dl>{o.customer_id&&<button className="secondary wide" onClick={()=>navigate('/chats/'+o.customer_id)}><MessageSquare size={17}/>เปิดห้องแชทลูกค้า</button>}</Panel><Panel title="ข้อมูลต้นทุน · เฉพาะแอดมิน"><dl className="facts"><div><dt>ร้านต้นทาง</dt><dd>{i.source_id??'—'}</dd></div><div><dt>ต้นทุน</dt><dd>{Number.isFinite(i.cost_lak)?Number(i.cost_lak).toLocaleString('en-US')+' LAK':'—'}</dd></div><div><dt>เรทตอนสั่ง</dt><dd>{i.lak_per_usd?Number(i.lak_per_usd).toLocaleString('en-US')+' LAK/USD':'—'}</dd></div><div><dt>บวกจากทุน</dt><dd>{i.markup_bps!==undefined?i.markup_bps/100+'%':'—'}</dd></div></dl>{i.source_url&&<a className="text-link" href={i.source_url} target="_blank" rel="noreferrer">เปิดร้านต้นทาง <ExternalLink size={15}/></a>}</Panel></div><div><Panel title="สลิปชำระเงิน" aside={<ReceiptText size={19}/>}><p className="muted small">ตรวจชื่อผู้รับ ยอดเงิน และรายการซ้ำก่อนยืนยันรับเงิน</p>{o.receipts.length?o.receipts.map((r:Row)=><Receipt key={r.id} receipt={r}/>):<Empty title="ยังไม่มีสลิป" text="รอลูกค้าแนบหลักฐานการชำระเงิน"/>}</Panel><Panel title="ประวัติออเดอร์"><div className="timeline">{o.messages.length?o.messages.map((m:Row)=><div key={m.id}><span className="timeline-dot"/><p>{m.text.startsWith('Order status: ')?'เปลี่ยนเป็น '+(statuses[m.text.slice(14)]??m.text.slice(14)):m.text}</p><small>{dateTime(m.created_at)} · {m.sender==='system'?'ระบบ':'แอดมิน'}</small></div>):<p className="muted">ยังไม่มีการเปลี่ยนสถานะ</p>}</div></Panel></div></div><div className="action-dock">{o.allowed_actions.length?o.allowed_actions.map((a:string)=><button key={a} disabled={busy} className={['refund','cancel','issue'].includes(a)?'secondary danger':'primary'} onClick={()=>act(a)}>{a==='complete'&&<CheckCircle2 size={18}/>} {actions[a]}</button>):<span className="muted">ออเดอร์นี้ไม่มีงานที่ต้องดำเนินการแล้ว</span>}</div></>;
}
