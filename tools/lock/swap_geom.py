# -*- coding: utf-8 -*-
"""Swap footprints/positions of two south-campus buildings (ASCII only).

The south data is a single-line JSON blob. Building objects contain no nested
braces, so each object can be matched with a non-greedy regex and swapped
field by field. Geometry fields travel with the footprint; identity fields
(name/type/levels/height) stay with the record.
"""
import io
import json
import re
import sys

PATH = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\gdufs-data.js'
GEOM = ('rings', 'access', 'node', 'access_dist', 'area')


def obj_span(text, bid):
    m = re.search(r'\{"id":"%s"[^{}]*\}' % bid, text)
    if not m:
        raise SystemExit('cannot locate %s' % bid)
    return m.span(), m.group(0)


def main(a, b):
    s = io.open(PATH, encoding='utf-8').read()
    (sa, oa), (sb, ob) = obj_span(s, a), obj_span(s, b)
    ja, jb = json.loads(oa), json.loads(ob)

    def with_geom(src, donor):
        out = dict(src)
        for k in GEOM:
            out[k] = donor[k]
        return out

    na, nb = with_geom(ja, jb), with_geom(jb, ja)
    ta = json.dumps(na, ensure_ascii=False, separators=(',', ':'))
    tb = json.dumps(nb, ensure_ascii=False, separators=(',', ':'))
    assert '"id":"%s"' % a in ta and '"id":"%s"' % b in tb

    parts = [(sa, ta), (sb, tb)]
    parts.sort()
    for (start, end), txt in reversed(parts):
        s = s[:start] + txt + s[end:]

    head, body = s.split('=', 1)
    json.loads(body.strip().rstrip(';'))
    io.open(PATH, 'w', encoding='utf-8', newline='\n').write(s)

    print('swapped geometry: %s <-> %s' % (a, b))
    for bid, obj in ((a, na), (b, nb)):
        cx = sum(p[0] for p in obj['rings'][0]) / len(obj['rings'][0])
        cz = sum(p[1] for p in obj['rings'][0]) / len(obj['rings'][0])
        print('  %s %-16s now around (%.1f, %.1f) area=%.0f lv=%s'
              % (bid, obj['name'], cx, cz, obj['area'], obj['levels']))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
