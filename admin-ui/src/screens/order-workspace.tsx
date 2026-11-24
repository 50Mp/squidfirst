import {useEffect,useRef,useState} from 'react';
import {Orders,OrderDetail} from './orders';
import {orderListPath,orderReturnPath,rememberOrderPaneScroll} from '../order-navigation';
import {useWideWorkspace} from '../hooks/use-wide-workspace';

interface OrderWorkspaceProps {readonly path:string;readonly orderId?:string}
export function OrderWorkspace({path,orderId}:Readonly<OrderWorkspaceProps>){
 const wide=useWideWorkspace(),detail=useRef<HTMLElement>(null);
 const [toolbar,setToolbar]=useState<HTMLDivElement|null>(null);
 const listPath=orderId?orderListPath():path;
 const section=new URLSearchParams(path.split('?')[1]??'').get('section');
 useEffect(()=>{if(orderId){detail.current?.scrollTo({top:0});detail.current?.focus({preventScroll:true});}},[orderId]);
 return <div className={'order-workspace'+(orderId?' has-detail':'')+(wide?' desktop-order-workspace':'')}>
  {wide&&<div className="stitch-orders desktop-stitch-orders desktop-order-toolbar" ref={setToolbar}/>}
  <section className="order-list-pane" aria-label="รายการออเดอร์" hidden={!!orderId&&!wide} onScroll={e=>rememberOrderPaneScroll(listPath,e.currentTarget.scrollTop)}><Orders key={listPath} path={listPath} selectedId={orderId} desktop={wide} toolbar={toolbar}/></section>
  {orderId&&<section className="order-detail-pane" aria-label="รายละเอียดออเดอร์" tabIndex={-1} ref={detail}><OrderDetail key={orderId} id={orderId} back={orderReturnPath(orderId)} showHistory={section==='history'} desktop={wide}/></section>}
 </div>;
}
