import {useEffect,useState} from 'react';
import {api,joinRefresh} from '../api';

export interface NavigationCounts {pending_review_orders:number;unread_chat_rooms:number;unread_messages:number}
export function useNavigationCounts(enabled:boolean){
 const [counts,setCounts]=useState<NavigationCounts|null>(null),[stale,setStale]=useState(false);
 useEffect(()=>{
  if(!enabled){setCounts(null);setStale(false);return;}
  let active=true,controller:AbortController|undefined,revision=0;
  const load=(event?:Event)=>{
   controller?.abort();controller=new AbortController();const current=++revision;
   const pending=api<NavigationCounts>('/navigation','GET',undefined,controller.signal).then(value=>{if(active&&current===revision){setCounts(value);setStale(false);}}).catch(e=>{if(active&&current===revision&&e.name!=='AbortError')setStale(true);});
   joinRefresh(event,pending);
  };
  load();window.addEventListener('admin:refresh',load);window.addEventListener('admin:navigation-refresh',load);
  return()=>{active=false;controller?.abort();window.removeEventListener('admin:refresh',load);window.removeEventListener('admin:navigation-refresh',load);};
 },[enabled]);
 return{counts,stale};
}
