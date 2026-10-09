"""Read the current YCT textbooks and lessons without exposing credentials."""
import json
from pathlib import Path
import sys

BASE = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE.parent / 'hsk1-import'))
from import_live import Database

def paged(db, table, query):
    rows = []
    for offset in range(0, 100000, 250):
        batch = db.request(table, {**query, 'limit':'250', 'offset':str(offset)})
        rows.extend(batch)
        if len(batch) < 250:
            return rows
    raise RuntimeError('Pagination guard reached')

if __name__ == '__main__':
    db = Database()
    books = db.request('textbooks', {'select':'*','code':'like.yct*','order':'code'})
    result = []
    for book in books:
        lessons = paged(db,'lessons',{'select':'*','textbook_id':'eq.'+book['id'],'order':'unit,id'})
        result.append({'textbook':book,'lessons':lessons})
        print(book['code'], book['level'], [(l['unit'],l['title']) for l in lessons])
    (BASE/'work').mkdir(exist_ok=True)
    (BASE/'work/live-metadata.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
