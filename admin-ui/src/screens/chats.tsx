import {StitchIcon} from '../components/stitch-icon';
import {ChatMessageMode} from '../components/chat-message-mode';
import {ProfileNote} from '../components/profile-note';
import {ReadNotice} from '../components/read-notice';
import {ChatIssueContext} from '../components/chat-issue-context';
import {Chats as ChatList} from './chat-list';
import {useWideWorkspace} from '../hooks/use-wide-workspace';
import {Receipt} from '../receipts';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';import {ChevronLeft,Copy,Gamepad2,MessageSquare,ReceiptText,Search,UserRound,ArrowLeft,ChevronRight,RefreshCw,Zap} from 'lucide-react';
import {api,useResource,navigate,dateTime,dollars,gameName,key,shortId,refreshAll,joinRefresh,type Row} from '../api';import {Panel,ErrorBox,Loading,Empty,OrderRow} from '../components';
type ChatVisibility='public'|'internal';
interface SelectedFile {readonly file:File;readonly mime:string}
interface PendingMessage {readonly fingerprint:string;readonly key:string;readonly attachment?:SelectedFile}
const drafts=new Map<string,{text:string;visibility:ChatVisibility;pending:PendingMessage|null;attachment?:SelectedFile}>();
const attachmentTypes:Record<string,string>={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',pdf:'application/pdf'};
const quickReplies=['กำลังตรวจสอบ','เริ่มเติมแล้ว','ขอข้อมูลเพิ่ม'] as const;
function encodeAttachment({file,mime}:SelectedFile){
 return new Promise<{name:string;mime:string;data:string}>((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve({name:file.name,mime,data:String(reader.result).split(',')[1]});
  reader.onerror=()=>reject(reader.error);
  reader.readAsDataURL(file);
 });
}
function SupportDeskHeader({active=false}:Readonly<{active?:boolean}>){
 const Heading=active?'h2':'h1';
 return <header className="support-desk-header">
  <div><p>ฝ่ายบริการลูกค้า <ChevronRight size={14} aria-hidden="true"/> แชทสดและการสนับสนุน</p><Heading>ระบบแชทสดและศูนย์บริการลูกค้า</Heading></div>
  <button className="secondary" onClick={refreshAll}><RefreshCw size={16}/>รีเฟรชคิว</button>
 </header>;
}
export function Chats(){
 const wide=useWideWorkspace();
 if(!wide)return <ChatList/>;
 return <section className="support-desk-screen support-desk-home">
  <SupportDeskHeader/>
  <div className="support-desk">
   <aside className="support-desk-queue" aria-label="คิวแชทลูกค้า"><ChatList embedded/></aside>
   <div className="support-desk-empty"><Empty title="เลือกห้องสนทนา" text="เลือกห้องจากคิวเพื่อดูข้อความและตอบลูกค้า"/></div>
   <aside className="support-desk-customer" aria-label="ข้อมูลลูกค้า"><h2>ข้อมูลลูกค้า</h2><p className="muted small">แสดงเมื่อเลือกห้องสนทนา</p></aside>
  </div>
 </section>;
}
export function ChatRoom({id}:{id:string}){
 const [sendError,setSendError]=useState('');
 const [attachment,setAttachment]=useState(()=>drafts.get(id)?.attachment);
 const attachmentInput=useRef<HTMLInputElement>(null);
 const wide=useWideWorkspace();
 const viewportFrame=useRef<HTMLElement>(null);const profile=useResource('/customers/'+id),[loading,setLoading]=useState(true),[messages,setMessages]=useState<Row[]>([]),[draft,setDraft]=useState(drafts.get(id)?.text??''),[visibility,setVisibility]=useState<ChatVisibility>(drafts.get(id)?.visibility??'public'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[older,setOlder]=useState(true),scroller=useRef<HTMLDivElement>(null),sending=useRef(false),pendingMessage=useRef<PendingMessage|null>(drafts.get(id)?.pending??null);
 const [loadingOlder,setLoadingOlder]=useState(false);
 const olderRequest=useRef<AbortController|null>(null);
 const olderAnchor=useRef<{entry:HTMLElement;offset:number}|null>(null);
 useEffect(()=>()=>olderRequest.current?.abort(),[]);
 useLayoutEffect(()=>{
  const pane=scroller.current,anchor=olderAnchor.current;
  olderAnchor.current=null;
  if(pane&&anchor&&pane.contains(anchor.entry)){
   const offset=anchor.entry.getBoundingClientRect().top-pane.getBoundingClientRect().top;
   pane.scrollTop+=offset-anchor.offset;
  }
 },[messages]);
 useEffect(()=>{const shell=viewportFrame.current?.closest<HTMLElement>('.app-shell'),viewport=window.visualViewport;const sync=()=>{if(viewport&&viewport.scale!==1)return;shell?.style.setProperty('--conversation-height',`${viewport?.height??window.innerHeight}px`);shell?.style.setProperty('--conversation-top',`${viewport?.offsetTop??0}px`);};sync();viewport?.addEventListener('resize',sync);viewport?.addEventListener('scroll',sync);window.addEventListener('resize',sync);return()=>{viewport?.removeEventListener('resize',sync);viewport?.removeEventListener('scroll',sync);window.removeEventListener('resize',sync);shell?.style.removeProperty('--conversation-height');shell?.style.removeProperty('--conversation-top');};},[]);
 const merge=(rows:Row[])=>setMessages(previous=>{const map=new Map(previous.map(m=>[String(m.id),m]));for(const m of rows)map.set(String(m.id),m);return [...map.values()].sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1);});
 useEffect(()=>{
  const controller=new AbortController();let active=true,fetching=false,again=false,cursor:string|null=null,activeLoad:Promise<void>|null=null,lastRead:string|null=null;setMessages([]);setLoading(true);setDraft(drafts.get(id)?.text??'');setOlder(true);
  const load=async()=>{if(fetching){again=true;return;}fetching=true;try{do{again=false;let more=true;const nearBottom=!scroller.current||scroller.current.scrollHeight-scroller.current.scrollTop-scroller.current.clientHeight<120;
   while(active&&more){const initial=cursor===null,data=await api('/customers/'+id+'/chat'+(initial?'':'?after='+cursor),'GET',undefined,controller.signal);if(!active)return;merge(data.messages);if(initial)setOlder(data.has_older);const next=String(data.next_cursor);more=!initial&&data.messages.length===100&&next!==cursor;cursor=next;}
   if(!active)return;setError('');setLoading(false);if(nearBottom)requestAnimationFrame(()=>{if(active)scroller.current?.scrollTo({top:scroller.current.scrollHeight});});if(cursor&&cursor!==lastRead){await api('/customers/'+id+'/read','POST',{last_message_id:cursor},controller.signal);lastRead=cursor;window.dispatchEvent(new Event('admin:navigation-refresh'));}
  }while(active&&again);}catch(e:any){if(active&&e.name!=='AbortError')setError(e.message);}finally{fetching=false;if(active)setLoading(false);}};
  const refresh=(event?:Event)=>{if(activeLoad)again=true;else activeLoad=load().finally(()=>{activeLoad=null;});joinRefresh(event,activeLoad);};refresh();window.addEventListener('admin:refresh',refresh);return()=>{active=false;controller.abort();window.removeEventListener('admin:refresh',refresh);};
 },[id]);
 async function loadOlder(){
  if(!messages.length||olderRequest.current)return;
  const request=new AbortController();
  olderRequest.current=request;
  setLoadingOlder(true);
  try{
   const data=await api('/customers/'+id+'/chat?before='+messages[0].id,'GET',undefined,request.signal);
   if(request.signal.aborted)return;
   const pane=scroller.current;
   if(pane){
    const {top,bottom}=pane.getBoundingClientRect();
    const entry=Array.from(pane.querySelectorAll<HTMLElement>(':scope > :is(.bubble,.chat-receipt)')).find(node=>{
     const rect=node.getBoundingClientRect();
     return rect.bottom>top&&rect.top<bottom;
    });
    if(entry)olderAnchor.current={entry,offset:entry.getBoundingClientRect().top-top};
   }
   merge(data.messages);
   setOlder(data.has_older);
   setError('');
  }catch(e:any){
   if(!request.signal.aborted)setError(e.message);
  }finally{
   olderRequest.current=null;
   if(!request.signal.aborted)setLoadingOlder(false);
  }
 }
 function saveDraft(text:string,mode:ChatVisibility,file=attachment){
  drafts.set(id,{text,visibility:mode,pending:pendingMessage.current,attachment:file});
 }
 function changeAttachment(file?:File){
  setSendError('');
  if(!file){
   pendingMessage.current=null;
   setAttachment(undefined);
   drafts.set(id,{text:draft,visibility,pending:null});
   return;
  }
  const mime=file.type||attachmentTypes[file.name.split('.').at(-1)?.toLowerCase()??''];
  if(!Object.values(attachmentTypes).includes(mime)||!file.size||file.size>4*1024*1024||file.name.length>180){
   setSendError('เลือกไฟล์ PNG, JPG, WebP หรือ PDF ขนาดไม่เกิน 4 MB');
   return;
  }
  const selected={file,mime};
  pendingMessage.current=null;
  setAttachment(selected);
  saveDraft(draft,visibility,selected);
 }
 async function send(){
  if((!draft.trim()&&!attachment)||busy||sending.current)return;
  sending.current=true;
  setBusy(true);
  setSendError('');
  const fingerprint=JSON.stringify({id,draft,visibility});
  const previous=pendingMessage.current;
  const attempt=previous?.fingerprint===fingerprint&&previous.attachment===attachment?previous:{fingerprint,key:key(),attachment};
  pendingMessage.current=attempt;
  saveDraft(draft,visibility);
  try{
   const file=attachment?await encodeAttachment(attachment):undefined;
   await api('/customers/'+id+'/chat','POST',{text:draft,visibility,idempotency_key:attempt.key,attachment:file});
   const saved=drafts.get(id);
   if(saved?.pending===attempt&&saved.text===draft&&saved.visibility===visibility&&saved.attachment===attachment)drafts.delete(id);
   pendingMessage.current=null;
   setDraft('');
   setAttachment(undefined);
   refreshAll();
  }catch{setSendError('ส่งข้อความไม่สำเร็จ กรุณากดส่งอีกครั้ง');}
  finally{sending.current=false;setBusy(false);}
 }
 const customer=profile.data?.customer;
 const username=customer?.username as string|undefined;
 const displayName=customer?.display_name||username;
 const accountReference=displayName===username?id:username;
 const [failedAvatar,setFailedAvatar]=useState<string>();
 const avatar=customer?.avatar_data_url as string|null|undefined;
 const receipt=profile.data?.latest_receipt;
 const timeline=messages.map(message=><div key={'message:'+message.id} className={'bubble '+message.sender+(message.visibility==='internal'?' internal':'')}>
  <small>{message.visibility==='internal'?<><StitchIcon name="lock" size={12}/>บันทึกภายใน</>:message.sender==='customer'?'ลูกค้า':'แอดมิน'}</small>
  {message.text&&<p>{message.text}</p>}
  {message.attachment&&(()=>{
   const url='/admin/v1/customers/'+encodeURIComponent(id)+'/chat/'+encodeURIComponent(message.id)+'/attachment';
   return <div className="chat-attachment">
    {String(message.attachment.mime).startsWith('image/')&&<img src={url} alt="" loading="lazy"/>}
    <a href={url} download={message.attachment.name}>{message.attachment.name}</a>
   </div>;
  })()}
  <time dateTime={message.created_at}>{dateTime(message.created_at)}</time>
 </div>);
 if(receipt){
  const uploadedAt=Date.parse(receipt.created_at);
  const nextMessage=messages.findIndex(message=>Date.parse(message.created_at)>uploadedAt);
  timeline.splice(nextMessage<0?timeline.length:nextMessage,0,
   <div key={'receipt:'+receipt.id} className="chat-receipt" role="group" aria-label="สลิปออเดอร์ล่าสุดของลูกค้า">
    <Receipt receipt={receipt} preview={{caption:'สลิป #'+shortId(receipt.order_id),amount:dollars(receipt.price_usd)+' USD',status:receipt.payment_verified?'ยืนยันแล้ว':'รอตรวจด้วยมือ'}}/>
    <time dateTime={receipt.created_at}>{dateTime(receipt.created_at)}</time>
   </div>,
  );
 }
 const messageInput=useRef<HTMLTextAreaElement>(null);
 function updateDraft(text:string){setDraft(text);setSendError('');saveDraft(text,visibility);}
 return <div className="support-desk-screen">{wide&&<SupportDeskHeader active/>}<div className="support-desk">{wide&&<aside className="support-desk-queue" aria-label="คิวแชทลูกค้า"><ChatList embedded activeCustomerId={id}/></aside>}<section className="conversation-screen" ref={viewportFrame}><header className="conversation-header">
 <button className="quiet icon-button conversation-back" aria-label="ย้อนกลับไปแชท" onClick={()=>navigate('/chats')}>
  {wide?<ArrowLeft size={23} aria-hidden="true"/>:<StitchIcon name="chevron_left" size={24}/>}
 </button>
 {displayName&&<div className="conversation-identity-avatar">
  <span className="avatar conversation-avatar" aria-hidden="true">
   {avatar&&failedAvatar!==avatar?<img src={avatar} alt="" onError={()=>setFailedAvatar(avatar)}/>:displayName.slice(0,2).toUpperCase()}
  </span>
  {customer?.disabled===false&&<span className="conversation-account-dot" role="img" aria-label="บัญชีใช้งานได้"/>}
 </div>}
 <div className="conversation-heading">
  <div className="conversation-name">
   <h1>{displayName??'ห้องแชท'}</h1>
   {customer?.verified_at&&<StitchIcon name="verified" className="conversation-verified" size={16} label="บัญชียืนยันแล้ว"/>}
  </div>
  {accountReference&&<p className="conversation-account" title={accountReference}>บัญชี {accountReference}</p>}
 </div>
 <button className="quiet icon-button conversation-refresh" aria-label="รีเฟรชแชท" onClick={refreshAll}><RefreshCw size={19} aria-hidden="true"/></button>
 <button className="secondary conversation-profile" aria-label="รายละเอียดลูกค้า" onClick={()=>navigate('/customers/'+id)}>
  {wide?<UserRound size={18} aria-hidden="true"/>:<StitchIcon name="person" size={18}/>}<span>รายละเอียดลูกค้า</span>
 </button>
 </header>{!wide&&<ChatIssueContext customerId={id} username={username}/>}<ReadNotice error={error||profile.error}/><div className="chat-workspace"><div className="chat-messages" ref={scroller}>{older&&messages.length>0&&<button className="quiet older" onClick={loadOlder} disabled={loadingOlder}>{loadingOlder?"กำลังโหลดข้อความก่อนหน้า…":"โหลดข้อความก่อนหน้า"}</button>}{loading&&!timeline.length?<Loading/>:!timeline.length&&!error?<Empty title="เริ่มบทสนทนา" text="ข้อความตอบจะอยู่ในห้องเดิมของลูกค้า ไม่แนบเลขออเดอร์อัตโนมัติ"/>:timeline}</div><form className="chat-composer" onSubmit={e=>{e.preventDefault();send();}}>{wide&&visibility==="public"&&<div className="support-quick-replies" aria-label="ข้อความตอบกลับด่วน"><Zap size={16} aria-hidden="true"/>{quickReplies.map(text=><button key={text} type="button" disabled={busy||Boolean(draft.trim())} onClick={()=>{updateDraft(text);messageInput.current?.focus();}}>{text}</button>)}</div>}<ChatMessageMode value={visibility} disabled={busy} onChange={value=>{setVisibility(value);setSendError('');saveDraft(draft,value);}}/>{attachment&&<div className="chat-attachment-selection">
 <span>{attachment.file.name}</span><button type="button" className="quiet" disabled={busy} onClick={()=>changeAttachment()}>เอาไฟล์ออก</button>
 </div>}
 <div className="conversation-input">
 <input ref={attachmentInput} type="file" hidden accept="image/png,image/jpeg,image/webp,application/pdf" onChange={e=>{
  const file=e.currentTarget.files?.[0];
  e.currentTarget.value='';
  if(file)changeAttachment(file);
 }}/>
 <button type="button" className="quiet conversation-attach" aria-label="แนบไฟล์หรือรูปภาพ" disabled={busy} onClick={()=>attachmentInput.current?.click()}>
  <StitchIcon name="attach_file" size={22}/>
 </button>
 <textarea ref={messageInput} disabled={busy} aria-label="ข้อความแชท" aria-describedby="chat-keyboard-help" onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing&&e.keyCode!==229){e.preventDefault();if(!e.repeat)void send();}}} rows={2} maxLength={2000} placeholder={visibility==='public'?'พิมพ์ข้อความถึงลูกค้า…':'บันทึกสำหรับแอดมินเท่านั้น…'} value={draft} onChange={e=>updateDraft(e.target.value)}/><button className="primary icon-button" aria-label="ส่งข้อความ" disabled={busy||(!draft.trim()&&!attachment)}><span>{wide?"ส่งข้อความ":"ส่ง"}</span><StitchIcon name="send" size={19}/></button></div><ErrorBox message={sendError}/><small id="chat-keyboard-help" className="composer-help">Enter ส่งข้อความ · Shift+Enter ขึ้นบรรทัดใหม่</small></form></div></section>{wide&&<aside className="support-desk-customer" aria-label="ข้อมูลลูกค้า">{profile.data&&<Panel title="ข้อมูลลูกค้า"><div className="support-profile-head"><span className="avatar" aria-hidden="true">{username?.slice(0,2).toUpperCase()}</span><div><strong>{username}</strong><p className="muted">สมัคร {dateTime(profile.data.customer.created_at)}</p></div></div><div className="profile-counts"><div><strong>{profile.data.total_orders}</strong><span>ออเดอร์ทั้งหมด</span></div><div><strong>{profile.data.issue_orders}</strong><span>มีปัญหา</span></div></div><button className="secondary wide" onClick={()=>navigate('/customers/'+id)}>ดูประวัติลูกค้า</button></Panel>}<ChatIssueContext customerId={id} expanded/></aside>}</div></div>;
}
function customerIdentity(username:string,displayName?:string|null){
 const name=displayName?.trim()||username;
 const parts=name.split(/\s+/);
 const initials=(parts.length>1?parts.slice(0,2).map(part=>Array.from(part)[0]).join(''):Array.from(name).slice(0,2).join('')).toUpperCase();
 return {name,initials,hasDistinctName:name.toLowerCase()!==username.toLowerCase()};
}

export function Customer({id}:{id:string}){
 const {data,error,loading}=useResource('/customers/'+id);
 const [issue,setIssue]=useState(false);
 const [cursor,setCursor]=useState('');
 const [search,setSearch]=useState('');
 const [copyState,setCopyState]=useState('');
 const term=search.trim();
 const customers=useResource<{data:Row[]}>('/customers'+(term?'?'+new URLSearchParams({search:term}):''),{resetOnPathChange:true});
 const searchInput=useRef<HTMLInputElement>(null);
 const ordersHeading=useRef<HTMLHeadingElement>(null);
 const orders=useResource('/orders?'+new URLSearchParams({customer_id:id,...issue?{status:'issue'}:{},...cursor?{cursor}:{}}));
 const chatPath='/chats/'+id;
 const navigation=<header className="profile-navigation">
  <a className="profile-back-store" href="#/store" aria-label="กลับไปจัดการร้าน"><ChevronLeft size={24} aria-hidden="true"/>จัดการร้าน</a>
  <button className="quiet profile-back-chat" aria-label="ย้อนกลับ" onClick={()=>navigate(chatPath)}><ChevronLeft size={24} aria-hidden="true"/>แชท</button>
  <strong>ข้อมูลลูกค้า</strong>
  <button disabled={!data} className="quiet icon-button" aria-label="ค้นหา" onClick={()=>searchInput.current?.focus()}><Search size={20} aria-hidden="true"/></button>
 </header>;
 if(!data)return <div className="customer-profile">{navigation}{loading?<Loading/>:<ReadNotice error={error}/>}</div>;
 const {username,disabled,created_at,display_name}=data.customer;
 const {name:displayName,initials,hasDistinctName}=customerIdentity(username,display_name);
 const matches=customers.data?.data??[];
 const current={...matches.find(customer=>customer.id===id),...data.customer};
 const visibleCustomers:Row[]=term?matches:[current,...matches.filter(customer=>customer.id!==id)].slice(0,3);
 const players:Row[]=data.player_ids??[];
 const counts:Record<string,number>=data.counts??{};
 const pending=['awaiting_payment','payment_review','paid','accepted','processing'].reduce((total,status)=>total+(counts[status]??0),0);
 async function copyUid(uid:string){
  try{await navigator.clipboard.writeText(uid);setCopyState('คัดลอก UID '+uid+' แล้ว');}
  catch{setCopyState('คัดลอก UID ไม่สำเร็จ');}
 }
 return <div className="customer-profile">
  {navigation}
  <ReadNotice error={error} cached={!!data}/>
  <div className="profile-search">
   <label className="search-bar"><Search size={20} aria-hidden="true"/><input ref={searchInput} type="search" aria-label="ค้นหาชื่อลูกค้า ไอดีบัญชี หรือ UID"
    placeholder="ค้นหาชื่อลูกค้า, ไอดีบัญชี หรือ UID…" maxLength={100} value={search} onChange={event=>setSearch(event.target.value)}/></label>
   <ReadNotice error={customers.error} cached={!!customers.data}/>
   {visibleCustomers.length>0&&<><div className="profile-picker-heading"><span>{term?'ผลการค้นหา':'ลูกค้าล่าสุด'}</span><span>{visibleCustomers.length} รายชื่อ</span></div>
    <div className="profile-customer-picker" role="group" aria-label="เลือกลูกค้า">
    {visibleCustomers.map(customer=>{
     const active=customer.id===id;
     const identity=customerIdentity(customer.username,active?display_name:customer.display_name);
     const uid=(customer.matched_order??customer.latest_order)?.uid;
     const account=identity.hasDistinctName?'@'+customer.username:null;
     const subtitle=active&&account?account:uid?'UID: '+uid:account;
     const label=active&&!identity.hasDistinctName?'ลูกค้าปัจจุบัน':identity.name;
     return <button type="button" key={customer.id} className={active?'primary':'secondary'} aria-current={active||undefined}
      disabled={active} onClick={()=>navigate('/customers/'+encodeURIComponent(customer.id))}>
      <span aria-hidden="true" className="avatar">{identity.initials}</span>
      <span className="profile-picker-identity"><strong>{label}</strong>{subtitle&&<small>{subtitle}</small>}</span>
     </button>;
    })}
   </div></>}
   {term&&customers.loading&&<Loading/>}
   {term&&customers.data&&!customers.error&&!customers.loading&&!matches.length&&<p className="muted">ไม่พบลูกค้า</p>}
  </div>
  <Panel>
   <div className="profile-head">
    <span className="avatar large" aria-hidden="true">{initials}</span>
    <div>
     <h1>{displayName}</h1>
     {hasDistinctName?<p>ไอดีบัญชี: <strong>{username}</strong></p>:<p>สมัคร {dateTime(created_at)}</p>}
    </div>
    <span className="profile-account-state">{disabled?'บัญชีถูกระงับ':'บัญชีใช้งานได้'}</span>
   </div>
   {players.length>0&&<section className="profile-player-ids" aria-label="UID จากออเดอร์ล่าสุด">
    <h2>UID จากออเดอร์ล่าสุด</h2>
    <ul>{players.map(({game_id,zone,uid})=><li key={JSON.stringify([game_id,zone,uid])}>
     <Gamepad2 size={18} aria-hidden="true"/>
     <span><small>{gameName(game_id)}{zone?' (โซน '+String(zone).toUpperCase()+')':''}</small><strong>{uid}</strong></span>
     <button className="quiet icon-button" onClick={()=>copyUid(uid)} aria-label={'คัดลอก UID '+uid}><Copy size={17} aria-hidden="true"/></button>
    </li>)}</ul>
    {copyState&&<small role="status">{copyState}</small>}
   </section>}
   <div className="profile-counts">
    <div><span>ออเดอร์ทั้งหมด</span><strong>{data.total_orders} <small>รายการ</small></strong></div>
    <div><span>เติมสำเร็จ</span><strong>{counts.completed??0} <small>รายการ</small></strong></div>
    <div><span>รอดำเนินการ / ตรวจสลิป</span><strong>{pending} <small>รายการ</small></strong></div>
    <div><span>ยอดใช้จ่ายรวม</span><strong>{dollars(data.completed_spend_usd)} <small>USD</small></strong></div>
   </div>
   <ProfileNote customerId={id} latest={data.latest_internal_note??null}/>
   <div className="profile-actions">
    <button className="primary wide" onClick={()=>navigate(chatPath)}><MessageSquare size={18} aria-hidden="true"/>เปิดห้องแชท</button>
    <button className="secondary wide" onClick={()=>{setIssue(false);setCursor('');ordersHeading.current?.focus();}}>
     <ReceiptText size={18} aria-hidden="true"/>ดูทุกออเดอร์ของลูกค้านี้
    </button>
   </div>
  </Panel>
  <h2 ref={ordersHeading} className="profile-orders-heading" tabIndex={-1}>ประวัติออเดอร์</h2>
  <div className="segmented" role="group" aria-label="กรองประวัติออเดอร์">
   <button className={!issue?'active':''} aria-pressed={!issue} onClick={()=>{setIssue(false);setCursor('');}}>ทุกออเดอร์</button>
   <button className={issue?'active':''} aria-pressed={issue} onClick={()=>{setIssue(true);setCursor('');}}>มีปัญหา</button>
  </div>
  <ReadNotice error={orders.error} cached={!!orders.data}/>
  <Panel>
   {orders.loading&&!orders.data?<Loading/>:orders.data&&(orders.data.data.length
    ?orders.data.data.map((order:Row)=><OrderRow key={order.id} order={order}/>)
    :<Empty title={issue?'ไม่มีออเดอร์ที่มีปัญหา':'ยังไม่มีออเดอร์'}/>)}
  </Panel>
  {orders.data?.next_cursor&&<button className="secondary" onClick={()=>setCursor(orders.data.next_cursor)}>ออเดอร์ถัดไป</button>}
 </div>;
}
