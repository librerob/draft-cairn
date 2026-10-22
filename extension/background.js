import './core.js';
import * as S from './storage.js';
const C=globalThis.Cairn;
let queue=Promise.resolve(),lastError='';
const ready=Promise.all([chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}),chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'})]);
function serial(fn){const next=queue.then(async()=>{await ready;return fn();});queue=next.catch(()=>{});return next;}
const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
const trusted=sender=>sender.id===chrome.runtime.id && !sender.tab?.incognito && ['popup.html','workspace.html'].some(p=>sender.url?.split('?')[0]===chrome.runtime.getURL(p));
async function registerSites(state) {
  const current=(await chrome.scripting.getRegisteredContentScripts()).find(s=>s.id==='cairn-protection');
  const patterns=[...new Set(state.sites.map(C.hostPattern))].sort();
  if(!patterns.length){if(current)await chrome.scripting.unregisterContentScripts({ids:[current.id]});return;}
  if(current && JSON.stringify([...current.matches].sort())===JSON.stringify(patterns))return;
  const script={id:'cairn-protection',matches:patterns,js:['core.js','content.js'],runAt:'document_start',allFrames:false,persistAcrossSessions:true};
  if(current)await chrome.scripting.updateContentScripts([script]);else await chrome.scripting.registerContentScripts([script]);
}
async function recheckPages() {
  const tabs=await chrome.tabs.query({});
  await Promise.allSettled(tabs.map(t=>chrome.tabs.sendMessage(t.id,{type:'RECHECK'},{frameId:0})));
}
async function enable(origin,tabId) {
  if(!(await chrome.permissions.contains({origins:[C.hostPattern(origin)]})))throw new Error('Site access was not granted.');
  await S.updateIndex(state=>{
    if(state.blockedSites.includes(origin))throw new Error('Site is blocked. Remove it from Never capture in settings first.');
    if(!state.sites.includes(origin)){
      if(state.sites.length>=80)throw new Error('Site limit reached. Remove a site first.');state.sites.push(origin);
    }
  });
  await registerSites(await S.publicState());
  if(Number.isInteger(tabId)) {
    const tab=await chrome.tabs.get(tabId).catch(()=>null);
    if(tab && !tab.incognito && tab.url && C.originOf(tab.url)===origin) {
      await chrome.scripting.executeScript({target:{tabId},files:['core.js','content.js']});
      await chrome.tabs.sendMessage(tabId,{type:'START'},{frameId:0});
    }
  }
}
async function finishPending() {
  const pending=await chrome.storage.session.get(null);
  for(const [name,item] of Object.entries(pending)) {
    if(!name.startsWith('enable-'))continue;
    if(!item || Date.now()-item.created>120000 || item.created>Date.now()){await chrome.storage.session.remove(name);continue;}
    const origin=C.originOf(item.origin);
    if(await chrome.permissions.contains({origins:[C.hostPattern(origin)]})) {
      await enable(origin,item.tabId);await chrome.storage.session.remove(name);
    }
  }
}
async function stopPages(origin) {
  const tabs=await chrome.tabs.query({});
  await Promise.allSettled(tabs.filter(t=>!origin || t.url && (()=>{try{return C.originOf(t.url)===origin;}catch{return false;}})()).map(t=>chrome.tabs.sendMessage(t.id,{type:'STOP'},{frameId:0})));
}
async function activeOrigin(sender) {
  if(!sender.tab || sender.tab.incognito || sender.frameId!==0)throw new Error('This page is not supported.');
  const origin=C.originOf(sender.url),state=await S.publicState();
  if(!state.sites.includes(origin) || state.blockedSites.includes(origin) || !(await chrome.permissions.contains({origins:[C.hostPattern(origin)]})))throw new Error('Protection is off for this site.');
  return {origin,state,url:new URL(sender.url)};
}
function validateField(f) {
  if(!f || !C.allowedField(f))throw new Error('Field is not supported.');
  for(const key of ['tag','type','id','name','label','form','placeholder','autocomplete'])
    if(typeof f[key]!=='string' || f[key].length>200)throw new Error('Field is not supported.');
}
async function handle(m,sender) {
  if(!m || typeof m.type!=='string')throw new Error('Invalid request.');
  if(sender.tab && !trusted(sender)) {
    const {origin,state,url}=await activeOrigin(sender);
    if(m.type==='HELLO')return {active:true,ignoredFields:state.ignoredFields.filter(f=>f.origin===origin).map(f=>f.id)};
    if(!['CAPTURE','IGNORE_FIELD'].includes(m.type))throw new Error('Unavailable from this page.');
    const f=m.field;validateField(f);
    const pageKey=await digest(origin+url.pathname),fieldKey=await digest(origin+pageKey+C.fieldIdentity(f));
    if(m.type==='IGNORE_FIELD') {
      await S.updateIndex(next=>{
        if(next.ignoredFields.some(f=>f.id===fieldKey))return;
        if(next.ignoredFields.length>=240)throw new Error('Field exclusion limit reached. Remove an exclusion in settings first.');
        next.ignoredFields.push({id:fieldKey,origin});next.drafts=next.drafts.filter(d=>d.fieldKey!==fieldKey);
      });
      await recheckPages();return true;
    }
    if(state.ignoredFields.some(f=>f.id===fieldKey))throw new Error('Field is excluded from capture.');
    if(typeof m.structure!=='string' || !/^[a-f0-9]{64}$/.test(m.structure))throw new Error('Field is not supported.');
    if(typeof m.title!=='string' || m.title.length>160 || !['draft','paste'].includes(m.kind))throw new Error('Invalid draft.');
    if(!Number.isInteger(m.slot) || m.slot<0 || m.slot>10000)throw new Error('Invalid field position.');
    const key=await digest(origin+pageKey+C.fieldIdentity(f)+m.slot+m.kind);
    return S.capture({origin,pageKey,fieldKey,key,structure:m.structure,field:f,title:m.title,kind:m.kind,text:m.text,restorable:!url.search && !url.hash && m.kind==='draft'});
  }
  if(!trusted(sender))throw new Error('Unavailable from this context.');
  switch(m.type) {
    case 'STATE':return {...await S.view(m.origin),lastError:lastError || (await chrome.storage.session.get('lastError')).lastError || ''};
    case 'ACK_ERROR':lastError='';await chrome.storage.session.remove('lastError');await chrome.action.setBadgeText({text:''});return true;
    case 'ENABLE':{const origin=C.originOf(m.origin);await enable(origin,m.tabId);await chrome.storage.session.remove(`enable-${m.tabId}`);return true;}
    case 'BLOCK_SITE':
    case 'DISABLE': {
      const origin=C.originOf(m.origin),site=await digest(origin),pending=await chrome.storage.session.get(null);
      await chrome.storage.session.remove(Object.keys(pending).filter(k=>k.startsWith('enable-') && pending[k]?.origin===origin));
      await S.updateIndex(state=>{
        state.sites=state.sites.filter(s=>s!==origin);
        if(m.erase)state.drafts=state.drafts.filter(d=>d.site!==site);
        if(m.type==='BLOCK_SITE' && !state.blockedSites.includes(origin)) {
          if(state.blockedSites.length>=80)throw new Error('Site block limit reached. Remove a blocked site first.');state.blockedSites.push(origin);
        }
        if(m.erase)state.ignoredFields=state.ignoredFields.filter(f=>f.origin!==origin);
      });
      await stopPages(origin);const state=await S.publicState();await registerSites(state);
      if(!state.sites.some(s=>C.hostPattern(s)===C.hostPattern(origin)))await chrome.permissions.remove({origins:[C.hostPattern(origin)]});return true;
    }
    case 'UNBLOCK_SITE':{const origin=C.originOf(m.origin);await S.updateIndex(s=>{s.blockedSites=s.blockedSites.filter(o=>o!==origin);});return true;}
    case 'UNIGNORE_FIELD':await S.updateIndex(s=>{s.ignoredFields=s.ignoredFields.filter(f=>f.id!==m.id);});await recheckPages();return true;
    case 'DELETE_DRAFT':await S.updateIndex(s=>{s.drafts=s.drafts.filter(d=>d.id!==m.id);});return true;
    case 'DELETE_ANSWER':await S.updateIndex(s=>{s.library=s.library.filter(d=>d.id!==m.id);});return true;
    case 'SAVE_ANSWER': {
      const state=await S.load();state.library.unshift({...C.libraryItem(m.answer),id:crypto.randomUUID(),saved:Date.now()});C.libraryBounded(state);await S.commit(state);return true;
    }
    case 'IMPORT': {
      const state=await S.load(),items=C.parseImport(m.raw);
      for(const a of items)if(!state.library.some(b=>b.title===a.title && b.text===a.text && b.project===a.project))state.library.push({...a,id:crypto.randomUUID(),saved:Date.now()});
      C.libraryBounded(state);await S.commit(state);return true;
    }
    case 'RETENTION': {
      if(![1,3,7,14,30].includes(m.days))throw new Error('Choose a supported retention period.');
      await S.updateIndex(s=>{s.days=m.days;s.drafts=s.drafts.map(d=>({...d,expires:Math.min(d.expires,d.saved+m.days*C.DAY)}));});return true;
    }
    case 'PRIVACY':await S.privacy({metadata:m.metadata,sessionOnly:m.sessionOnly});return true;
    case 'VAULT_ENABLE':if(m.acknowledged!==true)throw new Error('Vault setup requires acknowledging that a forgotten passphrase cannot be recovered.');await S.enableVault(m.passphrase);return true;
    case 'VAULT_UNLOCK':await S.unlock(m.passphrase);return true;
    case 'VAULT_LOCK':await S.lock();return true;
    case 'VAULT_DISABLE':await S.disableVault(m.passphrase);return true;
    case 'VAULT_CHANGE':await S.changePassphrase(m.oldPassphrase,m.passphrase);return true;
    case 'CLEAR': {
      await S.erase();lastError='';await chrome.action.setBadgeText({text:''});await stopPages();await registerSites(C.fresh());
      const permissions=await chrome.permissions.getAll();if(permissions.origins?.length)await chrome.permissions.remove({origins:permissions.origins});return true;
    }
    case 'FINISH_ENABLE':await finishPending();return true;
    case 'RESTORE': {
      const state=await S.load(),draft=state.drafts.find(d=>d.id===m.id);
      if(!draft || !draft.restorable || !state.sites.includes(draft.origin))throw new Error('Copy this draft instead. Direct restoration is unavailable.');
      const tab=await chrome.tabs.get(m.tabId);
      if(!(await chrome.permissions.contains({origins:[C.hostPattern(draft.origin)]})))throw new Error('Protection is off for this site.');
      if(tab.incognito || C.originOf(tab.url)!==draft.origin)throw new Error('Choose an open tab on the original page.');
      const result=await chrome.tabs.sendMessage(tab.id,{type:'RESTORE',draft},{frameId:0});
      if(!result?.ok)throw new Error(result?.error || 'The page changed. Copy the answer instead.');return true;
    }
    default:throw new Error('Unknown request.');
  }
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  serial(()=>handle(message,sender)).then(data=>respond({ok:true,data}),error=>{
    const safe = /^(Local storage|Choose |Protection |Copy |Site |Invalid |Field |Add |Unsupported |This |Import |The page|Vault |Passphrase |Enter )/.test(error.message)?error.message:'Could not save or complete this action. Keep a separate copy and try again.';
    recordError(safe);respond({ok:false,error:safe});
  });return true;
});
function recordError(safe) {
  lastError=safe;chrome.storage.session.set({lastError:safe}).catch(()=>{});
  chrome.action.setBadgeText({text:'!'}).catch(()=>{});chrome.action.setBadgeBackgroundColor({color:'#963d2b'}).catch(()=>{});
}
async function maintenance() {
  return serial(async()=>{
    const state=await S.publicState(),sites=[];
    for(const origin of state.sites)if(!state.blockedSites.includes(origin) && await chrome.permissions.contains({origins:[C.hostPattern(origin)]}))sites.push(origin);
    await S.updateIndex(s=>{s.sites=sites;});await registerSites(await S.publicState());await finishPending();await recheckPages();
    await chrome.alarms.create('retention',{periodInMinutes:60});
  }).catch(()=>recordError('Could not maintain local storage. Keep a separate copy.'));
}
chrome.runtime.onInstalled.addListener(maintenance);chrome.runtime.onStartup.addListener(maintenance);
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='retention')maintenance();});chrome.permissions.onRemoved.addListener(maintenance);
chrome.permissions.onAdded.addListener(()=>serial(finishPending).catch(()=>recordError('Could not finish enabling protection. Reopen the popup and try again.')));
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area==='session' && Object.entries(changes).some(([name,change])=>name.startsWith('enable-') && change.newValue))serial(finishPending).catch(()=>recordError('Could not finish enabling protection. Reopen the popup and try again.'));
});
