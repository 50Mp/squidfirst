import {MessageSquareText} from 'lucide-react';

export function MobileTabIcon({route}:Readonly<{route:'/'|'/orders'|'/chats'|'/store'}>){
 if(route==='/chats')return <MessageSquareText size={20} aria-hidden="true"/>;
 return <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
  {route==='/'?<><rect x={3} y={3} width={7} height={9} rx={1}/><rect x={14} y={3} width={7} height={5} rx={1}/>
   <rect x={14} y={12} width={7} height={9} rx={1}/><rect x={3} y={16} width={7} height={5} rx={1}/></>
  :route==='/orders'?<><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 10h6m-6 4h6m-6 4h6"/>
   <rect x={8} y={2} width={8} height={4} rx={1}/></>
  :<path d="M21 4h-7m-4 0H3m18 8h-9m-4 0H3m18 8h-5m-4 0H3M14 2v4m-6 4v4m8 4v4"/>}
 </svg>;
}
