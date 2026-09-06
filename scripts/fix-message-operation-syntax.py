from pathlib import Path
p=Path('apps/server/src/server.ts')
s=p.read_text(encoding='utf-8')
bad='forwarded_from_id AS \\\"forwardedFrom\\`'
good='forwarded_from_id AS \\\"forwardedFrom\\"`'
if bad not in s:
    raise SystemExit('expected malformed socket SELECT marker not found')
p.write_text(s.replace(bad,good,1),encoding='utf-8')
print('fixed socket message SELECT quoting')
