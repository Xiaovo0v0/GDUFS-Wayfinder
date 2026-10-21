# Dify 应用清单（截至 2026-10-21 清理后）

> 服务器：http://172.17.1.46　账号：20241003008@gdufs.edu.cn
> 清理动作：删除 10 个反复导入产生的重复应用；把初版应用改名为「（旧版）」，与当前版本区分。

## 本作品的 5 个应用

| # | 应用 | ID | WebApp | 形态 |
|---|---|---|---|---|
| 1 | **尚行 · 广外校园向导** | `b8d5c8c2-1c39-48bd-a6f8-284e81a108c5` | http://172.17.1.46/chat/5hscg6AuOajmRTtj | Chatflow（advanced-chat） |
| 2 | route-calc · 校园算路 | `9ae8f3f0-2cc0-4025-8177-1ef5dd708bde` | http://172.17.1.46/chat/5neKXV6umSXMfEyN | Workflow |
| 3 | place-lookup · 地名解析 | `cfa4b844-ea57-45de-add2-29a47d15b8dd` | http://172.17.1.46/chat/48MhcrE6InUcJxRN | Workflow |
| 4 | office-hours · 办公时间 | `7e6a8f58-32ab-4788-8229-f40bb0d25b23` | http://172.17.1.46/chat/YEcfhw7mvCqJOWOo | Workflow |
| 5 | materials-check · 材料清单 | `4b1bccfe-3437-474f-acba-24ae9fef478d` | http://172.17.1.46/chat/SExUf698gdq8seP7 | Workflow |

主应用密钥（写在前端 `gdufs-3d/ai-config.js`）：`app-hNQasFeUioMKDtEwRJb9pDEb`

## 主应用内部结构

11 个节点 / 13 条边：

```
开始 → 意图路由（question-classifier：导航 / 办事 / 百科 / 闲聊）
  ├─ 导航 → 算路代码节点（220 节点 Dijkstra） → 导航专家 LLM
  ├─ 办事 → 检索办事指南（TopK6 + 重排）      → 办事专家 LLM
  ├─ 百科 → 检索校园百科（TopK6 + 重排）      → 百科专家 LLM
  └─ 闲聊 → 闲聊 LLM
        ↘ 变量汇总 → 回答
```

## 知识库

| 名称 | 条目 | 字数 |
|---|---|---|
| 广外办事指南 | 40 | 12,550 |
| 广外校园百科 | 61 | 16,858 |

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
