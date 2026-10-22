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
try {
  let {worker,id,ui}=await launch();
  const page=await context.newPage();await page.goto(base+'/index.html');
  await page.locator('#summary').fill('Synthetic answer before protection');await wait(450);
  assert.equal((await api(ui,'STATE')).drafts.length,0);check('no capture before explicit site enable');
  const tabId=await ui.evaluate(async()=>{const tabs=await chrome.tabs.query({});return tabs.find(t=>t.url?.startsWith('http://127.0.0.1:8765/index.html')).id;});
  await api(ui,'ENABLE',{origin:base,tabId});
  await page.locator('#summary').fill('Synthetic project answer, saved locally.');
  let state=await poll(()=>api(ui,'STATE'),s=>s.drafts.some(d=>d.text==='Synthetic project answer, saved locally.'));
  const draft=state.drafts.find(d=>d.field.id==='summary');check('typing saves through the real service worker');
  await page.reload();await page.waitForSelector('[data-cairn-ui]',{state:'attached'});
  await api(ui,'RESTORE',{id:draft.id,tabId});assert.equal(await page.locator('#summary').inputValue(),draft.text);check('reload and explicit restoration to the original empty field');
  await assert.rejects(api(ui,'RESTORE',{id:draft.id,tabId}));check('nonempty destination is never overwritten');
  await page.getByRole('button',{name:'Simulate session expiry',exact:true}).click();
  await page.getByRole('link',{name:'Return to an empty application',exact:true}).click();
  await page.waitForSelector('[data-cairn-ui]',{state:'attached'});
  await api(ui,'RESTORE',{id:draft.id,tabId});assert.equal(await page.locator('#summary').inputValue(),draft.text);check('deliberate session-expiry navigation and return recovery');
  await page.locator('textarea[name=detail]').nth(0).fill('Synthetic duplicate one');
  await poll(()=>api(ui,'STATE'),s=>s.drafts.some(d=>d.text==='Synthetic duplicate one'));
  await page.locator('textarea[name=detail]').nth(1).fill('Synthetic duplicate two');
  await poll(()=>api(ui,'STATE'),s=>s.drafts.some(d=>d.text==='Synthetic duplicate two'));
  assert((await api(ui,'STATE')).drafts.some(d=>d.text==='Synthetic duplicate one'));check('similar fields keep separate draft records');
  const ambiguous=(await api(ui,'STATE')).drafts.find(d=>d.text==='Synthetic duplicate one');
  await page.reload();await page.waitForSelector('[data-cairn-ui]',{state:'attached'});
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
  const stopped=await page.locator('#summary').evaluate((el,text)=>{
    el.focus();el.setSelectionRange(3,9);const transfer=new DataTransfer();transfer.setData('text/plain',text);
    const event=new ClipboardEvent('paste',{clipboardData:transfer,bubbles:true,cancelable:true});el.dispatchEvent(event);return event.defaultPrevented;
  },original);
  assert(stopped);assert.equal(await page.locator('#summary').inputValue(),'Synthetic existing');
  state=await poll(()=>api(ui,'STATE'),s=>s.drafts.some(d=>d.kind==='paste'&&d.text===original));check('oversized selected-text paste is blocked and full original persisted');
  const pasteCDP=await context.newCDPSession(page);const pasteAX=await pasteCDP.send('Accessibility.getFullAXTree');
  assert(pasteAX.nodes.some(n=>n.role?.value==='dialog'));assert(pasteAX.nodes.some(n=>n.value?.value===original));check('larger editor exposes a labelled dialog and complete original answer to accessibility APIs');
  await page.keyboard.press('Escape');
  // The isolated closed shadow root is deliberately not exposed through page DOM selectors.
  // CDP inspects the accessibility tree, like a screen reader, to verify the dialog and counter.
  const fitStopped=await page.locator('#summary').evaluate((el)=>{el.focus();el.setSelectionRange(0,el.value.length);const d=new DataTransfer();d.setData('text/plain','fits');const event=new ClipboardEvent('paste',{clipboardData:d,bubbles:true,cancelable:true});el.dispatchEvent(event);return event.defaultPrevented;});
  assert.equal(fitStopped,false);check('a fitting paste over a selection is allowed');
  await page.goto(base+'/index.html?token=synthetic#example');await page.waitForSelector('[data-cairn-ui]',{state:'attached'});
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
  await worker.evaluate(()=>{globalThis.originalSet=chrome.storage.local.set;chrome.storage.local.set=async()=>{throw new Error('Synthetic storage failure');};});
  await page.locator('#impact').fill('Synthetic failed write');await wait(600);
  assert(!(await api(ui,'STATE')).drafts.some(d=>d.text==='Synthetic failed write'));
  const cdp=await context.newCDPSession(page);const ax=await cdp.send('Accessibility.getFullAXTree');
  assert(ax.nodes.some(n=>n.name?.value?.includes('not saved')));check('storage failure preserves earlier data and shows a visible warning');
  await worker.evaluate(()=>{chrome.storage.local.set=globalThis.originalSet;});
  await api(ui,'DISABLE',{origin:base});
  await page.locator('#impact').fill('Synthetic while disabled');await wait(500);
  assert(!(await api(ui,'STATE')).drafts.some(d=>d.text==='Synthetic while disabled'));
  await api(ui,'ENABLE',{origin:base,tabId});await page.locator('#impact').fill('Synthetic after re-enabling');
  await poll(()=>api(ui,'STATE'),s=>s.drafts.some(d=>d.text==='Synthetic after re-enabling'));check('turning protection off and on works in an already-open page');
  // Verify expiry is enforced through reads and deletion survives service-worker storage.
  await worker.evaluate(async()=>{const {state}=await chrome.storage.local.get('state');state.drafts.push({id:'expired-synthetic',expires:0,text:'Expired synthetic'});await chrome.storage.local.set({state});});
  assert(!(await api(ui,'STATE')).drafts.some(d=>d.id==='expired-synthetic'));
  await api(ui,'DELETE_DRAFT',{id:ambiguous.id});assert(!(await api(ui,'STATE')).drafts.some(d=>d.id===ambiguous.id));check('expiry and individual draft deletion');
  const durable=(await api(ui,'STATE')).library.length;
  const durableDraftIds=(await api(ui,'STATE')).drafts.map(d=>d.id).sort();assert(durableDraftIds.length>0);
  await context.close();({worker,id,ui}=await launch());assert.equal((await api(ui,'STATE')).library.length,durable);
  assert.deepEqual((await api(ui,'STATE')).drafts.map(d=>d.id).sort(),durableDraftIds);check('drafts and library survive a real browser process restart');
  const hostile=(await api(ui,'STATE')).library.find(a=>a.project==='Synthetic hostile strings');await api(ui,'DELETE_ANSWER',{id:hostile.id});
  await api(ui,'SAVE_ANSWER',{answer:{title:'Workshop accessibility',project:'Northbank',text:'Synthetic approved wording: our workshop offers step-free access, quiet sessions, and materials in accessible formats.'}});
  await ui.reload();await ui.waitForFunction(()=>document.getElementById('summary').textContent.includes('revisions'));
  // Documentation screenshots contain only fixture data and use the unmodified shipped UI.
  const screenshots=path.join(root,'test-results','screenshots');await mkdir(screenshots,{recursive:true});
  await ui.screenshot({path:path.join(screenshots,'recovery.png')});
  await ui.getByRole('button',{name:'Answer library',exact:true}).click();await ui.screenshot({path:path.join(screenshots,'library.png')});
  await ui.setViewportSize({width:390,height:844});assert.equal(await ui.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);check('workspace fits a 390px viewport');
  await api(ui,'DISABLE',{origin:base,erase:true});assert(!(await api(ui,'STATE')).drafts.some(d=>d.origin===base));
  await api(ui,'CLEAR');state=await api(ui,'STATE');assert.equal(state.library.length+state.drafts.length+state.sites.length,0);check('site erasure and all-data deletion');
  await mkdir(path.join(root,'test-results'),{recursive:true});
  await writeFile(path.join(root,'test-results','browser-summary.json'),JSON.stringify({browser:context.browser()?.version(),automated:report,permissionPrompt:'not automated; temporary loopback host pre-grant; native removal simulated',syntheticOnly:true},null,2));
} finally {
  await context?.close();server.kill();
  assert.equal(path.dirname(path.resolve(temp)),path.resolve(tmpdir()));
  assert(path.basename(temp).startsWith('draft-cairn-test-'));
  await rm(temp,{recursive:true,force:true});
}
