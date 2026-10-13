/* 不联网、不读取真实密钥的问答接口契约测试。运行：node scripts/api-contract-test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const classroom = require(path.join(ROOT, 'js/classroom-data.js'));

function setup(fakeKey) {
  let handler;
  let sentContext = '';
  const http = {
    createServer(fn) {
      handler = fn;
      return { on() { return this; }, listen(port, host, done) { done(); } };
    },
  };
  const fakeFs = {
    readFileSync(file) {
      if (path.basename(file) === '.env.local') return fakeKey ? `DEEPSEEK_API_KEY=${fakeKey}` : '';
      throw new Error('unexpected read');
    },
  };
  const sandbox = {
    require(name) {
      if (name === 'http') return http;
      if (name === 'fs') return fakeFs;
      if (name === 'path') return path;
      if (name === 'child_process') return { exec() {} };
      if (name === './js/classroom-data') return classroom;
      throw new Error('unexpected dependency: ' + name);
    },
    __dirname: ROOT,
    process: { env: { NO_BROWSER: '1', PORT: '18088' }, platform: 'win32', exit() {} },
    console: { log() {} },
    fetch: async (url, options) => {
      assert.strictEqual(url, 'https://api.deepseek.com/chat/completions');
      assert.strictEqual(options.headers.Authorization, `Bearer ${fakeKey}`);
      sentContext = JSON.parse(options.body).messages[1].content;
      return { ok: true, json: async () => ({ choices: [{ message: { content: '皮影制作包括选皮、制皮等工序。' } }] }) };
    },
    setTimeout, clearTimeout, Buffer, AbortController,
  };
  vm.runInNewContext(source, sandbox, { filename: 'server.js' });
  return { handler, getSentContext: () => sentContext };
}

function request(handler, url, method = 'GET', body = '') {
  return new Promise(resolve => {
    let status;
    const res = {
      writeHead(code) { status = code; },
      end(data) { resolve({ status, data: data ? JSON.parse(data) : null }); },
    };
    const req = {
      url, method, headers: { host: 'localhost:18088', 'content-type': 'application/json' },
      socket: { remoteAddress: '127.0.0.1' },
      async *[Symbol.asyncIterator]() { if (body) yield Buffer.from(body); },
    };
    handler(req, res);
  });
}

async function main() {
  const configured = setup('sk-test-only');
  const status = await request(configured.handler, '/api/classroom/status');
  assert.strictEqual(status.status, 200);
  assert.strictEqual(status.data.configured, true);
  const answer = await request(configured.handler, '/api/classroom/ask', 'POST', JSON.stringify({ question: '皮影是怎么制作的？' }));
  assert.strictEqual(answer.status, 200);
  assert.ok(answer.data.answer);
  assert.ok(answer.data.references.length >= 1);
  for (const ref of answer.data.references) {
    assert.ok(classroom.entries.some(entry => entry.type === ref.type && entry.id === ref.id));
  }
  assert.ok(configured.getSentContext().includes('本页相关资料'));
  assert.ok(!JSON.stringify(answer.data).includes('sk-test-only'));
  const notConfigured = setup('');
  const missing = await request(notConfigured.handler, '/api/classroom/status');
  assert.strictEqual(missing.data.configured, false);
  const error = await request(notConfigured.handler, '/api/classroom/ask', 'POST', JSON.stringify({ question: '皮影是什么？' }));
  assert.strictEqual(error.status, 503);
  assert.strictEqual(error.data.code, 'unconfigured');
  console.log('✓ 问答接口状态、参考资料和未配置错误契约通过（未联网）');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
