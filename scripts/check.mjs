import {readFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=new URL('../extension/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
assert.equal(manifest.manifest_version,3);assert.equal(manifest.incognito,'not_allowed');
assert.equal(manifest.host_permissions,undefined);assert.equal(manifest.content_scripts,undefined);
assert.deepEqual(manifest.permissions,['storage','scripting','activeTab','alarms']);
for(const file of await readdir(root)) {
  if(!file.endsWith('.js'))continue;
  const url=new URL(file,root);execFileSync(process.execPath,['--check',url.pathname.replace(/^\/(\w:)/,'$1')]);
  const source=await readFile(url,'utf8');
  assert(!/innerHTML|outerHTML|insertAdjacentHTML|\beval\(|console\.|\bfetch\(|XMLHttpRequest/.test(source),`Unsafe sink or outbound API in ${file}`);
}
for(const p of Object.values(manifest.icons))await readFile(new URL(p,root));
for(const p of ['background.js','popup.html','workspace.html','content.js','core.js'])await readFile(new URL(p,root));
console.log('Manifest, syntax, safe rendering, packaged paths, and no outbound API checks passed.');
