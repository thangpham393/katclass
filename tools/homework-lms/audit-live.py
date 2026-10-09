"""Read-only structural audit; reports aggregate counts, never names/answers/credentials."""
import sys, json
from pathlib import Path
from collections import Counter
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'hsk1-import'))
from import_live import Database

db=Database()
tbs=db.request('textbooks', {'select':'id,code,level','limit':'1000'})
lessons=db.request('lessons', {'select':'id,textbook_id,unit','limit':'1000'})
by_lesson={l['id']:l for l in lessons}
by_tb={t['id']:t for t in tbs}
counts={}
for offset in range(0,100000,250):
    rows=db.request('questions', {'select':'id,type,lesson_id,content,is_test_snapshot','order':'id','offset':str(offset),'limit':'250'})
    for q in rows:
        tb=by_tb.get(by_lesson.get(q['lesson_id'],{}).get('textbook_id'),{})
        if not str(tb.get('level','')).startswith('HSK') or q['is_test_snapshot']: continue
        code=tb['code'];c=q['content']; stats=counts.setdefault(code,Counter())
        stats['questions']+=1; stats['with_source']+=bool(c.get('source')); stats['with_source_numbers']+=bool(c.get('source',{}).get('numbers')); stats['with_pinyin_dictionary']+=bool(c.get('pinyin'))
        stats[q['type']]+=1
    if len(rows)<250:break
schema=db.request('')
print(json.dumps({'textbooks':counts,'review_rpc_live':'/rpc/get_homework_review' in schema.get('paths',{}),'review_column_live':'review' in schema.get('definitions',{}).get('submissions',{}).get('properties',{})},ensure_ascii=False,indent=2))
