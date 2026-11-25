import { OrderCard } from "../components/order-card";
import { OrderTable } from "../components/order-table";
import { ReadNotice } from "../components/read-notice";
import { Receipt } from "../receipts";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { restoreOrderList } from "../order-navigation";
import { OrderActions } from "../components/order-actions";
import {
  Search,
  AlertCircle,
  Check,
  Copy,
  CircleX,
  Clock3,
  LoaderCircle,
  RefreshCw,
  SquareCheck,
  UserCheck,
  Zap,
  SlidersHorizontal,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
  ReceiptText,
  Send,
} from "lucide-react";
import {
  api,
  useResource,
  navigate,
  statuses,
  actions,
  key,
  refreshAll,
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
  OrderRow,
  Field,
  Toggle,
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
export function Orders({ path, selectedId, desktop=false, toolbar=null }: Readonly<OrdersProps>) {
  const params = new URLSearchParams(path.split("?")[1] ?? "");
  const initialStatus = params.get("status") ?? "";
  const status = Object.hasOwn(statuses, initialStatus) ? initialStatus : "";
  const [search, setSearch] = useState(params.get("search") ?? "");
  const cursor = params.get("cursor") ?? "";
  const restored = useRef(false);
  const query = params.get("search") ?? "";
  const includeMock = params.get("include_mock") !== "false";
  const [selection, setSelection] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [actionError, setActionError] = useState("");
  const { data, error, loading } = useResource(
    "/orders?" +
      new URLSearchParams({
        include_mock: String(includeMock),
        ...(status ? { status } : {}),
        ...(query ? { search: query } : {}),
        ...(cursor ? { cursor } : {}),
      }),
  );
  const rows: Row[] = data?.data ?? [];
  const selected = rows.filter((row) => selection.includes(row.id));
  const counts: Record<string, number> = data?.counts ?? {};
  const allCount = Object.values(counts).reduce((total, count) => total + count, 0);
  const allSelected = rows.length > 0 && selected.length === rows.length;
  const canBatch = (action: string) =>
    selected.length > 0 && selected.every(row => row.status === "payment_review" && row.allowed_actions.includes(action));
  function toggleOrder(id: string) {
    setSelection(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  }
  function toggleAll() {
    setSelection(allSelected?[]:rows.map(row=>row.id));
  }
  async function sync() {
    setSyncing(true);
    try { await refreshAndWait(); }
    finally { setSyncing(false); }
  }
  async function openNextSlip() {
    setActionError("");
    try {
      const next = await api("/orders?status=payment_review&limit=1&include_mock=" + includeMock);
      if (next.data[0]) navigate("/orders/" + encodeURIComponent(next.data[0].id));
      else setActionError("ไม่มีสลิปที่รอตรวจ");
    } catch (error) {
      setActionError((error as Error).message);
    }
  }
  async function runActions(orders: Row[], action: string) {
    if (busy || !orders.length || !orders.every(row => row.allowed_actions.includes(action))) return;
    setBusy(true);
    setActionError("");
    let updated = 0;
    try {
      const target = orders.length === 1 ? "ออเดอร์ #" + shortId(orders[0].id) : orders.length + " ออเดอร์";
      const prompt = action === "approve" ? "ยืนยันว่าตรวจสลิปและได้รับเงินครบแล้วสำหรับ " : actions[action] + " ";
      if (!(await confirmAction(prompt + target + "?"))) return;
      for (const row of orders) {
        await api("/orders/" + encodeURIComponent(row.id) + "/actions", "POST", {
          action, idempotency_key: key(), expected_revision: row.revision,
        });
        updated++;
        setSelection(current => current.filter(id => id !== row.id));
      }
    } catch (error) {
      setActionError((updated ? "ดำเนินการแล้ว " + updated + " รายการ · " : "") + (error as Error).message);
    } finally {
      if (updated) await refreshAndWait();
      setBusy(false);
    }
  }
  function filter(value: string, term = query, mock = includeMock) {
    navigate(
      "/orders?" +
        new URLSearchParams({
          include_mock: String(mock),
          ...(value ? { status: value } : {}),
          ...(term ? { search: term } : {}),
        }),
    );
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
    <select aria-label="กรองสถานะ" value={status} onChange={e=>filter(e.target.value)}>
      <option value="">ทุกสถานะ</option>
      {Object.entries(statuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </select>
    <Toggle label="รวมรายการทดสอบ" checked={includeMock} onChange={value=>filter(status,query,value)}/>
  </div>;
  const desktopMetrics=[
    ["","ออเดอร์ทั้งหมด",ReceiptText],
    ["awaiting_payment","รอชำระเงิน",Clock3],
    ["paid","รอรับงาน",UserCheck],
    ["processing","กำลังเติม",LoaderCircle],
    ["completed","เติมสำเร็จ",CheckCircle2],
    ["issue","พบปัญหา",AlertCircle],
  ] as const;
  const header=<>
      <PageHeader
        title="ออเดอร์และการจัดส่ง"
        subtitle="จัดการคำสั่งซื้อ เติมเงินเกม และตรวจสอบสลิป"
      >
        <button className="secondary stitch-order-sync" disabled={syncing} onClick={sync}><RefreshCw size={16} className={syncing ? "spin" : undefined}/>ซิงค์</button>
      </PageHeader>
      {desktop&&<div className="desktop-order-metrics" aria-label="สรุปสถานะออเดอร์">
        {desktopMetrics.map(([value,label,Icon])=><button key={value} aria-pressed={status===value} onClick={()=>filter(value)}>
          <span>{label}<Icon size={17}/></span>
          <strong>{data?.counts?(value?counts[value]??0:allCount):'—'}</strong>
          {value==='awaiting_payment'&&<small>หมดอายุใน 15 นาที</small>}
        </button>)}
      </div>}
      {desktop&&<div className="desktop-order-queues">
        <button onClick={()=>filter('payment_review')}><ReceiptText size={16}/><b>{counts.payment_review??0}</b> สลิปรอตรวจ</button>
        <button onClick={()=>filter('paid')}><UserCheck size={16}/><b>{counts.paid??0}</b> รอรับงาน</button>
        <button onClick={()=>filter('issue')}><AlertCircle size={16}/><b>{counts.issue??0}</b> พบปัญหา</button>
        <button disabled={busy||!counts.payment_review} onClick={openNextSlip}><Zap size={16}/>เปิดสลิปถัดไป</button>
      </div>}
      <div className={desktop?"desktop-order-filters":undefined}>
      <form
        className="search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          filter(status, search);
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
      {desktop?statusFilter:<div className="filter-chips" aria-label="ตัวกรองด่วน">
        {orderFilters.map(([value, label, Icon]) => (
          <button
            key={value}
            data-order-status={value}
            aria-pressed={status === value}
            onClick={() => filter(value)}
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
      {loading && !data ? (
        <Loading />
      ) : desktop&&rows.length>0 ? (
        <OrderTable rows={rows} total={data?.counts?(status?counts[status]??0:allCount):undefined} activeId={selectedId} selection={selection} busy={busy||!!error} onToggle={toggleOrder} onToggleAll={toggleAll}/>
      ) : data ? (
        <div className="order-card-list">
          {data.data.length ? (
            data.data.map((o: Row) => (
              <OrderCard key={o.id} order={o} selected={selectedId === o.id} checked={selection.includes(o.id)} busy={busy||!!error} onSelect={toggleOrder} onAction={(row,action)=>void runActions([row],action)} />
            ))
          ) : (
            <Panel>
              <Empty
                title={
                  query || status ? "ไม่พบออเดอร์ที่ตรงกัน" : "ยังไม่มีออเดอร์"
                }
                text="ลองเปลี่ยนตัวกรองหรือคำค้นหา"
              >
                {(query || status) && (
                  <button className="secondary" onClick={() => filter("", "")}>
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
      {desktop&&selected.length>0&&<div className="desktop-order-selection">
        <span><Check size={18}/> เลือกแล้ว {selected.length} รายการ</span>
        <button disabled={busy} onClick={()=>setSelection([])}>ล้างการเลือก</button>
      </div>}
      {(!desktop||selected.length>0)&&<div className="stitch-batch" aria-label="ดำเนินการหลายออเดอร์">
        <button className="stitch-scan" disabled={busy||!counts.payment_review} onClick={openNextSlip}><Zap size={20}/><span>สแกนสลิปถัดไป<small>{counts.payment_review??0} รอตรวจ</small></span></button>
        <button disabled={busy||!!error||!canBatch("approve")} onClick={()=>void runActions(selected,"approve")}><Check size={18}/>อนุมัติกลุ่ม ({selected.length})</button>
        <button disabled={busy||!!error||!canBatch("cancel")} onClick={()=>void runActions(selected,"cancel")}><CircleX size={17}/>ปฏิเสธ</button>
      </div>}
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
  const history = useRef<HTMLDivElement>(null);
  const loaded=Boolean(o);
  useEffect(()=>{
    if(loaded&&showHistory){
      history.current?.scrollIntoView({block:"center"});
      history.current?.focus({preventScroll:true});
    }
  },[id,loaded,showHistory]);
  async function act(action: string) {
    if (!o) return;
    if (
      ["complete", "refund", "cancel", "reopen"].includes(action) &&
      !(await confirmAction(
        `${actions[action]}\nออเดอร์ ${shortId(o.id)} · ${o.customer?.username ?? "ลูกค้า"}\n${o.details.name}\n${action === "refund" ? "ยืนยันว่าได้คืนเงินจริงแล้ว ระบบนี้บันทึกสถานะเท่านั้น" : "ตรวจข้อมูลแล้วดำเนินการใช่ไหม?"}`,
      ))
    )
      return;
    setBusy(true);
    setActionError("");
    try {
      await api("/orders/" + id + "/actions", "POST", {
        action,
        idempotency_key: key(),
        expected_revision: o.revision,
      });
      refreshAll();
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (loading && !o) return <Loading />;
  if (!o) return <ErrorBox message={error} />;
  const d = o.details,
    i = o.internal;
  const uid=d.player?.UID??d.player?.["Player ID"];
  const orderActions=<OrderActions status={o.status} allowed={o.allowed_actions} busy={busy} onAction={act}/>;
  return (
    <div className="stitch-order-detail">
      <PageHeader
        back={back}
        title="รายละเอียดออเดอร์"
      />
      <div className="stitch-detail-card">
        <div className="stitch-detail-header-row">
          <div className="stitch-detail-id">#SQ-{shortId(id)}</div>
          <Status value={o.status}/>
        </div>
        <div className="stitch-detail-time">{dateTime(o.created_at)}</div>
        <div className="stitch-detail-channel">
          <span style={{display:'flex',alignItems:'center',gap:6}}>
            <Send size={14} style={{color:'var(--sf-primary)'}}/>
            <span>ช่องทาง: <strong>Telegram Mini App</strong> (Storefront Web)</span>
          </span>
          <span className="store-badge primary">v2.4 API</span>
        </div>
      </div>
      <div className="stitch-detail-amount"><span>ยอดรวมที่ต้องชำระ</span><strong>{dollars(d.price_usd)} <small>USD</small></strong></div>
      <ErrorBox message={error || actionError} />
      {desktop&&orderActions}
      {d.mock && (
        <div className="notice">
          🧪 ออเดอร์ทดสอบ ไม่ต้องโอนเงินจริงหรือเติมเกมจริง
        </div>
      )}
      <div className="detail-grid">
        <div>
          <Panel title="ข้อมูลการเติมเกม">
            {o.customer?.username && (
              <div className="stitch-detail-customer-header">
                <div className="stitch-detail-customer-info">
                  <div className="stitch-detail-customer-avatar">
                    {o.customer.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <strong style={{fontSize: 15, display: 'block'}}>{o.customer.username}</strong>
                    <span style={{fontSize: 12, color: 'var(--sf-text-secondary)'}}>ลูกค้าประจำ</span>
                  </div>
                </div>
                <span className="store-badge success">VIP Member</span>
              </div>
            )}
            <div className="detail-game">
              <GameMark gameId={d.game_id} />
              <div>
                <h2>{gameName(d.game_id)}</h2>
                <p>{displayText(d.name)}</p>
              </div>
            </div>
            <dl className="facts">
              <div>
                <dt>UID / Player ID</dt>
                <dd className="stitch-detail-uid"><span className="selectable">{uid??"—"}</span>{uid&&<button className="secondary" aria-label="คัดลอก UID" onClick={async()=>{
                  try {await navigator.clipboard.writeText(String(uid));setCopiedUid("คัดลอก UID แล้ว");}
                  catch {setCopiedUid("คัดลอกไม่สำเร็จ");}
                }}><Copy size={14}/>คัดลอก</button>}</dd>
              </div>
              <div>
                <dt>โซนเกม</dt>
                <dd>{d.zone?.toUpperCase()}</dd>
              </div>
              {d.player?.["Zone ID"] && (
                <div>
                  <dt>Zone ID</dt>
                  <dd>{d.player["Zone ID"]}</dd>
                </div>
              )}
              <div>
                <dt>ราคาขาย</dt>
                <dd className="accent">{dollars(d.price_usd)} USD</dd>
              </div>
              <div>
                <dt>การชำระเงิน</dt>
                <dd>
                  {o.payment_verified ? "ยืนยันรับเงินแล้ว" : "ยังไม่ยืนยัน"}
                </dd>
              </div>
              <div>
                <dt>ลูกค้า</dt>
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
            {o.customer_id && (
              <button
                className="secondary wide"
                onClick={() => navigate("/chats/" + o.customer_id)}
              >
                <MessageSquare size={17} />
                เปิดห้องแชทลูกค้า
              </button>
            )}
          </Panel>
        </div>
        <div>
          <Panel title="สลิปชำระเงิน" aside={<ReceiptText size={19} />}>
            <p className="muted small">
              ตรวจชื่อผู้รับ ยอดเงิน และรายการซ้ำก่อนยืนยันรับเงิน
            </p>
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
          <Panel title="ข้อมูลต้นทุน · เฉพาะแอดมิน">
            <div className="stitch-financial-grid">
              <div>
                <span>ยอดชำระ</span>
                <strong>{dollars(d.price_usd)}</strong>
              </div>
              <div>
                <span>ต้นทุนส่ง</span>
                <strong>{Number.isFinite(i.cost_lak) ? Number(i.cost_lak).toLocaleString("en-US") + " LAK" : "—"}</strong>
              </div>
              <div>
                <span>มาร์จิ้น</span>
                <strong className="profit">{i.markup_bps !== undefined ? "+" + (i.markup_bps / 100) + "%" : "—"}</strong>
              </div>
            </div>
            <dl className="facts" style={{marginTop: 12}}>
              <div>
                <dt>ร้านต้นทาง</dt>
                <dd>{displayText(i.source_id)}</dd>
              </div>
              <div>
                <dt>ต้นทุน</dt>
                <dd>
                  {Number.isFinite(i.cost_lak)
                    ? Number(i.cost_lak).toLocaleString("en-US") + " LAK"
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>เรทตอนสั่ง</dt>
                <dd>
                  {i.lak_per_usd
                    ? Number(i.lak_per_usd).toLocaleString("en-US") + " LAK/USD"
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>บวกจากทุน</dt>
                <dd>
                  {i.markup_bps !== undefined ? i.markup_bps / 100 + "%" : "—"}
                </dd>
              </div>
            </dl>
            {i.source_url && (
              <a
                className="text-link"
                href={i.source_url}
                target="_blank"
                rel="noreferrer"
              >
                เปิดร้านต้นทาง <ExternalLink size={15} />
              </a>
            )}
          </Panel>
        </div>
        <div>
          <Panel title="ประวัติออเดอร์">
            <div className="timeline" ref={history} tabIndex={-1}>
              {o.messages.length ? (
                o.messages.map((m: Row) => (
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
                ))
              ) : (
                <p className="muted">ยังไม่มีการเปลี่ยนสถานะ</p>
              )}
            </div>
          </Panel>
        </div>
      </div>
      {!desktop&&orderActions}
    </div>
  );
}
