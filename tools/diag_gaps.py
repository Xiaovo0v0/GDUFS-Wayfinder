import json, io, math
src = io.open('gdufs-3d/gdufs-data.js', encoding='utf-8').read()
D = json.loads(src[src.index('{'):src.rindex('}')+1])


def unit(v):
    l = math.hypot(v[0], v[1])
    return (v[0] / l, v[1] / l) if l > 1e-9 else (0.0, 0.0)


ends = []
for k, r in enumerate(D['roads']):
    for li, pts in enumerate(r['lines']):
        if len(pts) < 2:
            continue
        ends.append((k, li, 0, pts[0], unit((pts[0][0]-pts[1][0], pts[0][1]-pts[1][1])), r.get('highway')))
        ends.append((k, li, 1, pts[-1], unit((pts[-1][0]-pts[-2][0], pts[-1][1]-pts[-2][1])), r.get('highway')))

hits = []
for i in range(len(ends)):
    a = ends[i]
    for j in range(i+1, len(ends)):
        b = ends[j]
        if a[0] == b[0]:
            continue
        dx, dz = b[3][0]-a[3][0], b[3][1]-a[3][1]
        d = math.hypot(dx, dz)
        if d < 0.5 or d > 20:
            continue
        u = (dx/d, dz/d)
        ca = a[4][0]*u[0] + a[4][1]*u[1]
        cb = b[4][0]*-u[0] + b[4][1]*-u[1]
        if ca > 0.86 and cb > 0.86:
            hits.append((round(d, 1), a[0], a[5], b[0], b[5],
                         (round(a[3][0], 1), round(a[3][1], 1)), (round(b[3][0], 1), round(b[3][1], 1))))
hits.sort()
print('facing gaps remaining:', len(hits))
for h in hits:
    print('  ', h)
