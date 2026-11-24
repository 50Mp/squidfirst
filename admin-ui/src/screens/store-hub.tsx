import {Coins,Globe2,Package,Gamepad2,SlidersHorizontal,Settings2,History,Database,ChevronRight,RefreshCw,ShieldCheck,Users} from 'lucide-react';
import {useResource,navigate,dateTime,refreshAll,type Row} from '../api';
import {PageHeader,Loading} from '../components';
import {ReadNotice} from '../components/read-notice';

const sections=[
 {title:'สินค้าและต้นทุน',items:[
  {path:'/store/products',Icon:Package,title:'เกมและแพ็กเกจ',description:'จับคู่แพ็กเกจ ตรวจราคา และเลือกสินค้าที่เปิดขาย'},
  {path:'/store/pricing',Icon:SlidersHorizontal,title:'ราคาขายและกำไร',description:'บวกจากทุนเริ่มต้น หรือกำหนดแยกตามแพ็กเกจ'},
  {path:'/store/sources',Icon:Globe2,title:'ร้านซัพพลายเออร์ต้นทาง',description:'เปิด–ปิดร้านที่ใช้ดึงข้อมูลและเทียบราคา'},
  {path:'/store/fx',Icon:Coins,title:'อัตราแลกเปลี่ยน FX',description:'เรทจาก LFX หรือกำหนดเรทด้วยตัวเอง'},
  {path:'/store/games',Icon:Gamepad2,title:'เกมและโซนที่รองรับ',description:'เปิดขายเฉพาะเกมและโซนที่ตรวจสอบแล้ว'},
 ]},
 {title:'ลูกค้าและการชำระเงิน',items:[
  {path:'/chats',Icon:Users,title:'ข้อมูลลูกค้าและทุกออเดอร์',description:'เปิดห้องลูกค้า แล้วดูรายละเอียดและประวัติการสั่งซื้อ'},
  {path:'/store/settings',Icon:Settings2,title:'บัญชีรับเงินและการแจ้งเตือน',description:'คำแนะนำชำระเงิน บัญชีรับโอน และแจ้งเตือนระบบ'},
 ]},
 {title:'ระบบและความปลอดภัย',items:[
  {path:'/store/audit',Icon:History,title:'ประวัติการจัดการร้าน',description:'ตรวจการเปลี่ยนแปลงจากเว็บและ Telegram'},
  {path:'/store/backups',Icon:Database,title:'สำรองข้อมูล',description:'ฐานข้อมูลร้านและหลักฐานชำระเงิน'},
 ]},
] as const;

interface StoreProps {}
export function Store(_:Readonly<StoreProps>){
 const sources=useResource('/sources'),fx=useResource('/fx');
 const enabled:Row[]=(sources.data?.data??[]).filter((s:Row)=>s.enabled),rate=fx.data?.rate;
 const savedAt=rate?.provided_at??rate?.fetched_at;
 const stale=fx.data?.mode==='lfx'&&savedAt&&Date.now()-Date.parse(savedAt)>26*60*60*1000;
 return <div className="stitch-store"><PageHeader title="จัดการร้าน"/>
  <section className="store-summary">
   <div className="store-summary-heading"><span className="window-label">รอบดึงข้อมูล 15:00–16:00 UTC+7</span><button className="quiet" onClick={refreshAll}><RefreshCw size={16}/>รีเฟรชหน้าจอ</button></div>
   <ReadNotice error={sources.error||fx.error} cached={!!sources.data||!!fx.data}/>
   <div className="stitch-store-suppliers"><span className="tile-icon"><Globe2 size={22}/></span><div><p className="eyebrow">แหล่งซัพพลายเออร์ที่เปิดใช้งาน</p>
   {sources.loading&&!sources.data?<Loading/>:sources.data?<strong>{enabled.length?enabled.map(s=>s.name).join(' · '):'ยังไม่มีร้านเปิดใช้งานสำหรับออเดอร์ใหม่'}</strong>:null}</div></div>
   <button className={'store-fx-preview'+(stale?' stale':'')} onClick={()=>navigate('/store/fx')}><span className="tile-icon"><Coins size={23}/></span><span><small>เรทที่ใช้ขาย · {fx.data?fx.data.mode==='manual'?'กำหนดเอง':'LFX':'กำลังโหลด'}</small><strong>{rate?'1 USD = '+Number(rate.lak_per_usd).toLocaleString('en-US',{maximumFractionDigits:6})+' LAK':'ยังไม่มีเรทที่แสดงได้'}</strong><small>{savedAt?'บันทึกล่าสุด '+dateTime(savedAt):'ตรวจเรทก่อนเปิดขาย'}{stale?' · เรทเกิน 26 ชั่วโมง':''}</small></span><ChevronRight size={18}/></button>
   <p className="small muted">รีเฟรชหน้าจอใช้ข้อมูลที่เก็บแล้ว การดึงจากร้านและ LFX ทำเฉพาะช่วงเวลาที่กำหนด</p>
  </section>
  {sections.map(section=><section className="store-section" key={section.title}><header><h2>{section.title}</h2><small>{section.items.length} รายการ</small></header><div className="store-menu-list">{section.items.map(({path,Icon,title,description})=><button className="store-menu-item" key={path} onClick={()=>navigate(path)}><span className="tile-icon"><Icon size={22}/></span><span><strong>{title}</strong><small>{description}</small></span><ChevronRight size={17}/></button>)}</div></section>)}
  <div className="owner-banner"><ShieldCheck size={24}/><span><strong>เจ้าของร้าน</strong><small>จัดการออเดอร์และแชทได้จากเว็บและ Telegram</small></span></div>
 </div>;
}
