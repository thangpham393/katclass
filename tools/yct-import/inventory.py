"""Locate exercises on the scanned pages. OCR is evidence, never an answer key."""
from pathlib import Path
import json
import re
import unicodedata
import hashlib
from PIL import Image, ImageDraw

BASE = Path(__file__).resolve().parent
WORK = BASE/'work'

def plain(text):
    return ''.join(c for c in unicodedata.normalize('NFD',text).lower() if not unicodedata.combining(c)).replace('đ','d')

PATTERNS = [
 ('triple',r'n[o6a][iich ]*.*[ch][iuohr]+.*han.*phi[ce]n.*hinh'),
 ('matching_image',r'n[o6][iich ]*.*[ch][iuohr]+.*han.*hinh'),
 ('matching_text',r'n[o6a][iich ]*.*nghia'),
 ('count',r'em hay.*[de][dem]+m.*vi[eis]t'),
 ('pinyin',r'khoanh tron ph[iy]'),
 ('reorder',r's[ia][pip]*p x[eec]p'),
 ('fill',r'd[iu][eie]*n vao ch'),
 ('reading',r'd[eoc]+c hieu'),
 ('choice',r'ch[o0]n d[aap]'),
 ('true_false',r'd[iuo]ng.*hay sai'),
 ('odd',r'tim va khoanh'),
 ('correct',r'tim va s[iu]ra'),
 ('image_write',r'nhin hinh'),
 ('dialogue',r'hoan thanh h[ipog]+i th'),
 ('write_hanzi',r'vi[eis]t han'),
 ('sentence',r'd[aai]t c[aia]u v'),
 ('oral',r'em luyen noi'),
 ('handwriting',r'on nhanh'),
 ('listen',r'giao vien d[eoc]'),
 ('color',r'.*(?:t[o6]|thp t[o6]).*mau'),
 ('challenge',r'th[iu]r thach'),
 ('personal',r'h[o0]i va tra loi|em tu[o6]i|em.*tu[o6]i|em.*th[iie]et ke'),
 ('extension',r'm[o6i].*r[o0]ng'),
 ('date_write',r'vi[eis]t thang'),
 ('count',r'vi[eis]t thoi gian'),
 ('reading_translate',r'doc doan van'),
 ('challenge',r'hay vi[eis]t mot doan'),
]

def main():
    sources = sorted(next(p for p in Path('/Users/hathang/Downloads').iterdir() if p.is_dir() and 'YCT' in p.name).glob('*.pdf'))
    # These ranges were read from the contents and the lesson opening pages.
    ranges = {
      1:[(6,12,1,1),(14,19,1,2),(21,26,1,3),(28,33,1,4),(35,40,1,5),(42,48,1,6),(50,58,1,7)],
      0:[(6,12,1,8),(14,21,1,9),(23,30,1,10),(32,38,1,11),(40,46,2,1),(48,55,2,2),(57,63,2,3),(65,70,2,4)],
      2:[(6,12,2,5),(14,20,2,6),(22,29,2,7),(31,38,2,8),(40,46,2,9),(48,55,2,10),(57,65,2,11),(67,73,2,12)],
    }
    sections=[]; pages=[];out=WORK/'sections';out.mkdir(exist_ok=True)
    for pdf,source in enumerate(sources):
      sha=hashlib.sha256(source.read_bytes()).hexdigest()
      for file in sorted((WORK/f'pdf-{pdf}').glob('*.json')):
        page=json.loads(file.read_text()); number=page['page']
        scope=next((r for r in ranges[pdf] if r[0]<=number<=r[1]),None)
        if not scope: continue
        rows=sorted([r for r in page['rows'] if .09<r['box'][1]<.93],key=lambda r:(round(r['box'][1]/.008),r['box'][0]))
        heads=[]
        for row in rows:
          text=plain(row['text']); kind=next((kind for kind,pat in PATTERNS if re.search(pat,text)),None)
          if kind: heads.append((row['box'][1],kind,row['text']))
        heads.sort()
        if pdf==0 and number in [57,65]: heads.insert(0,(.20,'triple','Nối chữ Hán với phiên âm và hình ảnh phù hợp'))
        if pdf==2 and number==69: heads.insert(0,(.105,'reading_questions','Trả lời câu hỏi cho đoạn văn trang trước'))
        heads=[h for i,h in enumerate(heads) if i==0 or h[0]-heads[i-1][0]>.02]
        pages.append({'pdf':pdf,'page':number,'level':scope[2],'unit':scope[3],'headings':len(heads)})
        for i,(top,kind,title) in enumerate(heads):
          bottom=heads[i+1][0]-.008 if i+1<len(heads) else .937
          sid=f'{pdf}-{number:03d}-{i+1}'
          contents=[r for r in rows if top-.003<=r['box'][1]<bottom]
          section={'id':sid,'pdf':pdf,'page':number,'level':scope[2],'unit':scope[3],'kind':kind,'heading':title,'box':[.05,max(.09,top-.01),.94,bottom],
            'file':source.name,'sha256':sha,'rows':contents}
          sections.append(section)
          img=Image.open(file.with_suffix('.png'));w,h=img.size
          img.crop((int(.05*w),int(section['box'][1]*h),int(.94*w),int(bottom*h))).save(out/(sid+'.png'))
    (BASE/'inventory.json').write_text(json.dumps({'sources':[{'file':s.name,'sha256':hashlib.sha256(s.read_bytes()).hexdigest()} for s in sources],'pages':pages,'sections':sections},ensure_ascii=False,indent=2)+'\n')
    (WORK/'sections.txt').write_text('\n\n'.join(f'{s["id"]} YCT{s["level"]}/{s["unit"]} {s["kind"]}\n'+' | '.join(r['text'] for r in s['rows']) for s in sections))
    print('Exercise pages',len(pages),'sections',len(sections))
    from collections import Counter
    print(dict(Counter(s['kind'] for s in sections)))
    print('Pages without headings',[(p['pdf'],p['page']) for p in pages if not p['headings']])

if __name__=='__main__':main()
