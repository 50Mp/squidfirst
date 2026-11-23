import {useEffect,useRef} from 'react';
import {ClipboardList} from 'lucide-react';
import {Orders,OrderDetail} from './orders';
import {orderListPath,orderReturnPath,rememberOrderPaneScroll} from '../order-navigation';
import {useWideWorkspace} from '../hooks/use-wide-workspace';

interface OrderWorkspaceProps {readonly path:string;readonly orderId?:string}
export function OrderWorkspace({path,orderId}:Readonly<OrderWorkspaceProps>){
 const wide=useWideWorkspace(),detail=useRef<HTMLElement>(null);
 const listPath=orderId?orderListPath():path;
 useEffect(()=>{if(orderId){detail.current?.scrollTo({top:0});detail.current?.focus({preventScroll:true});}},[orderId]);
 return <div className={'order-workspace'+(orderId?' has-detail':'')}>
  <section className="order-list-pane" aria-label="รายการออเดอร์" hidden={!!orderId&&!wide} onScroll={e=>rememberOrderPaneScroll(listPath,e.currentTarget.scrollTop)}><Orders key={listPath} path={listPath} selectedId={orderId}/></section>
  {orderId?<section className="order-detail-pane" aria-label="รายละเอียดออเดอร์" tabIndex={-1} ref={detail}><OrderDetail key={orderId} id={orderId} back={orderReturnPath(orderId)}/></section>:wide?<section className="order-detail-pane detail-placeholder" aria-label="รายละเอียดออเดอร์"><ClipboardList size={38}/><h2>เลือกออเดอร์เพื่อดูรายละเอียด</h2><p>ตรวจสลิปและดำเนินการต่อได้จากพื้นที่นี้</p></section>:null}
 </div>;
}
