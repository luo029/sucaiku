/* js / tools.js · 辅助功能：去重 / 统计 / 健康检查 */

/* =========================================================
   字符串相似度（保留原算法）
   ========================================================= */
function calculateSimilarity(str1,str2){
  if(!str1||!str2)return 0;
  if(str1===str2)return 1;
  const maxLength=Math.max(str1.length,str2.length);
  if(Math.abs(str1.length-str2.length)/maxLength>0.5)return 0;
  const clean=s=>s.replace(/[\s\p{P}]/gu,'');
  const c1=clean(str1);const c2=clean(str2);
  if(!c1||!c2)return 0;
  const set1=new Set(c1);const set2=new Set(c2);
  let intersection=0;
  for(let ch of set1){if(set2.has(ch))intersection++;}
  const union=set1.size+set2.size-intersection;
  return intersection/union;
}

/* =========================================================
   去重（★ 优化：长度分桶 + 完全重复 Map + 结果上限）
   ---------------------------------------------------------
   原算法：所有 i < j 两两对比，1000 条要跑 ~50 万次
   新算法：
     1. 先按文本长度排序，只跟「长度差 ≤ 50%」的项比较
        （因为 calculateSimilarity 里长度差 > 50% 直接返回 0）
     2. 完全重复的文本用 Map 一遍扫完
     3. 最多输出 200 对相似结果，避免界面卡死
   ========================================================= */
function checkDuplicates(){
  const listEl=$('dupList');
  listEl.innerHTML='<div style="text-align:center;padding:24px;color:var(--text-3);font-size:14px;">正在检测相似素材…</div>';

  // 用 setTimeout 让上面的提示先渲染出来，再跑计算
  setTimeout(()=>{
    const items = db.items.filter(i => i.text && i.text.trim());
    
    // ---- 1. 完全重复：一遍扫描 ----
    const exactMap = new Map();
    items.forEach(i => {
      const key = i.text.trim();
      if (!exactMap.has(key)) exactMap.set(key, []);
      exactMap.get(key).push(i);
    });
    
    const pairs = [];
    const seenPairs = new Set(); // 避免同一对被重复加
    const pairKey = (a,b) => a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;
    const MAX_PAIRS = 200;
    const MAX_ITEMS_FOR_LOOP = 5000; // 超过 5000 条只检测完全重复 + 抽样近似

    // ---- 2. 完全重复先入列 ----
    for (const [text, group] of exactMap) {
      if (group.length < 2) continue;
      for (let i = 0; i < group.length - 1; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const k = pairKey(group[i], group[j]);
          if (!seenPairs.has(k)) {
            seenPairs.add(k);
            pairs.push({ item1: group[i], item2: group[j], sim: 1 });
            if (pairs.length >= MAX_PAIRS) break;
          }
        }
        if (pairs.length >= MAX_PAIRS) break;
      }
      if (pairs.length >= MAX_PAIRS) break;
    }

    // ---- 3. 相似度检测（长度分桶） ----
    if (pairs.length < MAX_PAIRS) {
      // 按长度排序，每个 item 只跟长度相近的比较
      const sorted = items.slice().sort((a,b) => a.text.length - b.text.length);
      const n = sorted.length;

      for (let i = 0; i < n && pairs.length < MAX_PAIRS; i++) {
        const a = sorted[i];
        const aLen = a.text.length;
        // 计算长度上界：maxLen 满足 (maxLen - aLen) / maxLen <= 0.5  →  maxLen <= 2 * aLen
        const maxLen = aLen * 2;

        for (let j = i + 1; j < n; j++) {
          const b = sorted[j];
          const bLen = b.text.length;
          if (bLen > maxLen) break; // 长度差超 50%，后面的更不可能匹配

          // 完全重复已经在第 2 步处理过，跳过
          if (a.text.trim() === b.text.trim()) continue;

          const k = pairKey(a, b);
          if (seenPairs.has(k)) continue;

          // 超过 5000 条时，抽样：只对前 5000 条做近似检测
          if (n > MAX_ITEMS_FOR_LOOP && i >= MAX_ITEMS_FOR_LOOP) break;

          const sim = calculateSimilarity(a.text, b.text);
          if (sim >= 0.5) {
            seenPairs.add(k);
            pairs.push({ item1: a, item2: b, sim });
            if (pairs.length >= MAX_PAIRS) break;
          }
        }
      }
    }

    // ---- 4. 渲染 ----
    if (!pairs.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-3);font-size:14px;">太棒了，没有发现相似度超过 50% 的素材！</div>';
    } else {
      pairs.sort((a, b) => b.sim - a.sim);
      const truncated = pairs.length >= MAX_PAIRS;
      listEl.innerHTML = pairs.map(p => {
        const percent = Math.round(p.sim * 100);
        return `<div class="dup-pair">
          <div class="dup-percent">相似度 ${percent}%</div>
          <div class="dup-text">${esc(p.item1.text)}</div>
          <div class="dup-text">${esc(p.item2.text)}</div>
          <div class="dup-actions">
            <button class="btn tiny danger" data-del-dup="${p.item2.id}">删除下方</button>
            <button class="btn tiny danger" data-del-dup="${p.item1.id}">删除上方</button>
          </div>
        </div>`;
      }).join('') + (truncated ? `<div style="text-align:center;padding:12px;color:var(--text-3);font-size:13px;">仅显示前 ${MAX_PAIRS} 对，清理后可再次检测</div>` : '');
    }

    $('dupMask').classList.add('show');
  }, 50);
}

/* =========================================================
   统计（保持不变）
   ========================================================= */
function openStats(){
  const total=db.items.length;
  const chars=db.items.reduce((s,i)=>s+i.text.length,0);
  const now=new Date();
  const startOfToday=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
  const weekAgo=Date.now()-7*86400000;
  const today=db.items.filter(i=>i.createdAt>=startOfToday).length;
  const week=db.items.filter(i=>i.createdAt>=weekAgo).length;
  const dims=db.settings.statsDims||{};
  const limit=Math.max(3,Math.min(30,Number(db.settings.statsLimit)||8));

  const catCounts={};db.items.forEach(i=>catCounts[i.type]=(catCounts[i.type]||0)+1);
  const srcCounts={};db.items.forEach(i=>{if(i.source)srcCounts[i.source]=(srcCounts[i.source]||0)+1;});
  const tagCounts=collectTags();
  const imgCatCounts={};
  db.items.forEach(i=>(i.images||[]).forEach(im=>{const c=(im.cat||'其他');imgCatCounts[c]=(imgCatCounts[c]||0)+1;}));

  function barSection(title,counts){
    const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,limit);
    if(!entries.length)return '';
    const max=Math.max(...entries.map(e=>e[1]));
    return `<div class="stat-section"><h4>${title}</h4>
      ${entries.map(([name,n])=>`<div class="stat-row">
        <span class="stat-name" title="${esc(name)}">${esc(name)}</span>
        <span class="stat-track"><span class="stat-fill" style="width:${Math.round(n/max*100)}%"></span></span>
        <span class="stat-val">${n}</span>
      </div>`).join('')}
    </div>`;
  }
  let sections='';
  if(dims.cat!==false)sections+=barSection('分类分布',catCounts);
  if(dims.source!==false)sections+=barSection('来源分布',srcCounts);
  if(dims.tag!==false)sections+=barSection('标签分布',tagCounts);
  if(Object.keys(imgCatCounts).length)sections+=barSection('图片分类分布',imgCatCounts);

  $('statsContent').innerHTML=`
    <div class="stat-grid">
      <div class="stat-box"><div class="sb-num">${total}</div><div class="sb-label">素材总数</div></div>
      <div class="stat-box"><div class="sb-num">${chars}</div><div class="sb-label">总字数</div></div>
      <div class="stat-box"><div class="sb-num">${today}</div><div class="sb-label">今日新增</div></div>
      <div class="stat-box"><div class="sb-num">${week}</div><div class="sb-label">近 7 天新增</div></div>
    </div>
    ${sections}
    ${!total?'<div style="text-align:center;padding:20px;color:var(--text-3);font-size:14px;">还没有素材</div>':''}`;
  $('statsMask').classList.add('show');
}

/* =========================================================
   健康检查（保持不变）
   ========================================================= */
function openHealth(){
  const textItems = db.items.filter(i=>i.text);
  const noSource = textItems.filter(i=>!i.source);
  const noTag = textItems.filter(i=>!i.tags||!i.tags.length);
  const longText = textItems.filter(i=>i.text.length>500);
  const uncat = textItems.filter(i=>i.type===UNCAT);
  const textMap={};
  textItems.forEach(i=>{const k=i.text.trim();(textMap[k]=textMap[k]||[]).push(i);});
  const exactDups=Object.values(textMap).filter(g=>g.length>1);
  $('healthTotal').textContent=db.items.length;

  function section(title,arr){
    if(!arr.length)return `<div class="health-section"><div class="health-title">${title}<span class="health-badge ok">正常</span></div></div>`;
    const preview=arr.slice(0,20);
    return `<div class="health-section">
      <div class="health-title">${title}<span class="health-badge">${arr.length}</span></div>
      ${preview.map(i=>`<div class="health-item" data-edit="${i.id}">
        <span class="hi-text">${esc(i.text.slice(0,60))}${i.text.length>60?'…':''}</span>
        <span class="hi-meta">${esc(i.type)}${i.source?' · '+esc(i.source):''}</span>
      </div>`).join('')}
      ${arr.length>20?`<div style="font-size:12px;color:var(--text-3);padding:4px 2px;">还有 ${arr.length-20} 条未显示…</div>`:''}
    </div>`;
  }
  let dupSection='';
  if(exactDups.length){
    dupSection=`<div class="health-section">
      <div class="health-title">完全重复<span class="health-badge">${exactDups.length} 组</span></div>
      ${exactDups.slice(0,10).map(g=>`<div class="health-item" data-edit="${g[1].id}">
        <span class="hi-text">${esc(g[0].text.slice(0,50))}${g[0].text.length>50?'…':''}</span>
        <span class="hi-meta">共 ${g.length} 条</span>
      </div>`).join('')}
    </div>`;
  }else{
    dupSection=`<div class="health-section"><div class="health-title">完全重复<span class="health-badge ok">正常</span></div></div>`;
  }
  $('healthList').innerHTML=section('无来源',noSource)+section('无标签',noTag)+section('未分类',uncat)+section('超长（>500 字）',longText)+dupSection;
  $('healthMask').classList.add('show');
}