import {useEffect,useRef,useState} from 'react';
import {rememberOrderNavigation} from './order-navigation';
export type Row=Record<string,any>;
export class ApiError extends Error{constructor(readonly status:number,readonly serverMessage:string){super(status===409?'ข้อมูลเปลี่ยนแล้ว กรุณาตรวจข้อมูลล่าสุดและลองอีกครั้ง':status===401?'เซสชันหมดอายุ กรุณาเปิด Mini App ใหม่จาก Telegram':status===403?'ไม่มีสิทธิ์ดำเนินการ หรือการยืนยันหมดอายุ':status===400?'ข้อมูลยังไม่ถูกต้อง กรุณาตรวจช่องที่กรอก':status===404?'ไม่พบข้อมูลรายการนี้':'เชื่อมต่อระบบไม่สำเร็จ กรุณาลองอีกครั้ง');}}
let csrf='';
export function refreshAll(){window.dispatchEvent(new Event('admin:refresh'));}
export function joinRefresh(event:Event|undefined,pending:Promise<unknown>){const wait=(event as CustomEvent<{waitUntil?:(p:Promise<unknown>)=>void}>|undefined)?.detail?.waitUntil;if(typeof wait==='function')wait(pending);}
export async function refreshAndWait(){const pending:Promise<unknown>[]=[api('/me')];window.dispatchEvent(new CustomEvent('admin:refresh',{detail:{waitUntil:(p:Promise<unknown>)=>pending.push(p)}}));await Promise.allSettled(pending);}
export const key=()=>crypto.randomUUID();
export async function api<T=any>(path:string,method='GET',body?:unknown,signal?:AbortSignal):Promise<T>{
 const cookie=/(?:^|;\s*)squid_admin_csrf=([^;]+)/.exec(document.cookie)?.[1];
 const headers:Record<string,string>={};if(body!==undefined)headers['content-type']='application/json';if(method!=='GET')headers['x-csrf-token']=csrf||cookie||'';
 const res=await fetch('/admin/v1'+path,{method,headers,credentials:'same-origin',body:body===undefined?undefined:JSON.stringify(body),signal});
 const result=await res.json().catch(()=>({}));
 if(!res.ok){if(res.status===401)window.dispatchEvent(new Event('admin:unauthorized'));if(res.status===409)refreshAll();throw new ApiError(res.status,String(result.error??''));}
 if(result.csrf)csrf=result.csrf;return result;
}
export function useResource<T=any>(path:string|null){
 const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(!!path),version=useRef(0);
 useEffect(()=>{
  let active=true,controller:AbortController|undefined;
  const load=(event?:Event)=>{if(!path)return;controller?.abort();controller=new AbortController();const current=++version.current;setLoading(true);
   const pending=api<T>(path,'GET',undefined,controller.signal).then(r=>{if(active&&current===version.current){setData(r);setError('');}}).catch(e=>{if(active&&e.name!=='AbortError')setError(e.message);}).finally(()=>{if(active&&current===version.current)setLoading(false);});joinRefresh(event,pending);};
  setData(null);load();window.addEventListener('admin:refresh',load);return()=>{active=false;controller?.abort();window.removeEventListener('admin:refresh',load);};
 },[path]);return{data,error,loading};
}
export function navigate(path:string){window.location.hash=rememberOrderNavigation(window.location.hash.slice(1)||'/',path);}
export const statuses:Record<string,string>={awaiting_payment:'รอชำระเงิน',payment_review:'รอตรวจสลิป',paid:'รอรับงาน',accepted:'รับงานแล้ว',processing:'กำลังเติม',completed:'เติมสำเร็จ',issue:'พบปัญหา',cancelled:'ยกเลิกแล้ว',refunded:'คืนเงินแล้ว'};
export const actions:Record<string,string>={approve:'ยืนยันรับเงินแล้ว',accept:'รับงาน',start:'เริ่มเติม',complete:'เติมสำเร็จ',reopen:'กลับไปกำลังเติม',issue:'พบปัญหา',resume:'ทำต่อ',cancel:'ยกเลิกออเดอร์',refund:'บันทึกว่าคืนเงินจริงแล้ว'};
export const gameName=(id:string)=>({'free-fire':'Free Fire','mobile-legends-bang-bang':'Mobile Legends: Bang Bang','pubg-mobile':'PUBG',rov:'RoV','genshin-impact':'Genshin Impact',roblox:'Roblox'}[id]??id??'—');
export const shortId=(id:string)=>/^SQ-\d+$/.test(id)?id:id?.replaceAll('-','').slice(-10)??'—';
export const dollars=(v:unknown)=>v===null||v===undefined?'—':'$'+String(v);
export function dateTime(v:unknown){if(!v)return'ยังไม่มีข้อมูล';const d=new Date(String(v));return isNaN(d.getTime())?'—':d.toLocaleString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}
export async function confirmAction(text:string):Promise<boolean>{const tg=(window as any).Telegram?.WebApp;if(tg?.showConfirm)return new Promise(resolve=>tg.showConfirm(text,resolve));return window.confirm(text);}
