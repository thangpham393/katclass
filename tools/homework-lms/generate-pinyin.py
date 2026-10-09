"""Build pronunciation support from the checked-in textbook vocabulary, without answer keys."""
import json
from pathlib import Path
values = {}
conflicts = {}
for filename in sorted(Path('supabase/library').glob('*hsk*.json')):
    data = json.loads(filename.read_text())
    for lesson in data.get('lessons', []):
        for item in lesson.get('vocab', []):
            hanzi, pinyin = item.get('hanzi', ''), item.get('pinyin', '')
            if not hanzi or not pinyin:
                continue
            if hanzi in values and values[hanzi].lower().replace(' ', '') != pinyin.lower().replace(' ', ''):
                conflicts.setdefault(hanzi, set()).update([values[hanzi], pinyin])
            else:
                values[hanzi] = pinyin
# Polyphonic entries need per-question pronunciation overrides, not a guessed global reading.
for hanzi in conflicts:
    values.pop(hanzi, None)
Path('src/lib/hsk-pinyin.json').write_text(json.dumps(dict(sorted(values.items())), ensure_ascii=False, indent=2) + '\n')
print(f'Pronunciation dictionary: {len(values)} entries; {len(conflicts)} conflicting entries omitted')
