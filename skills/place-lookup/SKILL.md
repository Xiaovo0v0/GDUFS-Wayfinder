---
name: place-lookup
display_name: 地名解析
description: 把口语化的校园地点说法解析成标准地点与坐标。当用户提到的地点名称不确定、有俗称或错别字时调用。
description_zh: 广外校园地名与别名解析技能
description_en: Campus place name resolution for GDUFS
category: productivity
version: 1.0.0
author: 尚行 · 广外校园向导
---

# 地名解析（place-lookup）

## 何时使用

用户说"一饭""博雅园""校医院""行政楼"，需要知道这具体是哪栋楼、在哪、路由到哪个节点时调用。

## 输入

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `query` | string | 是 | 用户原话里截出来的地点片段，例如"从一饭去图书馆" |

## 输出

```json
{"ok":true,"query":"从一饭去图书馆","label":"文采园（第一饭堂）",
 "x":103.1,"z":-248.0,"kind":"building","node":179,
 "alternatives":["图书馆"]}
```

- `alternatives` 是次优候选，便于追问"你是指哪个"
- `ok=false` 时 `error=未匹配到地点`

## 别名表

| 俗称 | 标准名 |
|---|---|
| 一饭 | 文采园（第一饭堂） |
| 二饭 | 博雅园（第二饭堂） |
| 校医院 | 门诊部（校医院） |
| 行政楼 | 行政办公楼 |

匹配顺序：精确 → 去掉括号的核心名 → 包含关系。长名优先，避免"图书馆"吃掉"图书馆东门"。

## 部署形态

Dify 工作流 `place-lookup · 地名解析`（已发布，可作为工具调用）。
