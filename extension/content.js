(() => {
  if (globalThis.__draftCairn) return;
  globalThis.__draftCairn = true;
  const C = globalThis.Cairn;
  let active = false;
  let activation = 0;
  let timer;
  let pending;
  let lastField;
  let host, root, status;
  const fieldStatus = new WeakMap();
  const pasteIssues = new Map(); // At most four originals in page memory; never a clipboard history.
  let pasteWatch;
  let ignoredFields=new Set(), excluded=new WeakSet(), checkedFields=new WeakSet(), focusVersion=0, appearance='system';
  const richSelector='.ql-editor[contenteditable="true"],.ProseMirror[contenteditable="true"],.ck-editor__editable[contenteditable="true"][role="textbox"],.mce-content-body[contenteditable="true"]';
  function editorType(el) {
    if(el.tagName!=='DIV' || !el.matches(richSelector))return '';
    if(el.classList.contains('ql-editor'))return 'quill';
    if(el.classList.contains('ProseMirror'))return 'prosemirror';
    if(el.classList.contains('ck-editor__editable'))return 'ckeditor5';
    return 'tinymce-inline';
  }
  function fieldFrom(target) {
    if(!(target instanceof Element) || target.getRootNode()!==document)return null;
    if(target.matches('textarea,input'))return target;
    const el=target.closest('[contenteditable]');
    return el && editorType(el) ? el : null;
  }
  const textOf = el => editorType(el) ? el.innerText : el.value;
  async function excludedField(el) {
    const pageKey=await digest(location.origin+location.pathname);
    const id=await digest(location.origin+pageKey+C.fieldIdentity(describe(el)));
    checkedFields.add(el);
    if(ignoredFields.has(id)){excluded.add(el);return true;}
    return false;
  }
  function configure(data){ignoredFields=new Set(data.ignoredFields || []);excluded=new WeakSet();checkedFields=new WeakSet();appearance=['light','dark'].includes(data.appearance) ? data.appearance : 'system';if(host)host.dataset.theme=appearance;}
  const shorten = s => (s || '').trim().replace(/\s+/g,' ').slice(0,200);
  const digest = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))), b=>b.toString(16).padStart(2,'0')).join('');
  function describe(el) {
    const rich=editorType(el), form=el.form || el.closest('form');
    return {tag:el.tagName, type:rich || el.type || 'textarea', id:shorten(el.id), name:shorten(el.getAttribute('name')),
      label:shorten(el.labels?.[0]?.textContent || el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') || '').split(/\s+/).slice(0,8).map(id=>document.getElementById(id)?.textContent || '').join(' ')),
      form:shorten(form?.id || form?.getAttribute('name') || ''),
      placeholder:shorten(el.getAttribute('placeholder') || el.getAttribute('data-placeholder')), autocomplete:shorten(el.getAttribute('autocomplete') || form?.getAttribute('autocomplete')),
      visible:Array.from(el.getClientRects()).some(r=>r.width>0 && r.height>0) &&
        (el.checkVisibility ? el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}) : getComputedStyle(el).visibility !== 'hidden') &&
        !el.closest('[inert],[aria-hidden="true"],[hidden]'),
      disabled:!!el.disabled || el.matches(':disabled') || !!el.closest('[aria-disabled="true"]'), readOnly:!!el.readOnly || !!el.closest('[aria-readonly="true"]') || !!rich && !el.isContentEditable,
      private:excluded.has(el) || !!el.closest('[data-cairn-ignore]') || !!rich && !!el.querySelector('[data-cairn-ignore],input,textarea,[autocomplete]'), maxLength:rich ? -1 : el.maxLength};
  }
  function fields() {
    return Array.from(document.querySelectorAll('textarea,input,'+richSelector)).map(el=>({el,...describe(el)})).filter(C.allowedField);
  }
  async function signature(list) { return digest(JSON.stringify(list.map(C.fieldIdentity))); }
  async function message(m) {
    const result = await chrome.runtime.sendMessage(m);
    if (!result?.ok) throw new Error(result?.error || 'Could not save. Keep a separate copy.');
    return result.data;
  }
  function mount() {
    if (host?.isConnected) return;
    host = document.createElement('div');host.dataset.theme=appearance;
    root = host.attachShadow({mode:'closed'});
    const style = document.createElement('style');
    style.textContent = `:host{all:initial;color-scheme:light;--c-paper:#fff;--c-input:#f0f4f1;--c-ink:#1a211d;--c-muted:#505d55;--c-line:#748279;--c-primary:#226b4c;--c-on-primary:#fff;--c-error:#ffdad5;--c-on-error:#6e1712;--c-scrim:#101c1673;font:14px/1.6 'Segoe UI',Roboto,Arial,sans-serif;color:var(--c-ink)}
:host([data-theme=dark]){color-scheme:dark;--c-paper:#1a211c;--c-input:#202923;--c-ink:#e1e9e2;--c-muted:#b2c0b5;--c-line:#85978a;--c-primary:#97d5b0;--c-on-primary:#093922;--c-error:#62302a;--c-on-error:#ffdad5;--c-scrim:#0009}
@media(prefers-color-scheme:dark){:host(:not([data-theme=light]):not([data-theme=dark])){color-scheme:dark;--c-paper:#1a211c;--c-input:#202923;--c-ink:#e1e9e2;--c-muted:#b2c0b5;--c-line:#85978a;--c-primary:#97d5b0;--c-on-primary:#093922;--c-error:#62302a;--c-on-error:#ffdad5;--c-scrim:#0009}}
*{box-sizing:border-box}button,textarea{font:inherit}button{min-height:40px;padding:9px 16px;border:1px solid var(--c-line);background:var(--c-paper);color:var(--c-primary);border-radius:999px;cursor:pointer;font-size:13px;font-weight:600}button:hover{background:var(--c-input)}button:focus-visible,textarea:focus-visible{outline:3px solid var(--c-primary);outline-offset:3px}.pill{position:fixed;bottom:16px;right:16px;z-index:2147483647;background:var(--c-paper);color:var(--c-primary);border:1px solid var(--c-line);box-shadow:0 3px 16px #0002;border-radius:999px;padding:10px 16px;max-width:min(380px,90vw);text-align:left;font-size:12px;font-weight:500}.error{background:var(--c-error);color:var(--c-on-error)}dialog{color:var(--c-ink);background:var(--c-paper);border:1px solid var(--c-line);border-radius:24px;padding:24px;width:min(700px,94vw);max-height:90vh;overflow:auto;box-shadow:0 20px 70px #0004}dialog::backdrop{background:var(--c-scrim)}h2{font-size:22px;line-height:1.35;font-weight:500;margin:0 0 12px}textarea{display:block;width:100%;height:38vh;min-height:160px;resize:vertical;padding:14px;background:var(--c-input);color:var(--c-ink);border:1px solid var(--c-line);border-radius:12px;line-height:1.65}label{display:block;font-weight:600;margin-bottom:8px}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}.primary{background:var(--c-primary);color:var(--c-on-primary)}.primary:hover{background:var(--c-primary)}p{margin:10px 0}small{display:block;color:var(--c-muted)}@media(forced-colors:active){.pill,.primary,dialog{border:1px solid ButtonText}}`;
    root.append(style);
    status = document.createElement('button');
    status.className = 'pill'; status.type = 'button'; status.setAttribute('aria-live','polite');
    status.title = 'Open a larger editor for the last supported field';
    status.onclick = ()=>{if(lastField?.isConnected && C.allowedField(describe(lastField))) {const issue=pasteIssues.get(lastField);editor(lastField,issue?.original ?? textOf(lastField),false,issue);}};
    status.textContent = 'Draft Cairn · choose a supported answer field';
    root.append(status);
    document.documentElement.append(host);
  }
  function announce(text, error = false) {
    mount(); status.textContent = `Draft Cairn · ${text}`; status.classList.toggle('error',error);
  }
  async function focusedStatus() {
    if (!active) return;
    const version=++focusVersion;
    const focused=document.activeElement,el=fieldFrom(focused);
    if (focused===host) return;
    if (el && C.allowedField(describe(el))) {
      if(ignoredFields.size) {
        announce('checking field…');
        const blocked=await excludedField(el);
        if(version!==focusVersion || !active)return;
        if(blocked){lastField=null;announce('not protected in this field · excluded in settings',true);return;}
      }
      lastField=el;
      const issue=pasteIssues.get(el);
      if(issue){announce(issue.saved===false ? 'paste needs review · original not saved · click to copy' : issue.saved ? 'paste needs review · original saved · click to review' : 'paste needs review · saving original…',true);return;}
      if(pasteWatch?.el===el){announce('checking visible paste…');return;}
      const saved=fieldStatus.get(el);
      announce(saved?.text || (editorType(el) ? 'rich text · plain-text recovery · not saved yet' : 'supported field · not saved yet'),saved?.error || false);
    } else {
      lastField=null;
      const editable=focused?.matches?.('textarea,input,iframe,[contenteditable]:not([contenteditable="false"]),[role="textbox"]') || focused?.isContentEditable || focused?.shadowRoot?.activeElement;
      announce(editable ? 'not protected in this field' : 'choose a supported answer field',!!editable);
    }
  }
  async function capture(snapshot,el) {
    if (!active || !snapshot) return;
    const version=activation;
    try {
      const result=await message(snapshot);
      if (!active || version!==activation) return;
      // A completed earlier write must not label a newer, unsaved edit as saved.
      if (snapshot.kind==='paste' || textOf(el)===snapshot.text) fieldStatus.set(el,{text:result.evicted ? 'saved · oldest recovery revisions removed' : 'saved on this device'+(editorType(el) ? ' · plain text · copy back' : '')});
      return true;
    } catch {
      if (!active || version!==activation) return;
      fieldStatus.set(el,{text:'not saved — open recovery or keep a separate copy',error:true});
      return false;
    } finally {
      focusedStatus();
    }
  }
  async function snapshot(el, text, kind) {
    const field = describe(el);
    if (!C.allowedField(field) || await excludedField(el)) return null;
    const list = fields();
    return {type:'CAPTURE',field,slot:list.findIndex(f=>f.el===el),structure:await signature(list),text,kind,title:document.title.slice(0,160)};
  }
  // Serialize snapshot creation as well as writes so a slow hash cannot reorder keystrokes.
  let captures = Promise.resolve();
  function enqueue(el, text, kind = 'draft') {
    captures = captures.then(async()=>{
      if (!el.isConnected || !C.allowedField(describe(el))) return;
      return capture(await snapshot(el,text,kind),el);
    }).catch(()=>announce('not saved — keep a separate copy',true));
    return captures;
  }
  function flush() {
    clearTimeout(timer);
    if (pending) {const p=pending; pending=null; return enqueue(p.el,p.text);}
  }
  function editor(el, original, oversized, issue) {
    mount();
    if (root.querySelector('dialog')) return;
    const before = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-labelledby','cairn-heading');
    const heading = document.createElement('h2'); heading.id = 'cairn-heading';
    heading.textContent = oversized ? 'Your paste is longer than this field allows' : issue ? 'Review your paste' : 'Room to work on your answer';
    const note = document.createElement('p');
    note.textContent = oversized ? 'The paste was stopped. Your field is unchanged. The complete pasted text is below; a temporary local copy is kept for up to one hour if saving succeeds.' : issue ? issue.note+' The original is below. Review the website before copying or editing; nothing is inserted automatically. A saved original expires within one hour.' : 'Edit here, then copy your answer. Nothing is inserted automatically.';
    const label = document.createElement('label'); label.htmlFor = 'cairn-answer'; label.textContent = oversized || issue ? 'Complete original paste' : 'Answer';
    const area = document.createElement('textarea'); area.id = 'cairn-answer'; area.value = original;
    const counter = document.createElement('p'); counter.setAttribute('aria-live','polite');
    const help = document.createElement('small'); help.textContent = 'Counts use UTF-16 units, as HTML maxlength does. Custom website limits may differ. Emoji can use several units. Edits here are kept in memory until copied.';
    const result = document.createElement('p'); result.setAttribute('role','status');
    function count() {
      const limit = el.maxLength;
      counter.textContent = `${area.value.length.toLocaleString()} units · ${Array.from(area.value).length.toLocaleString()} Unicode code points${limit >= 0 ? ` · declared field limit ${limit}` : ' · no detectable limit'}`;
    }
    area.oninput = count; count();
    const actions = document.createElement('div'); actions.className = 'actions';
    const copy = document.createElement('button'); copy.type='button'; copy.className='primary'; copy.textContent='Copy answer';
    copy.onclick = async()=>{try {await navigator.clipboard.writeText(area.value); result.textContent='Copied. Paste it when you are ready.';}catch {area.focus();area.select();result.textContent='Copy was blocked. Press Ctrl+C or Command+C to copy the selected answer.';}};
    const close = document.createElement('button'); close.type='button'; close.textContent='Close editor'; close.onclick=()=>dialog.close();
    const ignore=document.createElement('button');ignore.type='button';ignore.textContent='Never capture this field';
    ignore.onclick=async e=>{
      if(!e.isTrusted || !confirm('Stop capturing this field and delete its recovery revisions? Fields with the same identity on this page are excluded too. Library answers remain.'))return;
      try{await message({type:'IGNORE_FIELD',field:describe(el)});excluded.add(el);pasteIssues.delete(el);if(pasteWatch?.el===el){clearTimeout(pasteWatch.timer);pasteWatch=null;}if(pending?.el===el)pending=null;dialog.close();lastField=null;announce('not protected in this field · excluded in settings',true);}
      catch{result.textContent='Could not exclude this field. Turn protection off from the toolbar popup.';}
    };
    actions.append(copy,close,ignore); dialog.append(heading,note,label,area,counter,help,actions,result);
    if(issue) {
      const comparison=document.createElement('p');comparison.textContent=issue.comparison || 'The visible result could not be verified.';
      const actualLabel=document.createElement('label');actualLabel.htmlFor='cairn-visible';actualLabel.textContent='Visible field text when checked';
      const actual=document.createElement('textarea');actual.id='cairn-visible';actual.readOnly=true;actual.value=issue.actual;actual.style.height='140px';
      const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='Dismiss this warning';dismiss.onclick=()=>{pasteIssues.delete(el);dialog.close();focusedStatus();};
      actions.append(dismiss);dialog.insertBefore(comparison,label);dialog.insertBefore(actualLabel,counter);dialog.insertBefore(actual,counter);
    }
    dialog.addEventListener('close',()=>{dialog.remove();if(before?.isConnected)before.focus();});
    root.append(dialog); dialog.showModal(); area.focus();
  }
  function preservePaste(watch,note,actual,comparison) {
    if(!active || watch.version!==activation)return;
    const issue={original:watch.original,note,actual:actual.slice(0,C.MAX_TEXT),comparison,saved:null};
    pasteIssues.delete(watch.el);pasteIssues.set(watch.el,issue);
    while(pasteIssues.size>4)pasteIssues.delete(pasteIssues.keys().next().value);
    captures=captures.then(async()=>capture(await watch.snapshot,watch.el)).catch(()=>false);
    captures.then(saved=>{if(pasteIssues.get(watch.el)===issue){issue.saved=!!saved;focusedStatus();}});
    focusedStatus();
  }
  function finishPaste(reason) {
    const watch=pasteWatch;if(!watch)return;
    pasteWatch=null;clearTimeout(watch.timer);
    if(!active || watch.version!==activation)return;
    const valid=watch.el.isConnected && C.allowedField(describe(watch.el));
    const actual=valid ? textOf(watch.el) : '';
    const compared=C.comparePaste(watch.expected,actual);
    if(reason || !valid || !compared.verified || compared.changed) {
      preservePaste(watch,reason || (!valid ? 'The field disappeared or became unavailable.' : !compared.verified ? 'This selection or field size could not be compared reliably.' : 'The visible result differs from the expected paste. The website may have removed or changed text.'),actual,
        compared.verified && !reason && valid ? `Expected ${compared.expectedLength} UTF-16 units; visible ${compared.actualLength}. First difference at unit ${compared.first+1}. Line endings are normalized; formatting is not compared.` : 'Check interrupted or unsupported selection; no claim of missing text is made.');
    } else {
      const saved=fieldStatus.get(watch.el);
      fieldStatus.set(watch.el,{text:'visible paste matches · '+(saved?.error ? saved.text : saved?.text?.includes('saved on this device') ? 'saved on this device' : 'save not confirmed')+' · submission not checked',error:!!saved?.error});focusedStatus();
    }
  }
  document.addEventListener('focusin',e=>{
    if (e.target!==host) focusedStatus();
  },true);
  window.addEventListener('blur',()=>setTimeout(focusedStatus,0));
  document.addEventListener('input',e=>{
    if (!e.isTrusted) return;
    const el = fieldFrom(e.target);
    if (!active || !el || !C.allowedField(describe(el))) return;
    if(pasteWatch && (pasteWatch.el!==el || e.inputType!=='insertFromPaste'))finishPaste('Typing continued before the paste check finished. Compare the original manually.');
    if (pending && pending.el !== el) flush();
    lastField=el; pending={el,text:textOf(el)};
    fieldStatus.set(el,{text:'saving…'});focusedStatus(); clearTimeout(timer); timer=setTimeout(flush,250);
  },true);
  document.addEventListener('focusout',()=>flush(),true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){finishPaste('The page was hidden before verification finished. Compare the original manually.');flush();}});
  window.addEventListener('pagehide',()=>{finishPaste('The page closed before verification finished. Compare the original manually.');flush();});
  document.addEventListener('paste',e=>{
    if (!e.isTrusted) return;
    const el=fieldFrom(e.target);
    if (!active || !el || !C.allowedField(describe(el)) || !e.clipboardData || !e.clipboardData.types.includes('text/plain')) return;
    if(ignoredFields.size && !checkedFields.has(el)){announce('paste check unavailable until field exclusion check finishes',true);return;}
    const text=e.clipboardData.getData('text/plain');
    if(!text || text.length>C.MAX_TEXT){announce('paste too large to preserve · keep a separate copy',true);return;}
    finishPaste('Another paste started before verification finished. Compare the earlier original manually.');
    flush();lastField=el;pasteIssues.delete(el);
    if (!editorType(el) && el.maxLength>=0 && C.pasteCapacity(el.value,el.selectionStart || 0,el.selectionEnd || 0,text,el.maxLength).oversized) {
      e.preventDefault();e.stopImmediatePropagation();enqueue(el,text,'paste');editor(el,text,true);return;
    }
    const before=textOf(el);
    // Framework editors own their document model. Compare only a whole-field selection
    // or an empty rich editor; other rich selections keep the original for manual review.
    const selection=window.getSelection();
    const whole=editorType(el) && selection?.rangeCount && el.contains(selection.anchorNode) && el.contains(selection.focusNode) && C.normalizePaste(selection.toString())===C.normalizePaste(before);
    const expected=editorType(el) ? (!before || whole ? C.expectedPaste('',0,0,text) : null) : C.expectedPaste(before,el.selectionStart,el.selectionEnd,text);
    const watch={el,original:text,expected,version:activation,snapshot:snapshot(el,text,'paste')};pasteWatch=watch;
    watch.timer=setTimeout(()=>finishPaste(),1500);focusedStatus();
  },true);
  chrome.runtime.onMessage.addListener((m,sender,respond)=>{
    if (sender.id === chrome.runtime.id && m.type === 'RECHECK') {
      respond({ok:true});
      const version=activation;
      message({type:'HELLO'}).then(data=>{if(version===activation){configure(data);active=true;focusedStatus();}}).catch(()=>{if(version===activation){active=false;pending=null;clearTimeout(timer);clearTimeout(pasteWatch?.timer);pasteWatch=null;pasteIssues.clear();host?.remove();}});return;
    }
    if (sender.id === chrome.runtime.id && m.type === 'START') {
      const version=++activation;respond({ok:true});
      message({type:'HELLO'}).then(data=>{if(version===activation){configure(data);active=true;focusedStatus();}}).catch(()=>{});return;
    }
    if (sender.id === chrome.runtime.id && m.type === 'STOP') {activation++;active=false;pending=null;clearTimeout(timer);clearTimeout(pasteWatch?.timer);pasteWatch=null;pasteIssues.clear();host?.remove();respond({ok:true});return;}
    if (sender.id !== chrome.runtime.id || m.type !== 'RESTORE') return;
    (async()=>{
      if (!active) return {ok:false,error:'Protection is off. Copy the answer instead.'};
      const list=fields(), structure=await signature(list), pageKey=await digest(location.origin+location.pathname);
      const found=C.matchField(m.draft,list,pageKey,structure,!location.search && !location.hash);
      if (!found || !found.el.isConnected || !C.allowedField(describe(found.el)) || await excludedField(found.el) || found.el.value !== '')
        return {ok:false,error:'The page or field changed, the match is uncertain, or the field already has text. Copy the answer instead.'};
      if (found.el.maxLength >= 0 && m.draft.text.length > found.el.maxLength)
        return {ok:false,error:'The page limit changed. Copy the answer instead.'};
      const proto=found.el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto,'value').set.call(found.el,m.draft.text);
      found.el.dispatchEvent(new Event('input',{bubbles:true}));
      found.el.dispatchEvent(new Event('change',{bubbles:true})); found.el.focus();
      if (found.el.value !== m.draft.text) return {ok:false,error:'The page changed the restored answer. Copy it instead.'};
      return {ok:true};
    })().then(respond,()=>respond({ok:false,error:'Protection is off or the page is unavailable. Copy the answer instead.'}));
    return true;
  });
  const initialVersion=activation;
  message({type:'HELLO'}).then(data=>{if(initialVersion!==activation)return;configure(data);active=true;if(document.documentElement)focusedStatus();else document.addEventListener('DOMContentLoaded',()=>{if(active)focusedStatus();},{once:true});}).catch(()=>{});
})();
