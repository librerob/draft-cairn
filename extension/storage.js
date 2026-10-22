/* AES-GCM records. The automatic local key is not a password-protected vault. */
const META = 'cairn-v2';
const PREFIX = 'cairn-record-';
const encoder = new TextEncoder(), decoder = new TextDecoder();
let cached, keyPromise;
const sealRecords = state => {
  for (const record of [...state.drafts,...state.library]) {
    if (record.field) Object.freeze(record.field);
    Object.freeze(record);
  }
  return state;
};
async function key() {
  if (!keyPromise) keyPromise = (async()=>{
    const db = await new Promise((resolve,reject)=>{
      const request=indexedDB.open('cairn-keys',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('keys');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(new Error('Local storage encryption key is unavailable. Keep a separate copy.'));
    });
    try {
      const existing=await new Promise((resolve,reject)=>{
        const tx=db.transaction('keys','readonly'), request=tx.objectStore('keys').get('aes');
        request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
      });
      if (existing) return existing;
      // Never replace a lost key when encrypted records already exist.
      if ((await chrome.storage.local.get(META))[META]) throw new Error('Local storage encryption key is missing. Existing encrypted data was preserved.');
      const created=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('keys','readwrite');tx.objectStore('keys').put(created,'aes');
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });
      return created;
    } finally {db.close();}
  })().catch(error=>{keyPromise=undefined;throw error;});
  return keyPromise;
}
function base64(bytes) {
  let text='';for (let i=0;i<bytes.length;i+=8192) text+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(text);
}
async function encrypt(value, label) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(label)},await key(),encoder.encode(JSON.stringify(value)));
  return {v:2,iv:base64(iv),data:base64(new Uint8Array(data))};
}
async function decrypt(envelope,label) {
  try {
    if (envelope?.v!==2) throw new Error();
    const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(envelope.iv),additionalData:encoder.encode(label)},await key(),decode(envelope.data));
    return JSON.parse(decoder.decode(plain));
  } catch {throw new Error('Local storage could not be decrypted. Existing data was preserved. Keep a separate copy.');}
}
export async function load() {
  if (!cached) {
    const stored=await chrome.storage.local.get(null);
    if (stored[META]) {
      const metadata=await decrypt(stored[META],META);
      const state={...metadata,drafts:[],library:[]}, refs=new Map();
      for (const group of ['drafts','library']) for (const ref of metadata[group]) {
        const record=await decrypt(stored[ref],ref);state[group].push(record);refs.set(record,ref);
      }
      cached={state:sealRecords(state),refs};
    } else if (stored.state) {
      // Commit encrypted data before removing the legacy plaintext state.
      await commit(stored.state);
    } else cached={state:globalThis.Cairn.fresh(),refs:new Map()};
    const used=new Set(cached.refs.values());
    const garbage=Object.keys(stored).filter(k=>k==='state' || k.startsWith(PREFIX) && !used.has(k));
    if (garbage.length) await chrome.storage.local.remove(garbage);
  }
  // Records are immutable; copying only the containers avoids cloning 6 MB per edit.
  return {...cached.state,sites:[...cached.state.sites],drafts:[...cached.state.drafts],library:[...cached.state.library]};
}
export async function commit(state) {
  globalThis.Cairn.bounded(state);
  const refs=new Map(), writes={}, metadata={...state,drafts:[],library:[]};
  for (const group of ['drafts','library']) for (const record of state[group]) {
    let ref=cached?.refs.get(record);
    if (!ref) {
      ref=PREFIX+crypto.randomUUID();writes[ref]=await encrypt(record,ref);
    }
    refs.set(record,ref);metadata[group].push(ref);
  }
  const previous=cached;
  // Stage changed records first. A failed metadata commit leaves the old index usable.
  try {
    if (Object.keys(writes).length) await chrome.storage.local.set(writes);
    await chrome.storage.local.set({[META]:await encrypt(metadata,META)});
  } catch(error) {
    // Staged records are not referenced by the old committed index.
    await chrome.storage.local.remove(Object.keys(writes)).catch(()=>{});
    throw error;
  }
  cached={state:sealRecords(state),refs};
  const used=new Set(refs.values());
  const obsolete=[...(previous?.refs.values() || [])].filter(ref=>!used.has(ref));
  if (obsolete.length) await chrome.storage.local.remove(obsolete);
  await chrome.storage.local.remove('state');
}
export async function erase() {
  // First publish an empty state, so concurrent UI refreshes cannot read old data.
  await commit(globalThis.Cairn.fresh());
  const stored=await chrome.storage.local.get(null);
  await chrome.storage.local.remove(Object.keys(stored).filter(k=>k===META || k==='state' || k.startsWith(PREFIX)));
  cached={state:globalThis.Cairn.fresh(),refs:new Map()};keyPromise=undefined;
  await new Promise((resolve,reject)=>{
    const request=indexedDB.deleteDatabase('cairn-keys');
    request.onsuccess=resolve;request.onerror=()=>reject(new Error('Local storage key deletion failed.'));
    request.onblocked=()=>reject(new Error('Local storage key deletion is blocked. Close other extension pages and try again.'));
  });
}
