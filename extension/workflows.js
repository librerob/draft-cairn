/* Local workflow rules shared by the page and workspace. */
(() => {
  const DAYS=[1,3,7,14,30];
  function countWords(text) { return (text.trim().match(/\S+/gu) || []).length; }
  function counterHint(text) {
    if(typeof text!=='string' || text.length>200)return null;
    const match=text.trim().match(/^(\d[\d,]*)\s*(?:\/|of)\s*(\d[\d,]*)\s*(words?|characters?)\s*(?:used)?[.!]?$/i);
    if(!match)return null;
    const used=Number(match[1].replaceAll(',','')),limit=Number(match[2].replaceAll(',',''));
    if(!Number.isSafeInteger(used) || !Number.isSafeInteger(limit) || limit<1 || limit>1000000 || used>1000000)return null;
    return {used,limit,unit:match[3].toLowerCase().startsWith('word') ? 'words' : 'characters'};
  }
  function fit(text,maxLength,hint) {
    const words=countWords(text),units=text.length,parts=[`${units.toLocaleString()} UTF-16 units`,`${words.toLocaleString()} estimated words`];
    let blocked=false;
    if(Number.isInteger(maxLength) && maxLength>=0) {
      const over=units-maxLength;blocked=over>0;
      parts.push(over>0 ? `over declared character limit by ${over}` : `fits declared character limit (${maxLength-units} remaining)`);
    } else parts.push('no declared HTML character limit');
    if(hint) {
      const estimate=hint.unit==='words' ? words : units,over=estimate-hint.limit;
      parts.push(`website reports ${hint.used}/${hint.limit} ${hint.unit}; our estimate ${estimate}${over>0 ? `, over by ${over}` : ', within that limit'}`);
    }
    return {blocked,words,units,message:parts.join(' · ')};
  }
  function retention(state,origin) { return state.siteDays?.[origin] || state.days; }
  function policy(raw={}) {
    const allowed=Array.isArray(raw.AllowedOrigins) ? raw.AllowedOrigins.filter(o=>{try{return new URL(o).origin===o && /^https?:/.test(o);}catch{return false;}}).slice(0,80) : null;
    return {allowed,maxDays:DAYS.includes(raw.MaxRetentionDays) ? raw.MaxRetentionDays : 30};
  }
  function siteList(raw) {
    const values=raw.split(/[\s,]+/).filter(Boolean);
    if(!values.length || values.length>20)throw new Error('Choose between 1 and 20 exact website origins.');
    return [...new Set(values.map(value=>{
      const url=new URL(value);
      if(!['http:','https:'].includes(url.protocol) || url.username || url.password || url.pathname!=='/' || url.search || url.hash)throw new Error('Choose exact HTTP or HTTPS origins without a path, query or login details.');
      return url.origin;
    }))];
  }
  function markdown(drafts,metadata) {
    const clean=s=>String(s || '').replace(/[\r\n]+/g,' ').replace(/[\\`*_{}\[\]<>#+.!|]/g,'\\$&');
    const sections=drafts.map((d,i)=>`## ${metadata && d.field?.label ? clean(d.field.label) : `Answer ${i+1}`}\n\nSaved: ${new Date(d.saved).toISOString()}\n\n${d.text.split('\n').map(line=>'> '+line).join('\n')}`);
    return `# Application snapshot\n\nExported: ${new Date().toISOString()}\n\nA local copy of selected saved answers. This is not proof of submission or server acceptance. Missing or expired fields are not included.\n\n${sections.join('\n\n')}\n`;
  }
  globalThis.CairnWorkflows=Object.freeze({DAYS,countWords,counterHint,fit,retention,policy,siteList,markdown});
})();
