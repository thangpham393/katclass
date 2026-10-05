"""Read live metadata and schema without exposing credentials."""
import sys
import json
from pathlib import Path

BASE = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE.parent / 'hsk1-import'))
from import_live import Database

db = Database()
tb = db.request('textbooks', {'select': '*', 'code': 'eq.hsk2-new30'})
assert len(tb) == 1
lessons = db.request('lessons', {'select': '*', 'textbook_id': 'eq.' + tb[0]['id'], 'order': 'unit'})
schema = db.request('')
(BASE / 'work').mkdir(exist_ok=True)
(BASE / 'work/live-metadata.json').write_text(json.dumps({'textbook': tb[0], 'lessons': lessons}, ensure_ascii=False, indent=2))
(BASE / 'work/live-schema.json').write_text(json.dumps(schema, ensure_ascii=False, indent=2))
print('Textbook:', tb[0]['code'], tb[0]['id'], tb[0]['level'])
print('Lessons:', [(l['unit'], l['title']) for l in lessons])
print('Question type schema:', schema.get('definitions', {}).get('questions', {}).get('properties', {}).get('type'))
print('RPCs:', [p for p in schema.get('paths', {}) if any(s in p for s in ['submit_homework', 'normalize', 'score'])])
