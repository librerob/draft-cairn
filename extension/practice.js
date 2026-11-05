import './theme.js';
import {$,api,notice} from './ui.js';
$('practice-save').onclick=async()=>{try{await api('PRACTICE_SAVE',{text:$('practice-answer').value});notice('Saved on this device. Reload the page, then recover your sample.');}catch(e){notice(e.message,true);}};
$('practice-recover').onclick=async()=>{try{const answer=await api('PRACTICE_READ');if($('practice-answer').value)throw new Error('The box already has text. Keep or clear it yourself before recovery.');$('practice-answer').value=answer;notice('Recovered. On websites you can copy back or explicitly restore when the match is safe.');}catch(e){notice(e.message,true);}};
$('practice-clear').onclick=async()=>{try{await api('PRACTICE_CLEAR');notice('Practice recovery drafts deleted.');}catch(e){notice(e.message,true);}};
