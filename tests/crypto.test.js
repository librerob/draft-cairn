import test from 'node:test';
import assert from 'node:assert/strict';
import * as V from '../extension/crypto.js';
const passphrase='Synthetic testing phrase only';
let vault;
test('public key captures large answers; wrapped private key requires the correct passphrase',async()=>{
  vault=await V.createVault(passphrase);
  const payload={text:'Synthetic private answer '.repeat(4000),title:'Synthetic title'};
  const publicKey=await V.importPublic(vault.header.publicKey);
  const first=await V.sealHybrid(payload,publicKey,'record-a');
  const second=await V.sealHybrid(payload,publicKey,'record-a');
  assert.notEqual(first.iv,second.iv);assert.notEqual(first.data,second.data);assert.notEqual(first.wrapped,second.wrapped);
  assert(!JSON.stringify(vault.header).includes(vault.sessionKey));
  assert(!JSON.stringify(first).includes('Synthetic'));
  const unlocked=await V.unlockVault(vault.header,passphrase);
  assert.equal(unlocked.privateKey.extractable,false);
  assert.deepEqual(await V.openHybrid(first,unlocked.privateKey,'record-a'),payload);
  await assert.rejects(V.unlockVault(vault.header,'Synthetic incorrect phrase'),/Passphrase is incorrect/);
  await assert.rejects(V.openHybrid(first,unlocked.privateKey,'record-b'));
  const damaged={...first,data:(first.data[0]==='A'?'B':'A')+first.data.slice(1)};
  await assert.rejects(V.openHybrid(damaged,unlocked.privateKey,'record-a'));
});
test('passphrase change preserves the public key and rejects the previous passphrase',async()=>{
  const changed=await V.rewrapVault(vault.header,passphrase,'A different synthetic phrase');
  assert.equal(changed.publicKey,vault.header.publicKey);
  await assert.rejects(V.unlockVault(changed,passphrase));
  assert.equal((await V.unlockVault(changed,'A different synthetic phrase')).sessionKey,vault.sessionKey);
});
test('encrypted library exports validate passwords and reject hostile KDF costs',async()=>{
  const raw=JSON.stringify({format:'draft-cairn-library',version:1,answers:[{title:'Synthetic title',text:'Synthetic answer',project:'Synthetic project'}]});
  const encrypted=await V.encryptExport(raw,passphrase);
  assert(!encrypted.includes('Synthetic'));
  assert.deepEqual(JSON.parse(await V.decryptExport(encrypted,passphrase)),JSON.parse(raw));
  await assert.rejects(V.decryptExport(encrypted,'Wrong synthetic phrase'));
  const hostile=JSON.parse(encrypted);hostile.kdf.iterations=Number.MAX_SAFE_INTEGER;
  await assert.rejects(V.decryptExport(JSON.stringify(hostile),passphrase));
  await assert.rejects(V.encryptExport(raw,'short'),/at least 12/);
});
