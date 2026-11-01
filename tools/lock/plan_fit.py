"""Least-squares similarity fit plan raster -> model metres (ASCII only).

usage: plan_fit.py --data JS --blobs JSON --pairs 0:B002,2:B032,...
Model frame: x = metres west, z = metres north. Image: +px east, +py south.
"""
import argparse, json, math
import numpy as np
import plan_common as pc


def solve(src, dst):
    """src: Nx2 image px; dst: Nx2 model (x,z) -> returns (s, rot_deg, tx, ty) mapping model->px."""
    # model (x,z) -> image frame vector (e, n) = (-x, z); image (px, py) = (tx + s*R*(e,n))
    e = np.column_stack([-dst[:, 0], dst[:, 1]])
    p = src
    # similarity (4 dof) via Umeyama on (e -> p) with p = s*R@e + t
    mu_e = e.mean(axis=0)
    mu_p = p.mean(axis=0)
    ec = e - mu_e
    pc_ = p - mu_p
    cov = pc_.T @ ec / len(e)
    U, S, Vt = np.linalg.svd(cov)
    R = U @ Vt
    if np.linalg.det(R) < 0:
        U[:, -1] *= -1
        R = U @ Vt
    var_e = (ec ** 2).sum() / len(e)
    s = float(np.trace(np.diag(S)) / var_e) if var_e else 1.0
    t = mu_p - s * (R @ mu_e)
    return s, R, t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True)
    ap.add_argument('--blobs', required=True)
    ap.add_argument('--pairs', required=True)
    ap.add_argument('--json')
    a = ap.parse_args()

    data = pc.load_js(a.data)
    byid = {b['id']: b for b in pc.buildings(data)}
    blobs = json.load(open(a.blobs, encoding='utf-8'))['blobs']
    bidx = {d['i']: d for d in blobs}

    src, dst, tags = [], [], []
    for pair in a.pairs.split(','):
        k, mid = pair.split(':')
        bl = bidx[int(k)]
        m = byid[mid]
        src.append([bl['cx'], bl['cy']])
        dst.append([m['cx'], m['cz']])
        tags.append('%s/%s' % (k, mid))
    src = np.array(src, float)
    dst = np.array(dst, float)

    s, R, t = solve(src, dst)
    rot = math.degrees(math.atan2(R[1, 0], R[0, 0]))
    en = np.column_stack([-dst[:, 0], dst[:, 1]])
    pred = (s * (R @ en.T)).T + t
    res = np.linalg.norm(pred - src, axis=1)
    print('s=%.4f px/m  rot=%.3f deg  t=(%.1f, %.1f)  n=%d  rms=%.2f px  max=%.2f px'
          % (s, rot, t[0], t[1], len(src), float(np.sqrt((res ** 2).mean())), float(res.max())))
    for i, tg in enumerate(tags):
        print('  %-10s model=(%7.1f,%7.1f)  px=(%6.1f,%6.1f)  pred=(%6.1f,%6.1f)  d=%5.1f px'
              % (tg, dst[i][0], dst[i][1], src[i][0], src[i][1], pred[i][0], pred[i][1], res[i]))
    if a.json:
        json.dump({'s': s, 'rot_deg': rot, 'tx': float(t[0]), 'ty': float(t[1]),
                   'rms_px': float(np.sqrt((res ** 2).mean())), 'pairs': tags},
                  open(a.json, 'w', encoding='utf-8'), ensure_ascii=False)


if __name__ == '__main__':
    main()
