// Tab-local navigation memory. No credentials or message contents are persisted.
let list={path:'/orders',windowY:0,paneY:0,focusId:''};
const origins=new Map<string,string>();
const isList=(path:string)=>path.split('?')[0]==='/orders';
const detailId=(path:string)=>/^\/orders\/([^/?]+)(?:\?|$)/.exec(path)?.[1];
function safeOrigin(value:string|null){
 if(!value||value.length>2000)return null;
 const route=value.split('?')[0];
 return route==='/orders'||value==='/'||/^\/(chats|customers)\/[A-Za-z0-9_-]+$/.test(value)?value:null;
}
function embeddedOrigin(path:string){return safeOrigin(new URLSearchParams(path.split('?')[1]??'').get('return_to'));}
export function orderListPath(){const embedded=embeddedOrigin(location.hash.slice(1));return embedded&&isList(embedded)?embedded:list.path;}
export function orderReturnPath(id:string){return(detailId(location.hash.slice(1))===id?embeddedOrigin(location.hash.slice(1)):null)??origins.get(id)??list.path;}
export function rememberOrderPaneScroll(path:string,paneY:number){list={...list,path,paneY};}
export function rememberOrderNavigation(from:string,to:string){
 const id=detailId(to);
 if(isList(from)){
  list={path:from,windowY:window.scrollY,paneY:document.querySelector('.order-list-pane')?.scrollTop??0,focusId:id??list.focusId};
 }
 if(isList(to)&&to!==list.path)list={path:to,windowY:0,paneY:0,focusId:''};
 if(id&&!detailId(from)){
  const origin=isList(from)||/^\/(chats|customers)\/[^/?]+$/.test(from)||from==='/'?from:list.path;
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
 if(pane)pane.scrollTop=list.paneY;
 window.scrollTo({top:list.windowY,behavior:'instant'});
 if(list.focusId){
  const target=pane?.querySelector<HTMLButtonElement>('[data-order-id="'+CSS.escape(list.focusId)+'"] .order-card-summary');
  const bounds=pane?.getBoundingClientRect(),rect=target?.getBoundingClientRect();
  const visible=target&&rect&&bounds&&rect.bottom>=bounds.top&&rect.top<=bounds.bottom?target:Array.from(pane?.querySelectorAll<HTMLButtonElement>('.order-card-summary')??[]).find(button=>{const box=button.getBoundingClientRect();return bounds&&box.bottom>=bounds.top&&box.top<=bounds.bottom;});
  visible?.focus({preventScroll:true});
 }
}
