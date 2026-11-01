# -*- coding: utf-8 -*-
"""Sync places[] entries (x/z/node) from their referenced buildings (ASCII only)."""
import io
import json
import re

PATH = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\gdufs-data.js'


def obj_span(text, key, bid):
    pat = r'\{"%s":"%s"[^{}]*\}' % (key, bid)
    m = re.search(pat, text)
    if not m:
        raise SystemExit('cannot locate %s %s' % (key, bid))
    return m.span(), m.group(0)


def main(ids):
    s = io.open(PATH, encoding='utf-8').read()
    edits = []
    for bid in ids:
        (bs, be), btxt = obj_span(s, 'id', bid)
        b = json.loads(btxt)
        # find the places entry referencing this building
        m = re.search(r'\{"label":"[^"]*"[^{}]*"ref":"%s"[^{}]*\}' % bid, s)
        if not m:
            print('  %s: no place entry' % bid)
            continue
        p = json.loads(m.group(0))
        # place entry order is label,x,z,kind,node,ref -> patch numbers in place
        txt = m.group(0)
        txt = re.sub(r'"x":-?[\d.]+', '"x":%s' % b['access'][0], txt, count=1)
        txt = re.sub(r'"z":-?[\d.]+', '"z":%s' % b['access'][1], txt, count=1)
        txt = re.sub(r'"node":\d+', '"node":%d' % b['node'], txt, count=1)
        old = (p['x'], p['z'], p['node'])
        new = (b['access'][0], b['access'][1], b['node'])
        print('  %s %-16s (%s, %s, %s) -> %s' % (bid, p['label'], old[0], old[1], old[2], new))
        edits.append((m.span(), txt))
    edits.sort()
    for (st, en), txt in reversed(edits):
        s = s[:st] + txt + s[en:]
    head, body = s.split('=', 1)
    json.loads(body.strip().rstrip(';'))
    io.open(PATH, 'w', encoding='utf-8', newline='\n').write(s)
    print('places synced: %d' % len(edits))


if __name__ == '__main__':
    import sys
    main(sys.argv[1:])
