import {StitchIcon} from './stitch-icon';
import {useState} from 'react';

import {previewLakForUsd} from '../fx-converter';

interface FxExampleProps {readonly rate:string;readonly disabled?:boolean}
export function FxExample({rate,disabled=false}:Readonly<FxExampleProps>){
 const [amount,setAmount]=useState('10'),result=previewLakForUsd(amount,rate);
 return <section className="fx-example" aria-label="แปลงสกุลเงิน"><h3><StitchIcon name="calculate" size={19}/>แปลง USD เป็น LAK</h3><p>คำนวณจากเรทที่เลือก</p><label className="field"><span>จำนวน USD</span><input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} disabled={disabled}/></label><output role="status" aria-label="ผลคำนวณตัวอย่าง">{result?result+' LAK':'กรอกจำนวนและเรทที่ถูกต้อง'}</output></section>;
}
