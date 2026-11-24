import {ReadNotice} from '../components/read-notice';
import {GameMark} from '../components/game-art';
import freeFireDiamonds from '../free-fire-diamonds.webp';
import mobileLegendsDiamonds from '../mobile-legends-diamonds.webp';
import {useEffect,useRef,useState} from 'react';
import {api,useResource,key,refreshAll,navigate,dollars,confirmAction,type Row} from '../api';
import {PageHeader,Panel,Field,Toggle,ErrorBox,Empty,Loading} from '../components';
import {useWideWorkspace} from '../hooks/use-wide-workspace';
import {ChevronRight,Search,Settings2} from 'lucide-react';
export function Games(){const {data,error,loading}=useResource('/games'),[failure,setFailure]=useState('');async function toggle(g:Row,enabled:boolean,zone?:Row){try{await api('/games/'+g.id+(zone?'/zones/'+encodeURIComponent(zone.zone):''),'PATCH',{enabled,expected_revision:zone?.revision??g.revision,idempotency_key:key()});refreshAll();}catch(e:any){setFailure(e.message);}}return <><PageHeader back="/store" title="เกมและโซน" subtitle="ขายเฉพาะเกมและโซนที่ตรวจสอบแล้ว"/><ReadNotice error={error} cached={!!data}/><ErrorBox message={failure}/>{loading&&!data?<Loading/>:data?.data.map((g:Row)=><Panel key={g.id} title={g.name}><Toggle label="เปิดขายเกมนี้" checked={g.enabled} disabled={loading||!!error} onChange={v=>toggle(g,v)}/>{g.zones.map((z:Row)=><div className="zone-line" key={z.zone}><Toggle label={z.zone==='unspecified'?'ยังไม่ยืนยันโซน · เปิดขายไม่ได้':z.zone.toUpperCase()} checked={z.zone!=='unspecified'&&z.enabled!==false} disabled={loading||!!error||z.zone==='unspecified'} onChange={v=>toggle(g,v,z)}/></div>)}{g.zones.length===0&&<p className="footnote">ยังไม่มีแพ็กเกจจากร้านต้นทาง</p>}</Panel>)}</>;}
const catalogPath='/store/products';
const gameQuery=(game:string)=>game?'?'+new URLSearchParams({game}):'';
const packageListPath=(game:string)=>catalogPath+gameQuery(game);
const packageEditorPath=(game:string,id='new')=>catalogPath+'/'+encodeURIComponent(id)+gameQuery(game);
const diamondArtwork:Record<string,string>={
 'free-fire':freeFireDiamonds,
 'mobile-legends-bang-bang':mobileLegendsDiamonds,
};

function PackageIcon({game,name}:{game:string;name:string}){
 const image=diamondArtwork[game];
 const diamondPack=/^(?:💎\s*\d|\d.*(?:\bdiamonds?\b|💎))/i.test(name.trim());
 return image&&diamondPack?<img className="package-diamond-icon" src={image} alt="" loading="lazy" width={36} height={36}/>:<GameMark gameId={game}/>;
}

export function Products(){
 const {data,error,loading}=useResource<{data:Row[]}>('/games');
 const games=data?.data??[];
 return <>
  <PageHeader back="/store" title="เกมและแพ็กเกจ"/>
  <ReadNotice error={error} cached={!!data}/>
  {loading&&!data?<Loading/>:data&&(games.length?<nav className="package-game-options" aria-label="เลือกเกม">
   {games.map(game=><a key={game.id} href={'#'+packageListPath(game.id)} aria-label={game.name}>
    <GameMark gameId={game.id} large/>
   </a>)}
  </nav>:<Empty title="ยังไม่มีเกมในแค็ตตาล็อก"/>)}
 </>;
}

export function GamePackages({game}:{game:string}){
 const games=useResource<{data:Row[]}>('/games');
 const resource=useResource<{data:Row[]}>('/products?'+new URLSearchParams({game_id:game}));
 const {data,error,loading}=resource;
 const wide=useWideWorkspace();
 const selected=games.data?.data.find(item=>item.id===game);
 const packages=(data?.data??[]).filter(product=>product.game_id===game);
 if(selected&&!Array.isArray(selected.required_fields))return <SourceGamePackages game={game} gameError={games.error} gameLoading={games.loading}/>;
 return <>
  <PageHeader back={catalogPath} title="แพ็กเกจขาย">
   <button className="primary" disabled={!selected||!data||loading||!!error||!!games.error} onClick={()=>navigate(packageEditorPath(game))}>เพิ่มแพ็กเกจ</button>
  </PageHeader>
  <ReadNotice error={error} cached={!!data}/>
  <ReadNotice error={games.error} cached={!!games.data}/>
  {(games.loading&&!games.data)||(loading&&!data)?<Loading/>:games.data&&!selected?<Empty title="ไม่พบเกมนี้"/>:selected&&packages.length>0&&(wide?<Panel>
   {packages.map(p=><button className="product-row" key={p.id} onClick={()=>navigate(packageEditorPath(game,p.id))}><span className="package-title"><PackageIcon game={game} name={p.name}/><span><strong>{p.name}</strong><small>{p.zone.toUpperCase()} · {p.published?'เผยแพร่':'ฉบับร่าง'}</small></span></span><span><b>{dollars(p.preview.details?.price_usd)}</b><small>{p.preview.available?'พร้อมขาย':'ยังขายไม่ได้'}</small></span></button>)}
  </Panel>:<MobileProducts packages={packages} game={game} zones={selected.zones}/>)}
  {selected&&data&&!packages.length&&!loading&&!games.loading&&!error&&!games.error&&<Panel><Empty title="ยังไม่มีแพ็กเกจขายในเกมนี้" text="เพิ่มแพ็กเกจและจับคู่กับร้านต้นทางก่อนเปิดขาย"/></Panel>}
 </>;
}

function SourceGamePackages({game,gameError,gameLoading}:{game:string;gameError:string;gameLoading:boolean}){
 const {data,error,loading}=useResource<{data:Row[]}>('/catalog?'+new URLSearchParams({game_id:game}));
 const offers=data?.data.filter(offer=>offer.game_id===game)??[];
 return <>
  <PageHeader back={catalogPath} title="แพ็กเกจต้นทาง"/>
  <ReadNotice error={gameError} cached/>
  <ReadNotice error={error} cached={!!data}/>
  {(loading&&!data)||(gameLoading&&!offers.length)?<Loading/>:offers.length>0?<Panel>
   {offers.map(offer=><div className="product-row" key={offer.id}>
    <span className="package-title"><PackageIcon game={game} name={offer.name}/><span><strong>{offer.name}</strong><small>{offer.source_id}{offer.zone!=='unspecified'?' · '+offer.zone.toUpperCase():''}</small></span></span>
    <b>{Number(offer.price).toLocaleString('en-US')} LAK</b>
   </div>)}
  </Panel>:data&&!loading&&!error&&!gameLoading&&!gameError?<Panel><Empty title="ยังไม่มีแพ็กเกจต้นทาง" text="ยังไม่มีข้อมูลแพ็กเกจของเกมนี้ที่เก็บไว้ในระบบ"/></Panel>:null}
 </>;
}

function MobileProducts({packages,game,zones:gameZones}:{packages:Row[];game:string;zones:Row[]}){
 const [zone,setZone]=useState(''),[search,setSearch]=useState('');
 const zones=new Set<string>(gameZones.map(item=>item.zone).filter(value=>value!=='unspecified'));
 for(const product of packages)if(product.zone&&product.zone!=='unspecified')zones.add(product.zone);
 const query=search.trim().toLocaleLowerCase('th');
 const visible=packages.filter(product=>
  (!zone||product.zone===zone)&&(!query||[product.name,product.id].some(value=>String(value).toLocaleLowerCase('th').includes(query))),
 );
 function reset(){setZone('');setSearch('');}
 return <div className="mobile-products">
  <div className="search-bar"><Search size={18}/><input type="search" aria-label="ค้นหาแพ็กเกจ" placeholder="ค้นหาแพ็กเกจ…" value={search} onChange={event=>setSearch(event.target.value)}/></div>
  {zones.size>0&&<section className="mobile-product-filters" aria-label="ตัวกรองโซน"><h2>โซน</h2><div className="mobile-product-chips"><button aria-pressed={!zone} onClick={()=>setZone('')}>ทุกโซน</button>{Array.from(zones).sort().map(value=><button key={value} aria-pressed={zone===value} onClick={()=>setZone(value)}>{value.toUpperCase()}</button>)}</div></section>}
  <div className="mobile-product-results" aria-live="polite"><span>{visible.length} รายการ</span></div>
   {visible.length?<div className="mobile-product-list">{visible.map(product=>{
    const quote=product.preview;
    const status=product.published?(quote?.available?'เปิดขายหน้าร้าน':'ยังขายไม่ได้'):'ฉบับร่าง';
    return <article className="mobile-product-card" key={product.id}>
     {product.zone&&<div className="mobile-product-meta"><span>โซน: {product.zone.toUpperCase()}</span></div>}
     <div className="package-title"><PackageIcon game={game} name={product.name}/><h3>{product.name}</h3></div>
     <p className={'mobile-product-state'+(product.published&&quote?.available?' live':'')}>{status}</p>
     <dl className="mobile-product-price">
      <div><dt>ราคาขาย</dt><dd>{dollars(quote?.details?.price_usd)}</dd></div>
      <div><dt>ต้นทุน</dt><dd>{Number.isFinite(quote?.cost_lak)?Number(quote.cost_lak).toLocaleString('en-US')+' LAK':'—'}</dd></div>
      <div><dt>กำไรขั้นต้น</dt><dd>{dollars(quote?.estimated_gross_profit_usd)}</dd></div>
     </dl>
     <a href={'#'+packageEditorPath(game,product.id)} className="secondary" aria-label={'ตั้งราคา '+product.name}><Settings2 size={16}/>ตั้งราคา<ChevronRight size={16}/></a>
    </article>;
   })}</div>:<Panel><Empty title="ไม่พบแพ็กเกจที่ตรงกัน"><button className="secondary" onClick={reset}>ล้างตัวกรอง</button></Empty></Panel>}
 </div>;
}
export function ProductEditor({id,initialGame=''}:{id?:string;initialGame?:string}){
 const listPath='/products'+(initialGame?'?'+new URLSearchParams({game_id:initialGame}):'');
 const all=useResource(listPath),games=useResource('/games'),[game,setGame]=useState(initialGame||'free-fire'),[zone,setZone]=useState('th'),[name,setName]=useState(''),[ids,setIds]=useState<string[]>([]),[defaultMarkup,setDefaultMarkup]=useState(true),[markup,setMarkup]=useState('10'),[published,setPublished]=useState(false),[strategy,setStrategy]=useState('auto_cheapest'),[fixed,setFixed]=useState(''),[confirmed,setConfirmed]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[preview,setPreview]=useState<Row|null>(null),base=useRef<Row|null>(null),previewVersion=useRef(0),[conflict,setConflict]=useState(false);
 const product=all.data?.data.find((p:Row)=>p.id===id&&(!initialGame||p.game_id===initialGame)),back=packageListPath(initialGame||product?.game_id||'');
 const offerGame=product?.game_id??game,offerZone=product?.zone??zone;
 const catalog=useResource(id&&!product?null:'/catalog?'+new URLSearchParams({game_id:offerGame,zone:offerZone}));
 function assignProduct(value:Row){base.current=value;setConfirmed(true);setName(value.name);setGame(value.game_id);setZone(value.zone);setIds(value.offer_ids);setDefaultMarkup(value.use_default_markup);setMarkup(String(value.markup_bps/100));setPublished(value.published);setStrategy(value.strategy);setFixed(value.fixed_offer_id??'');setPreview(null);setConflict(false);setError('');}useEffect(()=>{if(product&&!base.current)assignProduct(product);},[product]);useEffect(()=>{previewVersion.current++;setPreview(null);},[markup,defaultMarkup,strategy,fixed,ids,product?.revision]);async function reloadProduct(){if(!await confirmAction('โหลดข้อมูลล่าสุดและทิ้งการแก้ไขที่ยังไม่บันทึก?'))return;try{const fresh=(await api(listPath)).data.find((p:Row)=>p.id===id&&(!initialGame||p.game_id===initialGame));if(fresh)assignProduct(fresh);}catch(e:any){setError(e.message);}}
 async function save(){if(unavailable)return;if(published&&!await confirmAction('เผยแพร่แพ็กเกจนี้สำหรับออเดอร์ใหม่?'))return;setBusy(true);setError('');try{const common={name,published,use_default_markup:defaultMarkup,markup_bps:Math.round(Number(markup)*100),idempotency_key:key()};if(id)await api('/products/'+id,'PATCH',{...common,strategy,fixed_offer_id:fixed||null,offer_ids:ids,confirmed_equivalent:confirmed,expected_revision:base.current?.revision});else await api('/products','POST',{...common,game_id:game,zone,offer_ids:ids,confirmed_equivalent:confirmed});refreshAll();navigate(packageListPath(product?.game_id??game));}catch(e:any){setError(e.message);if(e.status===409)setConflict(true);}finally{setBusy(false);}}
 const offers=[...new Map<string,Row>([...(product?.offers??[]),...(catalog.data?.data??[])].map((o:Row)=>[o.id,o] as [string,Row])).values()].filter(o=>o.game_id===offerGame&&o.zone===offerZone&&(o.active||ids.includes(o.id)));async function showPreview(){if(unavailable)return;setError('');const request=++previewVersion.current;try{const result=await api('/products/'+id+'/preview','POST',{markup_bps:Math.round(Number(markup)*100),use_default_markup:defaultMarkup,strategy,fixed_offer_id:fixed||null,offer_ids:ids});if(request===previewVersion.current)setPreview(result);}catch(e:any){if(request===previewVersion.current)setError(e.message);}}const quote=preview??product?.preview;const readError=all.error||games.error||catalog.error,readLoading=all.loading||games.loading||catalog.loading,loaded=!!all.data&&!!games.data&&!!catalog.data,unavailable=!games.data?.data.some((item:Row)=>item.id===offerGame&&Array.isArray(item.required_fields))||!loaded||!!readError||readLoading||busy||!!id&&!product;
 return <div className="product-editor"><PageHeader back={back} title={id?'ตั้งค่าแพ็กเกจ':'สร้างแพ็กเกจขาย'} subtitle="กำไรที่ตั้งคือเปอร์เซ็นต์บวกจากทุน ไม่ใช่อัตรากำไรต่อยอดขาย"/><ReadNotice error={readError} cached={!!all.data||!!games.data||!!catalog.data}/><ErrorBox message={error}/>{readLoading&&!loaded&&<Loading/>}{id&&all.data&&!product&&!all.error&&<Empty title="ไม่พบแพ็กเกจนี้" text="กลับไปเลือกรายการแพ็กเกจอีกครั้ง"/>}{conflict&&<button className="secondary" onClick={reloadProduct}>โหลดข้อมูลล่าสุด</button>}{(!id||product)&&<fieldset className="fx-settings-fields" disabled={unavailable}><Panel><Field label="ชื่อแพ็กเกจบนเว็บ"><input value={name} maxLength={200} onChange={e=>setName(e.target.value)}/></Field><div className="form-grid"><Field label="เกม"><select disabled={!!id||!!initialGame} value={game} onChange={e=>{setGame(e.target.value);setIds([]);}}>{games.data?.data.filter((g:Row)=>Array.isArray(g.required_fields)).map((g:Row)=><option value={g.id} key={g.id}>{g.name}</option>)}</select></Field><Field label="โซน"><input disabled={!!id} value={zone} onChange={e=>{setZone(e.target.value.toLowerCase());setIds([]);}} placeholder="th"/></Field></div><Toggle label="ใช้กำไรเริ่มต้นของร้าน" checked={defaultMarkup} onChange={setDefaultMarkup}/>{!defaultMarkup&&<Field label="บวกจากทุน (%)"><input inputMode="decimal" type="number" min="0" max="100" step="0.01" value={markup} onChange={e=>setMarkup(e.target.value)}/></Field>}{id?<Toggle label="เผยแพร่และเปิดขาย" checked={published} onChange={setPublished}/>:<p className="footnote">สร้างเป็นฉบับร่างก่อน ตรวจราคาแล้วจึงเผยแพร่</p>}</Panel><Panel title={id?'ร้านที่จับคู่ในแพ็กเกจนี้':'เลือกแพ็กเกจที่เทียบกันได้'}>{offers.map((o:Row)=><label className="offer-row" key={o.id}>{<input type="checkbox" checked={ids.includes(o.id)} onChange={e=>{setIds(v=>e.target.checked?[...v,o.id]:v.filter(x=>x!==o.id));setConfirmed(false);setPreview(null);}}/>}<span><strong>{o.name}</strong><small>{o.source_id} · {o.zone.toUpperCase()} · {o.active?o.note:"หยุดขายแล้ว · ยกเลิกเลือกได้"}</small></span><b>{Number(o.price).toLocaleString()} LAK</b></label>)}{loaded&&!readError&&!readLoading&&!offers.length&&<Empty title="ไม่พบแพ็กเกจในโซนนี้"/>}{<label className="check-line"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>ตรวจแล้วว่าแพ็กเกจที่เลือกมีจำนวนเพชร โบนัส และเงื่อนไขตรงกัน</label>}{id&&<><Field label="วิธีเลือกร้าน"><select value={strategy} onChange={e=>setStrategy(e.target.value)}><option value="auto_cheapest">เลือกราคาต่ำสุดจากร้านที่เปิดใช้งาน</option><option value="fixed_offer">ใช้ร้านและแพ็กเกจที่เลือก</option></select></Field>{strategy==='fixed_offer'&&<Field label="แพ็กเกจต้นทาง"><select value={fixed} onChange={e=>setFixed(e.target.value)}><option value="">เลือกแพ็กเกจ</option>{offers.filter((o:Row)=>ids.includes(o.id)).map((o:Row)=><option key={o.id} value={o.id}>{o.source_id} · {o.name}</option>)}</select></Field>}</>}</Panel>{product&&<Panel title="ตัวอย่างราคา"><button className="secondary" onClick={showPreview}>คำนวณจากค่าที่เลือก</button>{quote?.available?<div className="preview-line"><span>{preview?"ราคาจากค่าที่เลือก":"ราคาที่บันทึกอยู่"}<br/><small>ทุน {Number(quote.cost_lak).toLocaleString()} LAK · {quote.source_id}<br/>เรท {quote.lak_per_usd} LAK/USD<br/>บวกจากทุน {quote.markup_bps/100}% · กำไรขั้นต้น {dollars(quote.estimated_gross_profit_usd)}</small></span><strong>{dollars(quote.details.price_usd)}</strong></div>:<p className="muted">ยังคำนวณราคาไม่ได้ ตรวจร้าน โซน และเรทที่เลือก</p>}</Panel>}<button className="primary wide product-editor-save" disabled={unavailable||!name.trim()||(!confirmed||!ids.length)} onClick={save}>บันทึกแพ็กเกจ</button></fieldset>}</div>;
}
