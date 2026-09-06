(() => {
  const CHATS='pro-chat-chats-v5', MSGS='pro-chat-messages-v5';
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
  const merge=()=>{
    const chats=read(CHATS,[]), messages=read(MSGS,{});let changed=false;
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);if(!key)continue;
      if(key.startsWith('pro-chat-chats-')&&key!==CHATS){const old=read(key,[]);if(Array.isArray(old))for(const c of old){if(c?.id&&!chats.some(x=>x.id===c.id)){chats.push(c);changed=true}}}
      if(key.startsWith('pro-chat-messages-')&&key!==MSGS){const old=read(key,{});if(old&&typeof old==='object')for(const [id,list] of Object.entries(old)){if(Array.isArray(list)&&list.length&&!messages[id]){messages[id]=list;changed=true}else if(Array.isArray(list)&&list.length){const seen=new Set((messages[id]||[]).map(x=>x.id));const extra=list.filter(x=>x?.id&&!seen.has(x.id));if(extra.length){messages[id]=[...(messages[id]||[]),...extra];changed=true}}}}
    }
    if(changed){localStorage.setItem(CHATS,JSON.stringify(chats));localStorage.setItem(MSGS,JSON.stringify(messages));}
  };
  try{merge()}catch(e){console.warn('Chat history migration skipped',e)}
})();
