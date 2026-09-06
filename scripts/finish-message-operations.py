from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def replace_once(path, old, new):
    p = ROOT / path
    s = p.read_text(encoding='utf-8')
    if old not in s:
        raise SystemExit(f'Marker not found in {path}: {old[:120]!r}')
    if s.count(old) != 1:
        raise SystemExit(f'Marker occurs {s.count(old)} times in {path}: {old[:120]!r}')
    p.write_text(s.replace(old, new), encoding='utf-8')

# Persistent message-operation data.
replace_once('apps/server/src/db.ts',
"    CREATE TABLE IF NOT EXISTS pro_chat_blocks(",
"""    ALTER TABLE pro_chat_messages ADD COLUMN IF NOT EXISTS reply_to_id TEXT REFERENCES pro_chat_messages(id) ON DELETE SET NULL;
    ALTER TABLE pro_chat_messages ADD COLUMN IF NOT EXISTS forwarded_from_id TEXT REFERENCES pro_chat_messages(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS pro_chat_messages_reply_idx ON pro_chat_messages(reply_to_id);
    CREATE INDEX IF NOT EXISTS pro_chat_messages_forward_idx ON pro_chat_messages(forwarded_from_id);

    CREATE TABLE IF NOT EXISTS pro_chat_message_deleted_for_me(
      message_id TEXT NOT NULL REFERENCES pro_chat_messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,
      deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(message_id,user_id)
    );
    CREATE INDEX IF NOT EXISTS pro_chat_message_deleted_user_idx ON pro_chat_message_deleted_for_me(user_id,deleted_at DESC);

    CREATE TABLE IF NOT EXISTS pro_chat_message_reactions(
      message_id TEXT NOT NULL REFERENCES pro_chat_messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(message_id,user_id)
    );
    CREATE INDEX IF NOT EXISTS pro_chat_message_reactions_message_idx ON pro_chat_message_reactions(message_id);

    CREATE TABLE IF NOT EXISTS pro_chat_message_pins(
      message_id TEXT PRIMARY KEY REFERENCES pro_chat_messages(id) ON DELETE CASCADE,
      pinned_by TEXT NOT NULL REFERENCES pro_chat_users(id) ON DELETE CASCADE,
      pinned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS pro_chat_message_pins_user_idx ON pro_chat_message_pins(pinned_by,pinned_at DESC);

    CREATE TABLE IF NOT EXISTS pro_chat_blocks(""")

# Replace the message list route with one that applies per-user deletion and exposes operations metadata.
replace_once('apps/server/src/server.ts',
"app.get('/api/messages/:chatId',async(req:any,reply)=>{const a=await auth(req,reply);if(!a)return reply.code(401).send({error:'Authentication required'});const chatId=String(req.params.chatId);if(!validChat(chatId,a.user.id))return reply.code(403).send({error:'Conversation access denied'});const r=await db.query(`SELECT id,chat_id AS \"chatId\",sender_id AS \"senderId\",text,created_at AS \"createdAt\",delivered,read,edited,deleted FROM pro_chat_messages WHERE chat_id=$1 ORDER BY created_at ASC LIMIT 500`,[chatId]);return r.rows;});",
"""app.get('/api/messages/:chatId',async(req:any,reply)=>{const a=await auth(req,reply);if(!a)return reply.code(401).send({error:'Authentication required'});const chatId=String(req.params.chatId);if(!validChat(chatId,a.user.id))return reply.code(403).send({error:'Conversation access denied'});const r=await db.query(`SELECT m.id,m.chat_id AS \"chatId\",m.sender_id AS \"senderId\",m.text,m.created_at AS \"createdAt\",m.delivered,m.read,m.edited,m.deleted,m.reply_to_id AS \"replyTo\",m.forwarded_from_id AS \"forwardedFrom\",p.message_id IS NOT NULL AS pinned,COALESCE((SELECT json_agg(json_build_object('emoji',rx.emoji,'userId',rx.user_id) ORDER BY rx.created_at) FROM pro_chat_message_reactions rx WHERE rx.message_id=m.id),'[]'::json) AS reactions FROM pro_chat_messages m LEFT JOIN pro_chat_message_pins p ON p.message_id=m.id WHERE m.chat_id=$1 AND NOT EXISTS (SELECT 1 FROM pro_chat_message_deleted_for_me d WHERE d.message_id=m.id AND d.user_id=$2) ORDER BY m.created_at ASC LIMIT 500`,[chatId,a.user.id]);return r.rows;});

app.patch('/api/messages/:messageId',async(req:any,reply)=>{const a=await auth(req,reply);if(!a)return reply.code(401).send({error:'Authentication required'});const text=String(req.body?.text??'').trim();if(!text||text.length>10000)return reply.code(400).send({error:'Message text must be 1-10000 characters'});const r=await db.query(`UPDATE pro_chat_messages SET text=$1,edited=true WHERE id=$2 AND sender_id=$3 AND deleted=false RETURNING id,chat_id AS \"chatId\",sender_id AS \"senderId\",text,created_at AS \"createdAt\",delivered,read,edited,deleted,reply_to_id AS \"replyTo\",forwarded_from_id AS \"forwardedFrom\"`,[text,String(req.params.messageId),a.user.id]);if(!r.rowCount)return reply.code(404).send({error:'Message not found or cannot be edited'});io.to(`chat:${r.rows[0].chatId}`).emit('message:updated',r.rows[0]);return r.rows[0];});

app.delete('/api/messages/:messageId',async(req:any,reply)=>{const a=await auth(req,reply);if(!a)return reply.code(401).send({error:'Authentication required'});const id=String(req.params.messageId);const scope=String(req.query?.scope||req.body?.scope||'me').toLowerCase();const msg=await db.query('SELECT id,chat_id AS \"chatId\",sender_id AS \"senderId\" FROM pro_chat_messages WHERE id=$1',[id]);if(!msg.rowCount)return reply.code(404).send({error:'Message not found'});const m=msg.rows[0];if(!validChat(String(m.chatId),a.user.id))return reply.code(403).send({error:'Conversation access denied'});if(scope==='everyone'){if(String(m.senderId)!==a.user.id)return reply.code(403).send({error:'Only the sender can delete a message for everyone'});const r=await db.query(`UPDATE pro_chat_messages SET deleted=true,text='This message was deleted' WHERE id=$1 RETURNING id,chat_id AS \"chatId\",sender_id AS \"senderId\",text,created_at AS \"createdAt\",delivered,read,edited,deleted,reply_to_id AS \"replyTo\",forwarded_from_id AS \"forwardedFrom\"`,[id]);io.to(`chat:${m.chatId}`).emit('message:updated',r.rows[0]);return {ok:true,scope:'everyone',message:r.rows[0]};}await db.query('INSERT INTO pro_chat_message_deleted_for_me(message_id,user_id) VALUES($1,$2) ON CONFLICT (message_id,user_id) DO NOTHING',[id,a.user.id]);return {ok:true,scope:'me',messageId:id};});

app.post('/api/messages/:messageId/reaction',async(req:any,reply)=>{const a=await auth(req,reply);if(!a)return reply.code(401).send({error:'Authentication required'});const id=String(req.params.messageId),emoji=String(req.body?.emoji||'').trim();if(!emoji||emoji.length>16)return reply.code(400).send({error:'A valid emoji reaction is required'});const m=await db.query('SELECT id,chat_id AS \"chatId\" FROM pro_chat_messages WHERE id=$1',[id]);if(!m.rowCount||!validChat(String(m.rows[0].chatId),a.user.id))return reply.code(404).send({error:'Message not found'});await db.query('INSERT INTO pro_chat_message_reactions(message_id,user_id,emoji) VALUES($1,$2,$3) ON CONFLICT (message_id,user_id) DO UPDATE SET emoji=EXCLUDED.emoji,created_at=NOW()',[id,a.user.id,emoji]);const r=await db.query(`SELECT emoji,user_id AS \"userId\" FROM pro_chat_message_reactions WHERE message_id=$1 ORDER BY created_at`,[id]);io.to(`chat:${m.rows[0].chatId}`).emit('message:reaction',{messageId:id,reactions:r.rows});return {ok:true,messageId:id,reactions:r.rows};});

app.delete('/api/messages/:messageId/reaction',async(req:any,reply)=>{const a=await auth(req,reply);if(!a)return reply.code(401).send({error:'Authentication required'});const id=String(req.params.messageId);const m=await db.query('SELECT id,chat_id AS \"chatId\" FROM pro_chat_messages WHERE id=$1',[id]);if(!m.rowCount||!validChat(String(m.rows[0].chatId),a.user.id))return reply.code(404).send({error:'Message not found'});await db.query('DELETE FROM pro_chat_message_reactions WHERE message_id=$1 AND user_id=$2',[id,a.user.id]);const r=await db.query(`SELECT emoji,user_id AS \"userId\" FROM pro_chat_message_reactions WHERE message_id=$1 ORDER BY created_at`,[id]);io.to(`chat:${m.rows[0].chatId}`).emit('message:reaction',{messageId:id,reactions:r.rows});return {ok:true,messageId:id,reactions:r.rows};});

app.post('/api/messages/:messageId/pin',async(req:any,reply)=>{const a=await auth(req,reply);if(!a)return reply.code(401).send({error:'Authentication required'});const id=String(req.params.messageId);const m=await db.query('SELECT id,chat_id AS \"chatId\" FROM pro_chat_messages WHERE id=$1',[id]);if(!m.rowCount||!validChat(String(m.rows[0].chatId),a.user.id))return reply.code(404).send({error:'Message not found'});await db.query('INSERT INTO pro_chat_message_pins(message_id,pinned_by) VALUES($1,$2) ON CONFLICT (message_id) DO UPDATE SET pinned_by=EXCLUDED.pinned_by,pinned_at=NOW()',[id,a.user.id]);io.to(`chat:${m.rows[0].chatId}`).emit('message:pin',{messageId:id,pinned:true});return {ok:true,messageId:id,pinned:true};});

app.delete('/api/messages/:messageId/pin',async(req:any,reply)=>{const a=await auth(req,reply);if(!a)return reply.code(401).send({error:'Authentication required'});const id=String(req.params.messageId);const m=await db.query('SELECT id,chat_id AS \"chatId\" FROM pro_chat_messages WHERE id=$1',[id]);if(!m.rowCount||!validChat(String(m.rows[0].chatId),a.user.id))return reply.code(404).send({error:'Message not found'});await db.query('DELETE FROM pro_chat_message_pins WHERE message_id=$1',[id]);io.to(`chat:${m.rows[0].chatId}`).emit('message:pin',{messageId:id,pinned:false});return {ok:true,messageId:id,pinned:false};});

app.post('/api/messages/:messageId/forward',async(req:any,reply)=>{const a=await auth(req,reply);if(!a)return reply.code(401).send({error:'Authentication required'});const id=String(req.params.messageId),target=String(req.body?.targetChatId||'');if(!validChat(target,a.user.id))return reply.code(403).send({error:'Target conversation access denied'});const src=await db.query('SELECT id,chat_id AS \"chatId\",sender_id AS \"senderId\",text,deleted FROM pro_chat_messages WHERE id=$1',[id]);if(!src.rowCount)return reply.code(404).send({error:'Message not found'});const text=src.rows[0].deleted?'This message was deleted':String(src.rows[0].text);const newId=randomUUID();const r=await db.query(`INSERT INTO pro_chat_messages(id,chat_id,sender_id,text,created_at,delivered,read,edited,deleted,forwarded_from_id) VALUES($1,$2,$3,$4,NOW(),false,false,false,false,$5) RETURNING id,chat_id AS \"chatId\",sender_id AS \"senderId\",text,created_at AS \"createdAt\",delivered,read,edited,deleted,reply_to_id AS \"replyTo\",forwarded_from_id AS \"forwardedFrom\"`,[newId,target,a.user.id,text,id]);const message=r.rows[0];const recipient=participants(target).find(x=>x!==a.user.id);if(recipient)sendUser(recipient,'message:new',message);io.to(`chat:${target}`).emit('message:new',message);return message;});

app.get('/api/messages/:messageId/info',async(req:any,reply)=>{const a=await auth(req,reply);if(!a)return reply.code(401).send({error:'Authentication required'});const r=await db.query(`SELECT m.id,m.chat_id AS \"chatId\",m.sender_id AS \"senderId\",u.name AS \"senderName\",u.username AS \"senderUsername\",m.text,m.created_at AS \"createdAt\",m.delivered,m.read,m.edited,m.deleted,p.pinned_at AS \"pinnedAt\" FROM pro_chat_messages m JOIN pro_chat_users u ON u.id=m.sender_id LEFT JOIN pro_chat_message_pins p ON p.message_id=m.id WHERE m.id=$1`,[String(req.params.messageId)]);if(!r.rowCount||!validChat(String(r.rows[0].chatId),a.user.id))return reply.code(404).send({error:'Message not found'});return r.rows[0];});""")

# Persist reply metadata in socket-created messages.
replace_once('apps/server/src/server.ts',
"const r=await db.query(`INSERT INTO pro_chat_messages(id,chat_id,sender_id,text,created_at,delivered,read,edited,deleted) VALUES($1,$2,$3,$4,NOW(),$5,false,false,false) RETURNING id,chat_id AS \"chatId\",sender_id AS \"senderId\",text,created_at AS \"createdAt\",delivered,read,edited,deleted`,[id,chatId,uid,text,delivered]);",
"const replyTo=String(input?.replyTo||'')||null;const r=await db.query(`INSERT INTO pro_chat_messages(id,chat_id,sender_id,text,created_at,delivered,read,edited,deleted,reply_to_id) VALUES($1,$2,$3,$4,NOW(),$5,false,false,false,$6) RETURNING id,chat_id AS \"chatId\",sender_id AS \"senderId\",text,created_at AS \"createdAt\",delivered,read,edited,deleted,reply_to_id AS \"replyTo\",forwarded_from_id AS \"forwardedFrom\`,[id,chatId,uid,text,delivered,replyTo]);")

# Frontend: replace local-only message actions with real API operations and wire them into the UI.
replace_once('apps/web/src/main.jsx',
"async function deleteMessage(m,all=false){setMessages(p=>({...p,[active]:(p[active]||[]).map(x=>x.id===m.id?{...x,deleted:true,text:all?'This message was deleted':'Message deleted'}:x)}));try{await fetch(`${API}/api/messages/${m.id}`,{method:'DELETE',headers:{Authorization:`Bearer ${me.token}`}})}catch{}}",
"""async function deleteMessage(m,all=false){const scope=all?'everyone':'me';try{const r=await fetch(`${API}/api/messages/${m.id}?scope=${scope}`,{method:'DELETE',headers:{Authorization:`Bearer ${me.token}`}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Delete failed');if(all)setMessages(p=>({...p,[active]:(p[active]||[]).map(x=>x.id===m.id?{...x,deleted:true,text:'This message was deleted'}:x)}));else setMessages(p=>({...p,[active]:(p[active]||[]).filter(x=>x.id!==m.id)}));setToast?.(all?'Message deleted for everyone':'Message deleted for you')}catch(e){setToast?.(e.message||'Message could not be deleted')}}
 async function reactMessage(m){const emojiValue=prompt('Choose an emoji reaction',m.reactions?.find?.(r=>r.userId===me.id)?.emoji||'👍')?.trim();if(!emojiValue)return;try{const r=await fetch(`${API}/api/messages/${m.id}/reaction`,{method:'POST',headers:{Authorization:`Bearer ${me.token}`,'Content-Type':'application/json'},body:JSON.stringify({emoji:emojiValue})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Reaction failed');setMessages(p=>({...p,[active]:(p[active]||[]).map(x=>x.id===m.id?{...x,reactions:d.reactions}:x)}))}catch(e){setToast?.(e.message||'Reaction could not be saved')}}
 async function pinMessage(m){try{const pinned=m.pinned;const r=await fetch(`${API}/api/messages/${m.id}/pin`,{method:pinned?'DELETE':'POST',headers:{Authorization:`Bearer ${me.token}`}});const d=await r.json();if(!r.ok)throw new Error(d.error||'Pin failed');setMessages(p=>({...p,[active]:(p[active]||[]).map(x=>x.id===m.id?{...x,pinned:d.pinned}:x)}))}catch(e){setToast?.(e.message||'Pin could not be updated')}}
 async function forwardMessage(m){const available=chats.filter(c=>c.id!==active);if(!available.length){setToast?.('No other conversation is available for forwarding.');return}const choices=available.map((c,i)=>`${i+1}. ${c.name}`).join('\\n');const pick=prompt(`Forward to:\\n${choices}\\n\\nEnter the number`, '1');const index=Number(pick)-1;const target=available[index];if(!target)return;try{const r=await fetch(`${API}/api/messages/${m.id}/forward`,{method:'POST',headers:{Authorization:`Bearer ${me.token}`,'Content-Type':'application/json'},body:JSON.stringify({targetChatId:target.id})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Forward failed');setMessages(p=>({...p,[target.id]:[...(p[target.id]||[]),d]}));setChats(p=>p.map(c=>c.id===target.id?{...c,lastMessage:d.text,lastAt:d.createdAt}:c));setToast?.(`Message forwarded to ${target.name}`)}catch(e){setToast?.(e.message||'Message could not be forwarded')}}
 async function messageInfo(m){try{const r=await fetch(`${API}/api/messages/${m.id}/info`,{headers:{Authorization:`Bearer ${me.token}`}});const d=await r.json();if(!r.ok)throw new Error(d.error||'Message info failed');alert(`Message info\\n\\nFrom: ${d.senderName||d.senderUsername||'Unknown'}\\nSent: ${new Date(d.createdAt).toLocaleString()}\\nDelivered: ${d.delivered?'Yes':'No'}\\nRead: ${d.read?'Yes':'No'}\\nEdited: ${d.edited?'Yes':'No'}\\nPinned: ${d.pinnedAt?'Yes':'No'}`)}catch(e){setToast?.(e.message||'Message info could not be loaded')}}""")

replace_once('apps/web/src/main.jsx',
"send={send} searchChat={searchChat} setSearchChat={setSearchChat} toast={setToast}/>",
"send={send} searchChat={searchChat} setSearchChat={setSearchChat} toast={setToast} onReact={reactMessage} onPin={pinMessage} onForward={forwardMessage} onInfo={messageInfo}/>")

replace_once('apps/web/src/main.jsx',
"function Conversation({chat,messages,me,text,setText,emoji,setEmoji,attachment,setAttachment,reply,setReply,fileRef,call,onBack,onMenu,menuOpen,toggleChat,onPanel,selectedMessage,setSelectedMessage,editMessage,deleteMessage,starred,setStarred,send,searchChat,setSearchChat,toast}){",
"function Conversation({chat,messages,me,text,setText,emoji,setEmoji,attachment,setAttachment,reply,setReply,fileRef,call,onBack,onMenu,menuOpen,toggleChat,onPanel,selectedMessage,setSelectedMessage,editMessage,deleteMessage,starred,setStarred,send,searchChat,setSearchChat,toast,onReact,onPin,onForward,onInfo}){")

replace_once('apps/web/src/main.jsx',
"onReply={setReply} onStar={m=>setStarred(p=>p.some(x=>x.id===m.id)?p.filter(x=>x.id!==m.id):[...p,m])} starred={starred.some(x=>x.id===m.id)} selected={selectedMessage===m.id} setSelected={setSelectedMessage}/>)",
"onReply={setReply} onStar={m=>setStarred(p=>p.some(x=>x.id===m.id)?p.filter(x=>x.id!==m.id):[...p,m])} onReact={onReact} onPin={onPin} onForward={onForward} onInfo={onInfo} starred={starred.some(x=>x.id===m.id)} selected={selectedMessage===m.id} setSelected={setSelectedMessage}/>)")

replace_once('apps/web/src/main.jsx',
"function MessageBubble({m,mine,onEdit,onDelete,onReply,onStar,starred,selected,setSelected}){const[open,setOpen]=useState(false);",
"function MessageBubble({m,mine,onEdit,onDelete,onReply,onStar,onReact,onPin,onForward,onInfo,starred,selected,setSelected}){const[open,setOpen]=useState(false);")

replace_once('apps/web/src/main.jsx',
"<button onClick={()=>{onReply(m);setOpen(false)}}><Forward/> Forward</button>{mine&&!m.deleted&&<button onClick={()=>{onEdit(m);setOpen(false)}}><Edit3/> Edit</button>}",
"<button onClick={()=>{onForward(m);setOpen(false)}}><Forward/> Forward</button><button onClick={()=>{onReact(m);setOpen(false)}}>❤️ React</button><button onClick={()=>{onPin(m);setOpen(false)}}><Pin/> {m.pinned?'Unpin':'Pin'}</button><button onClick={()=>{onInfo(m);setOpen(false)}}><Eye/> Message info</button>{mine&&!m.deleted&&<button onClick={()=>{onEdit(m);setOpen(false)}}><Edit3/> Edit</button>")

# Make edit failures visible and roll back optimistic UI instead of silently pretending success.
replace_once('apps/web/src/main.jsx',
"async function editMessage(m){const v=prompt('Edit message',m.text);if(!v?.trim())return;setMessages(p=>({...p,[active]:(p[active]||[]).map(x=>x.id===m.id?{...x,text:v.trim(),edited:true}:x)}));try{await fetch(`${API}/api/messages/${m.id}`,{method:'PATCH',headers:{Authorization:`Bearer ${me.token}`,'Content-Type':'application/json'},body:JSON.stringify({text:v.trim()})})}catch{setToast('Message updated locally; server update failed.')}}",
"""async function editMessage(m){const v=prompt('Edit message',m.text);if(!v?.trim()||v.trim()===m.text)return;try{const r=await fetch(`${API}/api/messages/${m.id}`,{method:'PATCH',headers:{Authorization:`Bearer ${me.token}`,'Content-Type':'application/json'},body:JSON.stringify({text:v.trim()})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Message update failed');setMessages(p=>({...p,[active]:(p[active]||[]).map(x=>x.id===m.id?{...x,...d}:x)}));setToast('Message edited')}catch(e){setToast(e.message||'Message could not be edited')}}""")

# Remove stale duplicate forward-as-reply behavior if a formatter changes whitespace in future.
print('message operation patch complete')
