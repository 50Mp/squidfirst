import type {Database} from '../database.js';
import {OrderError} from '../orders.js';
import {lakToUsd} from '../fx.js';
const cents=(value:unknown)=>{if(typeof value!=='string'||!/^\d+\.\d{2}$/.test(value))return null;return BigInt(value.replace('.',''));};
const money=(n:bigint)=>`${n<0n?'-':''}${(n<0n?-n:n)/100n}.${String((n<0n?-n:n)%100n).padStart(2,'0')}`;
export async function adminOverview(db:Database,from?:string,to?:string,includeMock=false){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 from??=today;to??=from;
 for(const date of [from,to])if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00+07:00'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw new OrderError(400,'Invalid report date');
 const start=Date.parse(from+'T00:00:00+07:00'),end=Date.parse(to+'T00:00:00+07:00')+86400000;if(end<=start||end-start>366*86400000)throw new OrderError(400,'Invalid report range');
 const rows=(await db.query("SELECT status,public_snapshot,internal_snapshot,created_at FROM orders WHERE created_at>=$1 AND created_at<$2 AND ($3 OR COALESCE(public_snapshot->>'mock','false')<>'true')",[new Date(start).toISOString(),new Date(end).toISOString(),includeMock])).rows;
 const counts:Record<string,number>={};let revenue=0n,refunds=0n,gross=0n,missing=0;
 const games=new Map<string|null,number>();
 const daily=Array.from({length:(end-start)/86400000},(_,index)=>({
  date:new Date(start+index*86400000+7*3600000).toISOString().slice(0,10),
  orders:0,revenue:0n,gross:0n,missing:0,
 }));
 for(const r of rows){
  const day=daily[Math.floor((new Date(r.created_at).getTime()-start)/86400000)];
  day.orders++;
  const game=typeof r.public_snapshot?.game_id==='string'?r.public_snapshot.game_id:null;
  games.set(game,(games.get(game)??0)+1);
  counts[r.status]=(counts[r.status]??0)+1;const price=cents(r.public_snapshot?.price_usd);if(r.status==='refunded'&&price!==null)refunds+=price;
  if(r.status!=='completed')continue;
  if(price===null){missing++;day.missing++;continue;}
  revenue+=price;day.revenue+=price;
  try{const internal=r.internal_snapshot;if(!Number.isSafeInteger(internal.cost_lak)||typeof internal.lak_per_usd!=='string')throw Error();const cost=cents(lakToUsd(internal.cost_lak,internal.lak_per_usd));if(cost===null)throw Error();gross+=price-cost;day.gross+=price-cost;}catch{missing++;day.missing++;}
 }
 const outstanding=(await db.query("SELECT status,COUNT(*)::int AS count FROM orders WHERE status NOT IN ('completed','cancelled','refunded') AND ($1 OR COALESCE(public_snapshot->>'mock','false')<>'true') GROUP BY status",[includeMock])).rows;
 return{from,to,timezone:'Asia/Bangkok',basis:'order_created_at',include_mock:includeMock,total_orders:rows.length,counts,outstanding,revenue_usd:money(revenue),refunds_usd:money(refunds),estimated_gross_profit_usd:missing?null:money(gross),missing_cost_count:missing,
  daily:daily.map(day=>({date:day.date,orders:day.orders,revenue_usd:money(day.revenue),gross_profit_usd:day.missing?null:money(day.gross)})),
  games:Array.from(games,([game_id,orders])=>({game_id,orders})).sort((a,b)=>b.orders-a.orders),
 };
}
