/* 零依赖发布自检：node scripts/release-check.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const ok = message => console.log('✓ ' + message);
const fail = message => errors.push(message);

const required = [
  'index.html', 'server.js', '启动服务器.bat', '启动局域网演示.bat',
  'README.md', 'THIRD_PARTY_NOTICES.md', 'AI_USE_DISCLOSURE.md',
  'js/classroom-data.js', 'js/classroom.js', '.env.local.example',
  'assets/models/hand_landmarker.task', 'assets/wasm/vision_bundle.mjs',
  'diagnostics/model-test.html', 'diagnostics/cam-test.html',
];
for (const rel of required) {
  if (!fs.existsSync(path.join(ROOT, rel))) fail('缺少文件：' + rel);
}
if (!errors.length) ok('关键文件齐全');

const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const refs = [...index.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]);
for (const ref of refs) {
  if (/^(?:https?:|#|mailto:)/.test(ref)) continue;
  const clean = ref.split('?')[0];
  if (!fs.existsSync(path.resolve(ROOT, clean))) fail('index.html 引用了不存在的本地资源：' + ref);
}
if (!errors.some(e => e.includes('index.html 引用'))) ok('首页本地资源引用有效');

for (const [label, pattern] of [
  ['开发版本角标', /灯影版\s*v\d/i],
  ['在线字体请求', /fonts\.googleapis\.com/i],
  ['含混的CC授权表述', /CC\s*免费授权/i],
]) {
  if (pattern.test(index)) fail('首页仍包含' + label);
  else ok('首页不含' + label);
}

for (const rel of fs.readdirSync(path.join(ROOT, 'js')).filter(n => n.endsWith('.js'))) {
  try { new vm.Script(fs.readFileSync(path.join(ROOT, 'js', rel), 'utf8'), { filename: rel }); }
  catch (e) { fail('JavaScript语法错误：' + rel + '：' + e.message); }
}
try { new vm.Script(fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8'), { filename: 'server.js' }); }
catch (e) { fail('JavaScript语法错误：server.js：' + e.message); }
if (!errors.some(e => e.includes('JavaScript语法错误'))) ok('应用与服务器JavaScript语法通过');

try {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js', 'parts.js'), 'utf8'), sandbox, { filename: 'parts.js' });
  const p = sandbox.window.Parts;
  const counts = {
    heads: Object.keys(p.heads).length,
    bodies: Object.keys(p.bodies).length,
    weapons: Object.keys(p.weapons).length,
    palettes: Object.keys(p.palettes).length,
    characters: Object.keys(p.characters).length,
  };
  const expected = { heads: 10, bodies: 7, weapons: 9, palettes: 10, characters: 10 };
  for (const key of Object.keys(expected)) if (counts[key] !== expected[key]) fail(`部件数量变化：${key}=${counts[key]}，README预期${expected[key]}`);
  if (!errors.some(e => e.includes('部件数量变化'))) ok('部件数量与README一致');
} catch (e) {
  fail('无法核对部件数量：' + e.message);
}

try {
  const data = require(path.join(ROOT, 'js', 'classroom-data.js'));
  if (data.eras.length !== 8 || data.schools.length !== 8 || data.steps.length !== 8) fail('非遗课堂共享资料数量不完整');
  if (data.search('华县皮影', 1)[0]?.title !== '华县皮影') fail('非遗课堂搜索未返回预期流派');
  if (data.search('皮影是怎么制作的？', 1)[0]?.type !== 'step') fail('非遗课堂问题搜索未返回制作工序');
  if (!errors.some(e => e.includes('非遗课堂'))) ok('非遗课堂共享资料与搜索通过');
} catch (e) { fail('非遗课堂搜索无法运行：' + e.message); }

if (errors.length) {
  console.error('\n发布自检未通过：');
  errors.forEach(e => console.error('✗ ' + e));
  process.exitCode = 1;
} else {
  console.log('\n发布自检全部通过。仍需人工完成真实摄像头、移动端和参赛材料核对。');
}
