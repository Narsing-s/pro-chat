import Fastify from 'fastify';
import cors from '@fastify/cors';
import {Server} from 'socket.io';

const app=Fastify({logger:true});
await app.register(cors,{origin:true});
app.get('/health',async()=>({ok:true,service:'pro-chat',time:new Date().toISOString()}));
const io=new Server(app.server,{cors:{origin:true,methods:['GET','POST']}});
const online=new Set<string>();
io.on('connection',socket=>{
 socket.on('presence:join',(userId:string)=>{if(userId){online.add(userId);io.emit('presence:update',{userId,online:true})}});
 socket.on('message:send',(message)=>{if(!message?.chatId||!message?.text)return;io.emit('message:new',{...message,serverTime:new Date().toISOString()})});
 socket.on('disconnect',()=>{});
});
const port=Number(process.env.PORT||3000);
await app.listen({port,host:'0.0.0.0'});