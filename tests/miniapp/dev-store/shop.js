const form=document.querySelector('#checkout');
const productSelect=document.querySelector('#product');
const fields=document.querySelector('#player-fields');
const feedback=document.querySelector('#feedback');
const result=document.querySelector('#receipt');
let products=[],attempt;

async function request(path,options){
 const response=await fetch(path,options);
 if(!response.ok){
  const body=await response.json().catch(()=>({}));
  const error=new Error(body.error??'เชื่อมต่อระบบทดสอบไม่สำเร็จ');
  error.status=response.status;
  throw error;
 }
 return response.json();
}
function json(body,headers={}){
 return {method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)};
}
async function ensureCustomer(){
 try{await request('/auth/me');}
 catch(error){
  if(error.status!==401)throw error;
  const username='dev_'+crypto.randomUUID().replaceAll('-','').slice(0,16);
  await request('/auth/register',json({username,password:crypto.randomUUID()}));
 }
}
function renderFields(){
 const product=products.find(item=>item.id===productSelect.value);
 fields.replaceChildren();
 document.querySelector('#quote').textContent=product?'$'+product.price_usd+' USD':'';
 for(const key of product?.required_fields??[]){
  const label=document.createElement('label'),input=document.createElement('input');
  label.append(key==='UID'?'UID ผู้เล่น':key);
  input.name=key;
  input.inputMode='numeric';
  input.pattern='[0-9]{1,32}';
  input.maxLength=32;
  input.required=true;
  label.append(input);
  fields.append(label);
 }
}
function setFeedback(text){
 feedback.textContent=text;
 feedback.hidden=!text;
}
function showOrder(order){
 document.querySelector('#order-id').textContent=order.id;
 document.querySelector('#order-price').textContent='$'+order.details.price_usd+' USD';
 document.querySelector('#admin-order').href='/preview?order='+encodeURIComponent(order.id);
 form.hidden=true;
 result.hidden=false;
 document.querySelector('#result-title').focus();
}
productSelect.addEventListener('change',renderFields);
document.querySelector('#again').addEventListener('click',()=>{
 result.hidden=true;
 form.hidden=false;
 form.reset();
 renderFields();
 productSelect.focus();
});
form.addEventListener('submit',async event=>{
 event.preventDefault();
 const controls=document.querySelector('#checkout-fields');
 if(controls.disabled)return;
 const data={product_id:productSelect.value,player:Object.fromEntries(new FormData(form))};
 const body=JSON.stringify(data);
 if(attempt?.body!==body)attempt={body,key:crypto.randomUUID()};
 controls.disabled=true;
 setFeedback('');
 try{
  await ensureCustomer();
  const order=await request('/orders',json(data,{'idempotency-key':attempt.key}));
  attempt=undefined;
  showOrder(order);
 }catch(error){setFeedback(error.message);}
 finally{controls.disabled=false;}
});
try{
 ({data:products}=await request('/shop/products'));
 for(const product of products){
  const option=new Option(product.name+' · '+product.zone.toUpperCase()+' · $'+product.price_usd,product.id);
  productSelect.add(option);
 }
 if(products.length){
  renderFields();
  form.hidden=false;
 }else setFeedback('ไม่มีแพ็กเกจเปิดขายในระบบทดสอบ');
}catch(error){setFeedback(error.message);}
finally{document.querySelector('#loading').hidden=true;}
