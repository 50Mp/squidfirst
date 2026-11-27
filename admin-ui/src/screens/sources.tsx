import {StitchIcon} from '../components/stitch-icon';
import {useRef,useState} from 'react';
import {CloudDownload} from 'lucide-react';
import {ApiError,api,confirmAction,dateTime,key,refreshAndWait,useResource} from '../api';
import {Empty,ErrorBox,Loading,PageHeader,Panel,Toggle} from '../components';
import {ReadNotice} from '../components/read-notice';
import {SupplierIcon} from '../components/supplier-icon';
import {useWideWorkspace} from '../hooks/use-wide-workspace';

interface Supplier {
 readonly id:string;
 readonly name:string;
 readonly url:string;
 readonly enabled:boolean;
 readonly revision:number;
 readonly package_count:number;
 readonly last_success_at:string|null;
 readonly last_run:{status:string;at:string}|null;
}

function syncLabel(source:Supplier){
 switch(source.last_run?.status){
  case 'running':return 'กำลังดึง';
  case 'failed':return 'ดึงไม่สำเร็จ';
  case 'completed':return 'ดึงสำเร็จ';
  case 'skipped':return 'ข้ามรอบดึง';
  default:return '—';
 }
}

function EnabledStatus({enabled}:Readonly<{enabled:boolean}>){
 return <span className={'supplier-status '+(enabled?'enabled':'')}>{enabled?'เปิดใช้งาน':'ปิดใช้งาน'}</span>;
}

interface SupplierCardProps {
 readonly source:Supplier;
 readonly locked:boolean;
 readonly busy:boolean;
 readonly onToggle:(source:Supplier,enabled:boolean)=>void;
 readonly onSync:(source:Supplier)=>void;
}
function SupplierCard({source,locked,busy,onToggle,onSync}:Readonly<SupplierCardProps>){
 const stale=!!source.last_success_at&&Date.now()-Date.parse(source.last_success_at)>26*3600000;
 const failed=source.last_run?.status==='failed';
 const retained=!!source.last_success_at&&source.package_count>0;
 return <Panel>
  <header className="source-heading"><SupplierIcon id={source.id} name={source.name}/><div><h2>{source.name}</h2><p>{new URL(source.url).hostname}</p></div><EnabledStatus enabled={source.enabled}/></header>
  <dl className="supplier-facts">
   <div><dt>แพ็กเกจที่ใช้งาน</dt><dd>{source.package_count.toLocaleString('en-US')} รายการ</dd></div>
   <div><dt>ดึงสำเร็จล่าสุด</dt><dd>{source.last_success_at?dateTime(source.last_success_at):'ยังไม่มีข้อมูล'}</dd></div>
  </dl>
  <div className="supplier-run"><span>การดึงข้อมูลรอบล่าสุด</span><strong data-status={source.last_run?.status}>{syncLabel(source)}</strong>{source.last_run?.at&&<time dateTime={source.last_run.at}>{dateTime(source.last_run.at)}</time>}</div>
  {failed&&<p className="supplier-stale">{retained?'ยังมีราคาจากรอบที่ดึงสำเร็จล่าสุด':'ยังไม่มีราคาจากการดึงข้อมูลสำเร็จ'}</p>}
  {stale&&<p className="supplier-stale">ราคาที่บันทึกไว้เก่ากว่า 26 ชั่วโมง</p>}
  <div className="supplier-controls"><Toggle label="ใช้ร้านนี้เลือกต้นทุน" checked={source.enabled} disabled={locked} onChange={enabled=>onToggle(source,enabled)}/>
   <button className="secondary" disabled={locked||!source.enabled||source.last_run?.status==='running'} onClick={()=>onSync(source)}><CloudDownload size={17} aria-hidden="true"/>{busy?'กำลังดำเนินการ…':'ดึงข้อมูลตอนนี้'}</button>
  </div>
 </Panel>;
}

export function Sources(){
 const wide=useWideWorkspace(),{data,error,loading}=useResource<{data:Supplier[]}>('/sources');
 const [selected,setSelected]=useState(''),[search,setSearch]=useState(''),[state,setState]=useState('all');
 const [busy,setBusy]=useState(''),[failure,setFailure]=useState(''),[feedback,setFeedback]=useState('');
 const actionLock=useRef(false);
 const sources=data?.data??[],term=search.trim().toLocaleLowerCase();
 const visible=sources.filter(source=>(state==='all'||source.enabled===(state==='enabled'))&&
  (source.name.toLocaleLowerCase().includes(term)||new URL(source.url).hostname.includes(term)));
 const current=visible.find(source=>source.id===selected)??visible[0];
 const locked=loading||!!error||!!busy;

 async function change(source:Supplier,enabled?:boolean){
  if(locked||actionLock.current)return;
  actionLock.current=true;setBusy(source.id);setFailure('');setFeedback('');
  try{
   if(enabled===false&&!await confirmAction('ปิด '+source.name+' สำหรับออเดอร์ใหม่?'))return;
   const url='/sources/'+encodeURIComponent(source.id);
   if(enabled===undefined){
    await api(url+'/sync','POST',{idempotency_key:key()});
    setFeedback('ส่งคำขอดึงข้อมูล '+source.name+' แล้ว');
   }else await api(url,'PATCH',{enabled,expected_revision:source.revision,idempotency_key:key()});
   await refreshAndWait();
  }catch(e){
   setFailure(enabled===undefined&&e instanceof ApiError&&e.status===409?'ดึงได้ช่วง 15:00–16:00 (UTC+7) เมื่อร้านเปิดใช้งานและไม่มีงานดึงอยู่':(e as Error).message);
  }finally{actionLock.current=false;setBusy('');}
 }
 const renderCard=(source:Supplier)=><SupplierCard key={source.id} source={source} locked={locked} busy={busy===source.id} onToggle={change} onSync={change}/>;
 return <div className="store-detail source-settings">
  <PageHeader back="/store" title="ร้านต้นทาง" subtitle="จัดการซัพพลายเออร์ที่ใช้ดึงข้อมูลและเลือกต้นทุน">
   <button className="secondary" disabled={loading} onClick={()=>void refreshAndWait()}><StitchIcon name="sync" size={18}/>รีเฟรช</button>
  </PageHeader>
  <p className="notice">รอบดึงราคา 15:00–16:00 (UTC+7) · เปิด–ปิดร้านได้ตลอดวัน</p>
  <ReadNotice error={error} cached={!!data}/><ErrorBox message={failure}/>{feedback&&<p className="success-line" role="status">{feedback}</p>}
  {loading&&!data?<Loading/>:data&&(sources.length?(wide?<>
   <div className="supplier-metrics">
    <Panel title="ร้านต้นทาง"><strong>{sources.length}</strong></Panel><Panel title="เปิดใช้งาน"><strong>{sources.filter(source=>source.enabled).length}</strong></Panel>
    <Panel title="แพ็กเกจที่ใช้งาน"><strong>{sources.reduce((total,source)=>total+source.package_count,0).toLocaleString('en-US')}</strong></Panel><Panel title="ดึงรอบล่าสุดไม่สำเร็จ"><strong>{sources.filter(source=>source.last_run?.status==='failed').length}</strong></Panel>
   </div>
   <div className="supplier-workspace">
    <Panel><div className="supplier-filters"><div className="search-bar"><StitchIcon name="search" size={18}/><input type="search" aria-label="ค้นหาร้านต้นทาง" placeholder="ค้นหาชื่อร้านหรือโดเมน…" value={search} onChange={e=>setSearch(e.target.value)}/></div><select aria-label="กรองสถานะร้าน" value={state} onChange={e=>setState(e.target.value)}><option value="all">ทุกสถานะ</option><option value="enabled">เปิดใช้งาน</option><option value="disabled">ปิดใช้งาน</option></select></div>
     {current?<table className="supplier-table" aria-label="รายชื่อซัพพลายเออร์"><thead><tr><th scope="col">ซัพพลายเออร์</th><th scope="col">สถานะ</th><th scope="col">แพ็กเกจ</th><th scope="col">การดึงล่าสุด</th></tr></thead><tbody>{visible.map(source=><tr key={source.id} data-active={current.id===source.id}><th scope="row"><button className="text-link" aria-pressed={current.id===source.id} aria-label={source.name} onClick={()=>setSelected(source.id)}><SupplierIcon id={source.id} name={source.name}/><span className="supplier-directory-name"><strong>{source.name}</strong><small>{new URL(source.url).hostname}</small></span></button></th><td><EnabledStatus enabled={source.enabled}/></td><td>{source.package_count.toLocaleString('en-US')}</td><td><span className="supplier-sync-state" data-status={source.last_run?.status}>{syncLabel(source)}</span></td></tr>)}</tbody></table>:<Empty title="ไม่พบร้านต้นทางที่ตรงกัน"/>}
    </Panel>
    {current&&<aside aria-label="รายละเอียดซัพพลายเออร์">{renderCard(current)}</aside>}
   </div>
  </>:sources.map(renderCard)):<Empty title="ยังไม่มีร้านต้นทาง"/>)}
 </div>;
}
