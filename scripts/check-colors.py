"""Check contrast of text and interactive boundaries in both local UI palettes."""
import re
from pathlib import Path
s=(Path(__file__).resolve().parents[1]/'extension/ui.css').read_text(encoding='utf-8')
def palette(block):return dict(re.findall(r'--([\w-]+):\s*(#[0-9a-fA-F]{6})(?=[;\s])',block))
def lum(c):
 rgb=[int(c[i:i+2],16)/255 for i in (1,3,5)]
 rgb=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
 return sum(v*w for v,w in zip(rgb,[.2126,.7152,.0722]))
def ratio(a,b):
 a,b=sorted([lum(a),lum(b)]);return (b+.05)/(a+.05)
palettes={'light':palette(s.split(':root {',1)[1].split('}',1)[0]),'dark':palette(s.split(':root[data-theme=dark] {',1)[1].split('}',1)[0])}
checks=[]
for mode,p in palettes.items():
 for fg,bg in [('ink','paper'),('ink','card'),('ink','input'),('muted','paper'),('muted','card'),('muted','raised'),('muted','input'),('green','card'),('on-green','green'),('on-green','green-hover'),('on-soft','soft'),('rust','card'),('on-error','error-bg')]:
  result=ratio(p[fg],p[bg]);assert result>=4.5,(mode,fg,bg,result);checks.append({'mode':mode,'foreground':fg,'background':bg,'contrast':round(result,2)})
 for bg in ['card','input','raised']:
  result=ratio(p['outline'],p[bg]);assert result>=3,(mode,'outline',bg,result)
print('Passed 26 text contrast pairs (>=4.5:1), plus 6 form-control boundary pairs (>=3:1).')
