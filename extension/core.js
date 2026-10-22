/* Shared, dependency-free rules. No answer text is logged. */
(() => {
  const MAX_TEXT = 100000;
  const MAX_BYTES = 6 * 1024 * 1024;
  const MAX_DRAFTS = 180;
  const MAX_LIBRARY = 300;
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
  const sensitive = /password|passwd|passcode|secret|token|api.?key|one.?time|otp|verification|credit|card|payment|cvv|cvc|iban|bank|routing|social.?security|ssn|passport|tax.?id|pin\b/i;
  function allowedField(f) {
    if (!f.visible || f.disabled || f.readOnly || f.private) return false;
    if (!['TEXTAREA', 'INPUT'].includes(f.tag)) return false;
    if (f.tag === 'INPUT' && (f.type !== 'text' || f.maxLength < 120)) return false;
    const autocomplete = (f.autocomplete || '').toLowerCase();
    if (autocomplete && autocomplete !== 'on') return false;
    return !sensitive.test([f.id, f.name, f.label, f.placeholder].join(' '));
  }
  function pasteCapacity(value, start, end, pasted, limit) {
    // maxlength is measured in UTF-16 code units, including surrogate pairs.
    const selected = Math.max(0, end - start);
    const available = Math.max(0, limit - (value.length - selected));
    return {available, total: value.length - selected + pasted.length, oversized: pasted.length > available};
  }
  function prune(state, now = Date.now()) {
    state.drafts = state.drafts.filter(d => d.expires > now);
    return state;
  }
  function fresh() { return {version: 1, days: 7, sites: [], drafts: [], library: []}; }
  function bounded(state) {
    if (state.drafts.length > MAX_DRAFTS || state.library.length > MAX_LIBRARY ||
      new TextEncoder().encode(JSON.stringify(state)).length > MAX_BYTES) {
      fail('Local storage is full. Your last change was not saved. Export library answers or delete older drafts, then try again.');
    }
    return state;
  }
  function addDraft(state, incoming, now = Date.now()) {
    const text = str(incoming.text, MAX_TEXT);
    if (!text) return state;
    prune(state, now);
    const key = incoming.key;
    const same = state.drafts.filter(d => d.key === key).sort((a,b) => b.saved - a.saved);
    if (same[0]?.text === text) return state;
    // Keep the current edit plus up to three earlier snapshots. Do not evict other fields.
    if (same[0] && now - same[0].saved < 30000 && incoming.kind !== 'paste') {
      state.drafts = state.drafts.filter(d => d.id !== same[0].id);
    }
    const earlier = state.drafts.filter(d => d.key === key).sort((a,b) => b.saved - a.saved);
    const remove = new Set(earlier.slice(3).map(d => d.id));
    state.drafts = state.drafts.filter(d => !remove.has(d.id));
    state.drafts.unshift({...incoming, text, id: crypto.randomUUID(), saved: now,
      expires: now + (incoming.kind === 'paste' ? Math.min(state.days * DAY, 3600000) : state.days * DAY)});
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
    allowedField, pasteCapacity, prune, fresh, bounded, addDraft, libraryItem, parseImport, fieldIdentity, matchField});
})();
