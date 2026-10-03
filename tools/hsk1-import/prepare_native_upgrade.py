"""Prepare a transactional SQL migration from the verified legacy import.

No network or database writes. Existing referenced questions become snapshots;
their IDs/content/answers stay usable by previous assignments and templates.
"""
import json
import uuid
from pathlib import Path

from import_live import key

BASE = Path(__file__).resolve().parent
REPO = BASE.parent.parent


def identity(question):
    source = question['content']['source']
    return source['unit'], source['section'], source['numbers'][0], source.get('part')


def main():
    native = json.loads((REPO / 'supabase/library/hsk1-new30-baitap.json').read_text())
    backups = sorted((BASE / 'work').glob('before-*.json'), reverse=True)
    backup = next(json.loads(p.read_text()) for p in backups if len(json.loads(p.read_text())['questions']) == 584)
    existing = {identity(q): q for q in backup['questions']}
    answers = {a['question_id']: a['answer'] for a in backup['answers']}
    lessons = {l['unit']: l['id'] for l in backup['lessons']}
    changes, unchanged, kept = [], [], set()
    for lesson in native['lessons']:
        for q in lesson['questions']:
            ident = identity(q)
            if q['type'] == 'multi_matching': ident = (*ident[:3], 'pinyin')
            old = existing[ident]
            kept.add(old['id'])
            row = {'lesson_id': lessons[lesson['unit']], 'type': q['type'], 'content': q['content']}
            if old['type'] == q['type'] and old['content'] == q['content'] and answers[old['id']] == q['answer']:
                unchanged.append(old['id'])
                continue
            changes.append({'old_id': old['id'], 'new_id': str(uuid.uuid5(uuid.NAMESPACE_URL, 'classhub-hsk1-pdf|' + key(row))),
                'lesson_id': row['lesson_id'], 'old_type': old['type'], 'old_content': old['content'], 'old_answer': answers[old['id']],
                'new_type': q['type'], 'new_content': q['content'], 'new_answer': q['answer']})
    obsolete = [{'id': q['id'], 'content': q['content'], 'type': q['type'], 'answer': answers[q['id']]}
                for q in backup['questions'] if q['id'] not in kept]
    assert len(kept) == 565 and len(obsolete) == 19
    assert len(changes) + len(unchanged) == 565
    def json_literal(value):
        value = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
        assert '$hsk_upgrade$' not in value
        return '$hsk_upgrade$' + value + '$hsk_upgrade$::jsonb'
    sql = (BASE / 'native-upgrade-template.sql').read_text()
    sql = sql.replace('/*CHANGES_JSON*/', json_literal(changes)).replace('/*OBSOLETE_JSON*/', json_literal(obsolete))
    sql = sql.replace('/*UNCHANGED_JSON*/', json_literal(unchanged))
    path = REPO / 'supabase/migrations/0050_hsk1_native_exercises.sql'
    path.write_text(sql)
    print(f'Prepared {len(changes)} upgrades, {len(unchanged)} unchanged, {len(obsolete)} retired records → 565 native questions.')


if __name__ == '__main__': main()
