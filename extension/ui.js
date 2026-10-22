export const $ = id => document.getElementById(id);
export function node(tag, text, className) {
  const el=document.createElement(tag); if(text !== undefined)el.textContent=text; if(className)el.className=className;return el;
}
export async function api(type, rest={}) {
  const response=await chrome.runtime.sendMessage({type,...rest});
  if(!response?.ok)throw new Error(response?.error || 'Could not complete this action. Keep a separate copy and try again.');
  return response.data;
}
export function notice(text,error=false) {const el=$('notice');el.textContent=text;el.classList.toggle('error',error);}
export function action(text, fn, cls='') {
  const b=node('button',text,cls);b.type='button';b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){notice(e.message,true);}finally{b.disabled=false;}};return b;
}
export async function copy(text) {
  try {await navigator.clipboard.writeText(text);notice('Copied to clipboard.');}
  catch {throw new Error('Copy was blocked. Open the editor, select the answer, and use Ctrl+C or Command+C.');}
}
export const time = stamp => new Date(stamp).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
