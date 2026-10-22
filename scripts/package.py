"""Deterministic ZIP: exact allowlist, fixed timestamps/modes, stored bytes."""
from pathlib import Path
import hashlib, json, zipfile
root=Path(__file__).resolve().parents[1]
extension=root/'extension'
version=json.loads((extension/'manifest.json').read_text())['version']
files=['manifest.json','core.js','background.js','content.js','ui.js','ui.css','popup.html','popup.js','workspace.html','workspace.js']+[f'icons/{n}.png' for n in [16,32,48,128]]
actual=sorted(p.relative_to(extension).as_posix() for p in extension.rglob('*') if p.is_file())
assert actual==sorted(files), 'Unexpected extension file. Review the release allowlist.'
out=root/'dist'
out.mkdir(exist_ok=True)
archive=out/f'draft-cairn-{version}.zip'
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_STORED) as z:
    for name in sorted(files):
        info=zipfile.ZipInfo(name,date_time=(2026,1,1,0,0,0))
        info.create_system=3
        info.external_attr=0o100644<<16
        z.writestr(info,(extension/name).read_bytes())
checksum=hashlib.sha256(archive.read_bytes()).hexdigest()
(out/'SHA256SUMS').write_text(f'{checksum}  {archive.name}\n',encoding='ascii')
print(f'{archive.name}: {checksum}')
