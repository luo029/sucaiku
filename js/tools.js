/* js / tools.js · 辅助功能：去重 / 统计 / 健康检查 */
/* =========================================================
   去重
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
function checkDuplicates(){
  const listEl=$('dupList');listEl.innerHTML='';
  const items=db.items.filter(i=>i.text);const pairs=[];
  for(let i=0;i<items.length;i++){
    for(let j=i+1;j<items.length;j++){
      const sim=calculateSimilarity(items[i].text,items[j].text);
      if(sim>=0.5)pairs.push({item1:items[i],item2:items[j],sim});
    }
  }
  if(!pairs.length){
    listEl.innerHTML='<div style="text-align:center;padding:24px;color:var(--text-3);font-size:14px;">太棒了，没有发现相似度超过 50% 的素材！</div>';
  }else{
    pairs.sort((a,b)=>b.sim-a.sim);
    listEl.innerHTML=pairs.map(p=>{
      const percent=Math.round(p.sim*100);
      return `<div class="dup-pair">
        <div class="dup-percent">相似度 ${percent}%</div>
        <div class="dup-text">${esc(p.item1.text)}</div>
        <div class="dup-text">${esc(p.item2.text)}</div>
        <div class="dup-actions">
          <button class="btn tiny danger" data-del-dup="${p.item2.id}">删除下方</button>
          <button class="btn tiny danger" data-del-dup="${p.item1.id}">删除上方</button>
        </div>
      </div>`;
    }).join('');
  }
  $('dupMask').classList.add('show');
}

/* =========================================================
   统计
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
   健康检查
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
