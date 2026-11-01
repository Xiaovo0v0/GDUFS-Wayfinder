"""List named OSM features around a campus, expressed in model metres (ASCII out)."""
import json, math, sys

LAT0 = 23.066554348076398
LON0 = 113.39215489681557


def to_local(lat, lon):
    kx = 111320.0 * math.cos(math.radians(LAT0))
    kz = 110540.0
    x = -(lon - LON0) * kx
    z = (lat - LAT0) * kz
    return x, z


def main():
    path = sys.argv[1]
    kw = sys.argv[2:] or ['']
    data = json.load(open(path, encoding='utf-8'))
    els = data.get('elements', data if isinstance(data, list) else [])
    rows = []
    for e in els:
        t = e.get('tags') or {}
        name = (t.get('name') or '').strip()
        if not name:
            continue
        if not any(k in name for k in kw):
            continue
        if e['type'] == 'node':
            lat, lon = e['lat'], e['lon']
        else:
            g = e.get('geometry') or []
            if g:
                lat = sum(p['lat'] for p in g) / len(g)
                lon = sum(p['lon'] for p in g) / len(g)
            elif 'center' in e:
                lat, lon = e['center']['lat'], e['center']['lon']
            elif 'lat' in e and 'lon' in e:
                lat, lon = e['lat'], e['lon']
            else:
                continue
        x, z = to_local(lat, lon)
        rows.append((name, t.get('building') or t.get('amenity') or t.get('highway') or '',
                     e['type'], x, z, lat, lon))
    rows.sort(key=lambda r: -r[5])
    print('%d rows' % len(rows))
    for name, kind, typ, x, z, lat, lon in rows:
        print('%-34s %-10s %-4s x=%8.1f z=%8.1f  %.6f,%.6f' % (name[:34], kind[:10], typ, x, z, lat, lon))


if __name__ == '__main__':
    main()
