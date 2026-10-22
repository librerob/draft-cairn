import './core.js';
import {$,node,api,notice} from './ui.js';
let tab, origin, enabled=false;
async function render() {
  [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  try {origin=tab.incognito ? null : Cairn.originOf(tab.url);}catch {origin=null;}
  const state=await api('STATE',{origin});
  enabled=!!origin && state.sites.includes(origin) && await chrome.permissions.contains({origins:[Cairn.hostPattern(origin)]});
  $('site').textContent=origin || 'Choose an ordinary website';
  $('status').textContent=enabled ? 'Protection is on' : 'Protection is off';
  $('detail').textContent=enabled ? 'Only supported fields save. Check the on-page status in the field you are using.' : `Enable before writing. Saves supported answer text locally${state.metadata ? ', with page titles and field details' : ', without titles or field labels'}. Sensitive text can be included. Chrome grants this host across ports; capture uses this exact origin.`;
  $('toggle').textContent=enabled ? 'Turn protection off' : 'Enable for this site';$('toggle').disabled=!origin || state.blockedSites.includes(origin);
  $('block-site').disabled=!origin || state.blockedSites.includes(origin);
  if(state.blockedSites.includes(origin)){$('status').textContent='Never capture · blocked';$('detail').textContent='Remove this block in workspace settings before enabling protection.';}
  const drafts=state.drafts.filter(d=>d.origin === origin).sort((a,b)=>b.saved-a.saved).slice(0,3);
  $('count').textContent=drafts.length ? 'This site' : '';
  $('recent').replaceChildren();
  if(state.locked)$('recent').append(node('p',`Vault locked · ${state.siteDraftCount} revisions for this site. Saving continues. Open the workspace to unlock.`,'muted'));
  else if(!drafts.length)$('recent').append(node('p','No saved answers here yet. After enabling protection, type in a supported field.','muted'));
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
  }catch(e){notice(e.message,true);}finally{await render().catch(()=>{});}
};
$('workspace').onclick=()=>chrome.tabs.create({url:chrome.runtime.getURL(`workspace.html?tab=${tab?.id || ''}`)});
api('FINISH_ENABLE').then(render).catch(e=>notice(e.message,true));

$('block-site').onclick=async()=>{
  if(!origin || !confirm('Never capture this site? Protection is turned off. Existing drafts remain until deleted or expired.'))return;
  try{await api('BLOCK_SITE',{origin});await render();notice('Site blocked. Manage blocks in workspace settings.');}catch(e){notice(e.message,true);}
};
$('wipe').onclick=async()=>{
  if(!confirm('Permanently delete ALL extension drafts, library answers, vault keys, settings and site access? Exported files and clipboard history remain.'))return;
  try{await api('CLEAR');await render();notice('All extension data and site access deleted.');}catch(e){notice(e.message,true);}
};
