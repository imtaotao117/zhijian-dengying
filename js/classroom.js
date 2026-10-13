/* ============================================================
   classroom.js —— 非遗课堂
   · 历史沿革时间轴
   · 全国流派地图（剪纸风简笔地图 + 发光点位）
   · 制作八道工序
   ============================================================ */
window.Classroom = (() => {
  /* ---------- 历史沿革 ---------- */
  const ERAS = window.ClassroomData.eras;

  function renderTimeline() {
    const box = document.getElementById('cls-timeline');
    box.innerHTML = ERAS.map((e, i) => `
      <div class="cls-era" data-search-id="era-${i}">
        <h4>${e.name}</h4>
        <span class="era-when">${e.when}</span>
        <p>${e.text}</p>
      </div>`).join('');
  }

  /* ---------- 流派地图（剪纸风简笔中国地图） ---------- */
  /* 轮廓：以经纬度等距投影手绘简化边界（剪纸风格，示意而非精确政区图） */
  const OUTLINE = '798.8,20 852.4,83.1 944.4,164.2 906,209.3 812.5,263.4 769.5,285 711.4,294 752.8,306.7 786.5,315.7 734.4,359 775.8,416.6 760.5,452.7 737.5,515.8 696.1,564.5 645.6,587.9 591.9,618.6 568.9,597 541.3,569.9 461.7,587.9 415.7,488.8 354.4,461.7 308.5,483.4 238,479.8 109.3,416.6 48,344.5 48,272.3 136.9,182.3 224.2,119.2 175.2,137.2 285.5,155.2 438.7,218.3 621,196.7 714.5,137.2 705.3,90.3 745.2,29 798.8,20';

  const SCHOOLS = window.ClassroomData.schools;

  function renderMap() {
    const box = document.getElementById('cls-map');
    const pins = SCHOOLS.map(s => `
      <g class="pin" data-key="${s.key}" transform="translate(${s.x},${s.y})" tabindex="0" role="button" aria-label="查看${s.name}" style="cursor:pointer">
        <circle r="13" fill="rgba(176,48,42,.18)"><animate attributeName="r" values="8;15;8" dur="2.2s" repeatCount="indefinite"/></circle>
        <circle r="5" fill="#b0302a" stroke="#ffd27d" stroke-width="2"/>
        <text x="12" y="-10" font-size="14" fill="#6b3a10" font-family="KaiTi, serif">${s.name}</text>
      </g>`).join('');
    box.innerHTML = `
      <svg viewBox="0 0 1000 660" preserveAspectRatio="xMidYMid meet">
        <!-- 纸底 -->
        <rect width="1000" height="660" fill="#fdf6e3"/>
        <g opacity="0.5">
          <circle cx="120" cy="90" r="30" fill="none" stroke="#d9b96a" stroke-width="1.5"/>
          <circle cx="880" cy="560" r="40" fill="none" stroke="#d9b96a" stroke-width="1.5"/>
        </g>
        <!-- 大陆轮廓 -->
        <path d="M${OUTLINE} Z" fill="#f3e3bd" stroke="#8a6448" stroke-width="3"
              stroke-linejoin="round" filter="url(#soft)"/>
        <!-- 台湾 -->
        <path d="M760,560 Q774,550 768,576 Q758,584 752,572 Z" fill="#f3e3bd" stroke="#8a6448" stroke-width="2.5"/>
        <!-- 海南 -->
        <ellipse cx="584" cy="638" rx="26" ry="14" fill="#f3e3bd" stroke="#8a6448" stroke-width="2.5"/>
        <!-- 南海诸岛示意 -->
        <circle cx="660" cy="648" r="3" fill="#8a6448"/>
        <circle cx="700" cy="652" r="3" fill="#8a6448"/>
        <circle cx="740" cy="648" r="3" fill="#8a6448"/>
        <!-- 黄河长江（示意） -->
        <path d="M340,300 Q480,330 620,310 T760,330" fill="none" stroke="#b08a56" stroke-width="2" stroke-dasharray="6 5" opacity=".7"/>
        <path d="M300,410 Q500,430 680,415 T780,420" fill="none" stroke="#b08a56" stroke-width="2" stroke-dasharray="6 5" opacity=".7"/>
        <defs>
          <filter id="soft" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="3" dy="4" stdDeviation="4" flood-color="#8a6448" flood-opacity=".3"/>
          </filter>
        </defs>
        ${pins}
      </svg>
      <div class="cls-map-info" id="cls-map-info">${mapInfoHTML(SCHOOLS[0])}</div>`;
    box.querySelectorAll('.pin').forEach(g => {
      const activate = () => showSchool(g.dataset.key);
      g.addEventListener('click', activate);
      g.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      });
    });
  }
  function mapInfoHTML(s) {
    return `<h4>${s.name}</h4><p><b>${s.place}</b></p><p>${s.text}</p>`;
  }
  function showSchool(key) {
    const school = SCHOOLS.find(item => item.key === key);
    if (school) document.getElementById('cls-map-info').innerHTML = mapInfoHTML(school);
  }

  /* ---------- 八道工序 ---------- */
  const STEPS = window.ClassroomData.steps;

  function renderSteps() {
    const box = document.getElementById('cls-steps');
    box.innerHTML = STEPS.map((s, i) => `
      <div class="cls-step" data-search-id="step-${i}">
        <span class="st-no">第 ${i + 1} 道</span>
        <span class="st-ico" aria-hidden="true">${s.ico}</span>
        <h4>${s.name}</h4>
        <p>${s.text}</p>
      </div>`).join('');
  }

  /* ---------- 本页资料搜索与 DeepSeek 问答 ---------- */
  function initSearch() {
    const form = document.getElementById('cls-search-form');
    const input = document.getElementById('cls-search-input');
    const results = document.getElementById('cls-search-results');
    const status = document.getElementById('cls-search-status');
    const apiStatus = document.getElementById('cls-api-status');
    const askButton = document.getElementById('cls-ask-button');
    const answerBox = document.getElementById('cls-ai-answer');
    const answerText = document.getElementById('cls-ai-text');
    const answerQuestion = document.getElementById('cls-ai-question');
    const referencesBox = document.getElementById('cls-ai-references');

    function setApiStatus(message, error = false) {
      apiStatus.textContent = message;
      apiStatus.dataset.state = error ? 'error' : 'ready';
    }

    async function checkApiStatus() {
      if (location.protocol === 'file:') {
        setApiStatus('智能问答不可用：请双击“启动服务器.bat”，再从 localhost 打开本页。本地资料搜索仍可使用。', true);
        askButton.disabled = true;
        return;
      }
      /* 是否为「纯静态托管」的在线演示版（GitHub Pages 等），无法运行 Node 服务端 */
      const isStaticHost = location.hostname.endsWith('github.io') ||
        (location.protocol.startsWith('http') && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1');
      try {
        const response = await fetch('/api/classroom/status', { cache: 'no-store' });
        if (!response.ok) throw new Error('status request failed');
        const data = await response.json();
        askButton.disabled = !data.configured;
        setApiStatus(data.configured
          ? '智能问答已配置，可向 DeepSeek 提问。'
          : '智能问答未配置：请在项目目录的 .env.local 中填写密钥，重启服务器并刷新页面。本地资料搜索仍可使用。', !data.configured);
      } catch {
        askButton.disabled = true;
        if (isStaticHost) {
          setApiStatus('在线演示版：AI 智能问答需在本机（localhost）运行服务器后体验；本页资料搜索、时间轴、流派地图与工序图解均可正常使用，不受影响。', true);
        } else {
          setApiStatus('无法连接本地问答服务：请通过“启动服务器.bat”打开作品。本地资料搜索仍可使用。', true);
        }
      }
    }

    function jumpToEntry(hit) {
      if (hit.type === 'school') showSchool(hit.id);
      const target = hit.type === 'school' ? document.getElementById('cls-map')
        : document.querySelector(`[data-search-id="${hit.type}-${hit.id}"]`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function showReferences(references) {
      referencesBox.replaceChildren();
      const entries = (Array.isArray(references) ? references : [])
        .map(ref => ref && window.ClassroomData.entries.find(entry => entry.type === ref.type && entry.id === ref.id))
        .filter(Boolean);
      if (!entries.length) { referencesBox.hidden = true; return; }
      const label = document.createElement('p');
      label.textContent = '发送给模型参考的本页资料（不代表回答逐条引用）：';
      const list = document.createElement('div');
      list.className = 'cls-ai-reference-list';
      for (const entry of entries) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = `${entry.title} · ${entry.meta}`;
        button.addEventListener('click', () => jumpToEntry(entry));
        list.appendChild(button);
      }
      referencesBox.append(label, list);
      referencesBox.hidden = false;
    }

    function search() {
      const query = input.value.trim();
      results.replaceChildren();
      if (!query) { status.textContent = '输入关键词后即可搜索本页资料。'; return false; }
      const hits = window.ClassroomData.search(query);
      status.textContent = hits.length ? `显示 ${hits.length} 条相关资料，点击可跳转。` : '本页暂无匹配资料；可换个关键词，或向 DeepSeek 提问。';
      for (const hit of hits) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cls-search-hit';
        const title = document.createElement('strong');
        title.textContent = `${hit.title} · ${hit.meta}`;
        const excerpt = document.createElement('span');
        excerpt.textContent = hit.text;
        button.append(title, excerpt);
        button.addEventListener('click', () => jumpToEntry(hit));
        results.appendChild(button);
      }
      return true;
    }

    form.addEventListener('submit', event => { event.preventDefault(); search(); });
    input.addEventListener('input', () => { if (input.value.trim()) search(); else { results.replaceChildren(); status.textContent = '输入关键词后即可搜索本页资料。'; } });
    askButton.addEventListener('click', async () => {
      if (!search()) return;
      const question = input.value.trim();
      askButton.disabled = true;
      askButton.textContent = '正在思考…';
      answerBox.hidden = false;
      answerQuestion.textContent = `问题：${question}`;
      answerText.textContent = '正在联系 DeepSeek…';
      referencesBox.hidden = true;
      referencesBox.replaceChildren();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetch('/api/classroom/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
          signal: controller.signal,
        });
        const data = await response.json();
        answerText.textContent = response.ok ? data.answer : (data.error || '暂时无法获取回答，请稍后重试。');
        if (response.ok) showReferences(data.references);
        if (data.code === 'unconfigured') {
          askButton.disabled = true;
          setApiStatus('智能问答未配置：填写 .env.local 后重启服务器并刷新页面。', true);
        }
        if (data.code === 'invalid_key') {
          askButton.disabled = true;
          setApiStatus('DeepSeek 密钥无效或权限不足，请更换密钥、重启服务器并刷新页面。', true);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          answerText.textContent = '等待超时，请稍后重试。';
        } else if (location.hostname.endsWith('github.io')) {
          answerText.textContent = '当前为在线演示版，AI 问答需在本机服务器环境中使用；你仍可在本页浏览时间轴、流派地图与工序图解等全部非遗资料。';
        } else {
          answerText.textContent = '连接失败，请确认本地服务器正在运行。';
        }
      } finally {
        clearTimeout(timeout);
        if (apiStatus.dataset.state !== 'error') askButton.disabled = false;
        askButton.textContent = '问 DeepSeek';
      }
    });
    void checkApiStatus();
  }

  function init() {
    renderTimeline();
    renderMap();
    renderSteps();
    initSearch();
  }

  return { init };
})();
