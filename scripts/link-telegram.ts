import { readFile,writeFile } from 'node:fs/promises';

// Reads only pending Bot API updates; never sends a message or changes webhooks.
const token=process.env.TELEGRAM_API_TOKEN_BOT||process.env.TELEGRAM_BOT_TOKEN;
if(!token)throw new Error('Set TELEGRAM_API_TOKEN_BOT in .env');
const setup=JSON.parse(await readFile('data/telegram-setup.json','utf8'));
if(Date.now()-Date.parse(setup.created_at)>30*60000)throw new Error('Telegram setup link expired; generate a new challenge');
let json:any;
try{const response=await fetch(`https://api.telegram.org/bot${token}/getUpdates`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({timeout:0,allowed_updates:['message','callback_query']}),signal:AbortSignal.timeout(15000)});json=await response.json();}
catch{throw new Error('Telegram setup network request failed');}
if(!json.ok)throw new Error(`Telegram setup API failure ${Number(json.error_code)}`);
const matches=json.result.filter((u:any)=>u.message?.text===`/start ${setup.code}`&&u.message.chat?.type==='private'&&String(u.message.chat.id)===String(u.message.from?.id)&&!u.message.from?.is_bot);
const ids=[...new Set(matches.map((u:any)=>String(u.message.from.id)))];
if(ids.length===0){console.log('Waiting for admin to press Start on the supplied setup link.');process.exit(0);}
if(ids.length!==1)throw new Error('Ambiguous setup confirmations; do not enable Telegram');
let env=await readFile('.env','utf8');
for(const [key,value] of Object.entries({TELEGRAM_ADMIN_CHAT_ID:ids[0],TELEGRAM_ADMIN_USER_ID:ids[0],TELEGRAM_ENABLED:'true'})){
 const line=`${key}=${value}`;env=new RegExp(`^${key}=.*$`,'m').test(env)?env.replace(new RegExp(`^${key}=.*$`,'m'),line):env+'\n'+line+'\n';
}
await writeFile('.env',env);await writeFile('data/telegram-setup.json',JSON.stringify({...setup,used_at:new Date().toISOString()}));
console.log('Private admin account verified; IDs saved locally. Token and account IDs not displayed.');
