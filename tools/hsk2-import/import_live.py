"""Plan/apply/verify HSK 2, with full preflight, backup and resumable inserts.

Uses only the shared REST transport from HSK 1, not its import assumptions.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
import subprocess
import uuid

BASE = Path(__file__).resolve().parent
REPO = BASE.parent.parent
sys.path.insert(0, str(BASE.parent/'hsk1-import'))
from import_live import Database, chunks, fetch_answers, key

PAYLOAD = REPO/'supabase/library/hsk2-new30-baitap.json'
TAG = 'hsk2-pdf-worksheets'


def paged(db, table, query):
    result=[]
    for offset in range(0,100000,250):
        batch=db.request(table,{**query,'limit':'250','offset':str(offset)})
        result.extend(batch)
        if len(batch)<250:return result
    raise RuntimeError('Unexpectedly large result; pagination guard reached.')


def identity(q):
    s=q['content'].get('source')
    if not s:return None
    return (q['lesson_id'],s['unit'],s['section'],tuple(s['numbers']))


def main():
    parser=argparse.ArgumentParser()
    mode=parser.add_mutually_exclusive_group()
    mode.add_argument('--apply',action='store_true')
    mode.add_argument('--verify',action='store_true')
    parser.add_argument('--supported-only',action='store_true',help='Import only existing types while 0051 is pending')
    args=parser.parse_args()
    subprocess.run(['node',str(BASE/'validate-payload.cjs')],cwd=REPO,check=True)
    payload=json.loads(PAYLOAD.read_text())
    assert payload['textbook']['code']=='hsk2-new30'
    assert {l['unit'] for l in payload['lessons']}==set(range(1,16))
    db=Database()
    tb=db.request('textbooks',{'select':'*','code':'eq.hsk2-new30'})
    assert len(tb)==1
    tb=tb[0]
    lessons=paged(db,'lessons',{'select':'*','textbook_id':'eq.'+tb['id'],'order':'unit,id'})
    by_unit={l['unit']:l for l in lessons}
    assert len(lessons)==len(by_unit)==15
    assert tb['level']=='HSK2'
    lesson_ids=[by_unit[l['unit']]['id'] for l in payload['lessons']]
    query={'select':'*','lesson_id':'in.('+','.join(lesson_ids)+')','order':'id'}
    existing=paged(db,'questions',query)
    active=[q for q in existing if not q['is_test_snapshot']]
    by_key={}
    by_source={}
    for q in active:
        k=key(q)
        assert k not in by_key,'Duplicate active content; review before writing.'
        by_key[k]=q
        i=identity(q)
        if i and TAG in (q.get('tags') or []):
            assert i not in by_source,'Duplicate worksheet source identity.'
            by_source[i]=q
    expected=[]
    deferred=[]
    for l in payload['lessons']:
        lesson=by_unit[l['unit']]
        assert lesson['title']==l['title'],'Lesson title changed; regenerate payload before writing.'
        for q in l['questions']:
            if args.supported_only and q['type'] in ('essay','sentence_correction'):
                deferred.append(q);continue
            row={'lesson_id':lesson['id'],'type':q['type'],'content':q['content']}
            prior=by_key.get(key(row))
            source_prior=by_source.get(identity(row))
            assert source_prior is None or key(source_prior)==key(row),f'Edited source item: {identity(row)}'
            qid=prior['id'] if prior else str(uuid.uuid5(uuid.NAMESPACE_URL,'classhub-hsk2-pdf|'+key(row)))
            expected.append({'id':qid,**row,'level':tb['level'],'tags':[tb['code'],TAG],
                'created_by':tb['created_by'],'is_test_snapshot':False,'answer':q['answer']})
    assert len({q['id'] for q in expected})==len(expected)
    # Check deterministic IDs even if an earlier row was detached from the lesson.
    current=[]
    for group in chunks([q['id'] for q in expected],100):
        current.extend(db.request('questions',{'select':'*','id':'in.('+','.join(group)+')','limit':'250'}))
    current_by_id={q['id']:q for q in current}
    answers=fetch_answers(db,[q['id'] for q in expected])
    answer_by_id={q['question_id']:q['answer'] for q in answers}
    for q in expected:
        old=current_by_id.get(q['id'])
        if old:
            assert key(old)==key(q) and not old['is_test_snapshot'],f'ID/content conflict: {q["id"]}'
            assert old['level']==tb['level'] and TAG in old['tags'],'Existing question level/tags differ.'
        if q['id'] in answer_by_id:
            assert answer_by_id[q['id']]==q['answer'],f'Edited answer: {q["id"]}'
    plan=[{'unit':l['unit'],'records':sum(q['content']['source']['unit']==l['unit'] for q in expected),
        'new':sum(q['content']['source']['unit']==l['unit'] and q['id'] not in current_by_id for q in expected)} for l in payload['lessons']]
    pending=json.loads((BASE/'pending.json').read_text())
    report={'textbook_id':tb['id'],'textbook_code':tb['code'],'payload_sha256':hashlib.sha256(PAYLOAD.read_bytes()).hexdigest(),
        'mode':'apply' if args.apply else 'verify' if args.verify else 'plan','supported_only':args.supported_only,
        'lessons':plan,'expected_records':len(expected),'new_records':sum(p['new'] for p in plan),
        'missing_answers':sum(q['id'] not in answer_by_id for q in expected),'deferred_until_0051':len(deferred),
        'pending_source_items':len(pending),'types':dict(Counter(q['type'] for q in expected))}
    if not args.verify:
        timestamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        backup={'textbook':tb,'lessons':lessons,'questions':existing,
                'answers':fetch_answers(db,[q['id'] for q in existing]) if existing else []}
        backup_path=BASE/'work'/f'before-{timestamp}.json'
        backup_path.write_text(json.dumps(backup,ensure_ascii=False,indent=2)+'\n')
        (BASE/'work'/'import-plan.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
        report['backup']=str(backup_path.relative_to(REPO))
    if args.apply:
        if not args.supported_only:
            sentinel=db.request('rpc/grade_question_answer',data={'qtype':'essay','content':{},'expected':['Mẫu'],'actual':'Tự viết'})
            assert sentinel==[{'total':0,'correct':0}], 'Apply migration 0051 before importing essay/correction types.'
            sentinel=db.request('rpc/grade_question_answer',data={'qtype':'sentence_correction','content':{},'expected':['你好'],'actual':'你 好!'})
            assert sentinel==[{'total':1,'correct':1}], 'Apply migration 0051 before importing correction types.'
        for group in chunks(expected,50):
            new=[{k:v for k,v in q.items() if k!='answer'} for q in group if q['id'] not in current_by_id]
            if new:db.request('questions',query={'on_conflict':'id'},data=new,prefer='resolution=ignore-duplicates,return=minimal')
            missing=[{'question_id':q['id'],'answer':q['answer']} for q in group if q['id'] not in answer_by_id]
            if missing:db.request('question_answers',query={'on_conflict':'question_id'},data=missing,prefer='resolution=ignore-duplicates,return=minimal')
            print(f'Processed {len(group)} questions and answers.',flush=True)
    if args.apply or args.verify:
        actual=paged(db,'questions',query)
        actual_by_id={q['id']:q for q in actual}
        actual_answers={q['question_id']:q['answer'] for q in fetch_answers(db,[q['id'] for q in expected])}
        for q in expected:
            assert q['id'] in actual_by_id,f'Missing question: {q["id"]}'
            old=actual_by_id[q['id']]
            assert key(old)==key(q) and old['is_test_snapshot'] is False
            assert old['level']==q['level'] and TAG in old['tags']
            assert actual_answers.get(q['id'])==q['answer'],f'Answer mismatch: {q["id"]}'
        assert db.request('textbooks',{'select':'*','id':'eq.'+tb['id']})[0]==tb
        assert paged(db,'lessons',{'select':'*','textbook_id':'eq.'+tb['id'],'order':'unit,id'})==lessons
        assert len([q for q in actual if not q['is_test_snapshot'] and TAG in q['tags']])==len(expected),'Unexpected additional worksheet rows.'
        report.update({'verified_at':datetime.now(timezone.utc).isoformat(),'verified_questions':len(expected),
            'verified_answers':len(actual_answers),'metadata_unchanged':True,'rerun_new_records':0,'rerun_missing_answers':0})
        (BASE/'import-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
        print(f'VERIFIED {len(expected)} questions/answers; metadata unchanged; rerun adds 0.')
    else:print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
