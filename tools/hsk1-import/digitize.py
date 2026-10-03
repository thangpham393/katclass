"""Digitize the local HSK 1 worksheets. Requires Poppler's pdftotext.

Source numbers and hashes are kept in each question for audit/re-import.
Corrections are explicit; no textbook/lesson metadata is overwritten.
"""
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
OUT = REPO / 'supabase/library/hsk1-new30-baitap.json'
ROOT = next(p for p in Path('/Users/hathang/Downloads').iterdir()
            if p.is_dir() and unicodedata.normalize('NFC', p.name) == 'PHIẾU BÀI TẬP THEO TỪNG BÀI HSK 3.0') / 'HSK1 3.0'
HAN = r'[\u3400-\u9fff]'
CORRECTIONS = []


def note(unit, number, message):
    CORRECTIONS.append({'unit': unit, 'number': number, 'message': message})


def clean(text):
    return re.sub(r'\s+', ' ', text).strip()


def chinese(text):
    return re.sub(r'\s+', '', text)


def remove_footers(text):
    return '\n'.join(l for l in text.replace('\f', '\n').splitlines()
                     if not re.match(r'^\s*(Bài\s*\d+\s*:|Phiếu\s*Bài\s*Tập|Trang\s*\d)', l))


def sections(text):
    result = {}
    matches = list(re.finditer(r'DẠNG\s*(\d)\s*:', text))
    for i, m in enumerate(matches):
        end = matches[i+1].start() if i+1 < len(matches) else len(text)
        result.setdefault(int(m[1]), []).append(text[m.end():end])
    return {k: '\n'.join(v) for k, v in result.items()}


def records(text, lo, hi, dotted=True):
    pattern = r'(?m)^\s*(\d{1,2})\.' if dotted else r'(?m)^[ \t]*(\d{1,2})(?:\.|(?=[ \t\n]))'
    matches = [m for m in re.finditer(pattern, text) if lo <= int(m[1]) <= hi]
    out = {}
    for i, m in enumerate(matches):
        end = matches[i+1].start() if i+1 < len(matches) else len(text)
        assert int(m[1]) not in out, (lo, hi, m[1])
        out[int(m[1])] = text[m.end():end]
    return out


def choices(text):
    target, options = [], {}
    for line in text.splitlines():
        matches = list(re.finditer(r'([A-D])\.\s*', line))
        if not matches:
            if line.strip(): target.append(line.strip())
            continue
        prefix = line[:matches[0].start()].strip()
        if prefix: target.append(prefix)
        for i, m in enumerate(matches):
            end = matches[i+1].start() if i+1 < len(matches) else len(line)
            options[m[1]] = clean(line[m.end():end])
    return clean(' '.join(target)), [options[k] for k in sorted(options)]


def answer_records(text, lo, hi):
    pattern = r'(?<!\d)(\d{1,2})\.[ \t]*'
    matches = [m for m in re.finditer(pattern, text) if lo <= int(m[1]) <= hi]
    result = {}
    for i, m in enumerate(matches):
        end = matches[i+1].start() if i+1 < len(matches) else len(text)
        value = text[m.end():end].split('DẠNG')[0].split('*Dịch')[0].strip(' \n|')
        value = re.sub(r'\(hoặc.*?\)', '', value, flags=re.S)
        result[int(m[1])] = clean(value)
    return result


def ordered_tokens(tokens, answer):
    remaining = chinese(answer)
    result = []
    available = list(tokens)
    while remaining:
        matches = [t for t in available if remaining.startswith(t)]
        if not matches: return None
        token = max(matches, key=len)
        available.remove(token)
        result.append(token)
        remaining = remaining[len(token):]
    return result if not available else None


def main():
    WORK.mkdir(exist_ok=True)
    originals = json.loads((REPO / 'supabase/library/hsk1-new30.json').read_text())
    lesson_metadata = {l['unit']: l for l in originals['lessons']}
    manual = json.loads((BASE / 'corrections.json').read_text())
    payload = {'textbook': originals['textbook'], 'lessons': []}
    manifest = []
    for pdf in sorted(ROOT.glob('*.pdf'), key=lambda p: int(re.search(r'\d+', p.name)[0])):
        unit = int(re.search(r'\d+', pdf.name)[0])
        digest = hashlib.sha256(pdf.read_bytes()).hexdigest()
        if unit == 7:
            manifest.append({'unit': 7, 'file': unicodedata.normalize('NFC', pdf.name), 'sha256': digest,
                             'skipped': 'User requested skipping: exact duplicate of lesson 9 PDF.'})
            continue
        for mode, args in [('lesson', ['-layout']), ('raw', ['-raw']),
                           ('left', ['-layout', '-x', '0', '-W', '300', '-H', '850']),
                           ('right', ['-layout', '-x', '300', '-W', '300', '-H', '850'])]:
            subprocess.run(['pdftotext', *args, str(pdf), str(WORK / f'{mode}-{unit:02}.txt')], check=True)
        text = remove_footers((WORK / f'lesson-{unit:02}.txt').read_text())
        body, answers = re.split(r'ĐÁP\s*ÁN\s*THAM\s*KHẢO', text, maxsplit=1)
        sec = sections(body)
        ans = sections(answers)
        raw = remove_footers((WORK / f'raw-{unit:02}.txt').read_text())
        rawbody, rawanswers = re.split(r'ĐÁP\s*ÁN\s*THAM\s*KHẢO', raw, maxsplit=1)
        rsec, rans = sections(rawbody), sections(rawanswers)
        letter_answers = {int(n): a for n, a in re.findall(r'(\d{1,2})\s*[.\-]\s*([A-J])', answers)}
        fill_answers = answer_records(ans[3], 11 if unit == 1 else 21, 15 if unit == 1 else 30)
        order_answers = answer_records(ans.get(4, ''), 16 if unit == 1 else 31, 20 if unit == 1 else 40)
        translation_answers = answer_records(ans.get(5, ''), 21 if unit == 1 else 41, 25 if unit == 1 else 50)
        per_unit = manual.get(str(unit), {})
        for k, v in per_unit.get('fill_answers', {}).items(): fill_answers[int(k)] = v
        for k, v in per_unit.get('matching_answers', {}).items():
            letter_answers[int(k)] = v
        for k, v in per_unit.get('reading_answers', {}).items():
            letter_answers[int(k)] = v
        if per_unit.get('reading_answers'):
            note(unit, list(map(int, per_unit['reading_answers'])), 'Phiếu không có khóa đáp án đọc hiểu. Bổ sung đáp án bằng cách đối chiếu đoạn văn.')
        if unit in [12, 13, 14]:
            note(unit, list(range(31, 51)), 'Phiếu chỉ ghi “Xem chi tiết trong tài liệu”, không có đáp án dạng 4–5. Bổ sung câu chuẩn từ các khối chữ và đề dịch.')
        if unit == 1:
            note(unit, 20, 'Đề câu 20 bị cắt ở cuối trang; khôi phục câu 对不起 theo đáp án tham khảo.')
        for k, v in per_unit.get('order_answers', {}).items(): order_answers[int(k)] = v
        for k, v in per_unit.get('translation_answers', {}).items(): translation_answers[int(k)] = v
        for entry in per_unit.get('notes', []): note(unit, entry['number'], entry['message'])
        questions = []
        coverage = set()

        def add(section, number, typ, content, answer, part=None):
            nums = number if isinstance(number, list) else [number]
            source = {'file': unicodedata.normalize('NFC', pdf.name), 'sha256': digest,
                      'unit': unit, 'section': section, 'numbers': nums}
            if part: source['part'] = part
            content['source'] = source
            questions.append({'type': typ, 'content': content, 'answer': answer})
            coverage.update(nums)

        # Vocabulary multiple choice. Crop the columns to avoid mixing adjacent questions.
        first = {}
        if unit == 1:
            for n, value in records(sec[1], 1, 5).items(): first[n] = choices(value)
        elif 12 <= unit <= 14:
            for n, value in records(rsec[1], 1, 10, False).items():
                pieces = re.split(r'[ABC]\.\s*', value)
                assert len(pieces) == 4, (unit, n, pieces)
                first[n] = (clean(pieces[0]), [chinese(p) for p in pieces[1:]])
        else:
            for col in ['left', 'right']:
                t = remove_footers((WORK / f'{col}-{unit:02}.txt').read_text().split('\f')[0])
                # Stop at the first question of section 2 (cropped headings may be partial).
                end = re.search(r'(?m)^\s*11\.?\s', t)
                if end: t = t[:end.start()]
                for n, value in records(t, 1, 10, False).items(): first[n] = choices(value)
        for k, v in per_unit.get('choices', {}).items():
            first[int(k)] = (v['target'], v['options'])
            note(unit, int(k), v['reason'])
        for n in sorted(first):
            target, opts = first[n]
            if unit in [1, 2, 3, 4, 5, 6, 9, 10]:
                target = ''.join(re.findall(HAN, target))
                typ, content = 'pinyin_choice', {'hanzi': target, 'prompt': 'Chọn Pinyin chính xác.', 'options': opts}
            else:
                typ, content = 'multiple_choice', {'prompt': 'Chọn chữ Hán giản thể tương ứng: ' + target, 'options': opts}
            correct = per_unit.get('letter_answers', {}).get(str(n), letter_answers[n])
            if correct != letter_answers[n]: note(unit, n, 'Sửa khóa đáp án: ' + letter_answers[n] + ' → ' + correct)
            add(1, n, typ, content, correct)

        # Keep the complete worksheet group; matching now supports A–Z.
        if unit == 1:
            left = ['大家', '不客气', '对不起', '没关系', '同学']
            columns, combined = [], {}
            for col, (part, right, mapping) in enumerate([
                ('pinyin', ['bú kèqi', 'duìbuqǐ', 'dàjiā', 'tóngxué', 'méi guānxi'], ['c','a','b','e','d']),
                ('meaning', ['Xin lỗi', 'Không sao đâu', 'Đừng khách sáo', 'Bạn học', 'Mọi người'], ['e','c','a','b','d'])]):
                columns.append({'label': 'Pinyin' if col == 0 else 'Nghĩa', 'options': right})
                combined.update({f'{row}:{col}': a for row, a in enumerate(mapping)})
            add(2, list(range(6, 11)), 'multi_matching', {'prompt': 'Nối chữ Hán với Pinyin và nghĩa tương ứng.',
                'left': left, 'columns': columns}, combined)
            note(1, [9, 10], 'Bảng nối bị cắt cuối trang. Khôi phục mục 9–10 và các lựa chọn còn thiếu từ đáp án tham khảo.')
        else:
            rows = {}
            for n, value in records(sec[2], 11, 20, False).items():
                value = clean(value)
                m = re.search(r'([A-J])\.\s*(.+)', value)
                assert m, (unit, n, value)
                left = ''.join(re.findall(HAN, value[:m.start()]))
                if unit == 12 and n == 18: left = '太……了'
                rows[n] = (left, m[1], clean(m[2]))
            right_by_letter = {letter: meaning for left, letter, meaning in rows.values()}
            right_by_letter.update(per_unit.get('matching_meanings', {}))
            for group in [list(range(11, 21))]:
                original_letters = sorted(letter_answers[n] for n in group)
                right = [right_by_letter[a] for a in original_letters]
                answer = {str(i): chr(97+original_letters.index(letter_answers[n])) for i, n in enumerate(group)}
                add(2, group, 'matching', {'prompt': 'Nối chữ Hán với nghĩa tương ứng.',
                    'left': [rows[n][0] for n in group], 'right': right}, answer)

        # Blanks: keep spatial gaps, including blanks at the beginning of a sentence.
        if unit == 1:
            for n, entry in per_unit['fill'].items():
                add(3, int(n), 'hanzi_pinyin', {'prompt': entry['prompt'].split('\n')[0], 'hint': 'Điền chữ Hán còn thiếu và Pinyin tương ứng.'},
                    {'hanzi': entry['answer'][0], 'pinyin': entry['answer'][1]})
        elif 12 <= unit <= 14:
            for n, value in records(sec[3], 21, 30).items():
                prompt = chinese(value).replace('________', '___')
                add(3, n, 'fill_blank', {'prompt': prompt, 'hint': per_unit['word_bank']}, [chinese(fill_answers[n])])
        else:
            first_fill = {}
            for col in ['left', 'right']:
                t = remove_footers((WORK / f'{col}-{unit:02}.txt').read_text())
                # Use the third PDF page, whose two-column layout contains section 3.
                page = (WORK / f'{col}-{unit:02}.txt').read_text().split('\f')[2]
                first_fill.update(records(remove_footers(page), 21, 30))
            for n in sorted(first_fill):
                value = first_fill[n].rstrip()
                if value.startswith(' '): value = value[1:]
                prompt = re.sub(r'_{3,}', '___', value)
                if '___' not in prompt: prompt = re.sub(r'[ \t]{3,}', '___', prompt)
                prompt = chinese(prompt)
                if str(n) in per_unit.get('fill_prompts', {}):
                    note(unit, n, 'Hiệu chỉnh đề điền từ: ' + prompt + ' → ' + per_unit['fill_prompts'][str(n)])
                    prompt = per_unit['fill_prompts'][str(n)]
                bank = per_unit.get('word_bank') or '、'.join(dict.fromkeys(chinese(fill_answers[i]) for i in sorted(fill_answers)))
                add(3, n, 'fill_blank', {'prompt': prompt, 'hint': bank}, [chinese(fill_answers[n])])

        # Reorder keeps the original shuffled tokens unless they cannot produce the key.
        order = records(sec[4], 16 if unit == 1 else 31, 20 if unit == 1 else 40)
        for k, v in per_unit.get('order_prompts', {}).items(): order[int(k)] = v
        for n in sorted(order):
            value = next(line.strip() for line in order[n].splitlines() if '/' in line)
            if unit == 1:
                value = value.split('Chữ Hán:')[0]
                tokens = per_unit['tokens'][str(n)]
            else: tokens = [chinese(t) for t in value.strip().split('/')]
            answer = chinese(order_answers[n])
            ordered = ordered_tokens(tokens, answer)
            if ordered is None:
                note(unit, n, 'Các khối gốc không khớp đáp án. Tái tạo các khối chữ từ câu chuẩn: ' + answer)
                tokens = list(answer)
                tokens = tokens[1:] + tokens[:1]
                ordered = list(answer)
            if unit == 1:
                add(4, n, 'reorder', {'prompt': 'Sắp xếp các khối chữ thành câu hoàn chỉnh và viết Pinyin.', 'tokens': tokens, 'require_pinyin': True},
                    {'hanzi': answer, 'pinyin': per_unit['order_pinyin'][str(n)], 'order': json.dumps(ordered, ensure_ascii=False, separators=(',', ':'))})
            else:
                add(4, n, 'reorder', {'prompt': 'Sắp xếp các khối chữ thành câu hoàn chỉnh.', 'tokens': tokens}, ordered)

        # Native translation keeps acceptable variants separate from public content.
        for n, value in records(sec[5], 21 if unit == 1 else 41, 25 if unit == 1 else 50).items():
            vi = clean(value.split('Chữ Hán:')[0].split('\n\n')[0])
            if unit == 1:
                pair = per_unit['translations'][str(n)]
                answer = {'hanzi': pair[0], 'pinyin': pair[1]}
                prompt = 'Dịch sang tiếng Trung, viết chữ Hán và Pinyin: ' + vi
                typ = 'hanzi_pinyin'
            else:
                answer = list(dict.fromkeys([chinese(translation_answers[n]), *per_unit.get('translation_variants', {}).get(str(n), [])]))
                prompt = vi
                typ = 'translation'
            add(5, n, typ, {'prompt': prompt,
                'hint': 'Viết câu đầy đủ bằng chữ Hán.'}, answer)

        if 6 in sec:
            reading = sec[6]
            first_q = re.search(r'(?m)^\s*51\.', reading)
            passage_block = reading[:first_q.start()]
            # All-CJK lines comprise the passage; Latin lines are the accompanying Pinyin.
            zh_lines, py_lines = [], []
            for line in passage_block.splitlines()[1:]:
                line = line.strip()
                if not line: continue
                if re.search(HAN, line) and not re.search(r'[A-Za-zÀ-ỹ]', line): zh_lines.append(chinese(line))
                elif re.match(r'^[A-Za-zÀ-ỹ]', line) and not re.match(r'^(Đọc|ĐOẠN)', line): py_lines.append(clean(line))
            passage = ''.join(zh_lines) + '\n\n' + ' '.join(py_lines)
            items, answer = [], {}
            for n, value in records(reading, 51, 60).items():
                prompt, opts = choices(value)
                items.append({'prompt': prompt, 'type': 'multiple_choice', 'options': opts})
                answer[str(len(items)-1)] = letter_answers[n]
            add(6, list(range(51, 61)), 'reading', {'passage': passage, 'items': items}, answer)

        expected = 25 if unit == 1 else 50 if unit in [2, 3] else 60
        assert coverage == set(range(1, expected+1)), (unit, 'Missing source questions', set(range(1, expected+1))-coverage)
        validate(unit, questions)
        metadata = lesson_metadata[unit]
        payload['lessons'].append({'unit': unit, 'title': metadata['title'], 'questions': questions})
        manifest.append({'unit': unit, 'file': unicodedata.normalize('NFC', pdf.name), 'sha256': digest,
                         'source_exercises': expected, 'question_records': len(questions),
                         'types': dict(Counter(q['type'] for q in questions))})
        print('Lesson', unit, expected, 'source exercises,', len(questions), 'records')
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    (BASE / 'manifest.json').write_text(json.dumps({'files': manifest, 'corrections': CORRECTIONS}, ensure_ascii=False, indent=2) + '\n')


def validate(unit, questions):
    for q in questions:
        c, a = q['content'], q['answer']
        n = c['source']['numbers']
        if q['type'] in ['multiple_choice', 'pinyin_choice']:
            assert 2 <= len(c['options']) <= 6, (unit, n, c)
            assert len(set(c['options'])) == len(c['options']), (unit, n, 'Duplicate choices', c)
            assert all(c['options']) and 0 <= ord(a)-65 < len(c['options']), (unit, n, a, c)
            assert c.get('hanzi') or c.get('prompt'), (unit, n)
        elif q['type'] == 'fill_blank':
            assert c['prompt'].count('___') == len(a) and all(a), (unit, n, c, a)
        elif q['type'] == 'reorder':
            order = json.loads(a['order']) if c.get('require_pinyin') else a
            assert Counter(c['tokens']) == Counter(order) and len(order) > 1, (unit, n, c, a)
            if c.get('require_pinyin'): assert a['hanzi'] == ''.join(order) and a['pinyin'], (unit, n)
        elif q['type'] == 'matching':
            assert len(c['right']) <= 26 and len(c['left']) == len(a), (unit, n, c, a)
            assert all(c['left']) and all(c['right']), (unit, n, c)
        elif q['type'] == 'reading':
            assert len(c['items']) == 10 and re.search(HAN, c['passage']), (unit, c)
            for i, item in enumerate(c['items']):
                assert len(item['options']) == 3 and all(item['options']), (unit, 51+i, item)
                assert 0 <= ord(a[str(i)])-65 < 3, (unit, i, a)
        elif q['type'] == 'translation':
            assert c['prompt'] and isinstance(a, list) and all(a), (unit, n)
        elif q['type'] == 'hanzi_pinyin':
            assert c['prompt'] and a['hanzi'] and a['pinyin'], (unit, n)
        elif q['type'] == 'multi_matching':
            assert len(c['columns']) == 2 and len(a) == 2 * len(c['left']), (unit, n)
            for row in range(len(c['left'])):
                for col in range(2):
                    assert 0 <= ord(a[f'{row}:{col}'])-97 < len(c['columns'][col]['options']), (unit, n)
        else:
            raise AssertionError(('Unknown type', q['type']))


if __name__ == '__main__':
    main()
