import {useState} from 'react';
import {Calculator} from 'lucide-react';
import {previewLakForUsd} from '../fx-converter';

interface FxExampleProps {readonly rate:string;readonly disabled?:boolean}
export function FxExample({rate,disabled=false}:Readonly<FxExampleProps>){
 const [amount,setAmount]=useState('10'),result=previewLakForUsd(amount,rate);
 return <section className="fx-example" aria-label="ทดลองแปลงสกุลเงิน"><h3><Calculator size={19}/>ทดลองแปลง USD เป็น LAK</h3><p>ตัวอย่างจากค่าที่เลือก · ยังไม่บันทึกหรือเปลี่ยนราคาออเดอร์</p><label className="field"><span>จำนวน USD ทดลอง</span><input inputMode="decimal" aria-label="จำนวน USD ทดลอง" value={amount} onChange={e=>setAmount(e.target.value)} disabled={disabled}/></label><div className="fx-example-amounts">{['5','10','20','50','100'].map(v=><button type="button" key={v} aria-label={'ทดลอง $'+v} aria-pressed={amount===v} disabled={disabled} onClick={()=>setAmount(v)}>${v}</button>)}</div><output role="status" aria-label="ผลคำนวณตัวอย่าง">{result?result+' LAK':'กรอกจำนวนและเรทที่ถูกต้อง'}</output></section>;
}
