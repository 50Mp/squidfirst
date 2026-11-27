import {StitchIcon} from './stitch-icon';

interface ChatMessageModeProps {readonly value:'public'|'internal';readonly disabled:boolean;readonly onChange:(value:'public'|'internal')=>void}
export function ChatMessageMode({value,disabled,onChange}:Readonly<ChatMessageModeProps>){
 return <fieldset className="chat-message-mode" disabled={disabled}><legend className="sr-only">ประเภทข้อความ</legend><label><input type="radio" name="chat-visibility" value="public" checked={value==='public'} onChange={()=>onChange('public')}/><StitchIcon name="chat" size={17}/><span>ตอบลูกค้า</span></label><label><input type="radio" name="chat-visibility" value="internal" checked={value==='internal'} onChange={()=>onChange('internal')}/><StitchIcon name="lock" size={17}/><span>บันทึกภายใน<span className="sr-only"> · ลูกค้าไม่เห็น</span></span></label></fieldset>;
}
