"""同一组问题、同一份事实，两种 state 写法 —— 看 Jev 的输出差在哪。

准备:
    pip install typesafe-sdk
    export TYPESAFE_API_KEY=...        # key 从 console.typesafe.ai/settings/keys 拿
运行:
    python compare_states.py
"""

import json
import os

from typesafe_sdk import Choice, Noul, Score, TypeSafeClient

if not os.environ.get("TYPESAFE_API_KEY"):
    raise SystemExit("先把 TYPESAFE_API_KEY 设上")

client = TypeSafeClient()  # 默认调 jev-latest

# ========== 写法一：一段白话 ==========
STATE_PLAIN = """
我 1 月 10 号出发去滑雪，玩 4 天，预算 6000 块。
住的地方想离雪场近点，最好含早餐，还得适合我这种新手。
现在有三个套餐在看：
A 是山脚客栈，住 4 晚一共 6200，含早餐，走到雪场 5 分钟；
B 是雪场公寓，住 4 晚一共 5800，不含早餐，去雪场要坐 20 分钟接驳车；
C 是度假村，住 4 晚一共 7500，含早餐，走到雪场 2 分钟，还带新手教练课。
""".strip()

# ========== 写法二：结构化对象（讲的是同一件事）==========
STATE_FACTS = {
    "trip": {"start": "2027-01-10", "days": 4, "budget_cny": 6000},
    "preferences": [
        {"key": "close_to_slope", "desc": "离雪场近"},
        {"key": "breakfast", "desc": "含早餐"},
        {"key": "beginner_ok", "desc": "适合新手"},
    ],
    "packages": [
        {"id": "A", "name": "山脚客栈", "nights": 4, "total_cny": 6200,
         "breakfast": True, "walk_to_slope_min": 5, "beginner_lesson": False},
        {"id": "B", "name": "雪场公寓", "nights": 4, "total_cny": 5800,
         "breakfast": False, "shuttle_to_slope_min": 20, "beginner_lesson": False},
        {"id": "C", "name": "度假村", "nights": 4, "total_cny": 7500,
         "breakfast": True, "walk_to_slope_min": 2, "beginner_lesson": True},
    ],
}

# ========== 问题集：两种写法共用，一个字都不改 ==========
QUESTIONS = {
    "recommended": Choice(
        instructions="这三个套餐里，哪一个最符合上面这趟行程的偏好",
        criteria={"A": "山脚客栈", "B": "雪场公寓", "C": "度假村"},
    ),
    "needs_transfer": Noul(
        instructions="按这份信息，最终选中的方案是否要额外安排往返雪场的交通",
    ),
    "match_level": Score(
        instructions="A 套餐与上面这些偏好的整体贴合程度",
        criteria=["不贴合", "一般", "贴合"],
    ),
}

def ask(state, label):
    r = client.system_one(state=state, questions=QUESTIONS)
    print(f"\n{'=' * 14} {label} {'=' * 14}")
    print("推荐套餐 :", r.answers["recommended"].choice)
    print("选项概率 :", r.answers["recommended"].probabilities)
    print("该项置信 :", r.answers["recommended"].confidence)
    print("需否接驳 :", r.answers["needs_transfer"].noul)
    print("贴合分数 :", r.answers["match_level"].score)
    print("分数图例 :", r.answers["match_level"].legend)
    print("用量     :", getattr(r, "usage", "无"))

ask(STATE_PLAIN, "STATE = 一段白话")

# 若你的接口版本接受对象形态，也可以直接 ask(STATE_FACTS, "STATE = 结构化对象")。
# 这里 dumps 成字符串只是保证任何版本都能跑，传进去的信息完全一样。
ask(json.dumps(STATE_FACTS, ensure_ascii=False), "STATE = 结构化 JSON")
