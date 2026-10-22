import './core.js';
const C = globalThis.Cairn;
let queue = Promise.resolve();
const ready = chrome.storage.local.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'});
let lastError = '';
function serial(fn) {
  const next = queue.then(async () => { await ready; return fn(); });
  queue = next.catch(() => {});
  return next;
}
async function read() {
  const {state} = await chrome.storage.local.get('state');
  const result = state || C.fresh();
  return C.prune(result);
}
async function write(state) {
  await chrome.storage.local.set({state: C.bounded(state)});
  lastError = '';
  await chrome.action.setBadgeText({text:''}).catch(()=>{});
}
const digest = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b=>b.toString(16).padStart(2,'0')).join('');
const trusted = sender => sender.id === chrome.runtime.id && !sender.tab &&
  ['popup.html','workspace.html'].some(p => sender.url?.split('?')[0] === chrome.runtime.getURL(p));
async function registerSites(state) {
  const existing = await chrome.scripting.getRegisteredContentScripts();
  if (existing.length) await chrome.scripting.unregisterContentScripts({ids: existing.map(s=>s.id)});
  const patterns = [...new Set(state.sites.map(C.hostPattern))];
  if (patterns.length) await chrome.scripting.registerContentScripts([{
    id:'cairn-protection', matches:patterns, js:['core.js','content.js'], runAt:'document_start', allFrames:false,
    persistAcrossSessions:true
  }]);
}
async function stopPages(origin) {
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(tabs.filter(t=>t.url && (!origin || (()=>{try{return C.originOf(t.url)===origin;}catch{return false;}})())).map(t=>chrome.tabs.sendMessage(t.id,{type:'STOP'},{frameId:0})));
}
async function activeOrigin(sender) {
  if (!sender.tab || sender.tab.incognito || sender.frameId !== 0) throw new Error('This page is not supported.');
  const origin = C.originOf(sender.url);
  const state = await read();
  if (!state.sites.includes(origin) || !(await chrome.permissions.contains({origins:[C.hostPattern(origin)]})))
    throw new Error('Protection is off for this site.');
  return {origin, state, url:new URL(sender.url)};
}
async function handle(m, sender) {
  if (!m || typeof m.type !== 'string') throw new Error('Invalid request.');
  if (sender.tab) {
    const {origin, state, url} = await activeOrigin(sender);
    if (m.type === 'HELLO') return {active:true};
    if (m.type !== 'CAPTURE') throw new Error('Unavailable from this page.');
    const f = m.field;
    if (!f || !C.allowedField(f) || typeof m.structure !== 'string' || !/^[a-f0-9]{64}$/.test(m.structure)) throw new Error('Field is not supported.');
    for (const key of ['tag','type','id','name','label','form','placeholder','autocomplete'])
      if (typeof f[key] !== 'string' || f[key].length > 200) throw new Error('Field is not supported.');
    if (typeof m.title !== 'string' || m.title.length > 160 || !['draft','paste'].includes(m.kind)) throw new Error('Invalid draft.');
    const pageKey = await digest(origin + url.pathname);
    if (!Number.isInteger(m.slot) || m.slot < 0 || m.slot > 10000) throw new Error('Invalid field position.');
    const key = await digest(origin + pageKey + C.fieldIdentity(f) + m.slot + m.kind);
    await write(C.addDraft(state, {origin, pageKey, key, structure:m.structure, field:f, title:m.title,
      kind:m.kind, text:m.text, restorable:!url.search && !url.hash && m.kind === 'draft'}));
    return {saved:true};
  }
  if (!trusted(sender)) throw new Error('Unavailable from this context.');
  const state = await read();
  switch (m.type) {
    case 'STATE': return {...state, lastError};
    case 'ENABLE': {
      const origin = C.originOf(m.origin);
      if (state.sites.length >= 80) throw new Error('Site limit reached. Remove a site first.');
      if (!(await chrome.permissions.contains({origins:[C.hostPattern(origin)]}))) throw new Error('Site access was not granted.');
      if (!state.sites.includes(origin)) state.sites.push(origin);
      await write(state);
      await registerSites(state);
      if (Number.isInteger(m.tabId)) {
        const tab = await chrome.tabs.get(m.tabId);
        if (!tab.incognito && C.originOf(tab.url) === origin) {
          await chrome.scripting.executeScript({target:{tabId:m.tabId}, files:['core.js','content.js']});
          await chrome.tabs.sendMessage(m.tabId,{type:'START'},{frameId:0});
        }
      }
      return true;
    }
    case 'DISABLE': {
      const origin = C.originOf(m.origin);
      state.sites = state.sites.filter(s=>s !== origin);
      if (m.erase) state.drafts = state.drafts.filter(d=>d.origin !== origin);
      await write(state);
      await stopPages(origin);
      await registerSites(state);
      if (!state.sites.some(s=>C.hostPattern(s) === C.hostPattern(origin)))
        await chrome.permissions.remove({origins:[C.hostPattern(origin)]});
      return true;
    }
    case 'DELETE_DRAFT': state.drafts = state.drafts.filter(d=>d.id !== m.id); await write(state); return true;
    case 'DELETE_ANSWER': state.library = state.library.filter(d=>d.id !== m.id); await write(state); return true;
    case 'SAVE_ANSWER': state.library.unshift({...C.libraryItem(m.answer), id:crypto.randomUUID(), saved:Date.now()}); await write(state); return true;
    case 'IMPORT': {
      const items = C.parseImport(m.raw);
      for (const a of items) if (!state.library.some(b=>b.title === a.title && b.text === a.text && b.project === a.project))
        state.library.push({...a,id:crypto.randomUUID(),saved:Date.now()});
      await write(state); return true;
    }
    case 'RETENTION': {
      if (![1,3,7,14,30].includes(m.days)) throw new Error('Choose a supported retention period.');
      state.days = m.days;
      state.drafts.forEach(d=>d.expires = Math.min(d.expires, d.saved + m.days*C.DAY));
      C.prune(state); await write(state); return true;
    }
    case 'CLEAR': {
      await write(C.fresh());
      await stopPages();
      await registerSites(C.fresh());
      const permissions = await chrome.permissions.getAll();
      if (permissions.origins?.length) await chrome.permissions.remove({origins:permissions.origins});
      return true;
    }
    case 'RESTORE': {
      const draft = state.drafts.find(d=>d.id === m.id);
      if (!draft || !draft.restorable || !state.sites.includes(draft.origin)) throw new Error('Copy this draft instead. Direct restoration is unavailable.');
      const tab = await chrome.tabs.get(m.tabId);
      if (!(await chrome.permissions.contains({origins:[C.hostPattern(draft.origin)]}))) throw new Error('Protection is off for this site.');
      if (tab.incognito || C.originOf(tab.url) !== draft.origin) throw new Error('Choose an open tab on the original page.');
      const result = await chrome.tabs.sendMessage(tab.id,{type:'RESTORE',draft}, {frameId:0});
      if (!result?.ok) throw new Error(result?.error || 'The page changed. Copy the answer instead.');
      return true;
    }
    default: throw new Error('Unknown request.');
  }
}
chrome.runtime.onMessage.addListener((message,sender,respond) => {
  serial(()=>handle(message,sender)).then(data=>respond({ok:true,data}), error=> {
    // Browser exceptions may contain implementation details; never return arbitrary input in errors.
    const safe = /^(Local storage|Choose |Protection |Copy |Site |Invalid |Field |Add |Unsupported |This |Import |The page)/.test(error.message) ? error.message : 'Could not save or complete this action. Keep a separate copy and try again.';
    lastError = safe;
    chrome.action.setBadgeText({text:'!'}).catch(()=>{});
    chrome.action.setBadgeBackgroundColor({color:'#963d2b'}).catch(()=>{});
    respond({ok:false,error:safe});
  });
  return true;
});
async function maintenance() {
  return serial(async()=>{
    const state = await read();
    const sites = [];
    for (const origin of state.sites) if (await chrome.permissions.contains({origins:[C.hostPattern(origin)]})) sites.push(origin);
    state.sites = sites;
    await write(state); await registerSites(state);
    await chrome.alarms.create('retention',{periodInMinutes:60});
  }).catch(()=>{lastError = 'Could not maintain local storage. Keep a separate copy.';});
}
chrome.runtime.onInstalled.addListener(maintenance);
chrome.runtime.onStartup.addListener(maintenance);
chrome.alarms.onAlarm.addListener(a=>{if(a.name === 'retention') maintenance();});
chrome.permissions.onRemoved.addListener(maintenance);
