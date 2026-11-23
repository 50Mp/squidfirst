import {RefreshCw} from 'lucide-react';
import {refreshAll} from '../api';
import {ErrorBox} from '../components';

interface ReadNoticeProps {readonly error?:string; readonly cached?:boolean}
export function ReadNotice({error,cached=false}:Readonly<ReadNoticeProps>){
 if(!error)return null;
 return <div className="read-notice"><ErrorBox message={error}/>{cached&&<p className="muted small">กำลังแสดงข้อมูลที่โหลดไว้ก่อนหน้า กรุณาโหลดใหม่ก่อนดำเนินการ</p>}<button className="secondary" onClick={refreshAll}><RefreshCw size={16}/>ลองโหลดอีกครั้ง</button></div>;
}
