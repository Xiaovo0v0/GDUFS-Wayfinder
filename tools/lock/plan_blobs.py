"""Detect building blobs on a campus plan raster (ASCII only).

usage: plan_blobs.py --img P --preset south|north --min-area N --debug out.png --json out.json
"""
import argparse, json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

PRESETS = {
    # orange building blocks of the green south plan
    'south': lambda r, g, b: (r >= 215) & (r <= 252) & (g >= 175) & (g <= 220) & (b >= 130) & (b <= 185)
             & ((r - b) >= 40) & ((r - g) >= 15) & ((g - b) >= 15),
    # yellow teaching blocks of the north plan
    'north_yellow': lambda r, g, b: (r >= 230) & (g >= 195) & (b <= 130) & ((r - b) >= 110),
    # pink dormitory blocks of the north plan
    'north_pink': lambda r, g, b: (r >= 225) & (g >= 170) & (g <= 215) & (b >= 170) & (b <= 215)
                  & ((r - g) >= 25) & ((r - b) >= 20),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--img', required=True)
    ap.add_argument('--preset', default='south')
    ap.add_argument('--min-area', type=int, default=1500)
    ap.add_argument('--json', required=True)
    ap.add_argument('--debug')
    a = ap.parse_args()

    im = Image.open(a.img).convert('RGB')
    arr = np.asarray(im).astype(np.int16)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    mask = PRESETS[a.preset](r, g, b)
    mask = ndimage.binary_closing(mask, np.ones((3, 3)))
    lab, n = ndimage.label(mask)
    objs = ndimage.find_objects(lab)
    blobs = []
    for i, sl in enumerate(objs, 1):
        if sl is None:
            continue
        sub = (lab[sl] == i)
        area = int(sub.sum())
        if area < a.min_area:
            continue
        ys, xs = np.nonzero(sub)
        blobs.append({
            'i': len(blobs),
            'area': area,
            'cx': float(xs.mean() + sl[1].start),
            'cy': float(ys.mean() + sl[0].start),
            'x0': int(sl[1].start), 'y0': int(sl[0].start),
            'x1': int(sl[1].stop), 'y1': int(sl[0].stop),
        })
    blobs.sort(key=lambda d: -d['area'])
    for k, d in enumerate(blobs):
        d['i'] = k
    json.dump({'img': a.img, 'size': im.size, 'preset': a.preset, 'blobs': blobs},
              open(a.json, 'w', encoding='utf-8'), ensure_ascii=False)

    if a.debug:
        dbg = im.copy()
        dr = ImageDraw.Draw(dbg)
        for d in blobs:
            dr.rectangle([d['x0'], d['y0'], d['x1'], d['y1']], outline=(255, 0, 255), width=2)
            dr.text((d['cx'] - 6, d['cy'] - 6), str(d['i']), fill=(0, 0, 0))
        dbg.save(a.debug)

    print('image %dx%d  blobs %d' % (im.size[0], im.size[1], len(blobs)))
    for d in blobs[:40]:
        print('%3d  area=%6d  c=(%6.1f,%6.1f)  box=%dx%d' % (
            d['i'], d['area'], d['cx'], d['cy'], d['x1'] - d['x0'], d['y1'] - d['y0']))


if __name__ == '__main__':
    main()
