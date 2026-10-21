---
name: route-calc
display_name: 校园算路
description: 输入起点与终点的校园地名，返回步行折线、距离与耗时。当用户问"怎么去/多远/要多久"时调用。
description_zh: 广外校园步行路径计算技能
description_en: Walking route calculation for GDUFS campus
category: productivity
version: 1.0.0
author: 尚行 · 广外校园向导
---

# 校园算路（route-calc）

## 何时使用

用户问"从 A 怎么去 B""A 到 B 多远""走过去要多久"时调用。A、B 必须是校园里的地点（建筑名、校门名，或"一饭""二饭"这类俗称）。

## 输入

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `from_name` | string | 是 | 起点地名，例如"文采园（第一饭堂）""一饭""正门" |
| `to_name` | string | 是 | 终点地名 |

## 输出

一段 JSON 字符串，放在 `result` 字段里：

```json
{"ok":true,"from":"文采园（第一饭堂）","to":"图书馆",
 "distance":820.0,"minutes":12,
 "points":[[103.1,-248.0],[108.4,-252.0],"…"]}
```

- `ok=false` 时带 `error`，可能的值：`地点未识别` / `起终点相同` / `路网不连通`
- `distance` 单位米，`minutes` 按 70 m/min 估算
- `points` 是 220 节点路网上的折线，可直接交给前端绘制

## 实现说明

- 路网：220 节点 / 239 边，来自 OpenStreetMap 步行道 + 校园内部道路
- 算法：Dijkstra 最短路
- 地名解析：先精确匹配 50 个标准地名，再退化为包含匹配（"一饭"→"文采园（第一饭堂）"）
- 部署形态：Dify 工作流 `route-calc · 校园算路`（已发布，可作为工具被主应用调用）

## 参考

- 数据与坐标系见 `references/data.md`
