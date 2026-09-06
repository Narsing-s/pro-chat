import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {io} from 'socket.io-client';
import {MessageCircle,Search,Send,Phone,Video,MoreVertical,Check,CheckCheck,LogOut,Star,Archive,Settings,Shield,User,ChevronDown,ChevronLeft,X} from 'lucide-react';
import './styles.css';

const API=import.meta.env.VITE_API_URL||(['localhost','127.0.0.1','0.0.0.0'].includes(location.hostname)?'http://localhost:3000':location.origin);
const USER_KEY='pro-chat-user-v3',CHATS_KEY='pro-chat-chats-v3',MSG_KEY='pro-chat-messages-v3',OUTBOX_KEY='pro-chat-outbox-v1';
const cid=(a,b)=>[a,b].sort().join(':');
const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

function App(){
 const me=read(USER_KEY,null);
 const[chats,setChats]=useState(()=>read(CHATS_KEY,[]).map(c=>({...c,favorite:!!c.favorite,archived:!!c.archived})));
 const[messages,setMessages]=useState(()=>read(MSG_KEY,{}));
 const[search,setSearch]=useState('');const[results,setResults]=useState([]);const[searching,setSearching]=useState(false);const[searchError,setSearchError]=useState('');
 const[active,setActive]=useState(null);const[text,setText]=useState('');const[folder,setFolder]=useState('all');const[profileOpen,setProfileOpen]=useState(false);const[chatMenu,setChatMenu]=useState(false);const[profileView,setProfileView]=useState(null);
 const socketRef=useRef(null);
 useEffect(()=>localStorage.setItem(CHATS_KEY,JSON.stringify(chats)),[chats]);
 useEffect(()=>localStorage.setItem(MSG_KEY,JSON.stringify(messages)),[messages]);
 useEffect(()=>{if(!me?.token)return;const s=io(API,{auth:{token:me.token},transports:['websocket','polling'],reconnection:true});socketRef.current=s;s.on('connect',()=>{read(OUTBOX_KEY,[]).forEach(m=>s.emit('message',m));localStorage.setItem(OUTBOX_KEY,'[]')});s.on('message',receive);s.on('message:ack',receive);return()=>s.disconnect()},[me?.token]);
 function receive(m){if(!m?.chatId||!m?.id)return;setMessages(p=>({...p,[m.chatId]:[...(p[m.chatId]||[]).filter(x=>x.id!==m.id),m].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt))}));setChats(p=>p.map(c=>c.id===m.chatId?{...c,lastMessage:m.text,lastAt:m.createdAt}:c))}
 async function find(q=search){const v=q.trim();setSearchError('');if(!v){setResults([]);return}setSearching(true);try{const r=await fetch(`${API}/api/users?q=${encodeURIComponent(v)}`,{headers:{Authorization:`Bearer ${me.token}`},cache:'no-store'});const d=await r.json().catch(()=>[]);if(!r.ok)throw Error(d.error||`Search failed (${r.status})`);const users=Array.isArray(d)?d.filter(u=>u.id!==me.id):[];setResults(users);if(!users.length)setSearchError('No user found. Try the exact username, email or phone number.')}catch(e){setResults([]);setSearchError(e.message==='Failed to fetch'||e.name==='TypeError'?'Cannot reach the Pro Chat server. Cross-device user search requires the same reachable server.':e.message||'Unable to search users.')}finally{setSearching(false)}}
 async function openUser(u){if(!u?.id||u.id===me.id)return;const id=cid(me.id,u.id);setActive(id);setSearch('');setResults([]);setSearchError('');setChatMenu(false);setChats(p=>p.some(c=>c.id===id)?p:p.concat([{id,userId:u.id,name:u.name||u.username||'Contact',username:u.username||'',email:u.email||'',phoneNumber:u.phoneNumber||'',lastMessage:'',lastAt:u.createdAt||new Date().toISOString(),favorite:false,archived:false}]));socketRef.current?.emit('join',id);try{const r=await fetch(`${API}/api/messages/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${me.token}`},cache:'no-store'});if(r.ok){const d=await r.json();setMessages(p=>({...p,[id]:Array.isArray(d)?d:[]}))}}catch{}}
 function updateChat(id,patch){setChats(p=>p.map(c=>c.id===id?{...c,...patch}:c))}
 function toggleFavorite(id){setChats(p=>p.map(c=>c.id===id?{...c,favorite:!c.favorite}:c))}
 function toggleArchive(id){setChats(p=>p.map(c=>c.id===id?{...c,archived:!c.archived}:c));setChatMenu(false);if(folder==='archived'&&active===id)setActive(null)}
 function send(){const v=text.trim(),c=chats.find(x=>x.id===active);if(!v||!c)return;const m={id:crypto.randomUUID(),chatId:active,senderId:me.id,senderName:me.name,senderUsername:me.username,receiverId:c.userId,text:v,createdAt:new Date().toISOString(),status:'sent'};receive(m);setText('');if(socketRef.current?.connected)socketRef.current.emit('message',m);else{const q=read(OUTBOX_KEY,[]);q.push(m);localStorage.setItem(OUTBOX_KEY,JSON.stringify(q))}}
 function logout(){localStorage.removeItem(USER_KEY);location.replace(location.pathname)}
 if(!me)return null;
 const activeChat=chats.find(c=>c.id===active);const list=active?(messages[active]||[]):[];
 const visibleChats=chats.filter(c=>folder==='favorites'?c.favorite:folder==='archived'?c.archived:!c.archived);
 const counts={all:chats.filter(c=>!c.archived).length,favorites:chats.filter(c=>c.favorite&&!c.archived).length,archived:chats.filter(c=>c.archived).length};
 return <div className="app-shell">
  <aside className={'sidebar '+(active?'has-active':'')}>
   <div className="brand"><MessageCircle size={25}/><strong>Pro Chat</strong><div className="brand-actions"><button title="Settings" onClick={()=>setProfileView('settings')}><Settings size={19}/></button></div></div>
   <div className="profile-wrap">
    <button className="me-row" onClick={()=>setProfileOpen(v=>!v)}><div className="avatar">{(me.username||me.name||'P')[0].toUpperCase()}</div><div className="me-info"><b>@{me.username||me.name}</b><small>{me.email||me.phoneNumber||''}</small></div><ChevronDown size={18}/></button>
    {profileOpen&&<div className="profile-menu">
      <button onClick={()=>{setProfileView('profile');setProfileOpen(false)}}><User size={18}/><span>My profile</span></button>
      <button onClick={()=>{setProfileView('settings');setProfileOpen(false)}}><Settings size={18}/><span>Settings</span></button>
      <button onClick={()=>{setProfileView('privacy');setProfileOpen(false)}}><Shield size={18}/><span>Privacy</span></button>
      <button className="danger" onClick={logout}><LogOut size={18}/><span>Log out</span></button>
    </div>}
   </div>
   <div className="search-box"><Search size={18}/><input value={search} onChange={e=>{setSearch(e.target.value);if(!e.target.value.trim()){setResults([]);setSearchError('')}}} onKeyDown={e=>e.key==='Enter'&&find()} placeholder="Search username, email or phone"/><button onClick={()=>find()} disabled={searching}>{searching?'…':'Search'}</button></div>
   {(results.length||searchError)&&<div className="search-results">{results.map(u=><button className="user-result" key={u.id} onClick={()=>openUser(u)}><div className="avatar">{(u.username||u.name||'P')[0].toUpperCase()}</div><div><b>@{u.username||u.name}</b><span>{u.name}{u.email?' • '+u.email:''}</span></div><MessageCircle size={18}/></button>)}{searchError&&<div className="search-error">{searchError}</div>}</div>}
   <nav className="chat-folders" aria-label="Chat folders">
    <button className={folder==='all'?'selected':''} onClick={()=>setFolder('all')}><MessageCircle size={16}/><span>All chats</span><em>{counts.all}</em></button>
    <button className={folder==='favorites'?'selected':''} onClick={()=>setFolder('favorites')}><Star size={16}/><span>Favorites</span><em>{counts.favorites}</em></button>
    <button className={folder==='archived'?'selected':''} onClick={()=>setFolder('archived')}><Archive size={16}/><span>Archived</span><em>{counts.archived}</em></button>
   </nav>
   <div className="chat-list">{visibleChats.length?visibleChats.map(c=><div key={c.id} className={'chat-row '+(active===c.id?'active':'')} onClick={()=>openUser(c)}><div className="avatar">{(c.username||c.name||'P')[0].toUpperCase()}</div><div className="chat-meta"><b>@{c.username||c.name}</b><span>{c.lastMessage||'Start a conversation'}</span></div><div className="chat-row-actions"><button title={c.favorite?'Remove favorite':'Add to favorites'} onClick={e=>{e.stopPropagation();toggleFavorite(c.id)}}><Star size={17} fill={c.favorite?'currentColor':'none'}/></button><button title={c.archived?'Unarchive':'Archive'} onClick={e=>{e.stopPropagation();toggleArchive(c.id)}}><Archive size={17}/></button></div></div>):<div className="folder-empty"><Archive size={26}/><span>{folder==='favorites'?'No favorite chats yet':folder==='archived'?'No archived chats':'No chats yet'}</span></div>}</div>
  </aside>
  <main className="chat-panel">
   {activeChat?<><header className="chat-header"><button className="mobile-back" onClick={()=>setActive(null)}><ChevronLeft size={22}/></button><div className="avatar">{(activeChat.username||activeChat.name||'P')[0].toUpperCase()}</div><div className="chat-title"><b>@{activeChat.username||activeChat.name}</b><small>{activeChat.name}{activeChat.email?' • '+activeChat.email:''}</small></div><div className="chat-actions"><button title="Favorite" onClick={()=>toggleFavorite(activeChat.id)}><Star size={19} fill={activeChat.favorite?'currentColor':'none'}/></button><button title="Voice call"><Phone size={19}/></button><button title="Video call"><Video size={20}/></button><button title="More" onClick={()=>setChatMenu(v=>!v)}><MoreVertical size={20}/></button></div>{chatMenu&&<div className="chat-menu"><button onClick={()=>toggleFavorite(activeChat.id)}><Star size={17}/>{activeChat.favorite?'Remove from favorites':'Add to favorites'}</button><button onClick={()=>toggleArchive(activeChat.id)}><Archive size={17}/>{activeChat.archived?'Unarchive chat':'Archive chat'}</button></div>}</header><section className="messages">{list.length?list.map(m=><div key={m.id} className={'bubble-row '+(m.senderId===me.id?'mine':'theirs')}><div className={'bubble '+(m.senderId===me.id?'mine':'theirs')}><span>{m.text}</span><small>{new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} {m.senderId===me.id&&(m.status==='sent'?<Check size={13}/>:<CheckCheck size={13}/>)}</small></div></div>):<div className="conversation-empty"><MessageCircle size={34}/><span>No messages yet</span><small>Send a message to start the conversation.</small></div>}</section><footer className="composer"><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&(e.preventDefault(),send())} placeholder="Type a message"/><button onClick={send} disabled={!text.trim()}><Send size={20}/></button></footer></>:<div className="empty-state"><MessageCircle size={56}/><h2>Pro Chat</h2><p>Select a chat or search a username, email or phone number to start a private conversation.</p></div>}
  </main>
  {profileView&&<div className="modal-backdrop" onClick={()=>setProfileView(null)}><section className="profile-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setProfileView(null)}><X size={19}/></button>{profileView==='profile'&&<><div className="modal-avatar avatar">{(me.username||me.name||'P')[0].toUpperCase()}</div><h2>My profile</h2><div className="profile-details"><div><span>Name</span><b>{me.name||'—'}</b></div><div><span>Username</span><b>@{me.username||'—'}</b></div><div><span>Email</span><b>{me.email||'—'}</b></div><div><span>Phone</span><b>{me.phoneNumber||'—'}</b></div></div></>}{profileView==='settings'&&<><h2>Settings</h2><p className="modal-note">Manage your Pro Chat experience. Your chat preferences are stored on this device.</p><div className="settings-item"><Settings size={19}/><span>Chat settings</span></div><div className="settings-item"><Shield size={19}/><span>Security & privacy</span></div></>}{profileView==='privacy'&&<><h2>Privacy</h2><p className="modal-note">Your profile details are shown only where required for account discovery and messaging.</p><div className="settings-item"><Shield size={19}/><span>Private conversations</span></div><div className="settings-item"><User size={19}/><span>Profile visibility</span></div></>}</section></div>}
 </div>
}
createRoot(document.getElementById('root')).render(<App/>);
