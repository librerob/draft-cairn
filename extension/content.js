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
  let ignoredFields=new Set(), excluded=new WeakSet(), focusVersion=0, appearance='system';
  async function excludedField(el) {
    const pageKey=await digest(location.origin+location.pathname);
    const id=await digest(location.origin+pageKey+C.fieldIdentity(describe(el)));
    if(ignoredFields.has(id)){excluded.add(el);return true;}
    return false;
  }
  function configure(data){ignoredFields=new Set(data.ignoredFields || []);excluded=new WeakSet();appearance=['light','dark'].includes(data.appearance) ? data.appearance : 'system';if(host)host.dataset.theme=appearance;}
  const shorten = s => (s || '').trim().replace(/\s+/g,' ').slice(0,200);
  const digest = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))), b=>b.toString(16).padStart(2,'0')).join('');
  function describe(el) {
    return {tag:el.tagName, type:el.type || 'textarea', id:shorten(el.id), name:shorten(el.name),
      label:shorten(el.labels?.[0]?.textContent || el.getAttribute('aria-label') || ''),
      form:shorten(el.form?.id || el.form?.getAttribute('name') || ''),
      placeholder:shorten(el.getAttribute('placeholder')), autocomplete:shorten(el.getAttribute('autocomplete') || el.form?.getAttribute('autocomplete')),
      visible:Array.from(el.getClientRects()).some(r=>r.width>0 && r.height>0) &&
        (el.checkVisibility ? el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}) : getComputedStyle(el).visibility !== 'hidden') &&
        !el.closest('[inert],[aria-hidden="true"],[hidden]'),
      disabled:el.disabled || el.matches(':disabled'), readOnly:el.readOnly,
      private:excluded.has(el) || !!el.closest('[data-cairn-ignore]'), maxLength:el.maxLength};
  }
  function fields() {
    return Array.from(document.querySelectorAll('textarea,input')).map(el=>({el,...describe(el)})).filter(C.allowedField);
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
    status.onclick = ()=>{if(lastField?.isConnected && C.allowedField(describe(lastField))) editor(lastField,lastField.value,false);};
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
    const el=document.activeElement;
    if (el===host) return;
    if (el?.matches?.('textarea,input') && C.allowedField(describe(el))) {
      if(ignoredFields.size) {
        announce('checking field…');
        const blocked=await excludedField(el);
        if(version!==focusVersion || !active)return;
        if(blocked){lastField=null;announce('not protected in this field · excluded in settings',true);return;}
      }
      lastField=el;
      const saved=fieldStatus.get(el);
      announce(saved?.text || 'supported field · not saved yet',saved?.error || false);
    } else {
      lastField=null;
      const editable=el?.matches?.('textarea,input,iframe,[contenteditable]:not([contenteditable="false"]),[role="textbox"]') || el?.isContentEditable || el?.shadowRoot?.activeElement;
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
      if (snapshot.kind==='paste' || el.value===snapshot.text) fieldStatus.set(el,{text:result.evicted ? 'saved · oldest recovery revisions removed' : 'saved on this device'});
    } catch {
      if (!active || version!==activation) return;
      fieldStatus.set(el,{text:'not saved — open recovery or keep a separate copy',error:true});
    }
    focusedStatus();
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
      await capture(await snapshot(el,text,kind),el);
    }).catch(()=>announce('not saved — keep a separate copy',true));
    return captures;
  }
  function flush() {
    clearTimeout(timer);
    if (pending) {const p=pending; pending=null; return enqueue(p.el,p.text);}
  }
  function editor(el, original, oversized) {
    mount();
    if (root.querySelector('dialog')) return;
    const before = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-labelledby','cairn-heading');
    const heading = document.createElement('h2'); heading.id = 'cairn-heading';
    heading.textContent = oversized ? 'Your paste is longer than this field allows' : 'Room to work on your answer';
    const note = document.createElement('p');
    note.textContent = oversized ? 'The paste was stopped. Your field is unchanged. The complete pasted text is below; a temporary local copy is kept for up to one hour if saving succeeds.' : 'Edit here, then copy your answer. Nothing is inserted automatically.';
    const label = document.createElement('label'); label.htmlFor = 'cairn-answer'; label.textContent = oversized ? 'Complete original paste' : 'Answer';
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
      try{await message({type:'IGNORE_FIELD',field:describe(el)});excluded.add(el);if(pending?.el===el)pending=null;dialog.close();lastField=null;announce('not protected in this field · excluded in settings',true);}
      catch{result.textContent='Could not exclude this field. Turn protection off from the toolbar popup.';}
    };
    actions.append(copy,close,ignore); dialog.append(heading,note,label,area,counter,help,actions,result);
    dialog.addEventListener('close',()=>{dialog.remove();if(before?.isConnected)before.focus();});
    root.append(dialog); dialog.showModal(); area.focus();
  }
  document.addEventListener('focusin',e=>{
    if (e.target!==host) focusedStatus();
  },true);
  window.addEventListener('blur',()=>setTimeout(focusedStatus,0));
  document.addEventListener('input',e=>{
    if (!e.isTrusted) return;
    const el = e.target;
    if (!active || !el.matches?.('textarea,input') || !C.allowedField(describe(el))) return;
    if (pending && pending.el !== el) flush();
    lastField=el; pending={el,text:el.value};
    fieldStatus.set(el,{text:'saving…'});focusedStatus(); clearTimeout(timer); timer=setTimeout(flush,250);
  },true);
  document.addEventListener('focusout',()=>flush(),true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});
  window.addEventListener('pagehide',flush);
  document.addEventListener('paste',e=>{
    if (!e.isTrusted) return;
    const el=e.target;
    if (!active || !el.matches?.('textarea,input') || !C.allowedField(describe(el)) || el.maxLength < 0 || !e.clipboardData) return;
    const text=e.clipboardData.getData('text/plain');
    if (!C.pasteCapacity(el.value,el.selectionStart || 0,el.selectionEnd || 0,text,el.maxLength).oversized) return;
    e.preventDefault(); e.stopImmediatePropagation(); flush(); lastField=el;
    enqueue(el,text,'paste'); editor(el,text,true);
  },true);
  chrome.runtime.onMessage.addListener((m,sender,respond)=>{
    if (sender.id === chrome.runtime.id && m.type === 'RECHECK') {
      respond({ok:true});
      const version=activation;
      message({type:'HELLO'}).then(data=>{if(version===activation){configure(data);active=true;focusedStatus();}}).catch(()=>{if(version===activation){active=false;pending=null;clearTimeout(timer);host?.remove();}});return;
    }
    if (sender.id === chrome.runtime.id && m.type === 'START') {
      const version=++activation;respond({ok:true});
      message({type:'HELLO'}).then(data=>{if(version===activation){configure(data);active=true;focusedStatus();}}).catch(()=>{});return;
    }
    if (sender.id === chrome.runtime.id && m.type === 'STOP') {activation++;active=false;pending=null;clearTimeout(timer);host?.remove();respond({ok:true});return;}
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
