# -*- coding: utf-8 -*-
"""Print raw JSON slice for given building ids in a data file (ASCII only)."""
import io
import sys

path = r'C:\Users\86134\Desktop\gdufs\gdufs-3d\gdufs-data.js'
s = io.open(path, encoding='utf-8').read()
for bid in sys.argv[1:]:
    key = '"id": "%s"' % bid
    i = s.find(key)
    if i < 0:
        key = '"id":"%s"' % bid
        i = s.find(key)
    if i < 0:
        print('missing', bid)
        continue
    start = s.rfind('{', 0, i)
    end = s.find('\n    }', start)
    print(s[start:end + 6])
    print('-----')
