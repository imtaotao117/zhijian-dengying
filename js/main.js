/* ============================================================
   main.js —— 应用外壳与自由操影控制器
   · Hash 路由与视图生命周期
   · 首页装饰皮影
   · 自由操影：手势 / 鼠标 / 触屏 / 键盘统一操控
   · 全局：摄像头开关、声音开关、Toast
   ============================================================ */
(() => {
  const Input = window.Input;
  const Stage = window.Stage;
  const Puppet = window.Puppet;
  const Parts = window.Parts;
  const AudioFx = window.AudioFx;
  const Drama = window.Drama;

  /* ---------- 屏幕自检：任何 JS 错误直接显示为红色浮条 ---------- */
  function reportError(text) {
    let box = document.getElementById('err-overlay');
    if (!box) {
      box = document.createElement('div');
      box.id = 'err-overlay';
      box.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:99999;max-width:86vw;' +
        'background:#7a1f1f;color:#ffe1b0;font:12px/1.6 monospace;padding:8px 14px;border-radius:8px;' +
        'box-shadow:0 4px 16px rgba(0,0,0,.4);white-space:pre-wrap;';
      document.body.appendChild(box);
    }
    box.textContent = '⚠ ' + text + '  （可复制此信息，并打开 diagnostics/ 中的自检页排查）';
    clearTimeout(box._t);
    box._t = setTimeout(() => { box.remove(); }, 12000);
  }
  window.addEventListener('error', ev => {
    reportError((ev.message || '未知错误') + '\n文件：' + String(ev.filename || '').split('/').pop() + ' 行 ' + ev.lineno + ':' + ev.colno);
  });
  window.addEventListener('unhandledrejection', ev => {
    reportError('Promise 异常：' + String((ev.reason && ev.reason.message) || ev.reason));
  });

  /* ---------- 摄像头失败常驻对话框：原因与解决办法一起亮出来，方便定位 ---------- */
  function showCamError(msg) {
    let dlg = document.getElementById('cam-err-dialog');
    if (!dlg) {
      dlg = document.createElement('div');
      dlg.id = 'cam-err-dialog';
      dlg.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:999999;' +
        'max-width:min(560px,92vw);background:#f7efdc;border:2px solid #a03028;border-radius:14px;' +
        'padding:20px 24px;box-shadow:0 12px 40px rgba(0,0,0,.35);' +
        'font:14px/1.9 "Microsoft YaHei",sans-serif;color:#3a2a1a;';
      dlg.innerHTML = '<h3 style="margin:0 0 8px;color:#a03028;font-size:17px">📷 摄像头打不开</h3>' +
        '<p id="cam-err-msg" style="margin:0 0 12px"></p>' +
        '<p style="margin:0 0 14px;font-size:12px;color:#8a6a3a">请记录错误文字，并依次检查浏览器权限、摄像头占用和 diagnostics 自检页。</p>' +
        '<div style="text-align:right"><button id="cam-err-ok" style="font:13px Microsoft YaHei,sans-serif;' +
        'padding:6px 18px;border:1px solid #a03028;border-radius:8px;background:#a03028;color:#fff;cursor:pointer">知道了</button></div>';
      document.body.appendChild(dlg);
      document.getElementById('cam-err-ok').onclick = () => { dlg.remove(); };
    }
    document.getElementById('cam-err-msg').textContent = msg;
  }

  /* ---------- 视图路由 ---------- */
  const VIEWS = ['home', 'drama', 'stage', 'workshop', 'joints', 'classroom'];
  let current = 'home';

  function showView(name) {
    if (!VIEWS.includes(name)) name = 'home';
    /* 离开旧视图 */
    if (current === 'drama') Drama.teardown();
    if (current === 'workshop') window.Workshop.setActive(false);
    if (current === 'joints') window.JointStudio.setActive(false);
    if (current === 'stage') stageSetActive(false);
    current = name;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + name).classList.add('active');
    document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('active', a.dataset.view === name));
    closeMobileNav();
    /* 进入新视图 */
    if (name === 'drama') showCatalog();
    if (name === 'workshop') window.Workshop.setActive(true);
    if (name === 'joints') window.JointStudio.setActive(true);
    if (name === 'stage') enterFreeStage();
    window.scrollTo(0, 0);
  }

  function route() {
    const h = location.hash.replace(/^#\/?/, '') || 'home';
    showView(h);
  }
  window.addEventListener('hashchange', route);

  /* ---------- 移动端导航 ---------- */
  const nav = document.getElementById('nav');
  const navToggle = document.getElementById('btn-nav-toggle');
  function closeMobileNav() {
    if (!nav || !navToggle) return;
    nav.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', '打开导航菜单');
  }
  function initNavigation() {
    if (!nav || !navToggle) return;
    navToggle.onclick = () => {
      const open = !nav.classList.contains('open');
      nav.classList.toggle('open', open);
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
    };
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMobileNav));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMobileNav(); });
  }

  /* ---------- 首次使用引导 ---------- */
  function initQuickGuide() {
    const modal = document.getElementById('quick-guide');
    const opener = document.getElementById('btn-quick-guide');
    const progress = document.getElementById('quick-guide-progress');
    const title = document.getElementById('quick-guide-title');
    const text = document.getElementById('quick-guide-text');
    const camButton = document.getElementById('btn-guide-camera');
    const camStatus = document.getElementById('quick-guide-camera-status');
    const prev = document.getElementById('btn-guide-prev');
    const next = document.getElementById('btn-guide-next');
    const skip = document.getElementById('btn-guide-skip');
    const steps = [
      { title: '先选一个玩法', text: '推荐从“经典剧目”开始看戏，点击舞台或按空格即可拍板推进；也可以进入“自由操影”直接操控皮影。' },
      { title: '再试试手势操影', text: '在本机 localhost 页面，主动点击下方按钮检测摄像头。允许浏览器访问后，把手掌放进镜头：张手移动、握拳亮相、伸一指拍板或出招。' },
      { title: '没有摄像头也能玩', text: '进入自由操影后，鼠标或触屏拖动皮影可行走，单击可跳跃、双击可亮相；键盘 ←→ 移动、空格跳跃或拍板、P 亮相。摄像头失败也不影响这些操作。' },
    ];
    let step = 0;
    let focusBefore = null;
    function render() {
      progress.textContent = `新手引导 ${step + 1} / ${steps.length}`;
      title.textContent = steps[step].title;
      text.textContent = steps[step].text;
      prev.disabled = step === 0;
      next.textContent = step === steps.length - 1 ? '完成' : '下一步';
      camButton.hidden = step !== 1;
      camStatus.hidden = step !== 1;
      if (step === 1) {
        camStatus.textContent = Input.state.cameraOn ? '摄像头已开启，请将手掌放入镜头。'
          : !window.isSecureContext ? '当前页面不是安全上下文。请在本机通过 localhost 打开；其他设备需要 HTTPS 才能使用摄像头。'
            : '检测会请求浏览器摄像头权限；不想使用摄像头可以直接下一步。';
      }
    }
    function close() {
      modal.hidden = true;
      try { localStorage.setItem('zjdy-quick-guide-v1', 'seen'); } catch { /* 隐私模式下可继续使用 */ }
      focusBefore?.focus();
    }
    function open() {
      focusBefore = document.activeElement;
      step = 0;
      render();
      modal.hidden = false;
      next.focus();
    }
    opener.addEventListener('click', open);
    skip.addEventListener('click', close);
    prev.addEventListener('click', () => { if (step > 0) { step--; render(); } });
    next.addEventListener('click', () => { if (step < steps.length - 1) { step++; render(); } else close(); });
    camButton.addEventListener('click', async () => {
      if (Input.state.cameraOn) { camStatus.textContent = '摄像头已开启，请将手掌放入镜头。'; return; }
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        camStatus.textContent = '当前环境无法请求摄像头；请使用 localhost，或直接用鼠标、触屏和键盘体验。';
        return;
      }
      camButton.disabled = true;
      camStatus.textContent = '正在请求摄像头并加载手势模型…';
      await Input.startCamera();
      camButton.disabled = false;
      camStatus.textContent = Input.state.cameraOn
        ? '检测成功！请将手掌放进右下角镜头，切到“自由操影”体验。'
        : '摄像头未开启。请查看屏幕上的错误说明；鼠标、触屏和键盘仍可使用。';
    });
    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key !== 'Tab') return;
      const controls = [camButton, skip, prev, next].filter(el => !el.hidden && !el.disabled);
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
    });
    let seen = false;
    try { seen = localStorage.getItem('zjdy-quick-guide-v1') === 'seen'; } catch { /* 隐私模式下正常显示 */ }
    if (!seen && current === 'home') setTimeout(() => { if (current === 'home' && modal.hidden) open(); }, 1400);
  }

  /* ---------- 加载遮罩 ---------- */
  function hideLoading() {
    const m = document.getElementById('loading-mask');
    if (m) { m.classList.add('hide'); setTimeout(() => m.remove(), 700); }
  }

  /* ---------- Toast ---------- */
  let toastBox = null;
  window.App = {
    setStagePuppet(spec) { stagePuppetSpec = spec; },
    toast(msg) {
      if (!toastBox) {
        toastBox = document.createElement('div');
        toastBox.style.cssText = 'position:fixed;left:50%;bottom:70px;transform:translateX(-50%);z-index:99;' +
          'background:#241812;color:#ffd27d;padding:10px 22px;border-radius:24px;font-size:14px;letter-spacing:2px;' +
          'box-shadow:0 6px 20px rgba(0,0,0,.35);transition:opacity .5s;pointer-events:none';
        document.body.appendChild(toastBox);
      }
      toastBox.textContent = msg;
      toastBox.style.opacity = '1';
      clearTimeout(toastBox._t);
      toastBox._t = setTimeout(() => { toastBox.style.opacity = '0'; }, 2200);
    },
  };

  /* ---------- 舞台实例 ---------- */
  const stage1 = Stage.create(document.getElementById('cv-drama'));
  const stage2 = Stage.create(document.getElementById('cv-stage'));
  stage2.cursor = null;

  /* ============================================================
     自由操影
     ============================================================ */
  let stagePuppetSpec = null;          /* 工坊导入的专属皮影 */
  let puppetA = null, puppetB = null;
  let puppetASpec = null;              /* puppetA 当前使用的 spec（用于检测工坊导入变更） */
  let dualMode = false;
  let stageActive = false;
  let selected = null;                 /* 当前被鼠标/键盘操控的皮影 */
  const SCENE_KEYS = ['plain', 'mountain', 'village', 'forest', 'heaven', 'sea', 'palace'];
  const SCENE_NAMES = { plain: '旷野', mountain: '山岭', village: '村舍', forest: '松林', heaven: '天宫', sea: '东海', palace: '龙宫' };
  let sceneIdx = 0;
  let currentDramaId = 'sdbgj';        /* 当前选中的剧目 */

  function updateStageNote() {
    document.getElementById('stage-tools-note').textContent = stagePuppetSpec
      ? '当前：我的专属皮影「' + stagePuppetSpec.name + '」'
      : '当前：' + (puppetASpec ? puppetASpec.name : '孙悟空') + '（也可到「皮影工坊」拼装专属皮影）';
  }

  function ensurePuppets() {
    const spec = stagePuppetSpec || Parts.characters.wukong;
    if (puppetA && puppetASpec === spec) return;   /* 已是当前配置，无需重建 */
    if (puppetA) {
      stage2.puppets.splice(stage2.puppets.findIndex(e => e.puppet === puppetA), 1);
    }
    puppetA = Stage.addPuppet(stage2, Puppet.create(spec, { x: stage2.w * 0.4, scale: 1.15, moveSpeed: 130 }));
    puppetA.targetX = stage2.w * 0.4;
    puppetASpec = spec;
    stage2.cursor = null;
    if (!selected || !stage2.puppets.some(e => e.puppet === selected)) setSelected(puppetA);
    updateStageNote();
  }

  function setHints() {
    /* 摄像头一开启就显示手势提示（即使还没有识别到手） */
    const hand = Input.state.handMode || Input.state.cameraOn;
    const el = document.getElementById('stage-hints');
    el.innerHTML = [
      hand
        ? '<span>✋ 手掌左右移动 = 行走</span><span>⚡ 快速上挥 = 跳跃</span><span>✊ 握拳 = 亮相</span><span>☝️ 伸一指 = 出招</span>'
        : '<span>🖱️ 点住任一皮影拖动 = 行走</span><span>👆 单击 = 跳跃</span><span>👆👆 双击 = 亮相</span><span>🖱️ 右键 = 出招</span><span>⌨️ ←→走 · 空格跳 · P亮相 · F出招 · S盘坐 · C换景</span>',
      dualMode ? '<span>👥 双人同屏：双手各操控一只，近身出招可打中对方（中两招倒地）</span>' : '<span>👥 点击「双人同屏」，伸出双手对戏</span>',
    ].join('');
  }

  function enterFreeStage() {
    Stage.resize(stage2);
    for (const e of stage2.puppets) e.puppet.ground = stage2.groundY;
    ensurePuppets();
    stageActive = true;
    stage2.cursor = null;
    setHints();
    Stage.setActive(stage2, true);
  }
  function stageSetActive(on) {
    stageActive = on;
    if (!on) Stage.setActive(stage2, false);
  }

  /* ---------- 选中与被操控皮影 ---------- */
  function selectedPuppet() { return selected || puppetA; }
  function setSelected(p) {
    selected = p;
    for (const e of stage2.puppets) e.marker = e.puppet === p;
  }
  /* 命中检测：指针距皮影身体中心 170px 内视为选中该皮影 */
  function puppetAt(nx, ny) {
    let best = null, bestD = 170;
    for (const e of stage2.puppets) {
      const p = e.puppet;
      const d = Math.hypot(nx * stage2.w - p.x, ny * stage2.h - (p.y - 180 * (p.scale / 1.15)));
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }
  /* 行走目标夹在舞台两侧边缘内，防止皮影被拖出画面 */
  const STAGE_MARGIN = 60;
  function clampStageX(x) {
    return Math.max(STAGE_MARGIN, Math.min(stage2.w - STAGE_MARGIN, x));
  }

  /* ---------- 动作 ---------- */
  function doPose(p) {
    Puppet.liangxiang(p, 1.5);
    AudioFx.pattern('pose');
  }
  /* 出招：单人=耍一段把式；双人=近身可打中对方（受击→再中招→倒地） */
  function doFight(p) {
    Puppet.fight(p, 0.9);
    AudioFx.pattern('fight');
    if (!dualMode || !puppetB) return;
    const other = p === puppetA ? puppetB : puppetA;
    if (other.state === 'fallen') return;
    const dx = other.x - p.x;
    p.facing = Math.sign(dx) || p.facing;
    if (Math.abs(dx) < 150) {
      other.facing = -Math.sign(dx);
      if (other.state === 'hurt') {
        Puppet.fall(other);
        Stage.fxFlash(stage2, 0.35);
        Stage.fxSparks(stage2, other.x, stage2.groundY - 80, 16);
        /* 倒地后自行起身 */
        setTimeout(() => { if (other.state === 'fallen') Puppet.hurt(other, 1.4); }, 2800);
      } else {
        Puppet.hurt(other, 1.4);
        Stage.fxSparks(stage2, other.x, stage2.groundY - 90, 10);
      }
    }
  }
  /* 盘坐休息 / 起身 */
  function doSit(p) {
    if (p.state === 'sit') { p.state = 'idle'; return; }
    Puppet.sit(p);
    Stage.fxSmoke(stage2, p.x, stage2.groundY, 8);
  }
  /* 换场景 */
  function cycleScene() {
    sceneIdx = (sceneIdx + 1) % SCENE_KEYS.length;
    Stage.setScene(stage2, SCENE_KEYS[sceneIdx]);
    const btn = document.getElementById('btn-stage-scene');
    if (btn) btn.textContent = '场景·' + SCENE_NAMES[SCENE_KEYS[sceneIdx]];
  }

  /* ---------- 操控事件绑定（自由操影） ---------- */
  Input.on('dragStart', d => { if (stageActive) { const hit = puppetAt(d.x, d.y); if (hit) setSelected(hit); } });
  Input.on('drag', d => { if (stageActive && puppetA) selectedPuppet().targetX = clampStageX(d.x * stage2.w); });
  Input.on('tap', () => {
    if (!stageActive || !puppetA) return;
    const p = selectedPuppet();
    Puppet.jump(p);
    Stage.fxDust(stage2, p.x, stage2.groundY, 6);
  });
  Input.on('doubleTap', () => { if (stageActive && puppetA) doPose(selectedPuppet()); });
  Input.on('altTap', () => { if (stageActive && puppetA) doFight(selectedPuppet()); });
  Input.on('keyMove', d => {
    if (!stageActive || !puppetA) return;
    const p = selectedPuppet();
    p.targetX = clampStageX(p.x + d.dir * 90);
  });
  Input.on('pose', () => { if (stageActive && puppetA) doPose(selectedPuppet()); });
  Input.on('fight', () => { if (stageActive && puppetA) doFight(selectedPuppet()); });
  Input.on('sit', () => { if (stageActive && puppetA) doSit(selectedPuppet()); });
  Input.on('scene', () => { if (stageActive) cycleScene(); });

  /* 手势驱动：槽位 0 的手 → 甲，槽位 1 的手 → 乙（双手身份稳定不互换） */
  Input.on('palm', ({ palms }) => {
    if (!stageActive) return;
    if (palms.length) {
      const p0 = palms.find(p => p.slot === 0);
      const p1 = palms.find(p => p.slot === 1);
      const cur = p0 || p1;
      stage2.cursor = { x: cur.x * stage2.w, y: cur.y * stage2.h };
      if (dualMode && puppetB) {
        if (p0) puppetA.targetX = clampStageX(p0.x * stage2.w);
        if (p1) puppetB.targetX = clampStageX(p1.x * stage2.w);
      } else if (puppetA) {
        puppetA.targetX = clampStageX(cur.x * stage2.w);
      }
    } else {
      stage2.cursor = null;
    }
  });
  Input.on('handGesture', ({ slot, gesture }) => {
    if (!stageActive || !puppetA) return;
    const p = dualMode && puppetB ? (slot === 0 ? puppetA : puppetB) : puppetA;
    if (gesture === 'fist') doPose(p);
    else if (gesture === 'point') doFight(p);
  });
  Input.on('flickUp', ({ slot }) => {
    if (!stageActive || !puppetA) return;
    const p = dualMode && puppetB ? (slot === 0 ? puppetA : puppetB) : puppetA;
    Puppet.jump(p);
    Stage.fxDust(stage2, p.x, stage2.groundY, 6);
  });

  /* ---------- 剧目目录（选戏页 ⇄ 演出页 双界面切换） ---------- */
  function showCatalog() {
    updateDramaModeUI();
    const list = document.getElementById('drama-cat-list');
    /* 防御：缺目录容器时退回直接开演，不让模块卡死 */
    if (!list) { startPlay('sdbgj'); return; }
    list.innerHTML = '';
    const CN = ['一', '二', '三', '四', '五', '六', '七', '八'];
    Drama.list().forEach((d, i) => {
      const card = document.createElement('div');
      card.className = 'drama-cat-card';
      const no = document.createElement('span');
      no.className = 'drama-cat-no';
      no.textContent = '第' + (CN[i] || i + 1) + '出';
      const cover = document.createElement('canvas');
      cover.className = 'drama-cat-cover';
      cover.width = 96; cover.height = 132;
      Puppet.renderStatic(cover, Parts.characters[d.cover], 'pose');
      const info = document.createElement('div');
      info.className = 'drama-cat-info';
      const h = document.createElement('h3');
      h.textContent = '《' + d.title + '》';
      const tag = document.createElement('p');
      tag.className = 'drama-cat-tag';
      tag.textContent = d.tagline;
      const desc = document.createElement('p');
      desc.className = 'drama-cat-desc';
      desc.textContent = d.desc;
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.textContent = '开 场';
      btn.onclick = () => startPlay(d.id);
      info.append(h, tag, desc, btn);
      card.append(no, cover, info);
      list.appendChild(card);
    });
  }

  function updateDramaModeUI() {
    const demo = Drama.isDemoMode();
    const catBtn = document.getElementById('btn-demo-mode');
    const note = document.getElementById('demo-mode-note');
    const playBtn = document.getElementById('btn-drama-mode');
    if (catBtn) {
      catBtn.textContent = demo ? '评审演示模式：开' : '完整演出模式';
      catBtn.setAttribute('aria-pressed', String(demo));
      catBtn.classList.toggle('btn-primary', demo);
    }
    if (note) note.textContent = demo ? '每出约 60–90 秒，互动更紧凑' : '保留完整叙事节奏，每出约 2.5–3.5 分钟';
    if (playBtn) playBtn.textContent = demo ? '演示模式' : '完整模式';
  }

  function toggleDramaMode(restart) {
    Drama.setDemoMode(!Drama.isDemoMode());
    updateDramaModeUI();
    if (restart) Drama.start(stage1, currentDramaId);
  }

  /* 切到演出页并开场（先显示舞台再开演，保证画布尺寸正确） */
  function startPlay(dramaId) {
    currentDramaId = dramaId;
    const catView = document.getElementById('view-drama');
    const playView = document.getElementById('view-play');
    if (playView) {
      if (catView) catView.classList.remove('active');
      playView.classList.add('active');
    }
    Drama.start(stage1, dramaId);
  }
  /* 回目录：收戏、清台、回到选戏页 */
  function backToCatalog() {
    Drama.teardown();
    const catView = document.getElementById('view-drama');
    const playView = document.getElementById('view-play');
    if (playView) playView.classList.remove('active');
    if (catView) catView.classList.add('active');
    showCatalog();
  }

  /* 剧目按钮（元素缺失时静默跳过，防旧缓存混版崩溃） */
  const btnRestart = document.getElementById('btn-drama-restart');
  const btnExit = document.getElementById('btn-drama-exit');
  const btnDramaMode = document.getElementById('btn-drama-mode');
  const btnDemoMode = document.getElementById('btn-demo-mode');
  if (btnRestart) btnRestart.onclick = () => Drama.start(stage1, currentDramaId);
  if (btnExit) btnExit.onclick = backToCatalog;
  if (btnDramaMode) btnDramaMode.onclick = () => toggleDramaMode(true);
  if (btnDemoMode) btnDemoMode.onclick = () => toggleDramaMode(false);

  /* 舞台工具按钮 */
  function initStageTools() {
    document.getElementById('btn-stage-pose').onclick = () => { if (puppetA) doPose(selectedPuppet()); };
    document.getElementById('btn-stage-dual').onclick = () => {
      dualMode = !dualMode;
      const btn = document.getElementById('btn-stage-dual');
      btn.classList.toggle('btn-primary', dualMode);
      btn.textContent = dualMode ? '双人同屏 ✓' : '双人同屏';
      if (dualMode && !puppetB) {
        puppetB = Stage.addCharacter(stage2, 'baigujing', { x: stage2.w * 0.68, scale: 1.15, moveSpeed: 130 });
      }
      setHints();
    };
    /* 角色选择面板：列出全部预设角色（含新剧目人物），点选替换当前皮影 */
    const picker = document.getElementById('char-picker');
    const pickerGrid = document.getElementById('char-picker-grid');
    let pickerBuilt = false;
    const buildPicker = () => {
      if (pickerBuilt || !pickerGrid) return;
      for (const key of Object.keys(Parts.characters)) {
        const spec = Parts.characters[key];
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'char-item';
        item.setAttribute('aria-label', '选择角色' + spec.name);
        const c = document.createElement('canvas');
        c.width = 110; c.height = 130;
        Puppet.renderStatic(c, spec, 'idle');
        const p = document.createElement('p');
        p.textContent = spec.name;
        item.append(c, p);
        item.onclick = () => {
          stagePuppetSpec = null;
          const old = selectedPuppet();
          const at = stage2.puppets.findIndex(e => e.puppet === old);
          if (at >= 0) stage2.puppets.splice(at, 1);
          const nu = Stage.addCharacter(stage2, key, { x: old ? old.x : stage2.w * 0.4, scale: 1.15, moveSpeed: 130 });
          nu.targetX = nu.x;
          if (old === puppetA) { puppetA = nu; puppetASpec = spec; }
          else if (old === puppetB) puppetB = nu;
          setSelected(nu);
          updateStageNote();
          picker.classList.add('hidden');
        };
        pickerGrid.appendChild(item);
      }
      pickerBuilt = true;
    };
    const btnPuppet = document.getElementById('btn-stage-puppet');
    if (btnPuppet && picker) btnPuppet.onclick = () => {
      buildPicker();
      picker.classList.toggle('hidden');
    };
    const btnCharClose = document.getElementById('btn-char-close');
    if (btnCharClose && picker) btnCharClose.onclick = () => picker.classList.add('hidden');
    document.getElementById('btn-stage-scene').onclick = cycleScene;
    updateStageNote();
  }

  /* ============================================================
     全局工具
     ============================================================ */
  function initTools() {
    const camBtn = document.getElementById('btn-camera');
    camBtn.onclick = async () => {
      await Input.toggleCamera();
      camBtn.classList.toggle('on', Input.state.cameraOn);
    };
    /* 小窗 ✕ 关闭（顶栏按钮状态由 handStatus 事件同步） */
    document.getElementById('btn-cam-close').onclick = () => { Input.stopCamera(); };
    Input.on('handStatus', (st, msg) => {
      camBtn.classList.toggle('on', st === 'ready' || st === 'loading');
      const label = document.getElementById('input-mode');
      if (st === 'off') label.textContent = '鼠标模式';
      else if (st === 'error') {
        label.textContent = '摄像头失败';
        label.title = msg || '';
        showCamError(msg);   /* 常驻对话框：原因+解决办法，不随 Toast 消失 */
      }
      else if (st === 'loading') label.textContent = '模型加载中…';
      else if (st === 'ready') label.textContent = '摄像头就绪';
      if (stageActive) setHints();   /* 摄像头开/关时同步自由操影提示条 */
    });
    Input.on('palm', ({ palms }) => {
      const label = document.getElementById('input-mode');
      if (Input.state.cameraOn) {
        label.textContent = palms.length ? '手势模式' : '摄像头就绪';
      }
    });

    const sndBtn = document.getElementById('btn-sound');
    sndBtn.onclick = () => {
      AudioFx.unlock();
      AudioFx.setEnabled(!AudioFx.isEnabled());
      sndBtn.classList.toggle('on', AudioFx.isEnabled());
      sndBtn.textContent = AudioFx.isEnabled() ? '声音' : '静音';
    };
    AudioFx.setEnabled(true);
    sndBtn.classList.add('on');

    /* 任意交互解锁音频 */
    const unlock = () => { AudioFx.unlock(); };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
  }

  /* ---------- 首页装饰皮影 ---------- */
  function initHome() {
    const box = document.getElementById('home-puppet');
    box.style.background = 'none';
    const c = document.createElement('canvas');
    c.width = 230; c.height = 330;
    box.appendChild(c);
    Puppet.renderStatic(c, Parts.characters.wukong, 'pose');
  }

  /* ---------- 窗口尺寸 ---------- */
  window.addEventListener('resize', () => {
    Stage.resize(stage1);
    Stage.resize(stage2);
    for (const e of stage1.puppets) e.puppet.ground = stage1.groundY;
    for (const e of stage2.puppets) e.puppet.ground = stage2.groundY;
  });

  /* ---------- 启动 ---------- */
  function boot() {
    console.log('%c指尖灯影 v' + (window.ProjectConfig?.version || '2026.10.09') + ' 已加载', 'color:#b0602a;font-size:14px');
    Input.init(document.getElementById('main'));
    window.Workshop.init();
    window.Classroom.init();
    window.JointStudio.init();
    initHome();
    initNavigation();
    initTools();
    initQuickGuide();
    initStageTools();
    Stage.start(stage1);
    Stage.setActive(stage1, false);
    Stage.setActive(stage2, false);
    route();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(hideLoading, 400));
    else setTimeout(hideLoading, 900);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
