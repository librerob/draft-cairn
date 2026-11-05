import test from 'node:test';
import assert from 'node:assert/strict';
import '../extension/workflows.js';
const W=globalThis.CairnWorkflows;
test('counter hints accept explicit bounded counters and reject unrelated or ambiguous prose',()=>{
  assert.deepEqual(W.counterHint('342/500 words'),{used:342,limit:500,unit:'words'});
  assert.deepEqual(W.counterHint('1,200 of 2,000 characters used'),{used:1200,limit:2000,unit:'characters'});
  for(const text of ['500 words remaining','Section 2/3','The deadline is 3/5 words','9/0 words','9999999999/10 words','20/50 bytes'])assert.equal(W.counterHint(text),null);
});
test('fit checks preserve UTF-16 limits and distinguish word estimates from website reports',()=>{
  assert(W.fit('😀',1,null).blocked);assert(!W.fit('😀',2,null).blocked);
  const fit=W.fit('one two three',-1,{used:1,limit:2,unit:'words'});
  assert.equal(fit.words,3);assert(!fit.blocked);assert.match(fit.message,/website reports 1\/2 words/);assert.match(fit.message,/over by 1/);
  assert.equal(W.countWords('  one\ntwo\tthree  '),3);
});
test('site batches require exact origins, reject credentials and paths, and stay bounded',()=>{
  assert.deepEqual(W.siteList('https://one.example\nhttps://two.example:444 https://one.example'),['https://one.example','https://two.example:444']);
  for(const raw of ['', 'https://one.example/form','https://u:p@one.example','https://one.example/?secret=x','file:///tmp/x',Array(21).fill('https://one.example').join('\n')])assert.throws(()=>W.siteList(raw));
});
test('retention overrides and managed policies are explicit and fail closed for an empty allowlist',()=>{
  assert.equal(W.retention({days:1,siteDays:{'https://one.example':14}},'https://one.example'),14);
  assert.equal(W.retention({days:1},'https://two.example'),1);
  assert.deepEqual(W.policy({AllowedOrigins:[],MaxRetentionDays:7}),{allowed:[],maxDays:7});
  assert.deepEqual(W.policy({AllowedOrigins:['https://one.example/path','https://one.example','file:///x']}),{allowed:['https://one.example'],maxDays:30});
});
test('snapshot exports label selected saved answers without implying successful submission',()=>{
  const draft={field:{label:'<Private>\nquestion'},saved:1000,text:'line one\n# answer heading\n\nline two'};
  const plain=W.markdown([draft],false);assert.match(plain,/## Answer 1/);assert(!plain.includes('Private'));assert.match(plain,/> # answer heading/);assert.match(plain,/not proof of submission/);
  const labelled=W.markdown([draft],true);assert.match(labelled,/\\<Private\\>/);assert(!labelled.includes('## <Private>'));
});
