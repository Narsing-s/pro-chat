from pathlib import Path
p=Path('apps/web/src/main.jsx')
s=p.read_text(encoding='utf-8')
old="s.on('message:read',p=>setMessages(pv=>({...pv,[p.chatId]:(pv[p.chatId]||[]).map(x=>x.id===p.messageId?{...x,read:true,delivered:true}:x)})));"
new="""s.on('message:read',p=>setMessages(pv=>({...pv,[p.chatId]:(pv[p.chatId]||[]).map(x=>x.id===p.messageId?{...x,read:true,delivered:true}:x)})));
s.on('message:updated',m=>setMessages(pv=>({...pv,[m.chatId]:(pv[m.chatId]||[]).map(x=>x.id===m.id?{...x,...m}:x)})));
s.on('message:reaction',p=>setMessages(pv=>({...pv,[active]:(pv[active]||[]).map(x=>x.id===p.messageId?{...x,reactions:p.reactions}:x)})));
s.on('message:pin',p=>setMessages(pv=>({...pv,[active]:(pv[active]||[]).map(x=>x.id===p.messageId?{...x,pinned:Boolean(p.pinned)}:x)})));"""
if old not in s:
    raise SystemExit('message:read marker not found')
p.write_text(s.replace(old,new,1),encoding='utf-8')
print('added realtime message operation handlers')
