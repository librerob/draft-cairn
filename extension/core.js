/* Shared, dependency-free rules. No answer text is logged. */
(() => {
  const MAX_TEXT = 100000;
  const MAX_BYTES = 6 * 1024 * 1024;
  const MAX_DRAFTS = 180;
  const MAX_LIBRARY = 300;
  const LIBRARY_BYTES = MAX_BYTES - 700 * 1024; // reserve room for one maximum-size recovery record
  const DAY = 86400000;
  const fail = message => { throw new Error(message); };
  const str = (s, max, optional = false) => {
    if (optional && s === undefined) return '';
    if (typeof s !== 'string' || s.length > max) fail('Invalid or oversized data. Nothing was imported.');
    return s;
  };
  function originOf(url) {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) fail('Choose an ordinary HTTP or HTTPS page.');
    return u.origin;
  }
  function hostPattern(origin) {
    const u = new URL(originOf(origin));
    return `${u.protocol}//${u.hostname}/*`;
  }
  const tokens = s => (s || '').replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const sensitive = /\b(password|passwd|passcode|secret|token|otp|cvv|cvc|iban|ssn|passport|pin)\b|\b(api key|one time code|social security|tax id|bank account|account number|routing number|card number|credit card|debit card|payment card|security code|verification code)\b/;
  const sensitiveAutocomplete = /^(?:cc-.+|.*password|one-time-code|webauthn|username|name|given-name|additional-name|family-name|honorific-prefix|honorific-suffix|nickname|email|tel(?:-.+)?|street-address|address-.+|postal-code|country(?:-name)?|bday(?:-.+)?|sex|photo|url|impp|transaction-.+)$/;
  function allowedField(f) {
    if (!f.visible || f.disabled || f.readOnly || f.private) return false;
    if (!['TEXTAREA', 'INPUT'].includes(f.tag) && !(f.tag === 'DIV' && ['quill','prosemirror','ckeditor5','tinymce-inline'].includes(f.type))) return false;
    if (f.tag === 'INPUT' && (f.type !== 'text' || f.maxLength < 120)) return false;
    const autocomplete = (f.autocomplete || '').toLowerCase().split(/\s+/);
    if (autocomplete.some(t => sensitiveAutocomplete.test(t))) return false;
    // off controls browser suggestions, not sensitivity. Descriptive narrative labels
    // such as "payment schedule" or "scorecard summary" are not credential hints.
    const identifiers = [f.id, f.name].map(tokens);
    if (identifiers.some(s => sensitive.test(s) || /\b(card|payment|bank|routing|verification|credit)\b/.test(s))) return false;
    return ![f.label, f.placeholder].some(s => sensitive.test(tokens(s)) || /^(bank details|payment details|card details)$/.test(tokens(s)));
  }
  function pasteCapacity(value, start, end, pasted, limit) {
    // maxlength is measured in UTF-16 code units, including surrogate pairs.
    const selected = Math.max(0, end - start);
    const available = Math.max(0, limit - (value.length - selected));
    return {available, total: value.length - selected + pasted.length, oversized: pasted.length > available};
  }
  const normalizePaste = text => text.replace(/\r\n?/g,'\n');
  function expectedPaste(value,start,end,pasted) {
    if (![value,pasted].every(s=>typeof s==='string') || !Number.isInteger(start) || !Number.isInteger(end) || start<0 || end<start || end>value.length) return null;
    const expected=normalizePaste(value.slice(0,start)+pasted+value.slice(end));
    return expected.length<=MAX_TEXT ? expected : null;
  }
  function comparePaste(expected,actual) {
    if(expected===null || typeof actual!=='string' || actual.length>MAX_TEXT)return {verified:false,changed:false};
    actual=normalizePaste(actual);
    let first=0;
    while(first<expected.length && first<actual.length && expected[first]===actual[first])first++;
    return {verified:true,changed:actual!==expected,first,expectedLength:expected.length,actualLength:actual.length};
  }
  function prune(state, now = Date.now()) {
    state.drafts = state.drafts.filter(d => d.expires > now);
    return state;
  }
  function fresh() { return {version:1,days:1,metadata:false,sessionOnly:false,appearance:'system',sites:[],blockedSites:[],ignoredFields:[],drafts:[],library:[]}; }
  function privacyDefaults(state) {
    return {...state,metadata:state.metadata ?? true,sessionOnly:state.sessionOnly ?? false,
      appearance:['system','light','dark'].includes(state.appearance) ? state.appearance : 'system',
      blockedSites:state.blockedSites || [],ignoredFields:state.ignoredFields || []};
  }
  function minimalDraft(draft) {
    return {...draft,title:'',field:{label:''},restorable:false};
  }
  // Public revision metadata can be managed without decrypting answer payloads.
  function planDraft(drafts,incoming,days,now=Date.now()) {
    let list=drafts.filter(d=>d.expires>now);
    const same=list.filter(d=>d.key===incoming.key).sort((a,b)=>b.saved-a.saved);
    let started=now;
    if(same[0] && now-(same[0].started ?? same[0].saved)<30000 && incoming.kind!=='paste') {
      started=same[0].started ?? same[0].saved;list=list.filter(d=>d.id!==same[0].id);
    }
    const earlier=list.filter(d=>d.key===incoming.key).sort((a,b)=>b.saved-a.saved);
    const remove=new Set(earlier.slice(3).map(d=>d.id));list=list.filter(d=>!remove.has(d.id));
    const entry={...incoming,saved:now,started,expires:now+(incoming.kind==='paste'?Math.min(days*DAY,3600000):days*DAY)};
    return [entry,...list];
  }
  const sizes = new WeakMap();
  function bytes(value) {
    if (Object.isFrozen(value) && sizes.has(value)) return sizes.get(value);
    const size = new TextEncoder().encode(JSON.stringify(value)).length;
    if (Object.isFrozen(value)) sizes.set(value,size);
    return size;
  }
  function stateBytes(state) {
    return bytes({...state,drafts:[],library:[]}) +
      [state.drafts,state.library].reduce((total,items)=>total + items.reduce((sum,item)=>sum+bytes(item),0) + Math.max(0,items.length-1),0);
  }
  function bounded(state) {
    if (state.drafts.length > MAX_DRAFTS || state.library.length > MAX_LIBRARY ||
      stateBytes(state) > MAX_BYTES) {
      fail('Local storage is full. Your last change was not saved. Export library answers or delete older drafts, then try again.');
    }
    return state;
  }
  function libraryBounded(state) {
    if (state.library.length > MAX_LIBRARY || bytes(state.library) > LIBRARY_BYTES)
      fail('Local storage for library answers is full. Export or delete library answers before adding more. Recovery capacity is reserved separately.');
    return bounded(state);
  }
  function addDraft(state, incoming, now = Date.now()) {
    if (typeof incoming.text !== 'string' || incoming.text.length > MAX_TEXT)
      fail('Invalid draft: answers over 100,000 UTF-16 units cannot be saved. Keep a separate copy.');
    const text = incoming.text;
    if (!text) return state;
    prune(state, now);
    const key = incoming.key;
    const same = state.drafts.filter(d => d.key === key).sort((a,b) => b.saved - a.saved);
    if (same[0]?.text === text) return state;
    let started = now;
    // Keep the current edit plus up to three earlier snapshots.
    if (same[0] && now - (same[0].started ?? same[0].saved) < 30000 && incoming.kind !== 'paste') {
      started = same[0].started ?? same[0].saved;
      state.drafts = state.drafts.filter(d => d.id !== same[0].id);
    }
    const earlier = state.drafts.filter(d => d.key === key).sort((a,b) => b.saved - a.saved);
    const remove = new Set(earlier.slice(3).map(d => d.id));
    state.drafts = state.drafts.filter(d => !remove.has(d.id));
    state.drafts.unshift({...incoming, text, id: crypto.randomUUID(), saved: now, started,
      expires: now + (incoming.kind === 'paste' ? Math.min(state.days * DAY, 3600000) : state.days * DAY)});
    // Recovery is a rolling safety net; never let old drafts prevent a new save.
    // Explicit library answers are never evicted. If they alone exhaust capacity,
    // fail visibly rather than claiming the latest answer was saved.
    while (state.drafts.length > 1 && (state.drafts.length > MAX_DRAFTS || stateBytes(state) > MAX_BYTES)) {
      let oldest = 1;
      for (let i=2;i<state.drafts.length;i++) if (state.drafts[i].saved < state.drafts[oldest].saved) oldest=i;
      state.drafts.splice(oldest,1);
      state.evicted = (state.evicted || 0) + 1;
    }
    return bounded(state);
  }
  function libraryItem(item) {
    const title = str(item.title, 160).trim();
    const text = str(item.text, MAX_TEXT);
    if (!title || !text.trim()) fail('Add a title and an answer.');
    return {title, text, project: str(item.project, 100, true).trim()};
  }
  function parseImport(raw) {
    if (typeof raw !== 'string' || raw.length > MAX_BYTES) fail('Import is too large.');
    let obj;
    try { obj = JSON.parse(raw); } catch { fail('This is not a valid library JSON file.'); }
    if (!obj || obj.format !== 'draft-cairn-library' || obj.version !== 1 || !Array.isArray(obj.answers) || obj.answers.length > MAX_LIBRARY)
      fail('Unsupported library format or version. Nothing was imported.');
    return obj.answers.map(libraryItem);
  }
  function fieldIdentity(f) {
    return JSON.stringify([f.tag, f.id, f.name, f.label, f.form]);
  }
  function matchField(saved, candidates, pageKey, structure, canRestore) {
    if (!canRestore || !saved.restorable || saved.pageKey !== pageKey || saved.structure !== structure) return null;
    const hits = candidates.filter(f => fieldIdentity(f) === fieldIdentity(saved.field));
    // Position is deliberately never used as a substitute for identity.
    return hits.length === 1 && (saved.field.id || saved.field.name) ? hits[0] : null;
  }
  globalThis.Cairn = Object.freeze({MAX_TEXT, MAX_BYTES, MAX_DRAFTS, MAX_LIBRARY, DAY, originOf, hostPattern,
    allowedField, pasteCapacity, normalizePaste, expectedPaste, comparePaste, prune, fresh, privacyDefaults, minimalDraft, planDraft, bounded, libraryBounded, stateBytes, addDraft, libraryItem, parseImport, fieldIdentity, matchField});
})();
