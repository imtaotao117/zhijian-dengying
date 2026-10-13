/* ============================================================
   audio.js —— 纯代码合成音效（零素材、零版权风险）
   · 锣 / 钹 / 鼓 / 板 —— 锣鼓经语汇
   · 五声音阶拨弦背景乐（板胡风）
   · 全部由 WebAudio 实时合成，无需任何音频文件
   ============================================================ */
window.AudioFx = (() => {
  let ctx = null, master = null, bgGain = null, bgTimer = null;
  let enabled = true;
  let bgStep = 0;

  /* 惰性初始化（须在用户手势后调用） */
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    bgGain = ctx.createGain();
    bgGain.gain.value = 0.16;
    bgGain.connect(master);
  }

  function noiseBuffer(dur) {
    const n = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /* ---- 锣：多分音金属体 + 噪声起振，长衰减 ---- */
  function gong(freq = 160, dur = 2.6, gain = 0.5) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(gain, t0);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    out.connect(master);
    /* 非谐分音群 */
    [1, 1.42, 2.02, 2.71, 3.43].forEach((r, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * r;
      o.detune.value = (i - 2) * 4;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.22 / (i + 1), t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * (1 - i * 0.12));
      o.connect(g); g.connect(out);
      o.start(t0); o.stop(t0 + dur);
    });
    /* 击打噪声 */
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.3);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = freq * 5; bp.Q.value = 1.2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.5, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
    src.connect(bp); bp.connect(ng); ng.connect(out);
    src.start(t0);
  }

  /* ---- 小锣（高音锣，拍板用） ---- */
  function smallGong(gain = 0.4) { gong(340, 1.1, gain); }

  /* ---- 钹 / 镲：高频噪声炸 ---- */
  function cymbal(gain = 0.35) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.6);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 5200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
    src.connect(hp); hp.connect(g); g.connect(master);
    src.start(t0);
  }

  /* ---- 堂鼓：低频冲击 ---- */
  function drum(gain = 0.55, freq = 92) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 1.7, t0);
    o.frequency.exponentialRampToValueAtTime(freq, t0 + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.12);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 400;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(gain * 0.8, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
    o.connect(g); g.connect(master);
    src.connect(lp); lp.connect(ng); ng.connect(master);
    o.start(t0); o.stop(t0 + 0.5);
    src.start(t0);
  }

  /* ---- 板：清脆木鱼板声（拍板 cue） ---- */
  function woodblock(gain = 0.5) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(760, t0);
    o.frequency.exponentialRampToValueAtTime(520, t0 + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + 0.15);
  }

  /* ---- 拨弦（板胡/三弦风，Karplus-Strong） ---- */
  function pluck(freq, gain = 0.22, dur = 0.9) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const n = Math.floor(ctx.sampleRate / freq);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 1 / freq;
    const fb = ctx.createGain();
    fb.gain.value = 0.55;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = freq * 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay);
    lp.connect(g); g.connect(master);
    src.start(t0);
  }

  /* ---- 锣鼓经节奏型 ---- */
  const PATTERNS = {
    /* 慢长锤：鼓-鼓-锣 */
    slow: () => { drum(0.4); setTimeout(() => drum(0.4), 300); setTimeout(() => gong(150, 2, 0.4), 620); },
    /* 急急风：锣钹交替 */
    fast: () => {
      for (let i = 0; i < 6; i++) {
        setTimeout(() => { i % 2 ? cymbal(0.28) : smallGong(0.3); drum(0.22); }, i * 130);
      }
    },
    /* 亮相点：鼓+锣+钹齐鸣 */
    pose: () => { drum(0.6); gong(170, 2.4, 0.5); setTimeout(() => cymbal(0.4), 40); },
    /* 拍板：板+小锣 */
    clap: () => { woodblock(0.55); setTimeout(() => smallGong(0.32), 90); },
    /* 打斗：急急风短打 */
    fight: () => {
      for (let i = 0; i < 10; i++) {
        setTimeout(() => { cymbal(0.2); drum(0.3, 120); }, i * 90);
      }
      setTimeout(() => gong(150, 1.6, 0.45), 950);
    },
  };
  function pattern(name) { if (!ctx || !enabled) return; init(); PATTERNS[name] && PATTERNS[name](); }

  /* ---- 五声音阶背景乐（宫商角徵羽） ---- */
  const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0];   /* C D E G A */
  const SCALE_LOW = [130.81, 146.83, 164.81, 196.0, 220.0];
  const MELODY = [0, 2, 3, 2, 1, 3, 4, 3, 2, 0, 2, 3, 2, 1, 2, 0];  /* 16 步循环，慢板民歌风 */

  function startBg() {
    if (!ctx || bgTimer) return;
    bgStep = 0;
    const tick = () => {
      if (!ctx) return;
      if (enabled) {
        const m = MELODY[bgStep % MELODY.length];
        const f = SCALE[m];
        pluck(f, 0.16, 1.1);
        /* 低音宫羽陪衬 */
        if (bgStep % 4 === 0) pluck(SCALE_LOW[bgStep % 8 === 0 ? 0 : 4], 0.2, 1.6);
        /* 每 4 步轻鼓点 */
        if (bgStep % 8 === 4) drum(0.1, 110);
      }
      bgStep++;
    };
    tick();
    bgTimer = setInterval(tick, 620);
  }
  function stopBg() {
    if (bgTimer) { clearInterval(bgTimer); bgTimer = null; }
  }

  function setEnabled(on) {
    enabled = on;
    if (master) master.gain.value = on ? 0.9 : 0;
  }
  function isEnabled() { return enabled; }

  /* 确保有用户手势后启动 */
  function unlock() {
    init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    if (enabled) startBg();
  }

  return {
    unlock, init, setEnabled, isEnabled,
    gong, smallGong, cymbal, drum, woodblock, pluck,
    pattern, startBg, stopBg,
  };
})();
