/* Persistent record/index updates share one IndexedDB transaction. */
let connection;
export async function database() {
  if(!connection)connection=new Promise((resolve,reject)=>{
    const request=indexedDB.open('cairn-data-v3',1);
    request.onupgradeneeded=()=>{for(const name of ['meta','records','keys'])request.result.createObjectStore(name);};
    request.onsuccess=()=>{
      const db=request.result;db.onversionchange=()=>{db.close();connection=undefined;};resolve(db);
    };
    request.onerror=()=>{connection=undefined;reject(new Error('Local storage is unavailable. Keep a separate copy.'));};
  });
  return connection;
}
export async function get(store,key) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,'readonly'),request=tx.objectStore(store).get(key);
    tx.oncomplete=()=>resolve(request.result);tx.onabort=tx.onerror=()=>reject(new Error('Local storage could not be read.'));
  });
}
export async function records(refs) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('records','readonly'),store=tx.objectStore('records'),requests=refs.map(ref=>store.get(ref));
    tx.oncomplete=()=>resolve(new Map(refs.map((ref,i)=>[ref,requests[i].result])));
    tx.onabort=tx.onerror=()=>reject(new Error('Local storage could not be read.'));
  });
}
export async function apply(index,writes,remove=[],autoKey) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['meta','records','keys'],'readwrite'),store=tx.objectStore('records');
    for(const [ref,value] of writes)store.put(value,ref);
    for(const ref of remove)store.delete(ref);
    tx.objectStore('meta').put(index,'index');
    if(autoKey)tx.objectStore('keys').put(autoKey,'automatic');
    if(index.mode!=='automatic')tx.objectStore('keys').delete('automatic');
    tx.oncomplete=resolve;
    tx.onabort=tx.onerror=()=>reject(new Error('Local storage write failed. Earlier saved data was preserved. Keep a separate copy.'));
  });
}
export async function erase() {
  if(connection){(await connection).close();connection=undefined;}
  await new Promise((resolve,reject)=>{
    const request=indexedDB.deleteDatabase('cairn-data-v3');
    request.onsuccess=resolve;request.onerror=()=>reject(new Error('Local storage deletion failed.'));
    request.onblocked=()=>reject(new Error('Local storage deletion is blocked. Close other extension pages and try again.'));
  });
}
export async function reset(index) {
  const db=await database();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(['meta','records','keys'],'readwrite');
    for(const name of ['meta','records','keys'])tx.objectStore(name).clear();
    tx.objectStore('meta').put(index,'index');
    tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(new Error('Local storage deletion failed. Existing data was preserved.'));
  });
}
