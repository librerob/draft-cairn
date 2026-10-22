import * as D from './record-store.js';
import * as V from './crypto.js';
import * as legacy from './legacy-storage.js';
const C=globalThis.Cairn, SECRET='cairn-vault-session', MEMORY='cairn-memory-';
const SESSION_BYTES=2*1024*1024;
const encoder=new TextEncoder();
let catalog, initializing, privateCache, publicCache, autoCache;
const plaintext=new Map(), bindings=new WeakMap();
const size=value=>encoder.encode(JSON.stringify(value)).length;
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
function config(state) {
  const s=C.privacyDefaults(state);
  return {version:1,days:s.days,metadata:s.metadata,sessionOnly:s.sessionOnly,sites:[...s.sites],
    blockedSites:[...s.blockedSites],ignoredFields:[...s.ignoredFields],evicted:s.evicted || 0};
}
function blank(state=C.fresh()) {return {...config(state),v:3,generation:crypto.randomUUID(),mode:'automatic',drafts:[],library:[],sessionRef:null};}
const memoryKey=ref=>MEMORY+'record-'+ref;
const label=(index,ref)=>'draft-cairn-record-v3|'+index.generation+'|'+ref;
function frozen(record) {
  if(record.field)Object.freeze(record.field);return Object.freeze(record);
}
async function notify() {
  await chrome.storage.local.set({'cairn-change':crypto.randomUUID()}).catch(()=>{});
}
async function automatic(index) {
  if(autoCache)return autoCache;
  const key=await D.get('keys','automatic');
  if(key)return autoCache=key;
  if(index.drafts.length || index.library.length || index.sessionRef)
    throw new Error('Local storage encryption key is missing. Existing data was preserved.');
  return autoCache=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function privateKey(index) {
  if(index.mode!=='vault')return null;
  const value=(await chrome.storage.session.get(SECRET))[SECRET];
  if(!value || value.generation!==index.generation){privateCache=null;plaintext.clear();return null;}
  if(privateCache?.generation!==index.generation)
    privateCache={generation:index.generation,key:await V.importPrivate(value.privateKey)};
  return privateCache.key;
}
async function publicKey(index) {
  if(publicCache?.generation!==index.generation)
    publicCache={generation:index.generation,key:await V.importPublic(index.vault.publicKey)};
  return publicCache.key;
}
async function effective(index=catalog) {
  const result={...index,sites:[...index.sites],blockedSites:[...index.blockedSites],ignoredFields:[...index.ignoredFields],
    drafts:[...index.drafts],library:[...index.library]};
  if(index.sessionOnly && index.sessionRef) {
    const value=(await chrome.storage.session.get(index.sessionRef))[index.sessionRef];
    result.drafts=value?.generation===index.generation ? value.drafts : [];
  }
  return result;
}
async function cleanupMemory(index) {
  const stored=await chrome.storage.session.get(null), used=new Set(index.drafts.filter(d=>d.memory).map(d=>memoryKey(d.ref)));
  if(index.sessionRef)used.add(index.sessionRef);
  const remove=Object.keys(stored).filter(k=>k.startsWith(MEMORY) && !used.has(k));
  if(remove.length)await chrome.storage.session.remove(remove);
}
async function ensure() {
  if(catalog)return;
  if(!initializing)initializing=(async()=>{
    const index=await D.get('meta','index');
    if(index) {
      if(index.v!==3 || !['automatic','vault'].includes(index.mode) || !Array.isArray(index.drafts) || !Array.isArray(index.library))
        throw new Error('Local storage index is damaged. Existing data was preserved.');
      catalog=index;await cleanupMemory(await effective());await cleanupLegacy();return;
    }
    const old=await chrome.storage.local.get(['state','cairn-v2']);
    const migrating=!!(old.state || old['cairn-v2']);
    const state=migrating ? C.privacyDefaults(await legacy.load()) : C.fresh();
    const initial=blank(state);
    await replaceState(state,initial,initial,true);
    // The committed v3 database is usable even if legacy cleanup is interrupted.
    if(migrating)await cleanupLegacy();
  })().catch(error=>{initializing=undefined;throw error;});
  return initializing;
}
async function cleanupLegacy() {
  const old=await chrome.storage.local.get(['state','cairn-v2']);
  if(old.state || old['cairn-v2'])await legacy.erase();
}
async function envelope(record,index,ref,autoKey) {
  if(index.mode==='vault')return {mode:'vault',body:await V.sealHybrid(record,await publicKey(index),label(index,ref))};
  return {mode:'automatic',body:await V.seal(record,autoKey || await automatic(index),label(index,ref))};
}
async function readEnvelopes(entries) {
  const persisted=entries.filter(e=>!e.memory).map(e=>e.ref), values=await D.records(persisted);
  const memory=entries.filter(e=>e.memory), keys=memory.map(e=>memoryKey(e.ref));
  if(keys.length){const stored=await chrome.storage.session.get(keys);for(const e of memory)values.set(e.ref,stored[memoryKey(e.ref)]);}
  return values;
}
async function decrypt(entry,index,value) {
  if(!value || value.mode!==index.mode)throw new Error('Local storage record is missing or damaged. Existing data was preserved.');
  try {
    const raw=index.mode==='vault' ? await V.openHybrid(value.body,await privateKey(index),label(index,entry.ref)) :
      await V.open(value.body,await automatic(index),label(index,entry.ref));
    if(raw.id!==entry.id)throw new Error();
    return frozen(raw);
  } catch{throw new Error('Local storage could not be decrypted. Existing data was preserved. Keep a separate copy.');}
}
async function persist(next,writes,before,autoKey) {
  const all=[...next.drafts,...next.library], persisted=all.filter(e=>!e.memory), memory=all.filter(e=>e.memory);
  const memoryValues={};
  for(const e of memory)if(writes.has(e.ref))memoryValues[memoryKey(e.ref)]=writes.get(e.ref);
  const disk={...next};
  if(next.sessionOnly) {
    disk.sessionRef=MEMORY+'index-'+crypto.randomUUID();disk.drafts=[];
    memoryValues[disk.sessionRef]={generation:next.generation,drafts:next.drafts};
  } else disk.sessionRef=null;
  const oldDisk=[...before.drafts,...before.library].filter(e=>!e.memory), keepDisk=new Set(persisted.map(e=>e.ref));
  const diskWrites=new Map([...writes].filter(([ref])=>keepDisk.has(ref)));
  const stagedKeys=Object.keys(memoryValues);
  try {
    if(stagedKeys.length)await chrome.storage.session.set(memoryValues);
    await D.apply(disk,diskWrites,oldDisk.filter(e=>!keepDisk.has(e.ref)).map(e=>e.ref),autoKey);
  } catch(error) {
    const oldMemory=new Set(before.drafts.filter(e=>e.memory).map(e=>memoryKey(e.ref)));
    await chrome.storage.session.remove(stagedKeys.filter(k=>!oldMemory.has(k))).catch(()=>{});
    throw error;
  }
  catalog=disk;
  const kept=new Set(all.map(e=>e.ref));for(const ref of plaintext.keys())if(!kept.has(ref))plaintext.delete(ref);
  // Cleanup failure cannot turn a committed save into a reported failure.
  await cleanupMemory({...next,sessionRef:disk.sessionRef}).catch(()=>{});
  await notify();
}
async function entryFor(record,group,index,existing,rekey=false) {
  const memory=group==='drafts' && index.sessionOnly;
  if(existing && !rekey)return {...existing,memory};
  return {id:record.id,ref:crypto.randomUUID(),key:record.key || '',kind:record.kind || 'library',
    fieldKey:record.fieldKey || '',site:record.origin ? await hash(record.origin) : '',saved:record.saved,started:record.started ?? record.saved,
    expires:record.expires || 0,bytes:size(record),memory};
}
async function replaceState(state,next,before,rekey=false,autoKey) {
  C.bounded(state);
  const writes=new Map(), populated=[];next={...next,...config(state),drafts:[],library:[]};
  for(const group of ['drafts','library'])for(const record of state[group]) {
    const old=bindings.get(record), entry=await entryFor(record,group,next,old,rekey);
    if(!old || rekey)writes.set(entry.ref,await envelope(record,next,entry.ref,autoKey));
    else if(old.memory!==entry.memory)writes.set(entry.ref,(await readEnvelopes([old])).get(old.ref));
    next[group].push(entry);populated.push([entry,record]);
  }
  await persist(next,writes,before,autoKey || (next.mode==='automatic' ? autoCache : undefined));
  for(const [entry,record] of populated){const value=frozen(record);plaintext.set(entry.ref,value);bindings.set(value,entry);}
}
export async function publicState() {
  await ensure();const index=await effective();index.drafts=index.drafts.filter(d=>d.expires>Date.now());return index;
}
export async function load() {
  const index=await publicState();
  if(index.mode==='vault' && !await privateKey(index))throw new Error('Vault is locked. Unlock it to view saved answers. Saving continues.');
  const entries=[...index.drafts,...index.library], missing=entries.filter(e=>!plaintext.has(e.ref));
  const values=await readEnvelopes(missing);
  for(const entry of missing)plaintext.set(entry.ref,await decrypt(entry,index,values.get(entry.ref)));
  const state={...config(index),drafts:[],library:[]};
  for(const group of ['drafts','library'])for(const entry of index[group]) {
    let record=plaintext.get(entry.ref);
    if(group==='drafts' && record.expires!==entry.expires)record=frozen({...record,expires:entry.expires});
    state[group].push(record);bindings.set(record,entry);
  }
  return state;
}
export async function view(origin) {
  const index=await publicState(), locked=index.mode==='vault' && !await privateKey(index);
  const state=locked ? {...config(index),drafts:[],library:[]} : await load();
  const site=origin ? await hash(origin) : '';
  return {...state,mode:index.mode,locked,draftCount:index.drafts.length,libraryCount:index.library.length,
    siteDraftCount:index.drafts.filter(d=>d.site===site).length};
}
export async function commit(state) {
  await ensure();const before=await effective();
  if(before.mode==='vault' && !await privateKey(before))throw new Error('Vault is locked. Unlock it before changing saved answers.');
  await replaceState(state,{...before},before);
}
export async function capture(incoming) {
  if(typeof incoming.text!=='string' || incoming.text.length>C.MAX_TEXT)
    throw new Error('Invalid draft: answers over 100,000 UTF-16 units cannot be saved. Keep a separate copy.');
  if(!incoming.text)return {saved:true,evicted:0};
  await ensure();const before=await effective(), now=Date.now(), id=crypto.randomUUID();
  let record={...incoming,id};if(!before.metadata)record=C.minimalDraft(record);
  const provisional=await entryFor({...record,saved:now},'drafts',before);
  const drafts=C.planDraft(before.drafts,provisional,before.days,now);
  record={...record,saved:drafts[0].saved,started:drafts[0].started,expires:drafts[0].expires};
  drafts[0].bytes=size(record);
  const next={...before,drafts}, libraryBytes=next.library.reduce((n,e)=>n+e.bytes,0), overhead=size(config(next));
  let evicted=0;
  const full=()=>drafts.length>C.MAX_DRAFTS || drafts.reduce((n,e)=>n+e.bytes,0)+libraryBytes+overhead>C.MAX_BYTES ||
    next.sessionOnly && drafts.reduce((n,e)=>n+e.bytes,0)>SESSION_BYTES;
  while(drafts.length>1 && full()) {
    let oldest=1;for(let i=2;i<drafts.length;i++)if(drafts[i].saved<drafts[oldest].saved)oldest=i;
    drafts.splice(oldest,1);evicted++;
  }
  if(full())throw new Error('Local storage is full. Your last change was not saved. Export or delete library answers and try again.');
  next.evicted=(before.evicted || 0)+evicted;
  const autoKey=next.mode==='automatic' ? await automatic(before) : undefined;
  await persist(next,new Map([[provisional.ref,await envelope(record,next,provisional.ref,autoKey)]]),before,autoKey);
  if(next.mode==='automatic' || await privateKey(next)){const value=frozen(record);plaintext.set(provisional.ref,value);bindings.set(value,drafts[0]);}
  return {saved:true,evicted};
}
export async function updateIndex(change) {
  await ensure();const before=await effective(), next={...before,sites:[...before.sites],blockedSites:[...before.blockedSites],ignoredFields:[...before.ignoredFields],drafts:[...before.drafts],library:[...before.library]};
  await change(next);
  next.drafts=next.drafts.filter(d=>d.expires>Date.now());
  if(next.sessionOnly) {
    next.drafts.sort((a,b)=>b.saved-a.saved);
    while(next.drafts.length && next.drafts.reduce((n,e)=>n+e.bytes,0)>SESSION_BYTES) {
      next.drafts.pop();next.evicted=(next.evicted || 0)+1;
    }
  }
  const moved=next.drafts.map(e=>({...e,memory:next.sessionOnly})), changing=moved.filter((e,i)=>e.memory!==next.drafts[i].memory);
  const values=await readEnvelopes(changing.map(e=>before.drafts.find(old=>old.ref===e.ref)));
  next.drafts=moved;await persist(next,values,before);
}
export async function privacy(settings) {
  const before=await publicState();
  if(settings.metadata===false && before.metadata && before.drafts.length) {
    const state=await load();state.metadata=false;
    state.drafts=state.drafts.map(C.minimalDraft);
    await commit(state);
  }
  await updateIndex(next=>{
    if(typeof settings.metadata==='boolean')next.metadata=settings.metadata;
    if(typeof settings.sessionOnly==='boolean')next.sessionOnly=settings.sessionOnly;
  });
}
export async function enableVault(passphrase) {
  const state=await load(), before=await effective();
  if(before.mode==='vault')throw new Error('Vault is already enabled.');
  const created=await V.createVault(passphrase), generation=crypto.randomUUID();
  const next={...before,mode:'vault',generation,vault:created.header};
  await chrome.storage.session.set({[SECRET]:{generation,privateKey:created.sessionKey}});
  try{await replaceState(state,next,before,true);}
  catch(error){await chrome.storage.session.remove(SECRET);throw error;}
  privateCache={generation,key:created.privateKey};autoCache=undefined;
}
export async function unlock(passphrase) {
  await ensure();if(catalog.mode!=='vault')return;
  const result=await V.unlockVault(catalog.vault,passphrase);
  await chrome.storage.session.set({[SECRET]:{generation:catalog.generation,privateKey:result.sessionKey}});
  privateCache={generation:catalog.generation,key:result.privateKey};await notify();
}
export async function lock() {
  await chrome.storage.session.remove(SECRET);privateCache=null;plaintext.clear();await notify();
}
export async function disableVault(passphrase) {
  await ensure();if(catalog.mode!=='vault')return;
  await unlock(passphrase);const state=await load(), before=await effective();
  const next={...before,mode:'automatic',generation:crypto.randomUUID()};delete next.vault;
  const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  await replaceState(state,next,before,true,key);autoCache=key;
  await chrome.storage.session.remove(SECRET);privateCache=null;publicCache=null;
}
export async function changePassphrase(oldPassphrase,newPassphrase) {
  await ensure();if(catalog.mode!=='vault')throw new Error('Vault is not enabled.');
  const wrapped=await V.rewrapVault(catalog.vault,oldPassphrase,newPassphrase);
  await updateIndex(next=>{next.vault=wrapped;});
}
export async function erase() {
  // Persist an empty index first; a blocked database deletion cannot expose old data.
  await ensure();const before=await effective();
  await persist(blank(),new Map(),before);
  await D.erase();
  await chrome.storage.session.clear();
  await chrome.storage.local.remove(['state','cairn-v2']);
  // The legacy key/database is absent after migration, but clear it if cleanup was interrupted.
  await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase('cairn-keys');r.onsuccess=resolve;r.onerror=()=>reject(new Error('Local storage key deletion failed.'));r.onblocked=()=>reject(new Error('Local storage key deletion is blocked.'));});
  catalog=undefined;initializing=undefined;autoCache=undefined;privateCache=null;publicCache=null;plaintext.clear();
  await notify();
}
