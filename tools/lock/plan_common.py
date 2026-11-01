"""Shared helpers: load model data, digitize plan rasters. ASCII only."""
import json, math, re

def load_js(path):
    s = open(path, encoding='utf-8').read()
    i = s.index('{')
    j = s.rindex('}')
    return json.loads(s[i:j + 1])

def centroid(rings):
    pts = rings[0]
    a = cx = cy = 0.0
    for i in range(len(pts) - 1):
        x0, y0 = pts[i]
        x1, y1 = pts[i + 1]
        cr = x0 * y1 - x1 * y0
        a += cr
        cx += (x0 + x1) * cr
        cy += (y0 + y1) * cr
    if abs(a) < 1e-9:
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        return sum(xs) / len(xs), sum(ys) / len(ys)
    a *= 0.5
    return cx / (6 * a), cy / (6 * a)

def area(rings):
    pts = rings[0]
    a = 0.0
    for i in range(len(pts) - 1):
        x0, y0 = pts[i]
        x1, y1 = pts[i + 1]
        a += x0 * y1 - x1 * y0
    return abs(a) * 0.5

def bbox_m(rings):
    xs = [p[0] for p in rings[0]]
    ys = [p[1] for p in rings[0]]
    return min(xs), min(ys), max(xs), max(ys)

def buildings(data):
    """Normalise both data files to [{id,name,kind,cx,cz,area,bbox,rings,levels}]."""
    out = []
    for b in data.get('buildings', []):
        rings = b.get('rings') or []
        if not rings:
            continue
        c = b.get('centroid')
        if c:
            cx, cz = c[0], c[1]
        else:
            cx, cz = centroid(rings)
        out.append({
            'id': b.get('id', ''),
            'name': (b.get('name') or '').strip(),
            'kind': b.get('kind') or b.get('type') or '',
            'levels': b.get('levels'),
            'cx': round(cx, 2),
            'cz': round(cz, 2),
            'area': round(area(rings), 1),
            'bbox': [round(v, 2) for v in bbox_m(rings)],
            'rings': rings,
        })
    return out
