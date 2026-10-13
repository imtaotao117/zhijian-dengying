/* ============================================================
   关节工坊：自由摆弄 · 亮相挑战 · 定格动画
   零引擎改动——直接读写 Puppet.create() 返回对象的 p.ang 十角度
   （弧度，0=自然下垂，+ 向身前；F=前侧 B=后侧；el/kn 为父级相对角）。
   骨骼常量与姿态公式复刻自 puppet.js（引擎未导出，此处按同公式取样）。
   ============================================================ */
window.JointStudio = (() => {
  /* ---------- 常量（复刻 puppet.js 骨骼常量） ---------- */
  const J = { neck: [0, -112], shF: [9, -100], shB: [-7, -98], hiF: [3, -8], hiB: [-3, -8] };
  const SEG = { upper: 56, fore: 52, thigh: 62, shin: 56 };
  const RANGE = { torso: [-0.85, 0.85], head: [-0.25, 0.25], sh: [-2.9, 0.7], el: [-2.1, 0.4], hi: [-1.5, 1.5], kn: [-2.95, 2.95] };
  const IDLE = { torso: 0.02, head: 0, shB: -0.5, elB: -0.35, shF: 0.22, elF: -0.25, hiF: -0.1, knF: 0.12, hiB: 0.1, knB: 0.12 };
  const ANG_KEYS = ['torso', 'head', 'shF', 'elF', 'shB', 'elB', 'hiF', 'knF', 'hiB', 'knB'];

  /* 内置造型（亮相/端坐为引擎姿态表；拜礼/持械为本模块原创） */
  const PRESETS = {
    亮相: { torso: -0.05, head: -0.07, shF: -2.55, elF: -0.35, shB: 0.55, elB: -0.65, hiF: -1.05, knF: -1.4, hiB: 0.16, knB: 0.1 },
    端坐: { torso: 0.14, head: 0.02, shF: 0.55, elF: -2.1, shB: -0.45, elB: -0.5, hiF: 1.5, knF: -2.95, hiB: -1.5, knB: 2.95 },
    拜礼: { torso: 0.35, head: 0.2, shF: 0.5, elF: -1.8, shB: 0.45, elB: -1.7, hiF: -0.1, knF: 0.12, hiB: 0.1, knB: 0.12 },
    持械: { torso: -0.06, head: -0.07, shF: -0.6, elF: -0.9, shB: 0.4, elB: -0.6, hiF: -0.1, knF: 0.12, hiB: 0.1, knB: 0.12 },
  };

  /* 亮相挑战 6 关（ghost: true=常显, 3=三秒后隐藏） */
  const LEVELS = [
    { name: '金鸡独立', time: 45, ghost: true, target: { torso: -0.06, head: 0.05, shF: -2.30, elF: -0.45, shB: 0.30, elB: -0.50, hiF: -1.15, knF: -1.45, hiB: 0.12, knB: 0.10 } },
    { name: '白鹤亮翅', time: 45, ghost: true, target: { torso: 0.00, head: 0.06, shF: -2.50, elF: -0.35, shB: -2.20, elB: -0.55, hiF: -0.75, knF: -1.20, hiB: 0.15, knB: 0.10 } },
    { name: '举火烧天', time: 45, ghost: true, target: { torso: 0.18, head: -0.10, shF: -1.75, elF: 0.05, shB: 0.70, elB: -0.85, hiF: 0.70, knF: 0.10, hiB: -0.75, knB: 0.25 } },
    { name: '二郎担山', time: 60, ghost: 3, target: { torso: 0.05, head: 0.00, shF: 0.35, elF: -1.60, shB: -0.55, elB: -1.35, hiF: 1.25, knF: -1.10, hiB: -1.20, knB: -1.15 } },
    { name: '海底捞月', time: 60, ghost: 3, target: { torso: 0.50, head: 0.12, shF: -0.45, elF: -1.70, shB: -1.85, elB: -0.50, hiF: -0.30, knF: 0.25, hiB: -1.15, knB: 0.40 } },
    { name: '童子拜观音', time: 60, ghost: 3, target: { torso: 0.18, head: -0.15, shF: -0.55, elF: -1.95, shB: -0.65, elB: -1.85, hiF: 1.35, knF: -2.60, hiB: 1.25, knB: -2.45 } },
  ];
  const LS_POSES = 'zjd_poses', LS_ANIMS = 'zjd_anims', LS_STARS = 'zjd_joints_stars';

  /* ---------- 状态 ---------- */
  let canvas, ctx, box, handleLayer, hud, active = false, inited = false;
  let dpr = 1, cw = 0, ch = 0;
  let p = null, ghostP = null, charKey = 'wukong';
  let mode = 'free';                 /* free | challenge | motion */
  let levelIdx = -1, levelLeft = 0, levelStart = 0, levelGhostUntil = 0, levelLocked = false;
  let simPct = 0;
  let selected = null, gestureOn = false;
  let frames = [];
  let playing = false, playT = 0, playSpeed = 1, loopOn = true, rafId = 0, lastTs = 0, lastFrameIdx = -1;
  let stars = [0, 0, 0, 0, 0, 0];

  /* ---------- 小工具 ---------- */
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const $ = id => document.getElementById(id);
  const loadLS = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const saveLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } };
  const toast = msg => window.App && window.App.toast(msg);

  /* ---------- 数学：正运动学（复刻 puppet.js） ---------- */
  function jointPositions() {
    const a = p.ang, t = a.torso, ct = Math.cos(t), st = Math.sin(t);
    const rot = ([lx, ly]) => [lx * ct - ly * st, lx * st + ly * ct];
    const neck = rot(J.neck);
    const chest = rot([0, -55]);
    const shF = rot(J.shF), shB = rot(J.shB);
    const hiF = rot(J.hiF), hiB = rot(J.hiB);
    const limb = (jx, jy, a1, a2, l1, l2) => {
      const a1w = t + a1, a2w = t + a1 + a2;
      const ex = jx + Math.sin(a1w) * l1, ey = jy + Math.cos(a1w) * l1;
      return [ex, ey, ex + Math.sin(a2w) * l2, ey + Math.cos(a2w) * l2];
    };
    const [elFx, elFy, wrFx, wrFy] = limb(shF[0], shF[1], a.shF, a.elF, SEG.upper, SEG.fore);
    const [elBx, elBy, wrBx, wrBy] = limb(shB[0], shB[1], a.shB, a.elB, SEG.upper, SEG.fore);
    const [knFx, knFy, anFx, anFy] = limb(hiF[0], hiF[1], a.hiF, a.knF, SEG.thigh, SEG.shin);
    const [knBx, knBy, anBx, anBy] = limb(hiB[0], hiB[1], a.hiB, a.knB, SEG.thigh, SEG.shin);
    /* 头手柄放在头茬中心：颈点沿头部朝上方向偏移 55 */
    const ha = t + a.head;
    const headC = [neck[0] - Math.sin(ha) * 55, neck[1] - Math.cos(ha) * 55];
    return { head: headC, neck, chest, shF, elF: [elFx, elFy], wrF: [wrFx, wrFy], shB, elB: [elBx, elBy], wrB: [wrBx, wrBy], hiF, knF: [knFx, knFy], anF: [anFx, anFy], hiB, knB: [knBx, knBy], anB: [anBx, anBy] };
  }

  /* 屏幕映射：sx = p.x + lx*facing*S, sy = p.y + (ly-110)*S（(OFF_CY-OFF_FEET)/S0 = -110） */
  const toScreen = (lx, ly) => [p.x + lx * p.facing * p.scale, p.y + (ly - 110) * p.scale];
  const toLocal = (sx, sy) => [(sx - p.x) / (p.facing * p.scale), (sy - p.y) / p.scale + 110];

  /* 两骨 IK：两个分支都解出，按「自然弯折」规则挑一个。
     臂：优先肘后折（相对角 a2<0，引擎所有姿态均如此）；
     腿：优先膝前折（a2>0，站立类姿态均如此）；
     若都不满足（如目标在身后极限位），退化为取离自然下垂最近的分支。 */
  function solve2Bone(jx, jy, tx, ty, L1, L2, prefer, rngA, rngB) {
    let dx = tx - jx, dy = ty - jy;
    let d = Math.hypot(dx, dy);
    const dmin = Math.abs(L1 - L2) + 0.01, dmax = L1 + L2 - 0.5;
    if (d > dmax) { const k = dmax / d; dx *= k; dy *= k; d = dmax; }
    else if (d < dmin) { const k = dmin / Math.max(d, 1e-6); dx *= k; dy *= k; d = dmin; }
    const base = Math.atan2(dx, dy);
    const g = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const cand = [base + g, base - g];
    /* 评分：以钳制后的实际端点残差为主（目标不可达时尽量贴近），
       符号偏好仅作平局决胜（臂：肘后折 a2≤0；腿：膝前折 a2≥0）。 */
    let best = null, bestScore = Infinity;
    for (const a1w of cand) {
      const a1c = clamp(wrap(a1w - p.ang.torso), rngA[0], rngA[1]);
      const a1wc = p.ang.torso + a1c;
      const ex = jx + Math.sin(a1wc) * L1, ey = jy + Math.cos(a1wc) * L1;
      const a2 = clamp(wrap(Math.atan2(tx - ex, ty - ey) - a1wc), rngB[0], rngB[1]);
      const a2wc = a1wc + a2;
      const resid = Math.hypot(tx - (ex + Math.sin(a2wc) * L2), ty - (ey + Math.cos(a2wc) * L2));
      const signOK = prefer < 0 ? a2 <= 0 : a2 >= 0;
      const score = resid + (signOK ? 0 : 0.5);
      if (score < bestScore) { bestScore = score; best = [a1c, a2]; }
    }
    return best;
  }

  /* 手柄拖拽/隔空操骨统一入口：把指针（屏幕 px，相对舞台盒）应用到指定关节 */
  function applyPointTo(id, sx, sy) {
    const a = p.ang;
    const [lx, ly] = toLocal(sx, sy);
    const jp = jointPositions();
    if (id === 'chest') {
      /* 躯干倾角按拖拽增量驱动（增量在本地坐标，自动随镜像翻转）；首帧只记基线 */
      if (!dragLast) { dragLast = [lx, ly]; return; }
      const [plx, ply] = dragLast;
      a.torso = clamp(a.torso + (lx - plx) * 0.006 + (ly - ply) * 0.0012, RANGE.torso[0], RANGE.torso[1]);
      dragLast = [lx, ly];
      return;
    }
    const rel = (bx, by) => wrap(Math.atan2(lx - bx, ly - by) - a.torso);
    if (id === 'head') a.head = clamp(wrap(Math.atan2(-(lx - jp.neck[0]), -(ly - jp.neck[1])) - a.torso), RANGE.head[0], RANGE.head[1]);
    else if (id === 'shF') a.shF = clamp(rel(...jp.shF), RANGE.sh[0], RANGE.sh[1]);
    else if (id === 'shB') a.shB = clamp(rel(...jp.shB), RANGE.sh[0], RANGE.sh[1]);
    else if (id === 'elF') a.elF = clamp(wrap(Math.atan2(lx - jp.elF[0], ly - jp.elF[1]) - (a.torso + a.shF)), RANGE.el[0], RANGE.el[1]);
    else if (id === 'elB') a.elB = clamp(wrap(Math.atan2(lx - jp.elB[0], ly - jp.elB[1]) - (a.torso + a.shB)), RANGE.el[0], RANGE.el[1]);
    else if (id === 'wrF') { const r = solve2Bone(jp.shF[0], jp.shF[1], lx, ly, SEG.upper, SEG.fore, -1, RANGE.sh, RANGE.el); a.shF = r[0]; a.elF = r[1]; }
    else if (id === 'wrB') { const r = solve2Bone(jp.shB[0], jp.shB[1], lx, ly, SEG.upper, SEG.fore, -1, RANGE.sh, RANGE.el); a.shB = r[0]; a.elB = r[1]; }
    else if (id === 'hiF') a.hiF = clamp(rel(...jp.hiF), RANGE.hi[0], RANGE.hi[1]);
    else if (id === 'hiB') a.hiB = clamp(rel(...jp.hiB), RANGE.hi[0], RANGE.hi[1]);
    else if (id === 'knF') a.knF = clamp(wrap(Math.atan2(lx - jp.knF[0], ly - jp.knF[1]) - (a.torso + a.hiF)), RANGE.kn[0], RANGE.kn[1]);
    else if (id === 'knB') a.knB = clamp(wrap(Math.atan2(lx - jp.knB[0], ly - jp.knB[1]) - (a.torso + a.hiB)), RANGE.kn[0], RANGE.kn[1]);
    else if (id === 'anF') { const r = solve2Bone(jp.hiF[0], jp.hiF[1], lx, ly, SEG.thigh, SEG.shin, +1, RANGE.hi, RANGE.kn); a.hiF = r[0]; a.knF = r[1]; }
    else if (id === 'anB') { const r = solve2Bone(jp.hiB[0], jp.hiB[1], lx, ly, SEG.thigh, SEG.shin, +1, RANGE.hi, RANGE.kn); a.hiB = r[0]; a.knB = r[1]; }
  }
  let dragLast = [0, 0];

  /* ---------- 渲染 ---------- */
  function resize() {
    if (!canvas) return;
    const r = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = Math.max(280, r.width); ch = Math.max(320, r.height);
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    if (p) { p.x = cw * 0.5; p.y = p.ground = ch * 0.82; p.scale = clamp(0.75 * ch / 340, 0.9, 1.35); }
    renderNow();
    updateHandles();
  }

  function renderNow() {
    if (!ctx || !p) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    if (ghostP) {
      ghostP.x = p.x; ghostP.y = p.y; ghostP.ground = p.ground; ghostP.scale = p.scale; ghostP.facing = p.facing;
      ctx.save();
      ctx.globalAlpha = 0.28;
      Puppet.render(ctx, ghostP);
      ctx.restore();
    }
    Puppet.render(ctx, p);
  }

  function updateHandles() {
    if (!handleLayer || !p) return;
    const jp = jointPositions();
    for (const el of handleLayer.children) {
      const j = jp[el.dataset.j];
      if (!j) continue;
      const [sx, sy] = toScreen(j[0], j[1]);
      el.style.left = (sx - 11) + 'px';
      el.style.top = (sy - 11) + 'px';
    }
  }

  /* ---------- 皮影与手柄 ---------- */
  const HANDLES = [
    ['head', '头'], ['chest', '身'], ['shF', '肩'], ['elF', '肘'], ['wrF', '腕'],
    ['shB', '肩'], ['elB', '肘'], ['wrB', '腕'], ['hiF', '胯'], ['knF', '膝'],
    ['anF', '足'], ['hiB', '胯'], ['knB', '膝'], ['anB', '足'],
  ];

  function buildHandles() {
    handleLayer.innerHTML = '';
    for (const [id, label] of HANDLES) {
      const el = document.createElement('div');
      el.className = 'joint-handle';
      el.dataset.j = id;
      el.title = label;
      el.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (!active) return;
        if (playing) stopPlayback();
        selected = id;
        el.setPointerCapture(e.pointerId);
        el.classList.add('dragging');
        dragLast = id === 'chest' ? null : [0, 0];
        if (id !== 'chest') applyPointTo(id, e.clientX - box.getBoundingClientRect().left, e.clientY - box.getBoundingClientRect().top);
        updateHandleSel();
        changed();
      });
      el.addEventListener('pointermove', (e) => {
        e.stopPropagation();
        if (!active || selected !== id) return;
        applyPointTo(id, e.clientX - box.getBoundingClientRect().left, e.clientY - box.getBoundingClientRect().top);
        changed();
      });
      const end = (e) => {
        e.stopPropagation();
        el.classList.remove('dragging');
        if (selected === id) selected = null;
        updateHandleSel();
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      handleLayer.appendChild(el);
    }
  }

  function updateHandleSel() {
    for (const el of handleLayer.children) el.classList.toggle('sel', el.dataset.j === selected);
  }

  /* 角度或播放状态变化后的统一收尾：重绘 + 手柄 + HUD + 挑战相似度 */
  function changed() {
    renderNow();
    updateHandles();
    if (mode === 'challenge' && levelIdx >= 0 && !levelLocked) updateSim();
    else if (mode === 'challenge') hudChallenge();
  }

  /* ---------- 角色 ---------- */
  function buildCharGrid() {
    const grid = $('jt-chars');
    grid.innerHTML = '';
    for (const key of Object.keys(Parts.characters)) {
      const spec = Parts.characters[key];
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'jt-char';
      item.setAttribute('aria-label', '选择角色' + spec.name);
      const cv = document.createElement('canvas');
      cv.width = 120; cv.height = 100;
      try { Puppet.renderStatic(cv, spec, 'pose'); } catch { }
      const name = document.createElement('span');
      name.textContent = spec.name;
      item.appendChild(cv);
      item.appendChild(name);
      item.onclick = () => setCharacter(key, item);
      grid.appendChild(item);
    }
  }

  function setCharacter(key, cardEl) {
    if (playing) stopPlayback();
    cancelLevel();
    charKey = key;
    const spec = Parts.characters[key];
    p = Puppet.create(spec, {});
    p.ang = { ...IDLE };
    p.x = cw * 0.5; p.y = p.ground = ch * 0.82; p.scale = clamp(0.75 * ch / 340, 0.9, 1.35);
    p.weaponExtra = 0;
    frames = [];
    renderTimeline();
    renderAnimList();
    for (const el of $('jt-chars').children) el.classList.remove('sel');
    if (cardEl) cardEl.classList.add('sel');
    changed();
  }

  /* ---------- 模式切换 ---------- */
  function setMode(m) {
    if (m === mode) return;
    if (playing) stopPlayback();
    cancelLevel();
    mode = m;
    $('jt-tab-free').classList.toggle('sel', m === 'free');
    $('jt-tab-ch').classList.toggle('sel', m === 'challenge');
    $('jt-tab-mo').classList.toggle('sel', m === 'motion');
    $('jt-panel-free').classList.toggle('hidden', m !== 'free');
    $('jt-panel-ch').classList.toggle('hidden', m !== 'challenge');
    $('jt-panel-mo').classList.toggle('hidden', m !== 'motion');
    if (m === 'challenge') renderLevels();
    hudRefresh();
    changed();
  }

  /* ---------- 模式 A：自由摆弄 ---------- */
  function resetAngles() { p.ang = { ...IDLE }; p.weaponExtra = 0; changed(); }
  function randomAngles() {
    const rnd = (k) => RANGE[k][0] + Math.random() * (RANGE[k][1] - RANGE[k][0]);
    p.ang = { torso: rnd('torso'), head: rnd('head'), shF: rnd('sh'), elF: rnd('el'), shB: rnd('sh'), elB: rnd('el'), hiF: rnd('hi'), knF: rnd('kn'), hiB: rnd('hi'), knB: rnd('kn') };
    p.weaponExtra = Math.random() * 6 - 3;
    AudioFx.woodblock(0.25);
    changed();
  }
  function mirrorPuppet() { p.facing *= -1; if (ghostP) ghostP.facing = p.facing; changed(); }
  function applyAngles(a) { for (const k in a) if (k in p.ang) p.ang[k] = a[k]; changed(); }

  function savePose() {
    const list = loadLS(LS_POSES) || [];
    if (list.length >= 8) { toast('造型库已满（8 个）'); return; }
    list.push({ name: `造型·${p.spec.name}·${list.length + 1}`, char: charKey, angles: { ...p.ang }, weaponExtra: p.weaponExtra });
    saveLS(LS_POSES, list);
    renderPoseList();
    AudioFx.woodblock();
    toast('已保存造型');
  }

  function renderPoseList() {
    const wrapEl = $('jt-pose-list');
    wrapEl.innerHTML = '';
    const list = loadLS(LS_POSES) || [];
    for (let i = 0; i < list.length; i++) {
      const item = document.createElement('div');
      item.className = 'jt-row';
      const nm = document.createElement('span');
      nm.textContent = `${list[i].name}（${Parts.characters[list[i].char] ? Parts.characters[list[i].char].name : list[i].char}）`;
      const loadBtn = document.createElement('button');
      loadBtn.className = 'btn btn-mini';
      loadBtn.textContent = '载入';
      loadBtn.onclick = () => {
        setCharacter(list[i].char);
        applyAngles(list[i].angles);
        p.weaponExtra = list[i].weaponExtra || 0;
        changed();
      };
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-mini';
      delBtn.textContent = '删';
      delBtn.onclick = () => {
        list.splice(i, 1);
        saveLS(LS_POSES, list);
        renderPoseList();
      };
      item.appendChild(nm);
      item.appendChild(loadBtn);
      item.appendChild(delBtn);
      wrapEl.appendChild(item);
    }
    if (!list.length) wrapEl.innerHTML = '<p class="jt-dim">还没有保存的造型</p>';
  }

  function exportPng() {
    const cv = document.createElement('canvas');
    cv.width = 760; cv.height = 1360;
    Puppet.renderToFit(cv, p);
    const a = document.createElement('a');
    a.download = `灯影造型-${p.spec.name}.png`;
    a.href = cv.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
    a.remove();
    AudioFx.smallGong();
    toast('已导出造型图');
    return a.href;
  }

  function buildPresets() {
    const wrapEl = $('jt-presets');
    wrapEl.innerHTML = '';
    for (const name of Object.keys(PRESETS)) {
      const b = document.createElement('button');
      b.className = 'btn btn-mini';
      b.textContent = name;
      b.onclick = () => { applyAngles(PRESETS[name]); AudioFx.woodblock(); };
      wrapEl.appendChild(b);
    }
  }

  /* ---------- 模式 B：亮相挑战 ---------- */
  function isUnlocked(i) { return i === 0 || stars[i - 1] >= 1; }

  function renderLevels() {
    const wrapEl = $('jt-levels');
    wrapEl.innerHTML = '';
    for (let i = 0; i < LEVELS.length; i++) {
      const lv = LEVELS[i];
      const row = document.createElement('div');
      row.className = 'jt-level' + (isUnlocked(i) ? '' : ' locked');
      row.tabIndex = isUnlocked(i) ? 0 : -1;
      row.setAttribute('role', 'button');
      row.setAttribute('aria-disabled', String(!isUnlocked(i)));
      row.setAttribute('aria-label', `第${i + 1}关 ${lv.name}，${stars[i]}星`);
      const nm = document.createElement('span');
      nm.textContent = `${i + 1} · ${lv.name}`;
      const st = document.createElement('span');
      st.className = 'jt-stars';
      st.textContent = '★'.repeat(stars[i]) + '☆'.repeat(Math.max(0, 3 - stars[i]));
      row.appendChild(nm);
      row.appendChild(st);
      if (stars[i] > 0) {
        /* 本关有星级时提供重置按钮：两击确认防误触 */
        const rb = document.createElement('button');
        rb.className = 'btn btn-mini jt-reset-star';
        rb.textContent = '↺';
        rb.title = '重置本关星级';
        let arm = null;
        rb.onclick = (e) => {
          e.stopPropagation();
          if (!arm) {
            rb.textContent = '确认?';
            rb.classList.add('on');
            arm = setTimeout(() => { rb.textContent = '↺'; rb.classList.remove('on'); arm = null; }, 2500);
          } else {
            clearTimeout(arm);
            stars[i] = 0;
            saveLS(LS_STARS, stars);
            renderLevels();
            toast(`已重置「${lv.name}」星级`);
          }
        };
        row.appendChild(rb);
      }
      row.onclick = () => { if (isUnlocked(i)) startLevel(i); };
      row.onkeydown = e => {
        if ((e.key === 'Enter' || e.key === ' ') && isUnlocked(i)) { e.preventDefault(); startLevel(i); }
      };
      wrapEl.appendChild(row);
    }
    const badge = $('jt-badge');
    badge.classList.toggle('hidden', stars.reduce((s, v) => s + v, 0) < 18);
  }

  function startLevel(i) {
    if (playing) stopPlayback();
    levelIdx = i;
    levelLocked = false;
    levelLeft = LEVELS[i].time;
    levelStart = performance.now();
    levelGhostUntil = LEVELS[i].ghost === true ? Infinity : levelStart + LEVELS[i].ghost * 1000;
    /* 每次开赛都摆正站姿，保证重新挑战公平 */
    p.ang = { ...IDLE };
    p.weaponExtra = 0;
    ghostP = Puppet.create(Parts.characters[charKey], {});
    ghostP.ang = { ...LEVELS[i].target };
    ghostP.weaponExtra = 0;
    $('jt-lock').classList.remove('hidden');
    $('jt-retry').classList.add('hidden');
    $('jt-ch-hud').textContent = '';
    AudioFx.pattern('clap');
    updateSim();
    hudRefresh();
    ensureLoop();
    renderNow();
    updateHandles();
  }

  function cancelLevel() {
    if (levelIdx < 0 && !ghostP) return;
    levelIdx = -1;
    ghostP = null;
    levelLocked = false;
    $('jt-lock').classList.add('hidden');
    $('jt-retry').classList.add('hidden');
    renderNow();
    hudRefresh();
  }

  function updateSim() {
    if (levelIdx < 0) return;
    const tgt = LEVELS[levelIdx].target;
    /* 逐关节打分再平均：拖近任一关节分数立刻变化，避免整体相似度长期卡在 0% 不刷新。
       单关节偏差 0.6rad 外记 0 分，0.6 内线性给分；定形门槛 60/75/90 与原公式等价 */
    let sum = 0;
    for (const k of ANG_KEYS) sum += clamp(100 - Math.abs(wrap(p.ang[k] - tgt[k])) * 100 / 0.6, 0, 100);
    simPct = sum / ANG_KEYS.length;
    hudChallenge();
  }

  function lockIn() {
    if (levelIdx < 0 || levelLocked) return;
    levelLocked = true;
    const got = simPct;
    const star = got >= 90 ? 3 : got >= 75 ? 2 : got >= 60 ? 1 : 0;
    if (star > stars[levelIdx]) {
      stars[levelIdx] = star;
      saveLS(LS_STARS, stars);
    }
    if (star > 0) {
      AudioFx.pattern('pose');
      $('jt-ch-hud').innerHTML = `<span class="jt-pass">${LEVELS[levelIdx].name} · 相似 ${got.toFixed(0)}% · ${'★'.repeat(star)}</span>`;
    } else {
      AudioFx.smallGong();
      $('jt-ch-hud').innerHTML = `<span class="jt-fail">相似 ${got.toFixed(0)}%，差一点点，再试试</span>`;
    }
    /* 定形完成：定形按钮换为再挑战 */
    $('jt-lock').classList.add('hidden');
    $('jt-retry').classList.remove('hidden');
    renderLevels();
    hudRefresh();
  }

  function hudChallenge() {
    if (levelIdx < 0 || !levelLocked) {
      const txt = levelIdx < 0 ? '' : `相似 ${simPct.toFixed(1)}%`;
      $('jt-ch-hud').textContent = txt;
    }
  }

  function hudRefresh() {
    if (mode === 'free') hud.innerHTML = '<span class="jt-hud-pill">✋ 拖动手柄摆造型 · 金色圆点均可拖拽</span>';
    else if (mode === 'challenge') hud.innerHTML = levelIdx >= 0 && !levelLocked
      ? `<span class="jt-hud-pill">${LEVELS[levelIdx].name} · 剩 <b id="jt-time">${Math.ceil(levelLeft)}</b> 秒 · 相似 <b id="jt-sim">${simPct.toFixed(1)}%</b></span>`
      : levelIdx >= 0
        ? `<span class="jt-hud-pill">${LEVELS[levelIdx].name} · 已定形</span>`
        : '<span class="jt-hud-pill">选一关开始挑战</span>';
    else hud.innerHTML = playing
      ? '<span class="jt-hud-pill">▶ 播放中 · 拖动任意手柄暂停</span>'
      : '<span class="jt-hud-pill">📋 摆好姿势拍板定格，再点播放</span>';
  }

  /* ---------- 模式 C：定格动画 ---------- */
  const FRAME_DUR = 0.18;

  function captureFrame() {
    if (playing) stopPlayback();
    if (frames.length >= 30) { toast('最多 30 帧'); return; }
    frames.push({ ...p.ang, weaponExtra: p.weaponExtra });
    AudioFx.pattern('clap');
    renderTimeline();
    toast(`第 ${frames.length} 帧已定格`);
  }

  function renderTimeline() {
    const tl = $('jt-timeline');
    tl.innerHTML = '';
    if (!frames.length) { tl.innerHTML = '<p class="jt-dim">时间轴空空如也</p>'; return; }
    for (let i = 0; i < frames.length; i++) {
      const item = document.createElement('div');
      item.className = 'jt-frame';
      const cv = document.createElement('canvas');
      cv.width = 90; cv.height = 120;
      const saved = { ...p.ang };
      p.ang = { ...frames[i] };
      try { Puppet.renderToFit(cv, p); } catch { }
      p.ang = saved;
      const num = document.createElement('span');
      num.textContent = i + 1;
      const del = document.createElement('button');
      del.className = 'jt-frame-del';
      del.textContent = '×';
      del.onclick = () => { frames.splice(i, 1); renderTimeline(); };
      item.appendChild(cv);
      item.appendChild(num);
      item.appendChild(del);
      item.onclick = (e) => {
        if (e.target === del) return;
        if (playing) stopPlayback();
        applyAngles(frames[i]);
        p.weaponExtra = frames[i].weaponExtra;
        changed();
      };
      tl.appendChild(item);
    }
  }

  function startPlayback() {
    if (frames.length < 2) { toast('至少定格两帧才能播放'); return; }
    playing = true;
    playT = 0;
    lastFrameIdx = -1;
    $('jt-play').textContent = '⏸ 暂停';
    hudRefresh();
    ensureLoop();
  }
  function stopPlayback() {
    playing = false;
    $('jt-play').textContent = '▶ 播放';
    hudRefresh();
  }

  function playbackTick(ts) {
    if (!playing) return;
    const dt = Math.min(0.1, (ts - lastTs) / 1000);
    lastTs = ts;
    playT += dt * playSpeed;
    const n = frames.length;
    let idx = Math.floor(playT / FRAME_DUR);
    if (loopOn) {
      if (idx >= n) { idx = idx % n; if (idx === 0) AudioFx.smallGong(0.2); }
    } else if (idx >= n - 1) {
      idx = n - 1;
      stopPlayback();
    }
    const f = clamp((playT - idx * FRAME_DUR) / FRAME_DUR, 0, 1);
    const cur = frames[Math.max(0, idx - 1)], nxt = frames[idx];
    if (!cur || !nxt) return;
    for (const k of ANG_KEYS) p.ang[k] += wrap(nxt[k] - p.ang[k]) * f;
    p.weaponExtra += wrap(nxt.weaponExtra - p.weaponExtra) * f;
    if (idx !== lastFrameIdx) {
      lastFrameIdx = idx;
      AudioFx.woodblock(0.3);
    }
    renderNow();
    updateHandles();
  }

  /* 自动生成段（公式复刻自 puppet.js 姿态函数，引擎未导出） */
  function genWalk() {
    const out = [];
    for (let i = 0; i < 6; i++) {
      const ph = i * 1.05;
      const s = Math.sin(ph);
      const a = { ...IDLE };
      a.hiF = -0.1 + 0.52 * s; a.knF = 0.15 + 0.5 * Math.max(0, Math.sin(ph + 2.6));
      a.hiB = 0.1 - 0.52 * s; a.knB = 0.15 + 0.5 * Math.max(0, Math.sin(ph + 2.6 + Math.PI));
      a.shF = 0.22 + 0.24 * Math.sin(ph + Math.PI); a.shB = -0.5 + 0.24 * s;
      a.elF = -0.3; a.elB = -0.4;
      a.torso = 0.02 + 0.045 * s; a.head = 0.03 * s;
      out.push({ ...a, weaponExtra: 0 });
    }
    return out;
  }
  function genJump() {
    return [
      { ...IDLE, weaponExtra: 0 },
      { torso: 0.18, head: 0.05, shF: 0.3, elF: -0.6, shB: -0.4, elB: -0.6, hiF: -0.4, knF: 0.5, hiB: -0.45, knB: 0.55, weaponExtra: 0 },
      { torso: -0.1, head: 0.05, shF: -2.4, elF: -0.4, shB: -2.0, elB: -0.5, hiF: -0.9, knF: -1.25, hiB: -0.55, knB: -1.1, weaponExtra: 0 },
      { torso: 0.06, head: 0.05, shF: -2.4, elF: -0.4, shB: -2.0, elB: -0.5, hiF: -0.9, knF: -1.25, hiB: -0.55, knB: -1.1, weaponExtra: 0 },
      { torso: 0.06, head: 0.05, shF: -2.4, elF: -0.4, shB: -2.0, elB: -0.5, hiF: 0.2, knF: 0.3, hiB: 0.2, knB: 0.3, weaponExtra: 0 },
      { ...IDLE, weaponExtra: 0 },
    ];
  }
  function genSpin() {
    const out = [];
    const spin = [0, 1.3, 2.6, 3.9, 5.0, 3.9, 2.6, 1.3];
    for (let i = 0; i < 8; i++) {
      const ph = i * Math.PI / 4;
      const a = { ...IDLE };
      a.shF = -2.5 + 1.7 * Math.max(0, Math.sin(ph)); a.elF = -0.3;
      a.shB = -0.4 + 0.5 * Math.sin(ph + 1.2); a.elB = -0.5;
      a.torso = 0.06 + 0.09 * Math.sin(ph * 1.7); a.head = 0.05;
      a.hiF = -0.3 + 0.35 * Math.sin(ph * 1.3); a.knF = 0.25;
      a.hiB = 0.3 - 0.35 * Math.sin(ph * 1.3); a.knB = 0.25;
      out.push({ ...a, weaponExtra: spin[i] });
    }
    return out;
  }

  function genPreset(kind) {
    if (playing) stopPlayback();
    const gen = kind === 'walk' ? genWalk() : kind === 'jump' ? genJump() : genSpin();
    frames = gen.map(f => ({ ...f }));
    applyAngles(frames[0]);
    p.weaponExtra = frames[0].weaponExtra;
    AudioFx.pattern('clap');
    renderTimeline();
    toast(`已生成「${kind === 'walk' ? '行走' : kind === 'jump' ? '跳跃' : '耍棒'}」${frames.length} 帧`);
  }

  function saveAnim() {
    if (frames.length < 2) { toast('先定格或生成几帧再保存'); return; }
    const list = loadLS(LS_ANIMS) || [];
    if (list.length >= 4) { toast('动画库已满（4 个）'); return; }
    list.push({ name: `动画·${p.spec.name}·${list.length + 1}`, char: charKey, frames: frames.map(f => ({ ...f })) });
    saveLS(LS_ANIMS, list);
    renderAnimList();
    AudioFx.woodblock();
    toast('已保存动画');
  }

  function renderAnimList() {
    const wrapEl = $('jt-anim-list');
    wrapEl.innerHTML = '';
    const list = loadLS(LS_ANIMS) || [];
    for (let i = 0; i < list.length; i++) {
      const item = document.createElement('div');
      item.className = 'jt-row';
      const nm = document.createElement('span');
      nm.textContent = `${list[i].name}（${list[i].frames.length} 帧）`;
      const loadBtn = document.createElement('button');
      loadBtn.className = 'btn btn-mini';
      loadBtn.textContent = '载入';
      loadBtn.onclick = () => {
        setCharacter(list[i].char);
        frames = list[i].frames.map(f => ({ ...f }));
        applyAngles(frames[0]);
        p.weaponExtra = frames[0].weaponExtra;
        renderTimeline();
        changed();
      };
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-mini';
      delBtn.textContent = '删';
      delBtn.onclick = () => {
        list.splice(i, 1);
        saveLS(LS_ANIMS, list);
        renderAnimList();
      };
      item.appendChild(nm);
      item.appendChild(loadBtn);
      item.appendChild(delBtn);
      wrapEl.appendChild(item);
    }
    if (!list.length) wrapEl.innerHTML = '<p class="jt-dim">还没有保存的动画</p>';
  }

  /* ---------- 隔空操骨（手势驱动选中关节） ---------- */
  function setGesture(on) {
    if (on && !Input.state.cameraOn) { toast('请先开启右上角摄像头'); return; }
    gestureOn = on;
    $('jt-gesture').classList.toggle('on', on);
    $('jt-gesture').textContent = on ? '✋ 隔空操骨：开' : '✋ 隔空操骨';
    if (on && !selected) { selected = 'wrF'; updateHandleSel(); }
    hudRefresh();
  }

  function onPalm(ev) {
    if (!active || !gestureOn || !selected || !ev.palms || !ev.palms.length) return;
    if (playing) stopPlayback();
    const palm = ev.palms[0];
    const mainRect = document.getElementById('main').getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    const sx = palm.x * mainRect.width - (boxRect.left - mainRect.left);
    const sy = palm.y * mainRect.height - (boxRect.top - mainRect.top);
    applyPointTo(selected, sx, sy);
    changed();
  }

  /* ---------- 主循环（仅挑战计时/播放时运行） ---------- */
  function ensureLoop() {
    if (rafId) return;
    lastTs = performance.now();
    const tick = (ts) => {
      rafId = requestAnimationFrame(tick);
      let need = false;
      if (levelIdx >= 0 && !levelLocked) {
        need = true;
        levelLeft = LEVELS[levelIdx].time - (ts - levelStart) / 1000;
        if (ghostP && performance.now() >= levelGhostUntil) { ghostP = null; renderNow(); }
        if (levelLeft <= 0) { levelLeft = 0; lockIn(); }
        const tEl = $('jt-time'); if (tEl) tEl.textContent = Math.ceil(levelLeft);
        const sEl = $('jt-sim'); if (sEl) sEl.textContent = simPct.toFixed(1) + '%';
      }
      if (playing) { need = true; playbackTick(ts); }
      if (!need) { rafId = 0; cancelAnimationFrame(tick); }
    };
    rafId = requestAnimationFrame(tick);
  }

  /* ---------- 生命周期 ---------- */
  function init() {
    if (inited) return;
    inited = true;
    canvas = $('cv-joints');
    ctx = canvas.getContext('2d');
    box = $('joints-stage-box');
    handleLayer = $('joints-handles');
    hud = $('joints-hud');
    stars = loadLS(LS_STARS) || [0, 0, 0, 0, 0, 0];
    buildHandles();
    buildCharGrid();
    buildPresets();
    setCharacter('wukong');
    renderPoseList();
    renderAnimList();
    /* 模式 tab */
    $('jt-tab-free').onclick = () => setMode('free');
    $('jt-tab-ch').onclick = () => setMode('challenge');
    $('jt-tab-mo').onclick = () => setMode('motion');
    /* 工具条 */
    $('jt-reset').onclick = resetAngles;
    $('jt-random').onclick = randomAngles;
    $('jt-mirror').onclick = mirrorPuppet;
    $('jt-savepose').onclick = savePose;
    $('jt-export').onclick = () => exportPng();
    $('jt-gesture').onclick = () => setGesture(!gestureOn);
    /* 挑战 */
    $('jt-lock').onclick = lockIn;
    $('jt-retry').onclick = () => { if (levelIdx >= 0) startLevel(levelIdx); };
    /* 动画 */
    $('jt-capture').onclick = captureFrame;
    $('jt-play').onclick = () => { playing ? stopPlayback() : startPlayback(); };
    $('jt-loop').onclick = (e) => { loopOn = !loopOn; e.target.classList.toggle('on', loopOn); };
    $('jt-loop').classList.add('on');
    $('jt-speed').onclick = (e) => { playSpeed = playSpeed === 0.5 ? 1 : playSpeed === 1 ? 2 : 0.5; e.target.textContent = playSpeed + '×'; };
    $('jt-saveanim').onclick = saveAnim;
    $('jt-clear').onclick = () => { if (playing) stopPlayback(); frames = []; renderTimeline(); toast('时间轴已清空'); };
    $('jt-gen-walk').onclick = () => genPreset('walk');
    $('jt-gen-jump').onclick = () => genPreset('jump');
    $('jt-gen-spin').onclick = () => genPreset('spin');
    /* 手势总线 */
    Input.on('palm', onPalm);
    Input.on('handStatus', (st) => { if (st !== 'ready' && gestureOn) setGesture(false); });
    window.addEventListener('resize', () => { if (active) resize(); });
  }

  function setActive(on) {
    active = on;
    if (!on) {
      if (playing) stopPlayback();
      if (levelIdx >= 0) cancelLevel();
      gestureOn && setGesture(false);
      return;
    }
    resize();
    updateHandles();
    hudRefresh();
    renderNow();
  }

  return {
    init, setActive,
    /* 测试钩子（无头验证用） */
    _test: {
      ang: () => ({ ...p.ang }),
      setAngles: (a) => { applyAngles(a); },
      handlePos: (id) => { const jp = jointPositions(); const j = jp[id]; return j ? { x: toScreen(j[0], j[1])[0], y: toScreen(j[0], j[1])[1] } : null; },
      charKey: () => charKey,
      startLevel: (n) => { setMode('challenge'); startLevel(n); },
      sim: () => simPct,
      target: () => (levelIdx >= 0 ? { ...LEVELS[levelIdx].target } : null),
      genPreset: (k) => { genPreset(k); return frames.length; },
      play: () => startPlayback(),
      pause: () => stopPlayback(),
      playing: () => playing,
      /* 测试专用：无头环境 rAF 不产生帧，手动推进播放 dt 毫秒 */
      tickPlayback: (ms) => { if (!playing) return; playbackTick((lastTs || 0) + ms); },
      frames: () => frames.map(f => ({ ...f })),
      lock: () => lockIn(),
      stars: () => [...stars],
    },
  };
})();
