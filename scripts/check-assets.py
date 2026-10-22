"""Validate store image dimensions and the generated icon's transparent margins."""
from pathlib import Path
import struct,zlib
root=Path(__file__).resolve().parents[1]
def dimensions(p):
    b=p.read_bytes()
    assert b[:8]==b'\x89PNG\r\n\x1a\n', f'Not a PNG: {p.name}'
    return struct.unpack('!II',b[16:24])
for name,expected in {
    'extension/icons/16.png':(16,16),'extension/icons/32.png':(32,32),
    'extension/icons/48.png':(48,48),'extension/icons/128.png':(128,128),
    'docs/store/icon-512.png':(512,512),'docs/store/small-promo.png':(440,280),
    'docs/images/recovery.png':(1280,800),'docs/images/library.png':(1280,800)
}.items():
    assert dimensions(root/name)==expected, f'Incorrect dimensions: {name}'
b=(root/'extension/icons/128.png').read_bytes()
assert b[24:26]==bytes([8,6]), 'Store icon must be an 8-bit RGBA PNG'
offset=8; packed=b''
while offset<len(b):
    size=struct.unpack('!I',b[offset:offset+4])[0]
    if b[offset+4:offset+8]==b'IDAT':packed+=b[offset+8:offset+8+size]
    offset+=size+12
raw=zlib.decompress(packed);points=[]
for y in range(128):
    row=raw[y*513:(y+1)*513]
    assert row[0]==0, 'Expected the icon generator\'s unfiltered scanlines'
    points.extend((x,y) for x in range(128) if row[1+x*4+3])
assert (min(x for x,y in points),min(y for x,y in points),max(x for x,y in points),max(y for x,y in points))==(16,16,111,111), 'Store artwork must occupy a 96x96 box inside transparent 16px margins'
print('Store PNG dimensions, alpha channel, and 96px icon artwork / 16px margins passed.')
