<<<<<<< HEAD
import {MobileTabIcon} from './components/mobile-tab-icon';
import {OrderWorkspace} from './screens/order-workspace';
=======
﻿import {OrderWorkspace} from './screens/order-workspace';
>>>>>>> 6d236ea247287af2d4678031d3061f7c3b9fd22d
import {orderListPath} from './order-navigation';
import {useNavigationCounts} from './hooks/use-navigation-counts';
import {useWideWorkspace} from './hooks/use-wide-workspace';
import {NavigationCount} from './components/navigation-count';
import {PullToRefresh} from './pull-refresh';
import {Fragment,useEffect,useState} from 'react';
import {LayoutDashboard,ClipboardList,MessagesSquare,SlidersHorizontal,RefreshCw,ShieldCheck,WifiOff,UserRound,Search,Package,Store as StoreIcon,TrendingUp} from 'lucide-react';
import {api,refreshAll,navigate} from './api';import {SquidMark,Loading,ErrorBox} from './components';import {Overview} from './screens/overview';import {Chats,ChatRoom,Customer} from './screens/chats';import {Store,Sources,ExchangeRate} from './screens/store';import {Games,Products,GamePackages,ProductEditor} from './screens/products';import {ShopSettings,Audit,Backups} from './screens/settings';

const tabs=[['/',LayoutDashboard,'ภาพรวม'],['/orders',ClipboardList,'ออเดอร์'],['/chats',MessagesSquare,'แชท'],['/store',SlidersHorizontal,'จัดการร้าน']] as const;
const desktopLinks=[['/store/products',Package,'เกมและแพ็กเกจ'],['/store/sources',StoreIcon,'ซัพพลายเออร์'],['/store/pricing',TrendingUp,'ราคาขายและกำไร']] as const;

function OrderSearch(){
 const [search,setSearch]=useState('');
 return <form className="desktop-global-search" role="search" onSubmit={event=>{
  event.preventDefault();
  const query=search.trim();
  if(query)navigate('/orders?'+new URLSearchParams({search:query}));
 }}><Search size={18} aria-hidden="true"/><input type="search" maxLength={100} aria-label="ค้นหาจากเมนูหลัก" placeholder="ค้นหาเลขออเดอร์, UID, ชื่อผู้เล่น…" value={search} onChange={event=>setSearch(event.target.value)}/></form>;
}
export default function App(){const [session,setSession]=useState<'loading'|'ready'|'locked'>('loading'),[error,setError]=useState(''),[path,setPath]=useState(location.hash.slice(1)||'/'),[online,setOnline]=useState(navigator.onLine),[connected,setConnected]=useState(false);
 useEffect(()=>{let alive=true;const tg=(window as any).Telegram?.WebApp;tg?.ready();tg?.expand();tg?.setHeaderColor?.('#ffffff');tg?.setBackgroundColor?.('#ffffff');const boot=async()=>{try{try{await api('/me');}catch{if(!tg?.initData)throw new Error('เปิดแอปนี้จากปุ่มจัดการร้านใน Telegram ด้วยบัญชีเจ้าของร้าน');await api('/session','POST',{initData:tg.initData});}if(alive)setSession('ready');}catch(e:any){if(alive){setError(e.message);setSession('locked');}}};void boot();const hash=()=>{setPath(location.hash.slice(1)||'/');window.scrollTo(0,0);};const off=()=>setOnline(false),on=()=>{setOnline(true);refreshAll();};window.addEventListener('hashchange',hash);window.addEventListener('offline',off);window.addEventListener('online',on);return()=>{alive=false;window.removeEventListener('hashchange',hash);window.removeEventListener('offline',off);window.removeEventListener('online',on);};},[]);
 useEffect(()=>{if(session!=='ready')return;let stopped=false,cursor='0';const poll=async()=>{if(stopped||document.hidden)return;try{const data=await api('/events?after='+cursor);if(stopped)return;cursor=data.next_cursor;setConnected(true);if(data.data.length)refreshAll();window.dispatchEvent(new Event('admin:navigation-refresh'));}catch{if(!stopped)setConnected(false);}};void poll();const timer=setInterval(poll,4000),foreground=()=>{if(!document.hidden){refreshAll();void poll();}},expired=()=>{setSession('locked');setError('เซสชันหมดอายุ กรุณาปิดแล้วเปิดใหม่จาก Telegram');};document.addEventListener('visibilitychange',foreground);window.addEventListener('admin:unauthorized',expired);return()=>{stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',foreground);window.removeEventListener('admin:unauthorized',expired);};},[session]);
 const navigation=useNavigationCounts(session==='ready');
 const wide=useWideWorkspace();
 if(session!=='ready')return <div className="auth-page"><div className={session==='loading'?'auth-mark auth-mark-loading':'auth-mark'}><SquidMark/></div><h1>Squid first</h1><p>พื้นที่จัดการร้าน</p>{session==='loading'?<Loading/>:<><ShieldCheck size={28}/><ErrorBox message={error}/><p className="footnote">เฉพาะบัญชีแอดมินที่ได้รับสิทธิ์</p></>}</div>;
 const [pathname,query]=path.split('?');
<<<<<<< HEAD
 const compareCatalog=new URLSearchParams(query).get('compare')==='1';
 const parts=pathname.split('/').filter(Boolean),catalogGame=new URLSearchParams(query).get('game')??'';let screen;if(parts[0]==='orders')screen=<OrderWorkspace path={path} orderId={parts[1]}/>;else if(parts[0]==='chats')screen=parts[1]?<ChatRoom key={parts[1]} id={parts[1]}/>:<Chats/>;else if(parts[0]==='customers'&&parts[1])screen=<Customer key={parts[1]} id={parts[1]}/>;else if(parts[0]==='store'){switch(parts[1]){case'sources':screen=<Sources/>;break;case'fx':screen=<ExchangeRate/>;break;case'games':screen=<Games/>;break;case'products':screen=parts[2]?<ProductEditor key={path} id={parts[2]==='new'?undefined:parts[2]} initialGame={catalogGame}/>:catalogGame?<GamePackages key={catalogGame} game={catalogGame} compare={compareCatalog}/>:<Products compare={compareCatalog}/>;break;case'pricing':screen=<ShopSettings pricing/>;break;case'settings':screen=<ShopSettings/>;break;case'audit':screen=<Audit search={query}/>;break;case'backups':screen=<Backups/>;break;default:screen=<Store/>;}}else screen=<Overview unreadChatRooms={navigation.counts?.unread_chat_rooms??null} staleChatCount={navigation.stale||!online||!connected}/>;
 const demo=['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).get('design_preview')==='1';
 const overviewMode=parts.length===0,chatMode=parts[0]==='chats'&&Boolean(parts[1]);
 const storeDetail=parts[0]==='store'&&['fx','audit'].includes(parts[1]);
 const healthy=online&&connected;
 const connectionLabel=healthy?'ระบบปกติ':online?'กำลังเชื่อมต่อ':'ออฟไลน์';
 const currentDesktopLink=desktopLinks.find(([url])=>pathname===url||pathname.startsWith(url+'/'))?.[0];
 const desktopLink=([url,Icon,label]:(typeof desktopLinks)[number])=><a key={url} className="desktop-nav-link" href={'#'+url} aria-current={currentDesktopLink===url?'page':undefined}><Icon size={19}/>{label}</a>;
 return <div className={'app-shell'+(chatMode?' chat-mode':'')+(parts[0]==='orders'?' order-mode':'')+(overviewMode?' overview-mode':'')+(storeDetail?' store-detail-shell':'')}>
  <PullToRefresh key={path}/>
  <aside className="sidebar">
   <button className="brand" onClick={()=>navigate('/')}><SquidMark/><span>Squid first<small>Operations Portal</small></span></button>
   <nav aria-label="เมนูหลัก">
    <p className="desktop-nav-group">งานหลัก</p>
    {tabs.map(([url,Icon,label])=><Fragment key={url}>
     {url==='/chats'&&<><p className="desktop-nav-group">ซัพพลายเออร์และลูกค้า</p>{desktopLinks.slice(1).map(desktopLink)}</>}
     {url==='/store'&&<p className="desktop-nav-group">ระบบและการตั้งค่า</p>}
     <button aria-label={label} aria-current={(!wide||!currentDesktopLink)&&(url==='/'?pathname==='/':pathname.startsWith(url)||(url==='/chats'&&pathname.startsWith('/customers')))?'page':undefined} aria-describedby={url==='/orders'?'nav-count-orders':url==='/chats'?'nav-count-chats':undefined} onClick={()=>navigate(url==='/orders'?orderListPath():url)}>
      {wide?<Icon size={21}/>:<MobileTabIcon route={url}/>}<span>{label}</span>{url==='/orders'?<NavigationCount kind="orders" count={navigation.counts?.pending_review_orders??null} stale={navigation.stale||!healthy}/>:url==='/chats'?<NavigationCount kind="chats" count={navigation.counts?.unread_chat_rooms??null} stale={navigation.stale||!healthy}/>:null}
     </button>
     {url==='/orders'&&desktopLink(desktopLinks[0])}
    </Fragment>)}
   </nav>
   <div className="sidebar-footer"><ShieldCheck size={17}/><span>ระบบร้าน<small>{connectionLabel}</small></span></div>
  </aside>
  <div className="main-wrap">
   <div className="topbar">
    <button className="mobile-brand" aria-label="กลับหน้าภาพรวม" onClick={()=>navigate('/')}><span className="app-monogram"><SquidMark/></span><span><strong>{parts[0]==='orders'?'ออเดอร์':parts[0]==='chats'||parts[0]==='customers'?'แชทลูกค้า':parts[0]==='store'?'จัดการร้าน':'ภาพรวม'}</strong><small>Squid first</small></span></button>
    <OrderSearch/>
    <span className={'connection '+(demo?'design-preview-label ':'')+(healthy?'online':'offline')}>{demo?'พรีวิวข้อมูลจำลอง':connectionLabel}</span>
    <span className="desktop-currency">USD</span>
    <button className="quiet icon-button" aria-label="รีเฟรชข้อมูล" onClick={refreshAll}><RefreshCw size={17}/></button>
    <span className="admin-avatar" aria-label="บัญชีแอดมิน"><UserRound size={20} aria-hidden="true"/></span><span className="desktop-owner">เจ้าของร้าน</span>
   </div>
   {!online&&<div className="offline-banner"><WifiOff size={16}/>ออฟไลน์ ข้อมูลที่แสดงอาจยังไม่อัปเดต</div>}
   <main key={parts[0]}>{screen}</main>
   <footer className="app-footer">Squid first · Admin workspace <span>UTC+7</span></footer>
  </div>
 </div>;
=======
 const parts=pathname.split('/').filter(Boolean),catalogGame=new URLSearchParams(query).get('game')??'';let screen;if(parts[0]==='orders')screen=<OrderWorkspace path={path} orderId={parts[1]}/>;else if(parts[0]==='chats')screen=parts[1]?<ChatRoom key={parts[1]} id={parts[1]}/>:<Chats/>;else if(parts[0]==='customers'&&parts[1])screen=<Customer key={parts[1]} id={parts[1]}/>;else if(parts[0]==='store'){switch(parts[1]){case'sources':screen=<Sources/>;break;case'fx':screen=<ExchangeRate/>;break;case'games':screen=<Games/>;break;case'products':screen=parts[2]?<ProductEditor key={path} id={parts[2]==='new'?undefined:parts[2]} initialGame={catalogGame}/>:catalogGame?<GamePackages key={catalogGame} game={catalogGame}/>:<Products/>;break;case'pricing':screen=<ShopSettings pricing/>;break;case'settings':screen=<ShopSettings/>;break;case'audit':screen=<Audit/>;break;case'backups':screen=<Backups/>;break;default:screen=<Store/>;}}else screen=<Overview/>;
 const demo=['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).get('design_preview')==='1';const overviewMode=parts.length===0;const chatMode=parts[0]==="chats"&&Boolean(parts[1]);
 // Determine mobile back destination: sub-pages go back to their section root
 let mobileBackTarget:string|null=null;if(parts[0]==='orders'&&parts[1])mobileBackTarget=orderListPath();else if(parts[0]==='customers'&&parts[1])mobileBackTarget='/chats';else if(parts[0]==='store'&&parts[2]){const gp=catalogGame?'?game='+encodeURIComponent(catalogGame):'';mobileBackTarget='/store/products'+gp;}else if(parts[0]==='store'&&parts[1])mobileBackTarget='/store';
 const tabs=[['/',LayoutDashboard,'ภาพรวม'],['/orders',ClipboardList,'ออเดอร์'],['/chats',MessagesSquare,'แชท'],['/store',SlidersHorizontal,'จัดการร้าน']] as const;return <div className={"app-shell"+(chatMode?" chat-mode":"")+(parts[0]==='orders'?" order-mode":"")+(overviewMode?" overview-mode":"")}><PullToRefresh key={path}/><aside className="sidebar"><button className="brand" onClick={()=>navigate('/')}><SquidMark/><span>Squid first<small>ADMIN WORKSPACE</small></span></button><nav aria-label="เมนูหลัก">{tabs.map(([url,Icon,label])=><button key={url} aria-label={label} aria-current={(url==='/'?path.split('?')[0]==='/':path.startsWith(url)||(url==='/chats'&&path.startsWith('/customers')))?'page':undefined} aria-describedby={url==='/orders'?'nav-count-orders':url==='/chats'?'nav-count-chats':undefined} onClick={()=>navigate(url==='/orders'?orderListPath():url)}><Icon size={21}/><span>{label}</span>{url==='/orders'?<NavigationCount kind="orders" count={navigation.counts?.pending_review_orders??null} stale={navigation.stale||!online||!connected}/>:url==='/chats'?<NavigationCount kind="chats" count={navigation.counts?.unread_chat_rooms??null} stale={navigation.stale||!online||!connected}/>:null}</button>)}</nav><div className="sidebar-footer"><ShieldCheck size={17}/><span>เจ้าของร้าน<small>Squid first admin</small></span></div></aside><div className="main-wrap"><div className="topbar">{mobileBackTarget?<button className="mobile-back-btn" aria-label="ย้อนกลับ" onClick={()=>navigate(mobileBackTarget)}><svg width="10" height="17" viewBox="0 0 10 17" fill="none" aria-hidden="true"><path d="M9 1L1 8.5L9 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>:null}<button className="mobile-brand" aria-label="กลับหน้าภาพรวม" onClick={()=>navigate('/')}><span className="app-monogram">SQ</span><span><strong>{parts[0]==='orders'?'ออเดอร์':parts[0]==='chats'||parts[0]==='customers'?'แชทลูกค้า':parts[0]==='store'?'จัดการร้าน':'ภาพรวม'}</strong><small>Squid first</small></span></button><span className={'connection '+(demo?'design-preview-label ':'')+(online&&connected?'online':'offline')}>{demo?'พรีวิวข้อมูลจำลอง':online&&connected?(overviewMode?'ระบบปกติ':'ข้อมูลเชื่อมต่ออยู่'):online?'กำลังเชื่อมต่อ':'ออฟไลน์'}</span><button className="quiet icon-button" aria-label="รีเฟรชข้อมูล" onClick={refreshAll}><RefreshCw size={17}/></button><span className="admin-avatar" aria-label="บัญชีแอดมิน">{(parts[0]==='orders'||overviewMode)?<UserRound size={22}/>:"SQ"}</span></div>{!online&&<div className="offline-banner"><WifiOff size={16}/>ออฟไลน์ ข้อมูลที่แสดงอาจยังไม่อัปเดต</div>}<main key={parts[0]}>{screen}</main><footer className="app-footer">Squid first · Admin workspace <span>UTC+7</span></footer></div></div>;
>>>>>>> 6d236ea247287af2d4678031d3061f7c3b9fd22d
}
