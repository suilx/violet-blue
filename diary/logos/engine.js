(function(root){
  'use strict';
  const convert = root.OpenCC.Converter({from:'cn',to:'tw'});
  const regional = root.OpenCC.Converter({from:'cn',to:'twp'});
  const entries = [
    ['软件','軟體'],['硬件','硬體'],['视频','影片'],['音频','音訊'],['信息','資訊'],['网络','網路'],['互联网','網際網路'],['服务器','伺服器'],['客户端','用戶端'],['数据库','資料庫'],['数据','資料'],['文件夹','資料夾'],['文件','檔案','建議確認：公文、證件仍可稱文件',false],['默认','預設'],['设置','設定'],['打印机','印表機'],['打印','列印'],['鼠标','滑鼠'],['键盘','鍵盤'],['内存','記憶體'],['硬盘','硬碟'],['显卡','顯示卡'],['主板','主機板'],['屏幕','螢幕'],['显示器','顯示器'],['分辨率','解析度'],['像素','畫素'],['激活','啟用'],['账号','帳號'],['登录','登入'],['注销','登出','建議確認：註銷登記不等於登出',false],['链接','連結'],['博客','部落格'],['博主','創作者'],['播客','Podcast'],['程序员','程式設計師'],['程序','程式','建議確認：辦事程序不需更換',false],['代码','程式碼','建議確認：行政代碼不需更換',false],['源代码','原始碼'],['开源','開放原始碼'],['搜索引擎','搜尋引擎'],['搜索','搜尋'],['缓存','快取'],['加载','載入'],['下载','下載'],['上传','上傳'],['保存','儲存','建議確認：保存食物不需更換',false],['粘贴','貼上'],['剪切','剪下'],['回收站','資源回收筒'],['桌面','桌面'],['应用程序','應用程式'],['操作系统','作業系統'],['智能手机','智慧型手機'],['手机','手機'],['充电宝','行動電源'],['充电器','充電器'],['耳机','耳機'],['摄像头','攝影機'],['摄像机','攝影機'],['摄像','錄影'],['录像','錄影'],['外卖','外送'],['快递','快遞'],['快递员','快遞員'],['地铁','捷運'],['公交车','公車'],['出租车','計程車'],['网约车','多元計程車','建議確認當地服務類型',false],['共享单车','公共自行車'],['自行车','腳踏車'],['自行車','腳踏車'],['土豆','馬鈴薯','建議確認：臺灣「土豆」也可能指花生',false],['西红柿','番茄'],['酸奶','優格'],['方便面','泡麵'],['盒饭','便當'],['一次性','免洗','建議確認：僅適合免洗餐具等情境',false],['性价比','CP 值'],['质量','品質','建議確認：物理學的質量不可替換',false],['品质','品質'],['售后','售後服務'],['线上','線上'],['线下','實體','建議確認：依活動或通路情境決定',false],['网红','網紅'],['直播间','直播間'],['点赞','按讚'],['转发','轉貼'],['关注','追蹤','建議確認：關心、關注議題不等於追蹤帳號',false],['收藏','加入收藏','建議確認：收藏品不需更換',false],['私信','私訊'],['截图','截圖'],['录屏','螢幕錄影'],['U盘','隨身碟'],['优盘','隨身碟'],['移动硬盘','外接硬碟'],['宽带','寬頻'],['运营商','電信業者'],['带宽','頻寬'],['延迟','延遲'],['死机','當機'],['卡顿','卡頓'],['重启','重新啟動'],['重置','重設'],['修复','修復'],['兼容','相容'],['兼容性','相容性'],['端口','連接埠'],['接口','介面','建議確認：硬體接頭也可能稱連接埠',false],['固件','韌體'],['驱动程序','驅動程式'],['操作界面','操作介面'],['用户界面','使用者介面'],['用户','使用者'],['反馈','回饋'],['优化','最佳化'],['智能','智慧','建議確認：保留專有名稱',false]
  ];
  entries.push(
    ['点赞关注','按讚追蹤'],['点赞、关注','按讚、追蹤'],['点赞和关注','按讚和追蹤'],['关注我','追蹤我'],['关注这个博主','追蹤這位創作者'],['关注这位博主','追蹤這位創作者'],
    ['对比一下','比較一下'],['对比下','比較一下'],['对比看看','比較看看'],['排查一下','檢查一下'],['排查问题','找出問題'],['出在哪些环节','出在哪些環節'],['到时候','到時候'],
    ['视频通话','視訊通話'],['视频会议','視訊會議'],['在线视频','線上影片'],['短视频','短影音'],['录制视频','錄製影片'],['看视频','看影片'],['视频博主','影音創作者'],
    ['网盘','雲端硬碟'],['云端存储','雲端儲存'],['云存储','雲端儲存'],['文件管理器','檔案總管'],['资源管理器','檔案總管'],['任务管理器','工作管理員'],['回车键','Enter 鍵'],['回车','Enter'],
    ['笔记本电脑','筆記型電腦'],['台式电脑','桌上型電腦'],['台式机','桌上型電腦'],['笔记本','筆記型電腦','依上下文判斷',false],['数码相机','數位相機'],['数码','數位'],['移动设备','行動裝置'],
    ['路由器','路由器'],['光猫','光纖數據機'],['调制解调器','數據機'],['网线','網路線'],['网卡','網路卡'],['无线网络','無線網路'],['局域网','區域網路'],['远程控制','遠端控制'],['远程桌面','遠端桌面'],
    ['安装包','安裝檔'],['安装程序','安裝程式'],['卸载软件','解除安裝軟體'],['卸载','解除安裝'],['桌面快捷方式','桌面捷徑'],['快捷方式','捷徑'],['快捷键','快速鍵'],['热键','快捷鍵'],
    ['刷新网页','重新整理網頁'],['刷新页面','重新整理頁面'],['刷新','重新整理','依上下文判斷',false],['浏览器','瀏覽器'],['浏览记录','瀏覽紀錄'],['网址','網址'],['页面','頁面'],['个人主页','個人頁面'],
    ['注册账号','註冊帳號'],['密码','密碼'],['验证码','驗證碼'],['短信','簡訊'],['邮件','電子郵件'],['邮箱','電子信箱'],['联系人','聯絡人'],['通讯录','通訊錄'],['消息通知','訊息通知'],['消息','訊息','新聞消息保留原義',false],
    ['软件更新','軟體更新'],['系统更新','系統更新'],['版本号','版本號碼'],['用户体验','使用者體驗'],['用户反馈','使用者回饋'],['交互设计','互動設計'],['交互','互動'],['适配','適配'],
    ['网络直播','網路直播'],['直播带货','直播銷售'],['弹幕','彈幕'],['打赏','贊助'],['刷卡支付','刷卡付款'],['移动支付','行動支付'],['扫码支付','掃碼付款'],['扫码','掃碼'],
    ['外卖小哥','外送員'],['外卖员','外送員'],['打车','搭計程車'],['打的','搭計程車'],['网购','網購'],['包邮','免運費'],['邮费','郵資'],['运费','運費'],['退货','退貨'],['售后客服','售後客服'],
    ['塑料袋','塑膠袋'],['塑料','塑膠'],['一次性筷子','免洗筷'],['一次性餐具','免洗餐具'],['一次性杯子','免洗杯'],['一次性口罩','拋棄式口罩'],['保鲜膜','保鮮膜'],
    ['冰激凌','冰淇淋'],['冰淇凌','冰淇淋'],['薯片','洋芋片'],['三文鱼','鮭魚'],['猕猴桃','奇異果'],['火龙果','火龍果'],['奶酪','起司'],['芝士','起司'],['花菜','花椰菜'],
    ['圆珠笔','原子筆'],['中性笔','中性筆'],['橡皮擦','橡皮擦'],['订书机','釘書機'],['打印纸','影印紙'],['复印机','影印機'],['复印','影印'],['复印件','影本'],['证件照','證件照'],
    ['小区','社區'],['物业','物業'],['楼盘','建案'],['房产中介','房仲'],['房地产','不動產'],['装修','裝潢'],['卫生间','洗手間'],['洗手间','洗手間'],['保洁','清潔人員'],
    ['运营','營運'],['营销','行銷'],['渠道','通路','依上下文判斷',false],['项目经理','專案經理'],['项目管理','專案管理'],['项目','專案','學科與比賽項目保留原義',false],['绩效','績效'],['预算','預算'],
    ['靠谱','可靠'],['不靠谱','不可靠'],['离谱','誇張'],['挺好用','滿好用'],['挺不错','滿不錯'],['挺方便','滿方便'],['挺好','滿好'],['太牛了','太厲害了'],['牛逼','厲害'],['绝绝子','超讚'],['太给力了','太讚了'],['不给力','不太行'],['很给力','很不錯'],['给力','很讚'],['被种草了','被燒到了'],['被种草','被燒到'],['种草清单','推薦清單'],['种草','種草'],['避雷','避雷'],['踩雷','踩雷'],['内卷','內耗','依上下文判斷',false]
  );
  const imported = new Map();
  let importedIndex=0;
  function addImported(from,to,source){
    from=convert(from);to=convert(to);
    if(!from||from===to)return;
    imported.set(from,{id:'lexicon-'+importedIndex++,from,to,note:source,enabled:true});
  }
  for(const table of root.OpenCC.Locale.to.twp.flat()){
    for(const item of table.split('|')){const [from,to]=item.split(' ');if(from&&to)addImported(from,to,'OpenCC 臺灣地區詞庫');}
  }
  for(const [from,to] of Object.entries(root.LogosLexicon||{}))addImported(from,to,'同文堂詞庫');
  entries.push(['守望先锋','鬥陣特攻']);
  for(const [i,e] of entries.entries()){
    const from=convert(e[0]);
    if(from!==e[1])imported.set(from,{id:'base-'+i,from,to:e[1],note:e[2]||'臺灣用詞',enabled:e[3]!==false});
  }
  const defaults=[...imported.values()];
  function indexRules(rules){
    const buckets=new Map();
    for(const rule of rules){const first=rule.from[0];if(!buckets.has(first))buckets.set(first,[]);buckets.get(first).push(rule);}
    for(const bucket of buckets.values())bucket.sort((a,b)=>b.from.length-a.from.length);
    return buckets;
  }
  const defaultIndex=indexRules(defaults);
  function contextEnabled(rule,text,pos){
    if(rule.enabled)return true;
    const left=text.slice(0,pos).split(/[。！？!?\n；;]/).pop();
    const right=text.slice(pos).split(/[。！？!?\n；;]/)[0];
    const sentence=left+right;
    if(rule.from==='質量'){
      if(/物理|質量守恆|原子|粒子|摩爾|千克|公斤|密度|慣性|重力|重量|體積|能量|質量數|質量分數/.test(sentence))return false;
      return /產品|商品|衣服|做工|服務|工程|教學|生活|空氣|內容|影片|視頻|音訊|畫面|質量(?:很|挺|真|不|非常|太)?(?:好|差|高|低|穩定|可靠)/.test(sentence);
    }
    if(rule.from==='關注')return /帳號|賬號|博主|創作者|頻道|粉絲|按讚|點贊|主頁/.test(sentence)&&!/關注(?:環境|健康|安全|問題|社會|孩子|兒童)/.test(sentence);
    if(rule.from==='文件')return /上傳|下載|儲存|保存|刪除|複製|粘貼|貼上|電腦|軟件|軟體|資料夾|檔案夾|附件/.test(sentence)&&!/法律|公文|證件|官方文件|政府文件/.test(sentence);
    if(rule.from==='保存')return /檔案|文件|圖片|照片|設定|設置|網頁|密碼|進度|資料|數據/.test(sentence)&&!/食物|食品|冷藏|冷凍|保存期限/.test(sentence);
    if(rule.from==='程序'||rule.from==='代碼')return /軟件|軟體|電腦|開發|編寫|編程|執行|運行|JavaScript|Python|HTML|API|函數|伺服器|服務器/.test(sentence);
    if(rule.from==='項目')return /專案|開發|軟體|軟件|工程|計畫|管理|經理|團隊|GitHub/.test(sentence)&&!/比賽|運動|考試|檢查項目/.test(sentence);
    if(rule.from==='消息')return /發送|傳送|收到|接收|聊天|私訊|微信|簡訊|通知/.test(sentence)&&!/新聞|好消息|壞消息/.test(sentence);
    if(rule.from==='刷新')return /網頁|頁面|瀏覽器|網站/.test(sentence)&&!/紀錄|記錄/.test(sentence);
    if(rule.from==='筆記本')return /電腦|處理器|記憶體|螢幕|硬碟|開機|遊戲/.test(sentence);
    if(rule.from==='土豆')return /炒|燉|煮|炸|削皮|土豆泥|土豆絲|土豆片/.test(sentence);
    return false;
  }
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
    let rules=defaultIndex;
    if(custom.length){const map=new Map(defaults.map(r=>[r.from,r]));custom.forEach(r=>map.set(r.from,r));rules=indexRules(map.values());}
    const parts=[],found=new Map(); let occurrence=0;
    // Preserve URL/email and inline/fenced code verbatim, including simplified characters.
    const protectedPattern=/(```[\s\S]*?(?:```|$)|`[^`\n]*`|https?:\/\/[^\s<>"'）。，！？]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/g;
    const chunks=input.split(protectedPattern);
    chunks.forEach((chunk,index)=>{
      if(index%2){parts.push({text:chunk});return;}
      const text=convert(chunk);let pos=0,plain='';
      while(pos<text.length){
        const rule=rules.get(text[pos])?.find(r=>text.startsWith(r.from,pos));
        if(!rule){plain+=text[pos++];continue;}
        if(plain){parts.push({text:regional(plain)});plain='';}
        const id=rule.id+':'+occurrence++;
        const active=overrides.has(id)?overrides.get(id):contextEnabled(rule,text,pos);
        parts.push({text:active?rule.to:rule.from,rule:id,active});
        const context=text.slice(Math.max(0,pos-10),Math.min(text.length,pos+rule.from.length+12));
        found.set(id,{...rule,id,active,count:1,note:rule.note+' · 「'+context+'」'});
        pos+=rule.from.length;
      }
      if(plain)parts.push({text:regional(plain)});
    });
    return {parts,changes:[...found.values()],text:parts.map(p=>p.text).join('')};
  }
  root.LogosEngine={run,parseCustom,defaults};
})(typeof window!=='undefined'?window:globalThis);
