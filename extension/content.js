(() => {
  if (globalThis.__draftCairn) return;
  globalThis.__draftCairn = true;
  const C = globalThis.Cairn;
  let active = false;
  let timer;
  let pending;
  let lastField;
  let host, root, status;
  const shorten = s => (s || '').trim().replace(/\s+/g,' ').slice(0,200);
  const digest = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))), b=>b.toString(16).padStart(2,'0')).join('');
  function describe(el) {
    return {tag:el.tagName, type:el.type || 'textarea', id:shorten(el.id), name:shorten(el.name),
      label:shorten(el.labels?.[0]?.textContent || el.getAttribute('aria-label') || ''),
      form:shorten(el.form?.id || el.form?.getAttribute('name') || ''),
      placeholder:shorten(el.getAttribute('placeholder')), autocomplete:shorten(el.getAttribute('autocomplete') || el.form?.getAttribute('autocomplete')),
      visible:el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[inert],[aria-hidden="true"]'),
      disabled:el.disabled || el.matches(':disabled'), readOnly:el.readOnly,
      private:!!el.closest('[data-cairn-ignore]'), maxLength:el.maxLength};
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
    host = document.createElement('div');
    host.setAttribute('data-cairn-ui','');
    root = host.attachShadow({mode:'closed'});
    const style = document.createElement('style');
    style.textContent = `:host{all:initial;font:14px/1.5 system-ui;color:#1c312e}*{box-sizing:border-box}button,textarea{font:inherit}button{padding:10px 14px;border:1px solid #a9b9af;background:#fffdf7;color:#1c312e;border-radius:8px;cursor:pointer}button:focus-visible,textarea:focus-visible{outline:3px solid #126d5a;outline-offset:3px}.pill{position:fixed;bottom:16px;right:16px;z-index:2147483647;background:#143f36;color:white;border:1px solid #517d6f;box-shadow:0 4px 18px #0002;border-radius:10px;padding:9px 14px;max-width:min(380px,90vw);text-align:left}.error{background:#803521}dialog{color:#1c312e;background:#fffdf7;border:1px solid #a9b9af;border-radius:16px;padding:24px;width:min(700px,94vw);max-height:90vh;overflow:auto;box-shadow:0 20px 70px #0004}dialog::backdrop{background:#102e2a99}h2{font-size:22px;margin:0 0 12px}textarea{display:block;width:100%;height:38vh;min-height:160px;resize:vertical;padding:12px;background:white;color:#1c312e;border:1px solid #83968d;border-radius:8px}label{display:block;font-weight:600;margin-bottom:8px}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}.primary{background:#143f36;color:white}p{margin:10px 0}small{display:block}`;
    root.append(style);
    status = document.createElement('button');
    status.className = 'pill'; status.type = 'button'; status.setAttribute('aria-live','polite');
    status.title = 'Open a larger editor for the last supported field';
    status.onclick = ()=>{if(lastField?.isConnected && C.allowedField(describe(lastField))) editor(lastField,lastField.value,false);};
    status.textContent = 'Draft Cairn · protection on';
    root.append(status);
    document.documentElement.append(host);
  }
  function announce(text, error = false) {
    mount(); status.textContent = `Draft Cairn · ${text}`; status.classList.toggle('error',error);
  }
  async function capture(snapshot) {
    if (!active || !snapshot) return;
    try {
      await message(snapshot);
      announce('saved on this device');
    } catch {
      announce('not saved — open recovery or keep a separate copy',true);
    }
  }
  async function snapshot(el, text, kind) {
    const field = describe(el);
    if (!C.allowedField(field)) return null;
    const list = fields();
    return {type:'CAPTURE',field,slot:list.findIndex(f=>f.el===el),structure:await signature(list),text,kind,title:document.title.slice(0,160)};
  }
  // Serialize snapshot creation as well as writes so a slow hash cannot reorder keystrokes.
  let captures = Promise.resolve();
  function enqueue(el, text, kind = 'draft') {
    captures = captures.then(async()=>{
      if (!el.isConnected || !C.allowedField(describe(el))) return;
      await capture(await snapshot(el,text,kind));
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
    actions.append(copy,close); dialog.append(heading,note,label,area,counter,help,actions,result);
    dialog.addEventListener('close',()=>{dialog.remove();if(before?.isConnected)before.focus();});
    root.append(dialog); dialog.showModal(); area.focus();
  }
  document.addEventListener('focusin',e=>{
    if (active && e.target.matches?.('textarea,input') && C.allowedField(describe(e.target))) {
      lastField = e.target; announce('protection on · click to open editor');
    }
  },true);
  document.addEventListener('input',e=>{
    const el = e.target;
    if (!active || !el.matches?.('textarea,input') || !C.allowedField(describe(el))) return;
    if (pending && pending.el !== el) flush();
    lastField=el; pending={el,text:el.value};
    announce('saving…'); clearTimeout(timer); timer=setTimeout(flush,250);
  },true);
  document.addEventListener('focusout',()=>flush(),true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});
  window.addEventListener('pagehide',flush);
  document.addEventListener('paste',e=>{
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
      message({type:'HELLO'}).then(()=>{active=true;mount();}).catch(()=>{active=false;pending=null;clearTimeout(timer);host?.remove();});return;
    }
    if (sender.id === chrome.runtime.id && m.type === 'START') {active=true;mount();respond({ok:true});return;}
    if (sender.id === chrome.runtime.id && m.type === 'STOP') {active=false;pending=null;clearTimeout(timer);host?.remove();respond({ok:true});return;}
    if (sender.id !== chrome.runtime.id || m.type !== 'RESTORE') return;
    (async()=>{
      if (!active) return {ok:false,error:'Protection is off. Copy the answer instead.'};
      const list=fields(), structure=await signature(list), pageKey=await digest(location.origin+location.pathname);
      const found=C.matchField(m.draft,list,pageKey,structure,!location.search && !location.hash);
      if (!found || !found.el.isConnected || !C.allowedField(describe(found.el)) || found.el.value !== '')
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
  // Permissions can be revoked while a document remains open. Stop pending capture immediately.
  chrome.storage.onChanged.addListener((changes,area)=>{
    if (area !== 'local' || !changes.state) return;
    const next=changes.state.newValue;
    active=!!next?.sites?.includes(location.origin);
    if (!active) {pending=null;clearTimeout(timer);host?.remove();}
  });
  message({type:'HELLO'}).then(()=>{active=true;if(document.documentElement)mount();else document.addEventListener('DOMContentLoaded',mount,{once:true});}).catch(()=>{});
})();
