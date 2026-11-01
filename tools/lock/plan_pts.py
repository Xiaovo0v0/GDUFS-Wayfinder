# -*- coding: utf-8 -*-
"""Map plan pixel coordinates to lon/lat via a local affine, emit overlay JSON."""
import json
import math

LAT0 = 23.066554348076398
LON0 = 113.39215489681557
KX = 111320.0 * math.cos(math.radians(LAT0))
KZ = 110540.0

# affine fitted on the 北苑1..4 labels: x = A - (px - PX0)/SX ; z = B - (py - PY0)/SZ
PX0, PY0 = 207.0, 1274.0
AX, AZ = 177.8, -217.7
SX, SZ = 1.43, 1.18

PTS = [
    ('wencai', 335, 1274, '#00ff88'),
    ('boya', 440, 1415, '#ff3355'),
    ('sze1', 402, 1480, '#ffcc00'),
    ('sze2', 405, 1515, '#ffcc00'),
    ('sze3', 495, 1460, '#ffcc00'),
    ('sze4', 510, 1512, '#ffcc00'),
    ('by5', 390, 1585, '#33ccff'),
    ('by6', 375, 1657, '#33ccff'),
    ('youyuan', 500, 1620, '#ff88ff'),
    ('huodong', 260, 1570, '#ffffff'),
]


def ll(px, py):
    x = AX - (px - PX0) / SX
    z = AZ - (py - PY0) / SZ
    return LON0 - x / KX, LAT0 + z / KZ


pts = []
for name, px, py, col in PTS:
    lon, lat = ll(px, py)
    pts.append({'lon': lon, 'lat': lat, 'color': col, 'label': name, 'size': 15})

json.dump({'polylines': [], 'points': pts},
          open(r'C:\Users\86134\Desktop\gdufs\artifacts\lock\overlay_plantest.json', 'w',
               encoding='utf-8'), ensure_ascii=False)
print('ok', len(pts))
