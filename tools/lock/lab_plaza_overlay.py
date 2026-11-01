# -*- coding: utf-8 -*-
"""Emit overlay JSON for lab wings + the courtyard plaza rectangle."""
import sys
import json
import math

sys.path.insert(0, r'C:\Users\86134\Desktop\gdufs\tools\lock')
import plan_common as pc

LAT0 = 23.066554348076398
LON0 = 113.39215489681557
KX = 111320.0 * math.cos(math.radians(LAT0))
KZ = 110540.0


def ll(x, z):
    return [LON0 - x / KX, LAT0 + z / KZ]


d = pc.load_js(r'C:\Users\86134\Desktop\gdufs\gdufs-3d\gdufs-data.js')
bs = [b for b in pc.buildings(d) if b['id'].startswith('B045')]
spec = {'polylines': [], 'points': []}
for b in bs:
    first = True
    for r in b['rings']:
        spec['polylines'].append({
            'pts': [ll(x, z) for x, z in r],
            'color': '#ff4d6d', 'w': 3,
            'label': b['name'] if first else None,
        })
        first = False

cx, cz = -193.25, 112.2
rect = [[cx - 75, cz - 65], [cx + 75, cz - 65], [cx + 75, cz + 65],
        [cx - 75, cz + 65], [cx - 75, cz - 65]]
spec['polylines'].append({
    'pts': [ll(x, z) for x, z in rect],
    'color': '#ffa02e', 'w': 4, 'label': 'plaza 150x130', 'size': 20,
})

with open(r'C:\Users\86134\Desktop\gdufs\artifacts\lock\overlay_lab.json', 'w',
          encoding='utf-8') as fh:
    json.dump(spec, fh, ensure_ascii=False)
print('ok', len(spec['polylines']))
