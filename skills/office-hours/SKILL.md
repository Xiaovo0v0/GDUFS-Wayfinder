---
name: office-hours
display_name: 办公时间判定
description: 判断某个办事事项此刻能不能办（现在开门吗、几点下班、下次何时开）。当用户问"现在能办吗""几点下班""周末办不办"时调用。
description_zh: 广外办事窗口时段解析与实时判定
description_en: Office hours check for GDUFS service items
category: productivity
version: 1.0.0
author: 尚行 · 广外校园向导
---

# 办公时间判定（office-hours）

## 何时使用

用户问"现在能办吗""营业时间""中午休息吗""周末能不能办"时调用。

## 输入

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `item_title` | string | 是 | 事项名称，可只给关键词，例如"成绩单" |
| `campus` | string | 否 | `south`（默认）或 `north`。两校区时段常常不同 |
| `now` | string | 否 | `YYYY-MM-DD HH:MM`，留空取服务器当前时间（调试用） |

## 输出

```json
{"ok":true,"item":"本科生成绩单、加权均分证明办理",
 "known":true,"open":false,"next_open":"08:30","close_at":"17:10",
 "days":[3,4,5],"note":"周三、周四、周五 8:30-12:00、14:00-17:10（南校区）"}
```

- `known=false` 表示官网没公布具体时段，此时**不要编造**，直接告诉用户"官网未公布"
- `days` 用 0=周日、1=周一 …… 6=周六
- `note` 是原始时段文本，便于向用户复述

## 实现要点

1. 先按 `campus` 从"周一…（北校区）；周三…（南校区）"这种复合文本里挑出对应校区那一段
2. 解析出星期集合与时间区间
3. 与当前时刻比较得出 `open`

## 部署形态

Dify 工作流 `office-hours · 办公时间`（已发布，可作为工具调用）。
