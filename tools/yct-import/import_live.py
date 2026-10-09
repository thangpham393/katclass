"""Plan, upload, apply and verify YCT; immutable assets and resumable staged writes."""
import argparse, json, hashlib, uuid, subprocess, sys, time, urllib.request, urllib.error, urllib.parse
from pathlib import Path
from datetime import datetime,timezone
from concurrent.futures import ThreadPoolExecutor
BASE=Path(__file__).resolve().parent;REPO=BASE.parent.parent
sys.path.insert(0,str(BASE.parent/'hsk1-import'))
from import_live import Database as BaseDatabase,fetch_answers,chunks,key
TAG='yct-pdf-workbooks'

class Database(BaseDatabase):
 def request(self,table,query=None,data=None,prefer=None):
  for attempt in range(4):
   try:return super().request(table,query,data,prefer)
   except (urllib.error.URLError,TimeoutError):
    if attempt==3 or (data is not None and table!='rpc/grade_question_answer' and not (query or {}).get('on_conflict')):raise
    time.sleep(attempt+1)

def open_retry(request):
 for attempt in range(4):
  try:return urllib.request.urlopen(request,timeout=60)
  except urllib.error.HTTPError:raise
  except (urllib.error.URLError,TimeoutError):
   if attempt==3:raise
   time.sleep(attempt+1)

def paged(db,table,query):
 out=[]
 for offset in range(0,100000,250):
  batch=db.request(table,{**query,'limit':'250','offset':str(offset)});out+=batch
  if len(batch)<250:return out
 raise RuntimeError('Pagination limit reached')
def dump(path,val):path.write_text(json.dumps(val,ensure_ascii=False,indent=2)+'\n')
def source_key(lesson_id,source):return json.dumps([lesson_id,source['sha256'],source['section'],source['numbers']],ensure_ascii=False,separators=(',',':'))
def without_crop_urls(value):
 if isinstance(value,dict):return {k:('WORKBOOK_CROP_URL' if k=='url' and isinstance(v,str) and '/storage/v1/object/public/workbook-images/yct/' in v else without_crop_urls(v)) for k,v in value.items()}
 if isinstance(value,list):return [without_crop_urls(v) for v in value]
 return value
def raw(db,path,method='GET',data=None,headers=None):
 base=db.endpoint.split('/rest/v1/')[0]
 req=urllib.request.Request(base+path,method=method,data=data,headers={'apikey':db.secret,'Authorization':'Bearer '+db.secret,**(headers or {})})
 try:
  with open_retry(req) as resp:return resp.read(),dict(resp.headers)
 except urllib.error.HTTPError as e:
  if e.code==404:return None,{}
  if e.code==400 and method=='GET' and path.startswith('/storage/v1/'):
   try:error=json.loads(e.read())
   except (ValueError,UnicodeDecodeError):error={}
   if str(error.get('statusCode'))=='404' or error.get('message')=='Object not found':return None,{}
  raise RuntimeError(f'{method} request failed: HTTP {e.code} ({path.split("?")[0]})') from None

def main():
 ap=argparse.ArgumentParser();mode=ap.add_mutually_exclusive_group();mode.add_argument('--apply',action='store_true');mode.add_argument('--verify',action='store_true');ap.add_argument('--assets-only',action='store_true');ap.add_argument('--grade-only',action='store_true');ap.add_argument('--refresh-crops',action='store_true');args=ap.parse_args()
 subprocess.run(['node',str(BASE/'validate-payload.cjs')],cwd=REPO,check=True)
 path=REPO/'supabase/library/yct-workbooks.json';payload=json.loads(path.read_text());assets=json.loads((BASE/'assets.json').read_text());db=Database()
 books=paged(db,'textbooks',{'select':'*','code':'like.yct*','order':'id'});bookmap={b['code']:b for b in books}
 lessonids=[l['lesson_id'] for l in payload['lessons']];all_lessons=paged(db,'lessons',{'select':'*','textbook_id':'in.('+','.join(b['id'] for b in books)+')','order':'id'})
 lessons={l['id']:l for l in all_lessons};scope='in.('+','.join(lessonids)+')'
 vocab=paged(db,'lesson_vocab',{'select':'*','lesson_id':scope,'order':'lesson_id,vocab_id'})
 vocabids=sorted(set(v['vocab_id'] for v in vocab));vocab_items=[]
 for group in chunks(vocabids):vocab_items+=paged(db,'vocab_items',{'select':'*','id':'in.('+','.join(group)+')','order':'id'})
 metadata={'textbooks':books,'lessons':all_lessons,'lesson_vocab':vocab,'vocab_items':vocab_items}
 query={'select':'*','lesson_id':scope,'order':'id'};current=paged(db,'questions',query);byid={q['id']:q for q in current};expected=[];refresh=[];pinned=json.loads((BASE/'question-ids.json').read_text())
 existing_sources={}
 for q in current:
  if TAG in (q.get('tags') or []):
   s=q['content']['source'];ident=(q['lesson_id'],s['sha256'],s['section'],tuple(s['numbers']));assert ident not in existing_sources,'Duplicate source';existing_sources[ident]=q
 for l in payload['lessons']:
  lesson=lessons[l['lesson_id']];book=bookmap[l['textbook_code']];assert lesson['title']==l['title'] and lesson['unit']==l['unit'] and lesson['textbook_id']==book['id'] and book['level']==l['level'],'Lesson metadata changed'
  for q in l['questions']:
   row={'lesson_id':lesson['id'],'type':q['type'],'content':q['content']};s=q['content']['source'];qid=pinned[source_key(lesson['id'],s)];ident=(lesson['id'],s['sha256'],s['section'],tuple(s['numbers']));prior=existing_sources.get(ident)
   if prior:
    assert prior['id']==qid,'Existing source ID differs'
    if key(prior)!=key(row):
     assert args.refresh_crops and prior['type']==q['type'] and without_crop_urls(prior['content'])==without_crop_urls(q['content']),'Existing source differs; stop for review'
     refresh.append({'id':qid,'content':q['content']})
   expected.append({'id':qid,**row,'level':book['level'],'tags':[book['code'],TAG],'created_by':book['created_by'],'is_test_snapshot':False,'answer':q['answer']})
 answerbyid={a['question_id']:a['answer'] for a in fetch_answers(db,[q['id'] for q in current])}
 for q in expected:
  if q['id'] in byid:assert (key(byid[q['id']])==key(q) or any(r['id']==q['id'] for r in refresh)) and byid[q['id']]['level']==q['level'],'Existing content differs'
  if q['id'] in answerbyid:assert answerbyid[q['id']]==q['answer'],'Existing answer differs'
 new=[q for q in expected if q['id'] not in byid];missing=[{'question_id':q['id'],'answer':q['answer']} for q in expected if q['id'] not in answerbyid]
 report={'mode':'apply' if args.apply else 'verify' if args.verify else 'plan','payload_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'records':len(expected),'new_records':len(new),'missing_answers':len(missing),'refreshed_crops':len(refresh),'assets':len(assets),'lessons':[{'level':l['level'],'unit':l['unit'],'title':l['title'],'records':len(l['questions'])} for l in payload['lessons']]}
 if not args.verify:
  backup=BASE/'work'/('before-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.json');dump(backup,{**metadata,'questions':current,'answers':fetch_answers(db,[q['id'] for q in current],'*')});report['backup']=str(backup.relative_to(REPO));dump(BASE/'work/import-plan.json',report)
 if args.grade_only:
  def check_grade(q):
   value=q['answer'][0] if q['type'] in ['translation','sentence_correction','essay'] else q['answer']
   total=0 if q['type']=='essay' else len(q['content']['items']) if q['type']=='reading' else len(q['answer']) if q['type'] in ['matching','multi_matching'] else 1
   for actual,correct in [(value,total),(None,0)]:
    result=db.request('rpc/grade_question_answer',data={'qtype':q['type'],'content':q['content'],'expected':q['answer'],'actual':actual})
    assert result==[{'total':total,'correct':correct}],(q['content']['source'],result)
   return q['id']
  checked=[]
  with ThreadPoolExecutor(max_workers=8) as pool:
   for qid in pool.map(check_grade,expected,buffersize=16):
    checked.append(qid)
    if len(checked)%100==0:print('Verified grading',len(checked),'/',len(expected),flush=True)
  dump(BASE/'grading-report.json',{'payload_sha256':report['payload_sha256'],'verified_models':len(checked),'empty_answers_rejected':len(checked),'manual_records':sum(q['type']=='essay' for q in expected),'verified_at':datetime.now(timezone.utc).isoformat()});print('GRADING VERIFIED',len(checked));return
 if not args.apply and not args.verify:
  dump(BASE/'rerun-plan.json',report);print('PLAN',len(expected),'records;',len(new),'new;',len(missing),'missing answers;',len(assets),'assets');return
 if args.apply:
  # Check the deployed grading function before uploading or adding any question.
  samples={q['type']:q for q in expected}
  for typ,q in samples.items():
   graded=db.request('rpc/grade_question_answer',data={'qtype':typ,'content':q['content'],'expected':q['answer'],'actual':q['answer'][0] if typ in ['translation','sentence_correction','essay'] else q['answer']})
   assert graded and (graded[0]['total']==0 if typ=='essay' else graded[0]['total']>0 and graded[0]['total']==graded[0]['correct']),(typ,graded)
  bucket,_=raw(db,'/storage/v1/bucket/workbook-images')
  if bucket is None:
   raw(db,'/storage/v1/bucket','POST',json.dumps({'id':'workbook-images','name':'workbook-images','public':True,'file_size_limit':2000000,'allowed_mime_types':['image/webp','image/png','image/jpeg']}).encode(),{'Content-Type':'application/json'})
  else:assert json.loads(bucket)['public'] is True,'Existing asset bucket is private; do not change its permissions'
 def asset(a):
  uri='/storage/v1/object/workbook-images/'+a['path'];blob,_=raw(db,uri)
  if blob is None and args.apply:
   local=(BASE/'work/assets'/Path(a['path']).name).read_bytes();assert hashlib.sha256(local).hexdigest()==a['sha256']
   raw(db,uri,'POST',local,{'Content-Type':'image/webp','Cache-Control':'public, max-age=31536000','x-upsert':'false'});blob,_=raw(db,uri)
  assert blob is not None and hashlib.sha256(blob).hexdigest()==a['sha256'],'Asset readback mismatch: '+a['path']
  # Check anonymous student access as well as service-role access.
  with open_retry(db.endpoint.split('/rest/v1/')[0]+'/storage/v1/object/public/workbook-images/'+a['path']) as response:public=response.read()
  assert hashlib.sha256(public).hexdigest()==a['sha256']
  return a['path']
 verified=[]
 with ThreadPoolExecutor(max_workers=8) as pool:
  for p in pool.map(asset,assets,buffersize=16):
   verified.append(p)
   if len(verified)%80==0:print('Verified assets',len(verified),'/',len(assets),flush=True)
 report['verified_assets']=len(verified)
 if args.assets_only:dump(BASE/'work/asset-upload-report.json',report);print('Assets verified',len(verified));return
 if args.apply:
  # Assets are verified before replacing any illustration URL. IDs, text,
  # source, choices, answers and lesson associations were compared above.
  for q in refresh:raw(db,'/rest/v1/questions?'+urllib.parse.urlencode({'id':'eq.'+q['id']}),'PATCH',json.dumps({'content':q['content']},ensure_ascii=False).encode(),{'Content-Type':'application/json','Prefer':'return=minimal'})
  # Stage new questions until their private answer rows have all been verified.
  for batch in chunks(new,50):db.request('questions',{'on_conflict':'id'},[{k:v for k,v in q.items() if k!='answer'}|{'is_test_snapshot':True} for q in batch],'resolution=ignore-duplicates,return=minimal')
  for batch in chunks(missing,50):db.request('question_answers',{'on_conflict':'question_id'},batch,'resolution=ignore-duplicates,return=minimal')
  answers={a['question_id']:a['answer'] for a in fetch_answers(db,[q['id'] for q in expected])}
  assert all(answers.get(q['id'])==q['answer'] for q in expected),'Staged answer verification failed'
  for batch in chunks([q['id'] for q in expected],50):
   raw(db,'/rest/v1/questions?'+urllib.parse.urlencode({'id':'in.('+','.join(batch)+')'}),'PATCH',json.dumps({'is_test_snapshot':False}).encode(),{'Content-Type':'application/json','Prefer':'return=minimal'})
 actual=paged(db,'questions',query);actualbyid={q['id']:q for q in actual};answers={a['question_id']:a['answer'] for a in fetch_answers(db,[q['id'] for q in expected])}
 for q in expected:
  old=actualbyid.get(q['id']);assert old and key(old)==key(q) and old['is_test_snapshot'] is False and old['level']==q['level'] and old['tags']==q['tags'];assert answers.get(q['id'])==q['answer']
 assert len([q for q in actual if TAG in (q.get('tags') or [])])==len(expected),'Unexpected source records'
 assert paged(db,'textbooks',{'select':'*','code':'like.yct*','order':'id'})==books
 assert paged(db,'lessons',{'select':'*','textbook_id':'in.('+','.join(b['id'] for b in books)+')','order':'id'})==all_lessons
 assert paged(db,'lesson_vocab',{'select':'*','lesson_id':scope,'order':'lesson_id,vocab_id'})==vocab
 for batch in chunks(vocab_items):
  actualv=paged(db,'vocab_items',{'select':'*','id':'in.('+','.join(v['id'] for v in batch)+')','order':'id'});assert actualv==batch
 report.update({'verified_questions':len(expected),'verified_answers':len(answers),'metadata_and_vocab_unchanged':True,'verified_at':datetime.now(timezone.utc).isoformat(),'rerun_new_records':0,'rerun_missing_answers':0})
 dump(BASE/('verification-report.json' if args.verify else 'crop-refresh-report.json' if refresh else 'import-report.json'),report);print('VERIFIED',len(expected),'questions and answers; assets',len(verified),'metadata/vocab unchanged')
if __name__=='__main__':main()
