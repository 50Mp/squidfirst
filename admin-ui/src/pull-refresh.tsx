import {useEffect,useRef,useState} from 'react';import {RefreshCw} from 'lucide-react';import {refreshAndWait} from './api';
const threshold=64;
function scrollHost(target:Element){for(let element:Element|null=target;element&&element!==document.body;element=element.parentElement){if(element.matches('.chat-messages'))return element as HTMLElement;const style=getComputedStyle(element);if(/auto|scroll/.test(style.overflowY)&&element.scrollHeight>element.clientHeight+1)return element as HTMLElement;}return document.scrollingElement as HTMLElement;}
export function PullToRefresh(){
 const [distance,setDistance]=useState(0),[refreshing,setRefreshing]=useState(false),busy=useRef(false);
 useEffect(()=>{let active=true,gesture:{x:number;y:number;host:HTMLElement;distance:number}|null=null;
  const tg=(window as any).Telegram?.WebApp,restoreSwipes=tg?.isVerticalSwipesEnabled!==false;tg?.disableVerticalSwipes?.();
  const reset=()=>{gesture=null;if(active)setDistance(0);};
  const start=(event:TouchEvent)=>{reset();if(busy.current||event.touches.length!==1||!(event.target instanceof Element)||event.target.closest('input,textarea,select,[contenteditable],dialog'))return;if(document.querySelector('.chat-mode')&&!event.target.closest('.chat-messages'))return;const host=scrollHost(event.target);if(!host||host.scrollTop>0)return;gesture={x:event.touches[0].clientX,y:event.touches[0].clientY,host,distance:0};};
  const move=(event:TouchEvent)=>{if(!gesture)return;if(event.touches.length!==1||gesture.host.scrollTop>0){reset();return;}const dx=event.touches[0].clientX-gesture.x,dy=event.touches[0].clientY-gesture.y;if(dy<=0||Math.abs(dx)>Math.abs(dy)){reset();return;}if(!event.cancelable){reset();return;}event.preventDefault();gesture.distance=Math.min(96,dy*.55);setDistance(gesture.distance);};
  const end=()=>{const ready=(gesture?.distance??0)>=threshold;reset();if(!ready||busy.current)return;busy.current=true;setRefreshing(true);void refreshAndWait().finally(()=>{busy.current=false;if(active)setRefreshing(false);});};
  document.addEventListener('touchstart',start,{passive:true});document.addEventListener('touchmove',move,{passive:false});document.addEventListener('touchend',end,{passive:true});document.addEventListener('touchcancel',reset,{passive:true});
  return()=>{active=false;document.removeEventListener('touchstart',start);document.removeEventListener('touchmove',move);document.removeEventListener('touchend',end);document.removeEventListener('touchcancel',reset);if(restoreSwipes)tg?.enableVerticalSwipes?.();};
 },[]);
 if(!refreshing&&distance<8)return null;
 return <div className="pull-refresh" role="status" aria-live="polite"><RefreshCw size={19} className={refreshing?'spin':''}/><span>{refreshing?'กำลังรีเฟรชข้อมูล…':distance>=threshold?'ปล่อยเพื่อรีเฟรช':'ลากลงเพื่อรีเฟรช'}</span></div>;
}
