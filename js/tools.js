// js/tools.js · 完整文件
// ★ 本次改动：
//   1. 引入 LCS 算法实现红绿差异高亮。
//   2. 弹窗界面左右分栏，更直观。
//   3. 生成“就地编辑”所需的基础结构。

function getDiffHtml(str1, str2) {
  var MAX_LEN = 800;
  var s1 = str1.slice(0, MAX_LEN);
  var s2 = str2.slice(0, MAX_LEN);
  var suffix1 = str1.length > MAX_LEN ? '...' : '';
  var suffix2 = str2.length > MAX_LEN ? '...' : '';
  
  var n = s1.length, m = s2.length;
  if (n === 0 && m === 0) return { html1: '', html2: '' };
  if (n === 0) return { html1: '', html2: '<ins>' + esc(s2) + '</ins>' + suffix2 };
  if (m === 0) return { html1: '<del>' + esc(s1) + '</del>' + suffix1, html2: '' };

  var dp = [];
  for (var i = 0; i <= n; i++) dp[i] = new Array(m + 1).fill(0);
  for (var i = 1; i <= n; i++) {
    for (var j = 1; j <= m; j++) {
      if (s1[i - 1] === s2[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  var res1 = [], res2 = [];
  var i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && s1[i - 1] === s2[j - 1]) {
      res1.push(esc(s1[i - 1])); res2.push(esc(s2[j - 1])); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      res2.push('<ins>' + esc(s2[j - 1]) + '</ins>'); j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      res1.push('<del>' + esc(s1[i - 1]) + '</del>'); i--;
    }
  }

  function mergeTags(arr) {
    return arr.reverse().join('').replace(/<\/ins><ins>/g, '').replace(/<\/del><del>/g, '');
  }
  return { html1: mergeTags(res1) + suffix1, html2: mergeTags(res2) + suffix2 };
}

function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  const maxLength = Math.max(str1.length, str2.length);
  if (Math.abs(str1.length - str2.length) / maxLength > 0.5) return 0;
  const clean = s => s.replace(/[\s\p{P}]/gu, '');
  const c1 = clean(str1); const c2 = clean(str2);
  if (!c1 || !c2) return 0;
  const set1 = new Set(c1); const set2 = new Set(c2);
  let intersection = 0;
  for (let ch of set1) { if (set2.has(ch)) intersection++; }
  const union = set1.size + set2.size - intersection;
  return intersection / union;
}

function checkDuplicates() {
  const listEl = $('dupList');
  listEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-3);font-size:14px;">正在检测相似素材…</div>';
  
  if (!document.getElementById('diffStyles')) {
    var st = document.createElement('style');
    st.id = 'diffStyles';
    st.innerHTML = `
      .diff-panel { display: flex; gap: 12px; margin-top: 10px; }
      @media (max-width: 600px) { .diff-panel { flex-direction: column; } }
      .diff-col { flex: 1; min-width: 0; background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 12px; position: relative; font-size: 14px; line-height: 1.6; color: var(--text-2); white-space: pre-wrap; word-break: break-all; }
      .diff-col del { text-decoration: line-through; background: rgba(239, 68, 68, 0.15); color: var(--danger); padding: 1px 2px; border-radius: 3px; }
      .diff-col ins { text-decoration: none; background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 1px 2px; border-radius: 3px; }
      .diff-actions { position: absolute; top: 6px; right: 6px; display: flex; gap: 4px; opacity: 0; transition: opacity 0.2s; }
      .diff-col:hover .diff-actions { opacity: 1; }
      @media (hover: none) { .diff-actions { opacity: 1; } }
      .diff-badge { font-size: 11px; font-weight: bold; color: var(--text-3); margin-bottom: 8px; display: inline-block; }
    `;
    document.head.appendChild(st);
  }

  setTimeout(() => {
    const items = db.items.filter(i => i.text && i.text.trim());
    const exactMap = new Map();
    items.forEach(i => {
      const key = i.text.trim();
      if (!exactMap.has(key)) exactMap.set(key, []);
      exactMap.get(key).push(i);
    });
    const pairs = [];
    const seenPairs = new Set();
    const pairKey = (a, b) => a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;
    const MAX_PAIRS = 200;
    const MAX_ITEMS_FOR_LOOP = 5000;

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

    if (pairs.length < MAX_PAIRS) {
      const sorted = items.slice().sort((a, b) => a.text.length - b.text.length);
      const n = sorted.length;
      for (let i = 0; i < n && pairs.length < MAX_PAIRS; i++) {
        const a = sorted[i];
        const aLen = a.text.length;
        const maxLen = aLen * 2;
        for (let j = i + 1; j < n; j++) {
          const b = sorted[j];
          const bLen = b.text.length;
          if (bLen > maxLen) break;
          if (a.text.trim() === b.text.trim()) continue;
          const k = pairKey(a, b);
          if (seenPairs.has(k)) continue;
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

    var noticeHtml = '';
    if (items.length > MAX_ITEMS_FOR_LOOP) {
      noticeHtml = '<div style="padding:10px 12px; background:var(--accent-soft); color:var(--accent); border-radius:8px; font-size:13px; margin-bottom:12px;">⚠️ 当前 ' + items.length + ' 条素材超过 ' + MAX_ITEMS_FOR_LOOP + ' 条，仅对前 ' + MAX_ITEMS_FOR_LOOP + ' 条做了相似度检测（完全重复依然全量检查）。</div>';
    }

    if (!pairs.length) {
      listEl.innerHTML = noticeHtml + '<div style="text-align:center;padding:24px;color:var(--text-3);font-size:14px;">太棒了，没有发现相似度超过 50% 的素材！</div>';
    } else {
      pairs.sort((a, b) => b.sim - a.sim);
      const truncated = pairs.length >= MAX_PAIRS;
      
      listEl.innerHTML = noticeHtml + pairs.map((p, index) => {
        const percent = Math.round(p.sim * 100);
        const diff = getDiffHtml(p.item1.text, p.item2.text);
        
        return '<div class="dup-pair" style="padding: 16px; margin-bottom: 16px; border-radius: 12px;">' + 
          '<div class="dup-percent" style="margin-bottom: 12px;"><span>相似度 ' + percent + '%</span> <span style="font-size:12px;font-weight:normal;color:var(--text-3)">红底删除线为缺失，绿底为新增</span></div>' +
          
          '<div class="diff-panel" id="diffPanel_' + index + '">' +
            '<div class="diff-col" data-diff-index="' + index + '" data-item-id="' + p.item1.id + '">' +
              '<div class="diff-actions"><button class="btn tiny" data-inline-edit>编辑</button><button class="btn tiny danger" data-del-dup="' + p.item1.id + '">删除</button></div>' +
              '<div class="diff-badge">版本 A</div>' +
              '<div class="diff-content">' + diff.html1 + '</div>' +
            '</div>' +
            
            '<div class="diff-col" data-diff-index="' + index + '" data-item-id="' + p.item2.id + '">' +
              '<div class="diff-actions"><button class="btn tiny" data-inline-edit>编辑</button><button class="btn tiny danger" data-del-dup="' + p.item2.id + '">删除</button></div>' +
              '<div class="diff-badge">版本 B</div>' +
              '<div class="diff-content">' + diff.html2 + '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('') + (truncated ? '<div style="text-align:center;padding:12px;color:var(--text-3);font-size:13px;">仅显示前 ' + MAX_PAIRS + ' 对，清理后可再次检测</div>' : '');
    }
    $('dupMask').classList.add('show');
  }, 50);
}

function openStats() {
  const total = db.items.length;
  const chars = db.items.reduce((s, i) => s + (i.text || '').length, 0);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = Date.now() - 7 * 86400000;
  const today = db.items.filter(i => i.createdAt >= startOfToday).length;
  const week = db.items.filter(i => i.createdAt >= weekAgo).length;
  const dims = db.settings.statsDims || {};
  const limit = Math.max(3, Math.min(30, Number(db.settings.statsLimit) || 8));
  const catCounts = {}, srcCounts = {}, imgCatCounts = {};
  db.items.forEach(i => {
    catCounts[i.type] = (catCounts[i.type] || 0) + 1;
    if (i.source) srcCounts[i.source] = (srcCounts[i.source] || 0) + 1;
    (i.images || []).forEach(im => { const c = (im.cat || '其他'); imgCatCounts[c] = (imgCatCounts[c] || 0) + 1; });
  });
  const tagCounts = collectTags();
  function barSection(title, counts) {
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
    if (!entries.length) return '';
    const max = Math.max(...entries.map(e => e[1]));
    return '<div class="stat-section"><h4>' + title + '</h4>' + entries.map(([name, n]) => '<div class="stat-row"><span class="stat-name" title="' + esc(name) + '">' + esc(name) + '</span><span class="stat-track"><span class="stat-fill" style="width:' + Math.round(n / max * 100) + '%"></span></span><span class="stat-val">' + n + '</span></div>').join('') + '</div>';
  }
  let sections = '';
  if (dims.cat !== false) sections += barSection('分类分布', catCounts);
  if (dims.source !== false) sections += barSection('来源分布', srcCounts);
  if (dims.tag !== false) sections += barSection('标签分布', tagCounts);
  if (Object.keys(imgCatCounts).length) sections += barSection('图片分类分布', imgCatCounts);
  $('statsContent').innerHTML = '<div class="stat-grid"><div class="stat-box"><div class="sb-num">' + total + '</div><div class="sb-label">素材总数</div></div><div class="stat-box"><div class="sb-num">' + chars + '</div><div class="sb-label">总字数</div></div><div class="stat-box"><div class="sb-num">' + today + '</div><div class="sb-label">今日新增</div></div><div class="stat-box"><div class="sb-num">' + week + '</div><div class="sb-label">近 7 天新增</div></div></div>' + sections + (!total ? '<div style="text-align:center;padding:20px;color:var(--text-3);font-size:14px;">还没有素材</div>' : '');
  $('statsMask').classList.add('show');
}

function openHealth() {
  const textItems = db.items.filter(i => i.text);
  const noSource = textItems.filter(i => !i.source);
  const noTag = textItems.filter(i => !i.tags || !i.tags.length);
  const longText = textItems.filter(i => i.text.length > 500);
  const uncat = textItems.filter(i => i.type === UNCAT);
  const textMap = {};
  textItems.forEach(i => { const k = i.text.trim(); (textMap[k] = textMap[k] || []).push(i); });
  const exactDups = Object.values(textMap).filter(g => g.length > 1);
  $('healthTotal').textContent = db.items.length;
  function section(title, arr) {
    if (!arr.length) return '<div class="health-section"><div class="health-title">' + title + '<span class="health-badge ok">正常</span></div></div>';
    const preview = arr.slice(0, 20);
    return '<div class="health-section"><div class="health-title">' + title + '<span class="health-badge">' + arr.length + '</span></div>' + preview.map(i => '<div class="health-item" data-edit="' + i.id + '"><span class="hi-text">' + esc(i.text.slice(0, 60)) + (i.text.length > 60 ? '…' : '') + '</span><span class="hi-meta">' + esc(i.type) + (i.source ? ' · ' + esc(i.source) : '') + '</span></div>').join('') + (arr.length > 20 ? '<div style="font-size:12px;color:var(--text-3);padding:4px 2px;">还有 ' + (arr.length - 20) + ' 条未显示…</div>' : '') + '</div>';
  }
  let dupSection = '';
  if (exactDups.length) {
    dupSection = '<div class="health-section"><div class="health-title">完全重复<span class="health-badge">' + exactDups.length + ' 组</span></div>' + exactDups.slice(0, 10).map(g => '<div class="health-item" data-edit="' + g[1].id + '"><span class="hi-text">' + esc(g[0].text.slice(0, 50)) + (g[0].text.length > 50 ? '…' : '') + '</span><span class="hi-meta">共 ' + g.length + ' 条</span></div>').join('') + '</div>';
  } else {
    dupSection = '<div class="health-section"><div class="health-title">完全重复<span class="health-badge ok">正常</span></div></div>';
  }
  $('healthList').innerHTML = section('无来源', noSource) + section('无标签', noTag) + section('未分类', uncat) + section('超长（>500 字）', longText) + dupSection;
  $('healthMask').classList.add('show');
}