import './core.js';
import {encryptExport,decryptExport} from './crypto.js';
import {$,node,api,notice,action,copy,time} from './ui.js';
let state, tabs=[], pane='recovery', refreshVersion=0, securityGeneration=0, securityMode='', pendingImport='';
const initialTab=Number(new URLSearchParams(location.search).get('tab'));
function empty(title,body) {const el=node('div',undefined,'empty');el.append(node('h3',title),node('p',body));return el;}
function openEditor(text='',title='',project='') {
  if(state?.locked)return;
  $('answer-title').value=title;$('answer-project').value=project;$('answer-text').value=text;
  $('editor-error').textContent='';count();$('answer-dialog').showModal();
  (text ? $('answer-text') : $('answer-title')).focus();
}
function count() {$('editor-count').textContent=`${$('answer-text').value.length.toLocaleString()} / 100,000 UTF-16 units`;}
function renderDrafts() {
  const q=$('draft-search').value.toLowerCase();$('drafts').replaceChildren();
  if(state.locked){$('drafts').append(empty('Your vault is locked.','Saving continues on enabled sites. Unlock to read, search or restore your answers.'));return;}
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
    } else {card.append(controls,node('p',d.restorable ? 'Open the original page on a protected site to attempt restoration, or copy this answer.' : 'Copy only: page details were not saved, this is an original paste, or the page has query parameters / a fragment.','meta'));}
    $('drafts').append(card);
  }
}
function renderLibrary() {
  const q=$('library-search').value.toLowerCase();$('answers').replaceChildren();
  if(state.locked){$('answers').append(empty('Your library is locked.','Unlock your vault to read or change library answers.'));return;}
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
  $('metadata').checked=state.metadata;$('session-only').checked=state.sessionOnly;
  $('metadata').disabled=state.locked && state.metadata;
  const vault=state.mode==='vault';
  $('enable-vault').hidden=vault;$('change-passphrase').hidden=!vault;$('disable-vault').hidden=!vault;
  $('lock-vault').hidden=!vault || state.locked;$('unlock-vault').hidden=!state.locked;
  $('vault-status').textContent=vault ? (state.locked ? 'Passphrase vault · locked' : 'Passphrase vault · unlocked for this session') : 'Automatic encryption · no password needed';
  $('vault-help').textContent=state.locked ? 'New drafts can still save. Unlock to read, search, restore or change library answers.' : vault ? 'Lock when you finish. Your clipboard, exported files and text on websites remain outside the vault.' : 'The automatic key is stored in this profile. Enable a passphrase vault in Sites & settings for protection of answer contents in a copied profile.';
  for(const id of ['new-answer','export','export-encrypted','import','draft-search','library-search'])$(id).disabled=state.locked;
  $('blocked-sites').replaceChildren(node('h3','Blocked websites'));
  if(!state.blockedSites.length)$('blocked-sites').append(node('p','No blocked websites.','meta'));
  for(const origin of state.blockedSites){const row=node('div',undefined,'site');row.append(node('strong',origin),action('Remove block',async()=>{await api('UNBLOCK_SITE',{origin});await refresh();notice('Block removed. Enable protection from the site popup when ready.');}));$('blocked-sites').append(row);}
  $('ignored-fields').replaceChildren(node('h3','Excluded fields'));
  if(!state.ignoredFields.length)$('ignored-fields').append(node('p','No excluded fields.','meta'));
  state.ignoredFields.forEach((f,i)=>{const row=node('div',undefined,'site');row.append(node('strong',`${f.origin} · exclusion ${i+1} (${f.id.slice(0,8)})`),action('Allow capture again',async()=>{await api('UNIGNORE_FIELD',{id:f.id});await refresh();}));$('ignored-fields').append(row);});
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
function scrub() {
  refreshVersion++;securityGeneration++;state=undefined;
  $('drafts').replaceChildren();$('answers').replaceChildren();
  $('draft-search').value='';$('library-search').value='';
  if($('answer-dialog').open)$('answer-dialog').close();$('answer-form').reset();
  if($('security-dialog').open)$('security-dialog').close();$('security-form').reset();pendingImport='';
}
async function refresh() {
  const version=++refreshVersion,next=await api('STATE'),openTabs=await chrome.tabs.query({});
  if(version!==refreshVersion)return;
  if(next.locked && !state?.locked || state && !next.draftCount && !next.libraryCount && (state.draftCount || state.libraryCount))scrub();
  state=next;tabs=openTabs;
  $('summary').textContent=`${state.draftCount} revisions · ${state.libraryCount} library answers`;
  renderDrafts();renderLibrary();renderSettings();
  $('ack-error').hidden=!state.lastError;
  if(state.lastError)notice(state.lastError,true);
  else if(state.evicted)notice(`Oldest recovery revisions have been removed as storage filled (${state.evicted}). Library answers are kept until you delete them.`);
}
document.querySelectorAll('[data-pane]').forEach(button=>button.onclick=()=>{
  pane=button.dataset.pane;
  document.querySelectorAll('.pane').forEach(p=>p.hidden=p.id !== pane);
  document.querySelectorAll('[data-pane]').forEach(b=>{if(b===button)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  refresh().catch(e=>notice(e.message,true));
});
$('draft-search').oninput=renderDrafts;$('library-search').oninput=renderLibrary;
$('refresh').onclick=()=>refresh().catch(e=>notice(e.message,true));
$('ack-error').onclick=async()=>{await api('ACK_ERROR');notice('Warning acknowledged. Check the affected answer before relying on recovery.');await refresh();};
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
function libraryJSON(){return JSON.stringify({format:'draft-cairn-library',version:1,answers:state.library.map(({title,text,project})=>({title,text,project}))});}
function download(raw,name){
  const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
  const link=node('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('export').onclick=()=>{
  if(state.locked || !confirm('Export complete library answers as readable JSON? Anyone with the file can read them, even after you lock or wipe the vault.'))return;
  download(libraryJSON(),'draft-cairn-library-v1.json');notice('Readable library exported. Protect this file separately.');
};
function security(mode) {
  securityMode=mode;$('security-form').reset();$('security-error').textContent='';
  const creating=['enable','change','export'].includes(mode);
  const titles={enable:'Enable passphrase vault',unlock:'Unlock vault',disable:'Return to automatic encryption',change:'Change vault passphrase',export:'Export encrypted library',import:'Import encrypted library'};
  $('security-title').textContent=titles[mode];$('security-submit').textContent=titles[mode];
  $('security-note').textContent=mode==='enable' ? 'Existing drafts and library answers will be encrypted with the new vault. Save this passphrase somewhere safe. Lost passphrases cannot be reset.' : mode==='disable' ? 'Enter your vault passphrase. Existing answers will return to automatic encryption with a key stored in this browser profile.' : mode==='export' ? 'Choose a passphrase for this backup. It can differ from your vault passphrase. A forgotten backup passphrase cannot be recovered.' : mode==='import' ? 'Enter the passphrase used when this backup was exported.' : mode==='change' ? 'This changes the vault passphrase. Previously exported files keep their own passphrases.' : 'Unlock to read your answers. New drafts can save while locked.';
  $('old-passphrase-field').hidden=mode!=='change';$('old-passphrase').required=mode==='change';
  $('confirm-passphrase-field').hidden=!creating;$('confirm-passphrase').required=creating;
  $('acknowledge-field').hidden=mode!=='enable';$('acknowledge').required=mode==='enable';
  $('passphrase').autocomplete=creating ? 'new-password' : 'current-password';
  $('passphrase-label').textContent=creating ? 'New passphrase (at least 12 characters)' : 'Passphrase';
  $('security-dialog').showModal();(mode==='change' ? $('old-passphrase') : $('passphrase')).focus();
}
$('enable-vault').onclick=()=>security('enable');$('unlock-vault').onclick=()=>security('unlock');
$('disable-vault').onclick=()=>security('disable');$('change-passphrase').onclick=()=>security('change');
$('export-encrypted').onclick=()=>security('export');
$('lock-vault').onclick=async()=>{try{scrub();await api('VAULT_LOCK');await refresh();notice('Vault locked. Saving continues on enabled sites.');}catch(e){notice(e.message,true);}};
$('security-close').onclick=()=>$('security-dialog').close();
$('security-dialog').addEventListener('close',()=>{$('security-form').reset();$('security-error').textContent='';pendingImport='';});
async function importLibrary(raw) {
  const validated=Cairn.parseImport(raw);if(!confirm(`Import ${validated.length} answers into this library?`))return;
  await api('IMPORT',{raw});notice('Library imported. Exact duplicates were skipped.');
}
$('security-form').onsubmit=async e=>{
  e.preventDefault();const button=$('security-submit');button.disabled=true;
  const mode=securityMode,passphrase=$('passphrase').value,generation=securityGeneration;
  try {
    if(['enable','change','export'].includes(mode) && passphrase!==$('confirm-passphrase').value)throw new Error('The new passphrases do not match.');
    if(mode==='export') {
      const raw=await encryptExport(libraryJSON(),passphrase);
      if(generation!==securityGeneration || state?.locked)throw new Error('Vault is locked. Export cancelled.');
      download(raw,'draft-cairn-library-encrypted-v1.json');
    }
    else if(mode==='import') {
      const raw=await decryptExport(pendingImport,passphrase);
      if(generation!==securityGeneration || state?.locked)throw new Error('Vault is locked. Import cancelled.');
      await importLibrary(raw);
    }
    else await api({enable:'VAULT_ENABLE',unlock:'VAULT_UNLOCK',disable:'VAULT_DISABLE',change:'VAULT_CHANGE'}[mode],{passphrase,oldPassphrase:$('old-passphrase').value,acknowledged:$('acknowledge').checked});
    $('security-dialog').close();await refresh();notice(mode==='export' ? 'Encrypted backup exported. Keep its passphrase separately.' : 'Done.');
  }catch(error){$('security-error').textContent=error.message;}finally{button.disabled=false;}
};
$('import').onchange=async()=>{
  try {
    const file=$('import').files[0];if(!file)return;if(file.size>12*1024*1024)throw new Error('Import is too large.');
    const raw=await file.text();let data;try{data=JSON.parse(raw);}catch{throw new Error('Invalid library JSON.');}
    if(data?.format==='draft-cairn-encrypted-library'){security('import');pendingImport=raw;}
    else {await importLibrary(raw);await refresh();}
  }catch(e){notice(e.message,true);}finally{$('import').value='';}
};
$('metadata').onchange=async()=>{
  const metadata=$('metadata').checked;
  if(!metadata && !confirm('Remove page titles and field details from existing recovery drafts? These drafts become copy-only.')){$('metadata').checked=true;return;}
  try{await api('PRIVACY',{metadata});await refresh();}catch(e){notice(e.message,true);await refresh();}
};
$('session-only').onchange=async()=>{
  const sessionOnly=$('session-only').checked;
  if(sessionOnly && !confirm('Move recovery drafts to browser-session memory? They will disappear when this session ends. Oldest drafts may be removed to fit the 2 MiB memory budget. The library stays persistent.')){$('session-only').checked=false;return;}
  try{await api('PRIVACY',{sessionOnly});await refresh();}catch(e){notice(e.message,true);await refresh();}
};
$('clear').onclick=async()=>{if(!confirm('Permanently delete all extension drafts, library answers, settings, and site permissions?'))return;try{await api('CLEAR');await refresh();notice('All extension data and site access deleted.');}catch(e){notice(e.message,true);}};
chrome.storage.onChanged.addListener((changes,area)=>{
  // Typing must not re-read/re-render a multi-megabyte library every debounce.
  // Recovery has an explicit Refresh action; pane changes refresh as well.
  if(area==='local' && changes['cairn-change']?.newValue?.kind==='capture')return;
  if(area==='session' && changes['cairn-vault-session']?.oldValue && !changes['cairn-vault-session'].newValue)scrub();
  if(area==='local' && changes['cairn-change'] || area==='session' && changes['cairn-vault-session'])refresh().catch(()=>notice('Could not refresh local data.',true));
});
refresh().catch(e=>notice(e.message,true));
