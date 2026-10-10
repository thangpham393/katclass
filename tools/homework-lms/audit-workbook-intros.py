"""Read all HSK 3+ questions; audit worksheet introductions without live writes."""
import json
import re
import sys
from collections import Counter
from pathlib import Path

BASE = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE.parent / 'hsk1-import'))
from import_live import Database


def paged(db, table, query):
    rows = []
    for offset in range(0, 100000, 250):
        batch = db.request(table, {**query, 'limit': '250', 'offset': str(offset)})
        rows.extend(batch)
        if len(batch) < 250:
            return rows
    raise RuntimeError('Pagination guard reached')


db = Database()
textbooks = paged(db, 'textbooks', {'select': 'id,code,level', 'order': 'id'})
lessons = paged(db, 'lessons', {'select': 'id,unit,textbook_id', 'order': 'id'})
by_tb = {t['id']: t for t in textbooks}
by_lesson = {l['id']: l for l in lessons}
rows = paged(db, 'questions', {'select': 'id,type,level,tags,lesson_id,content,is_test_snapshot',
                             'level': 'in.(HSK3,HSK4,HSK5,HSK6)', 'order': 'id'})
fill_rows = paged(db, 'questions', {'select': 'id,type,level,tags,lesson_id,content,is_test_snapshot',
                                  'type': 'eq.fill_blank', 'order': 'id'})
counts = Counter()
intros = []
unexpected = []
for q in rows:
    lesson = by_lesson.get(q['lesson_id'], {})
    textbook = by_tb.get(lesson.get('textbook_id'), {})
    code = textbook.get('code', 'snapshot-or-unlinked')
    counts[code] += 1
    for field, value in q['content'].items():
        if isinstance(value, str) and re.search(r'nhắc lại kiến thức', value, re.I):
            record = {'id': q['id'], 'textbook': code, 'unit': lesson.get('unit') or q['content'].get('source', {}).get('unit'),
                      'type': q['type'], 'field': field, 'snapshot': q['is_test_snapshot']}
            if field == 'passage' and q['type'] != 'reading' and re.match(r'^\s*nhắc lại kiến thức(?:\s|$)', value, re.I):
                intros.append(record)
            else:
                unexpected.append(record)
standard = [q for q in rows if not q['is_test_snapshot'] and
            by_tb.get(by_lesson.get(q['lesson_id'], {}).get('textbook_id'), {}).get('code') == 'hsk3-standard']
payload = json.loads((BASE.parent.parent / 'supabase/library/kat-hsk3-baitap.json').read_text())
if not all('passage' in l['questions'][0]['content'] for l in payload['lessons']):
    payload = {'lessons': json.loads((BASE.parent.parent / 'tests/fixtures/workbook-layout.json').read_text())['hsk3IntroLessons']}
expected = {l['unit']: l['questions'][0]['content']['passage'] for l in payload['lessons']}
actual = {by_lesson[q['lesson_id']]['unit']: q['content']['passage'] for q in standard if 'passage' in q['content']}
assert len(standard) == 800 and actual == expected, 'Live HSK 3 introductions differ from the audited payload'
assert not unexpected, 'Introduction found outside the supported legacy field; inspect before deployment'
report = {'read_only': True, 'questions_audited': len(rows), 'questions_by_textbook': dict(counts),
          'intro_count': len(intros), 'intro_units': sorted(r['unit'] for r in intros if r['textbook'] == 'hsk3-standard'),
          'standard_hsk3_questions': len(standard), 'live_intro_matches_payload': True, 'unexpected': unexpected,
          'fill_questions_audited_all_levels': len(fill_rows),
          'fill_questions_by_textbook': dict(Counter(by_tb.get(by_lesson.get(q['lesson_id'], {}).get('textbook_id'), {}).get('code', 'snapshot-or-unlinked') for q in fill_rows))}
work = BASE / 'work'
work.mkdir(exist_ok=True)
(work / 'live-hsk3-plus-questions.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n')
(work / 'live-fill-questions.json').write_text(json.dumps(fill_rows, ensure_ascii=False, indent=2) + '\n')
(work / 'workbook-intro-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(report, ensure_ascii=False, indent=2))
