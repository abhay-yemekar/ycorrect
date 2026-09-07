import vm from 'node:vm';
import { readFileSync } from 'node:fs';

export async function contentHarness() {
  const listeners = new Map();
  const timers = new Map();
  let timerId = 0;
  function element() {
    return {
      style: {}, dataset: {}, children: [], isConnected: true,
      appendChild(child) { this.children.push(child); child.parentNode = this; },
      remove() { this.isConnected = false; },
      setAttribute() {}, addEventListener() {}, contains() { return false; },
      querySelector() { return element(); }, querySelectorAll() { return []; },
      attachShadow() { const root = element(); root.host = this; return root; },
    };
  }
  class Field {
    constructor(value) { this.value = value; this.tagName = 'TEXTAREA'; this.isConnected = true; }
    get value() { return this._value; }
    set value(value) { this._value = value; }
    focus() {} dispatchEvent() {} matches() { return false; }
    getAttribute() { return null; }
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  }
  const document = {
    documentElement: element(), body: element(), activeElement: null,
    createElement: element,
    addEventListener(name, handler) { listeners.set(name, handler); },
    createTreeWalker(field) { let i = 0; return { nextNode: () => field.nodes[i++] || null }; },
    createRange() { return {
      setStart(node, offset) { this.startContainer = node; this.startOffset = offset; },
      setEnd(node, offset) { this.endContainer = node; this.endOffset = offset; },
      getClientRects() { return [{ left: 10, top: 20, width: 30, height: 14 }]; }, detach() {},
    }; },
  };
  const context = vm.createContext({
    document, window: { HTMLTextAreaElement: Field, HTMLInputElement: Field, addEventListener() {} },
    location: { hostname: 'test.invalid' }, Event: class {}, NodeFilter: { SHOW_TEXT: 4 },
    MutationObserver: class { observe() {} },
    chrome: { storage: { sync: { get: async () => ({ disabledSites: ['test.invalid'] }) }, onChanged: { addListener() {} } }, runtime: { sendMessage: async () => ({}) } },
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout(id) { timers.delete(id); },
    setInterval() { return 1; }, clearInterval() {},
  });
  const manifest = JSON.parse(readFileSync(new URL('../../../apps/extension/manifest.json', import.meta.url)));
  for (const file of manifest.content_scripts[0].js) {
    await new vm.Script(readFileSync(new URL('../../../apps/extension/' + file, import.meta.url), 'utf8'), { filename: file }).runInContext(context);
  }
  vm.runInContext('siteEnabled = true', context);
  return { context, timers, listeners, Field, run: source => vm.runInContext(source, context) };
}
