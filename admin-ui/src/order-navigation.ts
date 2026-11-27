// Tab-local navigation memory. No credentials or message contents are persisted.
const listStorageKey='squid-order-list-navigation';
const initialList={path:'/orders',windowY:0,paneY:0,focusId:''};
const isList=(path:string)=>path.split('?')[0]==='/orders';
let list=readOrderList();
let desktopAnchor:{id:string;offset:number}|null=null;
const origins=new Map<string,string>();
const detailId=(path:string)=>/^\/orders\/([^/?]+)(?:\?|$)/.exec(path)?.[1];
function readOrderList():typeof initialList{
 try{
  const saved=JSON.parse(sessionStorage.getItem(listStorageKey)??'null');
  if(!saved||typeof saved.path!=='string'||saved.path.length>2000||!isList(saved.path))return initialList;
  return {
   path:saved.path,
   windowY:Number.isFinite(saved.windowY)&&saved.windowY>=0?saved.windowY:0,
   paneY:Number.isFinite(saved.paneY)&&saved.paneY>=0?saved.paneY:0,
   focusId:typeof saved.focusId==='string'&&saved.focusId.length<=100?saved.focusId:'',
  };
 }catch{return initialList;}
}
function saveOrderList(){
 try{sessionStorage.setItem(listStorageKey,JSON.stringify(list));}catch{/* In-memory navigation still works. */}
}
function safeOrigin(value:string|null){
 if(!value||value.length>2000)return null;
 const route=value.split('?')[0];
 return route==='/orders'||route==='/store/audit'||value==='/'||value==='/chats'||/^\/(chats|customers)\/[A-Za-z0-9_-]+$/.test(value)?value:null;
}
function embeddedOrigin(path:string){return safeOrigin(new URLSearchParams(path.split('?')[1]??'').get('return_to'));}
export function orderListPath(){const embedded=embeddedOrigin(location.hash.slice(1));return embedded&&isList(embedded)?embedded:list.path;}
export function orderReturnPath(id:string){return(detailId(location.hash.slice(1))===id?embeddedOrigin(location.hash.slice(1)):null)??origins.get(id)??list.path;}
export function returnToExpoOverview(back:string){
 if(back!=='/'||!['localhost','127.0.0.1'].includes(location.hostname)||!document.referrer||history.length<2)return false;
 const path=location.hash.slice(1);
 if(!detailId(path))return false;
 const params=new URLSearchParams(path.split('?')[1]??'');
 if(params.get('from')!=='expo-overview')return false;
 const referrer=new URL(document.referrer);
 if(referrer.origin!==location.origin||referrer.pathname!=='/admin-app-expo/')return false;
 history.back();
 return true;
}
export function rememberOrderPaneScroll(path:string,paneY:number){list={...list,path,paneY};}
export function rememberOrderNavigation(from:string,to:string){
 const id=detailId(to);
 if(isList(from)){
  list={path:from,windowY:window.scrollY,paneY:document.querySelector('.order-list-pane')?.scrollTop??0,focusId:id??list.focusId};
 }
 if(isList(to)&&to!==list.path)list={path:to,windowY:0,paneY:0,focusId:''};
 if(isList(from)||isList(to))saveOrderList();
 if(isList(to)){
  desktopAnchor=null;
  if(detailId(from)&&to===list.path){
   const pane=document.querySelector<HTMLElement>('.desktop-order-workspace .order-list-pane');
   const top=pane?.getBoundingClientRect().top;
   if(pane&&top!==undefined){
    const first=Array.from(pane.querySelectorAll<HTMLElement>('tr[data-order-id]')).find(row=>row.getBoundingClientRect().bottom>top);
    if(first?.dataset.orderId)desktopAnchor={id:first.dataset.orderId,offset:first.getBoundingClientRect().top-top};
   }
  }
 }
 if(id&&!detailId(from)){
  const origin=safeOrigin(from)??list.path;
  origins.set(id,origin);
  if(origins.size>100)origins.delete(origins.keys().next().value!);
 }
 if(id){
  const origin=embeddedOrigin(from)??origins.get(id)??list.path;
  const params=new URLSearchParams(to.split('?')[1]??'');params.set('return_to',origin);
  return to.split('?')[0]+'?'+params;
 }
 return to;
}
export function restoreOrderList(path:string){
 if(path!==list.path)return;
 const pane=document.querySelector('.order-list-pane');
 if(pane){
  const anchor=desktopAnchor&&pane.querySelector<HTMLElement>('tr[data-order-id="'+CSS.escape(desktopAnchor.id)+'"]');
  if(anchor&&desktopAnchor)pane.scrollTop+=anchor.getBoundingClientRect().top-pane.getBoundingClientRect().top-desktopAnchor.offset;
  else pane.scrollTop=list.paneY;
  desktopAnchor=null;
 }
 window.scrollTo({top:list.windowY,behavior:'instant'});
 if(list.focusId){
  const target=pane?.querySelector<HTMLButtonElement>('[data-order-id="'+CSS.escape(list.focusId)+'"] .order-card-summary');
  const bounds=pane?.getBoundingClientRect(),rect=target?.getBoundingClientRect();
  const visible=target&&rect&&bounds&&rect.bottom>=bounds.top&&rect.top<=bounds.bottom?target:Array.from(pane?.querySelectorAll<HTMLButtonElement>('.order-card-summary')??[]).find(button=>{const box=button.getBoundingClientRect();return bounds&&box.bottom>=bounds.top&&box.top<=bounds.bottom;});
  visible?.focus({preventScroll:true});
 }
}
