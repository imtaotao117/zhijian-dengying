/* ============================================================
   drama.js —— 经典剧目剧情引擎（剧目目录：多出戏）
   · 引导式剧目体验：字幕解说 + 锣鼓板眼
   · 关键节点「拍板」交互（手势伸一指 / 点击 / 空格）
   · 白骨精三次变化 = 部件库换头茬换敷彩，演示"部件化"理念
   · 剧目目录 DRAMAS：进入「经典剧目」先选戏再看
   ============================================================ */
window.Drama = (() => {
  const Parts = window.Parts;
  const Stage = window.Stage;
  const Puppet = window.Puppet;
  const AudioFx = window.AudioFx;
  const Input = window.Input;

  let stage = null;
  let session = null;          /* { timers, offs, puppets } */
  let beats = [];
  let idx = 0;
  let current = null;          /* 当前剧目（DRAMAS 中的一项） */
  let demoMode = window.ProjectConfig?.demo?.enabledByDefault !== false;
  const DEMO_SCALE = window.ProjectConfig?.demo?.timeScale || 0.4;

  /* ---------- DOM ---------- */
  const el = () => ({
    hud: document.getElementById('drama-hud'),
    title: document.getElementById('drama-title'),
    sub: document.getElementById('drama-sub'),
    cue: document.getElementById('drama-cue'),
  });

  /* ---------- 小工具 ---------- */
  const W = () => stage.w;
  const px = n => stage.w * n;
  function headPos(p) { return { x: p.x, y: p.y - 280 * p.scale }; }

  function later(ms, fn) {
    const scaled = demoMode ? Math.max(80, ms * DEMO_SCALE) : ms;
    const id = setTimeout(fn, scaled);
    session.timers.push(id);
    return id;
  }

  function setSub({ text = '', who = '', narr = false } = {}) {
    const e = el();
    if (!text) { e.sub.innerHTML = ''; e.sub.style.display = 'none'; return; }
    e.sub.style.display = 'block';
    e.sub.classList.toggle('narr', narr);
    e.sub.innerHTML = (who ? `<span class="who">${who}</span>` : '') + text;
  }
  function showTitle(text, dur = 2600) {
    const e = el();
    e.title.textContent = text;
    e.title.style.display = 'block';
    later(dur, () => { e.title.style.display = 'none'; });
  }
  function showCue(text) {
    const e = el();
    e.cue.innerHTML = `🪧 ${text} <small style="font-size:15px">（伸一指 / 点击 / 空格）</small>`;
    e.cue.style.display = 'block';
  }
  function hideCue() { el().cue.style.display = 'none'; }

  /* ---------- 角色进出与动作 ---------- */
  function enter(key, fromX, toX, scale = 1.12) {
    const p = Stage.addCharacter(stage, key, { x: px(fromX), scale, moveSpeed: demoMode ? 220 : 110 });
    p.targetX = px(toX);
    return p;
  }
  function exit(p, dir) {
    p.targetX = p.x + dir * px(0.55);
    later(4200, () => { stage.puppets.splice(stage.puppets.findIndex(e => e.puppet === p), 1); });
  }
  function transform(p, toKey) {
    const h = headPos(p);
    Stage.fxSmoke(stage, h.x, h.y + 90, 18);
    Stage.fxGhost(stage, h.x, h.y, 1.6);
    const spec = Parts.characters[toKey];
    p.spec = spec;
    p.pal = Parts.palettes[spec.palette];
    p.flash = 1.2;
    AudioFx.pattern('clap');
  }
  function strike(attacker, victim, opts = {}) {
    /* 攻击者挥械、受击者倒地；不可让受击者先播放攻击动作。 */
    if (!attacker || !victim) return;
    attacker.facing = Math.sign(victim.x - attacker.x) || attacker.facing;
    victim.facing = -attacker.facing;
    Puppet.fight(attacker, 1.1);
    AudioFx.pattern('fight');
    later(180, () => Stage.fxSparks(stage, (attacker.x + victim.x) / 2, victim.y - 70, 14));
    later(220, () => Stage.fxFlash(stage, opts.big ? 0.85 : 0.55));
    later(420, () => {
      Puppet.fall(victim);
      Stage.fxDust(stage, victim.x, stage.groundY, 12);
      Stage.fxGhost(stage, headPos(victim).x, headPos(victim).y, 2);
    });
  }
  /* 英雄对打（不打死）：双方过招，败者倒地后自行起身 */
  function duel(a, b, loser) {
    Puppet.fight(a, 1.1);
    Puppet.fight(b, 1.1);
    AudioFx.pattern('fight');
    later(200, () => Stage.fxSparks(stage, (a.x + b.x) / 2, stage.groundY - 130, 18));
    later(260, () => Stage.fxFlash(stage, 0.55));
    later(700, () => {
      Puppet.fall(loser);
      Stage.fxDust(stage, loser.x, stage.groundY, 12);
      Stage.fxGhost(stage, headPos(loser).x, headPos(loser).y, 1.6);
    });
    later(2800, () => { if (loser.state === 'fallen') Puppet.hurt(loser, 1.6); });
  }

  /* ---------- 剧本 ---------- */
  /* 幕：{ name, scene, beats: [{type:'narr'|'line'|'action'|'cue'|'title', dur, text, who, act, music}] } */
  const ACTS_SDBGJ = [
    {
      name: '开场 · 白虎岭', scene: 'plain', beats: [
        { type: 'title', dur: 2.8, text: '三打白骨精', music: 'slow' },
        { type: 'narr', dur: 5.2, text: '话说唐僧师徒一路西行，这一日来到白虎岭。悟空见师父腹中饥饿，纵身去寻野果。' },
        { type: 'action', dur: 4.5, act() {
          const t = enter('tangseng', -0.25, 0.4);
          session.p.t = t;
          t.onArrive = () => Puppet.sit(t);
          session.p.w = enter('wukong', 1.25, 0.6);
          later(900, () => { Puppet.jump(session.p.w, 340); });
        } },
        { type: 'narr', dur: 4.5, text: '悟空一个筋斗云翻去摘桃。岭上忽起阴风，白骨夫人乘雾而来。' },
        { type: 'action', dur: 2.2, act() {
          session.p.w.targetX = px(1.4);
          later(3000, () => stage.puppets.splice(stage.puppets.findIndex(e => e.puppet === session.p.w), 1));
        } },
      ],
    },
    {
      name: '一打 · 村姑送斋', scene: 'mountain', beats: [
        { type: 'action', dur: 3.6, act() {
          const b = enter('baigujing', 1.15, 0.62);
          session.p.b = b;
          Stage.fxSmoke(stage, px(0.72), stage.groundY - 40, 10);
        } },
        { type: 'line', who: '白骨精', dur: 5.5, text: '唐僧东来，正是那长生不老肉！待我变作村姑，诱他师徒中计。' },
        { type: 'action', dur: 2.6, act() { transform(session.p.b, 'cungu'); } },
        { type: 'line', who: '村姑', dur: 5, text: '长老，山路难行，奴家特来送些斋饭。' },
        { type: 'action', dur: 4.6, act() {
          session.p.b.targetX = px(0.5);
          const w = enter('wukong', 1.2, 0.66, 1.05);
          session.p.w = w;
          later(1400, () => Puppet.jump(w, 300));
        } },
        { type: 'line', who: '悟空', dur: 3.4, text: '妖怪！休想瞒我！吃俺老孙一棒！' },
        { type: 'action', dur: 1.6, act() {
          const h = headPos(session.p.w);
          Stage.fxRays(stage, h.x, h.y - 20, 1.8);
          AudioFx.pattern('fast');
          session.p.w.targetX = px(0.56);
        } },
        { type: 'cue', dur: 0, text: '请拍板 —— 悟空举棒，替天行道！', after: 2.2, onClap() {
          strike(session.p.w, session.p.b, { big: true });
          session.p.w.targetX = px(0.6);
        } },
        { type: 'narr', dur: 5.5, text: '一棒下去，"村姑"倒地，真身化作青烟遁走。唐僧却以为悟空枉杀好人，怒上心头。' },
        { type: 'action', dur: 3, act() {
          later(2600, () => {
            stage.puppets.splice(stage.puppets.findIndex(e => e.puppet === session.p.b), 1);
          });
        } },
        { type: 'line', who: '唐僧', dur: 5.5, text: '悟空！出家人慈悲为怀，你怎可伤人性命！' },
        { type: 'line', who: '悟空', dur: 5.5, text: '师父，那是妖怪所变，俺老孙火眼金睛，看得真真切切！' },
        { type: 'narr', dur: 4, text: '唐僧不依，念起紧箍咒来。悟空头痛欲裂，满地打滚。' },
        { type: 'action', dur: 4.4, act() {
          Puppet.hurt(session.p.w, 4);
          const h = headPos(session.p.w);
          Stage.fxRing(stage, h.x, h.y - 30, 3.4);
          later(600, () => Stage.fxRing(stage, h.x, h.y - 30, 3));
          AudioFx.pattern('fast');
        } },
        { type: 'line', who: '悟空', dur: 5, text: '疼煞我也！师父莫念，莫念！' },
        { type: 'narr', dur: 5, text: '白骨精一计不成，又生一计，化作老妪再上山来。' },
      ],
    },
    {
      name: '二打 · 老妪寻女', scene: 'village', beats: [
        { type: 'action', dur: 3.4, act() {
          const b = enter('baigujing', -0.2, 0.52);
          session.p.b = b;
          Stage.fxSmoke(stage, px(0.1), stage.groundY - 30, 10);
        } },
        { type: 'action', dur: 2.2, act() { transform(session.p.b, 'laoyu'); } },
        { type: 'line', who: '老妪', dur: 6, text: '女儿啊，你在哪里？莫不是被那唐僧师徒害了性命！' },
        { type: 'action', dur: 2.4, act() { session.p.b.targetX = px(0.47); } },
        { type: 'line', who: '悟空', dur: 3.4, text: '老妖婆，还敢来骗我师父！' },
        { type: 'action', dur: 1.4, act() { session.p.w.targetX = px(0.56); AudioFx.pattern('fast'); } },
        { type: 'cue', dur: 0, text: '请拍板 —— 再吃俺老孙一棒！', after: 2.2, onClap() {
          strike(session.p.w, session.p.b, { big: true });
        } },
        { type: 'narr', dur: 5.5, text: '老妪亦倒，青烟又起。唐僧见状，只道悟空连害两命，越发恼怒。' },
        { type: 'action', dur: 2.6, act() {
          later(2400, () => {
            stage.puppets.splice(stage.puppets.findIndex(e => e.puppet === session.p.b), 1);
          });
        } },
        { type: 'line', who: '唐僧', dur: 5.5, text: '悟空，你连害两命，为师留你不得！' },
        { type: 'action', dur: 3.2, act() {
          Puppet.hurt(session.p.w, 3);
          const h = headPos(session.p.w);
          Stage.fxRing(stage, h.x, h.y - 30, 2.6);
          AudioFx.pattern('fast');
        } },
        { type: 'line', who: '悟空', dur: 5.5, text: '师父！俺老孙不除妖，你到不了西天哪！' },
        { type: 'narr', dur: 4.5, text: '白骨精恼羞成怒，变作老翁，第三次拦路。' },
      ],
    },
    {
      name: '三打 · 现出原形', scene: 'forest', beats: [
        { type: 'action', dur: 3.2, act() {
          const b = enter('baigujing', 1.18, 0.58);
          session.p.b = b;
          Stage.fxSmoke(stage, px(0.8), stage.groundY - 30, 10);
        } },
        { type: 'action', dur: 2.2, act() { transform(session.p.b, 'laoweng'); } },
        { type: 'line', who: '老翁', dur: 6, text: '老婆子，女儿……你们死得好惨！老朽与你们拼了！' },
        { type: 'action', dur: 2, act() { session.p.b.targetX = px(0.5); } },
        { type: 'line', who: '悟空', dur: 4.6, text: '呔！白骨精，你三番变化，岂能瞒得过我！' },
        { type: 'action', dur: 1.6, act() {
          const h = headPos(session.p.w);
          Stage.fxRays(stage, h.x, h.y - 20, 1.6);
          AudioFx.pattern('fast');
          session.p.w.targetX = px(0.55);
        } },
        { type: 'cue', dur: 0, text: '请拍板 —— 三打白骨精，一棒定乾坤！', after: 3, onClap() {
          strike(session.p.w, session.p.b, { big: true });
          AudioFx.pattern('pose');
        } },
        { type: 'action', dur: 3.6, act() {
          later(1900, () => {
            transform(session.p.b, 'baigujing');
            Stage.fxSkull(stage, headPos(session.p.b).x, headPos(session.p.b).y, 2.4);
          });
        } },
        { type: 'narr', dur: 6, text: '妖精终于现出原形，化作一具白骨。悟空三打白骨精，真相大白，师徒尽释前嫌。' },
        { type: 'line', who: '唐僧', dur: 4.4, text: '悟空，为师错怪你了！' },
        { type: 'line', who: '悟空', dur: 6.5, text: '师父言重。此去西天，路远妖多，俺老孙定护师父周全！' },
        { type: 'action', dur: 5.5, act() {
          session.p.w.targetX = px(0.44);
          later(1400, () => { session.p.t.state === 'sit' && (session.p.t.state = 'idle'); session.p.t.targetX = px(0.4); });
          later(3200, () => {
            session.p.w.targetX = px(-0.3);
            session.p.t.targetX = px(-0.35);
          });
        } },
        { type: 'title', dur: 2.6, text: '完', music: 'pose' },
        { type: 'narr', dur: 7, text: '火眼金睛辨真伪，匠心灯影传非遗。您的每一次拍板，都是这门古老艺术的一次新生。点「重演」可再看一遍。' },
      ],
    },
  ];

  /* ================= 《大闹天宫》 ================= */
  const ACTS_DNTG = [
    {
      name: '开场 · 花果山', scene: 'mountain', beats: [
        { type: 'title', dur: 2.8, text: '大闹天宫', music: 'slow' },
        { type: 'narr', dur: 6, text: '话说孙悟空学艺归来，龙宫借宝、地府销册，闹得三界震动。玉帝为安抚妖猴，宣他上天，只封了个弼马温。' },
        { type: 'action', dur: 4.5, act() {
          const w = enter('wukong', -0.25, 0.45);
          session.p.w = w;
          later(1400, () => Puppet.jump(w, 320));
        } },
        { type: 'line', who: '悟空', dur: 5.5, text: '想俺老孙一身本事，却叫俺看马！这"齐天大圣"的名号，可是俺自己挣来的！' },
        { type: 'narr', dur: 5, text: '悟空一怒反下天庭，竖起"齐天大圣"旗号。玉帝大怒，命托塔天王率天兵天将下界捉拿。' },
        { type: 'action', dur: 4, act() { exit(session.p.w, -1); } },
      ],
    },
    {
      name: '斗法 · 二郎真君', scene: 'plain', beats: [
        { type: 'narr', dur: 5, text: '花果山下，旌旗蔽日。灌江口二郎显圣真君奉旨前来，要与悟空斗个高低。' },
        { type: 'action', dur: 3.4, act() {
          const w = enter('wukong', -0.2, 0.4);
          session.p.w = w;
          session.p.e = enter('erlangshen', 1.15, 0.66);
        } },
        { type: 'line', who: '二郎神', dur: 5.5, text: '泼猴！我二郎真君在此，还不束手就擒！' },
        { type: 'line', who: '悟空', dur: 5, text: '三只眼，莫夸海口！吃俺老孙一棒！' },
        { type: 'action', dur: 2, act() {
          session.p.e.targetX = px(0.62);
          session.p.w.targetX = px(0.5);
          AudioFx.pattern('fast');
        } },
        { type: 'cue', dur: 0, text: '请拍板 —— 悟空挥棒，大战二郎真君！', after: 2.6, onClap() {
          duel(session.p.w, session.p.e, session.p.e);
          session.p.w.targetX = px(0.56);
        } },
        { type: 'narr', dur: 6, text: '二人大战三百回合，悟空变飞禽走兽，二郎神追云逐月。终是悟空棒法更胜一筹，二郎神败下阵去。' },
        { type: 'action', dur: 5, act() { later(2400, () => exit(session.p.e, 1)); } },
        { type: 'narr', dur: 5, text: '玉帝见二郎神不敌，急调哪吒三太子率天兵再战。' },
      ],
    },
    {
      name: '迎战 · 哪吒三太子', scene: 'heaven', beats: [
        { type: 'action', dur: 3.2, act() {
          session.p.n = enter('nezha', 1.15, 0.62, 0.98);
          Stage.fxSmoke(stage, px(0.8), stage.groundY - 30, 8, '#ffdda6');
        } },
        { type: 'line', who: '哪吒', dur: 5.5, text: '妖猴！哪吒三太子在此，看我的火尖枪！' },
        { type: 'line', who: '悟空', dur: 5, text: '娃娃，乳臭未干，也敢与老孙斗？' },
        { type: 'action', dur: 2, act() {
          session.p.n.targetX = px(0.6);
          session.p.w.targetX = px(0.5);
          AudioFx.pattern('fast');
        } },
        { type: 'cue', dur: 0, text: '请拍板 —— 枪来棒往，力战哪吒！', after: 2.8, onClap() {
          duel(session.p.w, session.p.n, session.p.n);
        } },
        { type: 'narr', dur: 6, text: '哪吒三头六臂，悟空毫毛化形。这一战直打得天昏地暗，哪吒终究不敌，败回天宫。' },
        { type: 'action', dur: 5, act() { later(2600, () => exit(session.p.n, -1)); } },
        { type: 'narr', dur: 5.5, text: '太上老君见状，祭起金刚琢，暗算悟空。悟空一个趔趄，被天兵擒上天庭。' },
      ],
    },
    {
      name: '丹炉 · 火眼金睛', scene: 'heaven', beats: [
        { type: 'action', dur: 3.2, act() { session.p.l = enter('taishang', 1.1, 0.68); } },
        { type: 'line', who: '太上老君', dur: 6.5, text: '泼猴！你偷吃仙丹、大闹蟠桃会，今日将你投入八卦炉中，炼上七七四十九日，看你还敢逞凶！' },
        { type: 'narr', dur: 4.5, text: '悟空被推入八卦炉中。炉火熊熊，烟焰熏天，一炼便是四十九日。' },
        { type: 'action', dur: 4.6, act() {
          const w = session.p.w, h = headPos(w);
          Puppet.sit(w);
          Stage.fxSmoke(stage, h.x, h.y + 60, 24, '#9a5a34');
          later(700, () => Stage.fxSmoke(stage, h.x, h.y + 60, 18, '#b06a2c'));
          later(1400, () => Stage.fxFlash(stage, 0.6));
          later(2200, () => Stage.fxSmoke(stage, h.x, h.y + 60, 20, '#8a4a30'));
        } },
        { type: 'narr', dur: 5, text: '不料炉中有一处巽位，悟空躲在风口，烟熏火燎，倒炼就一双火眼金睛！' },
        { type: 'cue', dur: 0, text: '请拍板 —— 丹炉迸裂，悟空破炉而出！', after: 3, onClap() {
          const w = session.p.w, h = headPos(w);
          w.state = 'idle';
          Stage.fxFlash(stage, 0.9);
          Stage.fxSparks(stage, w.x, w.y - 80, 26);
          Stage.fxRays(stage, h.x, h.y - 20, 2.6);
          Stage.fxSmoke(stage, w.x, stage.groundY, 30, '#d9c9ac');
          Puppet.jump(w, 360);
          AudioFx.pattern('pose');
        } },
        { type: 'line', who: '悟空', dur: 6.5, text: '好炉子！炼得俺老孙火眼金睛！玉帝老儿，这凌霄宝殿，俺老孙今日砸个痛快！' },
        { type: 'narr', dur: 5, text: '悟空一路棒打天宫，太上老君与众仙慌作一团，无人能挡。' },
        { type: 'action', dur: 4.5, act() {
          Puppet.hurt(session.p.l, 2.4);
          later(1200, () => exit(session.p.l, 1));
          later(2000, () => {
            const h = headPos(session.p.w);
            Stage.fxRays(stage, h.x, h.y - 20, 1.8);
            AudioFx.pattern('fast');
          });
        } },
        { type: 'title', dur: 2.6, text: '完', music: 'pose' },
        { type: 'narr', dur: 7, text: '齐天大圣闹天宫，火眼金睛显神通。更多灯影好戏正在路上，点「重演」可再看一遍。' },
      ],
    },
  ];

  /* ================= 《哪吒闹海》 ================= */
  const ACTS_NZH = [
    {
      name: '开场 · 东海之滨', scene: 'sea', beats: [
        { type: 'title', dur: 2.8, text: '哪吒闹海', music: 'slow' },
        { type: 'narr', dur: 6, text: '陈塘关总兵李靖之子哪吒，天生神力，乾坤圈、混天绫随身，最喜在东海之滨玩耍。' },
        { type: 'action', dur: 4.5, act() {
          const n = enter('nezha', -0.25, 0.42, 0.98);
          session.p.n = n;
          later(1400, () => Puppet.jump(n, 340));
          later(2600, () => Puppet.liangxiang(n, 1.2));
        } },
        { type: 'line', who: '哪吒', dur: 5.5, text: '好一片东海！待我舞动混天绫，练上一练！' },
        { type: 'action', dur: 3.6, act() {
          const n = session.p.n, h = headPos(n);
          Stage.fxRays(stage, h.x, h.y - 20, 1.6);
          Puppet.jump(n, 300);
          AudioFx.pattern('fast');
        } },
        { type: 'narr', dur: 5.5, text: '混天绫舞起，海水翻滚，直搅得东海龙宫地动山摇。' },
        { type: 'action', dur: 4, act() {
          Stage.fxFlash(stage, 0.4);
          later(600, () => Stage.fxSmoke(stage, stage.w * 0.5, stage.groundY - 20, 22, '#7fb8c8'));
        } },
        { type: 'narr', dur: 5.5, text: '东海龙王敖广勃然大怒，亲自率虾兵蟹将出水问罪。' },
      ],
    },
    {
      name: '斗法 · 东海龙王', scene: 'palace', beats: [
        { type: 'action', dur: 3.6, act() {
          session.p.l = enter('longwang', 1.15, 0.7, 1.2);
          Stage.fxSmoke(stage, px(0.8), stage.groundY - 40, 12, '#9ad0e0');
        } },
        { type: 'line', who: '东海龙王', dur: 6, text: '何方小儿，敢在我东海兴风作浪，搅我龙宫！' },
        { type: 'line', who: '哪吒', dur: 6, text: '我乃陈塘关李靖之子哪吒！你纵容恶龙兴洪害民，今日定要讨个公道！' },
        { type: 'action', dur: 2.2, act() {
          session.p.l.targetX = px(0.66);
          session.p.n.targetX = px(0.46);
          AudioFx.pattern('fast');
        } },
        { type: 'cue', dur: 0, text: '请拍板 —— 哪吒大战东海龙王！', after: 2.6, onClap() {
          duel(session.p.n, session.p.l, session.p.l);
        } },
        { type: 'narr', dur: 6, text: '混天绫缠住龙身，乾坤圈直取龙角。龙王不是对手，败回龙宫。' },
        { type: 'action', dur: 5, act() { later(2400, () => exit(session.p.l, 1)); } },
        { type: 'narr', dur: 5.5, text: '龙王恼羞成怒，联合四海龙王，掀起滔天巨浪，水淹陈塘关。' },
      ],
    },
    {
      name: '舍身 · 水淹陈塘关', scene: 'sea', beats: [
        { type: 'action', dur: 4, act() {
          Stage.fxFlash(stage, 0.6);
          later(500, () => Stage.fxSmoke(stage, stage.w * 0.3, stage.groundY - 20, 26, '#7fb8c8'));
          later(1300, () => Stage.fxSmoke(stage, stage.w * 0.7, stage.groundY - 20, 26, '#7fb8c8'));
          later(2100, () => Stage.fxFlash(stage, 0.5));
          AudioFx.pattern('fast');
        } },
        { type: 'narr', dur: 5.5, text: '巨浪滔天，百姓危在旦夕。哪吒挺身而出：一人做事一人当！' },
        { type: 'line', who: '哪吒', dur: 6, text: '父老乡亲莫慌！祸是我闯的，哪吒自刎谢罪，换陈塘关太平！' },
        { type: 'cue', dur: 0, text: '请拍板 —— 哪吒舍身救民！', after: 3, onClap() {
          const n = session.p.n, h = headPos(n);
          Stage.fxFlash(stage, 0.9);
          Puppet.fall(n);
          Stage.fxGhost(stage, h.x, h.y, 2.4);
          later(1200, () => Stage.fxRays(stage, n.x, n.y - 120, 2.6));
          AudioFx.pattern('pose');
        } },
        { type: 'narr', dur: 6, text: '哪吒舍身救民，大义感天。太乙真人以莲花莲叶重塑其身，哪吒得以重生。' },
        { type: 'action', dur: 3.4, act() {
          const n = session.p.n;
          later(600, () => {
            if (n.state === 'fallen') Puppet.hurt(n, 1.2);
            Stage.fxRays(stage, headPos(n).x, headPos(n).y - 20, 2);
            Stage.fxSmoke(stage, n.x, stage.groundY, 14, '#ffdda6');
            AudioFx.pattern('pose');
          });
          later(2000, () => Puppet.liangxiang(n, 1.6));
        } },
        { type: 'narr', dur: 5, text: '重生后的哪吒更胜从前，回身直捣龙宫，要与龙王再分高下。' },
      ],
    },
    {
      name: '重生 · 再战龙王', scene: 'heaven', beats: [
        { type: 'action', dur: 3.4, act() {
          session.p.l = enter('longwang', 1.15, 0.7, 1.2);
          Stage.fxSmoke(stage, px(0.8), stage.groundY - 40, 12, '#9ad0e0');
        } },
        { type: 'line', who: '东海龙王', dur: 5.5, text: '你……你竟还活着！' },
        { type: 'line', who: '哪吒', dur: 6, text: '莲花之身，降妖除魔！龙王，纳命来！' },
        { type: 'action', dur: 2, act() {
          session.p.l.targetX = px(0.64);
          session.p.n.targetX = px(0.46);
          AudioFx.pattern('fast');
        } },
        { type: 'cue', dur: 0, text: '请拍板 —— 乾坤圈出，再战龙王！', after: 2.8, onClap() {
          duel(session.p.n, session.p.l, session.p.l);
          later(400, () => Stage.fxRays(stage, headPos(session.p.n).x, headPos(session.p.n).y - 20, 2));
        } },
        { type: 'narr', dur: 6, text: '混天绫舞动如虹，乾坤圈金光万道。龙王再败，俯首告饶，再不敢兴风作浪。' },
        { type: 'action', dur: 5, act() { later(2600, () => exit(session.p.l, -1)); } },
        { type: 'action', dur: 3, act() {
          Puppet.liangxiang(session.p.n, 2);
          AudioFx.pattern('pose');
        } },
        { type: 'title', dur: 2.6, text: '完', music: 'pose' },
        { type: 'narr', dur: 7, text: '哪吒闹海显身手，莲花重生护苍生。点「重演」可再看一遍，或回目录另选好戏。' },
      ],
    },
  ];

  /* ---------- 剧目目录 ---------- */
  const DRAMAS = {
    sdbgj: {
      id: 'sdbgj', title: '三打白骨精', tagline: '三番变化 · 火眼金睛',
      desc: '唐僧师徒白虎岭遇妖，白骨精三番变化，一打村姑、二打老妪、三打老翁，拍板三棒定乾坤。',
      cover: 'baigujing', acts: ACTS_SDBGJ,
    },
    dntg: {
      id: 'dntg', title: '大闹天宫', tagline: '齐天大圣 · 勇斗群仙',
      desc: '悟空反下天庭自称齐天大圣，力战二郎神与哪吒，八卦炉中炼就火眼金睛，大闹凌霄宝殿。',
      cover: 'wukong', acts: ACTS_DNTG,
    },
    nzh: {
      id: 'nzh', title: '哪吒闹海', tagline: '混天绫起 · 莲花重生',
      desc: '哪吒东海之滨搅动龙宫，大战东海龙王，为救百姓舍身取义，太乙真人莲花重塑，重生再战。',
      cover: 'nezha', acts: ACTS_NZH,
    },
  };

  /* ---------- 引擎 ---------- */
  function start(stageInst, dramaId) {
    stop(true);
    current = DRAMAS[dramaId] || DRAMAS.sdbgj;
    stage = stageInst;
    Stage.clearPuppets(stage);          /* 重演前清空旧角色，避免重复入场 */
    Stage.resize(stage);
    Stage.setActive(stage, true);
    for (const e of stage.puppets) e.puppet.ground = stage.groundY;
    session = { timers: [], offs: [], p: {} };
    beats = [];
    current.acts.forEach(act => act.beats.forEach(b => {
      beats.push(Object.assign({ actName: act.name, scene: act.scene }, b));
    }));
    idx = 0;
    hideCue(); setSub();
    el().title.style.display = 'none';
    Stage.setScene(stage, 'plain');
    playBeat(0);
  }

  function playBeat(i) {
    if (!session) return;
    if (i >= beats.length) { return; }
    idx = i;
    const b = beats[i];
    /* 先排定下一拍的推进，再执行本拍效果：
       任何渲染/音效/动作异常都不阻断整场演出 */
    if (b.type === 'cue') armCue(b, () => playBeat(i + 1));
    else later(b.dur * 1000, () => playBeat(i + 1));
    try {
      const pct = Math.round(((i + 1) / beats.length) * 100);
      const actNo = Math.max(1, current.acts.findIndex(a => a.name === b.actName) + 1);
      el().hud.innerHTML = `<span class="drama-progress">《${current.title}》 · 第${actNo}幕 · ${b.actName}` +
        `<i class="drama-progress-track" aria-hidden="true"><i class="drama-progress-bar" style="width:${pct}%"></i></i>` +
        `<b>${pct}%</b>${demoMode ? ' · 演示版' : ''}</span>`;
      Stage.setScene(stage, b.scene);
      if (b.type === 'title') showTitle(b.text, b.dur * 1000);
      if (b.sub) setSub(b.sub);
      if (b.type === 'line') setSub({ text: b.text, who: b.who });
      if (b.type === 'narr') setSub({ text: b.text, narr: true });
      if (b.music) AudioFx.pattern(b.music);
      if (b.act) b.act();
    } catch (e) { console.warn('[beat ' + (i + 1) + ']', e); }
  }

  function armCue(b, next) {
    showCue(b.text);
    let fired = false;
    const fire = () => {
      if (fired || !session) return;
      fired = true;
      hideCue();
      AudioFx.pattern('clap');
      try { b.onClap && b.onClap(); } catch (e) { console.warn(e); }
      later(b.after * 1000, next);
    };
    const offTap = Input.on('tap', fire);
    const offPoint = Input.on('point', fire);
    session.offs.push(offTap, offPoint);
  }

  function stop(silent) {
    if (session) {
      session.timers.forEach(clearTimeout);
      session.offs.forEach(f => f());
      session = null;
    }
    hideCue();
  }

  function teardown() {
    stop();
    if (stage) Stage.clearPuppets(stage);
    if (stage) Stage.setActive(stage, false);
    setSub();
    const e = el();
    e.title.style.display = 'none';
    e.hud.textContent = '';
  }

  /* 剧目目录（供目录 UI 使用） */
  function list() {
    return Object.values(DRAMAS).map(d => ({ id: d.id, title: d.title, tagline: d.tagline, desc: d.desc, cover: d.cover }));
  }

  function setDemoMode(on) { demoMode = !!on; }
  function isDemoMode() { return demoMode; }

  return { start, stop, teardown, list, setSub, showCue, hideCue, setDemoMode, isDemoMode };
})();
