"""Draw model footprints onto a plan raster (ASCII only).

usage: plan_overlay.py --data gdufs-3d/gdufs-data.js --img P --out Q
       [--s S] [--rot DEG] [--tx PX] [--ty PX] [--fit] [--ids] [--highlight B020,B021]
"""
import argparse, json, math
from PIL import Image, ImageDraw
import plan_common as pc

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True)
    ap.add_argument('--img', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--s', type=float, default=1.2255)
    ap.add_argument('--rot', type=float, default=0.0)
    ap.add_argument('--tx', type=float, default=None)
    ap.add_argument('--ty', type=float, default=None)
    ap.add_argument('--fit', action='store_true', help='fit scale+translation to image extent')
    ap.add_argument('--pad', type=float, default=30.0)
    ap.add_argument('--ids', action='store_true')
    ap.add_argument('--highlight', default='')
    ap.add_argument('--alpha', type=int, default=255)
    a = ap.parse_args()

    data = pc.load_js(a.data)
    bl = pc.buildings(data)
    im = Image.open(a.img).convert('RGB')
    W, H = im.size

    xs = [b['bbox'][0] for b in bl] + [b['bbox'][2] for b in bl]
    zs = [b['bbox'][1] for b in bl] + [b['bbox'][3] for b in bl]
    x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)

    s = a.s
    if a.fit:
        s = min((W - 2 * a.pad) / (x1 - x0), (H - 2 * a.pad) / (z1 - z0))
    th = math.radians(a.rot)
    ct, st = math.cos(th), math.sin(th)

    def to_px(x, z, tx, ty):
        # rotate around origin of model frame, then map x->px, z->-py
        rx = ct * x - st * z
        rz = st * x + ct * z
        return tx + s * rx, ty - s * rz

    if a.tx is None or a.ty is None:
        # centre the model bbox in the image
        cxm, czm = (x0 + x1) / 2.0, (z0 + z1) / 2.0
        rcx = ct * cxm - st * czm
        rcz = st * cxm + ct * czm
        tx = W / 2.0 - s * rcx
        ty = H / 2.0 + s * rcz
    else:
        tx, ty = a.tx, a.ty

    hi = set(t.strip() for t in a.highlight.split(',') if t.strip())
    dbg = im.copy()
    dr = ImageDraw.Draw(dbg, 'RGBA')
    for b in bl:
        col = (255, 0, 200, 210) if (b['id'] in hi or not hi) else (0, 120, 255, 110)
        for ring in b['rings']:
            pts = [to_px(x, z, tx, ty) for x, z in ring]
            if len(pts) > 2:
                dr.polygon(pts, outline=col)
                dr.line(pts, fill=col, width=2)
        cx, cy = to_px(b['cx'], b['cz'], tx, ty)
        if a.ids and b['id']:
            dr.text((cx - 8, cy - 4), b['id'][1:], fill=(0, 0, 0, 255))
    # crosshair at model origin
    ox, oy = to_px(0.0, 0.0, tx, ty)
    dr.line([ox - 20, oy, ox + 20, oy], fill=(255, 0, 0, 255), width=2)
    dr.line([ox, oy - 20, ox, oy + 20], fill=(255, 0, 0, 255), width=2)
    dbg.save(a.out)
    json.dump({'s': s, 'rot': a.rot, 'tx': tx, 'ty': ty, 'img': a.img,
               'model_bbox': [x0, z0, x1, z1], 'n': len(bl)},
              open(a.out + '.json', 'w', encoding='utf-8'), ensure_ascii=False)
    print('s=%.4f rot=%.3f tx=%.1f ty=%.1f n=%d -> %s' % (s, a.rot, tx, ty, len(bl), a.out))

if __name__ == '__main__':
    main()
