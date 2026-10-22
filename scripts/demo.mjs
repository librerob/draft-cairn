import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../demo/',import.meta.url));
const port=Number(process.env.PORT || 8765);
const server=http.createServer(async(req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;
  const candidate=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!candidate.startsWith(root+path.sep) && candidate!==path.join(root,'index.html')){res.writeHead(403).end();return;}
  try {const bytes=await readFile(candidate);res.writeHead(200,{'Content-Type':({'.html':'text/html','.css':'text/css','.js':'text/javascript'})[path.extname(candidate)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);}
  catch{res.writeHead(404).end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Synthetic demo: http://127.0.0.1:${port}`));
