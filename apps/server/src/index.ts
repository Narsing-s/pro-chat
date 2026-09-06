import Fastify from 'fastify';
import cors from '@fastify/cors';
import {Server} from 'socket.io';
import {createServer} from 'node:http';
import {createHmac,randomBytes,randomUUID,scryptSync,timingSafeEqual} from 'node:crypto';
import {db,initDb,closeDb} from './db.js';

const app=Fastify({logger:true,bodyLimit:256*1024});
const origin=process.env.WEB_ORIGIN||true;
await app.register(cors,{origin});
const secret=process.env.SESSION_SECRET;
if(!secret)throw new Error('SESSION_SECRET is required in production');
const SESSION_SECRET=secret;

type User={id:string;name:string;createdAt:string;email?:string;phoneNumber?:string;username?:string;passwordHash?:string;online?:boolean};
type Message={id:string;chatId:string;senderId:string;text:string;createdAt:string;delivered:boolean;read:boolean};
const norm=(v:any)=>String(v??'').trim().toLowerCase();
const phone=(v:any)=>String(v??'').replace(/[\s().-]/g,'').trim();
const hash=(p:string)=>{const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(p,salt,64).toString('hex')}`};
const check=(p:string,s?:string)=>{try{if(!s)return false;const [salt,h]=s.split(':');const a=scryptSync(p,salt,64),b=Buffer.from(h,'hex');return a.length===b.length&&timingSafeEqual(a,b)}catch{return false}};
const sign=(v:string)=>createHmac('sha256',SESSION_SECRET).update(v).digest('hex');
const tokenFor=(id:string)=>{const p=Buffer.from(JSON.stringify({u:id,t:Date.now()})).toString('base64url');return `${p}.${sign(p)}`};
const verify=(t:string)=>{try{const [p,s]=t.split('.');const e=sign(p);if(!p||!s||s.length!==e.length||!timingSafeEqual(Buffer.from(s),Buffer.from(e)))return null;const x=JSON.parse(Buffer.from(p,'base64url').toString());return Date.now()-Number(x.t)<30*86400000?String(x.u):null}catch{return null}};
const auth=(req:any)=>{const h=String(req.headers.authorization||'');return h.startsWith('Bearer ')?verify(h.slice(7)):null};
const publicUser=(u:any,token?:string)=>({id:u.id,name:u.name,email:u.email,phoneNumber:u.phone_number??u.phoneNumber,username:u.username,createdAt:new Date(u.created_at??u.createdAt).toISOString(),online:!!u.online,...token?{token}:{}});
const chatUsers=(id:string)=>id.split(':');
const sockets=new Map<string,string>();

await initDb();
app.get('/health',async()=>({ok:true,service:'pro-chat',database:'neon-postgresql',time:new Date().toISOString()}));

app.post<{Body:{email?:string;phoneNumber?:string;username?:string;password?:string}}>('/api/auth/register',async(req,reply)=>{
 const email=norm(req.body?.email),ph=phone(req.body?.phoneNumber),username=norm(req.body?.username),password=String(req.body?.password||'');
 if(!email.includes('@'))return reply.code(400).send({error:'Enter a valid email address'});
 if(ph.replace(/\D/g,'').length<7)return reply.code(400).send({error:'Enter a valid phone number'});
 if(!/^[a-z0-9_]{3,30}$/.test(username))return reply.code(400).send({error:'Username must be 3-30 characters using letters, numbers, or underscore'});
 if(password.length<8)return reply.code(400).send({error:'Password must contain at least 8 characters'});
 const du=await db.query('SELECT id FROM pro_chat_users WHERE email=$1 OR phone_number=$2 OR username=$3 LIMIT 1',[email,ph,username]);
 if(du.rowCount)return reply.code(409).send({error:'An account already exists with that email, phone number, or username'});
 const id=randomUUID(),created=new Date();
 await db.query('INSERT INTO pro_chat_users(id,name,created_at,email,phone_number,username,password_hash) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,username,created,email,ph,username,hash(password)]);
 const token=tokenFor(id);await db.query('INSERT INTO pro_chat_sessions(token,user_id,created_at,expires_at) VALUES($1,$2,$3,$4)',[token,id,created,new Date(Date.now()+30*86400000)]);
 return {id,name:username,email,phoneNumber:ph,username,createdAt:created.toISOString(),online:false,token};
});

app.post<{Body:{identifier?:string;password?:string}}>('/api/auth/login',async(req,reply)=>{
 const id=String(req.body?.identifier||'').trim(),p=String(req.body?.password||'');if(!id||!p)return reply.code(400).send({error:'Enter your login details'});
 const e=norm(id),ph=phone(id),u=norm(id);const r=await db.query('SELECT * FROM pro_chat_users WHERE email=$1 OR phone_number=$2 OR username=$3 LIMIT 1',[e,ph,u]);const user=r.rows[0];
 if(!user||!check(p,user.password_hash))return reply.code(401).send({error:'Invalid username, email/phone, or password'});
 const token=tokenFor(user.id);await db.query('INSERT INTO pro_chat_sessions(token,user_id,created_at,expires_at) VALUES($1,$2,NOW(),NOW()+INTERVAL \'30 days\')',[token,user.id]);return publicUser(user,token);
});

app.post<{Body:{identifier?:string}}>('/api/auth/forgot-password',async(req)=>{
 const id=String(req.body?.identifier||'').trim(),r=await db.query('SELECT * FROM pro_chat_users WHERE email=$1 OR phone_number=$2 OR username=$3 LIMIT 1',[norm(id),phone(id),norm(id)]),u=r.rows[0];
 if(u?.email){const t=randomBytes(32).toString('hex');await db.query('DELETE FROM pro_chat_reset_tokens WHERE user_id=$1',[u.id]);await db.query('INSERT INTO pro_chat_reset_tokens(token,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL \'15 minutes\')',[t,u.id]);if(process.env.RESEND_API_KEY){try{await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.RESEND_FROM||'Pro Chat <onboarding@resend.dev>',to:[u.email],subject:'Pro Chat password reset',html:`<p><a href="${process.env.WEB_ORIGIN||''}/?reset=${t}">Reset your Pro Chat password</a></p><p>This link expires in 15 minutes.</p>`})})}catch(e){app.log.error(e)}}}
 return {message:'If the account exists and has an email address, password reset instructions have been sent.'};
});

app.post<{Body:{token?:string;password?:string}}>('/api/auth/reset-password',async(req,reply)=>{const t=String(req.body?.token||''),p=String(req.body?.password||'');if(p.length<8)return reply.code(400).send({error:'Password must contain at least 8 characters'});const r=await db.query('SELECT * FROM pro_chat_reset_tokens WHERE token=$1 AND expires_at>NOW()',[t]);if(!r.rowCount)return reply.code(400).send({error:'Reset link is invalid or expired'});const u=r.rows[0];await db.query('UPDATE pro_chat_users SET password_hash=$1 WHERE id=$2',[hash(p),u.user_id]);await db.query('DELETE FROM pro_chat_sessions WHERE user_id=$1',[u.user_id]);await db.query('DELETE FROM pro_chat_reset_tokens WHERE token=$1',[t]);return {ok:true,message:'Password reset successfully'}});

app.post('/api/session',async(req:any,reply)=>{const id=auth(req);if(!id)return reply.code(401).send({error:'Authentication required'});const r=await db.query('SELECT * FROM pro_chat_users WHERE id=$1',[id]);if(!r.rowCount)return reply.code(401).send({error:'User not found'});const t=tokenFor(id);await db.query('INSERT INTO pro_chat_sessions(token,user_id,created_at,expires_at) VALUES($1,$2,NOW(),NOW()+INTERVAL \'30 days\')',[t,id]);return publicUser(r.rows[0],t)});

app.get('/api/users',async(req:any,reply)=>{const me=auth(req),q=norm(req.query?.q||'');if(q.length>100)return reply.code(400).send({error:'Search text is too long'});const p=phone(q);const r=await db.query(`SELECT id,name,email,phone_number,username,created_at,online FROM pro_chat_users WHERE id<>$1 AND ($2='' OR LOWER(username) LIKE $3 OR LOWER(name) LIKE $3 OR LOWER(email) LIKE $3 OR phone_number LIKE $4) ORDER BY CASE WHEN LOWER(username)=$2 THEN 0 WHEN LOWER(username) LIKE $5 THEN 1 ELSE 2 END,name LIMIT 50`,[me||'',q,`%${q}%`,`%${p}%`,`${q}%`]);return r.rows.map(x=>publicUser(x));});

app.get<{Params:{chatId:string}}>('/api/messages/:chatId',async(req)=>{const r=await db.query('SELECT id,chat_id AS "chatId",sender_id AS "senderId",text,created_at AS "createdAt",delivered,read FROM pro_chat_messages WHERE chat_id=$1 ORDER BY created_at ASC LIMIT 200',[req.params.chatId]);return r.rows});

const http=createServer(app.server);const io=new Server(http,{cors:{origin,methods:['GET','POST']},maxHttpBufferSize:256*1024});
io.on('connection',socket=>{
 let uid=verify(String(socket.handshake.auth?.token||''));
 socket.on('presence:join',async(id:string)=>{if(!uid)uid=id;if(uid!==id)return;socket.data.userId=uid;sockets.set(socket.id,uid);await db.query('UPDATE pro_chat_users SET online=true WHERE id=$1',[uid]);io.emit('presence:update',{userId:uid,online:true});});
 socket.on('chat:join',(chatId:string)=>{const id=socket.data.userId;if(id&&chatUsers(chatId).includes(id))socket.join(`chat:${chatId}`)});
 socket.on('message:send',async(input:any,ack?:Function)=>{try{const id=socket.data.userId||input.senderId;if(!id||input.senderId!==id||!input.chatId||!String(input.text||'').trim())return ack?.({ok:false,error:'Invalid message'});const parts=chatUsers(input.chatId);if(parts.length!==2||!parts.includes(id))return ack?.({ok:false,error:'Invalid conversation'});const msg={id:String(input.id||randomUUID()),chatId:input.chatId,senderId:id,text:String(input.text).trim().slice(0,10000),createdAt:input.createdAt||new Date().toISOString(),delivered:Array.from(sockets.values()).includes(parts.find(x=>x!==id)!),read:false};const ex=await db.query('SELECT id,chat_id AS "chatId",sender_id AS "senderId",text,created_at AS "createdAt",delivered,read FROM pro_chat_messages WHERE id=$1',[msg.id]);if(ex.rowCount)return ack?.({ok:true,message:ex.rows[0]});await db.query('INSERT INTO pro_chat_messages(id,chat_id,sender_id,text,created_at,delivered,read) VALUES($1,$2,$3,$4,$5,$6,false)',[msg.id,msg.chatId,msg.senderId,msg.text,msg.createdAt,msg.delivered]);const saved={...msg};for(const sid of Array.from(sockets.entries()).filter(([,u])=>parts.includes(u)).map(([s])=>s))io.to(sid).emit('message:new',saved);return ack?.({ok:true,message:saved})}catch(e){app.log.error(e);ack?.({ok:false,error:'Message could not be saved'})}});
 socket.on('message:read',async({chatId,messageId,userId}:any)=>{if(userId!==socket.data.userId)return;await db.query('UPDATE pro_chat_messages SET read=true WHERE chat_id=$1 AND sender_id<>$2 AND ($3='' OR id=$3)',[chatId,userId,messageId||'']);});
 socket.on('disconnect',async()=>{const id=socket.data.userId;sockets.delete(socket.id);if(id&&!Array.from(sockets.values()).includes(id)){await db.query('UPDATE pro_chat_users SET online=false WHERE id=$1',[id]);io.emit('presence:update',{userId:id,online:false})}});
});

setInterval(()=>db.query('DELETE FROM pro_chat_sessions WHERE expires_at<NOW(); DELETE FROM pro_chat_reset_tokens WHERE expires_at<NOW();').catch(e=>app.log.error(e)),6*60*60*1000).unref();
const port=Number(process.env.PORT||3000);http.listen({port,host:'0.0.0.0'},()=>app.log.info(`Pro Chat server listening on ${port}`));
process.on('SIGTERM',async()=>{await closeDb();process.exit(0)});
process.on('SIGINT',async()=>{await closeDb();process.exit(0)});
