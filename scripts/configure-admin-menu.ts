// Dry-run by default. Requires a reviewed deployed HTTPS target before --apply.
const token=process.env.TELEGRAM_API_TOKEN_BOT||process.env.TELEGRAM_BOT_TOKEN,chat=process.env.TELEGRAM_ADMIN_CHAT_ID,raw=process.env.ADMIN_APP_URL;
if(!token||!chat||chat!==process.env.TELEGRAM_ADMIN_USER_ID||!raw)throw Error('Configure the existing bot, matching private owner IDs and ADMIN_APP_URL');
const url=new URL(raw);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/admin-app/'||url.search||url.hash)throw Error('ADMIN_APP_URL must be https://your-domain/admin-app/');
const body={chat_id:chat,menu_button:{type:'web_app',text:'จัดการร้าน',web_app:{url:url.toString()}}};
if(!process.argv.includes('--apply'))console.log('Prepared owner-only menu for '+url.origin+'/admin-app/. No Telegram changes made.');
else{try{const response=await fetch('https://api.telegram.org/bot'+token+'/setChatMenuButton',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const result=await response.json() as {ok?:boolean};if(!response.ok||!result.ok)throw Error('Rejected');console.log('Admin menu configured for the existing owner chat');}catch{throw Error('Telegram menu update failed (credentials omitted)');}}
export{};
