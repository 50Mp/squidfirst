import {Coins,Globe2,Package,ArrowLeftRight,Store as StoreIcon,Users,TrendingUp,Tag,ShieldCheck,Send,History,Database,ChevronRight,RefreshCw,Cloud,Activity} from 'lucide-react';
import {useResource,navigate,dateTime,refreshAll,type Row} from '../api';
import {PageHeader,Loading} from '../components';
import {ReadNotice} from '../components/read-notice';

const sections=[
 {
  title:'สินค้าและต้นทุน',
  count:'4 รายการ',
  items:[
   {path:'/store/products',Icon:Package,title:'เกมและแพ็กเกจ',description:'4 เกม • Free Fire, MLBB, RoV, Roblox'},
   {path:'/store/pricing',Icon:ArrowLeftRight,title:'เทียบต้นทุนซัพพลายเออร์',description:'เทียบราคา Jorjee vs GGXG Real-time'},
   {path:'/store/sources',Icon:StoreIcon,title:'ร้านซัพพลายเออร์ต้นทาง',description:'2 ร้านเชื่อมต่อ • Jorjee ทำงานปกติ 100%'},
   {path:'/store/fx',Icon:Coins,title:'อัตราแลกเปลี่ยน FX',description:'LFX อัตโนมัติ หรือกำหนดเรทด้วยตัวเอง'},
  ]
 },
 {
  title:'ลูกค้าและยอดขาย',
  count:'3 รายการ',
  items:[
   {path:'/chats',Icon:Users,title:'ข้อมูลลูกค้าและ LTV',description:'ค้นหาลูกค้า, ยอดคำสั่งซื้อสะสม, เกรด VIP'},
   {path:'/',Icon:TrendingUp,title:'รายงานร้านและบัญชี',description:'สรุปยอดขาย กำไรขั้นต้น และ P&L รวม'},
   {path:'/store/pricing',Icon:Tag,title:'โปรโมชั่นและแคมเปญ',description:'โค้ดส่วนลดปลอบใจ 5% ใช้งานอยู่',tag:'1 แคมเปญ',tagType:'warning'},
  ]
 },
 {
  title:'ระบบและความปลอดภัย',
  count:'ความปลอดภัยสูง',
  items:[
   {path:'/store/settings',Icon:ShieldCheck,title:'จัดการ Circuit Breaker & ฉุกเฉิน',description:'สถานะ CLOSED ปกติ 100% ปลอดภัย',tag:'สภาวะปกติ',tagType:'success'},
   {path:'/store/settings',Icon:Send,title:'ตั้งค่าการแจ้งเตือน Telegram Bot',description:'บอทแจ้งเตือนออเดอร์และยอดเงินอัตโนมัติ',tag:'เปิดใช้งาน',tagType:'primary'},
   {path:'/store/audit',Icon:History,title:'ประวัติการจัดการร้าน (Audit Log)',description:'บันทึกกิจกรรมแอดมิน คืนเงิน และสิทธิ์'},
  ]
 },
] as const;

interface StoreProps {}
export function Store(_:Readonly<StoreProps>){
 const sources=useResource('/sources'),fx=useResource('/fx');
 const enabled:Row[]=(sources.data?.data??[]).filter((s:Row)=>s.enabled),rate=fx.data?.rate;
 const savedAt=rate?.provided_at??rate?.fetched_at;
 const stale=fx.data?.mode==='lfx'&&savedAt&&Date.now()-Date.parse(savedAt)>26*60*60*1000;
 return <div className="stitch-store"><PageHeader title="จัดการร้าน"/>
  <section className="store-summary">
   <div className="store-summary-heading">
    <span className="window-label"><span className="stitch-urgent-dot" style={{background:'#10b981',marginInlineEnd:6}}/>รอบ 15:00–16:00 UTC+7</span>
    <button className="quiet" onClick={refreshAll}><RefreshCw size={16}/>รีเฟรชหน้าจอ</button>
   </div>
   <ReadNotice error={sources.error||fx.error} cached={!!sources.data||!!fx.data}/>
   <div className="stitch-store-suppliers">
    <span className="tile-icon"><Globe2 size={22}/></span>
    <div>
     <p className="eyebrow">แหล่งซัพพลายเออร์ที่ดึงล่าสุด</p>
     {sources.loading&&!sources.data?<Loading/>:sources.data?(
      <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
       <strong>Jorjee Game Store</strong>
       <span className="store-badge success">หลัก 100%</span>
       <span style={{color:'var(--sf-text-secondary)',fontSize:12}}>&</span>
       <span style={{color:'var(--sf-text-secondary)',fontSize:13}}>GGXG (สแตนด์บาย)</span>
      </div>
     ):null}
    </div>
   </div>

   <button className={'store-sub-metric'+(stale?' stale':'')} onClick={()=>navigate('/store/fx')} type="button">
    <div className="store-sub-metric-info">
     <div className="tile-icon" style={{width:32,height:32,borderRadius:8}}>
      <Coins size={18}/>
     </div>
     <div>
      <div style={{fontSize:11,color:'var(--sf-text-secondary)'}}>LFX อัตราแลกเปลี่ยน</div>
      <div style={{fontSize:14,fontWeight:600,color:'var(--sf-text)'}}>
       {rate?'1 USD = '+Number(rate.lak_per_usd).toLocaleString('en-US',{maximumFractionDigits:2})+' LAK':'ยังไม่มีเรทที่แสดงได้'}
      </div>
     </div>
    </div>
    <span className="store-badge primary">{fx.data?.mode==='manual'?'เรทกำหนดเอง':'เรททางการ LFX'}</span>
   </button>

   <div className="store-sub-metric" style={{cursor:'default'}}>
    <div className="store-sub-metric-info">
     <div className="tile-icon" style={{width:32,height:32,borderRadius:8,background:'#ecfdf5',color:'#059669'}}>
      <Cloud size={18}/>
     </div>
     <div>
      <div style={{fontSize:11,color:'var(--sf-text-secondary)'}}>สถานะบอทตรวจเช็ค</div>
      <div style={{fontSize:13,fontWeight:500,color:'var(--sf-text)'}}>ระบบซัพพลายเออร์ปกติ</div>
     </div>
    </div>
    <div style={{display:'flex',alignItems:'center',gap:4}}>
     <span className="stitch-urgent-dot" style={{background:'#10b981'}}/>
     <span style={{fontSize:11,color:'var(--sf-text-secondary)'}}>320ms</span>
    </div>
   </div>
  </section>

  {sections.map(section=>(
   <section className="store-section" key={section.title}>
    <header>
     <h2>{section.title}</h2>
     <small>{section.count}</small>
    </header>
    <div className="store-menu-list">
     {section.items.map(item=>(
      <button className="store-menu-item" key={item.title} onClick={()=>navigate(item.path)}>
       <span className="tile-icon"><item.Icon size={22}/></span>
       <span>
        <strong>{item.title}</strong>
        <small>{item.description}</small>
       </span>
       {'tag' in item&&(
        <span className={`store-badge ${item.tagType??'primary'}`} style={{marginInlineEnd:4}}>
         {item.tag}
        </span>
       )}
       <ChevronRight size={17}/>
      </button>
     ))}
    </div>
   </section>
  ))}

  <div className="store-engine-footer">
   <div className="store-engine-header">
    <span style={{display:'flex',alignItems:'center',gap:6}}>
     <span className="stitch-urgent-dot" style={{background:'var(--sf-primary)'}}/>
     SQUID FIRST Admin v2.4
    </span>
    <span style={{color:'var(--sf-text-secondary)',fontWeight:400}}>TMA Engine</span>
   </div>
   <div className="store-engine-details">
    <span>แอดมินที่เชื่อมต่อ: เจ้าของร้าน</span>
    <span style={{display:'flex',alignItems:'center',gap:4,color:'#059669'}}>
     <span className="stitch-urgent-dot" style={{background:'#10b981'}}/>
     Safe Auto-Fulfill Active
    </span>
   </div>
  </div>
 </div>;
}
