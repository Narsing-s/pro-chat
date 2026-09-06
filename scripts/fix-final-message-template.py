from pathlib import Path
p=Path('apps/server/src/server.ts')
s=p.read_text(encoding='utf-8')
bad='forwardedFrom"',[id,chatId'
good='forwardedFrom"` ,[id,chatId'.replace('"` [','"`[')
# Keep the exact comma immediately after the closing template literal.
good='forwardedFrom"`,'+'[id,chatId'
if bad not in s:
    raise SystemExit('message send template marker not found')
p.write_text(s.replace(bad,good,1),encoding='utf-8')
print('fixed message send template literal')
