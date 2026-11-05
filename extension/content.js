(() => {
  if (globalThis.__draftCairn) return;
  globalThis.__draftCairn = true;
  const C = globalThis.Cairn,W=globalThis.CairnWorkflows;
  let frameScope='';
  const embedded=window!==window.top;
  let active = false;
  let activation = 0;
  let timer;
  let pending;
  let lastField;
  let host, root, status;
  const fieldStatus = new WeakMap();
  const pasteIssues = new Map(); // At most four originals in page memory; never a clipboard history.
  let pasteWatch;
  let ignoredFields=new Set(), excluded=new WeakSet(), checkedFields=new WeakMap(), focusVersion=0, appearance='system';
  const richSelector='.ql-editor[contenteditable="true"],.ProseMirror[contenteditable="true"],.ck-editor__editable[contenteditable="true"][role="textbox"],.mce-content-body[contenteditable="true"]';
  function editorType(el) {
    if(el.tagName!=='DIV' || !el.matches(richSelector))return '';
    if(el.classList.contains('ql-editor'))return 'quill';
    if(el.classList.contains('ProseMirror'))return 'prosemirror';
    if(el.classList.contains('ck-editor__editable'))return 'ckeditor5';
    return 'tinymce-inline';
  }
  function fieldFrom(target) {
    if(!(target instanceof Element))return null;
    const tree=target.getRootNode();if(tree!==document && (!(tree instanceof ShadowRoot) || tree.mode!=='open'))return null;
    if(target.matches('textarea,input'))return target;
    const el=target.closest('[contenteditable]');
    return el && editorType(el) ? el : null;
  }
  function parentOf(el){return el.parentElement || (el.getRootNode() instanceof ShadowRoot ? el.getRootNode().host : null);}
  function across(el,selector){for(let node=el;node;node=parentOf(node))if(node.matches(selector))return node;return null;}
  function activeElement(){let el=document.activeElement;while(el?.shadowRoot?.activeElement)el=el.shadowRoot.activeElement;return el;}
  function eventField(e){return fieldFrom(e.composedPath()[0]);}
  function shadowPath(el){
    const parts=[];let tree=el.getRootNode();
    while(tree instanceof ShadowRoot){const h=tree.host;parts.unshift(h.tagName+':'+h.id+':'+Array.from(h.parentNode?.children || []).indexOf(h));tree=h.getRootNode();}
    return parts.join('/').slice(0,160);
  }
  function allFields(tree=document){
    const found=[];
    for(const el of tree.querySelectorAll('*')){
      if(el===host)continue;
      if(el.matches('textarea,input,'+richSelector))found.push(el);
      if(el.shadowRoot)found.push(...allFields(el.shadowRoot));
    }
    return found;
  }
  const textOf = el => editorType(el) ? el.innerText : el.value;
  async function excludedField(el) {
    const identity=C.fieldIdentity(describe(el));
    const pageKey=await digest(location.origin+location.pathname+frameScope);
    const id=await digest(location.origin+pageKey+identity);
    checkedFields.set(el,identity);
    if(ignoredFields.has(id)){excluded.add(el);return true;}
    return false;
  }
  function configure(data){frameScope=data.scope || '';ignoredFields=new Set(data.ignoredFields || []);excluded=new WeakSet();checkedFields=new WeakMap();appearance=['light','dark'].includes(data.appearance) ? data.appearance : 'system';if(host)host.dataset.theme=appearance;}
  const shorten = s => (s || '').trim().replace(/\s+/g,' ').slice(0,200);
  const digest = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))), b=>b.toString(16).padStart(2,'0')).join('');
  function describe(el) {
    const rich=editorType(el), form=el.form || el.closest('form');
    return {tag:el.tagName, type:rich || el.type || 'textarea', id:shorten(el.id), name:shorten(el.getAttribute('name')),
      label:shorten(el.labels?.[0]?.textContent || el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') || '').split(/\s+/).slice(0,8).map(id=>el.getRootNode().getElementById(id)?.textContent || '').join(' ')),
      form:shorten((form?.id || form?.getAttribute('name') || '')+(shadowPath(el) ? '|shadow|'+shadowPath(el) : '')),shadow:el.getRootNode()!==document,
      placeholder:shorten(el.getAttribute('placeholder') || el.getAttribute('data-placeholder')), autocomplete:shorten(el.getAttribute('autocomplete') || form?.getAttribute('autocomplete')),
      visible:Array.from(el.getClientRects()).some(r=>r.width>0 && r.height>0) &&
        (el.checkVisibility ? el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}) : getComputedStyle(el).visibility !== 'hidden') &&
        !across(el,'[inert],[aria-hidden="true"],[hidden]') && !framePrivate(),
      disabled:!!el.disabled || el.matches(':disabled') || !!across(el,'[aria-disabled="true"]'), readOnly:!!el.readOnly || !!across(el,'[aria-readonly="true"]') || !!rich && !el.isContentEditable,
      private:excluded.has(el) || !!across(el,'[data-cairn-ignore]') || !!rich && !!el.querySelector('[data-cairn-ignore],input,textarea,[autocomplete]'), maxLength:rich ? -1 : el.maxLength};
  }
  function framePrivate(){
    try {for(let w=window;w!==w.top;w=w.parent){const frame=w.frameElement;if(frame && (across(frame,'[data-cairn-ignore],[hidden],[inert],[aria-hidden="true"]') || !frame.checkVisibility({checkVisibilityCSS:true})))return true;}}
    catch { /* Cross-origin parents are authorized independently by the worker. */ }
    return false;
  }
  function hintFor(el){
    const tree=el.getRootNode(),ids=(el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    const candidates=ids.map(id=>tree.getElementById(id));
    // An adjacent counter is accepted only in a container with exactly this one field.
    const parent=el.parentElement;
    if(parent && parent.querySelectorAll('textarea,input,[contenteditable="true"]').length===1)candidates.push(...parent.querySelectorAll('[role="status"],output,[data-word-count],[data-character-count]'));
    const hints=candidates.filter(n=>n && n!==el && n.checkVisibility({checkVisibilityCSS:true})).map(n=>W.counterHint(n.textContent)).filter(Boolean);
    const unique=[...new Map(hints.map(h=>[h.limit+'|'+h.unit,h])).values()];
    return unique.length===1 ? unique[0] : null;
  }
  function fields() {
    return allFields().map(el=>({el,...describe(el)})).filter(C.allowedField);
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
*{box-sizing:border-box}button,textarea,input{font:inherit}input[type=search]{display:block;width:100%;padding:12px;border-radius:12px;border:1px solid var(--c-line);background:var(--c-input);color:var(--c-ink)}section[data-library]{border-top:1px solid var(--c-line);margin-top:20px;padding-top:20px}button{min-height:40px;padding:9px 16px;border:1px solid var(--c-line);background:var(--c-paper);color:var(--c-primary);border-radius:999px;cursor:pointer;font-size:13px;font-weight:600}button:hover{background:var(--c-input)}button:focus-visible,textarea:focus-visible{outline:3px solid var(--c-primary);outline-offset:3px}.pill{position:fixed;bottom:16px;right:16px;z-index:2147483647;background:var(--c-paper);color:var(--c-primary);border:1px solid var(--c-line);box-shadow:0 3px 16px #0002;border-radius:999px;padding:10px 16px;max-width:min(380px,90vw);text-align:left;font-size:12px;font-weight:500}.error{background:var(--c-error);color:var(--c-on-error)}dialog{color:var(--c-ink);background:var(--c-paper);border:1px solid var(--c-line);border-radius:24px;padding:24px;width:min(700px,94vw);max-height:90vh;overflow:auto;box-shadow:0 20px 70px #0004}dialog::backdrop{background:var(--c-scrim)}h2{font-size:22px;line-height:1.35;font-weight:500;margin:0 0 12px}textarea{display:block;width:100%;height:38vh;min-height:160px;resize:vertical;padding:14px;background:var(--c-input);color:var(--c-ink);border:1px solid var(--c-line);border-radius:12px;line-height:1.65}label{display:block;font-weight:600;margin-bottom:8px}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}.primary{background:var(--c-primary);color:var(--c-on-primary)}.primary:hover{background:var(--c-primary)}p{margin:10px 0}small{display:block;color:var(--c-muted)}@media(forced-colors:active){.pill,.primary,dialog{border:1px solid ButtonText}}`;
    root.append(style);
    status = document.createElement('button');
    status.className = 'pill'; status.type = 'button'; status.setAttribute('aria-live','polite');
    status.title = 'Open the editor or choose a library answer for this field (Alt+Shift+L)';
    status.onclick = e=>{if(e.isTrusted && lastField?.isConnected && C.allowedField(describe(lastField))) {const issue=pasteIssues.get(lastField);editor(lastField,issue?.original ?? textOf(lastField),false,issue);}};
    status.textContent = 'Draft Cairn Â· choose a supported answer field';
    root.append(status);
    document.documentElement.append(host);
  }
  function announce(text, error = false) {
    mount(); status.textContent = `Draft Cairn Â· ${text}`; status.classList.toggle('error',error);
  }
  async function focusedStatus() {
    if (!active) return;
    const version=++focusVersion;
    const focused=activeElement(),el=fieldFrom(focused);
    if (focused===host || embedded && !document.hasFocus()) return;
    if (el && C.allowedField(describe(el))) {
      if(ignoredFields.size) {
        announce('checking fieldâ€¦');
        const blocked=await excludedField(el);
        if(version!==focusVersion || !active)return;
        if(blocked){lastField=null;announce('not protected in this field Â· excluded in settings',true);return;}
      }
      lastField=el;
      const issue=pasteIssues.get(el);
      if(issue){announce(issue.saved===false ? 'paste needs review Â· original not saved Â· click to copy' : issue.saved ? 'paste needs review Â· original saved Â· click to review' : 'paste needs review Â· saving originalâ€¦',true);return;}
      if(pasteWatch?.el===el){announce('checking visible pasteâ€¦');return;}
      const saved=fieldStatus.get(el);
      announce(saved?.text || (editorType(el) ? 'rich text Â· plain-text recovery Â· not saved yet' : 'supported field Â· not saved yet'),saved?.error || false);
      const hint=hintFor(el);if(hint){const report=W.fit(textOf(el),el.maxLength,hint);status.textContent+=' Â· '+report.message;}
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
      if (snapshot.kind==='paste' || textOf(el)===snapshot.text) fieldStatus.set(el,{text:result.evicted ? 'saved Â· oldest recovery revisions removed' : 'saved on this device'+(editorType(el) ? ' Â· plain text Â· copy back' : '')});
      return true;
    } catch {
      if (!active || version!==activation) return;
      fieldStatus.set(el,{text:'not saved â€” open recovery or keep a separate copy',error:true});
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
    }).catch(()=>{if(active)announce('not saved â€” keep a separate copy',true);return false;});
    return captures;
  }
  function flush() {
    clearTimeout(timer);
    if (pending) {const p=pending; pending=null; return enqueue(p.el,p.text);}
  }
  function editor(el, original, oversized, issue) {
    mount();
    if (root.querySelector('dialog')) return;
    const before = activeElement();
    const destination={value:textOf(el),start:el.selectionStart,end:el.selectionEnd,identity:C.fieldIdentity(describe(el))};
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
      counter.textContent=W.fit(area.value,el.maxLength,hintFor(el)).message;
    }
    area.oninput = count; count();
    const actions = document.createElement('div'); actions.className = 'actions';
    const copy = document.createElement('button'); copy.type='button'; copy.className='primary'; copy.textContent='Copy answer';
    copy.onclick = async()=>{try {await navigator.clipboard.writeText(area.value); result.textContent='Copied. Paste it when you are ready.';}catch {area.focus();area.select();result.textContent='Copy was blocked. Press Ctrl+C or Command+C to copy the selected answer.';}};
    const close = document.createElement('button'); close.type='button'; close.textContent='Close editor'; close.onclick=()=>dialog.close();
    const ignore=document.createElement('button');ignore.type='button';ignore.textContent='Never capture this field';
    ignore.onclick=async e=>{
      if(!e.isTrusted || !confirm('Stop capturing this field and delete its recovery revisions? Fields with the same identity on this page are excluded too. Library answers remain.'))return;
      try{await message({type:'IGNORE_FIELD',field:describe(el)});excluded.add(el);pasteIssues.delete(el);if(pasteWatch?.el===el){clearTimeout(pasteWatch.timer);pasteWatch=null;}if(pending?.el===el)pending=null;dialog.close();lastField=null;announce('not protected in this field Â· excluded in settings',true);}
      catch{result.textContent='Could not exclude this field. Turn protection off from the toolbar popup.';}
    };
    const library=document.createElement('button');library.type='button';library.textContent='Use library answer';
    library.onclick=e=>{if(e.isTrusted)openLibrary(dialog,el,destination,area,counter,result);};
    library.addEventListener('cairn-library',()=>openLibrary(dialog,el,destination,area,counter,result));
    actions.append(copy,library,close,ignore); dialog.append(heading,note,label,area,counter,help,actions,result);
    if(issue) {
      area.style.height='120px';area.style.minHeight='120px';
      help.textContent='Edits here stay in memory until copied. Review the website before pasting. Formatting is not compared.';
      const comparison=document.createElement('p');comparison.textContent=issue.comparison || 'The visible result could not be verified.';
      const actualLabel=document.createElement('label');actualLabel.htmlFor='cairn-visible';actualLabel.textContent='Visible field text when checked';
      const actual=document.createElement('textarea');actual.id='cairn-visible';actual.readOnly=true;actual.value=issue.actual;actual.style.height='80px';actual.style.minHeight='80px';
      const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='Dismiss this warning';dismiss.onclick=()=>{pasteIssues.delete(el);dialog.close();focusedStatus();};
      actions.append(dismiss);dialog.insertBefore(comparison,label);dialog.insertBefore(actualLabel,counter);dialog.insertBefore(actual,counter);
    }
    dialog.addEventListener('close',()=>{dialog.remove();if(before?.isConnected)before.focus();});
    root.append(dialog); dialog.showModal(); area.focus();
  }
  async function openLibrary(dialog,el,destination,area,counter,result){
    if(dialog.querySelector('[data-library]'))return;
    const section=document.createElement('section');section.dataset.library='';
    const label=document.createElement('label');label.textContent='Find a library answer';label.htmlFor='cairn-library-search';
    const search=document.createElement('input');search.type='search';search.id='cairn-library-search';search.placeholder='Search titles and projects';
    const options=document.createElement('div');options.className='actions';
    const fit=document.createElement('p');fit.setAttribute('role','status');
    const insert=document.createElement('button');insert.type='button';insert.className='primary';insert.textContent='Insert at saved cursor';insert.disabled=true;
    const note=document.createElement('p');note.textContent='Choose an answer to preview below. Existing text outside your selection stays. Rich editors support copying only. Inserting makes the text available to this website.';
    const preview=document.createElement('textarea');preview.readOnly=true;preview.setAttribute('aria-label','Result after insertion');preview.style.height='120px';
    section.append(label,search,options,note,fit,preview,insert);dialog.append(section);search.focus();
    let selected=false;
    function update(){
      const expected=C.expectedPaste(destination.value,destination.start,destination.end,area.value);
      const report=W.fit(expected ?? area.value,el.maxLength,hintFor(el));
      preview.value=expected ?? '';fit.textContent=report.message+(destination.start!==destination.end ? ' Â· selected website text will be replaced' : '');
      insert.disabled=!selected || report.blocked || expected===null || !!editorType(el);
    }
    area.addEventListener('input',update);
    try{
      const items=await message({type:'LIBRARY_LIST'});
      function render(){
        options.replaceChildren();
        const matches=items.filter(a=>(a.title+' '+a.project).toLowerCase().includes(search.value.toLowerCase()));
        if(!matches.length)options.textContent='No matching library answers. Save an answer in Recovery & library first.';
        for(const item of matches.slice(0,30)){
          const choice=document.createElement('button');choice.type='button';choice.textContent=item.title+(item.project ? ' Â· '+item.project : '');
          choice.onclick=async e=>{if(!e.isTrusted)return;try{const answer=await message({type:'LIBRARY_GET',id:item.id});if(!dialog.isConnected || !active)return;area.value=answer.text;selected=true;counter.textContent=W.fit(area.value,el.maxLength,hintFor(el)).message;update();}catch{fit.textContent='Unlock your vault in the workspace before using library answers.';}};
          options.append(choice);
        }
      }
      search.oninput=render;render();
    }catch{fit.textContent='Unlock your vault in the workspace before using library answers.';}
    insert.onclick=async e=>{
      if(!e.isTrusted || insert.disabled)return;insert.disabled=true;
      try{
        await message({type:'HELLO'}); // Recheck permission/policy immediately before releasing text.
        if(await excludedField(el) || !active || !el.isConnected || !C.allowedField(describe(el)) || editorType(el) || C.fieldIdentity(describe(el))!==destination.identity || el.value!==destination.value)throw new Error();
        const expected=C.expectedPaste(destination.value,destination.start,destination.end,area.value);
        if(expected===null || W.fit(expected,el.maxLength,hintFor(el)).blocked)throw new Error();
        const proto=el.tagName==='TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto,'value').set.call(el,expected);
        el.dispatchEvent(new Event('input',{bubbles:true,composed:true}));el.dispatchEvent(new Event('change',{bubbles:true,composed:true}));
        fit.textContent='Inserted Â· checking what the website retainedâ€¦';
        await new Promise(resolve=>setTimeout(resolve,1500));
        if(!active || !el.isConnected || el.value!==expected){fit.textContent='The website changed or removed the inserted text. Your library original is unchanged. Review and copy it manually.';return;}
        const saved=await enqueue(el,expected);fit.textContent='Visible insertion matches Â· '+(saved ? 'saved on this device' : 'not saved; keep a separate copy')+' Â· submission not checked';
      }catch{fit.textContent='The destination changed or protection is unavailable. Reopen the editor to choose the field again.';}
    };
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
      // A trusted paste can be entirely model-managed, with no native input event.
      // Save the checked visible result too; an earlier typing save is not evidence
      // that this paste has reached storage.
      fieldStatus.set(watch.el,{text:'visible paste matches Â· savingâ€¦'});focusedStatus();
      enqueue(watch.el,actual).then(saved=>{
        if(!active || watch.version!==activation || !watch.el.isConnected || textOf(watch.el)!==actual || pasteWatch || pasteIssues.has(watch.el))return;
        const previous=fieldStatus.get(watch.el);
        fieldStatus.set(watch.el,{text:'visible paste matches Â· '+(saved ? 'saved on this device' : 'not saved Â· keep a separate copy')+(previous?.text?.includes('oldest recovery') ? ' Â· oldest recovery revisions removed' : '')+' Â· submission not checked',error:!saved});focusedStatus();
      });
    }
  }
  document.addEventListener('focusin',e=>{
    if (e.target!==host) focusedStatus();
  },true);
  window.addEventListener('blur',()=>setTimeout(focusedStatus,0));
  document.addEventListener('input',e=>{
    if (!e.isTrusted) return;
    const el = eventField(e);
    if (!active || !el || !C.allowedField(describe(el))) return;
    if(pasteWatch && (pasteWatch.el!==el || e.inputType!=='insertFromPaste'))finishPaste('Typing continued before the paste check finished. Compare the original manually.');
    if (pending && pending.el !== el) flush();
    lastField=el; pending={el,text:textOf(el)};
    fieldStatus.set(el,{text:'savingâ€¦'});focusedStatus(); clearTimeout(timer); timer=setTimeout(flush,250);
  },true);
  // Some model-based editors consume native beforeinput and do not emit a native
  // input event. Observe the rendered plain text after that trusted editing intent.
  const richEdits=new WeakMap();
  document.addEventListener('beforeinput',e=>{
    if(!e.isTrusted || !active || !/^(insert|delete|historyUndo|historyRedo)/.test(e.inputType))return;
    const el=eventField(e);
    if(!el || !editorType(el) || !C.allowedField(describe(el)))return;
    if(pasteWatch && (pasteWatch.el!==el || e.inputType!=='insertFromPaste'))finishPaste('Typing continued before the paste check finished. Compare the original manually.');
    const version=activation,edit={};richEdits.set(el,edit);
    setTimeout(()=>{
      if(!active || activation!==version || richEdits.get(el)!==edit || !el.isConnected || !C.allowedField(describe(el)))return;
      if(pending && pending.el!==el)flush();
      lastField=el;pending={el,text:textOf(el)};fieldStatus.set(el,{text:'savingâ€¦'});focusedStatus();clearTimeout(timer);timer=setTimeout(flush,250);
    },0);
  },true);
  document.addEventListener('focusout',()=>flush(),true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){finishPaste('The page was hidden before verification finished. Compare the original manually.');flush();}});
  window.addEventListener('pagehide',()=>{finishPaste('The page closed before verification finished. Compare the original manually.');flush();});
  document.addEventListener('paste',e=>{
    if (!e.isTrusted) return;
    const el=eventField(e);
    if (!active || !el || !C.allowedField(describe(el)) || !e.clipboardData || !e.clipboardData.types.includes('text/plain')) return;
    if(ignoredFields.size && checkedFields.get(el)!==C.fieldIdentity(describe(el))){announce('paste check unavailable until field exclusion check finishes',true);return;}
    const text=e.clipboardData.getData('text/plain');
    if(!text || text.length>C.MAX_TEXT){announce('paste too large to preserve Â· keep a separate copy',true);return;}
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
    const watch={el,original:text,expected,version:activation,snapshot:snapshot(el,text,'paste').catch(()=>null)};pasteWatch=watch;
    watch.timer=setTimeout(()=>finishPaste(),1500);focusedStatus();
  },true);
  document.addEventListener('submit',e=>{
    if(!e.isTrusted || !active)return;
    const over=fields().filter(f=>f.el.form===e.target).filter(f=>{const h=hintFor(f.el);return h && (h.unit==='words' ? W.countWords(textOf(f.el)) : textOf(f.el).length)>h.limit;});
    if(over.length)announce('website counter limit may be exceeded Â· submission was not blocked',true);
  },true);
  chrome.runtime.onMessage.addListener((m,sender,respond)=>{
    if(sender.id===chrome.runtime.id && m.type==='OPEN_LIBRARY'){
      if(active && document.hasFocus() && lastField?.isConnected && C.allowedField(describe(lastField))){editor(lastField,textOf(lastField),false);root.querySelector('dialog button')?.focus();const button=Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='Use library answer');button?.dispatchEvent(new Event('cairn-library'));}
      respond({ok:true});return;
    }
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
      if (!active || embedded) return {ok:false,error:'Protection is off. Copy the answer instead.'};
      const list=fields(), structure=await signature(list), pageKey=await digest(location.origin+location.pathname+frameScope);
      const found=C.matchField(m.draft,list,pageKey,structure,!location.search && !location.hash);
      if (!found || !found.el.isConnected || !C.allowedField(describe(found.el)) || found.el.getRootNode()!==document || await excludedField(found.el) || found.el.value !== '')
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
