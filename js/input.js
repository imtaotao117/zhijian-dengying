/* ============================================================
   input.js —— 统一输入层
   · 手势识别：MediaPipe HandLandmarker（本地打包，离线可用）
     张手 = 操控跟随 ｜ 握拳 = 亮相 ｜ 伸一指 = 拍板 ｜ 快速上挥 = 跳跃
   · 手势状态机：滞回消抖，识别稳定不闪跳
   · 降级输入：鼠标 / 触屏（拖动=移动、点按=跳、双击=亮相）/ 键盘
   · 事件总线：tap / doubleTap / drag / flickUp / fist / point / palm
   ============================================================ */
window.Input = (() => {
  /* ---------- 事件总线 ---------- */
  const bus = {};
  function on(ev, cb) { (bus[ev] = bus[ev] || []).push(cb); return () => { bus[ev] = (bus[ev] || []).filter(f => f !== cb); }; }
  function emit(ev, ...args) { for (const cb of (bus[ev] || [])) { try { cb(...args); } catch (e) { console.warn(ev, e); } } }

  const state = {
    cameraOn: false,
    status: 'off',            /* off | loading | ready | error */
    handMode: false,
    palms: [],                /* [{x,y}] 舞台坐标（0..1 归一） */
    pointer: { x: 0, y: 0, down: false, dragging: false },
    gesture: 'none',
  };

  /* ---------- 指针（鼠标/触屏） ---------- */
  let rootEl = null, lastDown = null, tapTimer = null, moved = false;

  function init(root) {
    rootEl = root;
    root.addEventListener('pointerdown', e => {
      /* 只认主键/触屏：右键（button=2）走 contextmenu 出招，不参与点按/拖拽，
         否则右键会同时误触发「单击=跳跃」 */
      if (e.button !== 0) return;
      /* 按钮/链接/输入框上的按下不参与操影，避免误触「单击=跳跃/拍板」 */
      if (e.target.closest && e.target.closest('button, a, input, select, textarea')) { lastDown = null; return; }
      state.pointer.down = true; state.pointer.dragging = false;
      moved = false;
      lastDown = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    root.addEventListener('pointermove', e => {
      const p = toLocal(e.clientX, e.clientY);
      state.pointer.x = p.x; state.pointer.y = p.y;
      if (state.pointer.down) {
        if (!moved && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) > 8) {
          moved = true; state.pointer.dragging = true;
          emit('dragStart', { x: p.x, y: p.y });
        }
        if (state.pointer.dragging) emit('drag', { x: p.x, y: p.y });
      }
    });
    root.addEventListener('pointerup', e => {
      if (!lastDown) return;      /* 按下发生在控件上或区域外，不参与判定 */
      const dt = performance.now() - lastDown.t;
      state.pointer.down = false;
      const wasDrag = state.pointer.dragging;
      state.pointer.dragging = false;
      if (!moved && dt < 350) {
        if (tapTimer) { clearTimeout(tapTimer); tapTimer = null; emit('doubleTap', toLocal(e.clientX, e.clientY)); }
        else { tapTimer = setTimeout(() => { tapTimer = null; emit('tap', toLocal(e.clientX, e.clientY)); }, 260); }
      }
      if (wasDrag) emit('dragEnd');
    });
    root.addEventListener('pointerleave', () => { if (state.pointer.dragging) emit('dragEnd'); state.pointer.dragging = false; });
    /* 右键 = 出招（阻止默认菜单，避免遮挡舞台） */
    root.addEventListener('contextmenu', e => {
      if (e.target.closest && e.target.closest('button, a, input, select, textarea')) return;
      e.preventDefault();
      emit('altTap', toLocal(e.clientX, e.clientY));
    });
    /* 键盘 */
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      /* 焦点在输入控件时放行，不拦截空格等按键 */
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable) ||
        (e.target && e.target.closest && e.target.closest('[role="dialog"]'))) return;
      const k = e.key;
      if (k === 'ArrowLeft') emit('keyMove', { dir: -1 });
      else if (k === 'ArrowRight') emit('keyMove', { dir: 1 });
      else if (k === ' ') { e.preventDefault(); emit('tap'); }
      else if (k === 'p' || k === 'P') emit('pose');
      else if (k === 'f' || k === 'F') emit('fight');
      else if (k === 's' || k === 'S') emit('sit');
      else if (k === 'c' || k === 'C') emit('scene');
    });
  }

  function toLocal(cx_, cy_) {
    const r = rootEl.getBoundingClientRect();
    return { x: (cx_ - r.left) / r.width, y: (cy_ - r.top) / r.height };
  }

  /* ---------- 摄像头与 MediaPipe ---------- */
  let video = null, overlay = null, landmarker = null, camRaf = 0, lastT = 0;
  /* 手部跟踪槽位：跨帧按最近距离配对，双手交叉或短暂出画时身份稳定，
     保证「左手=甲、右手=乙」的对应关系不互换、不并拢 */
  let handSlots = [];   /* [{slot, x, y, lm, seen, hist, gesture, cand, candStable, lastFlickAt, lastFistAt, lastPointAt}] */

  const SKELETON = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
  ];

  /* 把各种错误对象翻译成人话（Event 没有 message，要挖 target/type） */
  function errText(e) {
    if (e && e.message) return e.message;
    if (e && e.type === 'error' && e.target && (e.target.src || e.target.href)) return '资源加载失败：' + (e.target.src || e.target.href);
    if (e && e.type) return '错误事件 ' + e.type;
    return String(e);
  }

  async function createLandmarker(vision, delegate) {
    const fileset = await vision.FilesetResolver.forVisionTasks('assets/wasm');
    return await vision.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: 'assets/models/hand_landmarker.task', delegate },
      runningMode: 'VIDEO',
      numHands: 2,
    });
  }

  async function loadModel() {
    setStatus('loading');
    let vision;
    try {
      vision = await import('assets/wasm/vision_bundle.mjs');
    } catch (e1) {
      /* 本地文件缺失时回退 CDN */
      try { vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs'); }
      catch (e2) { setStatus('error', '手势模型加载失败，请检查网络或本地文件'); return false; }
    }
    try {
      landmarker = await createLandmarker(vision, 'GPU');
    } catch (gpuErr) {
      /* GPU（WebGL）不可用：关闭硬件加速 / 远程桌面 / 虚拟机 / 老显卡驱动时常见。
         自动退回 CPU 模式——识别照常可用，只是稍慢一点 */
      console.warn('GPU 初始化失败，自动退回 CPU：', gpuErr);
      setStatus('loading', 'GPU 不可用，正在用 CPU 模式加载…');
      try {
        landmarker = await createLandmarker(vision, 'CPU');
      } catch (cpuErr) {
        setStatus('error', '手势模型加载失败：' + errText(cpuErr));
        return false;
      }
    }
    return true;
  }

  async function startCamera() {
    if (state.cameraOn) return;
    setStatus('loading', '正在请求摄像头…');
    try {
      video = document.getElementById('cam-video');
      overlay = document.getElementById('cam-overlay');
      video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
      await video.play();
      if (!landmarker) {
        const ok = await loadModel();
        if (!ok) {   /* 保留错误提示：只关视频流，不重置状态 */
          if (video && video.srcObject) { video.srcObject.getTracks().forEach(t => t.stop()); video.srcObject = null; }
          return;
        }
      }
      state.cameraOn = true;
      document.getElementById('camera-dock').classList.remove('hidden');
      setStatus('ready', '手掌对准镜头');
      camLoop();
    } catch (e) {
      const why = {
        NotAllowedError: '摄像头权限被拒绝：点地址栏左侧的摄像头图标允许访问；或到 Windows 设置 → 隐私 → 相机，允许应用使用相机',
        NotFoundError: '没有检测到摄像头设备：请确认摄像头已连接并在设备管理器中正常',
        NotReadableError: '摄像头被其他程序占用：关闭微信视频、腾讯会议、相机等应用后再试',
        SecurityError: '页面不是安全上下文（需 https 或 localhost），浏览器禁止访问摄像头',
      }[e.name] || (e.message || e.name);
      setStatus('error', '无法访问摄像头：' + why);
      state.cameraOn = false;
    }
  }

  function stopCamera() {
    state.cameraOn = false;
    state.handMode = false;
    state.gesture = 'none';
    state.palms = [];
    cancelAnimationFrame(camRaf);
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach(t => t.stop());
      video.srcObject = null;
    }
    document.getElementById('camera-dock').classList.add('hidden');
    setStatus('off');
  }

  async function toggleCamera() {
    state.cameraOn ? stopCamera() : await startCamera();
  }

  function setStatus(st, msg) {
    state.status = st;
    const hint = document.querySelector('#camera-dock .cam-hint');
    if (hint) hint.textContent = msg || {
      off: '摄像头未开启', loading: '正在加载手势模型…', ready: '张手=操控 · 握拳=亮相 · 伸一指=拍板/出招 · 快上挥=跳跃', error: '',
    }[st] || '';
    emit('handStatus', st, msg);
  }

  /* ---------- 手势分类（21 关键点） ---------- */
  function dist(lm, a, b) {
    return Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y);
  }
  function classify(lm) {
    const ratio = i => dist(lm, i, 0) / dist(lm, i - 2, 0);   /* 指尖距腕 / 近节距腕 */
    const index = ratio(8), middle = ratio(12), ring = ratio(16), pinky = ratio(20);
    const extCount = (index > 1.22) + (middle > 1.22) + (ring > 1.22) + (pinky > 1.22);
    /* 张手：食指、中指明显伸直且至少三指伸直 */
    if (index > 1.22 && middle > 1.22 && extCount >= 3) return 'open';
    /* 一指：仅食指明显伸直，其余三指蜷起——走路时松弛的半张手判为 none，避免误触出招 */
    if (index > 1.3 && middle < 1.18 && ring < 1.18 && pinky < 1.18) return 'point';
    /* 握拳：四指全部蜷起；拇指可贴掌也可竖起（竖拇指的拳很常见，不应挡下亮相） */
    if (index < 1.18 && middle < 1.18 && ring < 1.18 && pinky < 1.18 && dist(lm, 4, 0) < dist(lm, 2, 0) * 2.2) return 'fist';
    return 'none';
  }

  /* 槽位配对：双手各占一槽；短暂出画保留槽位，超时释放。
     两只手同时在画面里时，每只手都必须落到一个槽位上——
     否则双人同屏时第二只手被丢弃，两个皮影只会跟一只手走。
     手别标签（Left/Right）绑定槽位：双手交叉时同一只物理手仍跟同一皮影 */
  function trackHands(dets, t) {
    const used = new Set();
    const take = (det, allowFar) => {
      const label = det.hand && det.hand.score >= 0.8 ? det.hand.name : null;
      let near = null, nearD = 0.32, any = null, anyD = Infinity;
      for (const slot of handSlots) {
        if (used.has(slot.slot)) continue;
        const d = Math.hypot(det.x - slot.x, det.y - slot.y);
        const pd = (label && slot.handLabel === label) ? d - 0.5 : d;   /* 同手别优先配对 */
        if (pd < nearD) { nearD = pd; near = slot; }
        if (d < anyD) { anyD = d; any = slot; }
      }
      if (near) {
        used.add(near.slot);
        near.x = det.x; near.y = det.y; near.lm = det.lm; near.seen = t;
        if (!near.handLabel && label) near.handLabel = label;   /* 未绑定的槽位认领手别 */
        return true;
      }
      /* 两手同帧出现时，即使距旧槽位稍远也占下最近空槽位（另一只手本帧可能没被识别到） */
      if (allowFar && any) {
        used.add(any.slot);
        any.x = det.x; any.y = det.y; any.lm = det.lm; any.seen = t;
        return true;
      }
      if (handSlots.length < 2) {
        const free = [0, 1].find(i => !handSlots.some(s => s.slot === i));
        handSlots.push({
          slot: free, x: det.x, y: det.y, lm: det.lm, seen: t,
          hist: [], gesture: 'none', cand: 'none', candStable: 0,
          lastFlickAt: 0, lastFistAt: 0, lastPointAt: 0,
          handLabel: label,
        });
        used.add(free);   /* 新槽位本帧不再接受其他手，防止双手同现时并入同一槽 */
        return true;
      }
      return false;
    };
    for (const det of dets) take(det, dets.length >= 2);
    for (let i = handSlots.length - 1; i >= 0; i--) {
      if (t - handSlots[i].seen > 220) handSlots.splice(i, 1);
    }
  }

  /* 每只手独立的手势状态机（防相似动作误触）：
     · 'none'（模糊态）不改判，保持上一个明确手势——识别抖动不会造成重复触发
     · 新手势需连续确认：张手 3 帧，握拳/一指 6 帧（约 200ms），
       张开拳头、抓握等过程中的短暂过渡姿态不会触发动作
     · 事件只在明确手势之间真实切换时发出一次，保持手势不会反复触发 */
  function slotGesture(slot, g, t) {
    const eff = g === 'none' ? slot.gesture : g;
    if (eff === slot.gesture) { slot.cand = 'none'; slot.candStable = 0; return; }
    if (eff === slot.cand) {
      const need = (eff === 'fist' || eff === 'point') ? 5 : 3;
      if (++slot.candStable >= need) {
        slot.gesture = eff; slot.candStable = 0;
        emit('handGesture', { slot: slot.slot, gesture: eff });
        /* 全局事件兼容经典剧目（拍板）：任一只手做出手势即触发 */
        if (eff === 'fist' && t - slot.lastFistAt > 1400) { slot.lastFistAt = t; emit('fist'); }
        if (eff === 'point' && t - slot.lastPointAt > 1200) { slot.lastPointAt = t; emit('point'); }
      }
    } else { slot.cand = eff; slot.candStable = 1; }
  }

  /* 单帧手势处理（从 camLoop 提取，便于逐帧驱动与测试） */
  function processFrame(landmarks, t, handedness) {
    state.handMode = !!landmarks.length;
    if (landmarks.length) {
      /* 掌心取中指掌骨点(9)，镜像映射；带入手别标签用于槽位绑定 */
      const dets = landmarks.map((lm, i) => ({
        x: 1 - lm[9].x, y: lm[9].y, lm,
        hand: handedness && handedness[i] && handedness[i].categories && handedness[i].categories[0],
      }));
      trackHands(dets, t);
      for (const slot of handSlots) {
        /* 每只手独立判定快上挥 = 对应皮影跳跃 */
        slot.hist.push({ x: slot.x, y: slot.y, t });
        if (slot.hist.length > 8) slot.hist.shift();
        if (slot.hist.length >= 5) {
          const p0 = slot.hist[0], p1 = slot.hist[slot.hist.length - 1];
          const dt = (p1.t - p0.t) / 1000;
          if (dt > 0.02) {
            const vy = (p1.y - p0.y) / dt;
            /* 跳跃：非握拳/一指时明显快速上移（速度+位移双条件），普通抬手、做手势时的移动不触发 */
            if (slot.gesture !== 'fist' && slot.gesture !== 'point' && vy < -0.85 && p1.y - p0.y < -0.2 && t - slot.lastFlickAt > 900) {
              slot.lastFlickAt = t; emit('flickUp', { slot: slot.slot });
            }
          }
        }
        slotGesture(slot, classify(slot.lm), t);
        /* 持续伸一指时周期重发「拍板」，避免一直保持手势时后续 cue 收不到事件 */
        if (slot.gesture === 'point' && t - slot.lastPointAt > 1200) { slot.lastPointAt = t; emit('point'); }
      }
      state.palms = handSlots.map(s => ({ slot: s.slot, x: s.x, y: s.y }));
      state.gesture = (handSlots.find(s => s.slot === 0) || handSlots[0]).gesture;
    } else {
      trackHands([], t);
      state.palms = [];
      state.gesture = 'none';
    }
    emit('palm', { palms: state.palms });
  }

  function camLoop() {
    if (!state.cameraOn) return;
    const t = performance.now();
    let res = null;
    if (landmarker && video && video.readyState >= 2) {
      try { res = landmarker.detectForVideo(video, t); }
      catch (e) { /* 视频帧未就绪等瞬态错误，忽略 */ }
      if (res) processFrame(res.landmarks || [], t, res.handedness);
      else emit('palm', { palms: state.palms });
      drawOverlay(res?.landmarks || []);
    }
    camRaf = requestAnimationFrame(camLoop);
  }

  function drawOverlay(landmarks) {
    const c = overlay, g = overlay.getContext('2d');
    const w = c.width = c.clientWidth, h = c.height = c.clientHeight;
    g.clearRect(0, 0, w, h);
    g.lineWidth = 2;
    for (const lm of landmarks) {
      g.strokeStyle = 'rgba(255,210,125,.9)';
      g.beginPath();
      for (const [a, b] of SKELETON) {
        g.moveTo(lm[a].x * w, lm[a].y * h);
        g.lineTo(lm[b].x * w, lm[b].y * h);
      }
      g.stroke();
      g.fillStyle = '#ffce6e';
      for (const p of lm) {
        g.beginPath(); g.arc(p.x * w, p.y * h, 2.2, 0, Math.PI * 2); g.fill();
      }
    }
    /* 手势名 */
    if (state.gesture !== 'none') {
      g.fillStyle = 'rgba(20,10,5,.6)';
      g.fillRect(6, 6, 76, 22);
      g.fillStyle = '#ffd27d';
      g.font = '13px sans-serif';
      g.fillText({ open: '张手·操控', fist: '握拳·亮相', point: '一指·拍板' }[state.gesture], 12, 22);
    }
  }

  return {
    on, state, init,
    toggleCamera, startCamera, stopCamera,
    setStatus,
  };
})();
