// Opt-in public-site smoke tests. Synthetic narrative only; never submits a form,
// signs in, creates an account, solves a challenge or types contact/payment data.
// A blocked sample is evidence of a testing limit, not evidence of compatibility.
import {chromium} from 'playwright';
import {mkdtemp,cp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const temp=await mkdtemp(path.join(tmpdir(),'draft-cairn-public-test-'));
const extension=path.join(temp,'extension');await cp(path.join(root,'extension'),extension,{recursive:true});
const targets=[
  {name:'SmartyGrants',url:'https://training4.smartygrants.com.au/testround'},
  {name:'Submittable',url:'https://manager.submittable.com/signin',login:true},
  {name:'Jotform grant template',url:'https://www.jotform.com/form-templates/grant-application',standalone:/^https:\/\/(?:form|www)\.jotform\.com\/(?:form-templates\/preview\/)?\d+(?:[/?]|$)/},
  {name:'Cognito Forms grant template',url:'https://www.cognitoforms.com/templates/grant-application-template',standalone:/^https:\/\/www\.cognitoforms\.com\/f\//},
  {name:'Wufoo builder demo',url:'https://www.wufoo.com/form-builder/'},
  {name:'Greenhouse application',url:'https://job-boards.greenhouse.io/anthropic/jobs/5065894008'},
  {name:'Ashby application',url:'https://jobs.ashbyhq.com/Ashby/0f5dbf59-687b-4d88-88a7-73ee0a66b48d/?action=apply',application:true},
  {name:'Quill official demo',url:'https://quilljs.com/',editor:true},
  {name:'ProseMirror official demo',url:'https://prosemirror.net/examples/basic/',editor:true},
  {name:'CKEditor 5 official demo',url:'https://ckeditor.com/ckeditor-5/demo/feature-rich/',editor:true}
];
const manifest=JSON.parse(await readFile(path.join(extension,'manifest.json'),'utf8'));
manifest.host_permissions=['https://training4.smartygrants.com.au/*','https://manager.submittable.com/*','https://www.jotform.com/*','https://form.jotform.com/*','https://www.cognitoforms.com/*','https://www.wufoo.com/*','https://quilljs.com/*','https://prosemirror.net/*','https://ckeditor.com/*','https://job-boards.greenhouse.io/*','https://jobs.ashbyhq.com/*'];
await writeFile(path.join(extension,'manifest.json'),JSON.stringify(manifest));
const context=await chromium.launchPersistentContext(path.join(temp,'profile'),{headless:true,channel:'chromium',args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],viewport:{width:1280,height:800}});
const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
const id=new URL(worker.url()).host,ui=await context.newPage();
await ui.goto(`chrome-extension://${id}/workspace.html`);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const api=async(type,rest={})=>{const r=await ui.evaluate(async({type,rest})=>chrome.runtime.sendMessage({type,...rest}),{type,rest});if(!r?.ok)throw new Error('Extension request failed');return r.data;};
await api('PRIVACY',{metadata:true});
const output=path.join(root,'test-results/portals');await mkdir(output,{recursive:true});
const results=[];
const publicUrl=url=>{try{const u=new URL(url);return ['http:','https:'].includes(u.protocol) ? u.origin+u.pathname : 'non-web frame';}catch{return 'unavailable';}};
async function inspect(page,target,scope) {
  const result={name:target.name,scope,url:publicUrl(page.url()),status:'not verified'};
  if(target.login){result.reason='Sign-in required; no account was used and no application fields were tested.';return result;}
  const origin=new URL(page.url()).origin;
  const tabId=await ui.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url)?.id,page.url());
  await api('ENABLE',{origin,tabId});
  const session=await context.newCDPSession(page);
  const statusNames=async()=>(await session.send('Accessibility.getFullAXTree')).nodes.map(n=>n.name?.value || '');
  for(let n=0;n<60;n++){if((await statusNames()).some(n=>n.startsWith('Draft Cairn ·')))break;await sleep(100);}
  const selectors=target.editor ? ['.ql-editor[contenteditable="true"]','.ProseMirror[contenteditable="true"]','.ck-editor__editable[contenteditable="true"][role="textbox"]'] : ['textarea'];
  let field;
  for(let attempt=0;attempt<12 && !field;attempt++) {
    for(const selector of selectors)for(const candidate of await page.locator(selector).all()) {
      if(await candidate.isVisible().catch(()=>false) && await candidate.isEnabled().catch(()=>false) && !(await candidate.getAttribute('readonly')) && !(await candidate.getAttribute('data-cairn-ignore'))) {
        // Avoid names/contact/financial/credential fields even on public samples.
        const hint=await candidate.evaluate(el=>[el.id,el.getAttribute('name'),el.getAttribute('aria-label'),el.labels?.[0]?.textContent].filter(Boolean).join(' '));
        if(!/password|email|phone|address|payment|bank|account|card|social.security|contact/i.test(hint)){field=candidate;break;}
      }
    }
    if(!field && attempt===4 && scope.includes('standalone') && target.name==='Jotform grant template') {
      const next=page.getByRole('button',{name:'Next',exact:true});
      if(await next.count()===1 && await next.isVisible())await next.click();
    }
    if(!field)await sleep(500);
  }
  if(!field){
    result.reason='No eligible visible narrative field reached; embedded forms, closed rounds or access gates may require a separate check.';
    result.surfaces=[];
    for(const frame of page.frames()) {
      const surface={url:publicUrl(frame.url()),topLevel:frame===page.mainFrame(),textareas:await frame.locator('textarea').count().catch(()=>0)};
      result.surfaces.push(surface);
      if(frame===page.mainFrame())continue;
      for(const candidate of await frame.locator('textarea').all()) {
        if(!(await candidate.isVisible().catch(()=>false)) || !(await candidate.isEnabled().catch(()=>false)))continue;
        const hint=await candidate.evaluate(el=>[el.id,el.name,el.getAttribute('aria-label'),el.labels?.[0]?.textContent].filter(Boolean).join(' '));
        if(/password|email|phone|address|payment|bank|account|card|contact/i.test(hint))continue;
        const text='Draft Cairn synthetic embedded-form exclusion check '+crypto.randomUUID();
        await candidate.fill(text,{timeout:6000});await sleep(600);
        const captured=(await api('STATE')).drafts.some(d=>d.text.includes(text));
        result.status=captured ? 'unexpected frame capture' : 'embedded field exclusion confirmed';
        result.reason='Trusted typing in this embedded narrative field is not captured. Open a standalone form when available; iframe recovery is unsupported.';
        result.embeddedCapture=captured;return result;
      }
    }
    result.pageTitle=await page.title();
    result.publicNotice=await page.locator('body').innerText().then(text=>text.slice(0,700)).catch(()=>'');return result;
  }
  result.field=await field.evaluate(el=>({tag:el.tagName,id:el.id,type:el.getAttribute('type'),classes:el.matches('[contenteditable]') ? el.className : undefined}));
  const marker='Draft Cairn synthetic compatibility check '+crypto.randomUUID()+'. This is test text, not an application. 😀';
  await field.fill(marker,{timeout:10000});
  let state;
  for(let n=0;n<40;n++){state=await api('STATE');if(state.drafts.some(d=>d.text.includes(marker)))break;await sleep(100);}
  const draft=state.drafts.find(d=>d.origin===origin && d.text.includes(marker));
  if(!draft){result.reason='Trusted typing reached the field but no recovery record was observed.';result.visibleMarker=await field.evaluate((el,text)=>el.innerText.includes(text),marker);result.pill=(await statusNames()).filter(n=>n.startsWith('Draft Cairn ·'));result.lastError=state.lastError;return result;}
  result.capture=true;result.copyText=draft.text.includes(marker);result.directRestoreAvailable=draft.restorable;
  await context.grantPermissions(['clipboard-read','clipboard-write'],{origin});
  await field.focus();await field.press('Control+A');
  const pasted='Draft Cairn synthetic pasted narrative. Complete ending 😀';
  await page.evaluate(text=>navigator.clipboard.writeText(text),pasted);await field.press('Control+V');await sleep(1900);
  const names=(await session.send('Accessibility.getFullAXTree')).nodes.map(n=>n.name?.value || '');
  result.paste=names.some(n=>n.includes('visible paste matches')) ? 'visible match' : names.some(n=>n.includes('paste needs review')) ? 'review original' : 'not verified';
  let recoveryDraft;
  for(let n=0;n<40;n++){recoveryDraft=(await api('STATE')).drafts.find(d=>d.origin===origin && d.text.includes(pasted));if(recoveryDraft)break;await sleep(100);}
  result.pastedAnswerSaved=!!recoveryDraft;
  await page.screenshot({path:path.join(output,`${results.length+1}-${target.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.png`)});
  await page.reload({waitUntil:'domcontentloaded',timeout:30000});
  result.recoveryAfterReload=!!recoveryDraft && (await api('STATE')).drafts.some(d=>d.id===recoveryDraft.id && d.text.includes(pasted));
  result.status=result.recoveryAfterReload ? 'capture and reload recovery passed' : 'recovery failed';
  // Direct restoration is a separate capability; never overwrite a vendor's demo text.
  if(recoveryDraft?.restorable && !target.editor) {
    try{await api('RESTORE',{id:recoveryDraft.id,tabId});result.restore='passed';}
    catch{result.restore='refused; copy back available';}
  } else result.restore='copy back only';
  return result;
}
try {
  for(const target of targets) {
    const page=await context.newPage();
    try {
      await page.goto(target.url,{waitUntil:'domcontentloaded',timeout:30000});
      await sleep(2000);
      if(target.application) {
        for(const control of [page.getByRole('tab',{name:'Application',exact:true}),page.getByRole('button',{name:'Application',exact:true}),page.getByRole('link',{name:'Application',exact:true})]) {
          if(await control.count()===1 && await control.isVisible()){await control.click();await sleep(1500);break;}
        }
      }
      const entry=await inspect(page,target,'public top-level sample');results.push(entry);
      if(target.standalone && !entry.capture) {
        const linked=page.frames().map(f=>f.url()).find(url=>target.standalone.test(url));
        if(linked){await page.goto(linked,{waitUntil:'domcontentloaded',timeout:30000});await sleep(1500);results.push(await inspect(page,target,'embedded preview opened as a standalone page; embedding remains unsupported'));}
      }
    } catch(error){results.push({name:target.name,url:target.url,status:'not verified',reason:error.name==='TimeoutError' ? 'Navigation or field interaction timed out.' : 'Sample could not be exercised in this run.'});}
    finally{await page.close();}
    console.log('ASSESSED '+target.name);
  }
} finally {
  await writeFile(path.join(output,'results.json'),JSON.stringify({date:new Date().toISOString(),commit:process.env.GITHUB_SHA || 'working tree',browser:context.browser()?.version(),syntheticOnly:true,submissionPerformed:false,permissionPrompt:'Test copy pre-grants named public hosts; native prompts are not tested.',results},null,2)+'\n');
  await context.close();await rm(temp,{recursive:true,force:true});
}
