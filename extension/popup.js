import './core.js';
import {$,node,api,notice} from './ui.js';
let tab, origin, enabled=false;
async function render() {
  const state=await api('STATE');
  [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  try {origin=tab.incognito ? null : Cairn.originOf(tab.url);}catch {origin=null;}
  enabled=!!origin && state.sites.includes(origin) && await chrome.permissions.contains({origins:[Cairn.hostPattern(origin)]});
  $('site').textContent=origin || 'Choose an ordinary website';
  $('status').textContent=enabled ? 'Protection is on' : 'Protection is off';
  $('detail').textContent=enabled ? 'Only supported fields save. Check the on-page status in the field you are using.' : 'Enable before writing. Saves answer text, page titles and field labels locally; sensitive text can be included. Chrome grants this host across ports, but capture is limited to this exact origin.';
  $('toggle').textContent=enabled ? 'Turn protection off' : 'Enable for this site';$('toggle').disabled=!origin;
  const drafts=state.drafts.filter(d=>d.origin === origin).sort((a,b)=>b.saved-a.saved).slice(0,3);
  $('count').textContent=drafts.length ? 'This site' : '';
  $('recent').replaceChildren();
  if(!drafts.length)$('recent').append(node('p','No saved answers here yet. After enabling protection, type in a supported field.','muted'));
  for(const d of drafts) {const row=node('div',undefined,'small-draft');row.append(node('strong',d.field.label || 'Untitled field'),node('div',`${d.kind === 'paste' ? 'Original paste · ' : ''}${new Date(d.saved).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} · ${d.text.length.toLocaleString()} units`,'meta'));$('recent').append(row);}
  if(state.lastError)notice(state.lastError,true);
}
$('toggle').onclick=async()=>{
  const button=$('toggle');button.disabled=true;
  try {
    if(enabled)await api('DISABLE',{origin});
    else {
      // Keep the permission request directly inside the user gesture.
      const pending=chrome.storage.session.set({[`enable-${tab.id}`]:{origin,tabId:tab.id,created:Date.now()}});
      // Request immediately in this click, before awaiting any API. The pending
      // choice survives popup closure; onAdded completes it in the worker.
      const permission=chrome.permissions.request({origins:[Cairn.hostPattern(origin)]});
      await pending;
      const granted=await permission;
      if(!granted){await chrome.storage.session.remove(`enable-${tab.id}`);notice('Site access was not granted. Protection remains off.');return;}
      await api('ENABLE',{origin,tabId:tab.id});
    }
    await render();notice(enabled ? 'Protection enabled. Answers stay on this device.' : 'Protection is off. Saved drafts remain until deleted or expired.');
  }catch(e){notice(e.message,true);}finally{button.disabled=!origin;}
};
$('workspace').onclick=()=>chrome.tabs.create({url:chrome.runtime.getURL(`workspace.html?tab=${tab?.id || ''}`)});
api('FINISH_ENABLE').then(render).catch(e=>notice(e.message,true));
