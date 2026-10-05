"""Import the visually reviewed Quận 2 roster. Default mode is read only."""
import argparse
from collections import defaultdict
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import uuid

BASE = Path(__file__).resolve().parent
REPO = BASE.parent.parent
sys.path.insert(0, str(BASE.parent / 'hsk1-import'))
from import_live import Database

SOURCE = Path('/Users/hathang/Downloads/DANH SÁCH HỌC VIÊN QUẬN 2 (2026) - 2026.pdf')
TAG = 'IMP:Q22026'
TABLES = ('branches', 'profiles', 'classes', 'class_schedules',
          'class_students', 'parent_students', 'class_teachers')
KEYS = {'class_students': ('class_id', 'student_id'),
        'parent_students': ('parent_id', 'student_id'),
        'class_teachers': ('class_id', 'teacher_id')}


def identity(table, row):
    return tuple(row[k] for k in KEYS.get(table, ('id',)))


def uid(key):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, 'classhub|' + TAG + '|' + key))


def phone(raw):
    if raw is None:
        return None
    assert re.fullmatch(r'\d{9,10}', raw), 'Unexpected phone format'
    value = '0' + raw if len(raw) == 9 else raw
    assert re.fullmatch(r'0[35789]\d{8}', value), 'Unexpected mobile number'
    return value


def snapshot(db):
    result = {}
    for table in TABLES:
        rows = []
        for offset in range(0, 100000, 250):
            batch = db.request(table, {'select': '*', 'order': ','.join(KEYS.get(table, ('id',))),
                                       'limit': '250', 'offset': str(offset)})
            rows.extend(batch)
            if len(batch) < 250:
                break
        else:
            raise RuntimeError('Pagination guard reached')
        result[table] = rows
    return result


def build(roster, before):
    expected = {table: [] for table in TABLES}
    prior = [b for b in before['branches']
             if b['code'] == 'quan2' or b['name'].strip().casefold() == 'quận 2']
    assert len(prior) <= 1, 'Ambiguous Quận 2 branch'
    bid = prior[0]['id'] if prior else uid('branch')
    expected['branches'].append({'id': bid, **roster['branch'], 'is_default': False})
    prefix = f'Nguồn: {roster["source"]}, trang 1.'
    teachers = sorted({c['teacher'] for c in roster['classes']})
    for name in teachers:
        expected['profiles'].append({'id': uid('teacher|' + name), 'name': name,
            'role': 'teacher', 'branch_id': bid,
            'note': f'{prefix}\nTên giáo viên giữ theo PDF; chưa xác minh họ tên đầy đủ; chưa liên kết tài khoản.\n[{TAG}:teacher:{name}]'})
    parents = {}
    students = []
    for c in roster['classes']:
        cid = uid('class|' + c['name'])
        tid = uid('teacher|' + c['teacher'])
        note = f'{prefix}\nGiáo viên trong file: {c["teacher"]}.'
        if c.get('format'):
            note += f'\nHình thức: {c["format"]}.'
        if not c['weekdays']:
            note += '\nFile chưa ghi ngày/giờ học; chưa tạo lịch tuần.'
        note += '\nFile không ghi ngày khai giảng; ngày vào lớp là ngày import 05/10/2026.'
        expected['classes'].append({'id': cid, 'name': c['name'], 'branch_id': bid,
            'teacher_id': tid, 'status': 'active', 'start_date': None,
            'notes': note + f'\n[{TAG}:class:{c["name"]}]'})
        expected['class_teachers'].append({'class_id': cid, 'teacher_id': tid, 'role': 'main'})
        for weekday in c['weekdays']:
            expected['class_schedules'].append({'id': uid(f'schedule|{c["name"]}|{weekday}'),
                'class_id': cid, 'weekday': weekday, 'start_time': c['start_time'],
                'end_time': c['end_time'], 'teacher_id': tid, 'room_id': None})
        for number, s in enumerate(c['students'], 1):
            sid = uid(f'student|{c["name"]}|{number}')
            p = phone(s['raw_parent_phone'])
            note = f'{prefix}\nLớp {c["name"]}, STT {number}.'
            note += f'\nSĐT phụ huynh gốc trong PDF: {s["raw_parent_phone"]}.' if p else '\nPDF chưa có số điện thoại phụ huynh.'
            expected['profiles'].append({'id': sid, 'name': s['name'], 'role': 'student',
                'branch_id': bid, 'phone': None, 'study_status': 'studying',
                'enrolled_at': None, 'note': note + f'\n[{TAG}:student:{c["name"]}:{number}]'})
            expected['class_students'].append({'class_id': cid, 'student_id': sid,
                                               'status': 'active', 'joined_at': '2026-10-05'})
            students.append({'id': sid, 'class': c['name'], 'name': s['name'], 'parent_phone': p})
            if p:
                parents.setdefault(p, []).append(s['name'])
                expected['parent_students'].append({'parent_id': uid('parent|' + p),
                                                   'student_id': sid, 'relationship': 'guardian'})
    for p, names in parents.items():
        expected['profiles'].append({'id': uid('parent|' + p),
            'name': 'Phụ huynh ' + ' / '.join(names), 'role': 'parent', 'branch_id': bid,
            'phone': p, 'note': f'{prefix}\nPDF không ghi tên phụ huynh; tên hiển thị theo học viên.\n[{TAG}:parent:{p}]'})
    assert len(students) == 15 and len({s['name'] for s in students}) == 15
    assert len(parents) == 10 and len(expected['parent_students']) == 13
    assert len(expected['classes']) == 6 and len(expected['class_schedules']) == 9
    return expected, students


def preflight(before, expected):
    missing = {}
    for table, rows in expected.items():
        existing = {identity(table, r): r for r in before[table]}
        assert len({identity(table, r) for r in rows}) == len(rows), f'Duplicate expected {table}'
        missing[table] = []
        for row in rows:
            old = existing.get(identity(table, row))
            if old:
                assert all(old[k] == v for k, v in row.items()), f'Existing {table} row differs; review required'
            else:
                # Prevent duplicate names, phones or schedules with unrelated IDs.
                if table == 'profiles':
                    conflicts = [r for r in before[table] if r['branch_id'] == row['branch_id']
                        and r['role'] == row['role'] and (r['name'].casefold() == row['name'].casefold()
                        or (row.get('phone') and r['phone'] and phone(r['phone']) == row['phone']))]
                    assert not conflicts, 'Existing profile needs explicit mapping'
                if table == 'classes':
                    assert not any(r['branch_id'] == row['branch_id'] and r['name'] == row['name']
                                   for r in before[table]), 'Existing class needs explicit mapping'
                if table == 'class_schedules':
                    assert not any(r['class_id'] == row['class_id'] and r['weekday'] == row['weekday']
                                   for r in before[table]), 'Existing schedule needs review'
                missing[table].append(row)
    return missing


def main():
    parser = argparse.ArgumentParser()
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument('--apply', action='store_true')
    modes.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    roster = json.loads((BASE / 'roster.json').read_text())
    source_text = subprocess.check_output(['pdftotext', '-layout', str(SOURCE), '-'], text=True)
    for c in roster['classes']:
        assert c['name'] in source_text and c['teacher'] in source_text
        for s in c['students']:
            assert s['name'] in source_text
            assert s['raw_parent_phone'] is None or s['raw_parent_phone'] in source_text
    db = Database()
    before = snapshot(db)
    expected, students = build(roster, before)
    missing = preflight(before, expected)
    report = {'branch': roster['branch'], 'source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
              'roster_sha256': hashlib.sha256((BASE / 'roster.json').read_bytes()).hexdigest(),
              'class_counts': {c['name']: len(c['students']) for c in roster['classes']},
              'students': len(students), 'parent_phone_links': len(expected['parent_students']),
              'unique_parent_phones': 10, 'weekly_schedules': 9,
              'missing_parent_phones': [s['name'] for s in students if not s['parent_phone']],
              'missing_class_schedules': ['PREKIDS01001'],
              'new_rows': {t: len(rows) for t, rows in missing.items()}}
    if args.apply:
        work = BASE / 'work'
        work.mkdir(exist_ok=True)
        backup = work / ('before-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.json')
        backup.write_text(json.dumps(before, ensure_ascii=False, indent=2) + '\n')
        for table in TABLES:
            if missing[table]:
                # PostgREST requires identical column sets within each bulk insert.
                groups = defaultdict(list)
                for row in missing[table]:
                    groups[tuple(sorted(row))].append(row)
                for rows in groups.values():
                    db.request(table, {'on_conflict': ','.join(KEYS.get(table, ('id',)))},
                               data=rows, prefer='resolution=ignore-duplicates,return=minimal')
                print(f'Imported {table}: {len(missing[table])}', flush=True)
        after = snapshot(db)
        rerun = preflight(after, expected)
        assert not any(rerun.values()), 'Incomplete import'
        for table in TABLES:
            targets = {identity(table, r) for r in expected[table]}
            untouched_before = [r for r in before[table] if identity(table, r) not in targets]
            untouched_after = [r for r in after[table] if identity(table, r) not in targets]
            assert untouched_before == untouched_after, f'Unexpected unrelated changes: {table}'
        report.update({'verified_at': datetime.now(timezone.utc).isoformat(),
                       'unrelated_rows_unchanged': True, 'rerun_new_rows': 0,
                       'assigned_student_codes': len([p for p in after['profiles']
                           if p['id'] in {s['id'] for s in students} and p['student_code']])})
        assert report['assigned_student_codes'] == 15, 'Missing student codes'
        (BASE / 'import-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    if args.verify:
        assert not any(missing.values()), 'Incomplete import'
        print('Verified all imported fields, class memberships, parent links and schedules; rerun adds 0.')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
