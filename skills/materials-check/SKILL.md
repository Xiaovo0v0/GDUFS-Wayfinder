---
name: materials-check
display_name: 办事材料清单
description: 查询某件事需要带什么材料、找哪个部门、打哪个电话、在哪个校区哪栋楼办。当用户问"要带什么""去哪办""找谁"时调用。
description_zh: 广外办事事项的材料与办理点查询
description_en: Materials and service-point lookup for GDUFS
category: productivity
version: 1.0.0
author: 尚行 · 广外校园向导
---

# 办事材料清单（materials-check）

## 何时使用

用户问"补办学生证要带什么""成绩单去哪开""报销找谁"时调用。

## 输入

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `item_title` | string | 是 | 事项名称或关键词，例如"成绩单""补办校园卡" |
| `campus` | string | 否 | `south`（默认）或 `north` |

## 输出

```json
{"ok":true,
 "item":"本科生成绩单、加权均分证明办理（中英文/密封邮寄）",
 "department":"教务部 考务科",
 "materials":["在校生自助打印：校园卡 / 身份证 / 学号+数字广外密码", "…"],
 "count":4,
 "phone":"020-36317667（北校区）、020-39328013（南校区）",
 "online":false,
 "places_here":[{"building_id":"N042","name":"行政楼","room":"121"}],
 "places_other":[{"building_id":"B004","name":"行政办公楼","room":"224"}],
 "url":"https://…"}
```

- `places_here` 是当前校区的办理点；为空而 `places_other` 有值时，说明**这件事只能去另一个校区办**，回复时要明说
- `online=true` 表示可以线上办理

## 数据规模

- 40 条事项，来自 11 个院部官网的一手页面
- 每条的部门、地点、时段、材料、电话、原文链接均可回溯
- 17 条能定位到具体楼栋与房间号

## 部署形态

Dify 工作流 `materials-check · 材料清单`（已发布，可作为工具调用）。
