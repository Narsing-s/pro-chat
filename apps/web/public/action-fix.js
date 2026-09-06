(() => {
  const USER_KEY='pro-chat-user-v3';
  const CHATS_KEY='pro-chat-chats-v5';
  const MSG_KEY='pro-chat-messages-v5';
  const SETTINGS_KEY='pro-chat-settings-v1';
  const REPORTS_KEY='pro-chat-reports-v1';
  const BLOCKS_KEY='pro-chat-blocks-v1';
  const API=window.__PRO_CHAT_API__||((location.hostname==='localhost'||location.hostname==='127.0.0.1'||location.port==='5173')?`http://${location.hostname}:3000`:location.origin);
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const user=()=>read(USER_KEY,null);
  const token=()=>user()?.token||'';
  const toast=(message,ok=false)=>{
    let el=document.querySelector('.action-fix-toast');
    if(!el){el=document.createElement('div');el.className='action-fix-toast';document.body.appendChild(el)}
    el.textContent=message;el.dataset.ok=ok?'1':'0';el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),3200);
  };
  const chats=()=>read(CHATS_KEY,[]);
  const saveChats=v=>write(CHATS_KEY,v);
  const activeChat=()=>{
    const name=document.querySelector('.chat-title b')?.textContent?.trim();
    if(!name)return null;
    return chats().find(c=>c.name===name)||null;
  };
  const api=async(path,opts={})=>{
    const headers=new Headers(opts.headers||{});if(token())headers.set('Authorization',`Bearer ${token()}`);headers.set('Accept','application/json');
    const r=await fetch(`${API}${path}`,{...opts,headers});const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||`Request failed (${r.status})`);return data;
  };
  const modal=(title,body,onSubmit)=>{
    const old=document.querySelector('.action-fix-modal');old?.remove();
    const wrap=document.createElement('div');wrap.className='action-fix-modal';
    wrap.innerHTML=`<div class="action-fix-card"><div class="action-fix-head"><b>${title}</b><button type="button" data-close>×</button></div><div class="action-fix-body">${body}</div><div class="action-fix-actions"><button type="button" data-close>Cancel</button><button type="button" class="primary" data-submit>Continue</button></div></div>`;
    document.body.appendChild(wrap);wrap.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>wrap.remove());wrap.querySelector('[data-submit]').onclick=async()=>{try{await onSubmit(wrap);wrap.remove()}catch(e){toast(e.message||'Operation failed')}};return wrap;
  };

  document.addEventListener('click',async e=>{
    const btn=e.target.closest('button');if(!btn)return;
    const label=(btn.innerText||btn.getAttribute('aria-label')||btn.title||'').trim().replace(/\s+/g,' ').toLowerCase();
    if(!label)return;

    if(label==='delete chat'){
      e.preventDefault();e.stopImmediatePropagation();
      const menu=btn.closest('.floating-chat-menu');
      const candidate=menu?.previousElementSibling;
      const name=candidate?.querySelector('.chat-meta b')?.childNodes?.[0]?.textContent?.trim();
      const list=chats();const c=list.find(x=>x.name===name);
      if(!c){toast('Chat could not be identified.');return}
      if(!confirm(`Delete chat with ${c.name}?`))return;
      saveChats(list.filter(x=>x.id!==c.id));const msgs=read(MSG_KEY,{});delete msgs[c.id];write(MSG_KEY,msgs);toast('Chat deleted.',true);setTimeout(()=>location.reload(),250);return;
    }
    if(label==='mark unread'){
      e.preventDefault();e.stopImmediatePropagation();
      const menu=btn.closest('.floating-chat-menu');const candidate=menu?.previousElementSibling;const name=candidate?.querySelector('.chat-meta b')?.childNodes?.[0]?.textContent?.trim();
      const list=chats();const c=list.find(x=>x.name===name);if(c){c.unread=Math.max(1,Number(c.unread)||0);saveChats(list);toast('Chat marked unread.',true);setTimeout(()=>location.reload(),200)}return;
    }

    if(label==='call'&&btn.closest('.info-actions')){e.preventDefault();document.querySelector('.chat-actions [title="Voice call"]')?.click();return;}
    if(label==='video'&&btn.closest('.info-actions')){e.preventDefault();document.querySelector('.chat-actions [title="Video call"]')?.click();return;}

    if((label==='report'||label==='block')&&btn.closest('.danger-actions')){
      e.preventDefault();
      const c=activeChat();if(!c)return;
      if(label==='report'){
        const reason=prompt('Report reason (spam, scam, harassment, abuse, other):','spam');if(!reason)return;
        const reports=read(REPORTS_KEY,[]);reports.unshift({id:crypto.randomUUID(),userId:c.userId,chatId:c.id,reason:reason.trim(),createdAt:new Date().toISOString()});write(REPORTS_KEY,reports);toast('Report submitted.',true);return;
      }
      if(!confirm(`Block ${c.name}? They will be hidden from your chat list.`))return;
      const blocks=read(BLOCKS_KEY,[]);if(!blocks.includes(c.userId))blocks.push(c.userId);write(BLOCKS_KEY,blocks);saveChats(chats().filter(x=>x.id!==c.id));toast(`${c.name} blocked.`,true);setTimeout(()=>location.reload(),250);return;
    }

    const row=btn.closest('.setting-row');
    if(row){
      const title=row.querySelector('b')?.textContent?.trim();if(!title)return;
      e.preventDefault();
      if(title==='Display name'||title==='About'){
        const me=user();const value=prompt(title,title==='Display name'?(me?.name||''):'Available on Pro Chat');if(value===null)return;
        const body=title==='Display name'?{name:value.trim()}:{about:value.trim()};
        try{const updated=await api('/api/users/me',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});write(USER_KEY,{...me,...updated});toast(`${title} updated.`,true);setTimeout(()=>location.reload(),250)}catch(err){toast(err.message)}return;
      }
      if(title==='Delete account'){
        modal('Delete account','<p>This permanently disables the account and revokes active sessions.</p><label>Password</label><input type="password" data-password autocomplete="current-password" required>',async box=>{const password=box.querySelector('[data-password]').value;if(!password)throw new Error('Enter your password.');await api('/api/users/me',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});localStorage.clear();location.reload()});return;
      }
      if(title==='Two-step verification'){
        try{const setup=await api('/api/auth/2fa/setup',{method:'POST'});modal('Enable two-step verification',`<p>Secret: <code>${setup.secret}</code></p><p>Enter the 6-digit code from your authenticator app.</p><input data-code inputmode="numeric" maxlength="6">`,async box=>{const code=box.querySelector('[data-code]').value.trim();if(!/^\d{6}$/.test(code))throw new Error('Enter the 6-digit code.');const out=await api('/api/auth/2fa/enable',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});toast(`Two-step verification enabled. Save your ${out.recoveryCodes?.length||0} recovery codes.`,true)});}catch(err){toast(err.message)}return;
      }
      if(title==='Change password'){
        modal('Change password','<label>Current password</label><input type="password" data-current><label>New password</label><input type="password" data-next minlength="8">',async box=>{const currentPassword=box.querySelector('[data-current]').value,newPassword=box.querySelector('[data-next]').value;if(newPassword.length<8)throw new Error('New password must be at least 8 characters.');await api('/api/auth/change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword,newPassword})});toast('Password changed. Other sessions were revoked.',true)});return;
      }
      const settings=read(SETTINGS_KEY,{});settings[title]=!settings[title];write(SETTINGS_KEY,settings);const value=row.querySelector('span');if(value)value.textContent=settings[title]?'On':'Off';toast(`${title}: ${settings[title]?'On':'Off'}`,true);return;
    }

    if(btn.closest('.call-row')){
      const row=btn.closest('.call-row');const name=row.querySelector('b')?.textContent?.trim();const type=label.includes('video')?'video':'voice';
      const chatButton=[...document.querySelectorAll('.chat-row .chat-main')].find(x=>x.innerText.includes(name));
      if(chatButton){e.preventDefault();chatButton.click();setTimeout(()=>document.querySelector(`.chat-actions [title="${type==='video'?'Video':'Voice'} call"]`)?.click(),250)}return;
    }

    if(btn.closest('.media-tabs')){e.preventDefault();const key=label;const msgs=Object.values(read(MSG_KEY,{})).flat();const count=key==='media'?msgs.filter(m=>m.text?.startsWith('[media]')).length:key==='links'?msgs.filter(m=>/https?:\/\//i.test(m.text||'')).length:msgs.filter(m=>m.text?.startsWith('[file]')).length;toast(`${key[0].toUpperCase()+key.slice(1)}: ${count} item${count===1?'':'s'}`,true);return;}
  },true);

  document.addEventListener('change',e=>{
    const input=e.target.closest('input[type=file]');if(!input||!input.files?.length)return;
    const names=[...input.files].map(f=>f.name).join(', ');toast(`${input.files.length} file${input.files.length===1?'':'s'} selected: ${names}`,true);
  },true);

  const style=document.createElement('style');style.textContent=`
.action-fix-toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,20px);opacity:0;pointer-events:none;z-index:100000;background:#17212b;color:#fff;padding:11px 16px;border-radius:12px;font:600 13px/1.35 system-ui;box-shadow:0 10px 30px #0003;transition:.18s}.action-fix-toast.show{opacity:1;transform:translate(-50%,0)}
.action-fix-toast[data-ok="1"]{background:#0a7c70}.action-fix-modal{position:fixed;inset:0;z-index:100001;display:grid;place-items:center;background:#07131dcc;padding:18px;font-family:Inter,system-ui,sans-serif}.action-fix-card{width:min(460px,100%);background:#fff;border-radius:18px;box-shadow:0 30px 90px #0005;overflow:hidden}.action-fix-head{display:flex;justify-content:space-between;align-items:center;padding:18px 20px;border-bottom:1px solid #e5e7eb}.action-fix-head button{border:0;background:none;font-size:24px;cursor:pointer}.action-fix-body{padding:20px;color:#344054}.action-fix-body label{display:block;font-size:13px;font-weight:700;margin:10px 0 5px}.action-fix-body input{width:100%;box-sizing:border-box;border:1px solid #d0d5dd;border-radius:10px;padding:11px}.action-fix-actions{display:flex;gap:8px;justify-content:flex-end;padding:14px 20px;background:#f8fafc}.action-fix-actions button{border:1px solid #d0d5dd;border-radius:10px;padding:9px 14px;cursor:pointer}.action-fix-actions .primary{background:#0a7c70;color:#fff;border-color:#0a7c70}`;document.head.appendChild(style);
})();
