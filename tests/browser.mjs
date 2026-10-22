// Synthetic data only. No traces, page logs, or HTML dumps are recorded.
import {createRequire} from 'node:module';
import {mkdtemp,cp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const temp=await mkdtemp(path.join(tmpdir(),'draft-cairn-test-'));
const extension=path.join(temp,'extension'), profile=path.join(temp,'profile');
await cp(path.join(root,'extension'),extension,{recursive:true});
// Test-only binding to exercise the shipped storage module from worker evaluation.
// Service workers prohibit dynamic import(); this binding is absent from the ZIP.
const workerFile=path.join(extension,'background.js');
const workerSource=(await readFile(workerFile,'utf8')).replace('const safe = /',"globalThis.testError={name:error.name,frames:String(error.stack).split('\\n').slice(1,4)}; const safe = /");
await writeFile(workerFile,workerSource+'\nimport * as testStore from "./storage.js"; globalThis.testStore=testStore;\nimport * as testLegacy from "./legacy-storage.js"; globalThis.testLegacy=testLegacy;\n');
// Only the temporary test copy has a pre-granted loopback host. The shipping manifest
// keeps all host access optional. The native optional-permission dialog is a manual check.
const manifest=JSON.parse(await readFile(path.join(extension,'manifest.json'),'utf8'));
assert.equal(manifest.host_permissions,undefined);
manifest.host_permissions=['http://127.0.0.1/*'];
await writeFile(path.join(extension,'manifest.json'),JSON.stringify(manifest));
const server=spawn(process.execPath,['scripts/demo.mjs'],{cwd:root,stdio:'ignore'});
const base='http://127.0.0.1:8765';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
for(let n=0;n<50;n++){try{if((await fetch(base)).ok)break;}catch{}await wait(100);}
for(const resource of ['/demo.js','/demo.css','/expired.html'])assert.equal((await fetch(base+resource)).status,200,'Synthetic demo resources must load');
let context;
const opts={headless:true,channel:'chromium',args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],viewport:{width:1280,height:800}};
if(process.env.CHROMIUM_PATH)opts.executablePath=process.env.CHROMIUM_PATH;
const report=[];
const check=(name)=>{report.push(name);console.log('PASS '+name);};
async function launch(){
  context=await chromium.launchPersistentContext(profile,opts);
  const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  // Chrome will not remove a required test-manifest grant. Retain it while exercising
  // the independent exact-origin capture switch. Native permission removal is manual.
  await worker.evaluate(()=>{chrome.permissions.remove=async()=>false;});
  const id=new URL(worker.url()).host;
  const ui=await context.newPage();await ui.goto(`chrome-extension://${id}/workspace.html`);
  await ui.waitForFunction(()=>document.getElementById('summary').textContent.includes('revisions'));
  return {worker,id,ui};
}
async function api(ui,type,rest={}){const result=await ui.evaluate(async({type,rest})=>chrome.runtime.sendMessage({type,...rest}),{type,rest});if(!result.ok)throw new Error(result.error);return result.data;}
async function poll(fn,predicate,timeout=8000){const until=Date.now()+timeout;while(Date.now()<until){const value=await fn();if(predicate(value))return value;await wait(100);}throw new Error('Synthetic scenario timed out');}
const sessions=new WeakMap();
async function names(page){
  if(!sessions.has(page))sessions.set(page,await context.newCDPSession(page));
  return (await sessions.get(page).send('Accessibility.getFullAXTree')).nodes.map(n=>n.name?.value || '');
}
async function waitProtected(page){await poll(()=>names(page),items=>items.some(n=>n.startsWith('Draft Cairn ·')));}
async function clickAccessible(page,predicate) {
  const session=await context.newCDPSession(page),tree=await session.send('Accessibility.getFullAXTree');
  const node=tree.nodes.find(n=>n.role?.value==='button' && predicate(n.name?.value || ''));
  assert(node?.backendDOMNodeId,'Expected an accessible button');
  const {model}=await session.send('DOM.getBoxModel',{backendNodeId:node.backendDOMNodeId});
  const q=model.content;await page.mouse.click((q[0]+q[2]+q[4]+q[6])/4,(q[1]+q[3]+q[5]+q[7])/4);
}

async function paste(page,selector,text,start,end){
  await page.locator(selector).focus();
  await page.locator(selector).evaluate((el,{start,end})=>el.setSelectionRange(start ?? 0,end ?? el.value.length),{start,end});
  await page.evaluate(text=>navigator.clipboard.writeText(text),text);
  await page.keyboard.press(process.platform==='darwin' ? 'Meta+V' : 'Control+V');
}
try {
  let {worker,id,ui}=await launch();
  const page=await context.newPage();await page.goto(base+'/index.html');
  await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:base});
  await page.locator('#summary').fill('Synthetic answer before protection');await wait(450);
  assert.equal((await api(ui,'STATE')).drafts.length,0);check('no capture before explicit site enable');
  const tabId=await ui.evaluate(async()=>{const tabs=await chrome.tabs.query({});return tabs.find(t=>t.url?.startsWith('http://127.0.0.1:8765/index.html')).id;});
  await api(ui,'PRIVACY',{metadata:true});
  await api(ui,'ENABLE',{origin:base,tabId});
  await page.locator('#summary').evaluate(el=>{
    el.value='Synthetic forged input';el.dispatchEvent(new Event('input',{bubbles:true}));
    const data=new DataTransfer();data.setData('text/plain','Synthetic forged paste'.repeat(100));
    el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
  });
  await wait(400);assert.equal((await api(ui,'STATE')).drafts.length,0);
  assert.equal(await page.locator('[data-cairn-ui]').count(),0);check('forged input and paste cannot create drafts; no branded host attribute');
  await page.locator('#summary').fill('Synthetic project answer, saved locally.');
  let state=await poll(()=>api(ui,'STATE'),s=>s.drafts.some(d=>d.text==='Synthetic project answer, saved locally.'));
  const draft=state.drafts.find(d=>d.field.id==='summary');check('typing saves through the real service worker');
  await page.locator('#password').focus();
  await poll(()=>names(page),items=>items.some(n=>n.includes('not protected in this field')));
  await page.evaluate(()=>{const el=document.createElement('div');el.id='rich';el.contentEditable='true';el.setAttribute('role','textbox');el.textContent='Synthetic rich editor';document.body.append(el);el.focus();});
  await poll(()=>names(page),items=>items.some(n=>n.includes('not protected in this field')));
  check('unsupported and rich-text focus visibly says not protected');
  await page.evaluate(()=>{document.getElementById('application').autocomplete='off';});
  await page.locator('#impact').fill('Synthetic autocomplete-off answer');
  await poll(()=>api(ui,'STATE'),s=>s.drafts.some(d=>d.text==='Synthetic autocomplete-off answer'));
  check('inherited autocomplete off permits ordinary narrative capture');
  await page.reload();await waitProtected(page);
  await api(ui,'RESTORE',{id:draft.id,tabId});assert.equal(await page.locator('#summary').inputValue(),draft.text);check('reload and explicit restoration to the original empty field');
  await assert.rejects(api(ui,'RESTORE',{id:draft.id,tabId}));check('nonempty destination is never overwritten');
  await page.getByRole('button',{name:'Simulate session expiry',exact:true}).click();
  await page.getByRole('link',{name:'Return to an empty application',exact:true}).click();
  await waitProtected(page);
  await api(ui,'RESTORE',{id:draft.id,tabId});assert.equal(await page.locator('#summary').inputValue(),draft.text);check('deliberate session-expiry navigation and return recovery');
  await page.locator('textarea[name=detail]').nth(0).fill('Synthetic duplicate one');
  await poll(()=>api(ui,'STATE'),s=>s.drafts.some(d=>d.text==='Synthetic duplicate one'));
  await page.locator('textarea[name=detail]').nth(1).fill('Synthetic duplicate two');
  await poll(()=>api(ui,'STATE'),s=>s.drafts.some(d=>d.text==='Synthetic duplicate two'));
  assert((await api(ui,'STATE')).drafts.some(d=>d.text==='Synthetic duplicate one'));check('similar fields keep separate draft records');
  const ambiguous=(await api(ui,'STATE')).drafts.find(d=>d.text==='Synthetic duplicate one');
  await page.reload();await waitProtected(page);
  await assert.rejects(api(ui,'RESTORE',{id:ambiguous.id,tabId}));assert.equal(await page.locator('textarea[name=detail]').nth(0).inputValue(),'');check('duplicate field identities refuse restoration');
  for(const selector of ['#password','#card','#otp','#private','#short'])await page.locator(selector).fill('Synthetic excluded value');
  await page.evaluate(()=>{
    for(const style of ['display:none','opacity:0','width:0;height:0;padding:0;border:0']) {
      const el=document.createElement('textarea');el.style.cssText=style;document.body.append(el);el.value='Synthetic excluded value';el.dispatchEvent(new Event('input',{bubbles:true}));
    }
  });
  await wait(500);assert(!(await api(ui,'STATE')).drafts.some(d=>d.text==='Synthetic excluded value'));check('password, card, OTP, ignored and short inputs excluded');
  await page.locator('#summary').fill('Synthetic existing');
  const original='Synthetic oversized paste 😀 é '.repeat(30);
  await paste(page,'#summary',original,3,9);
  assert.equal(await page.locator('#summary').inputValue(),'Synthetic existing');
  state=await poll(()=>api(ui,'STATE'),s=>s.drafts.some(d=>d.kind==='paste'&&d.text===original));check('oversized selected-text paste is blocked and full original persisted');
  const pasteCDP=await context.newCDPSession(page);const pasteAX=await pasteCDP.send('Accessibility.getFullAXTree');
  assert(pasteAX.nodes.some(n=>n.role?.value==='dialog'));assert(pasteAX.nodes.some(n=>n.value?.value===original));check('larger editor exposes a labelled dialog and complete original answer to accessibility APIs');
  await page.keyboard.press('Escape');
  // The isolated closed shadow root is deliberately not exposed through page DOM selectors.
  // CDP inspects the accessibility tree, like a screen reader, to verify the dialog and counter.
  await paste(page,'#summary','fits');
  assert.equal(await page.locator('#summary').inputValue(),'fits');check('a fitting trusted paste over a selection is allowed');
  await page.goto(base+'/index.html?token=synthetic#example');await waitProtected(page);
  await page.locator('#impact').fill('Synthetic query-page answer');
  state=await poll(()=>api(ui,'STATE'),s=>s.drafts.some(d=>d.text==='Synthetic query-page answer'));
  assert.equal(state.drafts.find(d=>d.text==='Synthetic query-page answer').restorable,false);
  assert(!JSON.stringify(state).includes('?token=')&&!JSON.stringify(state).includes('#example'));check('query and fragment omitted, query-based pages copy only');
  await api(ui,'SAVE_ANSWER',{answer:{title:'Synthetic approved overview',project:'Northbank',text:'Synthetic reusable answer.'}});
  await api(ui,'SAVE_ANSWER',{answer:{title:'<img src=x onerror=alert(1)>',project:'Synthetic hostile strings',text:'<script>window.hostile=true</script>'}});
  await ui.reload();await ui.getByRole('button',{name:'Answer library',exact:true}).click();
  assert.equal(await ui.locator('#answers img,#answers script').count(),0);assert.equal(await ui.locator('#answers').getByText('<script>window.hostile=true</script>',{exact:true}).count(),1);check('hostile library content rendered as literal text');
  const before=(await api(ui,'STATE')).library.length;
  await assert.rejects(api(ui,'IMPORT',{raw:'{"format":"draft-cairn-library","version":1,"answers":[{"title":"ok","text":"synthetic"},{"title":4}]}'}));
  assert.equal((await api(ui,'STATE')).library.length,before);check('malformed import is atomic');
  await worker.evaluate(()=>{
    globalThis.originalPut=IDBObjectStore.prototype.put;globalThis.indexRejected=false;
    IDBObjectStore.prototype.put=function(value,key){if(this.name==='meta' && key==='index'){globalThis.indexRejected=true;this.transaction.abort();throw new Error('Synthetic transaction failure');}return globalThis.originalPut.call(this,value,key);};
  });
  const beforeFailure=(await api(ui,'STATE')).drafts.map(d=>d.id).sort();
  await page.locator('#impact').fill('Synthetic failed write');await wait(600);
  assert(!(await api(ui,'STATE')).drafts.some(d=>d.text==='Synthetic failed write'));
  const cdp=await context.newCDPSession(page);const ax=await cdp.send('Accessibility.getFullAXTree');
  assert(ax.nodes.some(n=>n.name?.value?.includes('not saved')));
  assert(await worker.evaluate(()=>globalThis.indexRejected));
  assert.deepEqual((await api(ui,'STATE')).drafts.map(d=>d.id).sort(),beforeFailure);
  await worker.evaluate(()=>{IDBObjectStore.prototype.put=globalThis.originalPut;});
  check('aborted record/index transaction preserves earlier data and shows a visible warning');
  await api(ui,'SAVE_ANSWER',{answer:{title:'Synthetic unrelated successful write',text:'Must not hide an earlier failure'}});
  assert((await api(ui,'STATE')).lastError);
  assert.equal(await worker.evaluate(()=>chrome.action.getBadgeText({})),'!');
  await api(ui,'ACK_ERROR');assert.equal((await api(ui,'STATE')).lastError,'');check('unrelated successful writes do not clear earlier failure badges');
  await api(ui,'DISABLE',{origin:base});
  await page.locator('#impact').fill('Synthetic while disabled');await wait(500);
  assert(!(await api(ui,'STATE')).drafts.some(d=>d.text==='Synthetic while disabled'));
  await api(ui,'ENABLE',{origin:base,tabId});await page.locator('#impact').fill('Synthetic after re-enabling');
  await poll(()=>api(ui,'STATE'),s=>s.drafts.some(d=>d.text==='Synthetic after re-enabling'));check('turning protection off and on works in an already-open page');
  // Verify expiry is enforced through reads and deletion survives service-worker storage.
  await worker.evaluate(async()=>{const state=await globalThis.testStore.load();state.drafts.push({id:'expired-synthetic',expires:0,text:'Expired synthetic'});await globalThis.testStore.commit(state);});
  assert(!(await api(ui,'STATE')).drafts.some(d=>d.id==='expired-synthetic'));
  await api(ui,'DELETE_DRAFT',{id:ambiguous.id});assert(!(await api(ui,'STATE')).drafts.some(d=>d.id===ambiguous.id));check('expiry and individual draft deletion');
  const encrypted=await worker.evaluate(async()=>{
    const db=await new Promise(resolve=>{const r=indexedDB.open('cairn-data-v3');r.onsuccess=()=>resolve(r.result);});
    const values=await new Promise(resolve=>{const r=db.transaction('records').objectStore('records').getAll();r.onsuccess=()=>resolve(r.result);});db.close();return JSON.stringify(values);
  });
  assert(!encrypted.includes('Synthetic') && !encrypted.includes(base) && !encrypted.includes('Northbank'));
  check('persistent answer records encrypt text, titles and original origins');
  const cap=await worker.evaluate(async()=>{
    const store=globalThis.testStore, C=globalThis.Cairn;
    const state=await store.load(), template=state.drafts.find(d=>d.kind==='draft');
    state.drafts=Array.from({length:180},(_,i)=>({...template,id:`scale-${i}`,key:`scale-${i}`,text:`Synthetic scale ${i}`+'x'.repeat(30000),saved:Date.now()-100000+i}));
    await store.commit(state);
    const calls=[];globalThis.scalePut=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(value,key){calls.push(new TextEncoder().encode(JSON.stringify(value)).length);return globalThis.scalePut.call(this,value,key);};
    globalThis.scaleCalls=calls;return C.stateBytes(state);
  });
  assert(cap>5*1024*1024);
  const started=Date.now();await page.locator('#impact').fill('Synthetic newest answer after 180 drafts');
  try {
    state=await poll(()=>api(ui,'STATE'),s=>s.drafts.some(d=>d.text==='Synthetic newest answer after 180 drafts'));
  } catch {
    const failed=await api(ui,'STATE');
    const status=(await names(page)).filter(n=>n.startsWith('Draft Cairn ·'));
    const cause=await worker.evaluate(()=>globalThis.testError);
    throw new Error(`Scale capture failed: count=${failed.drafts.length}, error=${failed.lastError}, status=${status[0]}, cause=${JSON.stringify(cause)}`);
  }
  const scale=await worker.evaluate(()=>{IDBObjectStore.prototype.put=globalThis.scalePut;return {writes:globalThis.scaleCalls};});
  assert.equal(state.drafts.length,180);assert(!state.drafts.some(d=>d.id==='scale-0'));assert(state.evicted>0);
  assert(Math.max(...scale.writes)<150000,'Saving one small draft must not rewrite a multi-megabyte dataset');
  console.log(`Scale check: ${cap} plaintext bytes; largest save write ${Math.max(...scale.writes)} bytes; observed ${Date.now()-started} ms including debounce/poll.`);
  check('capture continues at 180 drafts near 6 MB with incremental encrypted writes');
  // Re-registration with unchanged patterns must not unregister/update the script.
  await worker.evaluate(()=>{globalThis.registrationCalls=[];for(const method of ['registerContentScripts','unregisterContentScripts','updateContentScripts']){const original=chrome.scripting[method].bind(chrome.scripting);chrome.scripting[method]=async(...args)=>{globalThis.registrationCalls.push(method);return original(...args);};}});
  await api(ui,'ENABLE',{origin:base,tabId});assert.deepEqual(await worker.evaluate(()=>globalThis.registrationCalls),[]);check('unchanged host patterns leave registered content scripts in place');
  const durable=(await api(ui,'STATE')).library.length;
  const durableDraftIds=(await api(ui,'STATE')).drafts.map(d=>d.id).sort();assert(durableDraftIds.length>0);
  await context.close();({worker,id,ui}=await launch());assert.equal((await api(ui,'STATE')).library.length,durable);
  assert.deepEqual((await api(ui,'STATE')).drafts.map(d=>d.id).sort(),durableDraftIds);check('drafts and library survive a real browser process restart');
  await worker.evaluate(async()=>{
    const state=await globalThis.testStore.load(),template=state.drafts[0],now=Date.now();state.evicted=0;
    state.drafts=[
      {...template,id:'curated-summary',key:'curated-summary',title:'Synthetic workshop application',field:{...template.field,id:'summary',label:'Project summary'},text:'Synthetic demonstration answer: we are planning a community workshop with accessible spaces, practical activities, and time for participants to share their ideas.\n\nThis saved revision is ready to copy back after a page reload.',saved:now-120000},
      {...template,id:'curated-impact',key:'curated-impact',title:'Synthetic workshop application',field:{...template.field,id:'impact',label:'Who will benefit?'},text:'Synthetic demonstration answer: local residents will help choose the workshop topics. We will offer quiet sessions and accessible materials, then review participant feedback before planning the next programme.',saved:now-60000}
    ];await globalThis.testStore.commit(state);
  });
  const hostile=(await api(ui,'STATE')).library.find(a=>a.project==='Synthetic hostile strings');await api(ui,'DELETE_ANSWER',{id:hostile.id});
  await api(ui,'SAVE_ANSWER',{answer:{title:'Workshop accessibility',project:'Northbank',text:'Synthetic approved wording: our workshop offers step-free access, quiet sessions, and materials in accessible formats.'}});
  await ui.reload();await ui.waitForFunction(()=>document.getElementById('summary').textContent.includes('revisions'));
  // Documentation screenshots contain only fixture data and use the unmodified shipped UI.
  const screenshots=path.join(root,'test-results','screenshots');await mkdir(screenshots,{recursive:true});
  await ui.screenshot({path:path.join(screenshots,'recovery.png')});
  await ui.getByRole('button',{name:'Answer library',exact:true}).click();await ui.screenshot({path:path.join(screenshots,'library.png')});
  await ui.setViewportSize({width:390,height:844});assert.equal(await ui.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);check('workspace fits a 390px viewport');
  await api(ui,'DISABLE',{origin:base,erase:true});assert(!(await api(ui,'STATE')).drafts.some(d=>d.origin===base));
  await api(ui,'CLEAR');state=await api(ui,'STATE');assert.equal(state.library.length+state.drafts.length+state.sites.length,0);
  const afterWipe=await worker.evaluate(async()=>{
    const state=await globalThis.testStore.publicState();
    const db=await new Promise(resolve=>{const r=indexedDB.open('cairn-data-v3');r.onsuccess=()=>resolve(r.result);});
    const count=await new Promise(resolve=>{const r=db.transaction('records').objectStore('records').count();r.onsuccess=()=>resolve(r.result);});
    const key=await new Promise(resolve=>{const r=db.transaction('keys').objectStore('keys').get('automatic');r.onsuccess=()=>resolve(r.result);});db.close();return {count,hasKey:!!key};
  });
  assert.deepEqual(afterWipe,{count:0,hasKey:false});check('site erasure and all-data deletion remove ciphertext and local keys');
  await ui.close();
  await worker.evaluate(async()=>{
    await globalThis.testStore.erase();
    const state=globalThis.Cairn.fresh();state.days=7;delete state.metadata;
    state.library=[{id:'legacy-answer',title:'Synthetic legacy title',text:'Synthetic legacy answer',project:'Migration',saved:Date.now()}];
    await chrome.storage.local.set({state});
  });
  await context.close();({worker,id,ui}=await launch());
  assert((await api(ui,'STATE')).library.some(a=>a.id==='legacy-answer'));
  assert.equal((await api(ui,'STATE')).days,7);assert.equal((await api(ui,'STATE')).metadata,true);
  assert(!JSON.stringify(await worker.evaluate(()=>chrome.storage.local.get(null))).includes('Synthetic legacy'));
  check('legacy plaintext migrates atomically while preserving existing retention and metadata choices');
  const keyInfo=await worker.evaluate(async()=>{
    const db=await new Promise(resolve=>{const request=indexedDB.open('cairn-data-v3');request.onsuccess=()=>resolve(request.result);});
    const key=await new Promise(resolve=>{const request=db.transaction('keys').objectStore('keys').get('automatic');request.onsuccess=()=>resolve(request.result);});
    db.close();let rejected=false;try{await crypto.subtle.exportKey('raw',key);}catch{rejected=true;}
    return {extractable:key.extractable,name:key.algorithm.name,length:key.algorithm.length,rejected};
  });
  assert.deepEqual(keyInfo,{extractable:false,name:'AES-GCM',length:256,rejected:true});check('automatic AES-256 key persists as a nonextractable CryptoKey');
  const integrity=await ui.evaluate(async()=>{
    const db=await new Promise(resolve=>{const r=indexedDB.open('cairn-data-v3');r.onsuccess=()=>resolve(r.result);});
    const index=await new Promise(resolve=>{const r=db.transaction('meta').objectStore('meta').get('index');r.onsuccess=()=>resolve(r.result);});
    const ref=index.library[0].ref;
    const original=await new Promise(resolve=>{const r=db.transaction('records').objectStore('records').get(ref);r.onsuccess=()=>resolve(r.result);});
    const bad=structuredClone(original);bad.body.data=(bad.body.data[0]==='A'?'B':'A')+bad.body.data.slice(1);
    async function put(value){await new Promise((resolve,reject)=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').put(value,ref);tx.oncomplete=resolve;tx.onabort=reject;});}
    await put(bad);let rejected=false;try{await (await import('./storage.js?integrity')).load();}catch{rejected=true;}
    const stored=await new Promise(resolve=>{const r=db.transaction('records').objectStore('records').get(ref);r.onsuccess=()=>resolve(r.result);});
    await put(original);db.close();return {rejected,preserved:stored.body.data===bad.body.data};
  });
  assert.deepEqual(integrity,{rejected:true,preserved:true});check('ciphertext tampering fails closed without overwriting damaged data');
  await api(ui,'DISABLE',{origin:base});
  await ui.evaluate(async origin=>chrome.storage.session.set({'enable-closed-popup':{origin,created:Date.now()}}),base);
  // Trigger the same queued handler as permissions.onAdded, with no popup alive.
  await api(ui,'FINISH_ENABLE');assert((await api(ui,'STATE')).sites.includes(base));
  await ui.evaluate(async origin=>chrome.storage.session.set({'enable-expired':{origin:'http://127.0.0.1:9999',created:Date.now()-180000}}),base);
  await api(ui,'FINISH_ENABLE');assert(!(await api(ui,'STATE')).sites.includes('http://127.0.0.1:9999'));
  check('worker completes a pending enable without a popup and rejects expired intent');
  // Begin a clean v0.2 installation for privacy/vault scenarios.
  await api(ui,'CLEAR');state=await api(ui,'STATE');assert.equal(state.days,1);assert.equal(state.metadata,false);
  check('fresh installations default to one-day recovery without page titles or field descriptors');
  let vaultPage=await context.newPage();await vaultPage.goto(base+'/index.html');
  let vaultTab=await ui.evaluate(async()=>{const tabs=await chrome.tabs.query({});return tabs.find(t=>t.url?.startsWith('http://127.0.0.1:8765/index.html')).id;});
  // There can be a pre-existing restored tab: use the actual new tab ID.
  vaultTab=await ui.evaluate(async()=>{const tabs=await chrome.tabs.query({});return tabs.filter(t=>t.url?.startsWith('http://127.0.0.1:8765/index.html')).at(-1).id;});
  await api(ui,'ENABLE',{origin:base,tabId:vaultTab});await waitProtected(vaultPage);
  await vaultPage.locator('#impact').fill('Synthetic private description');
  state=await poll(()=>api(ui,'STATE'),s=>s.drafts.some(d=>d.text==='Synthetic private description'));
  assert.equal(state.drafts[0].title,'');assert.deepEqual(state.drafts[0].field,{label:''});assert.equal(state.drafts[0].restorable,false);
  check('minimal metadata captures are copy-only and omit titles and field descriptors');
  await api(ui,'SAVE_ANSWER',{answer:{title:'Synthetic vault library',text:'Synthetic confidential library answer'}});
  const password='synthetic long vault passphrase',newPassword='synthetic changed vault passphrase';
  await ui.setViewportSize({width:1280,height:800});await ui.reload();await ui.getByRole('button',{name:'Sites & settings',exact:true}).click();
  await ui.getByRole('button',{name:'Enable passphrase vault',exact:true}).click();
  await ui.locator('#passphrase').fill(password);await ui.locator('#confirm-passphrase').fill(password);await ui.locator('#acknowledge').check();
  await ui.locator('#security-submit').click();await poll(()=>api(ui,'STATE'),s=>s.mode==='vault'&&!s.locked);
  assert((await api(ui,'STATE')).library.some(a=>a.text==='Synthetic confidential library answer'));
  check('vault setup through the real UI migrates existing drafts and library answers');
  await ui.getByRole('button',{name:'Answer library',exact:true}).click();await ui.getByRole('button',{name:'Save an answer',exact:true}).click();
  await ui.locator('#answer-text').fill('Synthetic unsaved editor secret');await api(ui,'VAULT_LOCK');
  await poll(()=>ui.locator('#answer-dialog').evaluate(el=>el.open),open=>!open);
  assert.equal(await ui.locator('#answer-text').inputValue(),'');assert.equal(await ui.locator('#answers pre').count(),0);
  state=await api(ui,'STATE');assert(state.locked);assert.equal(state.library.length+state.drafts.length,0);assert.equal(state.libraryCount,1);
  await assert.rejects(api(ui,'VAULT_UNLOCK',{passphrase:'wrong synthetic password'}));assert((await api(ui,'STATE')).locked);
  check('locking scrubs rendered answers and unsaved editors; incorrect passwords reveal no records');
  const lockedRefs=await worker.evaluate(async()=>(await globalThis.testStore.publicState()).drafts.map(d=>d.ref));
  await vaultPage.locator('#impact').fill('Synthetic capture while locked');
  await poll(()=>worker.evaluate(async()=>(await globalThis.testStore.publicState()).drafts.map(d=>d.ref)),refs=>refs.some(ref=>!lockedRefs.includes(ref)));
  state=await api(ui,'STATE');assert(state.locked);assert(state.draftCount>0);
  await api(ui,'VAULT_UNLOCK',{passphrase:password});state=await poll(()=>api(ui,'STATE'),s=>s.drafts.some(d=>d.text==='Synthetic capture while locked'));
  check('trusted typing continues to encrypt while locked and decrypts after unlocking');
  await api(ui,'VAULT_CHANGE',{oldPassphrase:password,passphrase:newPassword});await api(ui,'VAULT_LOCK');
  await assert.rejects(api(ui,'VAULT_UNLOCK',{passphrase:password}));await api(ui,'VAULT_UNLOCK',{passphrase:newPassword});
  check('passphrase changes reject the old password and preserve saved answers');
  // Trigger a real service worker stop while Chrome and the unlocked session remain alive.
  const browserCDP=await context.browser().newBrowserCDPSession();
  const targets=await browserCDP.send('Target.getTargets');const workerTarget=targets.targetInfos.find(t=>t.type==='service_worker'&&t.url.includes(id));
  await browserCDP.send('Target.closeTarget',{targetId:workerTarget.targetId});await wait(250);
  assert.equal((await api(ui,'STATE')).locked,false);worker=context.serviceWorkers().at(-1);
  check('vault unlock survives service-worker suspension within the same browser session');
  await context.close();({worker,id,ui}=await launch());state=await api(ui,'STATE');assert(state.locked);assert.equal(state.libraryCount,1);
  vaultPage=await context.newPage();await vaultPage.goto(base+'/index.html');await waitProtected(vaultPage);
  const restartRefs=await worker.evaluate(async()=>(await globalThis.testStore.publicState()).drafts.map(d=>d.ref));
  await vaultPage.locator('#impact').fill('Synthetic locked after full restart');
  await poll(()=>names(vaultPage),items=>items.some(n=>n.startsWith('Draft Cairn · saved on this device')));
  await poll(()=>worker.evaluate(async()=>(await globalThis.testStore.publicState()).drafts.map(d=>d.ref)),refs=>refs.some(ref=>!restartRefs.includes(ref)));
  await api(ui,'VAULT_UNLOCK',{passphrase:newPassword});assert((await api(ui,'STATE')).drafts.some(d=>d.text==='Synthetic locked after full restart'));
  check('a full browser restart locks the vault while public-key capture still works');
  await api(ui,'VAULT_LOCK');await api(ui,'PRIVACY',{sessionOnly:true});state=await api(ui,'STATE');assert(state.sessionOnly&&state.locked);
  await api(ui,'VAULT_UNLOCK',{passphrase:newPassword});assert((await api(ui,'STATE')).drafts.length>0);
  await context.close();({worker,id,ui}=await launch());state=await api(ui,'STATE');assert(state.locked);assert.equal(state.draftCount,0);assert.equal(state.libraryCount,1);
  await api(ui,'VAULT_UNLOCK',{passphrase:newPassword});assert.equal((await api(ui,'STATE')).library.length,1);
  check('session-only draft storage clears on browser exit while the encrypted library survives');
  await api(ui,'VAULT_DISABLE',{passphrase:newPassword});state=await api(ui,'STATE');assert.equal(state.mode,'automatic');assert.equal(state.library.length,1);
  await context.close();({worker,id,ui}=await launch());assert.equal((await api(ui,'STATE')).library.length,1);
  check('returning to automatic encryption rekeys records and preserves password-free restart recovery');
  await ui.getByRole('button',{name:'Sites & settings',exact:true}).click();
  await ui.getByRole('button',{name:'Export encrypted library',exact:true}).click();
  await ui.locator('#passphrase').fill(password);await ui.locator('#confirm-passphrase').fill(password);
  const exportDownload=ui.waitForEvent('download');await ui.locator('#security-submit').click();const exportFile=await exportDownload;
  const encryptedExport=await readFile(await exportFile.path(),'utf8');assert(!encryptedExport.includes('confidential'));
  await ui.locator('#import').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(encryptedExport)});
  await ui.locator('#passphrase').fill('wrong password');await ui.locator('#security-submit').click();await ui.locator('#security-error').filter({hasText:'incorrect'}).waitFor();
  await ui.locator('#passphrase').fill(password);ui.once('dialog',dialog=>dialog.accept());await ui.locator('#security-submit').click();
  await poll(()=>ui.locator('#security-dialog').evaluate(el=>el.open),open=>!open);assert.equal((await api(ui,'STATE')).library.length,1);
  check('encrypted backup UI round-trips safely, rejects wrong passwords, and skips duplicates');
  const exclusionPage=await context.newPage();await exclusionPage.goto(base+'/index.html');await waitProtected(exclusionPage);
  await exclusionPage.locator('#impact').fill('Synthetic field to exclude');await poll(()=>api(ui,'STATE'),s=>s.drafts.some(d=>d.text==='Synthetic field to exclude'));
  await clickAccessible(exclusionPage,name=>name.startsWith('Draft Cairn ·'));
  exclusionPage.once('dialog',dialog=>dialog.accept());await clickAccessible(exclusionPage,name=>name==='Never capture this field');
  await poll(()=>api(ui,'STATE'),s=>s.ignoredFields.length===1);assert(!(await api(ui,'STATE')).drafts.some(d=>d.text==='Synthetic field to exclude'));
  await exclusionPage.reload();await waitProtected(exclusionPage);await exclusionPage.locator('#impact').focus();
  await poll(()=>names(exclusionPage),items=>items.some(n=>n.startsWith('Draft Cairn · not protected in this field')));
  await exclusionPage.locator('#impact').fill('Synthetic excluded after reload');await wait(450);assert(!(await api(ui,'STATE')).drafts.some(d=>d.text==='Synthetic excluded after reload'));
  await api(ui,'UNIGNORE_FIELD',{id:(await api(ui,'STATE')).ignoredFields[0].id});await wait(150);
  await exclusionPage.locator('#impact').fill('Synthetic allowed again');await poll(()=>api(ui,'STATE'),s=>s.drafts.some(d=>d.text==='Synthetic allowed again'));
  check('trusted field exclusion deletes its drafts, persists across reload, warns, and can be removed');
  await api(ui,'BLOCK_SITE',{origin:base});await assert.rejects(api(ui,'ENABLE',{origin:base}));assert((await api(ui,'STATE')).blockedSites.includes(base));
  await api(ui,'UNBLOCK_SITE',{origin:base});await api(ui,'ENABLE',{origin:base});
  check('Never capture site blocks prevent accidental re-enabling until removed');
  await api(ui,'PRIVACY',{sessionOnly:false});
  const migrationSize=await worker.evaluate(async()=>{
    const state=await globalThis.testStore.load(),template=state.drafts[0];
    state.drafts=Array.from({length:180},(_,i)=>({...template,id:`vault-scale-${i}`,key:`vault-scale-${i}`,text:'Synthetic vault scale '+i+'x'.repeat(30000),saved:Date.now()-1000+i}));
    await globalThis.testStore.commit(state);return globalThis.Cairn.stateBytes(state);
  });assert(migrationSize>5*1024*1024);
  await worker.evaluate(()=>{
    globalThis.atomicPut=IDBObjectStore.prototype.put;globalThis.rekeyAborted=false;
    IDBObjectStore.prototype.put=function(value,key){if(this.name==='meta'&&key==='index'&&value.mode==='vault'){globalThis.rekeyAborted=true;this.transaction.abort();throw new Error('Synthetic vault migration failure');}return globalThis.atomicPut.call(this,value,key);};
  });
  await assert.rejects(api(ui,'VAULT_ENABLE',{passphrase:password,acknowledged:true}));
  assert(await worker.evaluate(()=>globalThis.rekeyAborted));await worker.evaluate(()=>{IDBObjectStore.prototype.put=globalThis.atomicPut;});
  assert.equal((await api(ui,'STATE')).mode,'automatic');assert.equal((await api(ui,'STATE')).draftCount,180);
  check('failed near-capacity vault migration rolls back records, index and key atomically');
  await api(ui,'VAULT_ENABLE',{passphrase:password,acknowledged:true});await api(ui,'VAULT_LOCK');
  assert.equal((await api(ui,'STATE')).draftCount,180);await api(ui,'PRIVACY',{sessionOnly:true});
  state=await api(ui,'STATE');assert(state.locked);assert(state.draftCount<180&&state.draftCount>0);assert.equal(state.libraryCount,1);
  await api(ui,'VAULT_UNLOCK',{passphrase:password});assert((await api(ui,'STATE')).drafts.every(d=>d.text.startsWith('Synthetic vault scale')));
  check('near-capacity vault migration succeeds; locked session-only conversion evicts oldest drafts to fit memory');
  await api(ui,'VAULT_LOCK');await api(ui,'CLEAR');assert.equal((await api(ui,'STATE')).libraryCount,0);
  check('all-data deletion works without unlocking the vault');
  await ui.close();await worker.evaluate(async()=>{
    await globalThis.testStore.erase();const state=globalThis.Cairn.fresh();state.days=7;state.metadata=true;
    state.library=[{id:'v2-upgrade',title:'Synthetic v2 answer',text:'Synthetic encrypted v2 payload',project:'Upgrade',saved:Date.now()}];
    await globalThis.testLegacy.commit(state);
  });
  await context.close();({worker,id,ui}=await launch());state=await api(ui,'STATE');
  assert(state.library.some(a=>a.id==='v2-upgrade'&&a.text==='Synthetic encrypted v2 payload'));assert.equal(state.days,7);assert.equal(state.metadata,true);
  const oldKeys=await worker.evaluate(async()=>Object.keys(await chrome.storage.local.get(null)));assert(!oldKeys.some(k=>k==='cairn-v2'||k.startsWith('cairn-record-')));
  assert(!(await worker.evaluate(()=>indexedDB.databases())).some(db=>db.name==='cairn-keys'));
  check('v0.1.2 encrypted records upgrade without data loss and legacy ciphertext/key are removed');


  await api(ui,'CLEAR');
  await mkdir(path.join(root,'test-results'),{recursive:true});
  await writeFile(path.join(root,'test-results','browser-summary.json'),JSON.stringify({browser:context.browser()?.version(),automated:report,permissionPrompt:'not automated; temporary loopback host pre-grant; native removal simulated',clipboard:'browser clipboard populated by API, trusted keyboard paste; daily-use OS clipboard still manual',syntheticOnly:true},null,2));
} finally {
  await context?.close();server.kill();
  assert.equal(path.dirname(path.resolve(temp)),path.resolve(tmpdir()));
  assert(path.basename(temp).startsWith('draft-cairn-test-'));
  await rm(temp,{recursive:true,force:true});
}
