interface NavigationCountProps {readonly kind:'orders'|'chats';readonly count:number|null;readonly stale:boolean;readonly placement?:'nav'|'shortcut'}
export function NavigationCount({kind,count,stale,placement='nav'}:Readonly<NavigationCountProps>){
 const description=kind==='orders'?'ออเดอร์จริงรอตรวจสลิป':'ห้องแชทที่ยังไม่อ่าน';
 return <><span id={placement+'-count-'+kind} className="sr-only">{count===null?'กำลังโหลดจำนวน':description+' '+count}{stale?' · จำนวนอาจยังไม่อัปเดต':''}</span>{(stale||count!==null&&count>0)&&<b className={placement==='shortcut'?'shortcut-count':'nav-badge'} data-kind={kind} data-stale={stale} aria-hidden="true" title={description+(stale?' · จำนวนอาจยังไม่อัปเดต':'')}>{count===null||count===0&&stale?'?':count>99?'99+':count}</b>}</>;
}
