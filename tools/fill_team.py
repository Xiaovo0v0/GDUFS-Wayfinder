# -*- coding: utf-8 -*-
"""填写团队信息并重新生成设计方案 DOCX。

用法：
  # 1) 交互式（推荐，直接双击运行也行）
  python tools/fill_team.py

  # 2) 一次给全
  python tools/fill_team.py --team "广外信院一队" \
      --leader "张三|信息科学与技术学院|20241003008|13800000000|zhangsan@gdufs.edu.cn" \
      --member "李四|信息科学与技术学院|20241003009|13900000000|lisi@gdufs.edu.cn"

  # 3) 只改一部分
  python tools/fill_team.py --team "广外信院一队"

信息存在 deliverables/team.json（已加入 .gitignore，不会进仓库），
改完会自动重跑 tools/fill_design_docx.py 生成 DOCX。
"""
import argparse
import json
import os
import subprocess
import sys

REPO = r"C:\Users\86134\Desktop\gdufs"
TEAM_JSON = os.path.join(REPO, "deliverables", "team.json")

FIELDS = ["name", "dept", "sid", "phone", "mail"]
LABELS = ["姓名", "所在院系", "学号", "联系方式", "电子邮箱"]


def load():
    if os.path.exists(TEAM_JSON):
        with open(TEAM_JSON, encoding="utf-8") as f:
            return json.load(f)
    return {"team": "", "leader": {}, "members": []}


def save(d):
    os.makedirs(os.path.dirname(TEAM_JSON), exist_ok=True)
    with open(TEAM_JSON, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=1)


def parse_person(s):
    parts = [p.strip() for p in s.replace("，", ",").split("|")]
    while len(parts) < 5:
        parts.append("")
    return dict(zip(FIELDS, parts[:5]))


def ask(prompt, default=""):
    v = input(f"{prompt}{(' [' + default + ']') if default else ''}：").strip()
    return v or default


def interactive(d):
    print("\n=== 填写团队信息（直接回车＝保持原值）===")
    d["team"] = ask("团队名称", d.get("team", ""))

    print("\n--- 负责人 ---")
    leader = dict(d.get("leader") or {})
    for k, lb in zip(FIELDS, LABELS):
        leader[k] = ask("负责人 " + lb, leader.get(k, ""))
    d["leader"] = leader

    members = list(d.get("members") or [])
    print("\n--- 团队成员（最多 4 人，只填姓名会留空其它项；输入空姓名＝结束）---")
    for i in range(4):
        cur = members[i] if i < len(members) else {}
        nm = ask(f"成员{i + 1} 姓名", cur.get("name", ""))
        if not nm:
            continue
        m = {"name": nm}
        for k, lb in zip(FIELDS[1:], LABELS[1:]):
            m[k] = ask(f"成员{i + 1} " + lb, cur.get(k, ""))
        while len(members) <= i:
            members.append({})
        members[i] = m
    d["members"] = [m for m in members if m.get("name")]
    return d


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--team", help="团队名称")
    ap.add_argument("--leader", help="负责人：姓名|院系|学号|联系方式|邮箱")
    ap.add_argument("--member", action="append", default=[], help="成员，可重复")
    ap.add_argument("--interactive", action="store_true", help="交互式填写")
    args = ap.parse_args()

    d = load()

    if args.interactive or (not args.team and not args.leader and not args.member):
        d = interactive(d)
    else:
        if args.team:
            d["team"] = args.team
        if args.leader:
            d["leader"] = parse_person(args.leader)
        if args.member:
            d["members"] = [parse_person(x) for x in args.member][:4]

    save(d)
    print("\n已保存：", TEAM_JSON)
    print(json.dumps(d, ensure_ascii=False, indent=1))

    print("\n重新生成 DOCX…")
    r = subprocess.run([sys.executable, os.path.join(REPO, "tools", "fill_design_docx.py")])
    if r.returncode != 0:
        print("生成失败")
        return r.returncode

    out = os.path.join(REPO, "deliverables", "广外校园向导-初赛设计方案.docx")
    print("\n完成：", out, "%.1f KB" % (os.path.getsize(out) / 1024))
    return 0


if __name__ == "__main__":
    sys.exit(main())
