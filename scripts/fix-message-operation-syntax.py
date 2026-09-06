from pathlib import Path
p=Path('apps/server/src/server.ts')
s=p.read_text(encoding='utf-8')
bad='forwardedFrom\\`'
if bad not in s:
    raise SystemExit('expected malformed socket SELECT marker not found')
p.write_text(s.replace(bad,'forwardedFrom"',1),encoding='utf-8')
print('fixed socket message SELECT quoting')
