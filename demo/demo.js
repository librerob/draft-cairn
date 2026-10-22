document.getElementById('reload').onclick=()=>location.reload();
document.getElementById('expire').onclick=()=>location.assign('expired.html');
const sample='Our synthetic project opens a shared workshop for the Northbank community. We will run accessible weekly sessions and evaluate participation with consent. '.repeat(5)+'😀 é 👨‍👩‍👧‍👦';
document.getElementById('sample').textContent=sample;
document.getElementById('sample-copy').onclick=async()=>{await navigator.clipboard.writeText(sample);document.getElementById('sample-copy').textContent='Copied synthetic answer';};
