"""Deterministic ZIP: exact allowlist, fixed timestamps/modes, stored bytes."""
from pathlib import Path
import hashlib, json, zipfile, re
root=Path(__file__).resolve().parents[1]
extension=root/'extension'
version=json.loads((extension/'manifest.json').read_text())['version']
files=['manifest.json','core.js','storage.js','legacy-storage.js','record-store.js','crypto.js','background.js','content.js','ui.js','theme.js','ui.css','popup.html','popup.js','workspace.html','workspace.js']+[f'icons/{n}.png' for n in [16,32,48,128]]
actual=sorted(p.relative_to(extension).as_posix() for p in extension.rglob('*') if p.is_file())
assert actual==sorted(files), 'Unexpected extension file. Review the release allowlist.'
out=root/'dist'
out.mkdir(exist_ok=True)
archive=out/f'draft-cairn-{version}.zip'
def deterministic_zip(destination, entries):
    with zipfile.ZipFile(destination,'w',compression=zipfile.ZIP_STORED) as z:
        for name,data in sorted(entries.items()):
            info=zipfile.ZipInfo(name,date_time=(2026,1,1,0,0,0))
            info.create_system=3
            info.external_attr=0o100644<<16
            z.writestr(info,data)

deterministic_zip(archive,{name:(extension/name).read_bytes() for name in files})
kit=out/f'draft-cairn-store-kit-{version}.zip'
kit_files={
    f'extension/{archive.name}':archive.read_bytes(),
    'listing/icon-128.png':(extension/'icons/128.png').read_bytes(),
    'listing/promo-440x280.png':(root/'docs/store/small-promo.png').read_bytes(),
    'listing/screenshot-recovery-1280x800.png':(root/'docs/images/recovery.png').read_bytes(),
    'listing/screenshot-library-1280x800.png':(root/'docs/images/library.png').read_bytes(),
    'listing/screenshot-recovery-dark-1280x800.png':(root/'docs/images/recovery-dark.png').read_bytes(),
    'listing/screenshot-library-dark-1280x800.png':(root/'docs/images/library-dark.png').read_bytes(),
    'listing/reviewer-instructions.txt':(root/'docs/store/reviewer-instructions.txt').read_bytes(),
    'listing/privacy-policy.md':(root/'PRIVACY.md').read_bytes(),
    'SUBMISSION.md':(root/'docs/chrome-web-store.md').read_bytes(),
    'FINAL-MANUAL-CHECKS.md':(root/'docs/store/manual-smoke-test.md').read_text(encoding='utf-8').replace('(../portal-matrix.md)','(PUBLIC-SAMPLE-MATRIX.md)').encode('utf-8'),
    'COMPATIBILITY.md':(root/'docs/compatibility.md').read_text(encoding='utf-8').replace('(portal-matrix.md)','(PUBLIC-SAMPLE-MATRIX.md)').encode('utf-8'),
    'PUBLIC-SAMPLE-MATRIX.md':(root/'docs/portal-matrix.md').read_text(encoding='utf-8').replace('(store/manual-smoke-test.md)','(FINAL-MANUAL-CHECKS.md)').replace('(compatibility.md)','(COMPATIBILITY.md)').encode('utf-8'),
    'START-HERE.txt':(
        f'Draft Cairn {version} Chrome Web Store preparation kit\n\n'
        f'Extract this kit. Upload ONLY extension/{archive.name} as the extension package.\n'
        'Use listing/ assets in the separate listing fields. Do not upload this outer ZIP as an extension.\n\n'
        'Final native Chrome permission and OS clipboard checks are pending. See FINAL-MANUAL-CHECKS.md.\n'
        'The publisher reports an existing live Store listing. Update that existing item; do not create a duplicate.\n'
    ).encode('utf-8')
}
# Keep the matrix linked to the dated evidence actually tested, including on patch releases.
for report in set(re.findall(r'\]\((portal-results-[0-9.]+\.json)\)', (root/'docs/portal-matrix.md').read_text(encoding='utf-8'))):
    kit_files[report]=(root/'docs'/report).read_bytes()
listing=(root/'docs/chrome-web-store.md').read_text(encoding='utf-8').split('## Draft listing\n',1)[1].split('**Suggested category:**',1)[0].strip().replace('**','')
kit_files['listing/listing.txt']=(listing+'\n').encode('utf-8')
deterministic_zip(kit,kit_files)
checks=[]
for deliverable in [archive,kit]:
    checksum=hashlib.sha256(deliverable.read_bytes()).hexdigest()
    checks.append(f'{checksum}  {deliverable.name}\n')
    print(f'{deliverable.name}: {checksum}')
(out/'SHA256SUMS').write_text(''.join(checks),encoding='ascii',newline='\n')
