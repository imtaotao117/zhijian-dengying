/* ============================================================
   stage.js —— 舞台渲染引擎
   · 灯影光效：暖黄灯晕 + 明暗闪烁（油灯光质）
   · 场景剪影：远山 / 村舍 / 林木，剪纸风格
   · 特效粒子：烟雾 / 尘土 / 火花 / 金睛光轮 / 紧箍金环
   · 皮影管理：添加 / 移除 / 更新 / 渲染
   ============================================================ */
window.Stage = (() => {
  const TAU = Math.PI * 2;

  /* ---------- 场景剪影（剪纸风远山/村舍） ---------- */
  const SCENES = {
    plain: {
      hills: [[0.55, 90], [0.75, 64]],
      extras: [],
    },
    mountain: {
      hills: [[0.5, 130], [0.68, 96], [0.84, 118]],
      extras: ['pine', 'pine'],
    },
    village: {
      hills: [[0.6, 78]],
      extras: ['house', 'house', 'fence'],
    },
    forest: {
      hills: [[0.55, 100], [0.72, 76]],
      extras: ['pine', 'pine', 'pine', 'house'],
    },
    heaven: {
      hills: [[0.45, 70], [0.75, 55]],
      extras: ['cloudpuff', 'palace', 'cloudpuff'],
    },
    sea: {
      hills: [],
      extras: ['wave', 'wave', 'bubble'],
    },
    palace: {
      hills: [[0.5, 55], [0.75, 40]],
      extras: ['bubble', 'palace', 'bubble'],
    },
  };

  function create(canvas) {
    const s = {
      canvas, ctx: canvas.getContext('2d'),
      puppets: [], fxs: [],
      scene: 'plain',
      t: 0, active: true,
      groundY: 0, w: 0, h: 0, dpr: 1,
      grain: null,
      clouds: [],
      cursor: null,          /* 手势光标 {x,y} */
    };
    resize(s);
    makeGrain(s);
    makeClouds(s);
    return s;
  }

  function resize(s) {
    const r = s.canvas.getBoundingClientRect();
    s.dpr = Math.min(2, window.devicePixelRatio || 1);
    s.w = Math.max(1, r.width); s.h = Math.max(1, r.height);
    s.canvas.width = Math.round(s.w * s.dpr);
    s.canvas.height = Math.round(s.h * s.dpr);
    s.groundY = s.h * 0.8;
    for (const e of s.puppets) e.puppet.ground = s.groundY;
  }

  /* 宣纸颗粒底纹（离屏预渲染） */
  function makeGrain(s) {
    const c = document.createElement('canvas');
    c.width = 220; c.height = 220;
    const g = c.getContext('2d');
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(74,56,44,${0.02 + Math.random() * 0.05})`;
      g.fillRect(Math.random() * 220, Math.random() * 220, 1.2, 1.2);
    }
    s.grain = c;
  }

  function makeClouds(s) {
    s.clouds = [];
    for (let i = 0; i < 4; i++) {
      s.clouds.push({ x: Math.random() * 1.2, y: 0.12 + Math.random() * 0.3, sp: 0.006 + Math.random() * 0.012, sc: 0.7 + Math.random() * 0.9 });
    }
  }

  /* ---------- 皮影管理 ---------- */
  function addPuppet(s, p) {
    p.ground = s.groundY;
    p.y = p.ground;              /* 脚线落在地面线上 */
    s.puppets.push({ puppet: p });
    return p;
  }
  function addCharacter(s, key, opts = {}) {
    return addPuppet(s, window.Puppet.fromCharacter(key, opts));
  }
  function clearPuppets(s) {
    s.puppets.length = 0; s.fxs.length = 0;
  }
  function setScene(s, key) { s.scene = SCENES[key] ? key : 'plain'; }

  /* ---------- 特效 ---------- */
  function spawn(s, o) { s.fxs.push(Object.assign({ life: 1, maxLife: 1, type: 'dot' }, o)); }

  function fxSmoke(s, x, y, n = 14, color = '#d9c9ac') {
    for (let i = 0; i < n; i++) {
      spawn(s, {
        type: 'smoke', x: x + (Math.random() - 0.5) * 40, y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 40,
        size: 14 + Math.random() * 26, maxLife: 1.4 + Math.random() * 1.2, color,
      });
    }
  }
  function fxDust(s, x, y, n = 10) {
    for (let i = 0; i < n; i++) {
      spawn(s, {
        type: 'dust', x: x + (Math.random() - 0.5) * 26, y: y - Math.random() * 6,
        vx: (Math.random() - 0.5) * 130, vy: -30 - Math.random() * 60,
        size: 3 + Math.random() * 5, maxLife: 0.5 + Math.random() * 0.5, color: '#8a6a3a',
      });
    }
  }
  function fxSparks(s, x, y, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = 60 + Math.random() * 220;
      spawn(s, {
        type: 'spark', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        size: 2 + Math.random() * 3, maxLife: 0.5 + Math.random() * 0.6, color: '#ffd27d',
      });
    }
  }
  /* 火眼金睛：旋转金轮光 */
  function fxRays(s, x, y, dur = 1.6) {
    s.fxs.push({ type: 'rays', x, y, life: dur, maxLife: dur, t: 0 });
  }
  /* 紧箍金环 */
  function fxRing(s, x, y, dur = 1.8) {
    s.fxs.push({ type: 'ring', x, y, life: dur, maxLife: dur, t: 0 });
  }
  /* 白骨磷火（现形） */
  function fxGhost(s, x, y, dur = 2.2) {
    s.fxs.push({ type: 'ghost', x, y, life: dur, maxLife: dur, t: 0 });
  }
  /* 骷髅印记（白骨现形） */
  function fxSkull(s, x, y, dur = 2.6) {
    s.fxs.push({ type: 'skull', x, y, life: dur, maxLife: dur, t: 0 });
  }
  /* 全屏闪白（打杀瞬间） */
  function fxFlash(s, power = 0.5) {
    s.fxs.push({ type: 'flash', life: 0.32, maxLife: 0.32, power });
  }

  /* ---------- 场景绘制 ---------- */
  function drawScene(s) {
    const { ctx, w, h, groundY } = s;
    const sc = SCENES[s.scene];

    /* 云 */
    for (const c of s.clouds) {
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = '#fffdf4';
      ctx.translate(c.x * w, c.y * h);
      ctx.scale(c.sc, c.sc);
      ctx.beginPath();
      ctx.arc(0, 0, 46, 0, TAU); ctx.arc(40, -12, 30, 0, TAU); ctx.arc(-38, -6, 26, 0, TAU);
      ctx.arc(6, 8, 36, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    /* 远山剪影 */
    let acc = 0.06;
    ctx.save();
    ctx.fillStyle = 'rgba(107,74,46,0.5)';
    for (const [px, ph] of sc.hills) {
      const base = groundY + 6;
      const wd = w * px;
      const hgt = ph * (h / 500);
      ctx.beginPath();
      ctx.moveTo(acc * w, base);
      ctx.quadraticCurveTo((acc * w + wd) / 2, base - hgt, acc * w + wd, base);
      ctx.lineTo(acc * w + wd, h);
      ctx.lineTo(acc * w, h);
      ctx.closePath();
      ctx.fill();
      acc += 0.42;
    }
    ctx.restore();

    /* 村舍 / 松林 / 宫阙 / 祥云（剪纸点缀） */
    ctx.save();
    ctx.fillStyle = 'rgba(107,74,46,0.55)';
    sc.extras.forEach((e, i) => {
      const ex = (0.14 + sc.extras.indexOf(e) * 0.22) * w + (e === 'pine' ? (sc.extras.indexOf(e) * 37) % 40 : 0);
      const by = groundY + 4;
      if (e === 'pine') {
        for (let j = 0; j < 3; j++) {
          const pw = 26 - j * 6;
          ctx.beginPath();
          ctx.moveTo(ex - pw, by - j * 22);
          ctx.lineTo(ex, by - j * 22 - 34);
          ctx.lineTo(ex + pw, by - j * 22);
          ctx.closePath();
          ctx.fill();
        }
      } else if (e === 'house') {
        ctx.fillRect(ex - 34, by - 44, 68, 44);
        ctx.beginPath();
        ctx.moveTo(ex - 44, by - 44); ctx.lineTo(ex, by - 78); ctx.lineTo(ex + 44, by - 44);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,221,166,0.85)';
        ctx.fillRect(ex - 12, by - 30, 24, 30);
        ctx.fillStyle = 'rgba(107,74,46,0.55)';
      } else if (e === 'fence') {
        for (let j = 0; j < 5; j++) {
          ctx.fillRect(ex + j * 22, by - 26, 5, 26);
        }
        ctx.fillRect(ex - 4, by - 22, 104, 4);
        ctx.fillRect(ex - 4, by - 14, 104, 4);
      } else if (e === 'cloudpuff') {
        /* 祥云：暖白剪影，高低错落 */
        const clx = (0.16 + i * 0.34) * w;
        const cly = groundY - 26 - (i % 2) * 34;
        ctx.fillStyle = 'rgba(255,240,204,0.7)';
        ctx.beginPath();
        ctx.arc(clx, cly, 30, 0, TAU);
        ctx.arc(clx + 30, cly + 4, 20, 0, TAU);
        ctx.arc(clx - 30, cly + 8, 16, 0, TAU);
        ctx.arc(clx + 52, cly + 14, 11, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(107,74,46,0.55)';
      } else if (e === 'wave') {
        /* 水波：剪纸式层叠浪花（东海） */
        const wy = groundY + 2;
        ctx.fillStyle = 'rgba(64,116,132,0.55)';
        for (let row = 0; row < 3; row++) {
          const yy = wy - row * 11;
          ctx.beginPath();
          ctx.moveTo(0, yy + 14);
          for (let k = 0; k <= 16; k++) {
            const wx = (k / 16) * w;
            const amp = 8 + (k % 3) * 3;
            ctx.quadraticCurveTo(wx - w / 32, yy - amp, wx, yy);
          }
          ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = 'rgba(107,74,46,0.55)';
      } else if (e === 'bubble') {
        /* 气泡：自海底升起的小圆（龙宫） */
        for (let k = 0; k < 6; k++) {
          const bx = (0.08 + k * 0.19) * w + (s.t * 14 + k * 37) % (0.2 * w);
          const by = groundY - 12 - (s.t * 34 + k * 61) % (groundY * 0.8);
          ctx.globalAlpha = 0.45;
          ctx.strokeStyle = 'rgba(140,200,214,0.8)';
          ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(bx, by, 3.5 + (k % 3) * 1.8, 0, TAU); ctx.stroke();
          ctx.globalAlpha = 1;
        }
      } else if (e === 'palace') {
        /* 凌霄殿剪影：台基 + 殿身 + 飞檐翘角 */
        const pxx = w * 0.5;
        ctx.fillRect(pxx - 58, by - 14, 116, 14);          /* 台基 */
        ctx.fillRect(pxx - 36, by - 56, 72, 42);           /* 殿身 */
        ctx.fillStyle = 'rgba(255,221,166,0.85)';
        ctx.fillRect(pxx - 10, by - 46, 20, 32);           /* 门洞透光 */
        ctx.fillStyle = 'rgba(107,74,46,0.55)';
        ctx.beginPath();                                   /* 大殿顶（含飞檐翘角） */
        ctx.moveTo(pxx - 58, by - 56);
        ctx.quadraticCurveTo(pxx - 78, by - 50, pxx - 80, by - 42);
        ctx.quadraticCurveTo(pxx - 66, by - 54, pxx - 50, by - 54);
        ctx.quadraticCurveTo(pxx, by - 88, pxx + 50, by - 54);
        ctx.quadraticCurveTo(pxx + 66, by - 54, pxx + 80, by - 42);
        ctx.quadraticCurveTo(pxx + 78, by - 50, pxx + 58, by - 56);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();                                   /* 宝顶 */
        ctx.arc(pxx, by - 73, 4, 0, TAU);
        ctx.fill();
        ctx.fillRect(pxx - 2, by - 76, 4, 9);
        ctx.beginPath();                                   /* 檐角脊兽 */
        ctx.arc(pxx - 80, by - 44, 2.5, 0, TAU);
        ctx.arc(pxx + 80, by - 44, 2.5, 0, TAU);
        ctx.fill();
      }
    });
    ctx.restore();

    /* 台口地面 */
    const grad = ctx.createLinearGradient(0, groundY, 0, h);
    grad.addColorStop(0, 'rgba(140,96,52,0.3)');
    grad.addColorStop(1, 'rgba(140,96,52,0.06)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, groundY, w, h - groundY);
    ctx.strokeStyle = 'rgba(140,96,52,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(w, groundY); ctx.stroke();
  }

  /* ---------- 挂灯 ---------- */
  function drawLanterns(s) {
    const { ctx, w, t } = s;
    for (const lx of [0.13, 0.87]) {
      const x = lx * w;
      const sway = Math.sin(t * 1.1 + lx * 9) * 5;
      const yTop = -6, yLan = 40 + Math.sin(t * 2.2) * 2;
      ctx.save();
      ctx.translate(x + sway, 0);
      /* 线 */
      ctx.strokeStyle = 'rgba(74,42,24,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, yTop); ctx.lineTo(0, yLan); ctx.stroke();
      /* 灯体 */
      const g = ctx.createRadialGradient(0, yLan + 16, 4, 0, yLan + 16, 46);
      g.addColorStop(0, 'rgba(255,190,90,0.55)');
      g.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, yLan + 16, 46, 0, TAU); ctx.fill();
      ctx.fillStyle = '#a83026';
      ctx.beginPath();
      ctx.ellipse(0, yLan + 16, 15, 17, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d1453a';
      ctx.beginPath();
      ctx.ellipse(0, yLan + 16, 11, 13, 0, 0, TAU); ctx.fill();
      /* 穗 */
      ctx.strokeStyle = '#b0302a';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, yLan + 34); ctx.lineTo(0, yLan + 46); ctx.stroke();
      ctx.restore();
    }
  }

  /* ---------- 特效更新与绘制 ---------- */
  function updateFxs(s, dt) {
    const { fxs } = s;
    for (let i = fxs.length - 1; i >= 0; i--) {
      const f = fxs[i];
      f.life -= dt;
      f.t = (f.t || 0) + dt;
      if (f.type === 'smoke' || f.type === 'dust' || f.type === 'spark') {
        f.x += f.vx * dt; f.y += f.vy * dt;
        if (f.type === 'dust' || f.type === 'spark') f.vy += 320 * dt;
      }
      if (f.life <= 0) fxs.splice(i, 1);
    }
  }

  function drawFxs(s) {
    const { ctx } = s;
    for (const f of s.fxs) {
      const a = Math.max(0, Math.min(1, f.life / f.maxLife));
      ctx.save();
      if (f.type === 'smoke') {
        ctx.globalAlpha = a * 0.4;
        ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.size * (1.6 - a * 0.6), 0, TAU); ctx.fill();
      } else if (f.type === 'dust') {
        ctx.globalAlpha = a * 0.7;
        ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.size, 0, TAU); ctx.fill();
      } else if (f.type === 'spark') {
        ctx.globalAlpha = a;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.size, 0, TAU); ctx.fill();
      } else if (f.type === 'rays') {
        /* 火眼金睛：旋转金轮 */
        const prog = f.t / f.maxLife;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.sin(Math.min(1, prog) * Math.PI) * 0.85;
        ctx.translate(f.x, f.y);
        ctx.rotate(f.t * 3.4);
        ctx.fillStyle = '#ffce6e';
        for (let i = 0; i < 8; i++) {
          ctx.rotate(Math.PI / 4);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(30, -8 + Math.sin(f.t * 9) * 5);
          ctx.lineTo(58 + prog * 30, 0);
          ctx.lineTo(30, 8 + Math.sin(f.t * 9) * 5);
          ctx.closePath(); ctx.fill();
        }
      } else if (f.type === 'ring') {
        const prog = f.t / f.maxLife;
        ctx.globalAlpha = (1 - prog) * 0.9;
        ctx.strokeStyle = '#ffce6e';
        ctx.lineWidth = 4 * (1 - prog * 0.5);
        ctx.beginPath(); ctx.arc(f.x, f.y, 14 + prog * 90, 0, TAU); ctx.stroke();
      } else if (f.type === 'ghost') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * 0.75;
        ctx.fillStyle = '#bfe6ff';
        ctx.beginPath();
        ctx.moveTo(f.x, f.y - 34 - Math.sin(f.t * 7) * 8);
        ctx.quadraticCurveTo(f.x + 24, f.y - 16, f.x, f.y + 4 + Math.sin(f.t * 7) * 6);
        ctx.quadraticCurveTo(f.x - 24, f.y - 16, f.x, f.y - 34 - Math.sin(f.t * 7) * 8);
        ctx.fill();
      } else if (f.type === 'skull') {
        const prog = Math.min(1, f.t / f.maxLife);
        ctx.globalAlpha = Math.sin(prog * Math.PI) * 0.9;
        ctx.fillStyle = '#e8e2d2';
        ctx.beginPath(); ctx.arc(f.x, f.y, 26, 0, TAU); ctx.fill();
        ctx.fillRect(f.x - 20, f.y - 2, 40, 26);
        ctx.fillStyle = '#241812';
        ctx.beginPath(); ctx.arc(f.x - 9, f.y - 4, 5, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(f.x + 9, f.y - 4, 5, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(f.x - 4, f.y + 12); ctx.lineTo(f.x + 4, f.y + 12); ctx.stroke();
      } else if (f.type === 'flash') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * f.power;
        ctx.fillStyle = '#fff6dd';
        ctx.fillRect(0, 0, s.w, s.h);
      }
      ctx.restore();
    }
  }

  /* ---------- 主循环 ---------- */
  function loop(s) {
    if (!s.active) { s.raf = requestAnimationFrame(() => loop(s)); return; }
    const dt = Math.min(0.05, 1 / 60);
    s.t += dt;
    const { ctx, w, h } = s;

    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    /* 背景灯影（油灯闪烁） */
    const flick = 0.82 + Math.sin(s.t * 3.1) * 0.05 + Math.sin(s.t * 7.7) * 0.04 + Math.sin(s.t * 13.3) * 0.02;
    const bg = ctx.createRadialGradient(w / 2, h * 0.66, 40, w / 2, h * 0.66, Math.max(w, h) * 0.72);
    bg.addColorStop(0, `rgba(255,200,110,${0.5 * flick})`);
    bg.addColorStop(0.55, `rgba(255,190,110,${0.22 * flick})`);
    bg.addColorStop(1, 'rgba(180,130,60,0.05)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    drawScene(s);
    drawLanterns(s);

    /* 皮影 */
    for (const e of s.puppets) {
      window.Puppet.update(e.puppet, dt, s.t);
      window.Puppet.render(ctx, e.puppet);
      /* 选中标记：被鼠标/键盘操控的皮影头顶悬金色小箭头 */
      if (e.marker) {
        const p = e.puppet;
        const my = p.y - 314 * p.scale - 6 + Math.sin(s.t * 4) * 4;
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#ffce6e';
        ctx.strokeStyle = 'rgba(120,70,20,.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, my);
        ctx.lineTo(p.x - 8, my - 14);
        ctx.lineTo(p.x + 8, my - 14);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }

    updateFxs(s, dt);
    drawFxs(s);

    /* 手势光标 */
    if (s.cursor) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#ffbe5e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.cursor.x, s.cursor.y, 15 + Math.sin(s.t * 6) * 4, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#ffce6e';
      ctx.beginPath();
      ctx.arc(s.cursor.x, s.cursor.y, 9, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    /* 宣纸颗粒 */
    if (s.grain) {
      ctx.globalAlpha = 0.5;
      for (let gx = 0; gx < w; gx += 220)
        for (let gy = 0; gy < h; gy += 220)
          ctx.drawImage(s.grain, gx, gy);
      ctx.globalAlpha = 1;
    }

    /* 边缘暗角 */
    const vg = ctx.createRadialGradient(w / 2, h * 0.6, Math.min(w, h) * 0.4, w / 2, h * 0.6, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(60,30,10,0.22)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    s.raf = requestAnimationFrame(() => loop(s));
  }

  function start(s) { if (!s.raf) loop(s); }
  function setActive(s, on) {
    s.active = on;
    if (on && !s.raf) loop(s);
  }

  return {
    create, resize, start, setActive,
    addPuppet, addCharacter, clearPuppets, setScene,
    fxSmoke, fxDust, fxSparks, fxRays, fxRing, fxGhost, fxSkull, fxFlash,
  };
})();
