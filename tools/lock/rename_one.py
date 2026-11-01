# -*- coding: utf-8 -*-
"""Rename one building and its place entry (ASCII only)."""
import io
import json
import re
import sys

PATH = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\gdufs-data.js'


def main(bid, newname):
    s = io.open(PATH, encoding='utf-8').read()
    m = re.search(r'\{"id":"%s"[^{}]*\}' % bid, s)
    if not m:
        raise SystemExit('building %s not found' % bid)
    obj = json.loads(m.group(0))
    old = obj['name']
    btxt = re.sub(r'"name":"[^"]*"', '"name":"%s"' % newname, m.group(0), count=1)
    s = s[:m.start()] + btxt + s[m.end():]

    p = re.search(r'\{"label":"[^"]*"[^{}]*"ref":"%s"[^{}]*\}' % bid, s)
    if p:
        ptxt = re.sub(r'"label":"[^"]*"', '"label":"%s"' % newname, p.group(0), count=1)
        s = s[:p.start()] + ptxt + s[p.end():]
        note = 'place label updated'
    else:
        note = 'no place entry'

    head, body = s.split('=', 1)
    json.loads(body.strip().rstrip(';'))
    io.open(PATH, 'w', encoding='utf-8', newline='\n').write(s)
    print('%s: "%s" -> "%s" (%s)' % (bid, old, newname, note))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
