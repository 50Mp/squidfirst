import {StitchIcon} from './components/stitch-icon';
import type {ReactNode} from 'react';
import squidLogo from './squid-logo.png';
import {AlertTriangle,ArrowLeft,ChevronRight,LoaderCircle,Package,Check,Clock3} from 'lucide-react';
import {GameMark} from './components/game-art';
import {navigate,statuses,dateTime,dollars,gameName,shortId,type Row} from './api';
export function SquidMark(){return <img className="squid-logo" src={squidLogo} alt="" aria-hidden="true" width={44} height={44}/>;}
export function PageHeader({title,subtitle,back,backIcon,children}:{title:string;subtitle?:string;back?:string;backIcon?:string;children?:ReactNode}){return <header className="page-heading"><div>{back&&<button className="back-link" onClick={()=>navigate(back)}>{backIcon?<StitchIcon name={backIcon} size={20}/>:<ArrowLeft size={16}/>}ย้อนกลับ</button>}<h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{children}</header>;}
export function Status({value}:{value:string}){return <span className={'status '+value}>{['completed'].includes(value)?<Check size={13}/>:value==='issue'?<AlertTriangle size={13}/>:<Clock3 size={13}/>} {statuses[value]??value}</span>;}
export function ErrorBox({message}:{message?:string}){return message?<div className="error-box" role="alert"><AlertTriangle size={18}/><span>{message}</span></div>:null;}
export function Loading(){return <div className="loading" role="status"><LoaderCircle className="spin" size={22}/>กำลังโหลดข้อมูล…</div>;}
export function Empty({title='ยังไม่มีรายการ',text,children}:{title?:string;text?:string;children?:ReactNode}){return <div className="empty"><span className="empty-icon"><Package size={27}/></span><h3>{title}</h3>{text&&<p>{text}</p>}{children}</div>;}
export function Panel({title,children,aside}:{title?:string;children:ReactNode;aside?:ReactNode}){return <section className="panel">{title&&<div className="panel-heading"><h2>{title}</h2>{aside}</div>}{children}</section>;}
export function Toggle({label,checked,disabled,onChange}:{label:string;checked:boolean;disabled?:boolean;onChange:(v:boolean)=>void}){return <label className="toggle-label"><span>{label}</span><input role="switch" type="checkbox" checked={checked} disabled={disabled} onChange={e=>onChange(e.target.checked)}/><span className="toggle-track" aria-hidden="true"/></label>;}
export function displayText(value:unknown,fallback='—'){return typeof value==='string'&&value.trim()?value.replace(/\bmock\b/gi,'ข้อมูลทดสอบ').trim():fallback;}
export function OrderRow({order}:{order:Row}){const d=order.details??order.public_snapshot??{};const name=displayText(d.name?.replace(/^Free Fire\s*/,'').replace(/\s*[—-]\s*Player.*\(MOCK\)/i,''));return <button className="order-row" onClick={()=>navigate('/orders/'+order.id)}><GameMark gameId={d.game_id}/><span className="order-main"><span className="order-line"><strong>#{shortId(order.id)}</strong></span><span className="order-package">{gameName(d.game_id)} <span>·</span> {name}</span><span className="order-meta">{dateTime(order.created_at)} {d.mock&&<b className="mock-tag">ทดสอบ</b>}</span></span><span className="order-end"><strong>{dollars(d.price_usd)}</strong><Status value={order.status}/></span><ChevronRight className="row-chevron" size={16}/></button>;}
export function Field({label,children}:{label:string;children:ReactNode}){return <label className="field"><span>{label}</span>{children}</label>;}
export function Stat({label,value,note}:{label:string;value:string|number;note?:string}){return <div className="stat"><span>{label}</span><strong>{value}</strong>{note&&<small>{note}</small>}</div>;}
