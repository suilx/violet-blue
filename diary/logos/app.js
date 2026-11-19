(()=>{'use strict';
const $=id=>document.getElementById(id),source=$('source'),overrides=new Map();let custom=[],timer,result={text:'',changes:[],parts:[]},composing=false;
try{$('dictionary').value=localStorage.getItem('suilx-logos-dictionary')||'';custom=LogosEngine.parseCustom($('dictionary').value);}catch{ $('dictStatus').textContent='上次的註記無法載入，可重新編輯。'; }
function render(){
  try{result=LogosEngine.run(source.value,custom,overrides);}catch{$('status').textContent='暫時無法整理，請重新載入頁面。';return;}
  $('count').textContent=Array.from(source.value).length.toLocaleString()+' 字';
  $('status').textContent=source.value?'已整理':'等待字句';$('copy').disabled=!source.value;
  $('result').replaceChildren();
  if(!source.value){const e=document.createElement('span');e.className='empty';e.textContent='在另一種語感裡，讀見原意。';$('result').append(e);}
  else result.parts.forEach(part=>{if(part.active&&$('highlight').checked){const mark=document.createElement('mark');mark.textContent=part.text;$('result').append(mark);}else $('result').append(document.createTextNode(part.text));});
  const applied=result.changes.filter(c=>c.active).reduce((s,c)=>s+c.count,0),pending=result.changes.filter(c=>!c.active).length;
  $('changesCount').textContent=applied+' 處替換'+(pending?' · '+pending+' 組待確認':'');$('changes').replaceChildren();
  if(!result.changes.length){const p=document.createElement('p');p.className='muted';p.textContent=source.value?'這段文字沒有命中目前的用詞表。':'有些字不必改，有些只是另一種習慣。';$('changes').append(p);}
  result.changes.forEach(change=>{const row=document.createElement('label');row.className='change';const check=document.createElement('input');check.type='checkbox';check.checked=change.active;check.setAttribute('aria-label',change.from+' 改為 '+change.to);check.addEventListener('change',()=>{overrides.set(change.id,check.checked);render();});const from=document.createElement('del');from.textContent=change.from;const to=document.createElement('strong');to.textContent=change.to;const note=document.createElement('small');note.textContent=change.note+' · '+change.count+' 處';row.append(check,from,to,note);$('changes').append(row);});
}
function schedule(){if(composing)return;clearTimeout(timer);$('count').textContent=Array.from(source.value).length.toLocaleString()+' 字';$('status').textContent='整理字句中…';timer=setTimeout(render,650);}
source.addEventListener('input',()=>{overrides.clear();schedule();});source.addEventListener('compositionstart',()=>{composing=true;clearTimeout(timer);});source.addEventListener('compositionend',()=>{composing=false;schedule();});
$('highlight').addEventListener('change',render);
$('example').addEventListener('click',()=>{source.value='我刚上传了一个视频，介绍这款软件怎么设置。把链接粘贴到浏览器，就能下载文件。这个产品的质量很好；物理课上也会讨论质量。';overrides.clear();clearTimeout(timer);render();source.focus();});
$('clear').addEventListener('click',()=>{source.value='';overrides.clear();clearTimeout(timer);render();source.focus();});
$('copy').addEventListener('click',async()=>{clearTimeout(timer);render();try{await navigator.clipboard.writeText(result.text);$('status').textContent='已複製';}catch{$('status').textContent='請選取右側文字手動複製。';}});
$('saveDict').addEventListener('click',()=>{try{const parsed=LogosEngine.parseCustom($('dictionary').value);custom=parsed;overrides.clear();try{localStorage.setItem('suilx-logos-dictionary',$('dictionary').value);$('dictStatus').textContent='註記已儲存。';}catch{$('dictStatus').textContent='已套用；瀏覽器未允許保存，下次需重新輸入。';}clearTimeout(timer);render();}catch(error){$('dictStatus').textContent=error.message;}});
render();
})();
