import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {openDatabase} from '../src/database.js';
import {AdminAuth} from '../src/admin/auth.js';

const token='123:test-token',origin='https://admin.example.com';
function signed(id='123',date=Math.floor(Date.now()/1000)){
 const values=new URLSearchParams({auth_date:String(date),query_id:randomUUID(),user:JSON.stringify({id:Number(id),first_name:'Owner'})});
 const data=[...values.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
 const secret=createHmac('sha256','WebAppData').update(token).digest();
 values.set('hash',createHmac('sha256',secret).update(data).digest('hex'));return values.toString();
}
test('Mini App login validates signature, age and owner and protects sessions and CSRF',async()=>{
 const db=await openDatabase('memory:');
 try{
  const auth=new AdminAuth(db,{botToken:token,ownerTelegramId:'123',origin});await auth.init();
  await assert.rejects(auth.login(signed('123').replace('Owner','Intruder')),/invalid|signature/i);
  await assert.rejects(auth.login(signed('999')),/owner|authorized|permission/i);
  await assert.rejects(auth.login(signed('123',Math.floor(Date.now()/1000)-301)),/expired|age/i);
  await assert.rejects(auth.login(signed('123',Math.floor(Date.now()/1000)+31)),/future|age/i);
  const raw=signed();const session=await auth.login(raw);
  assert.equal(session.actor.role,'owner');assert.equal(session.actor.telegramUserId,'123');
  const actor=await auth.authenticate(session.token);assert.equal(actor.id,session.actor.id);
  await auth.authorizeWrite(session.token,origin,session.csrf);
  await assert.rejects(auth.authorizeWrite(session.token,'https://other.example.com',session.csrf),/origin/i);
  await assert.rejects(auth.authorizeWrite(session.token,origin,'wrong'),/CSRF/i);
  await assert.rejects(auth.login(raw),/used|replay/i);
  await assert.rejects(auth.login([...new URLSearchParams(raw).entries()].reverse().map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&')),/used|replay/i);
  await auth.logout(session.token);await assert.rejects(auth.authenticate(session.token),/session|login/i);
  const second=await auth.login(signed('123',Math.floor(Date.now()/1000)-1));
  await db.query('UPDATE admin_users SET disabled=TRUE WHERE id=$1',[second.actor.id]);
  await assert.rejects(auth.authenticate(second.token),/session|disabled/i);
 }finally{await db.close();}
});
