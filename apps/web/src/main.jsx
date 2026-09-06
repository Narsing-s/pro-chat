import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {io} from 'socket.io-client';
import {MessageCircle,Search,Plus,Send,Wifi,WifiOff,Phone,Video,MoreVertical,Check,CheckCheck,Users,LogOut,Mic,MicOff,Camera,CameraOff,PhoneOff} from 'lucide-react';
import './styles.css';

const API=import.meta.env.VITE_API_URL||( ['localhost','127.0.0.1','0.0.0.0'].includes(location.hostname) ? 'http://localhost:3000' : location.origin);
const USER_KEY='pro-chat-user-v3',CHATS_KEY='pro-chat-chats-v3',MSG_KEY='pro-chat-messages-v3',OUTBOX_KEY='pro-chat-outbox-v1';
const cid=(a,b)=>[a,b].sort().join(':');
const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

const RTC_CONFIG={iceServers:[
  {urls:'stun:stun.l.google.com:19302'},
  ...(import.meta.env.VITE_TURN_URL?[{urls:import.meta.env.VITE_TURN_URL,username:import.meta.env.VITE_TURN_USERNAME,password:import.meta.env.VITE_TURN_PASSWORD}]:[])
]};

function App(){
  const me=read(USER_KEY,null);
  const [chats,setChats]=useState(()=>read(CHATS_KEY,[]));
  const [messages,setMessages]=useState(()=>read(MSG_KEY,{}));
  const [search,setSearch]=useState('');
  const [results,setResults]=useState([]);
  const [searching,setSearching]=useState(false);
  const [searchError,setSearchError]=useState('');
  const [active,setActive]=useState(null);
  const [text,setText]=useState('');
  const [online,setOnline]=useState(false);
  const socketRef=useRef(null);

  useEffect(()=>localStorage.setItem(CHATS_KEY,JSON.stringify(chats)),[chats]);
  useEffect(()=>localStorage.setItem(MSG_KEY,JSON.stringify(messages)),[messages]);

  useEffect(()=>{
    if(!me?.token)return;
    const socket=io(API,{auth:{token:me.token},transports:['websocket','polling'],reconnection:true});
    socketRef.current=socket;
    socket.on('connect',()=>{setOnline(true);flushOutbox(socket)});
    socket.on('disconnect',()=>setOnline(false));
    socket.on('message',m=>receiveMessage(m));
    socket.on('message:ack',m=>receiveMessage(m));
    return()=>{socket.disconnect();socketRef.current=null};
  },[me?.token]);

  function receiveMessage(m){
    if(!m?.chatId||!m?.id)return;
    setMessages(prev=>({...prev,[m.chatId]:[...(prev[m.chatId]||[]).filter(x=>x.id!==m.id),m].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt))}));
    setChats(prev=>{
      const otherId=m.senderId===me.id?m.receiverId:m.senderId;
      const old=prev.find(c=>c.id===m.chatId);
      if(old)return prev.map(c=>c.id===m.chatId?{...c,lastMessage:m.text,lastAt:m.createdAt}:c);
      return [{id:m.chatId,userId:otherId,name:m.senderName||'Contact',username:m.senderUsername||'',lastMessage:m.text,lastAt:m.createdAt},...prev];
    });
  }

  async function flushOutbox(socket){
    const queue=read(OUTBOX_KEY,[]);
    if(!queue.length)return;
    const remaining=[];
    for(const m of queue){
      try{socket.emit('message',m)}catch{remaining.push(m)}
    }
    localStorage.setItem(OUTBOX_KEY,JSON.stringify(remaining));
  }

  async function find(q=search){
    const value=q.trim();
    setSearchError('');
    if(!value){setResults([]);return}
    setSearching(true);
    try{
      const r=await fetch(`${API}/api/users?q=${encodeURIComponent(value)}`,{
        headers:me?.token?{Authorization:`Bearer ${me.token}`}:{},
        cache:'no-store'
      });
      const data=await r.json().catch(()=>[]);
      if(!r.ok)throw Error(data?.error||`Search failed (${r.status})`);
      const users=Array.isArray(data)?data:[];
      setResults(users.filter(u=>u.id!==me?.id));
      if(!users.length)setSearchError('No Pro Chat user found. Try the exact username, email or phone number.');
    }catch(e){
      setResults([]);
      setSearchError(e.message==='Failed to fetch'||e.name==='TypeError'
        ?'Cannot reach the Pro Chat server. Search requires both accounts to use the same reachable server.'
        :(e.message||'Unable to search users.'));
    }finally{setSearching(false)}
  }

  async function openUser(user){
    if(!user?.id||user.id===me?.id)return;
    const id=cid(me.id,user.id);
    setActive(id);
    setSearch('');setResults([]);setSearchError('');
    setChats(prev=>prev.some(c=>c.id===id)?prev:[{id,userId:user.id,name:user.name||user.username||'Contact',username:user.username||'',email:user.email||'',phoneNumber:user.phoneNumber||'',lastMessage:'',lastAt:user.createdAt||new Date().toISOString()},...prev]);
    const socket=socketRef.current;
    if(socket)socket.emit('join',id);
    try{
      const r=await fetch(`${API}/api/messages/${encodeURIComponent(id)}`,{headers:me?.token?{Authorization:`Bearer ${me.token}`}:{},cache:'no-store'});
      if(r.ok){const data=await r.json();setMessages(prev=>({...prev,[id]:Array.isArray(data)?data:[]}))}
    }catch{}
  }

  function send(){
    const value=text.trim();
    if(!value||!active||!me)return;
    const chat=chats.find(c=>c.id===active);if(!chat)return;
    const m={id:crypto.randomUUID(),chatId:active,senderId:me.id,senderName:me.name,senderUsername:me.username,receiverId:chat.userId,text:value,createdAt:new Date().toISOString(),status:'sent'};
    receiveMessage(m);setText('');
    const socket=socketRef.current;
    if(socket?.connected){socket.emit('message',m)}else{
      const queue=read(OUTBOX_KEY,[]);queue.push(m);localStorage.setItem(OUTBOX_KEY,JSON.stringify(queue));
    }
  }

  function logout(){localStorage.removeItem(USER_KEY);location.replace(location.pathname)}
  const activeChat=chats.find(c=>c.id===active);
  const activeMessages=active?(messages[active]||[]):[];

  if(!me)return null;
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><MessageCircle size={25}/><strong>Pro Chat</strong><span className={online?'online-dot':'offline-dot'} title={online?'Connected':'Offline'} /></div>
      <div className="me-row"><div className="avatar">{(me.username||me.name||'P')[0].toUpperCase()}</div><div className="me-info"><b>{me.username||me.name}</b><small>{me.email||me.phoneNumber||''}</small></div><button onClick={logout} title="Logout"><LogOut size={18}/></button></div>
      <div className="search-box"><Search size={18}/><input value={search} onChange={e=>{setSearch(e.target.value);if(!e.target.value.trim()){setResults([]);setSearchError('')}}} onKeyDown={e=>e.key==='Enter'&&find()} placeholder="Search username, email or phone"/><button onClick={()=>find()} disabled={searching}>{searching?'…':'Search'}</button></div>
      {(results.length>0||searchError)&&<div className="search-results">{results.map(u=><button className="user-result" key={u.id} onClick={()=>openUser(u)}><div className="avatar">{(u.username||u.name||'P')[0].toUpperCase()}</div><div><b>{u.username?`@${u.username}`:u.name}</b><span>{u.name}{u.email?' • '+u.email:''}</span></div><MessageCircle size={18}/></button>)}{searchError&&<div className="search-error">{searchError}</div>}</div>}
      <div className="chat-list">{chats.map(c=><button key={c.id} className={'chat-row '+(active===c.id?'active':'')} onClick={()=>openUser(c)}><div className="avatar">{(c.username||c.name||'P')[0].toUpperCase()}</div><div className="chat-meta"><b>{c.username?`@${c.username}`:c.name}</b><span>{c.lastMessage||'Start a conversation'}</span></div></button>)}</div>
    </aside>
    <main className="chat-panel">
      {activeChat?<><header className="chat-header"><div className="avatar">{(activeChat.username||activeChat.name||'P')[0].toUpperCase()}</div><div><b>{activeChat.username?`@${activeChat.username}`:activeChat.name}</b><small>{activeChat.name}{activeChat.email?' • '+activeChat.email:''}</small></div><div className="chat-actions"><Phone size={19}/><Video size={20}/><MoreVertical size={20}/></div></header><section className="messages">{activeMessages.map(m=><div key={m.id} className={'bubble '+(m.senderId===me.id?'mine':'theirs')}><span>{m.text}</span><small>{new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} {m.senderId===me.id&&(m.status==='sent'?<Check size={13}/>:<CheckCheck size={13}/>)}</small></div>)}</section><footer className="composer"><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&(e.preventDefault(),send())} placeholder="Type a message"/><button onClick={send} disabled={!text.trim()}><Send size={20}/></button></footer></>:<div className="empty-state"><MessageCircle size={56}/><h2>Pro Chat</h2><p>Search a username, email or phone number to start a private conversation.</p></div>}
    </main>
  </div>
}

createRoot(document.getElementById('root')).render(<App/>);
