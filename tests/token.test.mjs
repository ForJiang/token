import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const README = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

function extractTagAttrs(attrsStr) {
  const attrs = {};
  const re = /([a-zA-Z0-9_-]+)(?:="([^"]*)")?/g;
  let m;
  while ((m = re.exec(attrsStr))) {
    attrs[m[1]] = m[2] === undefined ? '' : m[2];
  }
  return attrs;
}

function createDomSandbox() {
  const elementsById = new Map();
  const allElements = [];

  class FakeClassList {
    constructor(el) { this.el = el; }
    _list() { return (this.el.className || '').trim().split(/\s+/).filter(Boolean); }
    contains(c) { return this._list().includes(c); }
    toggle(c, force) {
      const set = new Set(this._list());
      const next = force !== undefined ? Boolean(force) : !set.has(c);
      if (next) set.add(c); else set.delete(c);
      this.el.className = Array.from(set).join(' ');
      return next;
    }
  }

  class FakeElement {
    constructor(tag, attrs = {}) {
      this.tagName = tag.toUpperCase();
      this.attrs = { ...attrs };
      this.id = attrs.id || '';
      this.className = attrs.class || '';
      this.value = '';
      this._textContent = '';
      this.style = { cssText: '', setProperty: (k, v) => { this.style[k] = v; } };
      this.dataset = {};
      this.children = [];
      this.parentNode = null;
      this.listeners = {};
      this.clientWidth = 900;
      this.clientHeight = 600;
      this.width = 0;
      this.height = 0;
      this.hidden = Object.prototype.hasOwnProperty.call(attrs, 'hidden');
      this.classList = new FakeClassList(this);
      this._drawnCells = [];
    }
    contains(node) {
      if (node === this) return true;
      return this.children.some((c) => c === node || (c.contains && c.contains(node)));
    }
    closest(selector) {
      const m = /^\[([a-zA-Z0-9_-]+)\]$/.exec(selector);
      let cur = this;
      while (cur) {
        if (m && cur.hasAttribute && cur.hasAttribute(m[1])) return cur;
        cur = cur.parentNode;
      }
      return null;
    }
    get textContent() { return this._textContent; }
    set textContent(v) {
      this._textContent = String(v);
      if (this._textContent === '') this.children = [];
    }
    setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') this.className = String(v); }
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
    removeAttribute(k) { delete this.attrs[k]; }
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k); }
    appendChild(child) {
      if (child.tagName === '#FRAGMENT') {
        child.children.forEach((c) => { c.parentNode = this; this.children.push(c); });
        child.children = [];
        return child;
      }
      child.parentNode = this;
      this.children.push(child);
      return child;
    }
    insertBefore(newNode, refNode) {
      const idx = this.children.indexOf(refNode);
      newNode.parentNode = this;
      if (idx === -1) this.children.push(newNode);
      else this.children.splice(idx, 0, newNode);
      return newNode;
    }
    addEventListener(ev, fn) {
      if (!this.listeners[ev]) this.listeners[ev] = [];
      this.listeners[ev].push(fn);
    }
    dispatchEvent(ev) {
      (this.listeners[ev.type] || []).forEach((fn) => fn(ev));
    }
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 30, right: 100, bottom: 30 }; }
    getContext() {
      const self = this;
      return {
        globalAlpha: 1,
        textAlign: '', textBaseline: '', font: '', fillStyle: '',
        clearRect() { self._drawnCells = []; },
        setTransform() {},
        fillText() {},
        drawImage(_img, sx, _sy, sw, _sh, dx, dy) {
          self._drawnCells.push({ lv: Math.round(sx / (sw || 1)), dx, dy, alpha: this.globalAlpha });
        }
      };
    }
  }

  function register(el) {
    allElements.push(el);
    if (el.id) elementsById.set(el.id, el);
    return el;
  }

  // Parse actual elements with id / data-i18n* / data-preset / data-lang from index.html
  const tagRe = /<(div|span|label|select|optgroup|option|textarea|button|nav|p|b|h3|section)\b([^>]*)>/gi;
  let m;
  while ((m = tagRe.exec(HTML))) {
    const el = new FakeElement(m[1], extractTagAttrs(m[2]));
    register(el);
  }
  const selEl = elementsById.get('tk-enc');
  if (selEl) selEl.value = 'o200k';

  const body = register(new FakeElement('body'));
  const docEl = register(new FakeElement('html', { lang: 'zh-CN' }));
  const docListeners = {};
  const winListeners = {};
  const storage = new Map();

  let hookApi = null;
  const windowObj = {
    innerWidth: 1200,
    innerHeight: 800,
    devicePixelRatio: 1,
    addEventListener(ev, fn) { (winListeners[ev] ||= []).push(fn); },
    dispatchEvent(ev) { (winListeners[ev.type] || []).forEach((fn) => fn(ev)); },
    __TOKEN_TEST_HOOK__: (api) => { hookApi = api; }
  };

  const documentObj = {
    documentElement: docEl,
    body,
    hidden: false,
    activeElement: null,
    fonts: null,
    getElementById: (id) => elementsById.get(id) || null,
    createElement: (tag) => new FakeElement(tag),
    createElementNS: (_ns, tag) => new FakeElement(tag),
    createDocumentFragment: () => new FakeElement('#fragment'),
    querySelectorAll: (selector) => {
      if (selector === '[data-i18n]') return allElements.filter((e) => e.hasAttribute('data-i18n'));
      if (selector === '[data-i18n-tip]') return allElements.filter((e) => e.hasAttribute('data-i18n-tip'));
      if (selector === '[data-i18n-ph]') return allElements.filter((e) => e.hasAttribute('data-i18n-ph'));
      if (selector === '[data-i18n-label]') return allElements.filter((e) => e.hasAttribute('data-i18n-label'));
      if (selector === '[data-i18n-aria]') return allElements.filter((e) => e.hasAttribute('data-i18n-aria'));
      if (selector === '#tokviz .tk-lang button') return allElements.filter((e) => e.tagName === 'BUTTON' && e.hasAttribute('data-lang'));
      if (selector === '#tokviz [data-preset]') return allElements.filter((e) => e.hasAttribute('data-preset'));
      if (selector === '#tokviz [data-rel-tab]') return allElements.filter((e) => e.hasAttribute('data-rel-tab'));
      if (selector === '#tokviz [data-arc-mode]') return allElements.filter((e) => e.hasAttribute('data-arc-mode'));
      if (selector === '#tokviz [data-rel-head]') return allElements.filter((e) => e.hasAttribute('data-rel-head'));
      return [];
    },
    addEventListener(ev, fn) { (docListeners[ev] ||= []).push(fn); }
  };

  const context = vm.createContext({
    window: windowObj,
    document: documentObj,
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v))
    },
    matchMedia: () => ({ matches: false }),
    IntersectionObserver: class { observe() {} },
    ResizeObserver: class { observe() {} },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    performance: { now: () => 1000 },
    TextEncoder,
    TextDecoder,
    Promise, setTimeout, clearTimeout,
    Array, Object, Math, JSON, Error, RegExp, Set, Map, Symbol
  });
  context.globalThis = context;
  windowObj.document = documentObj;

  // Extract inline <script> blocks from index.html
  const scripts = [];
  const scriptRe = /<script>([\s\S]*?)<\/script>/g;
  let sm;
  while ((sm = scriptRe.exec(HTML))) scripts.push(sm[1]);

  for (const code of scripts) {
    const s = new vm.Script(code, {
      importModuleDynamically: () => Promise.reject(new Error('offline-test'))
    });
    s.runInContext(context);
  }

  return { hookApi, elementsById, allElements, documentObj, windowObj, storage };
}

test('TEST-001 (R001): no lucide dead dependency and host contract preserved', () => {
  assert.equal(/lucide/i.test(HTML), false, 'index.html should not reference lucide');
  assert.equal(/data-lucide/i.test(HTML), false, 'index.html should not contain data-lucide');
  assert.equal(/图标/.test(README), false, 'README.md should not mention icon CDN loading');
  assert.match(HTML, /window\.__TOKEN_FULLPAGE__\s*=\s*true/);
  assert.match(HTML, /window\.zcode\s*=/);
  assert.match(HTML, /token-widget-state/);
  assert.match(HTML, /zcode:set_globals/);
});

test('TEST-002 (R002): 4-language i18n dictionary complete and updates optgroup & aria-label', () => {
  const { hookApi, elementsById } = createDomSandbox();
  const baseKeys = Object.keys(hookApi.I18N['zh-CN']).sort();
  for (const lang of hookApi.ALL_LANGS) {
    assert.deepEqual(Object.keys(hookApi.I18N[lang]).sort(), baseKeys, `Missing keys in ${lang}`);
  }

  hookApi.applyLang('en');
  assert.equal(elementsById.get('og-real').getAttribute('label'), 'GPT official vocabs');
  assert.equal(elementsById.get('og-local').getAttribute('label'), 'Local baselines (offline)');
  assert.equal(elementsById.get('tk-chips').getAttribute('aria-label'), 'Tokenized output');

  hookApi.applyLang('ja');
  assert.equal(elementsById.get('og-real').getAttribute('label'), 'GPT 公式語彙');
  assert.equal(elementsById.get('og-local').getAttribute('label'), 'ローカル基準（オフライン可）');
  assert.equal(elementsById.get('tk-chips').getAttribute('aria-label'), 'トークン分割結果');

  hookApi.applyLang('zh-TW');
  assert.equal(elementsById.get('og-real').getAttribute('label'), 'GPT 系列真實詞表');
  assert.equal(elementsById.get('tk-chips').getAttribute('aria-label'), 'Token 切分結果');
});

test('TEST-003 (R003): ensureModule falls back on hung CDN timeout and handles total failure', async () => {
  const { hookApi, elementsById } = createDomSandbox();
  const sel = elementsById.get('tk-enc');
  sel.value = 'o200k';

  // Primary CDN hangs forever; secondary CDN resolves after 5ms
  let calls = [];
  const ok = await hookApi.ensureModule('o200k', 25, (url) => {
    calls.push(url);
    if (calls.length === 1) return new Promise(() => {}); // hung
    return Promise.resolve({ encode: (txt) => [1, 2], decode: () => txtSlice(txt) });
  });
  function txtSlice() { return 'ok'; }
  assert.equal(ok, true);
  assert.equal(calls.length, 2);
  assert.equal(hookApi.getModEnc(), 'o200k');

  // Both CDNs hang -> returns false within timeout
  const failOk = await hookApi.ensureModule('cl100k', 20, () => new Promise(() => {}));
  assert.equal(failOk, false);
});

test('TEST-004 (R004): UTF8E reused, animation cap at 250, long-text debounce, and local/approx tokenizers', async () => {
  const matches = HTML.match(/new TextEncoder\(/g) || [];
  assert.equal(matches.length, 1, 'UTF8E should be instantiated only once');

  const { hookApi, elementsById } = createDomSandbox();
  const input = elementsById.get('tk-input');
  const chipsEl = elementsById.get('tk-chips');
  const sel = elementsById.get('tk-enc');

  // Local baselines: char & utf8
  const charRes = hookApi.localTokens('A你👋', 'char');
  assert.equal(charRes.count, 3);
  assert.equal(charRes.chips[1].id, '你'.codePointAt(0));
  assert.equal(charRes.chips[2].id, '👋'.codePointAt(0));

  const utf8Res = hookApi.localTokens('你', 'utf8');
  assert.equal(utf8Res.count, 3);
  assert.deepEqual(Array.from(utf8Res.chips, (c) => c.text), ['\u2039E4\u203A', '\u2039BD\u203A', '\u2039A0\u203A']);

  // approxTokens & classifyReal
  const approx = hookApi.approxTokens('Hello 世界 123!');
  assert.deepEqual(Array.from(approx, (t) => t.text), ['Hel', 'lo', ' ', '世', '界', ' 123', '!']);
  assert.deepEqual(Array.from(approx, (t) => t.type), ['word', 'word', 'ws', 'cjk', 'cjk', 'num', 'punct']);
  assert.equal(hookApi.classifyReal('hello'), 'word');
  assert.equal(hookApi.classifyReal('汉字'), 'cjk');
  assert.equal(hookApi.classifyReal(' 42'), 'num');
  assert.equal(hookApi.classifyReal('   '), 'ws');
  assert.equal(hookApi.classifyReal('!@#'), 'punct');

  // Animation threshold: <=250 chips animates, >250 chips skips tk-anim
  sel.value = 'char';
  input.value = 'a'.repeat(10);
  hookApi.render();
  assert.equal(chipsEl.children.every((c) => c.className.includes('tk-anim')), true);

  input.value = 'b'.repeat(300);
  hookApi.render();
  assert.equal(chipsEl.children.length, 300);
  assert.equal(chipsEl.children.some((c) => c.className.includes('tk-anim')), false);

  // Debounce on >500 chars input
  input.value = 'c'.repeat(600);
  input.dispatchEvent({ type: 'input' });
  // Immediately after dispatch, chipsEl should still reflect previous 300 render
  assert.equal(chipsEl.children.length, 300);
  await new Promise((r) => setTimeout(r, 90));
  assert.equal(chipsEl.children.length, 600);
});

test('TEST-005 (R004): Canvas draw() bounding box matches exact full-grid swell math', () => {
  const { hookApi, documentObj } = createDomSandbox();
  hookApi.resize();
  hookApi.swells.length = 0;
  hookApi.swells.push({ x: 20, y: 15, t: 0.4, a: 0.9 });
  hookApi.draw(1.0); // age = 0.6, front = 10.2

  const canvas = documentObj.body.children.find((el) => el.tagName === 'CANVAS');
  assert.ok(canvas, 'Canvas element created');
  // Compute expected count on 1200x800 (CELL=15 -> cols=81, rows=55)
  const size = 15, cols = Math.ceil(1200 / size) + 1, rows = Math.ceil(800 / size) + 1;
  let expected = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const age = 0.6;
      const d = Math.hypot(i - 20, j - 15);
      const front = age * 17;
      const band = Math.exp(-((d - front) * (d - front)) / 8);
      if (band < 0.01) continue;
      const v = (0.9 * band * Math.exp(-age * 1.4)) / (1 + d * 0.015);
      if (v >= 0.035) expected++;
    }
  }
  assert.equal(canvas._drawnCells.length, expected);
  assert.ok(expected > 0);
});

test('TEST-006 (Core & R003): decodeNativeGenerator cross-token UTF-8 stream & race guard', async () => {
  const { hookApi, elementsById } = createDomSandbox();
  const sel = elementsById.get('tk-enc');
  sel.value = 'o200k';

  // Mock gpt-tokenizer with decodeNativeGenerator splitting '你' (E4 BD A0) across 2 tokens
  const mockTokenizer = {
    encode: () => [101, 102],
    bytePairEncodingCoreProcessor: {
      decodeNativeGenerator: function* () {
        yield new Uint8Array([0xE4, 0xBD]);
        yield new Uint8Array([0xA0]);
      }
    }
  };
  const ok = await hookApi.ensureModule('o200k', 50, () => Promise.resolve(mockTokenizer));
  assert.equal(ok, true);

  const res = hookApi.tokenize('你');
  assert.equal(res.count, 2);
  assert.equal(res.chips[0].type, 'byte');
  assert.equal(res.chips[0].text, '\u2039101\u203A');
  assert.equal(res.chips[1].type, 'cjk');
  assert.equal(res.chips[1].text, '你');

  // Race guard: switch sel.value to 'utf8' while 'p50k' resolves late -> modEnc stays 'o200k'
  sel.value = 'utf8';
  await hookApi.ensureModule('p50k', 50, () => new Promise((r) => setTimeout(() => r({ encode: () => [1], decode: () => 'x' }), 15)));
  assert.equal(hookApi.getModEnc(), 'o200k');
});

test('TEST-007 (R006): computeApproxAttention causal mask, softmax sum, structural pairing & 48-token cap', () => {
  const { hookApi } = createDomSandbox();
  const chips = [
    { text: 'fn', type: 'word', id: 1 },
    { text: '(', type: 'punct', id: 2 },
    { text: 'x', type: 'word', id: 3 },
    { text: ',', type: 'punct', id: 4 },
    { text: 'x', type: 'word', id: 3 },
    { text: ')', type: 'punct', id: 5 }
  ];

  for (const head of ['balanced', 'local', 'struct']) {
    const res = hookApi.computeApproxAttention(chips, head);
    assert.equal(res.n, 6);
    assert.equal(res.truncated, false);
    for (let q = 0; q < res.n; q++) {
      let rowSum = 0;
      for (let k = 0; k < res.n; k++) {
        const w = res.weights[q][k];
        if (k > q) assert.equal(w, 0, `causal mask violated at (${q}, ${k})`);
        else assert.ok(w > 0 && w <= 1);
        rowSum += w;
      }
      assert.ok(Math.abs(rowSum - 1) < 1e-9, `row ${q} softmax sum ${rowSum}`);
    }
  }

  // Copy/struct head boosts repeated token (idx 4 -> idx 2) and matching bracket (idx 5 -> idx 1)
  const structRes = hookApi.computeApproxAttention(chips, 'struct');
  assert.ok(structRes.weights[4][2] > structRes.weights[4][1], 'repeated token should get higher attention than non-matching neighbor');
  assert.ok(structRes.weights[5][1] > structRes.weights[5][3], 'closing paren should attend strongly to opening paren');

  // 48-token cap
  const many = Array.from({ length: 60 }, (_, i) => ({ text: 't' + i, type: 'word', id: i }));
  const capped = hookApi.computeApproxAttention(many, 'balanced');
  assert.equal(capped.n, 48);
  assert.equal(capped.truncated, true);
});

test('TEST-008 (R006): computeTransitions, collapsible panel toggle, tab views & bidirectional focus lock', () => {
  const { hookApi, elementsById, allElements } = createDomSandbox();
  const sel = elementsById.get('tk-enc');
  const input = elementsById.get('tk-input');
  const relBtn = elementsById.get('tk-rel-btn');
  const relPanel = elementsById.get('tk-rel-panel');
  const relBody = elementsById.get('tk-rel-body');
  const chipsEl = elementsById.get('tk-chips');

  sel.value = 'char';
  input.value = 'ababa';
  hookApi.render();

  // Transitions check
  const trans = hookApi.computeTransitions(Array.from(chipsEl.children, (_, i) => ({
    text: 'ababa'[i], type: 'word', id: 'ababa'.charCodeAt(i)
  })));
  assert.equal(trans.totalTransitions, 4);
  assert.equal(trans.repeats.length, 2); // 'a' x3, 'b' x2
  assert.equal(trans.topEdges[0].count, 2); // a->b and b->a each x2

  // Default collapsed
  assert.equal(hookApi.getRelState().relOpen, false);
  assert.equal(relPanel.hidden, true);
  assert.equal(relBody.children.length, 0);

  // Open panel -> renders SVG arc diagram
  relBtn.dispatchEvent({ type: 'click' });
  assert.equal(hookApi.getRelState().relOpen, true);
  assert.equal(relPanel.hidden, false);
  assert.ok(relBody.children.length > 0);

  // Click chip #2 -> pins focus and highlights chip
  chipsEl.dispatchEvent({ type: 'click', target: chipsEl.children[2] });
  assert.equal(hookApi.getRelState().lockedIdx, 2);
  assert.equal(chipsEl.children[2].classList.contains('tk-focus'), true);

  // Click chip #2 again -> unpins
  chipsEl.dispatchEvent({ type: 'click', target: chipsEl.children[2] });
  assert.equal(hookApi.getRelState().lockedIdx, -1);

  // Switch to Attention Matrix & Transition Matrix tabs
  const attnTab = allElements.find((e) => e.getAttribute('data-rel-tab') === 'attn');
  const adjTab = allElements.find((e) => e.getAttribute('data-rel-tab') === 'adj');
  attnTab.dispatchEvent({ type: 'click' });
  assert.equal(hookApi.getRelState().relTab, 'attn');
  assert.ok(relBody.children.length > 0);

  adjTab.dispatchEvent({ type: 'click' });
  assert.equal(hookApi.getRelState().relTab, 'adj');
  assert.ok(relBody.children.length > 0);
});


