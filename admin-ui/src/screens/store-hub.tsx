import {StitchIcon} from '../components/stitch-icon';
import {useState} from 'react';
import {Globe2,SlidersHorizontal,Database} from 'lucide-react';
import {useResource,navigate,dateTime,refreshAndWait} from '../api';
import {PageHeader,Loading} from '../components';
import {ReadNotice} from '../components/read-notice';

const sections=[
 {title:'สินค้าและต้นทุน',items:[
  {path:'/store/products',symbol:'sports_esports',title:'เกมและแพ็กเกจ',description:'จับคู่แพ็กเกจ ตรวจราคา และเลือกสินค้าที่เปิดขาย'},
  {path:'/store/products?compare=1',symbol:'compare_arrows',title:'เทียบต้นทุนซัพพลายเออร์',description:'เทียบราคาจากร้านที่จับคู่ไว้ในแต่ละแพ็กเกจ'},
  {path:'/store/sources',symbol:'storefront',title:'ร้านซัพพลายเออร์ต้นทาง',description:'เปิด–ปิดร้านที่ใช้ดึงข้อมูลและเทียบราคา'},
  {path:'/store/fx',symbol:'currency_exchange',title:'อัตราแลกเปลี่ยน FX',description:'เรทจาก LFX หรือกำหนดเรทด้วยตัวเอง'},
  {path:'/store/pricing',Icon:SlidersHorizontal,title:'ราคาขายและกำไร',description:'บวกจากทุนเริ่มต้น หรือกำหนดแยกตามแพ็กเกจ'},
  {path:'/store/games',Icon:Globe2,title:'เกมและโซนที่รองรับ',description:'เปิดขายเฉพาะเกมและโซนที่ตรวจสอบแล้ว'},
 ]},
 {title:'ลูกค้าและยอดขาย',items:[
  {path:'/chats',symbol:'groups',title:'ข้อมูลลูกค้าและทุกออเดอร์',description:'เปิดห้องลูกค้า แล้วดูรายละเอียดและประวัติการสั่งซื้อ'},
  {path:'/',symbol:'monitoring',title:'รายงานยอดขายและกำไรขั้นต้น',description:'ดูยอดขาย กำไรขั้นต้น และจำนวนออเดอร์'},
 ]},
 {title:'ระบบและความปลอดภัย',items:[
  {path:'/store/settings',symbol:'send',title:'บัญชีรับเงินและการแจ้งเตือน',description:'คำแนะนำชำระเงิน บัญชีรับโอน และแจ้งเตือนระบบ'},
  {path:'/store/audit',symbol:'history',title:'ประวัติการจัดการร้าน',description:'ตรวจการเปลี่ยนแปลงจากเว็บและ Telegram'},
  {path:'/store/backups',Icon:Database,title:'สำรองข้อมูล',description:'ฐานข้อมูลร้านและหลักฐานชำระเงิน'},
 ]},
] as const;

interface StoreProps {}
interface Supplier {
 id:string;name:string;enabled:boolean;last_success_at:string|null;
 last_run:{status:string;at:string}|null;
}
interface StoreRate {mode:'manual'|'lfx';rate:{lak_per_usd:string;provided_at?:string;fetched_at?:string}|null}
export function Store(_:Readonly<StoreProps>){
 const sources=useResource<{data:Supplier[]}>('/sources'),fx=useResource<StoreRate>('/fx');
 const [refreshing,setRefreshing]=useState(false);
 const enabled=(sources.data?.data??[]).filter(s=>s.enabled),rate=fx.data?.rate;
 const latestSync=enabled.reduce<string|null>((latest,source)=>source.last_success_at&&(!latest||Date.parse(source.last_success_at)>Date.parse(latest))?source.last_success_at:latest,null);
 const running=enabled.filter(source=>source.last_run?.status==='running').length;
 const failed=enabled.filter(source=>source.last_run?.status==='failed').length;
 const allCompleted=enabled.length>0&&enabled.every(source=>source.last_run?.status==='completed');
 const savedAt=rate?.provided_at??rate?.fetched_at;
 const stale=fx.data?.mode==='lfx'&&savedAt&&Date.now()-Date.parse(savedAt)>26*60*60*1000;
 const rateValue=rate?'1 USD = '+Number(rate.lak_per_usd).toLocaleString('en-US',{maximumFractionDigits:6})+' LAK':'';
 const rateLabel=fx.data?.mode==='manual'?'กำหนดเอง':'เรททางการ LFX';
 const rateMode=fx.data?.mode==='manual'?'กำหนดเอง':'LFX อัตโนมัติ';
 async function refreshStore(){setRefreshing(true);try{await refreshAndWait();}finally{setRefreshing(false);}}
 return <div className="stitch-store"><PageHeader title="จัดการร้าน"/>
  <section className="store-summary" aria-label="สถานะซัพพลายเออร์และอัตราแลกเปลี่ยน">
   <div className="store-summary-heading"><span className="window-label"><i aria-hidden="true"/>รอบ 15:00–16:00 UTC+7</span><button className="secondary" disabled={refreshing} onClick={refreshStore}><StitchIcon name="sync" className={refreshing?"spin":undefined}/>รีเฟรชหน้าจอ</button></div>
   <ReadNotice error={sources.error} cached={!!sources.data}/>
   <div className="stitch-store-suppliers"><h2>ซัพพลายเออร์ที่เปิดใช้งาน</h2>
    {sources.loading&&!sources.data?<Loading/>:sources.data?<div><strong>{enabled.length?enabled.map(source=>source.name).join(' · '):'ยังไม่มีร้านเปิดใช้งาน'}</strong>{enabled.length>0&&<span className="store-status-tag" data-tone="success">{enabled.length} ร้าน</span>}</div>:null}
   </div>
   <ReadNotice error={fx.error} cached={!!fx.data}/>
   <div className="store-summary-details">
    <button className={'store-fx-preview'+(stale?' stale':'')} onClick={()=>navigate('/store/fx')}>
     <span className="tile-icon"><StitchIcon name="currency_exchange"/></span>
     <span><small>อัตราแลกเปลี่ยน FX</small><strong>{rateValue||(fx.loading?'กำลังโหลดเรท':fx.error?'อ่านเรทไม่ได้':'ยังไม่มีเรทที่แสดงได้')}</strong>{savedAt&&<small>บันทึกล่าสุด {dateTime(savedAt)}</small>}</span>
     {rate&&<span className="store-status-tag" data-tone={stale?'warning':'blue'}>{stale?'เรทเกิน 26 ชม.':rateLabel}</span>}
    </button>
    {sources.data&&<button className="store-fx-preview store-sync-preview" onClick={()=>navigate('/store/sources')}>
     <span className="tile-icon"><StitchIcon name="cloud_done"/></span><span><small>สถานะการดึงข้อมูลซัพพลายเออร์</small><strong>{latestSync?'ดึงสำเร็จล่าสุด '+dateTime(latestSync):'ยังไม่มีรอบที่ดึงสำเร็จ'}</strong></span>
     {(running>0||failed>0||allCompleted)&&<span className="store-sync-tags">
      {running>0&&<span className="store-status-tag" data-tone="blue">กำลังดึง {running} ร้าน</span>}
      {failed>0&&<span className="store-status-tag" data-tone="warning">ไม่สำเร็จ {failed} ร้าน</span>}
      {allCompleted&&<span className="store-status-tag" data-tone="success">รอบล่าสุดสำเร็จ</span>}
     </span>}
    </button>}
   </div>
  </section>
  {sections.map(section=><section className="store-section" key={section.title}>
   <header><h2>{section.title}</h2><small>{section.items.length} รายการ</small></header>
   <div className="store-menu-list">{section.items.map(item=><button className="store-menu-item" key={item.path} onClick={()=>navigate(item.path)}>
    <span className="tile-icon">{'symbol' in item?<StitchIcon name={item.symbol}/>:<item.Icon size={22} aria-hidden="true"/>}</span>
    <span><strong>{item.title}</strong><small>{item.path==='/store/fx'&&rateValue?rateMode+': '+rateValue:item.description}</small></span><StitchIcon name="chevron_right"/>
   </button>)}</div>
  </section>)}
  <section className="store-admin-summary" aria-label="ข้อมูลผู้ดูแลร้าน"><h2><i aria-hidden="true"/>Squid first Admin</h2><dl><div><dt>สิทธิ์การเข้าถึง</dt><dd>เจ้าของร้าน</dd></div><div><dt>โหมดดำเนินงาน</dt><dd>เติมเกมด้วยมือ</dd></div></dl></section>
 </div>;
}
