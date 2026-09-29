import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { buildDocument } from '../compiler/document.mjs';

const parser = new JSDOM('');
globalThis.DOMParser = parser.window.DOMParser;

test('combines a fragment, styles, and working DOM event handlers', () => {
  const output = buildDocument({
    html: '<button id="test">Click</button>',
    css: 'button { color: rgb(255, 0, 0); }',
    javascript: 'document.querySelector("button").onclick = () => { document.querySelector("button").textContent = "Working"; };',
  });
  const preview = new JSDOM(output, { runScripts: 'dangerously' });
  const button = preview.window.document.querySelector('button');
  button.click();
  assert.equal(button.textContent, 'Working');
  assert.equal(preview.window.getComputedStyle(button).color, 'rgb(255, 0, 0)');
  assert.ok(preview.window.document.querySelector('meta[charset]'));
  assert.ok(preview.window.document.querySelector('meta[name="viewport"]'));
  assert.equal(preview.window.document.querySelector('iframe'), null);
  preview.window.close();
});

test('preserves full documents, external assets, and HTML script execution order', () => {
  const output = buildDocument({
    html: '<!doctype html><html lang="fr"><head><title>My page</title><meta name="viewport" content="width=500"><link rel="stylesheet" href="https://example.com/style.css"></head><body><script>window.order = [1];</script><script src="https://example.com/script.js"></script></body></html>',
    css: '', javascript: 'window.order.push(2);',
  });
  const preview = new JSDOM(output, { runScripts: 'dangerously' });
  assert.equal(preview.window.document.title, 'My page');
  assert.equal(preview.window.document.documentElement.lang, 'fr');
  assert.deepEqual([...preview.window.order], [1, 2]);
  assert.equal(preview.window.document.querySelectorAll('meta[name="viewport"]').length, 1);
  assert.equal(preview.window.document.querySelector('link').href, 'https://example.com/style.css');
  assert.equal(preview.window.document.querySelector('script[src]').src, 'https://example.com/script.js');
  preview.window.close();
});

test('JavaScript string literals cannot accidentally terminate the generated script', () => {
  const output = buildDocument({ html: '', css: '', javascript: 'document.body.textContent = "</script><p>Hello</p>";' });
  const preview = new JSDOM(output, { runScripts: 'dangerously' });
  assert.equal(preview.window.document.body.textContent, '</script><p>Hello</p>');
  assert.equal(preview.window.document.querySelector('p'), null);
  preview.window.close();
});
