# -*- coding: utf-8 -*-
"""parsed.json -> file JSON import bài tập cho từng giáo trình."""
import json, os, re, sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
LIB = os.path.join(REPO, "supabase", "library")
HAN = re.compile(r"[一-鿿]")

HSK4_TITLES = {
    1: ("简单的爱情", "Tình yêu giản dị"),
    2: ("真正的朋友", "Người bạn thật sự"),
    3: ("经理对我印象不错", "Giám đốc có ấn tượng tốt về tôi"),
    4: ("不要太着急赚钱", "Đừng quá vội kiếm tiền"),
    5: ("只买对的，不买贵的", "Chỉ mua thứ phù hợp, không mua thứ đắt"),
    6: ("一分钱一分货", "Tiền nào của nấy"),
    7: ("最好的医生是自己", "Bác sĩ giỏi nhất là chính mình"),
    8: ("生活中不缺少美", "Cuộc sống không thiếu cái đẹp"),
    9: ("阳光总在风雨后", "Sau cơn mưa trời lại sáng"),
    10: ("幸福的标准", "Tiêu chuẩn của hạnh phúc"),
    11: ("读书好，读好书，好读书", "Đọc sách thì tốt, đọc sách hay, ham đọc sách"),
    12: ("用心发现世界", "Dùng trái tim khám phá thế giới"),
    13: ("喝着茶看京剧", "Vừa uống trà vừa xem Kinh kịch"),
    14: ("保护地球母亲", "Bảo vệ mẹ Trái Đất"),
    15: ("教育孩子的艺术", "Nghệ thuật dạy con"),
    16: ("生活可以更美好", "Cuộc sống có thể tốt đẹp hơn"),
    17: ("人与自然", "Con người và thiên nhiên"),
    18: ("科技与世界", "Khoa học kỹ thuật và thế giới"),
    19: ("生活的味道", "Hương vị cuộc sống"),
    20: ("路上的风景", "Phong cảnh trên đường"),
}

BROKEN = re.compile(r"(?:(?<=\s)|^)[a-zà-ỹ](?=\s)")

def looks_broken(s):
    """Text vỡ do trích PDF: nhiều chữ cái đứng lẻ giữa các khoảng trắng."""
    return len(BROKEN.findall(s)) >= 3

def ok_question(q):
    c = q["content"]
    texts = [c.get("prompt", ""), c.get("passage", ""), c.get("hanzi", "")] + list(c.get("options", []))
    texts += list(c.get("tokens", [])) + list(c.get("left", [])) + list(c.get("right", []))
    if any(looks_broken(t) for t in texts if t):
        return False
    if q["type"] == "fill_blank":
        body = c["prompt"].replace("___", "")
        if len(HAN.findall(body)) < 2:
            return False
    if q["type"] in ("multiple_choice", "pinyin_choice", "listening"):
        if len(c.get("options", [])) < 2 or not (c.get("prompt") or c.get("hanzi")):
            return False
    return True

def dedupe(qs):
    seen, out = set(), []
    for q in qs:
        key = json.dumps([q["type"], q["content"]], ensure_ascii=False, sort_keys=True)
        if key in seen:
            continue
        seen.add(key)
        out.append(q)
    return out

def load_titles(code):
    with open(os.path.join(LIB, code + ".json"), encoding="utf-8") as f:
        d = json.load(f)
    return d["textbook"], {l["unit"]: l for l in d["lessons"]}

TARGETS = {
    "1": ("hsk1-standard", "kat-hsk1-baitap.json"),
    "2": ("hsk2-standard", "kat-hsk2-baitap.json"),
    "3": ("hsk3-standard", "kat-hsk3-baitap.json"),
    "4": ("hsk4-standard", "kat-hsk4-baitap.json"),
}

def main():
    parsed = json.load(open(os.path.join(HERE, "parsed.json"), encoding="utf-8"))
    stats = Counter()
    for lvl, (code, outname) in TARGETS.items():
        units = parsed.get(lvl, {})
        if lvl == "4":
            tb = {
                "code": "hsk4-standard",
                "name": "HSK 4",
                "name_zh": "标准教程 HSK 4",
                "level": "HSK4",
                "description": "Giáo trình chuẩn HSK 4 (标准教程 HSK 4, quyển 上 bài 1–10 và 下 bài 11–20). "
                               "Bản nhập này mới có bộ bài tập về nhà của KAT theo từng bài; từ vựng và ngữ pháp bổ sung sau.",
                "sort": 4,
            }
            titles = {u: {"title": vi, "title_zh": zh} for u, (zh, vi) in HSK4_TITLES.items()}
        else:
            tb, lessons = load_titles(code)
            titles = {u: {"title": l["title"], "title_zh": l.get("title_zh")} for u, l in lessons.items()}
        out_lessons = []
        for unit in sorted(int(u) for u in units):
            qs = dedupe([q for q in units[str(unit)] if ok_question(q)])
            stats[f"HSK{lvl}"] += len(qs)
            meta = titles.get(unit)
            if not meta:
                print(f"  ! HSK{lvl} bài {unit}: không có tên bài trong giáo trình — bỏ")
                continue
            out_lessons.append({
                "unit": unit,
                "title": meta["title"],
                "title_zh": meta.get("title_zh"),
                "questions": qs,
            })
        payload = {"textbook": tb, "lessons": out_lessons}
        path = os.path.join(LIB, outname)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=1)
        total = sum(len(l["questions"]) for l in out_lessons)
        print(f"{outname}: {len(out_lessons)} bài, {total} câu hỏi")
    print("Tổng:", sum(stats.values()))

if __name__ == "__main__":
    main()
