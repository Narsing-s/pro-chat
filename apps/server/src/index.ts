import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
const app=Fastify({logger:true});const origin=process.env.WEB_ORIGIN||true;await app.register(cors,{origin});const DATA=process.env.DATA_FILE||'./data/pro-chat.json';
type User={id:string;name:string;createdAt:string;online?:boolean};type Message={id:string;chatId:string;senderId:string;text:string;createdAt:string;delivered:boolean;read:boolean};type Store={users:User[];messages:Message[]};let store:Store={users:[],messages:[]};
async function persist(){await mkdir(dirname(DATA),{recursive:true});await writeFile(DATA,JSON.stringify(store,null,2))}try{store=JSON.parse(await readFile(DATA,'utf8'))}catch{await persist()}
app.get('/health',async()=>({ok:true,service:'pro-chat',time:new Date().toISOString(),users:store.users.length}));
app.post<{Body:{id?:string;name?:string}}>('/api/users',async(req,reply)=>{const name=String(req.body?.name||'').trim().slice(0,40);if(name.length<2)return reply.code(400).send({error:'Name must contain at least 2 characters'});const id=req.body?.id||randomUUID();let user=store.users.find(u=>u.id===id);if(!user){user={id,name,createdAt:new Date().toISOString()};store.users.push(user)}else user.name=name;await persist();return user});
app.get('/api/users',async(req:any)=>{const q=String(req.query?.q||'').toLowerCase().trim();return store.users.filter(u=>!q||u.name.toLowerCase().includes(q)).map(u=>({...u,online:!!u.online}))});
app.get<{Params:{chatId:string}}>('/api/messages/:chatId',async req=>store.messages.filter(m=>m.chatId===req.params.chatId).slice(-200));
const http=createServer(app.server);const io=new Server(http,{cors:{origin,methods:['GET','POST']}});const sockets=new Map<string,string>();
io.on('connection',socket=>{
 socket.on('presence:join',async(userId:string)=>{if(!userId)return;sockets.set(socket.id,userId);const u=store.users.find(x=>x.id===userId);if(u){u.online=true;await persist();io.emit('presence:update',{userId,online:true})}});
 socket.on('chat:join',(chatId:string)=>{if(chatId)socket.join(`chat:${chatId}`)});
 socket.on('message:send',async(input:Partial<Message>,ack?:(r:any)=>void)=>{if(!input?.chatId||!input.senderId||!input.text?.trim())return ack?.({ok:false,error:'Invalid message'});const message:Message={id:input.id||randomUUID(),chatId:input.chatId,senderId:input.senderId,text:String(input.text).slice(0,10000),createdAt:input.createdAt||new Date().toISOString(),delivered:true,read:false};if(!store.messages.some(m=>m.id===message.id)){store.messages.push(message);await persist()}io.to(`chat:${message.chatId}`).emit('message:new',message);socket.emit('message:delivered',{messageId:message.id});ack?.({ok:true,message})});
 socket.on('message:read',async({chatId,messageId,userId})=>{const m=store.messages.find(x=>x.id===messageId&&x.chatId===chatId);if(m&&m.senderId!==userId){m.read=true;await persist();io.to(`chat:${chatId}`).emit('message:read',{messageId})}});
 socket.on('typing',({chatId,userId,typing})=>socket.to(`chat:${chatId}`).emit('typing',{userId,typing:!!typing}));
 socket.on('call:signal',({targetUserId,...payload})=>{const senderUserId=sockets.get(socket.id);if(!senderUserId||!targetUserId)return;for(const [sid,uid] of sockets)if(uid===targetUserId)io.to(sid).emit('call:signal',{...payload,senderUserId})});
 socket.on('disconnect',async()=>{const userId=sockets.get(socket.id);sockets.delete(socket.id);if(userId&&!Array.from(sockets.values()).includes(userId)){const u=store.users.find(x=>x.id===userId);if(u){u.online=false;await persist()}io.emit('presence:update',{userId,online:false})}});
});
const port=Number(process.env.PORT||3000);http.listen({port,host:'0.0.0.0'},()=>app.log.info(`Pro Chat server listening on ${port}`));