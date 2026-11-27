import {StitchIcon} from '../components/stitch-icon';
import { OrderCard } from "../components/order-card";
import { OrderTable } from "../components/order-table";
import { ReadNotice } from "../components/read-notice";
import { Receipt } from "../receipts";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { restoreOrderList } from "../order-navigation";
import { OrderActions } from "../components/order-actions";
import {SlipIssueSheet,slipIssueLabel,type SlipIssueDraft} from '../components/slip-issue-sheet';
import {Search,AlertCircle,Check,CircleX,Clock3,LoaderCircle,RefreshCw,SquareCheck,UserCheck,Zap,SlidersHorizontal,ExternalLink,CheckCircle2,ReceiptText,X,CalendarDays} from 'lucide-react';
import {
  ApiError,
  api,
  useResource,
  navigate,
  statuses,
  actions,
  key,
  refreshAndWait,
  shortId,
  dollars,
  gameName,
  dateTime,
  confirmAction,
  type Row,
} from "../api";
import {
  PageHeader,
  Panel,
  ErrorBox,
  Empty,
  Loading,
  Status,
  Field,
  displayText,
} from "../components";
import {GameMark} from '../components/game-art';

const orderFilters = [
  ["", "ทั้งหมด", null],
  ["payment_review", "รอตรวจชำระเงิน", Clock3],
  ["paid", "รอรับงาน", UserCheck],
  ["processing", "กำลังเติม", LoaderCircle],
  ["completed", "เติมสำเร็จ", CheckCircle2],
  ["issue", "พบปัญหา", AlertCircle],
  ["cancelled", "ยกเลิก", CircleX],
] as const;
interface OrdersProps {
  readonly path: string;
  readonly selectedId?: string;
  readonly desktop?: boolean;
  readonly toolbar?: HTMLElement | null;
}
type OrderFilters = Record<'status'|'search'|'game_id'|'supplier_id'|'date',string>;
const emptyFilters:OrderFilters={status:'',search:'',game_id:'',supplier_id:'',date:''};
export function Orders({ path, selectedId, desktop=false, toolbar=null }: Readonly<OrdersProps>) {
  const params = new URLSearchParams(path.split("?")[1] ?? "");
  const initialStatus = params.get("status") ?? "";
  const status = Object.hasOwn(statuses, initialStatus) ? initialStatus : "";
  const [search, setSearch] = useState(params.get("search") ?? "");
  const cursor = params.get("cursor") ?? "";
  const restored = useRef(false);
  const query = params.get("search") ?? "";
  const game = params.get("game_id") ?? "";
  const supplier = params.get('supplier_id') ?? '';
  const orderDate = params.get('date') ?? '';
  const includeMock = params.get("include_mock") !== "false";
  const games = useResource<{data:Row[]}>(desktop?'/games':null);
  const suppliers=useResource<{data:{id:string;name:string}[]}>(desktop?'/sources':null);
  const activeFilters:OrderFilters={status,search:query,game_id:game,supplier_id:supplier,date:orderDate};
  const hasFilters=Object.values(activeFilters).some(Boolean);
  function orderQuery(changes:Partial<OrderFilters>={}){
    const queryParams=new URLSearchParams({include_mock:String(includeMock)});
    for(const [key,value] of Object.entries({...activeFilters,...changes}))if(value)queryParams.set(key,value);
    return queryParams;
  }
  const [selection, setSelection] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [actionError, setActionError] = useState("");
  const [batchFeedback,setBatchFeedback]=useState("");
  const queueActionLock=useRef(false);
  const listQuery=orderQuery();
  if(cursor)listQuery.set('cursor',cursor);
  const { data, error, loading } = useResource('/orders?'+listQuery);
  const queueLocked=busy||loading||!!error;
  const rows: Row[] = data?.data ?? [];
  const selected = rows.filter((row) => selection.includes(row.id));
  const counts: Record<string, number> = data?.counts ?? {};
  const allCount = Object.values(counts).reduce((total, count) => total + count, 0);
  const allSelected = rows.length > 0 && selected.length === rows.length;
  const canBatch = (action: string) =>
    selected.length > 0 && selected.every(row => row.status === "payment_review" && row.allowed_actions.includes(action));
  function toggleOrder(id: string) {
    setBatchFeedback("");
    setSelection(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  }
  function toggleAll() {
    setBatchFeedback("");
    setSelection(allSelected?[]:rows.map(row=>row.id));
  }
  async function sync() {
    setSyncing(true);
    try { await refreshAndWait(); }
    finally { setSyncing(false); }
  }
  async function openNextSlip() {
    if(queueLocked||queueActionLock.current)return;
    queueActionLock.current=true;
    setBusy(true);
    setActionError("");
    try {
      const slipQuery=orderQuery({status:'payment_review'});
      slipQuery.set('limit','1');
      const next = await api('/orders?'+slipQuery);
      if (next.data[0]) navigate("/orders/" + encodeURIComponent(next.data[0].id));
      else setActionError("ไม่มีสลิปที่รอตรวจ");
    } catch (error) {
      setActionError((error as Error).message);
    } finally {
      queueActionLock.current=false;
      setBusy(false);
    }
  }
  async function runActions(orders: Row[], action: string) {
    if(queueLocked||queueActionLock.current||!orders.length||!orders.every(row=>row.allowed_actions.includes(action)))return;
    queueActionLock.current=true;
    setBusy(true);
    setActionError("");
    setBatchFeedback("");
    const batch=action==="approve"||action==="cancel";
    const skipped:string[]=[];
    let updated = 0;
    let stopped=false;
    try {
      const target = orders.length === 1 ? "ออเดอร์ #" + shortId(orders[0].id) : orders.length + " ออเดอร์";
      const prompt = action === "approve" ? "ยืนยันว่าตรวจสลิปและได้รับเงินครบแล้วสำหรับ " : actions[action] + " ";
      if (!(await confirmAction(prompt + target + "?"))) return;
      for (const row of orders) {
        try {
          await api("/orders/" + encodeURIComponent(row.id) + "/actions", "POST", {
            action, idempotency_key: key(), expected_revision: row.revision,
          });
          updated++;
        } catch(error) {
          if(!batch||!(error instanceof ApiError)||![404,409].includes(error.status))throw error;
          skipped.push(row.id);
        }
        setSelection(current => current.filter(id => id !== row.id));
      }
    } catch (error) {
      stopped=true;
      setActionError((error as Error).message);
    } finally {
      if(updated||skipped.length||stopped)await refreshAndWait();
      if(batch&&(updated||skipped.length||stopped)){
        const outcome=[(action==="approve"?"อนุมัติแล้ว ":"ยกเลิกแล้ว ")+updated+" รายการ"];
        if(skipped.length){
          const refs=skipped.slice(0,3).map(id=>"#"+shortId(id)).join(", ");
          outcome.push("ข้าม "+skipped.length+" รายการที่เปลี่ยนไป ("+refs+(skipped.length>3?"…":"")+")");
        }
        if(stopped)outcome.push("ยังต้องตรวจ "+(orders.length-updated-skipped.length)+" รายการ");
        setBatchFeedback(outcome.join(" · "));
      }
      queueActionLock.current=false;
      setBusy(false);
    }
  }
  function filter(changes:Partial<OrderFilters>) {
    navigate('/orders?'+orderQuery(changes));
  }
  function setCursor(value: string) {
    const p = new URLSearchParams(path.split("?")[1] ?? "");
    if (value) p.set("cursor", value);
    else p.delete("cursor");
    navigate("/orders?" + p);
  }
  useLayoutEffect(() => {
    if (selectedId) {
      restored.current = false;
      return;
    }
    if (data && !restored.current) {
      const frame = requestAnimationFrame(() => {
        restoreOrderList(path);
        restored.current = true;
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [data, selectedId, path]);
  const statusFilter=<div className="filters stitch-order-filters">
    <SlidersHorizontal size={16}/>
    <select aria-label="กรองสถานะ" value={status} onChange={e=>filter({status:e.target.value})}>
      <option value="">ทุกสถานะ</option>
      {Object.entries(statuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </select>
  </div>;
  const desktopMetrics=[
    ["","ออเดอร์ทั้งหมด",ReceiptText],
    ["awaiting_payment","รอชำระเงิน",Clock3],
    ["paid","รอรับงาน",UserCheck],
    ["processing","กำลังเติม",LoaderCircle],
    ["completed","เติมสำเร็จ",CheckCircle2],
    ["issue","พบปัญหา",AlertCircle],
  ] as const;
  const batchControls=<div className="stitch-batch" aria-label="ดำเนินการหลายออเดอร์">
    <button className="stitch-scan" disabled={queueLocked||!counts.payment_review} onClick={openNextSlip}><Zap size={20}/><span>สแกนสลิปถัดไป<small>{counts.payment_review??0} รอตรวจ</small></span></button>
    <button disabled={queueLocked||!canBatch("approve")} onClick={()=>void runActions(selected,"approve")}><Check size={18}/>อนุมัติกลุ่ม ({selected.length})</button>
    <button disabled={queueLocked||!canBatch("cancel")} onClick={()=>void runActions(selected,"cancel")}><CircleX size={17}/>ปฏิเสธ</button>
    {batchFeedback&&<p className="stitch-batch-feedback" role="status">{batchFeedback}</p>}
  </div>;
  const header=<>
      <PageHeader
        title="ออเดอร์และการจัดส่ง"
        subtitle="จัดการคำสั่งซื้อ เติมเงินเกม และตรวจสอบสลิป"
      >
        <button className="secondary stitch-order-sync" disabled={syncing} onClick={sync}><RefreshCw size={16} className={syncing ? "spin" : undefined}/>ซิงค์</button>
      </PageHeader>
      {desktop&&<div className="desktop-order-metrics" aria-label="สรุปสถานะออเดอร์">
        {desktopMetrics.map(([value,label,Icon])=><button key={value} aria-pressed={status===value} onClick={()=>filter({status:value})}>
          <span>{label}<Icon size={17}/></span>
          <strong>{data?.counts?(value?counts[value]??0:allCount):'—'}</strong>
          {value==='awaiting_payment'&&<small>หมดอายุใน 15 นาที</small>}
        </button>)}
      </div>}
      {desktop&&<div className="desktop-order-queues">
        <button onClick={()=>filter({status:'payment_review'})}><ReceiptText size={16}/><b>{counts.payment_review??0}</b> สลิปรอตรวจ</button>
        <button onClick={()=>filter({status:'paid'})}><UserCheck size={16}/><b>{counts.paid??0}</b> รอรับงาน</button>
        <button onClick={()=>filter({status:'issue'})}><AlertCircle size={16}/><b>{counts.issue??0}</b> พบปัญหา</button>
        <button disabled={busy||!counts.payment_review} onClick={openNextSlip}><Zap size={16}/>เปิดสลิปถัดไป</button>
      </div>}
      <div className={desktop?"desktop-order-filters":undefined}>
      <form
        className="search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          filter({search:search.trim()});
        }}
      >
        <Search size={20} />
        <input
          aria-label="ค้นหาออเดอร์"
          placeholder="ค้นหาเลขออเดอร์, UID, ชื่อผู้เล่น…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </form>
      {desktop?<>{statusFilter}<select aria-label="กรองเกม" value={game} disabled={!games.data} onChange={e=>filter({game_id:e.target.value})}>
        <option value="">ทุกเกม</option>
        {game&&!games.data?.data.some(item=>item.id===game)&&<option value={game}>{gameName(game)}</option>}
        {games.data?.data.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <select aria-label="กรองซัพพลายเออร์" value={supplier} disabled={!suppliers.data} onChange={e=>filter({supplier_id:e.target.value})}>
        <option value="">ทุกซัพพลายเออร์</option>
        {supplier&&!suppliers.data?.data.some(item=>item.id===supplier)&&<option value={supplier}>{supplier}</option>}
        {suppliers.data?.data.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <label className="desktop-order-date"><CalendarDays size={16} aria-hidden="true"/><span>วันที่</span><input type="date" aria-label="กรองวันที่" title="วันที่สร้างออเดอร์ UTC+7" value={orderDate} onChange={e=>filter({date:e.target.value})}/></label>
      {hasFilters&&<div className="desktop-order-filter-tags" aria-label="ตัวกรองที่ใช้อยู่">
        {query&&<button aria-label="ล้างคำค้นหา" onClick={()=>filter({search:''})}>{query}<X size={14}/></button>}
        {status&&<button aria-label="ล้างสถานะ" onClick={()=>filter({status:''})}>{statuses[status]}<X size={14}/></button>}
        {game&&<button aria-label="ล้างเกม" onClick={()=>filter({game_id:''})}>{games.data?.data.find(item=>item.id===game)?.name??gameName(game)}<X size={14}/></button>}
        {supplier&&<button aria-label="ล้างซัพพลายเออร์" onClick={()=>filter({supplier_id:''})}>{suppliers.data?.data.find(item=>item.id===supplier)?.name??supplier}<X size={14}/></button>}
        {orderDate&&<button aria-label="ล้างวันที่" onClick={()=>filter({date:''})}>{orderDate}<X size={14}/></button>}
        <button className="text-link" onClick={()=>filter(emptyFilters)}>ล้างตัวกรองทั้งหมด</button>
      </div>}</>:<div className="filter-chips" aria-label="ตัวกรองด่วน">
        {orderFilters.map(([value, label, Icon]) => (
          <button
            key={value}
            data-order-status={value}
            aria-pressed={status === value}
            onClick={() => filter({status:value})}
          >
            {Icon&&<Icon size={15}/>} {label}
            {data?.counts&&<span>{value ? counts[value]??0 : allCount}</span>}
          </button>
        ))}
      </div>}
      </div>
  </>;
  return (
    <div className={'stitch-orders'+(desktop?' desktop-stitch-orders':'')}>
      {desktop?(toolbar&&createPortal(header,toolbar)):header}
      {!desktop&&<div className="stitch-selection">
        <span><Check size={20} className="stitch-selection-mark"/>เลือกแล้ว <b>{selected.length}</b> รายการ</span>
        <button className="quiet" disabled={busy||rows.length===0} onClick={toggleAll}><SquareCheck size={15}/>{allSelected?"ล้างการเลือก":"เลือกทั้งหมด"}</button>
      </div>}
      <ReadNotice error={error} cached={!!data} />
      <ErrorBox message={actionError}/>
      {desktop&&selected.length>0&&<div className="desktop-order-selection">
        <span><Check size={18}/> เลือกแล้ว {selected.length} รายการ</span>
        <button disabled={busy} onClick={()=>setSelection([])}>ล้างการเลือก</button>
        {batchControls}
      </div>}
      {loading && !data ? (
        <Loading />
      ) : desktop&&rows.length>0 ? (
        <OrderTable rows={rows} total={data?.counts?(status?counts[status]??0:allCount):undefined} activeId={selectedId} selection={selection} busy={busy||!!error} onToggle={toggleOrder} onToggleAll={toggleAll}/>
      ) : data ? (
        <div className="order-card-list">
          {data.data.length ? (
            data.data.map((o: Row) => (
              <OrderCard key={o.id} order={o} selected={selectedId === o.id} checked={selection.includes(o.id)} busy={queueLocked} onSelect={toggleOrder} onAction={(row,action)=>void runActions([row],action)} />
            ))
          ) : (
            <Panel>
              <Empty
                title={
                  hasFilters ? "ไม่พบออเดอร์ที่ตรงกัน" : "ยังไม่มีออเดอร์"
                }
                text="ลองเปลี่ยนตัวกรองหรือคำค้นหา"
              >
                {hasFilters && (
                  <button className="secondary" onClick={() => filter(emptyFilters)}>
                    ล้างตัวกรอง
                  </button>
                )}
              </Empty>
            </Panel>
          )}
        </div>
      ) : null}
      <div className="pagination">
        {cursor && (
          <button className="secondary" onClick={() => setCursor("")}>
            กลับหน้าแรก
          </button>
        )}
        {data?.next_cursor && (
          <button
            className="secondary"
            onClick={() => setCursor(data.next_cursor)}
          >
            รายการถัดไป
          </button>
        )}
      </div>
      {!desktop&&statusFilter}
      {!desktop&&batchControls}
    </div>
  );
}
interface OrderDetailProps {
  readonly id: string;
  readonly back?: string;
  readonly showHistory?: boolean;
  readonly desktop?: boolean;
}
export function OrderDetail({
  id,
  back = "/orders",
  showHistory = false,
  desktop = false,
}: Readonly<OrderDetailProps>) {
  const {
    data: o,
    error,
    loading,
  } = useResource("/orders/" + encodeURIComponent(id));
  const [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState("");
  const [copiedUid,setCopiedUid]=useState("");
  const [slipOpen,setSlipOpen]=useState(false);
  const actionLock=useRef(false);
  const actionRequest=useRef<{signature:string;key:string}|null>(null);
  const history = useRef<HTMLDivElement>(null);
  const loaded=Boolean(o);
  useEffect(()=>{
    if(loaded&&showHistory){
      history.current?.scrollIntoView({block:"center"});
      history.current?.focus({preventScroll:true});
    }
  },[id,loaded,showHistory]);
  async function act(action:string,slipIssue?:SlipIssueDraft) {
    if (!o||loading||error||actionLock.current||!o.allowed_actions.includes(action)) return false;
    actionLock.current=true;
    setBusy(true);
    try {
      if (["complete", "refund", "cancel", "reopen"].includes(action)&&
          !(await confirmAction(
            `${actions[action]}\nออเดอร์ ${shortId(o.id)} · ${o.customer?.username ?? "ลูกค้า"}\n${o.details.name}\n${action === "refund" ? "ยืนยันว่าได้คืนเงินจริงแล้ว ระบบนี้บันทึกสถานะเท่านั้น" : "ตรวจข้อมูลแล้วดำเนินการใช่ไหม?"}`,
          ))) return false;
      setActionError("");
      const input={action,expected_revision:o.revision,slip_issue:slipIssue};
      const signature=JSON.stringify(input);
      const previous=actionRequest.current;
      const request=previous?.signature===signature?previous:{signature,key:key()};
      actionRequest.current=request;
      await api("/orders/" + encodeURIComponent(id) + "/actions", "POST", {
        ...input,
        idempotency_key: request.key,
      });
      actionRequest.current=null;
      await refreshAndWait();
      return true;
    } catch (e) {
      setActionError((e as Error).message);
      return false;
    } finally {
      actionLock.current=false;
      setBusy(false);
    }
  }
  if (loading && !o) return <Loading />;
  if (!o) return <ReadNotice error={error}/>;
  const d = o.details,
    i = o.internal;
  const uid=d.player?.UID??d.player?.["Player ID"];
  const latestCustomerMessage=o.latest_customer_message;
  const grossProfit=o.cost_usd!=null&&d.price_usd!=null?Number(d.price_usd)-Number(o.cost_usd):NaN;
  const slipState=<span className="stitch-payment-state" data-verified={o.payment_verified}>{o.payment_verified?<CheckCircle2 size={15}/>:<ReceiptText size={15}/>} {o.payment_verified?'ยืนยันรับเงินแล้ว':'ยังไม่ยืนยัน'}</span>;
  const orderActions=<OrderActions status={o.status} allowed={o.allowed_actions} busy={busy||loading||!!error} onAction={action=>{
    if(action==='issue'&&o.status==='payment_review'&&!o.payment_verified){setActionError('');setSlipOpen(true);}
    else void act(action);
  }}/>;
  return (
    <div className="stitch-order-detail">
      {desktop?<header className="order-inspector-header">
        <div><h1><span className="sr-only">รายละเอียดออเดอร์ </span>#{shortId(id)}</h1><Status value={o.status}/></div>
        <button className="quiet icon-button" aria-label="ย้อนกลับ" title="ปิดรายละเอียดออเดอร์" onClick={()=>navigate(back)}><X size={19}/></button>
        <time dateTime={o.created_at}>สร้างเมื่อ {dateTime(o.created_at)}</time>
      </header>:<>
        <PageHeader back={back} backIcon="chevron_left" title="รายละเอียดออเดอร์"/>
        <div className="stitch-detail-meta"><strong>#{shortId(id)}</strong><Status value={o.status}/><time dateTime={o.created_at}>{dateTime(o.created_at)}</time></div>
        <div className="stitch-detail-amount"><span>ยอดรวมที่ต้องชำระ</span><strong>{dollars(d.price_usd)} <small>USD</small></strong></div>
      </>}
      {error?<ReadNotice error={error} cached/>:<ErrorBox message={slipOpen?'':actionError}/>}
      {desktop&&<section className="order-inspector-action"><h2>การดำเนินการ</h2>{orderActions}</section>}
      {d.mock && (
        <div className="notice">
          🧪 ออเดอร์ทดสอบ ไม่ต้องโอนเงินจริงหรือเติมเกมจริง
        </div>
      )}
      <div className="detail-grid">
        <div>
          <h2 className="stitch-detail-section-title">ข้อมูลสำหรับเติมเกม</h2>
          <Panel>
            <div className="detail-game">
              <GameMark gameId={d.game_id} />
              <div>
                <small>เกมเป้าหมาย</small>
                <strong>{gameName(d.game_id)}</strong>
              </div>
              {d.zone&&<span className="stitch-detail-zone">{d.zone.toUpperCase()}</span>}
            </div>
            <dl className="facts">
              <div><dt>แพ็กเกจ</dt><dd>{displayText(d.name)}</dd></div>
              <div className="stitch-detail-uid-row">
                <dt>UID / Player ID</dt>
                <dd className="stitch-detail-uid"><span className="selectable">{uid??"—"}</span>{uid&&<button className="secondary" aria-label="คัดลอก UID" onClick={async()=>{
                  try {await navigator.clipboard.writeText(String(uid));setCopiedUid("คัดลอก UID แล้ว");}
                  catch {setCopiedUid("คัดลอกไม่สำเร็จ");}
                }}><StitchIcon name="content_copy" size={14}/>คัดลอก</button>}</dd>
              </div>
              {d.player?.["Zone ID"] && (
                <div>
                  <dt>Zone ID</dt>
                  <dd>{d.player["Zone ID"]}</dd>
                </div>
              )}
              <div>
                <dt>ชื่อลูกค้า</dt>
                <dd>{o.customer?.username ?? "—"}</dd>
              </div>
              <div>
                <dt>ผู้รับงาน</dt>
                <dd>
                  {o.assigned_admin_id ? "เจ้าของร้าน" : "ยังไม่มีผู้รับงาน"}
                </dd>
              </div>
            </dl>
            {copiedUid&&<p className="copy-feedback" role="status">{copiedUid}</p>}
          </Panel>
        </div>
        <div>
          <div className="order-inspector-section-head"><h2 className="stitch-detail-section-title">การตรวจสอบหลักฐานชำระเงิน</h2>{slipState}</div>
          {o.slip_issue&&<div className="notice slip-issue-summary"><strong>{slipIssueLabel(o.slip_issue.reason)}</strong><p>{o.slip_issue.customer_message}</p></div>}
          <Panel>
            {o.receipts.length ? (
              o.receipts.map((r: Row) => <Receipt key={r.id} receipt={r} />)
            ) : (
              <Empty
                title="ยังไม่มีสลิป"
                text="รอลูกค้าแนบหลักฐานการชำระเงิน"
              />
            )}
          </Panel>
        </div>
        <div>
          <h2 className="stitch-detail-section-title">ต้นทุนและผลกำไร</h2>
          <Panel>
            <dl className="facts">
              <div><dt>ราคาขาย</dt><dd>{dollars(d.price_usd)} USD</dd></div>
              <div>
                <dt>ต้นทุนซัพพลายเออร์</dt>
                <dd>
                  {o.cost_usd!=null?dollars(o.cost_usd):Number.isFinite(i.cost_lak)
                    ? Number(i.cost_lak).toLocaleString("en-US") + " LAK"
                    : "—"}
                </dd>
              </div>
              {Number.isFinite(grossProfit)&&<div className="stitch-detail-profit"><dt>กำไรขั้นต้นโดยประมาณ</dt><dd data-loss={grossProfit<0}>{grossProfit<0?'−':'+'}{dollars(Math.abs(grossProfit).toFixed(2))}</dd></div>}
            </dl>
            <details className="stitch-cost-breakdown">
              <summary>เรทและร้านต้นทาง</summary>
              <dl className="facts">
                <div><dt>ร้านต้นทาง</dt><dd>{displayText(i.source_id)}</dd></div>
                <div><dt>เรทตอนสั่ง</dt><dd>{i.lak_per_usd?Number(i.lak_per_usd).toLocaleString('en-US')+' LAK/USD':'—'}</dd></div>
                <div><dt>บวกจากทุน</dt><dd>{i.markup_bps!==undefined?i.markup_bps/100+'%':'—'}</dd></div>
              </dl>
              {i.source_url&&<a className="text-link" href={i.source_url} target="_blank" rel="noreferrer">เปิดร้านต้นทาง <ExternalLink size={15}/></a>}
            </details>
          </Panel>
        </div>
        {o.customer_id&&<div>
          <h2 className="stitch-detail-section-title">ข้อความล่าสุดจากลูกค้า</h2>
          <Panel>
            {latestCustomerMessage?<div className="stitch-detail-chat-preview">
              <span className="avatar" aria-hidden="true">{o.customer?.username?.slice(0,2).toUpperCase()??'—'}</span>
              <div><p>{latestCustomerMessage.text}</p><time dateTime={latestCustomerMessage.created_at}>{dateTime(latestCustomerMessage.created_at)}</time></div>
            </div>:<p className="muted small">ยังไม่มีข้อความล่าสุดจากลูกค้า</p>}
            <button className="secondary wide stitch-detail-reply" aria-label="เปิดห้องแชทลูกค้า" onClick={()=>navigate('/chats/'+encodeURIComponent(o.customer_id))}><StitchIcon name="forum" size={17}/>ตอบกลับในห้องแชท</button>
          </Panel>
        </div>}
        <div>
          <h2 className="stitch-detail-section-title">สถานะการดำเนินงาน</h2>
          <Panel>
            <div className="timeline" ref={history} tabIndex={-1}>
              <div><span className="timeline-dot"/><p>สร้างออเดอร์</p><small>{dateTime(o.created_at)}</small></div>
              {o.messages.map((m: Row) => (
                  <div key={m.id}>
                    <span className="timeline-dot" />
                    <p>
                      {m.text.startsWith("Order status: ")
                        ? "เปลี่ยนเป็น " +
                          (statuses[m.text.slice(14)] ?? m.text.slice(14))
                        : m.text}
                    </p>
                    <small>
                      {dateTime(m.created_at)} ·{" "}
                      {m.sender === "system" ? "ระบบ" : "แอดมิน"}
                    </small>
                  </div>
                ))}
            </div>
          </Panel>
        </div>
      </div>
      {!desktop&&orderActions}
      {slipOpen&&<SlipIssueSheet reference={shortId(id)} amount={d.price_usd!=null?dollars(d.price_usd)+' USD':'—'} product={gameName(d.game_id)+' '+displayText(d.name)}
        customer={o.customer?.username} busy={busy} blocked={loading||!!error||o.status!=='payment_review'}
        error={actionError||error} onSubmit={issue=>act('issue',issue)} onClose={()=>{setSlipOpen(false);setActionError('');}}/>}
    </div>
  );
}
