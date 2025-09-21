
// Load dataset (no external libs)
const state = {data:null};
const el = sel => document.querySelector(sel);

function bandTag(L, bands){
  if(L==null || !bands) return '未知';
  const {p20,p40,p60,p80} = bands;
  if([p20,p40,p60,p80].some(v=>v==null)) return '参考';
  if(L < p20) return '偏易';
  if(L < p40) return '舒适';
  if(L <= p60) return '舒适';
  if(L <= p80) return '最佳挑战';
  return '偏难';
}
function median(arr){ if(!arr.length) return null; const a=arr.slice().sort((x,y)=>x-y); const m=Math.floor((a.length-1)/2); if(a.length%2) return a[m]; return (a[m]+a[m+1])/2; }

function childText(items, bands, age){
  const lexiles = items.map(it=>it.lexile).filter(v=>v!=null);
  const tags = items.map(it=> bandTag(it.lexile, bands));
  const count = t => tags.filter(x=>x===t).length;
  const easy=count('偏易'), comfy=count('舒适'), best=count('最佳挑战'), hard=count('偏难');
  const young = age<=6, middle = age>=7 && age<=9, older = age>=10;
  const segs=[];
  if(young){
    if(best>=1 && easy>=1) segs.push('我们先读一本轻松的热热身，再去试一试那本有一点挑战的。');
    else if(comfy>=2) segs.push('今天这些书对你来说正合适，你会读得很顺畅。');
    else if(hard>=1) segs.push('今天里面有一段会有点难，没关系，我们可以先听一听、一起读。');
    else segs.push('今天的书搭配刚刚好，准备好一起读啦。');
    segs.push('碰到新词，我们一起看图猜一猜，然后再读一遍，把语音语调读得漂亮。');
  }else if(middle){
    if(best>=1 && easy>=1) segs.push('先用容易的一本做热身，再挑战那本稍微难一点的，你会感觉既顺手又有进步。');
    else if(comfy>=2) segs.push('今天大部分都在你的舒适区，适合练速度和表达。');
    else if(hard>=1) segs.push('读到难段时可以先听一遍或和家长接力读。');
    else segs.push('今天难度分布均衡，按计划读就可以。');
    segs.push('遇到不认识的词先根据上下文猜，再标记查证。');
  }else{
    if(best>=1 && easy>=1) segs.push('先用易文本拉起流利度，再攻坚有挑战的文本，注意分段与重读。');
    else if(comfy>=2) segs.push('今天偏向流畅阅读，适合做复述、抓关键词和观点。');
    else if(hard>=1) segs.push('存在偏难文本：先扫读结构与关键词，再精读要点，必要时结合音频。');
    else segs.push('组合平衡，可按节奏推进。');
    segs.push('读完每篇，试着用自己的话讲讲要点与依据。');
  }
  return segs.join(' ');
}

function parentAdvice(items, bands){
  const idxs = items.map((it,i)=>({i, L:it.lexile, name:(it.systemName||'') + (it.level?` · ${it.level}`:''), tag: bandTag(it.lexile,bands)}));
  const order = idxs.slice().sort((a,b)=>{
    const rank = t => ({'偏易':0,'舒适':1,'最佳挑战':2,'偏难':3,'参考':1,'未知':1}[t] ?? 1);
    return rank(a.tag) - rank(b.tag);
  });
  const orderText = order.map(o=>o.name||`第${o.i+1}本`).join(' → ');
  const desc = [];
  desc.push('建议顺序：从较容易的热身文本开始 → 进入舒适区主读本 → 最后处理略有挑战的文本。');
  if(idxs.some(x=>x.tag==='偏难')) desc.push('如出现“偏难”，采用“先听后读 / 分段共读（PEER） / 关键词扫读后精读”。');
  if(!idxs.some(x=>x.tag==='偏易')) desc.push('组合中缺少易文，可补充一篇用于流利度或重复朗读（也可边听边读）。');
  const prompts = [
    'C（补全）：“这句话如果换一个词，会变成什么？”',
    'R（回忆）：“刚才发生了什么？还有谁在场？”',
    'O（开放）：“你觉得接下来会怎样？为什么？”',
    'W（Wh）：“谁 / 在哪里 / 什么时候 / 为什么？”',
    'D（联系）：“这和你在学校或生活中遇到的事情像吗？”'
  ];
  return {orderText, text: desc.join(' '), prompts};
}

function theoryNotes(){
  return [
    '难度匹配：中位难度在舒适—轻挑战区（P40–P80）更利于理解与成就。',
    '流利度支持：加入一篇易文做热身/复读（有示范更佳），能提升速度与准确。',
    '听读结合：遇到偏难文本时，先听后读或边听边读能降低解码负荷。',
    '体裁平衡：若今天全为叙事类，可加入信息性/说明文，提升结构意识与知识建构。',
    '动机与选择：让孩子对书目有选择权，兴趣驱动能提升投入与理解。'
  ];
}

function buildUI(data){
  // age
  const ageSel = el('#age');
  for(let a=3; a<=15; a++){ const opt=document.createElement('option'); opt.value=a; opt.textContent=a; ageSel.appendChild(opt); }
  ageSel.value=8;

  // rows
  const rows = el('#rows'); rows.innerHTML='';
  const rowVals = [{}, {}, {}];
  function renderRow(i){
    const wrap = document.createElement('div'); wrap.className='row';
    const sys = document.createElement('select');
    const lvl = document.createElement('select');
    const lab1 = document.createElement('label'); lab1.textContent = `选项 ${i+1} · 选择读物`;
    const lab2 = document.createElement('label'); lab2.textContent = `选择该读物的级别`;

    // system options
    sys.innerHTML = '<option value="">（不选）</option>' + data.systems.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
    sys.value = rowVals[i].systemId || '';
    lvl.innerHTML = `<option value="">${sys.value? '（请选择级别）':'（先选择读物）'}</option>`;

    sys.addEventListener('change', ()=>{
      rowVals[i].systemId = sys.value; rowVals[i].level = '';
      lvl.innerHTML = `<option value="">${sys.value? '（请选择级别）':'（先选择读物）'}</option>`;
      const levels = data.levelsBySystem[sys.value] || [];
      for(const L of levels){
        const opt = document.createElement('option');
        opt.value = L.level; opt.textContent = L.level || '(无名级别)';
        lvl.appendChild(opt);
      }
    });
    lvl.addEventListener('change', ()=>{ rowVals[i].level = lvl.value; });

    const d1 = document.createElement('div'); const d2 = document.createElement('div');
    d1.appendChild(lab1); d1.appendChild(sys);
    d2.appendChild(lab2); d2.appendChild(lvl);
    wrap.appendChild(d1); wrap.appendChild(d2);
    rows.appendChild(wrap);
  }
  renderRow(0); renderRow(1); renderRow(2);

  // buttons
  el('#reset').onclick = ()=>{ rows.innerHTML=''; buildUI(data); el('#reportWrap').innerHTML=''; };
  el('#calc').onclick = ()=>{
    // validate
    for(const r of rows.querySelectorAll('.row')){/* noop */}
    const selections = rowVals.filter(v=>v.systemId && v.level);
    if(selections.length===0){ alert('请至少选择 1 本读物并指定级别'); return; }

    // build chosen list
    const age = parseInt(el('#age').value,10); const gender = el('#gender').value;
    const bands = data.ageBands[String(age)];
    const chosen = selections.map(v=>{
      const sys = data.basicBySystem[v.systemId] || {name:v.systemId};
      const lv = (data.levelsBySystem[v.systemId]||[]).find(x=>x.level===v.level) || {};
      return {systemId:v.systemId, systemName:sys.name, level:v.level, lexile:lv.lexile, lexileRaw:lv.lexileRaw, band:lv.band, features:lv.features, textFeatures:sys.textFeatures};
    });
    const lexiles = chosen.map(c=>c.lexile).filter(x=>x!=null);
    const med = lexiles.length? median(lexiles): null;

    function classify(L){
      if(L==null) return {tag:'未知', cls:'', msg:'区间或文本型数值，已取中位估计'};
      const {p20,p40,p60,p80} = bands;
      if([p20,p40,p60,p80].some(v=>v==null)) return {tag:'参考', cls:'', msg:'年龄基线不足，按全局估计'};
      if(L < p20) return {tag:'偏易', cls:'warn', msg:'建议提高级别或增加任务复杂度'};
      if(L < p40) return {tag:'舒适', cls:'ok', msg:'流畅阅读，适合巩固'};
      if(L <= p60) return {tag:'舒适', cls:'ok', msg:'流畅阅读，适合巩固'};
      if(L <= p80) return {tag:'最佳挑战', cls:'ok', msg:'略高于舒适，有助于提升'};
      return {tag:'偏难', cls:'bad', msg:'建议拆分任务或加入听读支持'};
    }
    const overall = med!=null ? classify(med) : {tag:'未知', cls:'', msg:'无可计算的 Lexile'};

    // child + parent texts
    const child = childText(chosen, bands, age);
    const parent = parentAdvice(chosen, bands);

    // render report
    const wrap = el('#reportWrap'); wrap.innerHTML='';
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `
      <h2>阅读体验报告</h2>
      <div class="kv">
        <div>年龄</div><div>${age}</div>
        <div>性别</div><div>${gender==='male'?'男':'女'}</div>
        <div>总体评估</div><div><span class="badge ${overall.cls}">${overall.tag}</span>　${overall.msg}</div>
      </div>

      <h3>给孩子的话</h3>
      <div class="sub">${child}</div>

      <h3>家长视角</h3>
      <div class="sub">${parent.text}</div>
      <div class="sub">建议顺序：${parent.orderText || '（按孩子兴趣调整）'}</div>

      <h3>理论依据（好的当日阅读）</h3>
      <ul>${theoryNotes().map(t=>`<li>${t}</li>`).join('')}</ul>

      <table class="table">
        <thead><tr><th>读物</th><th>级别</th><th>Lexile</th><th>匹配</th><th>提示</th></tr></thead>
        <tbody>
          ${chosen.map(c=>{
            const cls = classify(c.lexile);
            const lex = (c.lexile!=null ? `${c.lexile}L` : (c.lexileRaw||'N/A'));
            const tip = (c.lexile!=null ? cls.msg : (c.lexileRaw ? '区间或文本型数值，已取中位估计' : cls.msg));
            return `<tr><td>${c.systemName}</td><td>${c.level}</td><td>${lex}</td><td><span class="badge ${cls.cls}">${cls.tag}</span></td><td>${tip}</td></tr>`;
          }).join('')}
        </tbody>
      </table>

      <div class="sub" style="margin-top:10px">统计口径：按所选年龄段在数据集中观测到的 Lexile 分布计算分位（P20/P40/P60/P80）；当样本不足时使用全局分布作为回退。</div>
      <hr/>
      <h3>阅读建议</h3>
      <ul>
        ${chosen.map(c=>`<li><strong>${c.systemName} · ${c.level}：</strong>${(c.features||c.textFeatures||'暂无；可根据孩子表现加入复述、找关键词、跟读等任务。')}</li>`).join('')}
      </ul>
    `;
    wrap.appendChild(card);
    window.scrollTo({top: document.body.scrollHeight, behavior:'smooth'});
  };
}

fetch('./data/dataset.json').then(r=>{
  if(!r.ok) throw new Error('未找到 data/dataset.json');
  return r.json();
}).then(data=>{
  state.data = data; buildUI(data);
}).catch(e=>{
  const w = document.createElement('div');
  w.className='container card';
  w.innerHTML = `<h2>数据未加载</h2><div class="sub">${e.message}</div><div class="sub">请确认仓库包含 <code>data/dataset.json</code>。</div>`;
  document.body.appendChild(w);
});
