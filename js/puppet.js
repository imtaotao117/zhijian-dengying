/* ============================================================
   puppet.js —— 皮影骨骼动画引擎
   · 关节树：根(盆骨) → 躯干 → 颈 → 头；肩/肘/腕 ×2；髋/膝/踝 ×2
   · 姿态系统：站立 / 行走 / 跳跃 / 亮相 / 打斗 / 受击 / 倒地
   · 物理：重力跳跃 + 阻尼弹簧关节平滑（提线质感）+ 轻微颤动
   · 渲染：离屏绘制 → 地面投影 + 偏移暗影 + 本体 三重复合
   ============================================================ */
window.Puppet = (() => {
  const Parts = window.Parts;
  const S = Parts.SIL;
  const TAU = Math.PI * 2;

  /* ---------- 关节树定义（局部坐标，向下为正） ---------- */
  /* body 部件：颈枢(45,8)，髋部(45,120)；肩(54,20)/(38,22)；髋关节(48,112)/(42,112) */
  const BODY = { neck: [45, 8], hip: [45, 120], shF: [54, 20], shB: [38, 22], hiF: [48, 112], hiB: [42, 112] };
  const SEG = { upper: 56, fore: 52, thigh: 62, shin: 56 };

  /* ---------- 姿态目标角（弧度，0=自然下垂，+ 向身前摆） ---------- */
  function poseIdle(a) {
    a.torso = 0.02; a.head = 0;
    a.shB = -0.5; a.elB = -0.35;
    a.shF = 0.22; a.elF = -0.25;
    a.hiF = -0.1; a.knF = 0.12;
    a.hiB = 0.1; a.knB = 0.12;
  }
  function poseWalk(a, ph) {
    const s = Math.sin(ph);
    poseIdle(a);
    a.hiF = -0.1 + 0.52 * s; a.knF = 0.15 + 0.5 * Math.max(0, Math.sin(ph + 2.6));
    a.hiB = 0.1 - 0.52 * s; a.knB = 0.15 + 0.5 * Math.max(0, Math.sin(ph + 2.6 + Math.PI));
    a.shF = 0.22 + 0.24 * Math.sin(ph + Math.PI); a.shB = -0.5 + 0.24 * s;
    a.elF = -0.3; a.elB = -0.4;
    a.torso = 0.02 + 0.045 * s; a.head = 0.03 * s;
  }
  function poseJump(a, t) {
    a.torso = t < 0.12 ? -0.1 : 0.06; a.head = 0.05;
    a.shF = -2.4; a.elF = -0.4;       /* 双臂上扬 */
    a.shB = -2.0; a.elB = -0.5;
    a.hiF = -0.9; a.knF = -1.25;      /* 提膝收腿 */
    a.hiB = -0.55; a.knB = -1.1;
  }
  function poseLiangxiang(a) {
    a.torso = -0.05; a.head = -0.07;
    a.shF = -2.55; a.elF = -0.35;     /* 前臂高举亮兵器 */
    a.shB = 0.55; a.elB = -0.65;      /* 后臂展袖 */
    a.hiF = -1.05; a.knF = -1.4;      /* 高抬腿 */
    a.hiB = 0.16; a.knB = 0.1;
  }
  function poseFight(a, ph) {
    a.shF = -2.5 + 1.7 * Math.max(0, Math.sin(ph)); a.elF = -0.3;
    a.shB = -0.4 + 0.5 * Math.sin(ph + 1.2); a.elB = -0.5;
    a.torso = 0.06 + 0.09 * Math.sin(ph * 1.7); a.head = 0.05;
    a.hiF = -0.3 + 0.35 * Math.sin(ph * 1.3); a.knF = 0.25;
    a.hiB = 0.3 - 0.35 * Math.sin(ph * 1.3); a.knB = 0.25;
  }
  function poseHurt(a) {
    a.torso = 0.12; a.head = 0.16;
    a.shF = -2.9; a.elF = -1.25;      /* 双手抱头 */
    a.shB = -2.7; a.elB = -1.05;
    a.hiF = -0.18; a.knF = 0.2; a.hiB = 0.2; a.knB = 0.2;
  }
  function poseFallen(a) {
    /* 跪地不起（保持剪影在画框内） */
    a.torso = -0.85; a.head = -0.25;
    a.shF = 0.7; a.elF = -0.55; a.shB = 0.45; a.elB = -0.4;
    a.hiF = -1.35; a.knF = -1.6;      /* 双膝跪地 */
    a.hiB = -1.3; a.knB = -1.55;
  }
  function poseSit(a) {
    a.torso = 0.14; a.head = 0.02;
    a.shF = 0.55; a.elF = -2.1;       /* 前臂收拢，手扶锡杖于胸前 */
    a.shB = -0.45; a.elB = -0.5;
    a.hiF = 1.5; a.knF = -2.95;       /* 双膝外展盘坐，足收于身下 */
    a.hiB = -1.5; a.knB = 2.95;
  }

  /* ---------- 创建皮影 ---------- */
  /* spec: { head, body, weapon, palette, name } */
  function create(spec, opts = {}) {
    const pal = Parts.palettes[spec.palette] || Parts.palettes.wukong;
    const p = {
      spec, pal,
      x: opts.x ?? 0, y: opts.y ?? 0,          /* 根(盆骨)世界坐标 */
      vx: 0, vy: 0,
      scale: opts.scale ?? 1.2,
      facing: 1,
      ground: opts.ground ?? 0,
      state: 'idle',                            /* idle|walk|jump|pose|fight|hurt|fallen|sit */
      actionTimer: 0,
      walkPhase: 0,
      targetX: null,
      moveSpeed: opts.moveSpeed ?? 90,
      opacity: 1, flash: 0,
      ang: { torso: 0, head: 0, shF: 0, elF: 0, shB: 0, elB: 0, hiF: 0, knF: 0, hiB: 0, knB: 0 },
      tgt: { torso: 0, head: 0, shF: 0, elF: 0, shB: 0, elB: 0, hiF: 0, knF: 0, hiB: 0, knB: 0 },
      weaponExtra: 0,
      landed: false,
    };
    poseIdle(p.tgt);
    return p;
  }

  function fromCharacter(key, opts) {
    return create(Parts.characters[key], opts);
  }

  /* ---------- 动作指令 ---------- */
  function jump(p, power = 300) {
    if (p.state === 'jump' || p.state === 'fallen') return;
    p.vy = -power; p.state = 'jump'; p.actionTimer = 0; p.landed = false;
  }
  function liangxiang(p, hold = 1.4) {
    if (p.state === 'fallen') return;
    p.state = 'pose'; p.actionTimer = hold;
  }
  function fight(p, dur = 1.0) {
    if (p.state === 'fallen') return;
    p.state = 'fight'; p.actionTimer = dur;
  }
  function hurt(p, dur = 1.6) {
    p.state = 'hurt'; p.actionTimer = dur;
  }
  function fall(p) {
    p.state = 'fallen'; p.actionTimer = 99; p.vy = Math.min(p.vy, -60);
  }
  function sit(p) { p.state = 'sit'; p.actionTimer = 0; }
  function walkTo(p, x) { p.targetX = x; }

  /* ---------- 更新 ---------- */
  function update(p, dt, t) {
    const movable = p.state === 'idle' || p.state === 'walk' || p.state === 'pose' || p.state === 'fight' || p.state === 'jump';
    if (p.targetX != null && movable && p.state !== 'fallen') {
      const dx = p.targetX - p.x;
      if (Math.abs(dx) > 3) {
        const dir = Math.sign(dx);
        p.vx += (dir * p.moveSpeed - p.vx) * Math.min(1, dt * 8);
        if (p.state !== 'jump' && p.state !== 'pose' && p.state !== 'fight' && p.state !== 'hurt' && p.state !== 'sit') p.state = 'walk';
        if (p.state === 'walk' || p.state === 'idle') p.facing = dir;
        p.walkPhase += dt * Math.min(11, Math.abs(p.vx) / 26);
      } else {
        p.vx *= Math.max(0, 1 - dt * 10);
        if (p.state === 'walk') {
          p.state = 'idle';
          if (p.onArrive) { const cb = p.onArrive; p.onArrive = null; cb(); }
        }
      }
    } else if (!movable && p.state !== 'fallen') {
      p.vx *= Math.max(0, 1 - dt * 10);
    }
    p.x += p.vx * dt;

    if (p.state === 'jump' || p.state === 'fallen') {
      p.actionTimer += dt;
      p.vy += 900 * dt;
      p.y += p.vy * dt;
      if (p.y >= p.ground) {
        p.y = p.ground; p.vy = 0;
        if (p.state === 'jump') {
          p.state = p.targetX != null && Math.abs(p.targetX - p.x) > 3 ? 'walk' : 'idle';
          p.landed = true; p.actionTimer = 0;
        }
      }
    } else if (p.state === 'sit') {
      /* 盘坐：髋部沉降到近地面，盘起的双腿贴地，而非悬在半空 */
      p.y += (p.ground + 120 - p.y) * Math.min(1, dt * 6);
    } else if (p.y !== p.ground) {
      /* 离开盘坐（或地面线变化）时，回升到站立高度 */
      p.y += (p.ground - p.y) * Math.min(1, dt * 6);
    }

    if (p.state === 'pose' || p.state === 'fight' || p.state === 'hurt') {
      p.actionTimer -= dt;
      if (p.actionTimer <= 0) p.state = p.targetX != null && Math.abs(p.targetX - p.x) > 3 ? 'walk' : 'idle';
    }

    const a = p.tgt;
    const tt = t + p.x * 0.01;            /* 各皮影相位错开 */
    switch (p.state) {
      case 'walk': poseWalk(a, p.walkPhase); break;
      case 'jump': poseJump(a, p.actionTimer); break;
      case 'pose': poseLiangxiang(a); break;
      case 'fight': poseFight(a, p.actionTimer * 14); break;
      case 'hurt': poseHurt(a); break;
      case 'fallen': poseFallen(a); break;
      case 'sit': poseSit(a); break;
      default: poseIdle(a);
    }
    if (p.state === 'idle') {
      a.torso += Math.sin(tt * 2) * 0.014;
      a.shF += Math.sin(tt * 2.3) * 0.02;
    }

    const k = Math.min(1, dt * 13);
    for (const j in p.ang) {
      p.ang[j] += (p.tgt[j] - p.ang[j]) * k;
      p.ang[j] += Math.sin(tt * 12 + j.length * 1.7) * 0.004;
    }
    /* 武器姿态补偿：亮相高举；唐僧九环锡杖平时竖直拄持（盘坐时由臂角自然竖直） */
    const wTarget = p.state === 'pose' ? 0.5 : (p.spec.weapon === 'xizhang' && p.state !== 'sit' ? -1.5 : 0);
    p.weaponExtra += (wTarget - p.weaponExtra) * Math.min(1, dt * 10);
    if (p.flash > 0) p.flash = Math.max(0, p.flash - dt * 3);
  }

  /* ---------- 离屏绘制 ---------- */
  /* root = 髋点：身体部件 pivot(45,8)、髋线(45,120) → 画身体时把髋线对准原点
     脚线（站立时 root 下方 110×S0）映射到世界坐标 p.y，保证脚踩地面线 */
  const OFF_W = 380, OFF_H = 680, OFF_CX = 190, OFF_CY = 500, OFF_FEET = 637.5, S0 = 1.25;

  function getOffscreen(p) {
    if (!p._off) {
      p._off = document.createElement('canvas');
      p._off.width = OFF_W; p._off.height = OFF_H;
      p._offg = p._off.getContext('2d');
    }
    return p._off;
  }

  /* 单部件绘制（亦供工坊缩略图使用）：pivot 对齐原点 */
  function drawPart(ctx, part, palette, opts = {}) {
    /* 敷彩提高透光感，让传统皮影的彩色皮片在灯幕上更易辨认。 */
    const alpha = opts.tintAlpha ?? 0.82;
    for (const seg of part.paths) {
      if (seg.f === 'sil') { ctx.fillStyle = S; ctx.fill(new Path2D(seg.d)); }
      else if (seg.f === 'hole') { ctx.fillStyle = Parts.HOLE; ctx.fill(new Path2D(seg.d)); }
      else if (seg.f === 't1' || seg.f === 't2' || seg.f === 't3') {
        const c = palette ? (palette[seg.f] || '#888') : '#888';
        ctx.globalAlpha = alpha;
        ctx.fillStyle = c; ctx.fill(new Path2D(seg.d));
        ctx.globalAlpha = 1;
      } else if (seg.f === 'line') {
        ctx.strokeStyle = Parts.HOLE;
        ctx.lineWidth = seg.sw ?? 1.4; ctx.lineCap = 'round';
        ctx.stroke(new Path2D(seg.d));
      }
    }
  }

  /* 画一个关节段：部件挂在 joint 世界点，朝 angle 方向 */
  function drawSegment(ctx, part, jx, jy, angle, pal, sc, tintAlpha) {
    ctx.save();
    ctx.translate(jx, jy);
    ctx.rotate(angle);
    ctx.scale(sc, sc);
    ctx.translate(-part.pivot[0], -part.pivot[1]);
    drawPart(ctx, part, pal, { tintAlpha });
    ctx.restore();
  }

  /* 整只皮影画到离屏 */
  function paintOffscreen(p) {
    const g = p._offg;
    g.clearRect(0, 0, OFF_W, OFF_H);
    g.save();
    g.translate(OFF_CX, OFF_CY);
    g.scale(p.facing * S0, S0);
    const sc = 1;
    const a = p.ang;
    const pal = p.pal;

    const cosT = Math.cos(a.torso), sinT = Math.sin(a.torso);
    const rp = (lx, ly) => [lx * cosT - ly * sinT, lx * sinT + ly * cosT];
    const [nx, ny] = rp(BODY.neck[0] - 45, BODY.neck[1] - 120);
    const [shFx, shFy] = rp(BODY.shF[0] - 45, BODY.shF[1] - 120);
    const [shBx, shBy] = rp(BODY.shB[0] - 45, BODY.shB[1] - 120);
    const [hiFx, hiFy] = rp(BODY.hiF[0] - 45, BODY.hiF[1] - 120);
    const [hiBx, hiBy] = rp(BODY.hiB[0] - 45, BODY.hiB[1] - 120);

    const arm = Parts.armStyles[Parts.headBodyMap[p.spec.head].arm];
    const leg = Parts.legStyles[Parts.headBodyMap[p.spec.head].leg];
    const weapon = Parts.weapons[p.spec.weapon];

    /* 计算肢端（肘/腕、膝/踝）：角度世界值 = torso + 相对角 */
    const limbEnd = (jx, jy, a1, len1, a2, len2) => {
      const a1w = a.torso + a1, a2w = a.torso + a1 + a2;
      const ex = jx + Math.sin(a1w) * len1, ey = jy + Math.cos(a1w) * len1;
      return [ex, ey, ex + Math.sin(a2w) * len2, ey + Math.cos(a2w) * len2, a2w];
    };
    const [elFx, elFy, wrFx, wrFy, wAF] = limbEnd(shFx, shFy, a.shF, SEG.upper, a.elF, SEG.fore);
    const [elBx, elBy, wrBx, wrBy] = limbEnd(shBx, shBy, a.shB, SEG.upper, a.elB, SEG.fore);
    const [knFx, knFy, anFx, anFy] = limbEnd(hiFx, hiFy, a.hiF, SEG.thigh, a.knF, SEG.shin);
    const [knBx, knBy, anBx, anBy] = limbEnd(hiBx, hiBy, a.hiB, SEG.thigh, a.knB, SEG.shin);

    const body = Parts.bodies[p.spec.body];
    const head = Parts.heads[p.spec.head];

    const order = p.facing > 0
      ? ['legB', 'armB', 'body', 'legF', 'armF']
      : ['legF', 'armF', 'body', 'legB', 'armB'];

    const drawArm = (side) => {
      const isF = side === 'armF';
      const sx = isF ? shFx : shBx, sy = isF ? shFy : shBy;
      const ex = isF ? elFx : elBx, ey = isF ? elFy : elBy;
      const wx = isF ? wrFx : wrBx, wy = isF ? wrFy : wrBy;
      const shA = a.torso + (isF ? a.shF : a.shB);
      const elA = shA + (isF ? a.elF : a.elB);
      /* 肢体部件取反角绘制：关节链方向为 (sin a, cos a)，
         而画布 rotate(+a) 使部件长轴指向 (-sin a, cos a)，
         取反后部件与关节链对齐，避免大角度姿态下皮影「关节脱位」 */
      drawSegment(g, arm.upper, sx, sy, -shA, pal, sc);
      drawSegment(g, arm.fore, ex, ey, -elA, pal, sc);
      drawSegment(g, arm.hand, wx, wy, -elA, pal, sc);
      if (isF && weapon) {
        const wAngle = wAF + Math.PI / 2 + p.weaponExtra;
        drawSegment(g, weapon, wx, wy, wAngle, pal, sc);
      }
    };
    const drawLeg = (side) => {
      const isF = side === 'legF';
      const hx = isF ? hiFx : hiBx, hy = isF ? hiFy : hiBy;
      const kx = isF ? knFx : knBx, ky = isF ? knFy : knBy;
      const ax = isF ? anFx : anBx, ay = isF ? anFy : anBy;
      const hiA = a.torso + (isF ? a.hiF : a.hiB);
      const knA = hiA + (isF ? a.knF : a.knB);
      drawSegment(g, leg.thigh, hx, hy, -hiA, pal, sc);
      drawSegment(g, leg.shin, kx, ky, -knA, pal, sc);
      drawSegment(g, leg.foot, ax, ay, -knA, pal, sc);
    };
    const drawBody = () => {
      /* 身体部件以髋线(45,120)对齐原点，绕髋点旋转 */
      g.save();
      g.rotate(a.torso);
      g.scale(sc, sc);
      g.translate(-45, -120);
      drawPart(g, body, pal, {});
      g.restore();
      drawSegment(g, head, nx, ny, a.torso + a.head, pal, sc);
    };

    for (const o of order) {
      if (o === 'armF' || o === 'armB') drawArm(o);
      else if (o === 'legF' || o === 'legB') drawLeg(o);
      else drawBody();
    }
    g.restore();
  }

  /* 复合到舞台画布 */
  function render(ctx, p, opts = {}) {
    if (p.opacity <= 0.01) return;
    const off = getOffscreen(p);
    paintOffscreen(p);
    const zoom = p.scale / S0;
    const w = OFF_W * zoom, h = OFF_H * zoom;
    const dx = p.x - OFF_CX * zoom, dy = p.y - OFF_FEET * zoom;
    ctx.save();
    ctx.globalAlpha = p.opacity;
    /* 地面投影 */
    if (p.state !== 'fallen') {
      const shScale = Math.max(0.35, 1 - (p.y - p.ground) / 260);
      ctx.save();
      ctx.globalAlpha = 0.26 * p.opacity;
      ctx.fillStyle = '#241812';
      const shW = 92 * zoom * shScale, shH = 24 * zoom * shScale;
      const shX = p.x - shW / 2, shY = p.ground - shH / 2;
      ctx.beginPath();
      ctx.ellipse(shX + shW / 2, shY + shH / 2, shW / 2, shH / 2, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    /* 偏移暗影 */
    ctx.save();
    ctx.filter = 'blur(5px)';
    ctx.globalAlpha = 0.4 * p.opacity;
    ctx.drawImage(off, dx + 7 * zoom, dy + 10 * zoom, w, h);
    ctx.restore();
    /* 本体 */
    ctx.drawImage(off, dx, dy, w, h);
    /* 受击 / 变身闪光 */
    if (p.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = p.flash * 0.5;
      ctx.fillStyle = '#ffd27d';
      ctx.fillRect(dx, dy, w, h);
      ctx.restore();
    }
    ctx.restore();
  }

  /* 将一只已存在的皮影（离屏）适配渲染到任意画布（持续动画用） */
  function renderToFit(canvas, p) {
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, canvas.width, canvas.height);
    getOffscreen(p);
    paintOffscreen(p);
    const fit = Math.min((canvas.width - 24) / OFF_W, (canvas.height - 16) / OFF_H);
    const w = OFF_W * fit, h = OFF_H * fit;
    g.drawImage(p._off, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  }

  /* 静态渲染（首页装饰 / 工坊缩略图）：自动适配画布 */
  function renderStatic(canvas, spec, state = 'idle', t = 0) {
    const p = create(spec, {});
    p.state = state;
    if (state === 'walk') poseWalk(p.tgt, t);
    else if (state === 'pose') poseLiangxiang(p.tgt);
    else if (state === 'sit') poseSit(p.tgt);
    else if (state === 'jump') poseJump(p.tgt, 0.2);
    else if (state === 'fallen') poseFallen(p.tgt);
    for (const j in p.ang) p.ang[j] = p.tgt[j];
    renderToFit(canvas, p);
  }

  return {
    create, fromCharacter,
    jump, liangxiang, fight, hurt, fall, sit, walkTo, update,
    render, drawPart, renderStatic, renderToFit,
    OFF_W, OFF_H, OFF_CX, OFF_CY,
  };
})();
