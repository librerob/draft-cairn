import './core.js';
import {$,node,api,notice,action,copy,time} from './ui.js';
let state, tabs=[], pane='recovery';
const initialTab=Number(new URLSearchParams(location.search).get('tab'));
function empty(title,body) {const el=node('div',undefined,'empty');el.append(node('h3',title),node('p',body));return el;}
function openEditor(text='',title='',project='') {
  $('answer-title').value=title;$('answer-project').value=project;$('answer-text').value=text;
  $('editor-error').textContent='';count();$('answer-dialog').showModal();
  (text ? $('answer-text') : $('answer-title')).focus();
}
function count() {$('editor-count').textContent=`${$('answer-text').value.length.toLocaleString()} / 100,000 UTF-16 units`;}
function renderDrafts() {
  const q=$('draft-search').value.toLowerCase();$('drafts').replaceChildren();
  const list=state.drafts.filter(d=>[d.text,d.origin,d.field.label,d.title].join(' ').toLowerCase().includes(q));
  if(!list.length)$('drafts').append(empty('A fresh start, with a safety net.',q ? 'No drafts match your search.' : 'Enable protection from the extension popup before you write. Supported answers will appear here after saving.'));
  for(const d of list.sort((a,b)=>b.saved-a.saved)) {
    const card=node('article',undefined,'card draft');
    card.append(node('span',d.kind === 'paste' ? 'Original paste · up to 1 hour' : 'Recovery revision','badge'),node('h3',d.field.label || 'Untitled field'),node('div',d.title,'meta'),node('div',`${d.origin} · ${time(d.saved)}`,'meta'),node('pre',d.text));
    const controls=node('div',undefined,'row actions');
    controls.append(action('Copy',()=>copy(d.text),'primary'),action('Open editor',()=>openEditor(d.text,d.field.label || 'Recovered answer')),action('Delete',async()=>{if(confirm('Delete this revision?')){await api('DELETE_DRAFT',{id:d.id});await refresh();}},'quiet danger'));
    const eligible=tabs.filter(t=>{try{return !t.incognito && Cairn.originOf(t.url) === d.origin;}catch{return false;}});
    if(d.restorable && eligible.length && state.sites.includes(d.origin)) {
      const select=node('select');select.id=`tab-${d.id}`;
      const label=node('label','Destination tab');label.htmlFor=select.id;
      for(const t of eligible) {const option=node('option',t.title || d.origin);option.value=t.id;select.append(option);}
      if(eligible.some(t=>t.id === initialTab))select.value=initialTab;
      const restore=action('Restore to empty field',async()=>{
        if(!confirm('Restore this revision to the selected tab? Restoration only proceeds if the original field is uniquely matched and still empty.'))return;
        await api('RESTORE',{id:d.id,tabId:Number(select.value)});notice('Restored. Check the answer on the website before submitting.');
      });
      const target=node('div',undefined,'stack');target.style.marginTop='18px';target.append(label,select,restore);card.append(controls,target);
    } else {card.append(controls,node('p',d.restorable ? 'Open the original page on a protected site to attempt restoration, or copy this answer.' : 'Copy only: original paste or a page with query parameters / a fragment.','meta'));}
    $('drafts').append(card);
  }
}
function renderLibrary() {
  const q=$('library-search').value.toLowerCase();$('answers').replaceChildren();
  const list=state.library.filter(a=>[a.title,a.project,a.text].join(' ').toLowerCase().includes(q));
  if(!list.length)$('answers').append(empty('Keep the answers you return to.',q ? 'No answers match your search.' : 'Save an approved description, project summary, or useful paragraph. You decide what belongs here.'));
  for(const a of list) {
    const card=node('article',undefined,'card draft');const controls=node('div',undefined,'row');
    card.append(node('span',a.project || 'Ungrouped','badge'),node('h3',a.title),node('div',`Saved ${time(a.saved)}`,'meta'),node('pre',a.text));
    controls.append(action('Copy',()=>copy(a.text),'primary'),action('Open editor',()=>openEditor(a.text,a.title,a.project)),action('Delete',async()=>{if(confirm('Delete this saved answer?')){await api('DELETE_ANSWER',{id:a.id});await refresh();}},'quiet danger'));
    card.append(controls);$('answers').append(card);
  }
}
function renderSettings() {
  $('retention').value=state.days;$('sites').replaceChildren();
  const origins=[...new Set([...state.sites,...state.drafts.map(d=>d.origin)])].sort();
  if(!origins.length)$('sites').append(node('p','No protected websites yet. Open a website, then enable protection from the toolbar popup.','meta'));
  for(const origin of origins) {
    const row=node('div',undefined,'site');row.append(node('strong',origin),node('p',`${state.sites.includes(origin)?'Protection enabled':'Protection off'} · ${state.drafts.filter(d=>d.origin===origin).length} revisions`,'meta'));
    const controls=node('div',undefined,'row');
    if(state.sites.includes(origin))controls.append(action('Turn off',async()=>{await api('DISABLE',{origin});await refresh();notice('Protection is off. Existing drafts are kept.');}));
    controls.append(action('Delete site data',async()=>{if(confirm('Delete all drafts and protection settings for this site? Manually saved library answers remain.')){await api('DISABLE',{origin,erase:true});await refresh();notice('Site drafts and protection settings deleted.');}},'danger'));
    row.append(controls);$('sites').append(row);
  }
}
async function refresh() {
  state=await api('STATE');tabs=await chrome.tabs.query({});
  $('summary').textContent=`${state.drafts.length} revisions · ${state.library.length} library answers`;
  renderDrafts();renderLibrary();renderSettings();if(state.lastError)notice(state.lastError,true);
}
document.querySelectorAll('[data-pane]').forEach(button=>button.onclick=()=>{
  pane=button.dataset.pane;
  document.querySelectorAll('.pane').forEach(p=>p.hidden=p.id !== pane);
  document.querySelectorAll('[data-pane]').forEach(b=>{if(b===button)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
});
$('draft-search').oninput=renderDrafts;$('library-search').oninput=renderLibrary;
$('refresh').onclick=()=>refresh().catch(e=>notice(e.message,true));
$('new-answer').onclick=()=>openEditor();$('close-editor').onclick=()=>$('answer-dialog').close();
$('answer-dialog').addEventListener('close',()=>{$('answer-form').reset();$('editor-error').textContent='';count();});
$('answer-text').oninput=count;
$('copy-editor').onclick=async()=>{try{await navigator.clipboard.writeText($('answer-text').value);$('editor-error').textContent='Copied.';}catch{$('answer-text').focus();$('answer-text').select();$('editor-error').textContent='Press Ctrl+C or Command+C to copy the selected answer.';}};
$('answer-form').onsubmit=async e=>{
  e.preventDefault();const submit=e.submitter;submit.disabled=true;
  try {await api('SAVE_ANSWER',{answer:{title:$('answer-title').value,project:$('answer-project').value,text:$('answer-text').value}});$('answer-dialog').close();await refresh();notice('Answer saved to your library.');}
  catch(err){$('editor-error').textContent=err.message;}finally{submit.disabled=false;}
};
$('retention').onchange=async()=>{try{await api('RETENTION',{days:Number($('retention').value)});await refresh();notice('Retention updated. Shorter expiry applies to existing drafts too.');}catch(e){notice(e.message,true);}};
$('export').onclick=()=>{
  if(!confirm('This export contains complete library answers in plain text. Anyone with the file can read them. Continue?'))return;
  const data={format:'draft-cairn-library',version:1,answers:state.library.map(({title,text,project})=>({title,text,project}))};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const link=node('a');link.href=url;link.download='draft-cairn-library-v1.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('Library exported. Keep the file somewhere appropriate for its contents.');
};
$('import').onchange=async()=>{
  try {const file=$('import').files[0];if(!file)return;if(file.size>Cairn.MAX_BYTES)throw new Error('Import is too large.');const raw=await file.text();const validated=Cairn.parseImport(raw);if(!confirm(`Import ${validated.length} answers into this library?`))return;await api('IMPORT',{raw});await refresh();notice('Library imported. Exact duplicates were skipped.');}
  catch(e){notice(e.message,true);}finally{$('import').value='';}
};
$('clear').onclick=async()=>{if(!confirm('Permanently delete all extension drafts, library answers, settings, and site permissions?'))return;try{await api('CLEAR');await refresh();notice('All extension data and site access deleted.');}catch(e){notice(e.message,true);}};
chrome.storage.onChanged.addListener((changes,area)=>{
  const next=changes.state?.newValue;
  if(area==='local' && next && !next.sites.length && !next.drafts.length && !next.library.length) {
    if($('answer-dialog').open)$('answer-dialog').close();
    refresh().catch(()=>notice('Could not refresh local data.',true));
  }
});
refresh().catch(e=>notice(e.message,true));
