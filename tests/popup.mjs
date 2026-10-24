// Real toolbar popup regression under Xvfb; a fixed-viewport tab misses autosizing.
import {chromium} from 'playwright';
import {mkdtemp,cp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const temp=await mkdtemp(path.join(tmpdir(),'cairn-popup-test-'));
const extension=path.join(temp,'extension');
await cp(path.join(root,'extension'),extension,{recursive:true});
const manifest=JSON.parse(await readFile(path.join(extension,'manifest.json'),'utf8'));
assert.equal(manifest.host_permissions,undefined);
manifest.host_permissions=['http://127.0.0.1/*']; // Only the isolated test copy.
await writeFile(path.join(extension,'manifest.json'),JSON.stringify(manifest));
const server=http.createServer((req,res)=>res.end('<!doctype html><title>Synthetic popup test</title><textarea id="narrative" aria-label="Synthetic narrative"></textarea>'));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const out=path.join(root,'test-results');await mkdir(path.join(out,'screenshots'),{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const results=[];let browserVersion;
async function protocol(browser,targetId) {
  const pending=new Map();let sequence=0;
  browser.on('Target.receivedMessageFromTarget',e=>{
    const r=JSON.parse(e.message),entry=pending.get(r.id);
    if(!entry)return;pending.delete(r.id);clearTimeout(entry.timer);
    if(r.error)entry.reject(new Error(r.error.message));else entry.resolve(r.result);
  });
  const {sessionId}=await browser.send('Target.attachToTarget',{targetId,flatten:false});
  return (method,params={})=>new Promise((resolve,reject)=>{
    const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error('Popup protocol timed out'));},10000);
    pending.set(id,{resolve,reject,timer});
    browser.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id,method,params})}).catch(reject);
  });
}
let context;
try {
  for(const scale of [1,1.25]) {
    context=await chromium.launchPersistentContext(path.join(temp,'profile-'+scale),{
      headless:false,channel:'chromium',viewport:null,
      args:['--disable-extensions-except='+extension,'--load-extension='+extension,'--window-size=1280,900','--force-device-scale-factor='+scale]
    });
    browserVersion=context.browser().version();
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id=new URL(worker.url()).host;
    const page=await context.newPage();await page.goto(origin);
    const ui=await context.newPage();await ui.goto('chrome-extension://'+id+'/workspace.html');
    async function api(type,rest={}) {
      const r=await ui.evaluate(async({type,rest})=>chrome.runtime.sendMessage({type,...rest}),{type,rest});
      assert(r.ok,'Synthetic popup configuration failed');return r.data;
    }
    const tabId=await ui.evaluate(async origin=>(await chrome.tabs.query({})).find(t=>t.url?.startsWith(origin)).id,origin);
    const browser=await context.browser().newBrowserCDPSession();
    for(const enabled of [false,true])for(const theme of ['light','dark']) {
      if(enabled)await api('ENABLE',{origin,tabId});
      await api('THEME_SET',{appearance:theme});
      await page.bringToFront();
      await worker.evaluate(()=>chrome.action.openPopup());
      let target;
      for(let n=0;n<60;n++){
        target=(await browser.send('Target.getTargets')).targetInfos.find(t=>t.url==='chrome-extension://'+id+'/popup.html');
        if(target)break;await sleep(100);
      }
      assert(target,'Chrome must create its actual action popup');
      const send=await protocol(browser,target.targetId);
      await send('Runtime.enable');
      const evaluate=async expression=>{
        const r=await send('Runtime.evaluate',{expression,returnByValue:true});
        assert(!r.exceptionDetails,'Popup evaluation failed');return r.result.value;
      };
      let metrics,previous='',stable=0;
      for(let n=0;n<60;n++){
        metrics=await evaluate("({width:innerWidth,height:innerHeight,rootWidth:document.documentElement.scrollWidth,bodyWidth:document.body.getBoundingClientRect().width,scheme:getComputedStyle(document.documentElement).colorScheme,status:document.getElementById('status').textContent,toggle:document.getElementById('toggle').getBoundingClientRect().width,card:document.querySelector('.card').getBoundingClientRect().width})");
        const current=JSON.stringify(metrics);
        stable=current===previous ? stable+1 : 0;previous=current;
        if(metrics.status===(enabled?'Protection is on':'Protection is off') && metrics.scheme===theme && stable>=3)break;
        await sleep(100);
      }
      assert(stable>=3,'Native popup must settle before measuring');
      const label='popup-native-'+theme+'-'+(enabled?'on':'off')+'-'+scale;
      const shot=await send('Page.captureScreenshot',{format:'png'});
      await writeFile(path.join(out,'screenshots',label+'.png'),Buffer.from(shot.data,'base64'));
      results.push({scale,theme,enabled,...metrics});
      assert(metrics.width>=380 && metrics.width<=410,JSON.stringify({label,...metrics}));
      assert.equal(metrics.bodyWidth,380);
      assert(metrics.rootWidth<=metrics.width,'No horizontal popup scrolling');
      assert(metrics.card>=320 && metrics.toggle>=280,'Protection controls must remain usable');
      assert.equal(metrics.scheme,theme);assert.equal(metrics.status,enabled?'Protection is on':'Protection is off');
      const bottom=await evaluate("(()=>{const b=document.getElementById('workspace');b.scrollIntoView({block:'end'});const r=b.getBoundingClientRect();return {width:r.width,visible:r.top>=0 && r.bottom<=innerHeight+1};})()");
      assert(bottom.width>=300 && bottom.visible,'Recovery action must remain reachable');
      await browser.send('Target.closeTarget',{targetId:target.targetId});
      console.log('PASS '+label);
    }
    await context.close();context=null;
  }
} finally {
  await writeFile(path.join(out,'popup-summary.json'),JSON.stringify({version:manifest.version,browser:browserVersion,nativeToolbar:true,syntheticOnly:true,permissionPrompt:'not tested; loopback host pre-granted in test copy',results},null,2)+'\n');
  await context?.close();await new Promise(resolve=>server.close(resolve));
  assert.equal(path.dirname(path.resolve(temp)),path.resolve(tmpdir()));
  await rm(temp,{recursive:true,force:true});
}

