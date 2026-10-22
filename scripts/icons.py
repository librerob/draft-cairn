"""Draw the project's original cairn mark using only the Python standard library."""
from pathlib import Path
import struct,zlib
root=Path(__file__).resolve().parents[1]/'extension'/'icons'
root.mkdir(parents=True,exist_ok=True)
def chunk(kind,data):
    return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)
for size in [16,32,48,128]:
    scale=4
    pixels=bytearray()
    for y in range(size):
        row=bytearray([0])
        for x in range(size):
            total=[0,0,0,0]
            for sy in range(scale):
                for sx in range(scale):
                    u=(x+(sx+.5)/scale)/size;v=(y+(sy+.5)/scale)/size
                    color=(22,79,64,255)
                    if ((u-.5)/.22)**2+((v-.29)/.09)**2<1 or ((u-.5)/.30)**2+((v-.49)/.095)**2<1 or ((u-.5)/.37)**2+((v-.70)/.10)**2<1:color=(235,236,209,255)
                    if (u<.14 and v<.14 and (u-.14)**2+(v-.14)**2>.14**2) or (u>.86 and v<.14 and (u-.86)**2+(v-.14)**2>.14**2) or (u<.14 and v>.86 and (u-.14)**2+(v-.86)**2>.14**2) or (u>.86 and v>.86 and (u-.86)**2+(v-.86)**2>.14**2):color=(0,0,0,0)
                    total=[a+b for a,b in zip(total,color)]
            row.extend(round(c/(scale*scale)) for c in total)
        pixels.extend(row)
    png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!IIBBBBB',size,size,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(pixels,9))+chunk(b'IEND',b'')
    (root/f'{size}.png').write_bytes(png)
print('Generated original cairn icons (16, 32, 48, 128).')
