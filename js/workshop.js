/* ============================================================
   workshop.js —— 皮影工坊
   · 部件化拼装：头茬 / 身段 / 兵器 / 敷彩
   · 实时预览 + 随机组合 + 保存（localStorage）
   · 专属皮影可导入「自由操影」舞台
   ============================================================ */
window.Workshop = (() => {
  const Parts = window.Parts;
  const Puppet = window.Puppet;
  const LS_KEY = 'zjd_puppets';

  const sel = { head: 'wukong', body: 'wukong', weapon: 'jingubang', palette: 'wukong', name: '' };
  let previewP = null, raf = 0, previewCanvas = null;

  /* ---------- 部件缩略图 ---------- */
  function drawPartThumb(canvas, part, palette) {
    const g = canvas.getContext('2d');
    const cw = canvas.width, ch = canvas.height;
    g.clearRect(0, 0, cw, ch);
    const fit = Math.min((cw - 14) / part.w, (ch - 10) / part.h);
    g.save();
    g.translate(cw / 2, ch - 6);
    g.scale(fit, fit);
    g.translate(-part.pivot[0], -part.pivot[1]);
    Puppet.drawPart(g, part, palette, { tintAlpha: 0.8 });
    g.restore();
  }

  function mkThumbCanvas(partKey, kind, palette) {
    const c = document.createElement('canvas');
    c.width = 120; c.height = 100;
    const part = Parts[kind][partKey];
    drawPartThumb(c, part, Parts.palettes[palette] || null);
    return c;
  }

  /* ---------- 选择状态 ---------- */
  function currentSpec() {
    return { name: sel.name || '未命名皮影', head: sel.head, body: sel.body, weapon: sel.weapon, palette: sel.palette };
  }
  function setSel(kind, key) {
    sel[kind] = key;
    const id = kind === 'palette' ? 'ws-palettes' : `ws-${kind}s`;
    const cls = kind === 'palette' ? '.ws-pal' : '.ws-part';
    document.querySelectorAll(`#${id} ${cls}`).forEach(e => e.classList.toggle('sel', e.dataset.key === key));
    rebuildPreview();
  }

  /* ---------- 预览 ---------- */
  function rebuildPreview() {
    if (previewP) previewP = null;
    previewP = Puppet.create(currentSpec(), {});
    previewP.targetX = 1e9;              /* 持续行走演示 */
  }
  function previewLoop(t) {
    if (!previewP) return;
    previewP.facing = 1;
    Puppet.update(previewP, 1 / 60, t / 1000);
    Puppet.renderToFit(previewCanvas, previewP);
    raf = requestAnimationFrame(previewLoop);
  }

  /* ---------- 我的皮影 ---------- */
  function loadMine() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; } }
  function saveMine(list) { localStorage.setItem(LS_KEY, JSON.stringify(list)); }

  function renderMine() {
    const box = document.getElementById('ws-mine-list');
    box.innerHTML = '';
    const mine = loadMine();
    if (!mine.length) {
      box.innerHTML = '<p style="font-size:13px;color:#8a6a3a">还没有收藏的皮影，拼一个吧！</p>';
      return;
    }
    mine.forEach((m, i) => {
      const item = document.createElement('div');
      item.className = 'ws-mine-item';
      const thumb = document.createElement('canvas');
      thumb.width = 92; thumb.height = 92;
      Puppet.renderStatic(thumb, m, 'idle');
      const name = document.createElement('span');
      name.className = 'mname';
      name.textContent = m.name;
      const go = document.createElement('button');
      go.className = 'btn-mini';
      go.textContent = '上舞台';
      go.onclick = () => { window.App.setStagePuppet(m); location.hash = '#/stage'; };
      const del = document.createElement('button');
      del.className = 'btn-mini';
      del.textContent = '删';
      del.onclick = () => { saveMine(mine.filter((_, j) => j !== i)); renderMine(); };
      item.append(thumb, name, go, del);
      box.appendChild(item);
    });
  }

  /* ---------- 随机 ---------- */
  const RANDOM_NAMES = ['齐天小圣', '灯影侠', '云中仙', '夜游神', '小皮匠', '月下客', '耍影人', '玲珑影', '戏中人', '灯下虎'];
  function randomize() {
    const heads = Object.keys(Parts.heads);
    const bodies = Object.keys(Parts.bodies);
    const weapons = Object.keys(Parts.weapons);
    const pals = Object.keys(Parts.palettes);
    sel.head = heads[Math.floor(Math.random() * heads.length)];
    sel.body = bodies[Math.floor(Math.random() * bodies.length)];
    sel.weapon = weapons[Math.floor(Math.random() * weapons.length)];
    sel.palette = pals[Math.floor(Math.random() * pals.length)];
    sel.name = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    document.getElementById('ws-name').value = sel.name;
    syncSelUI();
    rebuildPreview();
  }

  function syncSelUI() {
    document.querySelectorAll('#ws-heads .ws-part').forEach(e => e.classList.toggle('sel', e.dataset.key === sel.head));
    document.querySelectorAll('#ws-bodies .ws-part').forEach(e => e.classList.toggle('sel', e.dataset.key === sel.body));
    document.querySelectorAll('#ws-weapons .ws-part').forEach(e => e.classList.toggle('sel', e.dataset.key === sel.weapon));
    document.querySelectorAll('#ws-palettes .ws-pal').forEach(e => e.classList.toggle('sel', e.dataset.key === sel.palette));
  }

  /* ---------- 初始化 ---------- */
  function init() {
    previewCanvas = document.getElementById('cv-ws-preview');
    previewCanvas.width = 400; previewCanvas.height = 340;

    const mkGrid = (boxId, kind, selKind, keys) => {
      const box = document.getElementById(boxId);
      box.innerHTML = '';
      for (const key of keys) {
        const part = Parts[kind][key];
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'ws-part';
        el.dataset.key = key;
        el.setAttribute('aria-label', '选择' + (part.name || key));
        const c = mkThumbCanvas(key, kind, sel.palette);
        const p = document.createElement('p');
        p.textContent = part.name || key;
        el.append(c, p);
        el.onclick = () => setSel(selKind, key);
        box.appendChild(el);
      }
    };
    mkGrid('ws-heads', 'heads', 'head', Object.keys(Parts.heads));
    mkGrid('ws-bodies', 'bodies', 'body', Object.keys(Parts.bodies));
    mkGrid('ws-weapons', 'weapons', 'weapon', Object.keys(Parts.weapons));

    /* 经典角色 · 一键整装（剧目/操影中的预设角色）
       防御：旧缓存页面缺容器时静默跳过本组 */
    const classicBox = document.getElementById('ws-classic');
    if (classicBox) {
      classicBox.innerHTML = '';
      for (const key of Object.keys(Parts.characters)) {
        const spec = Parts.characters[key];
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'ws-part';
        el.dataset.key = key;
        el.setAttribute('aria-label', '一键整装' + spec.name);
        const c = document.createElement('canvas');
        c.width = 120; c.height = 100;
        Puppet.renderStatic(c, spec, 'idle');
        const p = document.createElement('p');
        p.textContent = spec.name;
        el.append(c, p);
        el.onclick = () => {
          sel.head = spec.head; sel.body = spec.body; sel.weapon = spec.weapon; sel.palette = spec.palette;
          sel.name = spec.name;
          document.getElementById('ws-name').value = sel.name;
          syncSelUI();
          rebuildPreview();
        };
        classicBox.appendChild(el);
      }
    }

    /* 敷彩 */
    const palBox = document.getElementById('ws-palettes');
    palBox.innerHTML = '';
    for (const key of Object.keys(Parts.palettes)) {
      const pal = Parts.palettes[key];
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'ws-pal';
      el.dataset.key = key;
      el.setAttribute('aria-label', '选择敷彩' + pal.name);
      const sw = document.createElement('div');
      sw.className = 'sw';
      for (const c of [pal.t1, pal.t2, pal.t3]) {
        const i = document.createElement('i');
        i.style.background = c;
        sw.appendChild(i);
      }
      const p = document.createElement('p');
      p.textContent = pal.name;
      el.append(sw, p);
      el.onclick = () => setSel('palette', key);
      palBox.appendChild(el);
    }

    document.getElementById('ws-name').addEventListener('input', e => { sel.name = e.target.value.trim(); });
    document.getElementById('ws-random').onclick = randomize;
    document.getElementById('ws-save').onclick = () => {
      const spec = currentSpec();
      if (!sel.name.trim()) sel.name = '未命名皮影';
      spec.name = sel.name;
      const mine = loadMine();
      mine.push(spec);
      saveMine(mine);
      renderMine();
      window.App.toast('已保存「' + spec.name + '」到我的皮影');
    };
    document.getElementById('ws-to-stage').onclick = () => {
      window.App.setStagePuppet(currentSpec());
      location.hash = '#/stage';
    };

    syncSelUI();
    rebuildPreview();
    renderMine();
    raf = requestAnimationFrame(previewLoop);
  }

  function setActive(on) {
    if (on && !raf) raf = requestAnimationFrame(previewLoop);
    if (!on && raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  return { init, setActive, currentSpec, setSel };
})();
