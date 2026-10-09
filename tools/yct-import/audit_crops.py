"""Render every asset for visual review, retaining its source section and index."""
from pathlib import Path
import json
from PIL import Image,ImageDraw
BASE=Path(__file__).resolve().parent
assets=json.loads((BASE/'assets.json').read_text());out=BASE/'work/sheets'
for start in range(0,len(assets),80):
 sheet=Image.new('RGB',(1600,1200),'#dddddd');d=ImageDraw.Draw(sheet)
 for j,a in enumerate(assets[start:start+80]):
  im=Image.open(BASE/'work/assets'/Path(a['path']).name);im.thumbnail((150,125));x=(j%10)*160;y=(j//10)*150
  sheet.paste(im,(x+(160-im.width)//2,y+20));d.text((x+2,y+2),f'{start+j} {a["source_section"]}',fill='black')
 sheet.save(out/f'assets-{start}.jpg',quality=93)
print(len(assets),'crop previews')
