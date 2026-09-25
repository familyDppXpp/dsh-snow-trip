"""验两件事：它到底读没读预算？问题之间真的互相看不见？
    python probe.py
"""
import json
import os
from typesafe_sdk import Choice, Noul, Score, TypeSafeClient

client = TypeSafeClient()

# BASE = {
#     "trip": {"start": "2027-01-10", "days": 4, "budget_cny": 6000},
#     "packages": [
#         {"id": "A", "name": "山脚客栈", "total_cny": 6200, "breakfast": True,
#          "walk_to_slope_min": 5, "beginner_lesson": False},
#         {"id": "B", "name": "雪场公寓", "total_cny": 5800, "breakfast": False,
#          "walk_to_slope_min": 20, "beginner_lesson": False},
#         {"id": "C", "name": "度假村", "total_cny": 7500, "breakfast": True,
#          "walk_to_slope_min": 2, "beginner_lesson": True},
#     ],
# }

BASE = {
    "k1": {"a": "2027-01-10", "b": 4, "c": 6000},
    "k2": [
        {"i": "A", "n": "山脚客栈", "t": 6200, "bf": True, "w": 5},
        {"i": "B", "n": "雪场公寓", "t": 5800, "bf": False, "w": 20},
        {"i": "C", "n": "度假村", "t": 7500, "bf": True, "w": 2},
    ],
}


INSTR_BARE = "按这份信息，最终选中的方案是否要额外安排往返雪场的交通"
INSTR_EMBEDDED = ("假设最终选中的是 A 套餐（山脚客栈，走到雪场 5 分钟），"
                  "是否还需要额外安排往返雪场的交通")

def run(state, instr, label):
    r = client.system_one(state=json.dumps(state, ensure_ascii=False), questions={
        "recommended": Choice(instructions="哪个套餐最符合这趟行程的偏好",
                              criteria={"A": "山脚客栈", "B": "雪场公寓", "C": "度假村"}),
        "needs_transfer": Noul(instructions=instr),
        "match_level": Score(instructions="A 套餐与这些偏好的整体贴合程度",
                             criteria=["不贴合", "一般", "贴合"]),
    })
    print(f"\n--- {label} ---")
    print("推荐   :", r.answers["recommended"].choice,
          r.answers["recommended"].probabilities)
    print("需接驳 :", r.answers["needs_transfer"].noul)
    print("分数   :", r.answers["match_level"].score)
    print("token  :", r.usage)

# 1 基线
run(BASE, INSTR_BARE, "基线")

# 2 消融：把预算抹掉，看推荐变不变 —— 变了说明它真的在读预算
no_budget = json.loads(json.dumps(BASE))
# no_budget["trip"].pop("budget_cny")
no_budget["k1"].pop("c")
run(no_budget, INSTR_BARE, "消融：删掉预算字段")

# 3 依赖：把前提手工写进问题里 —— 看 0.47 会不会掉下去
run(BASE, INSTR_EMBEDDED, "把前提写进第 2 题")
