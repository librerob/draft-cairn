import test from 'node:test';
import assert from 'node:assert/strict';
import '../extension/core.js';
const C=globalThis.Cairn;
const field={tag:'TEXTAREA',type:'textarea',id:'summary',name:'summary',label:'Summary',form:'application',placeholder:'',autocomplete:'on',visible:true,disabled:false,readOnly:false,private:false,maxLength:500};
test('captures long answers; excludes sensitive hints, input types, and hidden fields',()=>{
  assert(C.allowedField(field));assert(C.allowedField({...field,tag:'INPUT',type:'text',maxLength:200}));
  for(const delta of [{tag:'INPUT',type:'password'},{tag:'INPUT',type:'email'},{tag:'INPUT',type:'hidden'},{tag:'INPUT',type:'text',maxLength:40},{visible:false},{disabled:true},{readOnly:true},{private:true},{autocomplete:'off'},{autocomplete:'one-time-code'},{autocomplete:'cc-number'},{name:'payment-card'},{label:'API token'},{label:'Bank details'},{label:'One time code'}]) assert.equal(C.allowedField({...field,...delta}),false);
});
test('paste capacity respects existing text, selection and UTF-16',()=>{
  assert.deepEqual(C.pasteCapacity('abcdef',2,4,'1234567',10),{available:6,total:11,oversized:true});
  assert.equal(C.pasteCapacity('abcdef',0,6,'1234567890',10).oversized,false);
  assert.equal(C.pasteCapacity('a',1,1,'😀',2).oversized,true);
  assert.equal(C.pasteCapacity('',0,0,'e\u0301',1).total,2);
  assert.equal(C.pasteCapacity('',0,0,'👨‍👩‍👧‍👦',10).oversized,true);
});
test('never restore duplicate identity, changed structure, wrong page, existing uncertainty',()=>{
  const saved={field,pageKey:'a',structure:'b',restorable:true};
  assert.equal(C.matchField(saved,[field], 'a','b',true),field);
  for(const args of [[[field,field],'a','b',true],[[field],'c','b',true],[[field],'a','c',true],[[field],'a','b',false],[[{...field,id:'other'}],'a','b',true]]) assert.equal(C.matchField(saved,...args),null);
  assert.equal(C.matchField({...saved,field:{...field,id:'',name:''}},[{...field,id:'',name:''}],'a','b',true),null);
});
test('revisions and quotas are bounded without silently discarding another field',()=>{
  const state=C.fresh();
  for(let n=0;n<12;n++)C.addDraft(state,{key:'a',kind:'draft',text:`Synthetic revision ${n}`},n*31000);
  assert.equal(state.drafts.length,4);
  const latest=state.drafts[0];C.addDraft(state,{key:'a',kind:'draft',text:'Another edit'},latest.saved+1);assert.equal(state.drafts.length,4);
  assert.throws(()=>C.addDraft(state,{key:'a',kind:'draft',text:'x'.repeat(C.MAX_TEXT+1)}));
  assert.throws(()=>C.bounded({...C.fresh(),library:Array(301).fill({text:'synthetic'})}));
});
test('expiry applies to drafts and original pastes, never explicit library answers',()=>{
  const state=C.fresh();state.library=[{title:'Synthetic',text:'Example'}];
  C.addDraft(state,{key:'a',kind:'draft',text:'Example'},0);C.addDraft(state,{key:'b',kind:'paste',text:'Original'},0);
  assert.equal(state.drafts.find(d=>d.kind==='paste').expires,3600000);
  C.prune(state,3600001);assert.equal(state.drafts.length,1);C.prune(state,7*C.DAY);assert.equal(state.drafts.length,0);assert.equal(state.library.length,1);
});
test('versioned imports validate every item before mutation; hostile text remains text',()=>{
  const raw=JSON.stringify({format:'draft-cairn-library',version:1,answers:[{title:'<img src=x onerror=alert(1)>',text:'<script>synthetic</script>',project:'Example'}]});
  assert.equal(C.parseImport(raw)[0].text,'<script>synthetic</script>');
  for(const bad of ['{', '{}', JSON.stringify({format:'draft-cairn-library',version:2,answers:[]}),JSON.stringify({format:'draft-cairn-library',version:1,answers:[{title:'Fine',text:'Example'},{title:2,text:'Invalid'}]})])assert.throws(()=>C.parseImport(bad));
});
test('site identifiers and patterns omit query, fragments and credentials',()=>{
  assert.equal(C.originOf('https://example.test/app?token=synthetic#private'),'https://example.test');
  assert.equal(C.hostPattern('https://example.test:444'),'https://example.test/*');
  assert.throws(()=>C.originOf('file:///tmp/example'));assert.throws(()=>C.originOf('chrome://settings'));
});
