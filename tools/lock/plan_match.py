"""Iterative similarity fit between plan blobs and model buildings (ASCII only).

usage: plan_match.py --data JS --blobs JSON --seed 0:B002,10:B004 [--radius 14] [--json out]
"""
import argparse, json, math
import numpy as np
import plan_common as pc


def solve(pairs_src, pairs_dst):
    e = np.column_stack([-pairs_dst[:, 0], pairs_dst[:, 1]])
    mu_e, mu_p = e.mean(axis=0), pairs_src.mean(axis=0)
    ec, pc_ = e - mu_e, pairs_src - mu_p
    cov = pc_.T @ ec / len(e)
    U, S, Vt = np.linalg.svd(cov)
    R = U @ Vt
    if np.linalg.det(R) < 0:
        U[:, -1] *= -1
        R = U @ Vt
    var = (ec ** 2).sum() / len(e)
    s = float(np.trace(np.diag(S)) / var) if var else 1.0
    t = mu_p - s * (R @ mu_e)
    return s, R, t


def project(s, R, t, xy):
    en = np.column_stack([-xy[:, 0], xy[:, 1]])
    return (s * (R @ en.T)).T + t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True)
    ap.add_argument('--blobs', required=True)
    ap.add_argument('--seed', required=True)
    ap.add_argument('--radius', type=float, default=14.0)
    ap.add_argument('--iters', type=int, default=8)
    ap.add_argument('--json')
    a = ap.parse_args()

    bl = pc.buildings(pc.load_js(a.data))
    byid = {b['id']: b for b in bl}
    blobs = json.load(open(a.blobs, encoding='utf-8'))['blobs']
    bp = np.array([[d['cx'], -d['cy']] for d in blobs], float)  # y-up image frame

    src, dst = [], []
    for pair in a.seed.split(','):
        k, mid = pair.split(':')
        src.append([blobs[int(k)]['cx'], -blobs[int(k)]['cy']])
        dst.append([byid[mid]['cx'], byid[mid]['cz']])
    s, R, t = solve(np.array(src, float), np.array(dst, float))

    allxy = np.array([[b['cx'], b['cz']] for b in bl], float)
    for _ in range(a.iters):
        pred = project(s, R, t, allxy)
        d = np.linalg.norm(pred[:, None, :] - bp[None, :, :], axis=2)
        best_b = d.argmin(axis=1)
        best_d = d.min(axis=1)
        # unique blob assignment (closest wins)
        order = np.argsort(best_d)
        used, keep = set(), []
        for i in order:
            if best_d[i] <= a.radius and best_b[i] not in used:
                used.add(best_b[i])
                keep.append(i)
        idx = np.array(keep)
        s, R, t = solve(bp[best_b[idx]], allxy[idx])

    pred = project(s, R, t, allxy)
    d = np.linalg.norm(pred[:, None, :] - bp[None, :, :], axis=2)
    best_b, best_d = d.argmin(axis=1), d.min(axis=1)
    rot = math.degrees(math.atan2(R[1, 0], R[0, 0]))
    m = best_d <= a.radius
    print('s=%.4f px/m  rot=%.3f deg  t=(%.1f,%.1f)  matched=%d/%d  rms=%.2f px  max=%.2f px'
          % (s, rot, t[0], t[1], int(m.sum()), len(bl), float(np.sqrt((best_d[m] ** 2).mean())), float(best_d[m].max())))
    for i in np.argsort(best_d):
        b = bl[i]
        print('  %-8s %-5s px=(%6.1f,%6.1f) blob=%2d  d=%5.1f px%s'
              % (b['id'], b['kind'][:5], pred[i][0], -pred[i][1], best_b[i], best_d[i],
                 '' if best_d[i] <= a.radius else '   <<< no blob'))
    if a.json:
        json.dump({'s': s, 'rot_deg': rot, 'tx': float(t[0]), 'ty': float(t[1]),
                   'radius': a.radius,
                   'matched': [{'id': bl[i]['id'], 'blob': int(best_b[i]), 'd_px': float(best_d[i])}
                               for i in np.where(m)[0]]},
                  open(a.json, 'w', encoding='utf-8'), ensure_ascii=False)


if __name__ == '__main__':
    main()
