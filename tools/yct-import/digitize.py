"""Build native YCT questions and content-addressed, traceable illustration crops.

Scans and OCR are local evidence. Answers are reviewed.py, never OCR guesses.
"""
from pathlib import Path
from collections import Counter, defaultdict
import hashlib, json, re, random, unicodedata
from PIL import Image, ImageChops
import reviewed as R

BASE=Path(__file__).resolve().parent; REPO=BASE.parent.parent; WORK=BASE/'work'
INV=json.loads((BASE/'inventory.json').read_text()); META=json.loads((WORK/'live-metadata.json').read_text())
BOOKS={int(x['textbook']['code'][3]):x for x in META}
URL=next(l.split('=',1)[1].strip().strip('\"\'') for l in (REPO/'.env.local').read_text().splitlines() if l.startswith('NEXT_PUBLIC_SUPABASE_URL='))
ASSETS={}; COVER=[]; PENDING=[]; CORRECTIONS=[]; QUESTIONS=defaultdict(list)
PAGE_CACHE={}

def dump(path,value): path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
def cleaned(t):return re.sub(r'[\s\d.．：:、。！？?!，,（）()A-Za-z]','',t)
def page(s):
 k=(s['pdf'],s['page'])
 if k not in PAGE_CACHE:PAGE_CACHE[k]=Image.open(WORK/f'pdf-{k[0]}'/f'{k[1]:03d}.png').convert('RGB')
 return PAGE_CACHE[k]
def crop(s,box,label,trim=True):
 im=page(s);w,h=im.size;x0,y0,x1,y1=box
 assert 0<=x0<x1<=1 and 0<=y0<y1<=1,(s['id'],box)
 px=(round(x0*w),round(y0*h),round(x1*w),round(y1*h));out=im.crop(px)
 # Ignore the pale watermark and retain a generous margin around ink/artwork.
 if trim:
  r,g,b=out.split();mask=ImageChops.darker(ImageChops.darker(r,g),b).point(lambda p:255 if p<215 else 0)
  bounds=mask.getbbox()
  if bounds:
   a,b,c,d=bounds;pad=12
   bounds=(max(0,a-pad),max(0,b-pad),min(out.width,c+pad),min(out.height,d+pad));out=out.crop(bounds)
   px=(px[0]+bounds[0],px[1]+bounds[1],px[0]+bounds[2],px[1]+bounds[3])
 assert out.width>20 and out.height>20,(s['id'],label,out.size)
 folder=WORK/'assets';folder.mkdir(exist_ok=True)
 import io
 buf=io.BytesIO();out.save(buf,format='WEBP',quality=94,method=6);raw=buf.getvalue();sha=hashlib.sha256(raw).hexdigest()
 local=folder/(sha+'.webp');local.write_bytes(raw)
 path=f'yct/{s["sha256"][:16]}/{sha}.webp'
 record={'path':path,'sha256':sha,'bytes':len(raw),'width':out.width,'height':out.height,'source_section':s['id'],'pdf':s['pdf'],'page':s['page'],'source_box_pixels':list(px),'role':label}
 ASSETS.setdefault(path,record)
 return {'url':URL.rstrip('/')+'/storage/v1/object/public/workbook-images/'+path,'alt':label}
def source(s,nums):return {k:s[k] for k in ['file','sha256','page','unit']}|{'section':s['id'],'numbers':nums,'format':s['kind']}
def add(s,typ,content,answer,nums=None):
 content={'pinyin_mode':'auto',**content,'source':source(s,nums or [1])}
 q={'type':typ,'content':content,'answer':answer};QUESTIONS[(s['level'],s['unit'])].append(q);return q
def hold(s,nums,reason):PENDING.append({'source':source(s,nums),'reason':reason,'printed_text':[r['text'] for r in s['rows']]})
def corr(s,before,after,reason):CORRECTIONS.append({'source':source(s,[1]),'before':before,'after':after,'reason':reason})
def letters(vals,targets):return {str(i):chr(97+vals.index(t)) for i,t in enumerate(targets)}
def centers(s,words,leftmax=.38):
 matches=[]
 for i,word in enumerate(words):
  rows=[r for r in s['rows'] if r['box'][0]<leftmax and cleaned(r['text'])==word]
  if rows:
   r=rows[0];matches.append((i,r['box'][1]+r['box'][3]/2))
 if len(matches)>=2:
  n=len(matches);mx=sum(x for x,y in matches)/n;my=sum(y for x,y in matches)/n
  slope=sum((x-mx)*(y-my) for x,y in matches)/sum((x-mx)**2 for x,y in matches);intercept=my-slope*mx
  return [dict(matches).get(i,intercept+slope*i) for i in range(len(words))]
 top=s['box'][1]+.067;bottom=s['box'][3]-.045
 return [top+(bottom-top)*i/max(1,len(words)-1) for i in range(len(words))]
def ink_groups(s,x0,x1,top,bottom,n):
 im=page(s);w,h=im.size;left=round(x0*w);up=round(top*h)
 strip=im.crop((left,up,round(x1*w),round(bottom*h)));r,g,b=strip.split();mask=ImageChops.darker(ImageChops.darker(r,g),b).point(lambda p:255 if p<200 else 0)
 # Connected rows of ink. Merge the smallest gaps until each illustration has
 # one group; this preserves detached heads/hands and complete clock rims.
 counts=[mask.crop((0,y,mask.width,y+1)).histogram()[255] for y in range(mask.height)];runs=[];on=None;last=None
 for y,c in enumerate(counts):
  if c>=3:
   if on is None:on=y
   elif last is not None and y-last>2:runs.append([on,last+1]);on=y
   last=y
 if on is not None:runs.append([on,last+1])
 runs=[a for a in runs if a[1]-a[0]>=3]
 while len(runs)>n:
  i=min(range(len(runs)-1),key=lambda i:runs[i+1][0]-runs[i][1]);runs[i:i+2]=[[runs[i][0],runs[i+1][1]]]
 assert len(runs)==n,(s['id'],'ink groups',n,runs,top,bottom)
 return [(max(top,(up+a-12)/h,(up+(runs[i-1][1]+a)/2)/h if i else top),
   min(bottom,(up+b+12)/h,(up+(b+runs[i+1][0])/2)/h if i+1<len(runs) else bottom)) for i,(a,b) in enumerate(runs)]
def heading_bottom(s):
 heads=[r for r in s['rows'] if r['box'][1]<s['box'][1]+.085 and len(re.findall('[A-Za-z]',r['text']))>18]
 return max([r['box'][1]+r['box'][3] for r in heads]+[s['box'][1]+.03])+.01
def blue_grid_line(im,y):
 run=0
 for r,g,b in im.crop((round(im.width*.065),y,round(im.width*.94),y+1)).get_flattened_data():
  run=run+1 if r<110 and b>r+45 and b>g+25 else 0
  if run>70:return True
 return False
def vertical(s,words,x0=.63,x1=.94):
 if (s['pdf'],s['page'])==(0,14):x1=.96
 if (s['pdf'],s['page'])==(2,61):x0=.74
 if (s['pdf'],s['page'])==(2,70):
  # The sleeping child, coins and doctor's head touch in the source scan.
  ranges=[(82,194),(211,305),(336,438),(441,558),(571,682),(705,812),(812,907),(907,1027),(1070,1173),(1200,1324)]
  return [crop(s,(x0,s['box'][1]+a/1684,x1,s['box'][1]+b/1684),f'Tranh {i+1}') for i,(a,b) in enumerate(ranges)]
 top=.212 if (s['pdf'],s['page'])==(2,61) else heading_bottom(s)-.01
 groups=[(.268,.343),(.35,.437),(.441,.525),(.532,.621),(.621,.709)] if (s['pdf'],s['page'])==(2,22) else ink_groups(s,x0,x1,top,min(.914,s['box'][3]+.015),len(words))
 return [crop(s,(x0,a,x1,b),f'Tranh {i+1}') for i,(a,b) in enumerate(groups)]
def horizontal(s,n,top=None,bottom=None,x0=.065,x1=.94):
 top=top if top is not None else s['box'][1]+(s['box'][3]-s['box'][1])*.43
 bottom=bottom if bottom is not None else s['box'][3]-.015
 im=page(s);w,h=im.size;left=round(x0*w);right=round(x1*w)
 strip=im.crop((left,round(top*h),right,round(bottom*h)));r,g,b=strip.split()
 mask=ImageChops.darker(ImageChops.darker(r,g),b).point(lambda p:255 if p<165 else 0)
 counts=[mask.crop((x,0,x+1,mask.height)).histogram()[255] for x in range(mask.width)];runs=[];start=None;last=None
 for x,count in enumerate(counts):
  if count>=3:
   if start is None:start=x
   elif last is not None and x-last>2:runs.append([start,last+1]);start=x
   last=x
 if start is not None:runs.append([start,last+1])
 while len(runs)>n:
  i=min(range(len(runs)-1),key=lambda i:runs[i+1][0]-runs[i][1]);runs[i:i+2]=[[runs[i][0],runs[i+1][1]]]
 assert len(runs)==n,(s['id'],'picture columns',n,runs)
 edges=[x0]+[(left+(runs[i][1]+runs[i+1][0])/2)/w for i in range(n-1)]+[x1]
 return [crop(s,(edges[i],top,edges[i+1],bottom),f'Tranh {i+1}') for i in range(n)]
def body(s,label='Hình bài tập',top=None):return crop(s,(.04,top or heading_bottom(s),.96,min(.895,s['box'][3]+.004)),label,False)
def grid(s,n,cols,top=None,bottom=None):
 top=top if top is not None else s['box'][1]+.15;bottom=bottom or min(.89,s['box'][3]-.01)
 if (s['pdf'],s['page'])==(0,19):
  # The OCR caption intrudes into the first row and the mother's dress extends
  # below the other pictures. Exclude the decorative footer star under the cake.
  bounds=[(.725,.812) if i<5 else (.81,.915 if i==8 else .897) for i in range(n)]
  return [crop(s,(.115+.775*(i%cols)/cols,a,.115+.775*((i%cols)+1)/cols,b),f'Tranh {i+1}') for i,(a,b) in enumerate(bounds)]
 rows=(n+cols-1)//cols;x0,x1=(.115,.89) if (s['pdf'],s['page'])==(0,19) else (.07,.94);groups=ink_groups(s,x0,x1,top,bottom,rows)
 result=[]
 for row,(up,down) in enumerate(groups):
  if (s['pdf'],s['page'])==(1,54) and row==1:
   # The footer star lies between the chicken and parrot; keep it out of both.
   rects=[(.155,up,.26,.895),(.36,up,.45,.895),(.56,up,.675,.903),(.76,up,.875,.903)]
   result += [crop(s,box,f'Tranh {i+1}') for i,box in enumerate(rects)]
  else:result+=horizontal(s,min(cols,n-row*cols),up,down,x0,x1)
 return result
def chinese_rows(s):
 return [r['text'].strip() for r in s['rows'] if re.search('[\u4e00-\u9fff]',r['text']) and not re.search('教育|育学|澎育|灣',r['text'])]

# pinyin is compared after removing syllable spaces, preserving tones.
VOC={}
for level in [1,2,3,4]:
 for lesson in BOOKS[level]['lessons']:
  pass
for p in sorted((REPO/'supabase/library').glob('*.json'),key=lambda p:(0 if p.name.startswith('yct') else 1,p.name)):
 try:
  data=json.loads(p.read_text())
  for l in data.get('lessons',[]):
   for v in l.get('vocab',[]):
    if v.get('hanzi') and v.get('pinyin'):VOC.setdefault(v['hanzi'],v['pinyin'])
 except (ValueError,AttributeError):pass
# Local exports use vocabulary as well as vocab.
for p in sorted((REPO/'supabase/library').glob('yct*-standard.json')):
 data=json.loads(p.read_text())
 for l in data['lessons']:
  for v in l.get('vocabulary',[]):
   if v.get('hanzi') and v.get('pinyin'):VOC[v['hanzi']]=v['pinyin']

def normpin(t):return re.sub(r'[\s_·]','',unicodedata.normalize('NFC',t)).lower()

def main():
 for s in INV['sections']:
  k=(s['pdf'],s['page']);kind=s['kind'];before=len(QUESTIONS[(s['level'],s['unit'])]);held=len(PENDING)
  if kind=='extension':
   COVER.append({'section':s['id'],'status':'reference','reason':'Từ vựng mở rộng; không phải câu hỏi có đáp án.'});continue
  if kind=='triple':
   if k not in R.TRIPLES:hold(s,list(range(1,6)),'Các cột chữ Hán, phiên âm và hình ảnh bị sao chép lệch; chưa đủ căn cứ khôi phục.');continue
   left,pins,pictures=R.TRIPLES[k];left=left.split();pins=pins.split('|');pictures=pictures.split();imgs=vertical(s,left,x0=.69)
   keys=letters(pictures,left);mapping={}
   for i,w in enumerate(left):
    canonical=VOC.get(w)
    candidates=[j for j,p in enumerate(pins) if canonical and normpin(p)==normpin(canonical)]
    if len(candidates)!=1:
     # Explicit compound words are absent in beginner vocabulary exports.
     known={'三':'sān','七':'qī','六':'liù','四':'sì','九':'jiǔ','五':'wǔ','五点':'wǔdiǎn','四点':'sìdiǎn','九点半':'jiǔdiǎnbàn','两点':'liǎngdiǎn','八点':'bādiǎn','星期四':'xīngqīsì','星期五':'xīngqīwǔ','星期六':'xīngqīliù','多大':'duōdà','画儿':'huàr'}
     candidates=[j for j,p in enumerate(pins) if normpin(p)==normpin(known.get(w,''))]
    assert len(candidates)==1,(s['id'],w,canonical,pins)
    mapping[f'{i}:0']=chr(97+candidates[0]);mapping[f'{i}:1']=keys[str(i)]
   add(s,'multi_matching',{'prompt':'Nối chữ Hán với phiên âm và hình ảnh phù hợp.','left':left,'pinyin_mode':'hidden','columns':[{'label':'Phiên âm','options':pins},{'label':'Hình ảnh','options':[f'Tranh {i+1}' for i in range(len(imgs))],'images':imgs}]},mapping,list(range(1,len(left)+1)))
   if k in [(2,48),(2,70)]:corr(s,'Phiên âm không có từ tương ứng trong cột chữ Hán',pins,'Khôi phục phiên âm duy nhất bị thiếu theo chữ Hán và tranh.');
  elif kind=='matching_image':
   left,pics,layout=R.PICTURE_MATCH[k];left=left.split();pics=pics.split()
   if layout=='v':imgs=vertical(s,left)
   else:
    up,down=ink_groups(s,.065,.96,heading_bottom(s),min(.895,s['box'][3]-.006),2)[0 if layout=='t' else -1]
    imgs=horizontal(s,len(pics),top=up,bottom=down)
   add(s,'matching',{'prompt':'Nối chữ Hán với hình ảnh phù hợp.','left':left,'right':[f'Tranh {i+1}' for i in range(len(pics))],'right_images':imgs},letters(pics,left),list(range(1,len(left)+1)))
  elif kind=='matching_text':
   if k==(2,67):
    left='牛奶 起床 水果 学习 钱 颜色 对不起 朋友 厨师 汉语'.split();pwords='朋友 汉语 颜色 钱 学习 对不起 起床 厨师 水果 牛奶'.split();pins='péngyou Hànyǔ yánsè qián xuéxí duìbuqǐ qǐchuáng chúshī shuǐguǒ niúnǎi'.split();meanings=['Xin lỗi','Trái cây','Sữa bò','Thức dậy','Tiếng Trung','Bạn bè','Học tập','Tiền','Màu sắc','Đầu bếp'];vwords='对不起 水果 牛奶 起床 汉语 朋友 学习 钱 颜色 厨师'.split()
    a={f'{i}:{c}':chr(97+words.index(w)) for i,w in enumerate(left) for c,words in enumerate([pwords,vwords])}
    add(s,'multi_matching',{'prompt':'Nối chữ Hán với phiên âm và nghĩa tiếng Việt.','left':left,'columns':[{'label':'Phiên âm','options':pins},{'label':'Nghĩa','options':meanings}],'pinyin_mode':'hidden'},a,list(range(1,11)));corr(s,'Xin lỗi (lặp), thiếu nghĩa 厨师','Đầu bếp','Nghĩa duy nhất thiếu trong cột; thay mục sao chép trùng.')
   else:
    left,right,keys=R.TEXT_MATCH[k];left=left.split('|') if '|' in left else left.split();add(s,'matching',{'prompt':'Nối chữ Hán với nghĩa tiếng Việt phù hợp.','left':left,'right':right.split('|')},{str(i):a for i,a in enumerate(keys)},list(range(1,len(left)+1)))
    if k in [(2,6),(2,14),(2,48)]:corr(s,'Nghĩa tiếng Việt bị sao chép lệch hoặc chưa đúng',right,'Đối chiếu nghĩa với chữ Hán; giữ cặp từ tương ứng duy nhất.')
  elif kind=='pinyin':
   for i,line in enumerate(R.PINYIN[k].split(';'),1):
    han,options,key=line.split('|')
    if key=='?':hold(s,[i],'Có hai lựa chọn phiên âm in giống nhau; không có đáp án duy nhất.');continue
    add(s,'pinyin_choice',{'prompt':'Chọn phiên âm đúng.','hanzi':han,'options':[t.replace('_',' ') for t in options.split()],'pinyin_mode':'hidden'},key,[i])
   if k==(0,34):corr(s,'Chữ Hán 面条 và 喝 đặt nhầm hàng','喝 ở hàng 3; 面条 ở hàng 4','Các lựa chọn phiên âm bị đổi hàng; khôi phục chữ Hán tương ứng.')
  elif kind=='reorder':
   if k not in R.REORDER:
    sentences=['我喜欢吃妈妈做的饭，也喜欢爸爸买的牛奶。','我每天六点起床。','我学习汉语两年了，可以用汉语说话。','我是王刚，是小学生。','七点半我去学校学习汉语。','六点半我和爸爸运动十五分钟。','七点和爸爸妈妈吃早饭。']
    add(s,'essay',{'prompt':'Sắp xếp các câu thành đoạn văn hoàn chỉnh. Giáo viên chấp nhận các thứ tự hợp lý.','tokens':sentences,'response_mode':'ordering'},['Giới thiệu nhân vật trước (câu 4); các hoạt động buổi sáng theo thứ tự 2 → 6 → 7 → 5. Câu 1 và 3 đặt ở vị trí nối ý hợp lý. Một thứ tự tham khảo: 4, 2, 6, 7, 5, 3, 1.']);COVER.append({'section':s['id'],'status':'reviewed','records':1,'pending_records':0});continue
   for i,answer in enumerate(R.REORDER[k],1):
    if answer is None:hold(s,[i],'Các khối chữ trong nguồn thiếu hoặc dư từ; không tạo được câu chắc chắn.');continue
    tokens=answer.split('/'); shuffled=tokens[:];random.Random(s['id']+str(i)).shuffle(shuffled)
    if shuffled==tokens:shuffled=shuffled[1:]+shuffled[:1]
    add(s,'reorder',{'prompt':'Sắp xếp các khối chữ thành câu đúng.','tokens':shuffled},tokens,[i])
  elif kind=='fill':
   for i,(prompt,ans) in enumerate(R.FILLS[k],1):
    if (k,i) in [((1,30),2),((1,51),2),((2,24),1)]:hold(s,[i],'Có nhiều từ trong ngân hàng từ điền được; đề thiếu ngữ cảnh phân biệt.');continue
    add(s,'fill_blank',{'prompt':prompt,'hint':'Chọn từ phù hợp: '+R.FILL_BANKS[k]},ans,[i])
  elif kind in ['choice','true_false','odd']:
   if kind=='choice':entries=[line.split('|') for line in R.CHOICES[k].splitlines()]
   elif kind=='true_false':
    texts,keys=R.TRUE_FALSE[k];entries=[[t,'Đúng','Sai',a] for t,a in zip(texts.split('|'),keys)]
   else:
    texts,keys=R.ODD[k];entries=[['Tìm từ khác nhóm.',*t.split(),a.upper()] for t,a in zip(texts.split('|'),keys)]
   for i,row in enumerate(entries,1):
    prompt,*opts,key=row
    if key=='?':hold(s,[i],'Đề không đủ ngữ cảnh hoặc thiếu lựa chọn đúng duy nhất.');continue
    add(s,'multiple_choice',{'prompt':('Xét cách dùng từ và ngữ pháp: '+prompt) if kind=='true_false' else prompt,'options':opts},key.upper(),[i])
   if k==(0,67):corr(s,'你的名字（trong câu nói về chó）','它的名字','Đại từ được đối chiếu với ngữ cảnh con chó.')
  elif kind=='reading':
   passage,lines=R.READINGS[k];items=[];answer={};nums=[]
   for i,line in enumerate(lines.splitlines(),1):
    prompt,*opts,key=line.split('|')
    if key=='?':hold(s,[i],'Bài đọc hỗ trợ hơn một lựa chọn đúng.');continue
    answer[str(len(items))]=key;items.append({'prompt':prompt,'type':'multiple_choice','options':opts});nums.append(i)
   add(s,'reading',{'passage':passage,'items':items},answer,nums)
   if k in [(1,47),(1,56)]:corr(s,'Đại từ/tên người không nhất quán','她 / 王明','Đối chiếu nhân vật và tên trong đoạn đọc.')
  elif kind=='correct':
   for i,(prompt,answers) in enumerate(R.CORRECT,1):add(s,'sentence_correction',{'prompt':prompt,'pinyin_mode':'hidden'},answers,[i])
  elif kind=='image_write':
   words=R.IMAGE_WRITE[k].split();up,down=ink_groups(s,.065,.94,heading_bottom(s),s['box'][3]-.025,2)[0]
   edges={(2,19):[.065,.245,.445,.61,.75,.94],(2,27):[.065,.25,.455,.665,.94],(2,34):[.065,.275,.48,.665,.94]}.get(k,[.065+(.875*i/len(words)) for i in range(len(words)+1)])
   imgs=[crop(s,(edges[i],up,edges[i+1],down),f'Tranh {i+1}') for i in range(len(words))]
   for i,(w,img) in enumerate(zip(words,imgs),1):add(s,'translation',{'prompt':'Nhìn tranh, viết từ bằng chữ Hán.','target_language':'zh','image':img,'pinyin_mode':'hidden'},[w],[i])
  elif kind=='count':
   answers,layout=R.COUNT[k];n=len(answers);height=s['box'][3]-s['box'][1]
   if layout=='v':
    groups=ink_groups(s,.075,.60,.30,.89,n-1);imgs=[None]+[crop(s,(.075,a,.60,b),f'Hình đếm {i+2}') for i,(a,b) in enumerate(groups)]
   else:
    up=heading_bottom(s);im=page(s);w,h=im.size
    # Some kite strings touch the writing grid. Locate its long blue border
    # instead of splitting a connected illustration or cutting the kite tail.
    gridtop=next((y for y in range(round(up*h),round(min(.895,s['box'][3]-.006)*h)) if blue_grid_line(im,y)),None)
    assert gridtop is not None,(s['id'],'count writing-grid boundary')
    down=.792 if k==(0,23) else (gridtop-3)/h
    imgs=horizontal(s,n,top=up,bottom=down)
   for i,(a,img) in enumerate(zip(answers,imgs),1):
    if str(a).startswith('example:'):continue
    if a is None:hold(s,[i],'Hình đếm không rõ để xác nhận số lượng.');continue
    if isinstance(a,str):
     hh,mm=map(int,a.split(':'));hans=['零','一','两','三','四','五','六','七','八','九','十','十一','十二'];han=hans[hh]+'点'+('五十五分' if mm==55 else '五分')
     ans=[a,han];prompt='Viết giờ bằng số (H:MM) và chữ Hán:\n___\n___'
    else:ans=[str(a),['零','一','二','三','四','五','六','七','八','九','十'][a]];prompt='Đếm hình rồi viết chữ số và chữ Hán:\n___\n___'
    add(s,'fill_blank',{'prompt':prompt,'image':img},ans,[i])
  elif kind=='listen':
   if k in R.LISTEN:
    targets,pics,cols=R.LISTEN[k];targets=targets.split();pics=pics.split();
    # Three early pages print the target words under the grid.
    if k in [(1,12),(1,19),(1,25)]:
     labels=[r for r in s['rows'] if re.fullmatch('(?:'+'|'.join(re.escape(w.lstrip('?')) for w in targets)+')+',cleaned(r['text']))];top=heading_bottom(s);bottom=min(r['box'][1] for r in labels)-.03
    else:
     labels=[r for r in s['rows'] if r['box'][1]<s['box'][1]+.2 and re.fullmatch('(?:'+'|'.join(re.escape(w.lstrip('?')) for w in targets)+')+',cleaned(r['text']))]
     top=max([r['box'][1]+r['box'][3] for r in labels]+[s['box'][1]+.12])+.02;bottom=min(.895,s['box'][3]+(.008 if k in [(2,20),(2,62)] else -.006))
     if k==(1,54):bottom=.903
     if k==(2,20):bottom=.493
     if k==(2,62):bottom=.523
    imgs=grid(s,len(pics),cols,top,bottom);left=[];nums=[]
    for i,t in enumerate(targets,1):
     if t.startswith('?'):hold(s,[i],'Hình mục tiêu bị thiếu hoặc trùng; không xác định được hình duy nhất.');continue
     assert pics.count(t)==1,(s['id'],t,pics)
     left.append(t);nums.append(i)
    add(s,'matching',{'prompt':'Nghe từng từ rồi nối với hình tương ứng.','left':left,'left_tts':left,'right':[f'Tranh {i+1}' for i in range(len(pics))],'right_images':imgs,'pinyin_mode':'hidden'},letters(pics,left),nums)
   else:
    if k==(0,37):texts=['我吃苹果。','我吃面条。','这是谁的比萨？','我想吃蛋糕。'];keys='ACBA';cols=4
    elif k==(2,71):texts='香蕉 苹果 学校 医院 眼睛 个子 面条 饺子'.split();keys='ACBCADCD';cols=4
    else:raise AssertionError(('Unreviewed listen',s['id']))
    groups=ink_groups(s,.45,.96,heading_bottom(s),.895,len(texts))
    for i,(t,a,(up,down)) in enumerate(zip(texts,keys,groups),1):
     imgs=horizontal(s,cols,up,down,.45,.96)
     add(s,'listening',{'prompt':'Nghe và chọn hình phù hợp.','tts':t,'options':[f'Tranh {chr(65+j)}' for j in range(cols)],'option_images':imgs,'pinyin_mode':'hidden'},a,[i])
  elif kind=='dialogue' and k in R.DIALOGUE_FILLS:
   for i,(prompt,ans) in enumerate(R.DIALOGUE_FILLS[k],1):add(s,'fill_blank',{'prompt':'Hoàn thành hội thoại:\n'+prompt},ans,[i])
  elif kind=='write_hanzi':
   pins=['Jīntiān xīngqīliù, wǒ shí diǎn qù shāngdiàn.','Míngtiān bā diǎn wǒ bàba qù kàn tā de gēge.','Xiànzài sān diǎn le, lǎoshī zài xuéxiào ma?','Wǒ jiā yǒu sì kǒu rén, bàba jīntiān liù diǎn sānshí fēn huíjiā.'];answers=['今天星期六，我十点去商店。','明天八点我爸爸去看他的哥哥。','现在三点了，老师在学校吗？','我家有四口人，爸爸今天六点三十分回家。']
   for i,(p,a) in enumerate(zip(pins,answers),1):add(s,'translation',{'prompt':'Viết chữ Hán theo phiên âm:\n'+p,'target_language':'zh','pinyin_mode':'hidden'},[a],[i])
  elif kind=='date_write':
   if s['id']=='0-021-1':COVER.append({'section':s['id'],'status':'heading','reason':'Tiêu đề chung của phần tháng và năm.'});continue
   for i in range(1,13):add(s,'translation',{'prompt':f'Viết tháng {i} bằng chữ Hán.','target_language':'zh'},[['零','一','二','三','四','五','六','七','八','九','十','十一','十二'][i]+'月'],[i])
   for i in range(2023,2027):add(s,'translation',{'prompt':f'Viết năm {i} bằng chữ Hán.','target_language':'zh'},['二零二'+['三','四','五','六'][i-2023]+'年'],[13+i-2023])
  elif kind=='reading_translate':
   passage=''.join(chinese_rows(s));follow=next(x for x in INV['sections'] if x['id']=='2-069-1');prompts='\n'.join(chinese_rows(follow))
   q=add(s,'essay',{'prompt':'Dịch đoạn văn sang tiếng Việt và trả lời 5 câu hỏi bằng tiếng Trung:\n'+prompts,'passage':passage},['Dịch đầy đủ nội dung gia đình, nghề nghiệp, học ngôn ngữ và thời gian sinh hoạt.\n1.九岁。2.医生。3.不是，他们是小学生。4.早上七点。5.李月和弟弟。'],list(range(1,7)))
   q['content']['source']['pages']=[68,69]
  elif kind=='reading_questions':COVER.append({'section':s['id'],'status':'continuation','parent':'2-068-1'});continue
  elif kind in ['oral','handwriting','sentence','dialogue','personal','challenge','color']:
   text='\n'.join(chinese_rows(s));c={};mode='text'
   if kind=='oral':prompt='Luyện nói: nghe/đọc các câu và thực hành trả lời với giáo viên. Nộp bản ghi âm hoặc nội dung em đã nói.';mode='oral';c['passage']=text
   elif kind=='handwriting':prompt='Luyện viết theo mẫu chữ Hán trong hình. Viết trực tiếp hoặc tải ảnh bài viết của em.';mode='drawing';c['image']=body(s,'Mẫu luyện viết chữ Hán')
   elif kind=='color':prompt='Tô màu hình bên dưới rồi nộp bài của em.';mode='drawing';c['image']=body(s,'Hình tô màu')
   elif kind=='sentence':prompt='Đặt một câu tiếng Trung với mỗi từ sau:\n'+text
   elif kind=='dialogue':prompt='Hoàn thành hội thoại. Viết đầy đủ các câu còn thiếu.';c['image']=body(s,'Hội thoại và hình minh họa');c['passage']=text
   elif kind=='personal':prompt='Trả lời câu hỏi theo thông tin của em.\n'+text;c['image']=body(s,'Hình và câu hỏi')
   else:
    instructions={(0,12):'Viết 3–4 câu về việc em cùng bố mẹ đi đâu.',(0,46):'Viết 3–4 câu về một người em quý mến.',(1,12):'Viết 3 từ em nhớ nhất trong bài và một câu chào.',(1,19):'Giới thiệu tên của em và chào người bạn mới.',(1,26):'Giới thiệu người trong hình: người đó là ai, là người nước nào và tình cảm của gia đình em.',(1,33):'Viết 3–4 câu giới thiệu gia đình em.',(1,40):'Viết 3–4 câu giới thiệu một người thân trong gia đình.',(1,48):'Viết 3–4 câu về người hoặc con vật em yêu thích. Gợi ý: 个子、小、大、鼻子、耳朵、眼睛、高、长。',(1,58):'Viết 3–4 câu về con giáp em yêu thích.',(2,20):'Giới thiệu tên em, món em thích và món em không thích.',(2,65):'Viết 3–4 câu về thời gian biểu của em.',(2,69):'Viết 3–4 câu với một số từ: 商店、买、水果、块、钱、东西、贵、牛奶、衣服、漂亮、好吃、好喝、喜欢。'}
    prompt=instructions[k];c['image']=body(s,'Gợi ý của bài') if k in [(1,26)] else None
    if c.get('image') is None:c.pop('image',None)
   c.update({'prompt':prompt,'response_mode':mode})
   nums=[int(n) for t in chinese_rows(s) for n in re.findall(r'^(\d+)[.．]',t)] or [1]
   add(s,'essay',c,['Giáo viên đánh giá mức hoàn thành đề bài; chấp nhận cách diễn đạt phù hợp. Luyện viết: đúng nét và chữ mẫu. Luyện nói: rõ âm, đúng nghĩa. Tô màu: hoàn thành hình.'],sorted(set(nums)))
  else:raise AssertionError(('Unhandled',s['id'],kind))
  COVER.append({'section':s['id'],'status':'reviewed','records':len(QUESTIONS[(s['level'],s['unit'])])-before,'pending_records':len(PENDING)-held})
 lessons=[]
 for (level,unit),qs in sorted(QUESTIONS.items()):
  book=BOOKS[level]['textbook'];ls=[l for l in BOOKS[level]['lessons'] if l['unit']==unit];assert len(ls)==1
  l=ls[0];lessons.append({'textbook_code':book['code'],'level':book['level'],'unit':unit,'lesson_id':l['id'],'title':l['title'],'questions':qs})
 payload={'source':'Scanned YCT workbook PDFs; reviewed native exercises','lessons':lessons};path=REPO/'supabase/library/yct-workbooks.json';dump(path,payload)
 dump(BASE/'assets.json',list(ASSETS.values()));dump(BASE/'pending.json',PENDING);dump(BASE/'corrections.json',CORRECTIONS)
 # Pending-only sections must also appear in the section coverage ledger.
 seen={x['section'] for x in COVER}
 for s in INV['sections']:
  if s['id'] not in seen:
   assert any(p['source']['section']==s['id'] for p in PENDING);COVER.append({'section':s['id'],'status':'pending'})
 manifest={'sources':INV['sources'],'payload_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sections':COVER,'lessons':[{'level':l['level'],'unit':l['unit'],'title':l['title'],'lesson_id':l['lesson_id'],'records':len(l['questions']),'types':dict(Counter(q['type'] for q in l['questions']))} for l in lessons],'asset_count':len(ASSETS),'pending_records':len(PENDING)}
 dump(BASE/'manifest.json',manifest)
 print('Questions',sum(len(l['questions']) for l in lessons),'lessons',len(lessons),'assets',len(ASSETS),'pending',len(PENDING));print(dict(Counter(q['type'] for qs in QUESTIONS.values() for q in qs)))

if __name__=='__main__':main()
