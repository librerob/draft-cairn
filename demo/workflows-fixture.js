for(const [id,mode] of [['shadow-host','open'],['private-host','open'],['closed-host','closed']]){
  const host=document.getElementById(id),root=host.attachShadow({mode});
  const label=document.createElement('label');label.textContent='Synthetic shadow narrative';
  const area=document.createElement('textarea');area.id=id+'-answer';area.rows=5;label.append(area);root.append(label);
  if(mode==='closed')globalThis.focusClosed=()=>area.focus();
}
document.getElementById('narrative').addEventListener('input',e=>{document.getElementById('narrative-count').textContent=(e.target.value.trim().match(/\S+/g)||[]).length+'/50 words';});
document.getElementById('synthetic-form').addEventListener('submit',e=>e.preventDefault());
