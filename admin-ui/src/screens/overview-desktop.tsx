import {useState} from 'react';
import {AlertTriangle,ArrowUpRight,CheckCircle2,Clock3,Coins,Package,ReceiptText,RefreshCw,TrendingUp} from 'lucide-react';
import {dateTime,dollars,gameName,navigate,refreshAndWait,shortId,useResource,type Row} from '../api';
import {Empty,Loading,PageHeader,Panel,Status,Toggle,displayText} from '../components';
import {ReadNotice} from '../components/read-notice';

interface ReportDay {date:string;orders:number;revenue_usd:string;gross_profit_usd:string|null}
interface TrendPoint {from:string;to:string;value:number|null}
interface Report {
 from:string;to:string;total_orders:number;counts:Record<string,number>;
 outstanding:{status:string;count:number}[];
 revenue_usd:string;estimated_gross_profit_usd:string|null;missing_cost_count:number;
 daily:ReportDay[];games:{game_id:string|null;orders:number}[];
}
type Series='revenue_usd'|'gross_profit_usd'|'orders';
const seriesLabels:Record<Series,string>={revenue_usd:'ยอดขาย',gross_profit_usd:'กำไรขั้นต้น',orders:'จำนวนออเดอร์'};
const palette=['#2563eb','#004ac6','#64748b','#a5baf4','#cbd5e1'];
const dayFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'});
const dateLabel=(date:string)=>new Date(date+'T12:00:00Z').toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short'});

function Trend({report}:Readonly<{report:Report}>){
 const [series,setSeries]=useState<Series>('revenue_usd');
 const daily=report.daily??[];
 const size=Math.max(1,Math.ceil(daily.length/30));
 const points:TrendPoint[]=[];
 for(let index=0;index<daily.length;index+=size){
  const days=daily.slice(index,index+size),values=days.map(day=>day[series]);
  const value=values.includes(null)?null:values.reduce<number>((sum,item)=>sum+Number(item),0);
  points.push({from:days[0].date,to:days.at(-1)!.date,value});
 }
 const high=Math.max(0,...points.map(point=>point.value??0)),low=Math.min(0,...points.map(point=>point.value??0));
 const range=high-low||1,baseline=high||low?(-low/range)*100:0;
 const hasValues=points.some(point=>point.value!==null);
 const hasMovement=high!==0||low!==0;
 const incomplete=series==='gross_profit_usd'&&report.missing_cost_count>0;
 const label=(point:TrendPoint)=>point.from===point.to?dateLabel(point.from):dateLabel(point.from)+' – '+dateLabel(point.to);
 const display=(value:number|null)=>value===null?'ต้นทุนไม่ครบ':series==='orders'?String(value):dollars(value.toFixed(2));
 return <Panel title="แนวโน้มยอดขายและกำไรขั้นต้น">
  <div className="overview-series" aria-label="ข้อมูลบนกราฟ">{(Object.keys(seriesLabels) as Series[]).map(value=><button key={value} aria-pressed={series===value} onClick={()=>setSeries(value)}>{seriesLabels[value]}</button>)}</div>
  <div className="overview-chart-summary"><span>{seriesLabels[series]}</span><strong>{series==='orders'?report.total_orders:dollars(series==='revenue_usd'?report.revenue_usd:report.estimated_gross_profit_usd)}</strong><small>{dateLabel(report.from)} – {dateLabel(report.to)}</small></div>
  {points.length>0&&<>
   <div className="overview-plot-frame" aria-hidden="true">
   <div className="overview-plot-axis">{hasMovement&&<span>{display(high)}</span>}<span>{display(low)}</span></div>
   <div className="overview-plot">
    {low<0&&high>0&&<i className="overview-zero-line" style={{bottom:baseline+'%'}}/>}
    {points.map(point=>{
     const value=point.value;
     const height=Math.abs(value??0)/range*100;
     return <div className="overview-plot-slot" key={point.from} title={label(point)+': '+display(value)}>
      <span className={value===null?'unknown':value<0?'negative':''} style={{height:Math.max(1,height)+'%',bottom:(value!==null&&value<0?baseline-height:baseline)+'%'}}/>
     </div>;
    })}
   </div>
   </div>
   <div className="overview-plot-labels"><span>{dateLabel(points[0].from)}</span>{points.length>1&&<span>{dateLabel(points.at(-1)!.to)}</span>}</div>
   {(incomplete||!hasMovement)&&<p className="overview-chart-note">{incomplete||!hasValues?'ข้อมูลต้นทุนไม่ครบสำหรับช่วงนี้':series==='orders'?'ไม่มีออเดอร์ในช่วงที่เลือก':seriesLabels[series]+'เป็น $0.00 ในช่วงที่เลือก'}</p>}
   <details className="overview-chart-data"><summary>ดูข้อมูลกราฟ</summary><table><thead><tr><th scope="col">วันที่</th><th scope="col">{seriesLabels[series]}</th></tr></thead><tbody>{points.map(point=><tr key={point.from}><td>{label(point)}</td><td>{display(point.value)}</td></tr>)}</tbody></table></details>
  </>}
 </Panel>;
}

function GameMix({report}:Readonly<{report:Report}>){
 const games=report.games??[];
 const top=games.slice(0,4),rest=games.slice(4).reduce((sum,game)=>sum+game.orders,0);
 const entries=[...top.map(game=>({name:game.game_id?gameName(game.game_id):'ไม่ระบุเกม',orders:game.orders})),...(rest?[{name:'เกมอื่น',orders:rest}]:[])];
 let position=0;
 const slices=entries.map((entry,index)=>{
  const start=position;
  position+=entry.orders/report.total_orders*100;
  return palette[index]+' '+start+'% '+position+'%';
 });
 return <Panel title="ออเดอร์ตามเกม">
  {entries.length?<><div className="overview-donut" aria-hidden="true" style={{background:'conic-gradient('+slices.join(',')+')'}}><div><strong>{Math.round(entries[0].orders/report.total_orders*100)}%</strong><small>{entries[0].name}</small></div></div>
  <ul className="overview-game-list">{entries.map((game,index)=><li key={index}><span><i style={{background:palette[index]}}/>{game.name}</span><b>{game.orders} รายการ</b></li>)}</ul></>:<Empty title="ยังไม่มีออเดอร์ในช่วงนี้"/>}
  <button className="secondary wide" onClick={()=>navigate('/store/games')}>ดูเกมที่รองรับ <ArrowUpRight size={16}/></button>
 </Panel>;
}

export function OverviewDesktop({mock,setMock}:Readonly<{mock:boolean;setMock:(value:boolean)=>void}>){
 const [days,setDays]=useState(1),[syncing,setSyncing]=useState(false);
 const [custom,setCustom]=useState<{from:string;to:string}|null>(null);
 const now=new Date(),today=dayFormat.format(now);
 const from=custom?.from??dayFormat.format(new Date(now.getTime()-(days-1)*86400000)),to=custom?.to??today;
 const report=useResource<Report>('/overview?'+new URLSearchParams({from,to,include_mock:String(mock)}));
 const active=useResource<{data:Row[]}>('/orders?'+new URLSearchParams({active_only:'true',limit:'8',include_mock:String(mock)}));
 const latest=useResource<{data:Row[]}>('/orders?'+new URLSearchParams({limit:'6',include_mock:String(mock)}));
 const sources=useResource('/sources'),fx=useResource('/fx');
 const s=report.data;
 const activeIds=new Set(active.data?.data.map(row=>row.id));
 const recent=latest.data?.data.filter(row=>!activeIds.has(row.id))??[];
 const outstanding=(status:string)=>s?.outstanding.find(row=>row.status===status)?.count??0;
 const openQueue=(status:string)=>navigate('/orders?'+new URLSearchParams({status,include_mock:String(mock)}));
 const metrics=[
  {label:'ยอดขายรวม',value:dollars(s?.revenue_usd),Icon:Coins},
  {label:'ออเดอร์ทั้งหมด',value:s?.total_orders??'—',Icon:Package},
  {label:'กำไรขั้นต้น',value:dollars(s?.estimated_gross_profit_usd),note:s?.missing_cost_count?'ข้อมูลต้นทุนไม่ครบ':undefined,Icon:TrendingUp},
  {label:'รอตรวจสลิป',value:s?outstanding('payment_review'):'—',note:'คิวค้างทุกวัน',Icon:Clock3},
  {label:'เติมสำเร็จ',value:s?s.counts.completed??0:'—',Icon:CheckCircle2},
  {label:'พบปัญหา',value:s?outstanding('issue'):'—',note:'คิวค้างทุกวัน',Icon:AlertTriangle},
 ];
 return <div className="desktop-overview">
  <PageHeader title="ภาพรวม" subtitle="ยอดขาย กำไรขั้นต้น และคิวงานของร้าน">
   <div className="overview-date-tools">
    <div className="overview-period" aria-label="ช่วงวันที่">{[[1,'วันนี้'],[7,'7 วัน'],[30,'30 วัน']].map(([value,label])=><button key={value} aria-pressed={!custom&&days===value} onClick={()=>{setCustom(null);setDays(Number(value));}}>{label}</button>)}</div>
    <details className="overview-custom"><summary>กำหนดช่วงวันที่</summary><form onSubmit={event=>{
     event.preventDefault();
     const values=new FormData(event.currentTarget),from=String(values.get('from')),to=String(values.get('to'));
     if(from>to||Date.parse(to)-Date.parse(from)>=366*86400000){
      const input=event.currentTarget.elements.namedItem('to') as HTMLInputElement;input.setCustomValidity('เลือกช่วงวันที่ไม่เกิน 366 วัน');input.reportValidity();return;
     }
     setCustom({from,to});event.currentTarget.closest('details')!.open=false;
    }} onInput={event=>(event.currentTarget.elements.namedItem('to') as HTMLInputElement).setCustomValidity('')}>
     <label>ตั้งแต่ <input name="from" type="date" max={today} defaultValue={from} required/></label>
     <label>ถึง <input name="to" type="date" max={today} defaultValue={to} required/></label>
     <button className="primary" type="submit">ใช้ช่วงวันที่</button>
    </form></details>
    <button className="secondary" disabled={syncing} onClick={async()=>{setSyncing(true);try{await refreshAndWait();}finally{setSyncing(false);}}}><RefreshCw size={16}/>ซิงค์</button>
   </div>
  </PageHeader>
  <p className="overview-range">{dateLabel(from)} – {dateLabel(to)} · ยอดตามวันที่สร้างออเดอร์ · UTC+7</p>
  <ReadNotice error={report.error} cached={!!s}/>
  <div className="desktop-overview-metrics">{metrics.map(({label,value,note,Icon})=><section key={label}><span>{label}<Icon size={18}/></span><strong>{value}</strong>{note&&<small>{note}</small>}</section>)}</div>
  <div className="overview-queue-cards">
   <button data-pending={outstanding('payment_review')>0} onClick={()=>openQueue('payment_review')}><ReceiptText size={20}/><span><strong>สลิปรอตรวจ</strong><small>รอตรวจหลักฐานการชำระเงิน</small></span><b>{s?outstanding('payment_review'):'—'}</b></button>
   <button data-pending={outstanding('issue')>0} onClick={()=>openQueue('issue')}><AlertTriangle size={20}/><span><strong>ออเดอร์ที่พบปัญหา</strong><small>รอแอดมินตรวจสอบ</small></span><b>{s?outstanding('issue'):'—'}</b></button>
  </div>
  {s?<div className="desktop-overview-charts"><Trend report={s}/><GameMix report={s}/></div>:report.loading?<Loading/>:null}
  <Panel title="ออเดอร์ที่ต้องดูแล" aside={<button className="text-link" onClick={()=>navigate('/orders')}>เปิดหน้าออเดอร์ <ArrowUpRight size={16}/></button>}>
   <ReadNotice error={active.error} cached={!!active.data}/>
   {active.loading&&!active.data?<Loading/>:active.data?.data.length?<div className="overview-orders-scroll" tabIndex={0} role="region" aria-label="เลื่อนตารางคิวออเดอร์"><table aria-label="ออเดอร์ที่ต้องดูแล"><thead><tr><th scope="col">ออเดอร์และเวลา</th><th scope="col">เกมและแพ็กเกจ</th><th scope="col">ลูกค้า</th><th scope="col">ราคาขาย (USD)</th><th scope="col">สถานะ</th><th scope="col">ซัพพลายเออร์</th></tr></thead><tbody>{active.data.data.map(order=><tr key={order.id}><th scope="row"><button className="text-link" onClick={()=>navigate('/orders/'+encodeURIComponent(order.id))}>#{shortId(order.id)}</button><time dateTime={order.created_at}>{dateTime(order.created_at)}</time></th><td><strong>{gameName(order.details.game_id)}</strong><small>{displayText(order.details.name)}</small></td><td>{order.username??'—'}</td><td>{dollars(order.details.price_usd)}</td><td><Status value={order.status}/></td><td>{order.supplier_name??'—'}</td></tr>)}</tbody></table></div>:active.data?<Empty title="ไม่มีออเดอร์ค้างในคิว"/>:null}
   {(recent.length>0||latest.error)&&<div className="overview-recent"><h3>ออเดอร์ล่าสุด</h3><ReadNotice error={latest.error} cached={!!latest.data}/>{recent.map(order=><button className="text-link" key={order.id} onClick={()=>navigate('/orders/'+encodeURIComponent(order.id))}>#{shortId(order.id)} · {displayText(order.details.name)}</button>)}</div>}
  </Panel>
  <div className="overview-system-panels">
   <Panel title="ซัพพลายเออร์"><ReadNotice error={sources.error} cached={!!sources.data}/>{sources.data?.data.map((source:Row)=><p key={source.id??source.source_id}>{source.name} · {source.enabled?'เปิดใช้งาน':'ปิดใช้งาน'}</p>)}</Panel>
   <Panel title="อัตราแลกเปลี่ยน"><ReadNotice error={fx.error} cached={!!fx.data}/><button className="text-link" onClick={()=>navigate('/store/fx')}>{fx.data?.rate?'1 USD = '+Number(fx.data.rate.lak_per_usd).toLocaleString('en-US')+' LAK':'ดูอัตราแลกเปลี่ยน'} <ArrowUpRight size={16}/></button></Panel>
  </div>
  <div className="overview-toolbar"><Toggle label="รวมรายการทดสอบ" checked={mock} onChange={setMock}/></div>
  <p className="footnote">กำไรขั้นต้นคำนวณจากราคาขายหักต้นทุนซัพพลายเออร์สำหรับออเดอร์ที่เติมสำเร็จ</p>
 </div>;
}
