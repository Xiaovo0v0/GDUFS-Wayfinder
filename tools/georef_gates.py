# -*- coding: utf-8 -*-
"""用官方平面图上的 4 个已知校门做仿射配准（像素 → 本地米制），再预测 2号门/4号门坐标。"""
import numpy as np

# 已知控制点：平面图像素坐标（人工读图） <-> 模型本地坐标（x 西正, z 北正）
CONTROL = [
    ("正门",       (5460, 2260), (-250.8, 192.1)),
    ("行政出入口", (4980, 4990), (-375.4, -219.9)),
    ("1号门",      (4405, 5330), (-6.6, -170.1)),
    ("3号门",      (2870, 6340), (196.6, -473.9)),
]

P = np.array([c[1] for c in CONTROL], dtype=float)   # pixel
L = np.array([c[2] for c in CONTROL], dtype=float)   # local

# 仿射： local = A @ [px, py, 1]
X = np.hstack([P, np.ones((len(P), 1))])
coef, res, rank, sv = np.linalg.lstsq(X, L, rcond=None)  # 3x2

pred = X @ coef
err = np.linalg.norm(pred - L, axis=1)
print("控制点残差(m):")
for (name, px, lc), e in zip(CONTROL, err):
    print(f"  {name:6s} 实测({lc[0]:7.1f},{lc[1]:7.1f}) 拟合({pred[list(CONTROL).index((name,px,lc))][0]:7.1f},{pred[list(CONTROL).index((name,px,lc))][1]:7.1f}) 差 {e:5.1f}")

# 反算：像素 -> 本地
def px_to_local(px, py):
    v = np.array([px, py, 1.0]) @ coef
    return float(v[0]), float(v[1])

# 待求：2号门、4号门（像素位置从平面图读出）
TARGETS = {
    "2号门": (4590, 6965),
    "4号门": (2820, 7900),
}
print("\n预测本地坐标:")
for name, (px, py) in TARGETS.items():
    x, z = px_to_local(px, py)
    print(f"  {name}: ({x:.1f}, {z:.1f})")

print("\n仿射矩阵(local = M·[px,py,1]):")
print(np.round(coef, 5))

# 顺带验证几个已知建筑：看预测位置是否接近
CHECK = {
    "图书馆": (83, 179),
    "文采园（第一饭堂）": (103, -248),
    "学术交流中心": (-252, -337),
    "院系办公楼": (-308, -123),
}
print("\n已知建筑反查像素（用于人工核对是否落在对应白块上）:")
inv = np.linalg.pinv(coef)  # 2x3
for name, (x, z) in CHECK.items():
    v = np.array([x, z]) @ inv
    print(f"  {name}: 预测像素 ({v[0]:.0f}, {v[1]:.0f})")
