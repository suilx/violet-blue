(function(root){
  'use strict';
  const convert = root.OpenCC.Converter({from:'cn',to:'tw'});
  const entries = [
    ['软件','軟體'],['硬件','硬體'],['视频','影片'],['音频','音訊'],['信息','資訊'],['网络','網路'],['互联网','網際網路'],['服务器','伺服器'],['客户端','用戶端'],['数据库','資料庫'],['数据','資料'],['文件夹','資料夾'],['文件','檔案','建議確認：公文、證件仍可稱文件',false],['默认','預設'],['设置','設定'],['打印机','印表機'],['打印','列印'],['鼠标','滑鼠'],['键盘','鍵盤'],['内存','記憶體'],['硬盘','硬碟'],['显卡','顯示卡'],['主板','主機板'],['屏幕','螢幕'],['显示器','顯示器'],['分辨率','解析度'],['像素','畫素'],['激活','啟用'],['账号','帳號'],['登录','登入'],['注销','登出','建議確認：註銷登記不等於登出',false],['链接','連結'],['博客','部落格'],['博主','創作者'],['播客','Podcast'],['程序员','程式設計師'],['程序','程式','建議確認：辦事程序不需更換',false],['代码','程式碼','建議確認：行政代碼不需更換',false],['源代码','原始碼'],['开源','開放原始碼'],['搜索引擎','搜尋引擎'],['搜索','搜尋'],['缓存','快取'],['加载','載入'],['下载','下載'],['上传','上傳'],['保存','儲存','建議確認：保存食物不需更換',false],['粘贴','貼上'],['剪切','剪下'],['回收站','資源回收筒'],['桌面','桌面'],['应用程序','應用程式'],['操作系统','作業系統'],['智能手机','智慧型手機'],['手机','手機'],['充电宝','行動電源'],['充电器','充電器'],['耳机','耳機'],['摄像头','攝影機'],['摄像机','攝影機'],['摄像','錄影'],['录像','錄影'],['外卖','外送'],['快递','快遞'],['快递员','快遞員'],['地铁','捷運'],['公交车','公車'],['出租车','計程車'],['网约车','多元計程車','建議確認當地服務類型',false],['共享单车','公共自行車'],['自行车','腳踏車'],['自行車','腳踏車'],['土豆','馬鈴薯','建議確認：臺灣「土豆」也可能指花生',false],['西红柿','番茄'],['酸奶','優格'],['方便面','泡麵'],['盒饭','便當'],['一次性','免洗','建議確認：僅適合免洗餐具等情境',false],['性价比','CP 值'],['质量','品質','建議確認：物理學的質量不可替換',false],['品质','品質'],['售后','售後服務'],['线上','線上'],['线下','實體','建議確認：依活動或通路情境決定',false],['网红','網紅'],['直播间','直播間'],['点赞','按讚'],['转发','轉貼'],['关注','追蹤','建議確認：關心、關注議題不等於追蹤帳號',false],['收藏','加入收藏','建議確認：收藏品不需更換',false],['私信','私訊'],['截图','截圖'],['录屏','螢幕錄影'],['U盘','隨身碟'],['优盘','隨身碟'],['移动硬盘','外接硬碟'],['宽带','寬頻'],['运营商','電信業者'],['带宽','頻寬'],['延迟','延遲'],['死机','當機'],['卡顿','卡頓'],['重启','重新啟動'],['重置','重設'],['修复','修復'],['兼容','相容'],['兼容性','相容性'],['端口','連接埠'],['接口','介面','建議確認：硬體接頭也可能稱連接埠',false],['固件','韌體'],['驱动程序','驅動程式'],['操作界面','操作介面'],['用户界面','使用者介面'],['用户','使用者'],['反馈','回饋'],['优化','最佳化'],['智能','智慧','建議確認：保留專有名稱',false]
  ];
  const defaults = entries.map((e,i)=>({id:'base-'+i,from:convert(e[0]),to:e[1],note:e[2]||'臺灣常見用詞',enabled:e[3]!==false})).filter(e=>e.from!==e.to);
  function parseCustom(text){
    const lines=text.split(/\r?\n/), result=[];
    for(let i=0;i<lines.length;i++){
      const line=lines[i].trim(); if(!line)continue;
      const at=line.indexOf('=');
      if(at<1||!line.slice(at+1).trim())throw Error('第 '+(i+1)+' 行請使用「原詞 = 新詞」。');
      const from=convert(line.slice(0,at).trim()),to=convert(line.slice(at+1).trim());
      if(from.length>80||to.length>200)throw Error('第 '+(i+1)+' 行詞句過長。');
      result.push({id:'custom-'+i,from,to,note:'你的頁邊註',enabled:true});
    }
    if(result.length>200)throw Error('最多可儲存 200 組註記。');
    return result;
  }
  function run(input,custom=[],overrides=new Map()){
    const map=new Map(defaults.map(r=>[r.from,r]));custom.forEach(r=>map.set(r.from,r));
    const rules=[...map.values()].sort((a,b)=>b.from.length-a.from.length);
    const parts=[],found=new Map(); let occurrence=0;
    // Preserve URL/email and inline/fenced code verbatim, including simplified characters.
    const protectedPattern=/(```[\s\S]*?(?:```|$)|`[^`\n]*`|https?:\/\/[^\s<>"'）。，！？]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/g;
    const chunks=input.split(protectedPattern);
    chunks.forEach((chunk,index)=>{
      if(index%2){parts.push({text:chunk});return;}
      const text=convert(chunk);let pos=0,plain='';
      while(pos<text.length){
        const rule=rules.find(r=>text.startsWith(r.from,pos));
        if(!rule){plain+=text[pos++];continue;}
        if(plain){parts.push({text:plain});plain='';}
        const id=rule.id+':'+occurrence++;
        const active=overrides.has(id)?overrides.get(id):rule.enabled;
        parts.push({text:active?rule.to:rule.from,rule:id,active});
        const context=text.slice(Math.max(0,pos-10),Math.min(text.length,pos+rule.from.length+12));
        found.set(id,{...rule,id,active,count:1,note:rule.note+' · 「'+context+'」'});
        pos+=rule.from.length;
      }
      if(plain)parts.push({text:plain});
    });
    return {parts,changes:[...found.values()],text:parts.map(p=>p.text).join('')};
  }
  root.LogosEngine={run,parseCustom,defaults};
})(typeof window!=='undefined'?window:globalThis);
