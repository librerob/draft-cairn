/* Web Crypto only. No passphrase, key material, or plaintext is logged. */
const encoder=new TextEncoder(), decoder=new TextDecoder();
export const ITERATIONS=600000;
const MAX_ENCODED=12*1024*1024;
export function encode(bytes) {
  let value='';for(let i=0;i<bytes.length;i+=8192)value+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(value);
}
export function decode(value,max=MAX_ENCODED) {
  if(typeof value!=='string' || value.length>max || !/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw new Error('Invalid encrypted data.');
  return Uint8Array.from(atob(value),c=>c.charCodeAt(0));
}
function validatePassphrase(value,creating=false) {
  if(typeof value!=='string' || !value || value.length>1024 || creating && Array.from(value).length<12)
    throw new Error(creating ? 'Choose a passphrase of at least 12 characters (up to 1,024 UTF-16 units).' : 'Enter your passphrase.');
}
export async function seal(value,key,label) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(label)},key,encoder.encode(JSON.stringify(value)));
  return {v:1,iv:encode(iv),data:encode(new Uint8Array(data))};
}
export async function open(envelope,key,label) {
  if(envelope?.v!==1)throw new Error('Invalid encrypted data.');
  const iv=decode(envelope.iv,24);if(iv.length!==12)throw new Error('Invalid encrypted data.');
  const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:encoder.encode(label)},key,decode(envelope.data));
  return JSON.parse(decoder.decode(bytes));
}
async function passwordKey(passphrase,kdf) {
  validatePassphrase(passphrase);
  if(kdf?.name!=='PBKDF2' || kdf.hash!=='SHA-256' || !Number.isInteger(kdf.iterations) || kdf.iterations<100000 || kdf.iterations>2000000)
    throw new Error('Invalid encrypted data.');
  const salt=decode(kdf.salt,48);if(salt.length!==16)throw new Error('Invalid encrypted data.');
  const material=await crypto.subtle.importKey('raw',encoder.encode(passphrase),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({...kdf,salt},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function protect(value,passphrase,label) {
  validatePassphrase(passphrase,true);
  const kdf={name:'PBKDF2',hash:'SHA-256',iterations:ITERATIONS,salt:encode(crypto.getRandomValues(new Uint8Array(16)))};
  return {kdf,payload:await seal(value,await passwordKey(passphrase,kdf),label)};
}
async function unprotect(envelope,passphrase,label) {
  try{return await open(envelope.payload,await passwordKey(passphrase,envelope.kdf),label);}
  catch{throw new Error('Passphrase is incorrect or the encrypted data is damaged.');}
}
export async function importPublic(value) {
  return crypto.subtle.importKey('spki',decode(value,2048),{name:'RSA-OAEP',hash:'SHA-256'},false,['wrapKey']);
}
export async function importPrivate(value) {
  return crypto.subtle.importKey('pkcs8',decode(value,8192),{name:'RSA-OAEP',hash:'SHA-256'},false,['unwrapKey']);
}
export async function createVault(passphrase) {
  validatePassphrase(passphrase,true);
  const pair=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:3072,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['wrapKey','unwrapKey']);
  const publicKey=encode(new Uint8Array(await crypto.subtle.exportKey('spki',pair.publicKey)));
  const sessionKey=encode(new Uint8Array(await crypto.subtle.exportKey('pkcs8',pair.privateKey)));
  const wrapped=await protect({privateKey:sessionKey},passphrase,'draft-cairn-private-key-v1');
  return {header:{v:1,publicKey,...wrapped},sessionKey,privateKey:await importPrivate(sessionKey),publicKey:await importPublic(publicKey)};
}
export async function unlockVault(header,passphrase) {
  if(header?.v!==1)throw new Error('Invalid encrypted data.');
  const value=await unprotect(header,passphrase,'draft-cairn-private-key-v1');
  const privateKey=await importPrivate(value.privateKey);
  // Verify that the wrapped private key actually belongs to this public key.
  const label='draft-cairn-key-check';
  const check=await sealHybrid({check:true},await importPublic(header.publicKey),label);
  if(!(await openHybrid(check,privateKey,label)).check)throw new Error('Invalid encrypted data.');
  return {privateKey,sessionKey:value.privateKey};
}
export async function rewrapVault(header,oldPassphrase,newPassphrase) {
  const {sessionKey}=await unlockVault(header,oldPassphrase);
  return {...header,...await protect({privateKey:sessionKey},newPassphrase,'draft-cairn-private-key-v1')};
}
export async function sealHybrid(value,publicKey,label) {
  const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt']);
  const wrapped=await crypto.subtle.wrapKey('raw',key,publicKey,{name:'RSA-OAEP',label:encoder.encode(label)});
  return {...await seal(value,key,label),wrapped:encode(new Uint8Array(wrapped))};
}
export async function openHybrid(envelope,privateKey,label) {
  const key=await crypto.subtle.unwrapKey('raw',decode(envelope.wrapped,1024),privateKey,{name:'RSA-OAEP',label:encoder.encode(label)},{name:'AES-GCM',length:256},false,['decrypt']);
  return open(envelope,key,label);
}
export async function encryptExport(raw,passphrase) {
  let value;try{value=JSON.parse(raw);}catch{throw new Error('Invalid library JSON.');}
  if(value?.format!=='draft-cairn-library' || value.version!==1 || !Array.isArray(value.answers))throw new Error('Invalid library JSON.');
  return JSON.stringify({format:'draft-cairn-encrypted-library',version:1,...await protect(value,passphrase,'draft-cairn-library-export-v1')},null,2);
}
export async function decryptExport(raw,passphrase) {
  if(typeof raw!=='string' || raw.length>MAX_ENCODED)throw new Error('Import is too large.');
  let envelope;try{envelope=JSON.parse(raw);}catch{throw new Error('Invalid encrypted library file.');}
  if(envelope?.format!=='draft-cairn-encrypted-library' || envelope.version!==1)throw new Error('Unsupported encrypted library format.');
  const value=await unprotect(envelope,passphrase,'draft-cairn-library-export-v1');
  if(value?.format!=='draft-cairn-library' || value.version!==1 || !Array.isArray(value.answers))throw new Error('Invalid encrypted library file.');
  return JSON.stringify(value);
}
