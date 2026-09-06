from pathlib import Path
p=Path('apps/server/src/server.ts')
s=p.read_text(encoding='utf-8')
bad='forwardedFrom'+'\\'+'`'
good='forwardedFrom'+'"'+'`'
if bad not in s:
    raise SystemExit('bad socket quote sequence not found')
p.write_text(s.replace(bad,good,1),encoding='utf-8')
print('finalized template literal quote')
