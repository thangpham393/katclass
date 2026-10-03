"""Import the verified exercise payload into the existing Supabase textbook.

Default: read-only plan. --apply: add questions and answers; --verify: read back.
Never modifies textbook, lessons, vocab, assignments, or other questions.
Credentials stay in .env.local and are never printed or saved in reports.
"""
import argparse
import hashlib
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

from digitize import validate

BASE = Path(__file__).resolve().parent
REPO = BASE.parent.parent
PAYLOAD = REPO / 'supabase/library/hsk1-new30-baitap.json'
WORK = BASE / 'work'


def stable(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def key(row):
    return row['lesson_id'] + '|' + row['type'] + '|' + stable(row['content'])


def chunks(values, size=100):
    return [values[i:i+size] for i in range(0, len(values), size)]


def fetch_answers(db, ids, select='question_id,answer'):
    result = []
    for group in chunks(list(ids)):
        result.extend(db.request('question_answers', {'select': select,
            'question_id': 'in.(' + ','.join(group) + ')', 'limit': '1000'}))
    return result


class Database:
    def __init__(self):
        env = {}
        for line in (REPO / '.env.local').read_text().splitlines():
            if line.strip() and not line.lstrip().startswith('#') and '=' in line:
                name, value = line.split('=', 1)
                env[name] = value.strip().strip('\"\'')
        self.endpoint = env['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/') + '/rest/v1/'
        self.secret = env['SUPABASE_SERVICE_ROLE_KEY']

    def request(self, table, query=None, data=None, prefer=None):
        url = self.endpoint + table
        if query: url += '?' + urllib.parse.urlencode(query)
        headers = {'apikey': self.secret, 'Authorization': 'Bearer ' + self.secret,
                   'Content-Type': 'application/json'}
        if prefer: headers['Prefer'] = prefer
        request = urllib.request.Request(url, headers=headers,
            data=None if data is None else json.dumps(data, ensure_ascii=False).encode())
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                raw = response.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as exc:
            details = json.loads(exc.read())
            raise RuntimeError(f'{table}: {details.get("message", "Request failed")}') from None


def main():
    args = argparse.ArgumentParser()
    modes = args.add_mutually_exclusive_group()
    modes.add_argument('--apply', action='store_true')
    modes.add_argument('--verify', action='store_true')
    options = args.parse_args()
    payload = json.loads(PAYLOAD.read_text())
    assert payload['textbook']['code'] == 'hsk1-new30'
    assert {l['unit'] for l in payload['lessons']} == set(range(1, 16)) - {7}
    for lesson in payload['lessons']: validate(lesson['unit'], lesson['questions'])
    db = Database()
    # Reading type/snapshot migration must already exist; no writes before this check.
    db.request('questions', {'select': 'id,is_test_snapshot', 'limit': '0'})
    textbooks = db.request('textbooks', {'select': '*', 'code': 'eq.hsk1-new30'})
    assert len(textbooks) == 1, 'Expected exactly one existing hsk1-new30 textbook.'
    tb = textbooks[0]
    lessons = db.request('lessons', {'select': '*', 'textbook_id': 'eq.' + tb['id'], 'order': 'unit'})
    by_unit = {l['unit']: l for l in lessons}
    assert len(by_unit) == 15 and len(lessons) == 15, 'Expected 15 unambiguous existing lessons.'
    ids = [by_unit[l['unit']]['id'] for l in payload['lessons']]
    existing = db.request('questions', {'select': '*', 'lesson_id': 'in.(' + ','.join(ids) + ')', 'limit': '1000'})
    assert len(existing) < 1000, 'Question query needs pagination.'
    native_keys = {key({'lesson_id': by_unit[l['unit']]['id'], 'type': q['type'], 'content': q['content']})
                   for l in payload['lessons'] for q in l['questions']}
    legacy = [q for q in existing if 'hsk1-pdf-worksheets' in q.get('tags', [])
              and not q.get('is_test_snapshot', False) and key(q) not in native_keys]
    if legacy:
        raise RuntimeError('Bộ bài tập còn dùng định dạng cũ hoặc có chỉnh sửa. '
            'Chạy migration 0049 rồi 0050 trong Supabase SQL Editor và rà soát dữ liệu trước khi nhập lại; '
            f'phát hiện {len(legacy)} bản ghi khác định dạng mới. Chưa ghi dữ liệu lên hệ thống.')
    if not options.verify:
        WORK.mkdir(exist_ok=True)
        backup = {'textbook': tb, 'lessons': lessons, 'questions': existing}
        if existing:
            backup['answers'] = fetch_answers(db, [q['id'] for q in existing], '*')
        path = WORK / ('before-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.json')
        path.write_text(json.dumps(backup, ensure_ascii=False, indent=2))
    existing_by_key = {key(q): q for q in existing}
    assert len(existing_by_key) == len(existing), 'Duplicate existing content; inspect before importing.'
    expected, plan = [], []
    for lesson in payload['lessons']:
        unit = lesson['unit']
        lesson_id = by_unit[unit]['id']
        new, all_answers = [], []
        for q in lesson['questions']:
            row = {'lesson_id': lesson_id, 'type': q['type'], 'content': q['content']}
            fingerprint = key(row)
            prior = existing_by_key.get(fingerprint)
            qid = prior['id'] if prior else str(uuid.uuid5(uuid.NAMESPACE_URL, 'classhub-hsk1-pdf|' + fingerprint))
            record = {'id': qid, **row, 'level': tb['level'], 'tags': [tb['code'], 'hsk1-pdf-worksheets'],
                      'created_by': tb['created_by'], 'is_test_snapshot': False}
            if not prior: new.append(record)
            expected.append({**row, 'id': qid, 'answer': q['answer']})
            all_answers.append({'question_id': qid, 'answer': q['answer']})
        plan.append({'unit': unit, 'records': len(all_answers), 'new': len(new), 'existing': len(all_answers)-len(new)})
        if options.apply:
            # UUIDs are explicit so responses cannot attach answers to the wrong question.
            # A retry with the same payload ignores previously inserted questions.
            if new:
                db.request('questions', data=new, query={'on_conflict': 'id'}, prefer='resolution=ignore-duplicates,return=minimal')
            current_answers = db.request('question_answers', {'select': 'question_id,answer',
                'question_id': 'in.(' + ','.join(a['question_id'] for a in all_answers) + ')'})
            found = {a['question_id']: a['answer'] for a in current_answers}
            for a in all_answers:
                if a['question_id'] in found:
                    assert found[a['question_id']] == a['answer'], f'Existing answer differs: lesson {unit}.'
            missing = [a for a in all_answers if a['question_id'] not in found]
            if missing:
                db.request('question_answers', data=missing, query={'on_conflict': 'question_id'},
                           prefer='resolution=ignore-duplicates,return=minimal')
            print(f'Imported lesson {unit}: {len(new)} new, {len(all_answers)} answers present.', flush=True)
    total = len(expected)
    if options.apply or options.verify:
        expected_by_id = {q['id']: q for q in expected}
        # Match actual rows to exact content + answers, not just counts.
        actual = db.request('questions', {'select': '*', 'lesson_id': 'in.(' + ','.join(ids) + ')', 'limit': '1000'})
        actual_by_id = {q['id']: q for q in actual}
        actual_answers = fetch_answers(db, expected_by_id)
        answers = {a['question_id']: a['answer'] for a in actual_answers}
        assert len(answers) == total, 'Missing imported answers.'
        for qid, q in expected_by_id.items():
            assert qid in actual_by_id and key(q) == key(actual_by_id[qid]), 'Content/lesson mismatch.'
            assert q['answer'] == answers[qid], 'Answer mismatch.'
            assert actual_by_id[qid]['is_test_snapshot'] is False
        # Ensure existing textbook/lesson metadata and skipped lesson 7 are untouched.
        tb_after = db.request('textbooks', {'select': '*', 'id': 'eq.' + tb['id']})[0]
        ls_after = db.request('lessons', {'select': '*', 'textbook_id': 'eq.' + tb['id'], 'order': 'unit'})
        assert tb_after == tb and ls_after == lessons, 'Unexpected metadata change.'
        skip_rows = db.request('questions', {'select': 'id', 'lesson_id': 'eq.' + by_unit[7]['id']})
        report = {'verified_at': datetime.now(timezone.utc).isoformat(), 'textbook_id': tb['id'],
                  'textbook_code': tb['code'], 'payload_sha256': hashlib.sha256(PAYLOAD.read_bytes()).hexdigest(),
                  'lessons': plan, 'verified_question_records': total, 'verified_answers': len(answers),
                  'skipped_unit': 7, 'skipped_unit_question_count': len(skip_rows),
                  'metadata_unchanged': True, 'mode': 'apply' if options.apply else 'verify'}
        (BASE / 'import-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        print(f'VERIFIED: {total} question records, {len(answers)} answers; textbook/lesson metadata unchanged.')
    else:
        report = {'textbook_id': tb['id'], 'textbook_name': tb['name'], 'plan': plan,
                  'new_question_records': sum(p['new'] for p in plan), 'total_question_records': total}
        (WORK / 'import-plan.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
        print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
