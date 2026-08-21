# -*- coding: utf-8 -*-
"""Số hoá phiếu ôn tập KAT (PDF text -> JSON import cho CLASSHUB)."""
import json, os, re, sys, unicodedata
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
TXT = os.path.join(HERE, "txt")

NOISE = re.compile(
    r"KAT Education —|KAT EDUCATION|Hotline:|Mã phiếu:|Trang \d+/\d+|www\.kateducation|"
    r"Tiếng Trung – Du học|Họ và tên:|Họ tên học viên:|Dành cho giáo viên|DÀNH CHO GIÁO VIÊN|"
    r"Thang điểm:|Phân bố"
)
PART = re.compile(r"^\s*PHẦN\s+([IVX]+)[\.\—\-–]\s*(.*)$")
NUM = re.compile(r"^\s*(?:Câu\s+)?(\d{1,2})\.\s+(.*)$")
OPT = re.compile(r"(?:(?<=\s)|^)([A-F])\.\s+")
HAN = re.compile(r"[一-鿿]")
HAN_RUN = re.compile(r"[一-鿿][一-鿿，。？！、：；“”‘’…—]*")

def has_han(s):
    return bool(HAN.search(s))

def strip_accents(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    return s.replace("đ", "d")

def clean(raw):
    return [ln.rstrip() for ln in raw.splitlines() if not NOISE.search(ln)]

def load(name):
    with open(os.path.join(TXT, name), encoding="utf-8") as f:
        return clean(f.read())

def split_parts(lines):
    parts, cur = [], None
    for ln in lines:
        m = PART.match(ln)
        if m:
            cur = [m.group(1), m.group(2).strip(), []]
            parts.append(cur)
        elif cur is not None:
            cur[2].append(ln)
    return parts

def split_questions(lines):
    qs, cur = [], None
    for ln in lines:
        m = NUM.match(ln)
        if m:
            cur = [int(m.group(1)), [m.group(2)]]
            qs.append(cur)
        elif cur is not None:
            cur[1].append(ln)
    return qs

def parse_options(lines):
    text = "\n".join(lines)
    hits = list(OPT.finditer(text))
    letters = [h.group(1) for h in hits]
    if len(letters) < 2 or letters != ["A", "B", "C", "D", "E", "F"][: len(letters)]:
        return None
    prompt = re.sub(r"\s*\n\s*", " ", text[: hits[0].start()]).strip()
    opts = []
    for i, h in enumerate(hits):
        end = hits[i + 1].start() if i + 1 < len(hits) else len(text)
        opts.append(re.sub(r"\s+", " ", text[h.end():end]).strip())
    opts = [o for o in opts]
    if not prompt or any(not o for o in opts):
        return None
    return prompt, opts

# ---------- phân loại phần ----------
def part_kind(title):
    t = strip_accents(title)
    if "选词填空" in title or "dien tu" in t or ("dien" in t and "cho trong" in t):
        return "FILL"
    if "句子匹配" in title or "noi cau" in t or "noi tu" in t:
        return "MATCH"
    if "完成句子" in title or "排列顺序" in title or "sap xep" in t:
        return "REORDER"
    if "判断对错" in title or "dung/sai" in t or "dung sai" in t:
        return "TRUEFALSE"
    if "sua loi" in t or "tim va sua" in t or "造句" in title or "dat cau" in t:
        return "SKIP"
    return "MCQ"

# ---------- đọc file đáp án ----------
ROW_LETTER = re.compile(r"^\s*(\d{1,2})\s+([A-F])(?![A-Za-z])")
def parse_answer_file(lines):
    """-> letters{n: 'A'}, cells{n: [ô chữ Hán trên dòng]}, ds{n: 'Đ'/'S'}"""
    letters, cells, ds = {}, {}, {}
    for i, ln in enumerate(lines):
        s = ln.strip()
        # bảng ngang: dòng "Câu  1 2 3..." + dòng "ĐA/Đáp án  A B C..."
        if re.match(r"^(Câu|Câu hỏi)\b", s):
            nums = re.findall(r"(?<![\dA-Za-z])(\d{1,2})(?![\d])", s[3:])
            for j in range(i + 1, min(i + 4, len(lines))):
                t = lines[j].strip()
                if not t:
                    continue
                mlab = re.match(r"^(ĐA|Đ\.A|Đáp án|Đ/S|Nối với)\s*(.*)$", t)
                if mlab:
                    ls = re.findall(r"(?<![A-Za-z])([A-F])(?![A-Za-z])", mlab.group(2))
                    if len(nums) == len(ls) and len(nums) >= 2:
                        for n, l in zip(nums, ls):
                            letters.setdefault(int(n), l)
                    break
                break
            continue
        # bảng dọc: "19   A也   giải thích"  /  "22   C   căn cứ"
        m = ROW_LETTER.match(ln)
        if m:
            letters.setdefault(int(m.group(1)), m.group(2))
        # Đ/S
        m2 = re.match(r"^\s*(\d{1,2})\s+(Đ|S|对|错)(?:\s|$)", ln)
        if m2:
            ds.setdefault(int(m2.group(1)), "Đ" if m2.group(2) in ("Đ", "对") else "S")
        # ô chữ Hán theo cột
        m3 = re.match(r"^\s*(\d{1,2})\s+(.*)$", ln)
        if m3 and has_han(m3.group(2)):
            cols = [c.strip() for c in re.split(r"\s{2,}", m3.group(2).strip()) if c.strip()]
            # cột đầu có thể dính "从 我从北京来。" -> tách tiếp theo 1 khoảng trắng
            if cols and has_han(cols[0]) and " " in cols[0]:
                head, rest = cols[0].split(" ", 1)
                if has_han(head) and has_han(rest):
                    cols = [head.strip(), rest.strip()] + cols[1:]
            cells.setdefault(int(m3.group(1)), cols)
    return letters, cells, ds

def han_only(s):
    """Giữ phần chữ Hán (bỏ pinyin, số thứ tự, ký hiệu)."""
    runs = HAN_RUN.findall(s)
    return "".join(runs).strip()

def norm_sentence(s):
    return re.sub(r"[\s，。？！、：；“”‘’…—,.?!]", "", s)

# ---------- dựng câu hỏi ----------
def build_mcq(n, lines, letters, stats):
    po = parse_options(lines)
    if not po:
        stats["mcq_no_options"] += 1
        return None
    prompt, opts = po
    letter = letters.get(n)
    if not letter or letter not in "ABCDEF"[: len(opts)]:
        stats["mcq_no_answer"] += 1
        return None
    prompt = re.sub(r"\s*\(\s*\)\s*$", "", prompt).strip()
    # Chọn pinyin: đề hỏi phiên âm và các phương án không có chữ Hán
    if re.search(r"(?i)phiên âm|拼音", prompt) and not any(has_han(o) for o in opts):
        mq = re.search(r"[“”\"']([^“”\"']+)[“”\"']?", prompt)
        hz = han_only(mq.group(1)) if mq and has_han(mq.group(1)) else ""
        if not hz:
            runs = HAN_RUN.findall(prompt)
            hz = max(runs, key=len).strip("的正确拼音是：") if runs else ""
        hz = re.sub(r"[的正确拼音是：。？\s]+$", "", hz)
        if hz:
            return {"type": "pinyin_choice", "content": {"hanzi": hz, "options": opts}, "answer": letter}
    content = {"prompt": prompt, "options": opts}
    return {"type": "multiple_choice", "content": content, "answer": letter}

def question_segments(lines):
    """Các đoạn chữ Hán của đề, chỗ trống là ranh giới giữa các đoạn."""
    txt = " ".join(lines)
    txt = re.sub(r"[A-Za-zÀ-ỹ]+[:：\.]?", " ", txt)      # bỏ pinyin & nhãn A:/B:
    txt = re.sub(r"[（）()\[\]_\.]+", " ", txt)
    return [seg for seg in (t.strip() for t in HAN_RUN.findall(txt)) if seg]

def fill_from_sentence(lines, sentence):
    """So đề với câu hoàn chỉnh -> (prompt có ___, [đáp án])."""
    segs = question_segments(lines)
    if not segs:
        return None
    target = re.sub(r"\s+", "", sentence)
    pattern = "(.*?)" + "(.*?)".join(re.escape(re.sub(r"\s+", "", x)) for x in segs) + "(.*?)"
    m = re.fullmatch(pattern, target)
    if not m:
        return None
    PUNCT = "，。？！、：；“”‘’…—,.?!"
    gaps, answers, parts = list(m.groups()), [], []
    norm_segs = [re.sub(r"\s+", "", x) for x in segs]
    for i, g in enumerate(gaps):
        if g:
            core = g.strip(PUNCT)
            if core:
                lead = g[: len(g) - len(g.lstrip(PUNCT))]
                tail = g[len(g.rstrip(PUNCT)):]
                parts.append(lead + "___" + tail)
                answers.append(core)
            else:
                parts.append(g)
        if i < len(norm_segs):
            parts.append(norm_segs[i])
    if not answers or len(answers) > 3 or any(len(a) > 8 for a in answers):
        return None
    return "".join(parts), answers

def build_fill(n, lines, cells, stats):
    cols = cells.get(n) or []
    han_cols = [han_only(c) for c in cols]
    han_cols = [c for c in han_cols if c]
    for sentence in han_cols:
        got = fill_from_sentence(lines, sentence)
        if got:
            prompt, answers = got
            return {"type": "fill_blank", "content": {"prompt": prompt}, "answer": answers}
    # dự phòng: bảng có cột "từ" riêng
    if len(han_cols) >= 2 and han_cols[0] in han_cols[1]:
        word, full = han_cols[0], han_cols[1]
        return {"type": "fill_blank",
                "content": {"prompt": full.replace(word, "___", 1)}, "answer": [word]}
    stats["fill_no_answer" if not cols else "fill_mismatch"] += 1
    return None

def build_reorder(n, lines, cells, stats):
    text = " ".join(lines)
    raw = re.split(r"[|/／∕]", text)
    tokens = [han_only(t) for t in raw]
    tokens = [t for t in tokens if t]
    if len(tokens) < 3:
        stats["reorder_few_tokens"] += 1
        return None
    cols = cells.get(n)
    correct = han_only(cols[0]) if cols else ""
    if not correct:
        stats["reorder_no_answer"] += 1
        return None
    order, rest = [], correct
    pool = list(tokens)
    while rest and pool:
        cand = [t for t in pool if rest.startswith(norm_sentence(t))]
        if not cand:
            break
        pick = max(cand, key=len)
        order.append(pick)
        pool.remove(pick)
        rest = rest[len(norm_sentence(pick)):]
        rest = rest.lstrip("，。？！、：；“”‘’…— ")
    if pool or norm_sentence("".join(order)) != norm_sentence(correct):
        stats["reorder_mismatch"] += 1
        return None
    return {
        "type": "reorder",
        "content": {"tokens": shuffle_tokens(order)},
        "answer": order,
    }

def shuffle_tokens(tokens):
    """Xáo ổn định (không phụ thuộc random) — chỉ cần khác thứ tự đúng."""
    if len(tokens) < 2:
        return list(tokens)
    out = list(tokens)
    out = out[::-1]
    if len(out) > 2:
        out = out[1:] + out[:1]
    if out == tokens:
        out = out[1:] + out[:1]
    return out

def build_truefalse(n, lines, ds, stats):
    val = ds.get(n)
    if not val:
        stats["tf_no_answer"] += 1
        return None
    body = "\n".join(lines)
    zh = han_only(body.split("★")[0])
    claim = ""
    m = re.search(r"★\s*(.+)", body)
    if m:
        claim = re.sub(r"\s*\(\s*\)\s*$", "", re.sub(r"\s+", " ", m.group(1))).strip()
    if not zh:
        stats["tf_no_text"] += 1
        return None
    content = {"prompt": (claim or "Nhận định trên đúng hay sai?"), "passage": zh,
               "options": ["Đúng", "Sai"]}
    return {"type": "multiple_choice", "content": content, "answer": "A" if val == "Đ" else "B"}

def build_match(qs, letters, stats):
    """Cả phần nối câu -> 1 câu hỏi matching."""
    left, right, order = [], {}, []
    for n, lines in qs:
        text = "\n".join(lines)
        hits = list(OPT.finditer(text))
        if hits:
            l = han_only(text[: hits[0].start()])
            for i, h in enumerate(hits):
                end = hits[i + 1].start() if i + 1 < len(hits) else len(text)
                right[h.group(1)] = han_only(text[h.end():end])
        else:
            l = han_only(text)
        if not l:
            continue
        left.append(l)
        order.append(n)
    keys = sorted(right)
    if len(left) < 2 or len(keys) != len(left):
        stats["match_shape"] += 1
        return None
    answer = {}
    for i, n in enumerate(order):
        letter = letters.get(n)
        if not letter or letter not in right:
            stats["match_no_answer"] += 1
            return None
        answer[str(i)] = letter.lower()
    return {
        "type": "matching",
        "content": {"left": left, "right": [right[k] for k in keys]},
        "answer": answer,
    }

def parse_sheet(quiz_name, ans_name, stats):
    qlines = load(quiz_name)
    alines = load(ans_name)
    letters, cells, ds = parse_answer_file(alines)
    out = []
    for roman, title, body in split_parts(qlines):
        kind = part_kind(title)
        qs = split_questions(body)
        if kind == "SKIP":
            stats["skip_part_q"] += len(qs)
            continue
        if kind == "MATCH":
            q = build_match(qs, letters, stats)
            if q:
                out.append(q)
            continue
        for n, lines in qs:
            if kind == "FILL":
                q = build_fill(n, lines, cells, stats)
            elif kind == "REORDER":
                q = build_reorder(n, lines, cells, stats)
            elif kind == "TRUEFALSE":
                q = build_truefalse(n, lines, ds, stats)
            else:
                q = build_mcq(n, lines, letters, stats)
            if q:
                out.append(q)
            else:
                stats["dropped"] += 1
    return out

# ---------- gom theo giáo trình ----------
FILE_RE = re.compile(r"ÔN TẬP HSK(\d) - Bài (\d+) \((\d+) câu\)")
ANS_FMT = "BÀI TẬP HSK {lvl}_ĐÁP ÁN ÔN TẬP HSK{lvl} - Bài {unit} - KAT.txt"

def main():
    stats = Counter()
    sheets = defaultdict(dict)  # level -> unit -> questions
    report = []
    for name in sorted(os.listdir(TXT)):
        m = FILE_RE.search(name)
        if not m or "ĐÁP ÁN" in name:
            continue
        lvl, unit, declared = int(m.group(1)), int(m.group(2)), int(m.group(3))
        ans = ANS_FMT.format(lvl=lvl, unit=unit)
        if not os.path.exists(os.path.join(TXT, ans)):
            report.append((lvl, unit, declared, 0, "THIẾU FILE ĐÁP ÁN"))
            continue
        qs = parse_sheet(name, ans, stats)
        sheets[lvl][unit] = qs
        report.append((lvl, unit, declared, len(qs), ""))
    report.sort()
    for lvl, unit, declared, got, note in report:
        bar = "" if got >= declared * 0.5 else "  <-- thấp"
        print(f"HSK{lvl} bài {unit:2d}: {got:2d}/{declared:2d} câu {note}{bar}")
    print("\nTổng:", sum(len(q) for u in sheets.values() for q in u.values()))
    print("Chi tiết bỏ qua:", dict(stats))
    types = Counter(q["type"] for u in sheets.values() for qs in u.values() for q in qs)
    print("Theo dạng:", dict(types))
    with open(os.path.join(HERE, "parsed.json"), "w", encoding="utf-8") as f:
        json.dump({str(k): {str(u): v for u, v in s.items()} for k, s in sheets.items()},
                  f, ensure_ascii=False, indent=1)

if __name__ == "__main__":
    main()
