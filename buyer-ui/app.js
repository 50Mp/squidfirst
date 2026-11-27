const view = document.querySelector('#view');
const identity = document.querySelector('#identity');
const nav = [...document.querySelectorAll('nav a')];
const usd = new Intl.NumberFormat('th', {style:'currency', currency:'USD', currencyDisplay:'code'});
const statuses = {
  awaiting_payment:'รอชำระเงิน', payment_review:'รอตรวจหลักฐาน', paid:'ชำระแล้ว',
  accepted:'รับรายการแล้ว', processing:'กำลังเติม', completed:'ส่งมอบสำเร็จ',
  issue:'พบปัญหา', refunded:'คืนเงินแล้ว', cancelled:'ยกเลิกแล้ว',
};
let user, revision = 0, authReady = false;
let checkoutAttempt;
const page = () => location.hash.slice(1).split('/')[0] || 'home';

function node(tag, text, parent, className){
  const el = document.createElement(tag);
  if(text) el.textContent = text;
  if(className) el.className = className;
  parent?.append(el);
  return el;
}
function link(parent, title, href, secondary=false){
  const el = node('a',title,parent,'button'+(secondary?' secondary':''));
  el.href = href;
  return el;
}
function button(parent, title, run){
  const el = node('button',title,parent);
  el.type = 'button';
  el.addEventListener('click',run);
  return el;
}
async function api(path, options={}){
  const response = await fetch(path, {...options, credentials:'same-origin', cache:'no-store'});
  const result = await response.json().catch(()=>({}));
  if(!response.ok){
    const err = new Error(result.error || 'เชื่อมต่อระบบไม่สำเร็จ');
    err.status = response.status;
    throw err;
  }
  return result;
}
function json(path, body, headers={}){
  return api(path,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
}
function title(text){
  node('h1',text,view).id = 'page-title';
}
function notice(parent){
  const el = node('p','',parent,'notice');
  el.setAttribute('role','status');
  return el;
}
function accountRequired(){
  if(user) return false;
  node('p','เข้าสู่ระบบเพื่อดูข้อมูลบัญชีของคุณ',view,'muted');
  link(view,'เข้าสู่ระบบ','#account');
  return true;
}
function field(parent,label,options){
  const wrap = node('label',label,parent);
  const el = node(options.multiline?'textarea':'input','',wrap);
  const {multiline,...attrs} = options;
  Object.assign(el,attrs);
  return el;
}
function failure(error){
  if(error.status===401 || error.status===403) return 'กรุณาเข้าสู่ระบบใหม่ แล้วลองอีกครั้ง';
  if(error.status===429) return 'ทำรายการบ่อยเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง';
  if(error.message==='Selling price changed') return 'ราคาแพ็กเปลี่ยนแล้ว กรุณากลับไปเลือกราคาใหม่';
  if(error.message==='Ordering is not enabled yet') return 'ร้านค้ายังไม่เปิดรับออเดอร์';
  return error.status===400?'ข้อมูลไม่ถูกต้อง กรุณาตรวจแล้วลองอีกครั้ง':'ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง';
}
function productImage(parent,game){
  const file = game==='mobile-legends-bang-bang'?'mlbb.webp':game==='free-fire'?'free-fire.webp':null;
  if(!file) return;
  const image = node('img','',parent,'game-icon');
  Object.assign(image,{src:'/buyer/'+file,alt:'',width:44,height:44});
}
async function store(ticket){
  title('ร้านค้า');
  const loading = node('p','กำลังโหลดแพ็กเกจ…',view,'muted');
  const {data} = await api('/shop/products');
  if(ticket!==revision) return;
  loading.remove();
  if(!data.length){ node('p','ยังไม่มีแพ็กเกจที่เปิดขาย',view,'card'); return; }
  const list = node('div','',view,'grid');
  for(const product of data){
    const card = node('article','',list,'card');
    const heading = node('div','',card,'product-header');
    productImage(heading,product.game_id);
    node('h2',product.name,heading);
    node('p',product.zone.toUpperCase(),card,'muted');
    node('p',usd.format(product.price_usd),card,'price');
    button(card,'เลือกแพ็ก',()=>review(product));
  }
}
function review(product){
  view.replaceChildren();
  title('ตรวจผู้รับและยอด');
  const form = node('form','',view,'card');
  node('h2',product.name,form);
  node('p',product.zone.toUpperCase(),form,'muted');
  node('p',usd.format(product.price_usd),form,'price');
  if(!user){accountRequired();button(view,'กลับร้านค้า',()=>void render()).className='secondary';return;}
  const inputs = node('fieldset','',form);
  for(const key of product.required_fields){
    field(inputs,/zone|server/i.test(key)?'Zone / เซิร์ฟเวอร์':'UID ผู้เล่น',
      {name:key,required:true,inputMode:'numeric',pattern:'[0-9]{1,32}',maxLength:32,autocomplete:'off'});
  }
  const acknowledgement = field(inputs,'ฉันตรวจแล้วว่าไอดีเกมและยอดถูกต้อง',{type:'checkbox',required:true,className:'check'});
  acknowledgement.parentElement.classList.add('check-label');
  const submit = node('button','ยืนยันและสร้างออเดอร์',inputs);
  submit.type = 'submit';
  const status = notice(form);
  button(view,'กลับร้านค้า',()=>void render()).className='secondary';
  form.onsubmit = async event=>{
    event.preventDefault();
    if(inputs.disabled) return;
    const payload = {product_id:product.id,expected_price_usd:product.price_usd,player:Object.fromEntries(new FormData(form))};
    const signature = JSON.stringify([user.id,payload]);
    if(checkoutAttempt?.signature!==signature) checkoutAttempt={signature,key:crypto.randomUUID()};
    inputs.disabled=true;
    status.textContent='กำลังสร้างออเดอร์…';
    try {
      const order = await json('/orders',payload,{'idempotency-key':checkoutAttempt.key});
      checkoutAttempt=undefined;
      location.hash='orders/'+encodeURIComponent(order.id);
    } catch(error){status.textContent=failure(error);}
    finally{inputs.disabled=false;}
  };
}
async function history(ticket){
  title('ออเดอร์');
  if(accountRequired()) return;
  const id = location.hash.slice(1).split('/')[1];
  if(id){await orderDetail(id,ticket);return;}
  const loading = node('p','กำลังโหลดออเดอร์…',view,'muted');
  const {data} = await api('/orders');
  if(ticket!==revision) return;
  loading.remove();
  if(!data.length) node('p','ยังไม่มีออเดอร์',view,'card');
  for(const order of data){
    const card = node('article','',view,'card');
    node('h2',order.name,card);
    node('p',(statuses[order.status]??'กำลังตรวจสอบ')+' · '+usd.format(order.price_usd),card);
    link(card,'ดูสถานะ','#orders/'+encodeURIComponent(order.id),true);
  }
}
async function orderDetail(id,ticket){
  const loading = node('p','กำลังโหลดสถานะ…',view,'muted');
  const order = await api('/orders/'+encodeURIComponent(id));
  if(ticket!==revision) return;
  loading.remove();
  const card = node('article','',view,'card');
  node('h2',order.details.name,card);
  node('p','เลขออเดอร์ '+order.id,card,'muted');
  node('p',usd.format(order.details.price_usd),card,'price');
  node('p','สถานะออเดอร์: '+(statuses[order.status]??'กำลังตรวจสอบ'),card);
  const payment = order.status==='refunded'?'คืนเงินแล้ว':order.payment_verified?'ยืนยันแล้ว':
    order.status==='payment_review'?'รอตรวจหลักฐาน':order.status==='cancelled'?'ยกเลิกแล้ว':'ยังไม่ยืนยัน';
  node('p','การชำระเงิน: '+payment,card,'muted');
  const needsNewSlip=order.status==='issue' && !order.payment_verified;
  if(order.status==='awaiting_payment'||needsNewSlip){
    node('p',needsNewSlip
      ?order.slip_issue?.customer_message||'กรุณาตรวจสอบและแนบหลักฐานการชำระเงินใหม่'
      :'สอบถามวิธีชำระเงินกับร้าน เมื่อชำระแล้วจึงแนบหลักฐานด้านล่าง',card);
    link(card,'ถามร้านในแชท','#home',true);
    const form = node('form','',card);
    const file = field(form,'หลักฐานการชำระเงิน',{type:'file',required:true,accept:'image/png,image/jpeg,application/pdf'});
    const submit=node('button','ส่งหลักฐาน',form);
    const status=notice(form);
    form.onsubmit=async event=>{
      event.preventDefault();
      const receipt=file.files[0];
      if(!receipt || !['image/png','image/jpeg','application/pdf'].includes(receipt.type) || receipt.size>5*1024*1024){
        status.textContent='เลือก PNG, JPEG หรือ PDF ขนาดไม่เกิน 5 MB';
        return;
      }
      submit.disabled=true;
      try{
        await api('/orders/'+encodeURIComponent(id)+'/receipts',{method:'POST',headers:{'content-type':receipt.type},body:receipt});
        if(ticket===revision) await render();
      }catch(error){status.textContent=failure(error);}
      finally{submit.disabled=false;}
    };
  } else if(order.status==='payment_review'){
    node('p','ร้านได้รับหลักฐานแล้ว กรุณารอตรวจสอบรายการเดิม',card);
  }
  const actions=node('div','',view,'actions');
  link(actions,'ออเดอร์ทั้งหมด','#orders',true);
  button(actions,'อัปเดตสถานะ',()=>void render()).className='secondary';
}
async function home(ticket){
  title('คุยกับ SQUID');
  const greeting = node('div','',view,'card');
  node('p','หาแพ็กเติมเกม เช็กออเดอร์ หรือส่งข้อความถึงร้าน',greeting);
  const actions=node('div','',greeting,'actions');
  link(actions,'ดูแพ็กเติมเกม','#store');
  link(actions,'เช็กออเดอร์','#orders',true);
  if(accountRequired()) return;
  const card = node('section','',view,'card');
  node('h2','แชทกับร้าน',card);
  const log=node('div','',card,'chat-log');
  log.setAttribute('role','log');
  const form=node('form','',card);
  const input=field(form,'ข้อความ',{multiline:true,maxLength:2000,required:true});
  const send=node('button','ส่งข้อความ',form);
  const status=notice(form);
  let attempt, cursor = 0, reading = false;
  async function read(){
    if(reading) return;
    reading=true;
    try {
      const data=await api('/chat?after='+encodeURIComponent(cursor));
      if(ticket!==revision) return;
      for(const item of data.messages){
        const message=node('p',(item.sender==='customer'?'คุณ: ':'ร้าน: ')+item.text,log,'message');
        if(item.sender==='customer') message.dataset.own='';
        if(item.attachment){
          const file=node('a',item.attachment.name,message);
          file.href='/chat/messages/'+encodeURIComponent(item.id)+'/attachment';
          file.download=item.attachment.name;
        }
      }
      cursor=data.next_cursor;
      if(data.messages.length) log.scrollTop=log.scrollHeight;
    } finally {reading=false;}
  }
  form.onsubmit=async event=>{
    event.preventDefault();
    if(send.disabled || !input.value.trim()) return;
    const message=input.value.trim();
    if(attempt?.message!==message) attempt={message,key:crypto.randomUUID()};
    send.disabled=true;
    try{
      await json('/chat/messages',{text:message,client_message_id:attempt.key});
      attempt=undefined;
      if(input.value.trim()===message) input.value='';
      status.textContent='ส่งแล้ว';
      await read();
    }catch(error){status.textContent=failure(error);}
    finally{send.disabled=false;}
  };
  button(card,'โหลดข้อความล่าสุด',()=>void read().catch(error=>{status.textContent=failure(error);})).className='secondary';
  await read();
}
function account(){
  title('บัญชี');
  if(user){
    node('p',user.username,view,'card');
    button(view,'ออกจากระบบ',async event=>{
      event.target.disabled=true;
      try{await json('/auth/logout',{});user=null;checkoutAttempt=undefined;await render();}
      catch(error){notice(view).textContent=failure(error);}
      finally{event.target.disabled=false;}
    });
    return;
  }
  const form=node('form','',view,'card');
  const inputs=node('fieldset','',form);
  field(inputs,'ชื่อผู้ใช้',{name:'username',required:true,minLength:3,maxLength:30,autocomplete:'username',autocapitalize:'none'});
  field(inputs,'รหัสผ่าน',{name:'password',type:'password',required:true,minLength:12,maxLength:128,autocomplete:'current-password'});
  const actions=node('div','',inputs,'actions');
  for(const [value,label] of [['login','เข้าสู่ระบบ'],['register','สมัครบัญชี']]){
    const submit=node('button',label,actions,value==='register'?'secondary':'');
    submit.value=value;
    submit.type='submit';
  }
  const status=notice(form);
  form.onsubmit=async event=>{
    event.preventDefault();
    if(inputs.disabled) return;
    const body=Object.fromEntries(new FormData(form));
    inputs.disabled=true;
    try{
      ({user}=await json('/auth/'+(event.submitter?.value==='register'?'register':'login'),body));
      await render();
    }catch(error){status.textContent=error.status===401?'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง':failure(error);}
    finally{inputs.disabled=false;}
  };
}
async function render(){
  const ticket=++revision;
  const route=page();
  identity.textContent=user?.username??'';
  document.body.dataset.theme=route==='feed'?'dark':'light';
  for(const tab of nav){
    if(tab.hash==='#'+route) tab.setAttribute('aria-current','page');
    else tab.removeAttribute('aria-current');
  }
  view.replaceChildren();
  window.scrollTo(0,0);
  try {
    if(!authReady){title('SQUID FIRST');node('p','กำลังตรวจบัญชี…',view);return;}
    if(route==='store') await store(ticket);
    else if(route==='orders') await history(ticket);
    else if(route==='account') account();
    else if(route==='feed'){title('ฟีด');node('p','ฟีดชุมชนยังไม่เปิดให้ใช้งาน',view,'card');}
    else await home(ticket);
  } catch(error) {
    if(ticket===revision){
      view.replaceChildren();
      title('เปิดหน้านี้ไม่สำเร็จ');
      notice(view).textContent=failure(error);
      button(view,'ลองอีกครั้ง',()=>void render());
    }
  }
}
window.addEventListener('hashchange',()=>{void render();view.focus();});
await render();
try {({user}=await api('/auth/me'));}
catch(error){if(error.status!==401) console.warn('Session check failed');}
authReady=true;
await render();
