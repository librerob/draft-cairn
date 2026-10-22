// The preference stays in the encrypted settings index. System changes use CSS directly.
import {api,notice} from './ui.js';
let revision=0;
const select=document.getElementById('appearance');
function apply(appearance) {
  document.documentElement.dataset.theme=['light','dark'].includes(appearance) ? appearance : 'system';
  if(select)select.value=appearance;
}
async function refresh() {
  const version=++revision,value=await api('THEME_GET');
  if(version===revision)apply(value.appearance);
}
if(select)select.addEventListener('change',async()=>{
  const appearance=select.value;select.disabled=true;
  try{await api('THEME_SET',{appearance});await refresh();}
  catch(error){notice(error.message,true);await refresh().catch(()=>{});}
  finally{select.disabled=false;}
});
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area==='local' && changes['cairn-change'] && changes['cairn-change'].newValue?.kind!=='capture')refresh().catch(()=>{});
});
refresh().catch(()=>{});
