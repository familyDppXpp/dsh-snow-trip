"""三份 state，同一件事，只换命名与载体。每份跑 3 次。
   python three_states.py
"""
import json
import os
from typesafe_sdk import Choice, Noul, Score, TypeSafeClient

if not os.environ.get("TYPESAFE_API_KEY"):
    raise SystemExit("先把 TYPESAFE_API_KEY 设上")

client = TypeSafeClient()
REPEATS = 3

# ---------- 问题集：三份 state 共用，一个字不改 ----------
# 键名 recommended / needs_transfer / match_level 是我起的（官方只要求唯一）；
# type、instructions、criteria 是官方规定的层。
QUESTIONS = {
    "recommended": Choice(
        instructions="这三个套餐里，哪一个最符合这趟行程的偏好",
        criteria={"A": "山脚客栈", "B": "雪场公寓", "C": "度假村"},
    ),
    "needs_transfer": Noul(
        instructions="按这份信息，最终选中的方案是否要额外安排往返雪场的交通",
    ),
    "match_level": Score(
        instructions="A 套餐与这些偏好的整体贴合程度",
        criteria=["不贴合", "一般", "贴合"],
    ),
}

# ---------- 事实：4 天、6000 预算、3 个候选、3 条偏好 ----------
NOUNS = [{"t": "离雪场近"}, {"t": "含早餐"}, {"t": "适合新手"}]
CANDS = [
    {"i": "A", "n": "山脚客栈", "t": 6200, "bf": True,  "w": 5,  "ls": False},
    {"i": "B", "n": "雪场公寓", "t": 5800, "bf": False, "w": 20, "ls": False},
    {"i": "C", "n": "度假村",   "t": 7500, "bf": True,  "w": 2,  "ls": True},
]

# 1) 键名无意义
NUMBERED = {"k1": {"a": "2027-01-10", "b": 4, "c": 6000}, "k9": NOUNS, "k2": CANDS}

# 2) 键名自带含义
SELFNAMING = {
    "start_date": "2027-01-10", "nights": 4, "budget_cny": 6000,
    "must_have": ["离雪场近", "含早餐", "适合新手"],
    "candidates": [
        {"id": "A", "name": "山脚客栈", "total_cny": 6200, "breakfast": True,
         "walk_min": 5, "beginner_lesson": False},
        {"id": "B", "name": "雪场公寓", "total_cny": 5800, "breakfast": False,
         "walk_min": 20, "beginner_lesson": False},
        {"id": "C", "name": "度假村", "total_cny": 7500, "breakfast": True,
         "walk_min": 2, "beginner_lesson": True},
    ],
}

# 3) 对齐白话：三家各一句，属性列全，属性个数一致
NEAT_PROSE = """1月10号出发去滑雪，玩4天，总预算6000元。
A 山脚客栈：住4晚共6200元，含早餐，走到雪场5分钟，不含教练课。
B 雪场公寓：住4晚共5800元，不含早餐，坐接驳车20分钟，不含教练课。
C 度假村：住4晚共7500元，含早餐，走到雪场2分钟，含教练课。"""

STATES = [
    (NUMBERED, "键名无意义"),
    (SELFNAMING, "键名自带含义"),
    (NEAT_PROSE, "对齐白话"),
]

for state, label in STATES:
    payload = state if isinstance(state, str) else json.dumps(state, ensure_ascii=False)
    print(f"\n===== {label} =====")
    for i in range(REPEATS):
        r = client.system_one(state=payload, questions=QUESTIONS)
        a = r.answers
        print(f"  第{i+1}次  推荐={a['recommended'].choice} "
              f"{a['recommended'].probabilities}  "
              f"置信={a['recommended'].confidence}  "
              f"需接驳={a['needs_transfer'].noul}  "
              f"分数={a['match_level'].score}")
