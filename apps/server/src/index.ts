import Fastify from 'fastify';
import cors from '@fastify/cors';
import {Server} from 'socket.io';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHmac,randomBytes,randomUUID,scryptSync,timingSafeEqual} from 'node:crypto';

const app=Fastify({logger:true,bodyLimit:256*1024});
const origin=process.env.WEB_ORIGIN||true;
await app.register(cors,{origin});
const DATA=process.env.DATA_FILE||'./data/pro-chat.json';
const SESSION_SECRET=process.env.SESSION_SECRET||randomBytes(32).toString('hex');
if(!process.env.SESSION_SECRET)app.log.warn('SESSION_SECRET is not set; sessions will be invalidated on restart. Set one in production.');

type User={id:string;name:string;createdAt:string;email?:string;phoneNumber?:string;username?:string;passwordHash?:string;online?:boolean};
type Session={token:string;userId:string;createdAt:string;expiresAt:string};
type Message={id:string;chatId:string;senderId:string;text:string;createdAt:string;delivered:boolean;read:boolean};
type ResetToken={token:string;userId:string;expiresAt:string};
type Store={users:User[];sessions:Session[];messages:Message[];resetTokens:ResetToken[]};
let store:Store={users:[],sessions:[],messages:[],resetTokens:[]};
async function persist(){await mkdir(dirname(DATA),{recursive:true});await writeFile(DATA,JSON.stringify(store,null,2))}
try{const raw=JSON.parse(await readFile(DATA,'utf8'));store={users:raw.users||[],sessions:raw.sessions||[],messages:raw.messages||[],resetTokens:raw.resetTokens||[]}}catch{await persist()}

const sign=(value:string)=>createHmac('sha256',SESSION_SECRET).update(value).digest('hex');
const makeToken=(userId:string)=>{const payload=Buffer.from(JSON.stringify({u:userId,t:Date.now()})).toString('base64url');return `${payload}.${sign(payload)}`};
const verifyToken=(token:string)=>{try{const [payload,signature]=token.split('.');if(!payload||!signature)return null;const expected=sign(payload);if(signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return null;const data=JSON.parse(Buffer.from(payload,'base64url').toString());if(Date.now()-Number(data.t)>30*86400000)return null;return String(data.u)}catch{return null}};
const bearer=(req:any)=>{const h=String(req.headers.authorization||'');return h.startsWith('Bearer ')?h.slice(7):''};
const optionalAuth=(req:any)=>verifyToken(bearer(req));
const chatUsers=(chatId:string)=>chatId.split(':');
const userSockets=(userId:string)=>Array.from(sockets.entries()).filter(([,uid])=>uid===userId).map(([sid])=>sid);
const normalizeEmail=(v:any)=>String(v||'').trim().toLowerCase();
const normalizePhone=(v:any)=>String(v||'').replace(/[\s().-]/g,'').trim();
const normalizeUsername=(v:any)=>String(v||'').trim().toLowerCase();
const hashPassword=(password:string)=>{const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(password,salt,64).toString('hex')}`};
const checkPassword=(password:string,stored?:string)=>{try{if(!stored)return false;const [salt,hash]=stored.split(':');const actual=scryptSync(password,salt,64);const expected=Buffer.from(hash,'hex');return expected.length===actual.length&&timingSafeEqual(actual,expected)}catch{return false}};
const publicUser=(u:User,token:string)=>({id:u.id,name:u.name,email:u.email,phoneNumber:u.phoneNumber,username:u.username,createdAt:u.createdAt,online:!!u.online,token});

app.get('/health',async()=>({ok:true,service:'pro-chat',time:new Date().toISOString(),users:store.users.length}));

app.post<{Body:{email?:string;phoneNumber?:string;username?:string;password?:string}}>('/api/auth/register',async(req,reply)=>{
  const email=normalizeEmail(req.body?.email),phoneNumber=normalizePhone(req.body?.phoneNumber),username=normalizeUsername(req.body?.username),password=String(req.body?.password||'');
  if(!email||!email.includes('@'))return reply.code(400).send({error:'Enter a valid email address'});
  if(!phoneNumber||phoneNumber.replace(/\D/g,'').length<7)return reply.code(400).send({error:'Enter a valid phone number'});
  if(!/^[a-z0-9_]{3,30}$/.test(username))return reply.code(400).send({error:'Username must be 3-30 characters using letters, numbers, or underscore'});
  if(password.length<8)return reply.code(400).send({error:'Password must contain at least 8 characters'});
  if(store.users.some(u=>normalizeEmail(u.email)===email))return reply.code(409).send({error:'An account already exists with this email'});
  if(store.users.some(u=>normalizePhone(u.phoneNumber)===phoneNumber))return reply.code(409).send({error:'An account already exists with this phone number'});
  if(store.users.some(u=>normalizeUsername(u.username)===username))return reply.code(409).send({error:'That username is already taken'});
  const user:User={id:randomUUID(),name:username,createdAt:new Date().toISOString(),email,phoneNumber,username,passwordHash:hashPassword(password)};
  store.users.push(user);const token=makeToken(user.id);store.sessions.push({token,userId:user.id,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+30*86400000).toISOString()});await persist();return publicUser(user,token);
});

app.post<{Body:{identifier?:string;password?:string}}>('/api/auth/login',async(req,reply)=>{
  const identifier=String(req.body?.identifier||'').trim(),password=String(req.body?.password||'');
  if(!identifier||!password)return reply.code(400).send({error:'Enter your login details'});
  const email=normalizeEmail(identifier),phone=normalizePhone(identifier),username=normalizeUsername(identifier);
  const user=store.users.find(u=>normalizeEmail(u.email)===email||normalizePhone(u.phoneNumber)===phone||normalizeUsername(u.username)===username);
  if(!user||!checkPassword(password,user.passwordHash))return reply.code(401).send({error:'Invalid username, email/phone, or password'});
  const token=makeToken(user.id);store.sessions.push({token,userId:user.id,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+30*86400000).toISOString()});await persist();return publicUser(user,token);
});

app.post<{Body:{identifier?:string}}>('/api/auth/forgot-password',async(req,reply)=>{
  const identifier=String(req.body?.identifier||'').trim();const email=normalizeEmail(identifier),phone=normalizePhone(identifier),username=normalizeUsername(identifier);
  const user=store.users.find(u=>normalizeEmail(u.email)===email||normalizePhone(u.phoneNumber)===phone||normalizeUsername(u.username)===username);
  if(user&&user.email){const token=randomBytes(32).toString('hex');store.resetTokens=store.resetTokens.filter(x=>x.userId!==user.id);store.resetTokens.push({token,userId:user.id,expiresAt:new Date(Date.now()+15*60*1000).toISOString()});await persist();
    if(process.env.RESEND_API_KEY){try{await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.RESEND_FROM||'Pro Chat <onboarding@resend.dev>',to:[user.email],subject:'Pro Chat password reset',html:`<p>Reset your Pro Chat password:</p><p><a href="${process.env.WEB_ORIGIN||''}/?reset=${token}">Reset password</a></p><p>This link expires in 15 minutes.</p>`})})}catch(e){app.log.error(e)}}
  }
  return {message:'If the account exists and has an email address, password reset instructions have been sent.'};
});

app.post<{Body:{token?:string;password?:string}}>('/api/auth/reset-password',async(req,reply)=>{
  const token=String(req.body?.token||''),password=String(req.body?.password||'');if(password.length<8)return reply.code(400).send({error:'Password must contain at least 8 characters'});
  const item=store.resetTokens.find(x=>x.token===token&&new Date(x.expiresAt).getTime()>Date.now());if(!item)return reply.code(400).send({error:'Reset link is invalid or expired'});
  const user=store.users.find(u=>u.id===item.userId);if(!user)return reply.code(400).send({error:'Account not found'});user.passwordHash=hashPassword(password);store.resetTokens=store.resetTokens.filter(x=>x.token!==token);store.sessions=store.sessions.filter(s=>s.userId!==user.id);await persist();return {ok:true,message:'Password reset successfully'};
});

app.post<{Body:{id?:string;name?:string}}>('/api/users',async(req,reply)=>{
  const name=String(req.body?.name||'').trim().slice(0,40);if(name.length<2)return reply.code(400).send({error:'Name must contain at least 2 characters'});
  const authenticated=optionalAuth(req);let user=authenticated?store.users.find(u=>u.id===authenticated):undefined;
  if(req.body?.id&&(!authenticated||req.body.id!==authenticated))user=store.users.find(u=>u.id===req.body?.id);
  if(!user){user={id:randomUUID(),name,createdAt:new Date().toISOString()};store.users.push(user)}else user.name=name;
  const token=makeToken(user.id);store.sessions=store.sessions.filter(s=>s.userId!==user!.id);store.sessions.push({token,userId:user.id,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+30*86400000).toISOString()});await persist();
  return {...user,token};
});
app.post('/api/session',async(req:any,reply)=>{const userId=optionalAuth(req);if(!userId)return reply.code(401).send({error:'Authentication required'});const u=store.users.find(x=>x.id===userId);if(!u)return reply.code(401).send({error:'User not found'});const token=makeToken(userId);store.sessions.push({token,userId,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+30*86400000).toISOString()});await persist();return {...u,token}});
app.get('/api/users',async(req:any)=>{const userId=optionalAuth(req);const q=String(req.query?.q||'').toLowerCase().trim();return store.users.filter(u=>u.id!==userId&&(!q||u.name.toLowerCase().includes(q)||String(u.username||'').toLowerCase().includes(q))).map(u=>({...u,online:!!u.online,passwordHash:undefined}))});
app.get<{Params:{chatId:string}}>('/api/messages/:chatId',async req=>store.messages.filter(m=>m.chatId===req.params.chatId).slice(-200));

const http=createServer(app.server);const io=new Server(http,{cors:{origin,methods:['GET','POST']},maxHttpBufferSize:256*1024});
const sockets=new Map<string,string>();

io.on('connection',socket=>{
  const token=String(socket.handshake.auth?.token||'');const verified=verifyToken(token);let connectionUser=verified;
  socket.on('presence:join',async(userId:string)=>{
    if(!connectionUser)connectionUser=userId;if(connectionUser!==userId)return;socket.data.userId=userId;sockets.set(socket.id,userId);const u=store.users.find(x=>x.id===userId);if(!u)return;u.online=true;await persist();io.emit('presence:update',{userId,online:true});
    const pending=store.messages.filter(m=>!m.delivered&&chatUsers(m.chatId).includes(userId)&&m.senderId!==userId);
    for(const m of pending){m.delivered=true;for(const sid of userSockets(userId))io.to(sid).emit('message:new',m);for(const sid of userSockets(m.senderId))io.to(sid).emit('message:delivered',{messageId:m.id})}if(pending.length)await persist();
  });
  socket.on('chat:join',(chatId:string)=>{const userId=socket.data.userId;if(userId&&chatUsers(chatId).includes(userId))socket.join(`chat:${chatId}`)});
  socket.on('message:send',async(input:Partial<Message>,ack?:(r:any)=>void)=>{
    const userId=socket.data.userId||input.senderId;if(!input?.chatId||!userId||input.senderId!==userId||!input.text?.trim())return ack?.({ok:false,error:'Invalid message'});
    const participants=chatUsers(input.chatId);if(participants.length!==2||!participants.includes(userId))return ack?.({ok:false,error:'Invalid conversation'});
    const message:Message={id:input.id||randomUUID(),chatId:input.chatId,senderId:userId,text:String(input.text).trim().slice(0,10000),createdAt:input.createdAt||new Date().toISOString(),delivered:false,read:false};
    const existing=store.messages.find(m=>m.id===message.id);if(existing)return ack?.({ok:true,message:existing});
    const recipientId=participants.find(id=>id!==userId)!;const recipientSockets=userSockets(recipientId);message.delivered=recipientSockets.length>0;store.messages.push(message);await persist();
    for(const sid of userSockets(userId))io.to(sid).emit('message:new',message);for(const sid of recipientSockets)io.to(sid).emit('message:new',message);if(message.delivered)for(const sid of userSockets(userId))io.to(sid).emit('message:delivered',{messageId:message.id});ack?.({ok:true,message});
  });
  socket.on('message:read',async({chatId,messageId,userId})=>{if(userId!==socket.data.userId||!chatId)return;const changed:Message[]=[];for(const m of store.messages){if(m.chatId===chatId&&m.senderId!==userId&&!m.read&&(!messageId||m.id===messageId)){m.read=true;changed.push(m)}}if(!changed.length)return;await persist();for(const m of changed)for(const sid of userSockets(m.senderId))io.to(sid).emit('message:read',{chatId,messageId:m.id})});
  socket.on('typing',({chatId,typing})=>{const userId=socket.data.userId;if(userId&&chatUsers(chatId).includes(userId))socket.to(`chat:${chatId}`).emit('typing',{userId,typing:!!typing})});
  socket.on('call:signal',({targetUserId,...payload})=>{const senderUserId=socket.data.userId;if(!senderUserId||!targetUserId||targetUserId===senderUserId)return;for(const sid of userSockets(targetUserId))io.to(sid).emit('call:signal',{...payload,senderUserId})});
  socket.on('disconnect',async()=>{const userId=socket.data.userId;sockets.delete(socket.id);if(userId&&!Array.from(sockets.values()).includes(userId)){const u=store.users.find(x=>x.id===userId);if(u){u.online=false;await persist()}io.emit('presence:update',{userId,online:false})}});
});

setInterval(async()=>{const now=Date.now();const before=store.sessions.length;store.sessions=store.sessions.filter(s=>new Date(s.expiresAt).getTime()>now);store.resetTokens=store.resetTokens.filter(s=>new Date(s.expiresAt).getTime()>now);if(before!==store.sessions.length)await persist()},6*60*60*1000).unref();
const port=Number(process.env.PORT||3000);http.listen({port,host:'0.0.0.0'},()=>app.log.info(`Pro Chat server listening on ${port}`));
