"""Digitize HSK 2 PDFs; keep unresolved items separate and source IDs auditable."""
import hashlib
import json
import re
import subprocess
import unicodedata
from collections import Counter
from pathlib import Path

BASE = Path(__file__).resolve().parent
REPO = BASE.parent.parent
WORK = BASE / 'work'
OUT = REPO / 'supabase/library/hsk2-new30-baitap.json'
HAN = r'[\u3400-\u9fff]'


def clean(s):
    return re.sub(r'\s+', ' ', s).strip()


def zh(s):
    return re.sub(r'\s+', '', s)


def split_sections(s):
    matches = list(re.finditer(r'DẠNG\s*(\d+)\s*:', s, re.I))
    result = {}
    for i, m in enumerate(matches):
        result.setdefault(int(m[1]), []).append(s[m.end():matches[i+1].start() if i+1 < len(matches) else len(s)])
    return {k: '\n'.join(v) for k, v in result.items()}


def rows(s, bare=False):
    pattern = r'(?m)^[ \t]*(\d{1,2})(?:\.|(?=[ \t]))' if bare else r'(?m)^[ \t]*(\d{1,2})\.'
    matches = list(re.finditer(pattern, s))
    return {int(m[1]): clean(s[m.end():matches[i+1].start() if i+1 < len(matches) else len(s)]) for i, m in enumerate(matches)}


def choice(s):
    parts = re.split(r'(?<![A-Za-z])([A-F])\.\s*', s)
    assert len(parts) >= 5, s
    options = [clean(parts[i+1]) for i in range(1, len(parts), 2)]
    assert parts[1::2] == list('ABCDEF')[:len(options)], s
    return clean(parts[0]), options


def answer_rows(s):
    s = re.sub(r'Câu\s*\d+\s*-\s*\d+', '', s, flags=re.I)
    s = re.sub(r'(?m)^[ \t]*(Dạng\s*\d+[^\n]*|câu|sai|đoạn văn|văn|Trung\s*-\s*Việt|Việt\s*-\s*Trung|án đúng|đáp án đúng|Chọn đáp án đúng|Chọn đáp án|đúng|Tìm|Chọn đáp|Chọn|lỗi sai|Trung|Dịch|Dịch Việt -|Tìm lỗi sai|vào chỗ trống|gia chữ Hán|Đáp án chuẩn|Dạng bài|Câu hỏi.*|Số thứ tự)[ \t]*$', '', s, flags=re.I)
    # Answer table labels can straddle lines. Extract numbers before cleaning values.
    matches = list(re.finditer(r'(?<!\d)(\d{1,2})\.\s*', s))
    return {int(m[1]): clean(s[m.end():matches[i+1].start() if i+1 < len(matches) else len(s)]).strip('| ') for i, m in enumerate(matches)}


def strip_parentheses(s):
    return re.sub(r'\([^()]*\)|（[^（）]*）', '', s)


def variants(s):
    s = s.split('(')[0].split('（')[0]
    return [zh(v).strip() for v in re.split(r'\s*/\s*| hoặc ', s) if v.strip()]


def token_order(tokens, sentence):
    remaining = zh(sentence).replace('【', '').replace('】', '')
    for punct in '，。！？、':
        if punct not in ''.join(tokens):
            remaining = remaining.replace(punct, '')
    available = list(tokens)
    ordered = []
    while remaining:
        found = [t for t in available if remaining.startswith(t)]
        if not found:
            return None
        t = max(found, key=len)
        available.remove(t)
        ordered.append(t)
        remaining = remaining[len(t):]
    if available and all(t in '。！？' for t in available):
        ordered.extend(available)
        available = []
    return ordered if not available else None


def main():
    WORK.mkdir(exist_ok=True)
    source_root = next(p for p in Path('/Users/hathang/Downloads').iterdir()
        if unicodedata.normalize('NFC', p.name) == 'PHIẾU BÀI TẬP THEO TỪNG BÀI HSK 3.0') / 'HSK2 3.0'
    metadata = json.loads((WORK / 'live-metadata.json').read_text())
    lesson_by_unit = {l['unit']: l for l in metadata['lessons']}
    corrections = json.loads((BASE / 'corrections.json').read_text())
    payload = {'textbook': {'code': metadata['textbook']['code'], 'name': metadata['textbook']['name']}, 'lessons': []}
    manifest, pending = [], []
    for pdf in sorted(source_root.glob('*.pdf'), key=lambda p: int(re.search(r'BÀI\s*(\d+)', unicodedata.normalize('NFC', p.name))[1])):
        unit = int(re.search(r'BÀI\s*(\d+)', unicodedata.normalize('NFC', pdf.name))[1])
        digest = hashlib.sha256(pdf.read_bytes()).hexdigest()
        for mode in ['raw', 'layout']:
            subprocess.run(['pdftotext', '-' + mode, str(pdf), str(WORK / f'{mode}-{unit:02}.txt')], check=True)
        raw = (WORK / f'raw-{unit:02}.txt').read_text().replace('\f', '\n')
        body, answers = re.split(r'(?:ĐÁP\s*ÁN\s*THAM\s*KHẢO|BẢNG\s*ĐÁP\s*ÁN)', raw, maxsplit=1)
        source = {'file': unicodedata.normalize('NFC', pdf.name), 'sha256': digest, 'unit': unit}
        if unit in (2, 3):
            housing = json.loads((BASE/'housing-reviewed.json').read_text())
            questions = []
            for section, items in housing[str(unit)].items():
                for n, q in enumerate(items, 1):
                    q['content']['source'] = {**source, 'section':int(section), 'numbers':[n]}
                    questions.append(q)
            payload['lessons'].append({'unit':unit,'title':lesson_by_unit[unit]['title'],'questions':questions})
            manifest.append({**source,'lesson_id':lesson_by_unit[unit]['id'],'lesson_title':lesson_by_unit[unit]['title'],
                'source_items':50,'imported_records':50,'pending_items':0,
                'types':dict(Counter(q['type'] for q in questions)),
                'coverage':[{'section':s,'number':n} for s in range(1,6) for n in range(1,11)], 'pending_coverage':[],
                'mapping_note':'Người dùng yêu cầu giữ tiêu đề giáo trình hiện có; nhập theo số bài, dù nội dung PDF Bài 2–3 đều là thuê nhà.'})
            continue
        sections = split_sections(body)
        table_answers = answers
        if unit == 5 or unit >= 7:
            table_answers = re.split(r'Dạng\s*6\s*:', answers, maxsplit=1, flags=re.I)[0]
            table_answers = re.sub(r'Câu\s*51\s*', '', table_answers, flags=re.I)
        a = answer_rows(table_answers)
        per_unit = corrections.get(str(unit), {})
        questions = []
        covered = set()
        held = set()

        def add(section, number, typ, content, answer):
            ident = (section, number)
            assert ident not in covered and ident not in held, (unit, ident)
            qsource = {**source, 'section': section, 'numbers': [number]}
            content['source'] = qsource
            questions.append({'type': typ, 'content': content, 'answer': answer})
            covered.add(ident)

        def hold(section, number, prompt, answer, reason):
            ident = (section, number)
            assert ident not in covered and ident not in held
            held.add(ident)
            pending.append({'source': {**source, 'section': section, 'numbers': [number]},
                            'prompt': prompt, 'source_answer': answer, 'reason': reason})

        if unit == 1:
            ans = {k: answer_rows(v) for k, v in split_sections(answers).items()}
            for sec in range(1, 6):
                for n, value in rows(sections[sec]).items():
                    override = per_unit.get(f'{sec}:{n}', {})
                    if override.get('pending'):
                        hold(sec, n, value, ans[sec].get(n), override['reason'])
                        continue
                    if sec == 1:
                        answer = re.split(r'\s*/\s*', ans[sec][n])[0]
                        add(sec, n, 'fill_blank', {'prompt': re.sub(r'_+', '___', zh(value)), 'hint': 'Từ cho sẵn: 请、让、叫、接、介绍、帮忙、懂、吧、不好意思'}, [answer])
                    elif sec == 2:
                        tokens = [zh(t) for t in value.split('/')]
                        answer = token_order(tokens, ans[sec][n])
                        assert answer, (unit, sec, n, value, ans[sec][n])
                        add(sec, n, 'reorder', {'tokens': tokens}, answer)
                    elif sec == 3:
                        prompt, opts = choice(value)
                        add(sec, n, 'multiple_choice', {'prompt': prompt, 'options': opts}, ans[sec][n][0])
                    elif sec == 4:
                        add(sec, n, 'translation', {'prompt': value, 'target_language': 'zh'}, [zh(ans[sec][n])])
                    else:
                        answer = override.get('answer')
                        assert answer, (unit, sec, n, ans[sec][n])
                        add(sec, n, 'sentence_correction', {'prompt': value, 'hint': 'Viết lại câu đầy đủ, đúng ngữ pháp bằng chữ Hán.'}, answer)
            expected = {(sec, n) for sec in range(1, 6) for n in range(1, 11)}
        elif unit in (4, 6):
            # Raw PDF reading order places vocabulary 5–10 after heading 2.
            vocabulary = {int(m[1]):m[2]+'\n'+m[3] for m in re.finditer(
                r'(?m)^(\d{1,2})[ \t]+([^\n]+)\n(A\.[\s\S]*?)(?=\n(?:\d{1,2}[. \t]|DẠNG)|\Z)', body)}
            for n in range(1, 11):
                prompt, opts = choice(vocabulary[n])
                correct = (per_unit.get(f'1:{n}', {}).get('answer') or [a[n][0] if unit == 6 else None])[0]
                assert correct in 'ABC', (unit, n)
                add(1, n, 'multiple_choice', {'prompt': 'Chọn chữ Hán tương ứng với Pinyin: ' + prompt, 'options': opts}, correct)
            for sec in range(2, 7):
                section_text = sections[sec]
                if sec == 2:
                    section_text = re.sub(r'(?m)^(\d{1,2})[ \t]+([^\n]+)\n(A\.[\s\S]*?)(?=\n(?:\d{1,2}[. \t]|DẠNG)|\Z)', '', section_text)
                values = rows(section_text)
                nums = range(1, 11) if unit == 4 and sec in (2, 4, 5) else range(1, 16) if unit == 4 and sec == 3 else range(1, 6) if unit == 4 else range({2:11,3:21,4:36,5:46,6:56}[sec], {2:21,3:36,4:46,5:56,6:61}[sec])
                # For Bài 4 answer headings 1–5 actually correspond to body 2–6.
                aa = answer_rows(split_sections(answers)[sec-1]) if unit == 4 else a
                for n in nums:
                    value = values.get(n, '')
                    override = per_unit.get(f'{sec}:{n}', {})
                    if override.get('pending'):
                        hold(sec, n, value, aa.get(n), override['reason']); continue
                    if sec == 2:
                        prompt = override.get('prompt', re.sub(r'_+', '___', zh(value)))
                        answer = override.get('answer', [aa[n].split('(')[0].split('（')[0].strip()])
                        add(sec, n, 'fill_blank', {'prompt': prompt}, [zh(answer[0])])
                    elif sec == 3:
                        prompt, opts = choice(value)
                        add(sec, n, 'multiple_choice', {'prompt': prompt, 'options': opts}, override.get('answer', [aa[n][0]])[0])
                    elif sec == 4:
                        tokens = override.get('tokens', [zh(t) for t in value.split('/')])
                        order = token_order(tokens, override.get('answer', [aa[n]])[0])
                        assert order, (unit, sec, n, value, aa[n])
                        add(sec, n, 'reorder', {'tokens': tokens}, order)
                    elif sec == 5:
                        prompt = value.split('(Gợi ý')[0]
                        if unit == 6:
                            assert 'hanzi' in override and 'pinyin' in override, (unit, sec, n)
                            add(sec, n, 'hanzi_pinyin', {'prompt': 'Sửa lỗi câu sau, viết câu đúng và Pinyin: ' + prompt}, {'hanzi': override['hanzi'], 'pinyin': override['pinyin']})
                        else:
                            assert override.get('answer'), (unit, sec, n)
                            add(sec, n, 'sentence_correction', {'prompt': prompt, 'hint': 'Viết lại câu đầy đủ, đúng ngữ pháp bằng chữ Hán.'}, override['answer'])
                    elif sec == 6:
                        add(sec, n, 'translation', {'prompt': value, 'target_language': 'zh'}, [zh(aa[n])])
            expected = {(sec,n) for sec,nums in ([(1,range(1,11)),(2,range(1,11)),(3,range(1,16)),(4,range(1,11)),(5,range(1,11)),(6,range(1,6))] if unit==4 else [(1,range(1,11)),(2,range(11,21)),(3,range(21,36)),(4,range(36,46)),(5,range(46,56)),(6,range(56,61))]) for n in nums}
        else:
            for sec in range(1, 8):
                values = rows(sections[sec])
                nums = range((sec-1)*10+1, sec*10+1) if sec <= 5 else [50+sec-5]
                for n in nums:
                    value = values[n]
                    override = per_unit.get(f'{sec}:{n}', {})
                    if override.get('pending'):
                        hold(sec, n, value, a.get(n), override['reason']); continue
                    if sec == 1:
                        tokens = override.get('tokens', [zh(strip_parentheses(t)) for t in value.split('/')])
                        candidates = override.get('answer', variants(a[n]))
                        orders = [token_order(tokens, sentence) for sentence in candidates]
                        order = next((o for o in orders if o), None)
                        assert order, (unit, sec, n, tokens, a[n])
                        if order == tokens:
                            tokens = tokens[1:] + tokens[:1]
                        add(sec, n, 'reorder', {'tokens': tokens}, order)
                    elif sec == 2:
                        prompt, opts = choice(value)
                        opts = [s.replace('Đáp án chọn:', '').strip() for s in opts]
                        add(sec, n, 'multiple_choice', {'prompt': override.get('prompt', prompt), 'options': override.get('options', opts)}, override.get('answer', [a[n][0]])[0])
                    elif sec in (3, 4):
                        target = 'zh' if sec == 3 else 'vi'
                        prompt = value
                        answer = override.get('answer', [zh(a[n])] if target == 'zh' else [a[n]])
                        if target == 'zh' and '/' in answer[0]:
                            answer = [s for s in variants(a[n])]
                        add(sec, n, 'translation', {'prompt': prompt, 'target_language': target}, answer)
                    elif sec == 5:
                        answer = override.get('answer', variants(a[n]))
                        prompt = value.split('->')[0].strip()
                        add(sec, n, 'sentence_correction', {'prompt': prompt, 'hint': 'Viết lại câu đầy đủ, đúng ngữ pháp bằng chữ Hán.'}, answer)
                    elif sec == 6:
                        # Table paragraph row has no numeric bullet, extract from layout instead.
                        answer = per_unit.get('paragraph_answer')
                        assert answer, (unit, n)
                        add(sec, n, 'translation', {'prompt': override.get('prompt', value), 'target_language': 'vi'}, [answer])
                    else:
                        add(sec, n, 'essay', {'prompt': value, 'target_language': 'zh'}, [zh(answers.split('(Mẫu)',1)[1])])
            expected = {(sec,n) for sec in range(1,6) for n in range((sec-1)*10+1,sec*10+1)} | {(6,51),(7,52)}
        assert covered | held == expected, (unit, expected-(covered|held), (covered|held)-expected)
        assert not covered & held
        payload['lessons'].append({'unit':unit,'title':lesson_by_unit[unit]['title'],'questions':questions})
        manifest.append({**source,'lesson_id':lesson_by_unit[unit]['id'],'lesson_title':lesson_by_unit[unit]['title'],
            'source_items':len(expected),'imported_records':len(questions),'pending_items':len(held),
            'types':dict(Counter(q['type'] for q in questions)),
            'coverage':[{'section':s,'number':n} for s,n in sorted(covered)],
            'pending_coverage':[{'section':s,'number':n} for s,n in sorted(held)]})
    OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
    (BASE/'pending.json').write_text(json.dumps(pending,ensure_ascii=False,indent=2)+'\n')
    (BASE/'manifest.json').write_text(json.dumps({'sources':manifest,'payload_sha256':hashlib.sha256(OUT.read_bytes()).hexdigest()},ensure_ascii=False,indent=2)+'\n')
    print('Prepared',sum(len(l['questions']) for l in payload['lessons']),'records;',sum(m['pending_items'] for m in manifest),'pending source items')


if __name__ == '__main__':
    main()
