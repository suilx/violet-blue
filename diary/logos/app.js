(()=>{'use strict';
const source=document.getElementById('source'),result=document.getElementById('result'),copy=document.getElementById('copy'),status=document.getElementById('status');
let timer=null,composing=false;
function render(){timer=null;try{result.value=LogosEngine.run(source.value).text;status.textContent='';}catch{status.textContent='轉換失敗，請重新載入。';}document.getElementById('count').textContent=source.value?Array.from(source.value).length.toLocaleString()+' 字':'';copy.disabled=!result.value;}
function schedule(){if(composing)return;clearTimeout(timer);timer=setTimeout(render,650);}
source.addEventListener('input',schedule);source.addEventListener('compositionstart',()=>{composing=true;clearTimeout(timer);timer=null;});source.addEventListener('compositionend',()=>{composing=false;schedule();});
document.getElementById('clear').addEventListener('click',()=>{clearTimeout(timer);source.value='';render();source.focus();});result.addEventListener('input',()=>{copy.disabled=!result.value;});
copy.addEventListener('click',async()=>{if(timer){clearTimeout(timer);render();}try{await navigator.clipboard.writeText(result.value);status.textContent='已複製';}catch{status.textContent='請手動複製。';}});render();
})();