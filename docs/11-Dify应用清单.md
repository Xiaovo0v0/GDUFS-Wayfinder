# Dify 应用清单（截至 2026-10-21 清理后）

> 服务器：http://172.17.1.46　账号：20241003008@gdufs.edu.cn
> 清理动作：删除 10 个反复导入产生的重复应用；把初版应用改名为「（旧版）」，与当前版本区分。

## 本作品的 5 个应用

| # | 应用 | ID | WebApp | 形态 |
|---|---|---|---|---|
| 1 | **尚行 · 广外校园向导** | `6260e36f-d3c6-42b4-b78b-4e11f22b82f4` | http://172.17.1.46/chat/uJIqVGKRsnkz7GY8 | Chatflow（advanced-chat） |
| 2 | route-calc · 校园算路 | `71409c2a-e276-4640-8629-43ed44dbb204` | http://172.17.1.46/chat/0MFkshRcQh4ORDZM | Workflow |
| 3 | place-lookup · 地名解析 | `cfa4b844-ea57-45de-add2-29a47d15b8dd` | http://172.17.1.46/chat/48MhcrE6InUcJxRN | Workflow |
| 4 | office-hours · 办公时间 | `6615e6a3-1013-49e1-94b8-a7acece03013` | http://172.17.1.46/chat/M2ildNC5YSwKIlva | Workflow |
| 5 | materials-check · 材料清单 | `4b1bccfe-3437-474f-acba-24ae9fef478d` | http://172.17.1.46/chat/SExUf698gdq8seP7 | Workflow |

主应用密钥（写在前端 `gdufs-3d/ai-config.js`）：`app-Mr7iOV4sQhqmOvP3hju8IXff`

## 主应用内部结构

14 个节点 / 13 条边：

```
开始 → 意图路由（question-classifier：导航 / 办事 / 百科 / 闲聊）
  ├─ 导航 → 算路代码节点（220 节点 Dijkstra） → 导航专家 LLM → 回答 ①
  ├─ 办事 → 检索办事指南（TopK6 + 重排）      → 办事专家 LLM → 回答 ②
  ├─ 百科 → 检索校园百科（TopK6 + 重排）      → 百科专家 LLM → 回答 ③
  └─ 闲聊 → 闲聊 LLM                                     → 回答 ④
```

①–④ 是 2026-10-27 的改动：原来四条分支先汇到 variable-aggregator 再进一个回答节点，
Dify 必须等汇总节点收齐整段文本才能输出，前端只能干等 15–20 秒；改成每路专家各自接一个
回答节点后，LLM 的输出按 token 推流，前端首字 4–8 秒（`tools/dify_stream_fix.mjs` 做的改造，
`tools/test_stream.mjs` 量首字时间）。改完 12 节点 14 边 → 14 节点 13 边。

## 知识库

| 名称 | 条目 | 字数 |
|---|---|---|
| 广外办事指南 | 40 | 12,550 |
| 广外校园百科 | 101 | 24,635 |

均配置：混合检索 + `bge-reranker-v2-m3` 重排，TopK 6。

## 相邻但与本作品无关的应用

`111`、`222`、`333`、`加油华为加油China`、`学习辅导`、`专属智能客服`、`提示词生成助手`、`fuck you` —— 这些都是这台服务器上原有的应用，未做任何改动。

`（旧版）广外校园向导`（`cd9d369f`）是本作品 10-19 的初版（单流程 + 双知识库），保留作对照，提交时以当前版本为准。

## 清理脚本

```bash
node tools/dify_list_apps.mjs      # 列出全部应用
node tools/dify_cleanup.mjs        # 预演：列出将删除的重复项
node tools/dify_cleanup.mjs --yes  # 真正删除
```
