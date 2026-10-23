import test from 'node:test';
import assert from 'node:assert/strict';
import '../extension/core.js';
const C=globalThis.Cairn;
const field={tag:'TEXTAREA',type:'textarea',id:'summary',name:'summary',label:'Summary',form:'application',placeholder:'',autocomplete:'on',visible:true,disabled:false,readOnly:false,private:false,maxLength:500};
test('captures long answers; excludes sensitive hints, input types, and hidden fields',()=>{
  assert(C.allowedField(field));assert(C.allowedField({...field,tag:'INPUT',type:'text',maxLength:200}));
  for(const delta of [{tag:'INPUT',type:'password'},{tag:'INPUT',type:'email'},{tag:'INPUT',type:'hidden'},{tag:'INPUT',type:'text',maxLength:40},{visible:false},{disabled:true},{readOnly:true},{private:true},{autocomplete:'one-time-code'},{autocomplete:'section-a billing cc-number'},{autocomplete:'current-password'},{autocomplete:'email'},{name:'paymentCardNumber'},{label:'API token'},{label:'Bank details'},{label:'One time code'},{name:'verification_code'},{placeholder:'Your passport number'}]) assert.equal(C.allowedField({...field,...delta}),false,JSON.stringify(delta));
  for(const label of ['payment schedule','credit and acknowledgement plan','scorecard summary','relationship with the bank','verification of eligibility']) assert(C.allowedField({...field,label}),label);
  for(const autocomplete of ['off','on','','section-application off'])assert(C.allowedField({...field,autocomplete}));
});
test('paste capacity respects existing text, selection and UTF-16',()=>{
  assert.deepEqual(C.pasteCapacity('abcdef',2,4,'1234567',10),{available:6,total:11,oversized:true});
  assert.equal(C.pasteCapacity('abcdef',0,6,'1234567890',10).oversized,false);
  assert.equal(C.pasteCapacity('a',1,1,'😀',2).oversized,true);
  assert.equal(C.pasteCapacity('',0,0,'e\u0301',1).total,2);
  assert.equal(C.pasteCapacity('',0,0,'👨‍👩‍👧‍👦',10).oversized,true);
});

test('post-paste comparison preserves selection, Unicode and significant whitespace',()=>{
  const expected=C.expectedPaste('abcdef',2,4,'😀\r\ne\u0301');
  assert.equal(expected,'ab😀\ne\u0301ef');
  assert.equal(C.comparePaste(expected,'ab😀\r\ne\u0301ef').changed,false);
  assert.equal(C.comparePaste(expected,'ab😀\neef').changed,true);
  assert.equal(C.comparePaste('one two','one  two').changed,true);
  assert.equal(C.comparePaste('answer\n','answer').changed,true);
  assert.equal(C.comparePaste(null,'answer').verified,false);
  assert.equal(C.expectedPaste('abc',3,2,'x'),null);
  assert.equal(C.expectedPaste('',0,0,'x'.repeat(C.MAX_TEXT+1)),null);
});

test('only named rich-text adapters qualify and keep sensitive-field exclusions',()=>{
  for(const type of ['quill','prosemirror','ckeditor5','tinymce-inline']) {
    const rich={...field,tag:'DIV',type,maxLength:-1};assert(C.allowedField(rich));
    for(const delta of [{private:true},{readOnly:true},{disabled:true},{visible:false},{label:'Password'},{autocomplete:'cc-number'}])assert.equal(C.allowedField({...rich,...delta}),false);
  }
  assert.equal(C.allowedField({...field,tag:'DIV',type:'contenteditable'}),false);
});
test('never restore duplicate identity, changed structure, wrong page, existing uncertainty',()=>{
  const saved={field,pageKey:'a',structure:'b',restorable:true};
  assert.equal(C.matchField(saved,[field], 'a','b',true),field);
  for(const args of [[[field,field],'a','b',true],[[field],'c','b',true],[[field],'a','c',true],[[field],'a','b',false],[[{...field,id:'other'}],'a','b',true]]) assert.equal(C.matchField(saved,...args),null);
  assert.equal(C.matchField({...saved,field:{...field,id:'',name:''}},[{...field,id:'',name:''}],'a','b',true),null);
});
test('revisions and quotas remain bounded',()=>{
  const state=C.fresh();
  for(let n=0;n<12;n++)C.addDraft(state,{key:'a',kind:'draft',text:`Synthetic revision ${n}`},n*31000);
  assert.equal(state.drafts.length,4);
  const latest=state.drafts[0];C.addDraft(state,{key:'a',kind:'draft',text:'Another edit'},latest.saved+1);assert.equal(state.drafts.length,4);
  assert.throws(()=>C.addDraft(state,{key:'a',kind:'draft',text:'x'.repeat(C.MAX_TEXT+1)}));
  assert.throws(()=>C.bounded({...C.fresh(),library:Array(301).fill({text:'synthetic'})}));
  assert.throws(()=>C.bounded({...C.fresh(),drafts:Array(181).fill({text:'synthetic'})}));
  assert.throws(()=>C.bounded({...C.fresh(),library:Array(70).fill({text:'x'.repeat(100000)})}));
});
test('newest recovery survives draft-count pressure; eviction is oldest-first and disclosed',()=>{
  const state=C.fresh();state.library=[{title:'Keep',text:'Never evict a library answer'}];
  for(let n=0;n<220;n++)C.addDraft(state,{key:`field-${n}`,kind:'draft',text:`Answer ${n}`},n);
  assert.equal(state.drafts.length,180);assert.equal(state.evicted,40);
  assert.equal(state.drafts[0].text,'Answer 219');assert(!state.drafts.some(d=>d.text==='Answer 0'));
  assert(state.drafts.some(d=>d.text==='Answer 40'));assert.equal(state.library.length,1);
});
test('byte pressure evicts recovery, preserves library, and reserves capacity for new drafts',()=>{
  const state=C.fresh();state.library=Array.from({length:40},(_,i)=>({title:String(i),text:'x'.repeat(100000)}));
  C.libraryBounded(state);
  for(let n=0;n<60;n++)C.addDraft(state,{key:String(n),kind:'draft',text:'y'.repeat(100000)},n);
  assert(C.stateBytes(state)<=C.MAX_BYTES);assert(state.evicted>0);
  assert.equal(state.drafts[0].key,'59');assert.equal(state.library.length,40);
  const exact=new TextEncoder().encode(JSON.stringify(state)).length;assert.equal(C.stateBytes(state),exact);
  assert.throws(()=>C.libraryBounded({...state,library:Array.from({length:60},()=>({title:'Large',text:'x'.repeat(100000)}))}),/Recovery capacity/);
  assert.throws(()=>C.addDraft(C.fresh(),{text:'x'.repeat(100001)}),/Invalid draft/);
});
test('expiry applies to drafts and original pastes, never explicit library answers',()=>{
  const state=C.fresh();state.library=[{title:'Synthetic',text:'Example'}];
  C.addDraft(state,{key:'a',kind:'draft',text:'Example'},0);C.addDraft(state,{key:'b',kind:'paste',text:'Original'},0);
  assert.equal(state.drafts.find(d=>d.kind==='paste').expires,3600000);
  C.prune(state,3600001);assert.equal(state.drafts.length,1);C.prune(state,7*C.DAY);assert.equal(state.drafts.length,0);assert.equal(state.library.length,1);
});
test('continuous typing produces checkpoints instead of indefinitely replacing history',()=>{
  const state=C.fresh();
  for(let n=0;n<20;n++)C.addDraft(state,{key:'continuous',kind:'draft',text:`Synthetic ongoing edit ${n}`},n*5000);
  assert.equal(state.drafts.length,4);assert.equal(state.drafts[0].text,'Synthetic ongoing edit 19');
  assert.equal(state.drafts[1].saved,85000);
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
test('privacy defaults preserve upgrades while minimizing new installations',()=>{
  const fresh=C.fresh();assert.equal(fresh.days,1);assert.equal(fresh.metadata,false);assert.equal(fresh.sessionOnly,false);
  const old={version:1,days:7,sites:[],drafts:[],library:[]},upgraded=C.privacyDefaults(old);
  assert.equal(upgraded.days,7);assert.equal(upgraded.metadata,true);assert.deepEqual(upgraded.blockedSites,[]);
  const minimal=C.minimalDraft({title:'Sensitive title',field:{label:'Sensitive label',id:'sensitive'},restorable:true,text:'Kept answer'});
  assert.equal(minimal.text,'Kept answer');assert.equal(minimal.title,'');assert.deepEqual(minimal.field,{label:''});assert.equal(minimal.restorable,false);
});
test('locked revision planning needs no answer text and keeps bounded checkpoints',()=>{
  let drafts=[];for(let i=0;i<8;i++)drafts=C.planDraft(drafts,{id:String(i),key:'same',kind:'draft',ref:String(i)},1,100000+i*31000);
  assert.equal(drafts.length,4);assert.deepEqual(drafts.map(d=>d.id),['7','6','5','4']);
  const next=C.planDraft(drafts,{id:'8',key:'same',kind:'draft',ref:'8'},1,drafts[0].saved+1000);
  assert.equal(next.length,4);assert.equal(next[0].started,drafts[0].started);assert(!next.some(d=>d.id==='7'));
  const paste=C.planDraft([],{id:'paste',kind:'paste',key:'paste'},7,100000)[0];assert.equal(paste.expires,3700000);
});
