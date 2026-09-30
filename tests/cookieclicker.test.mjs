import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { JSDOM, VirtualConsole } from 'jsdom';

const publicDir = path.resolve('public');
const gameDir = path.join(publicDir, 'cookieclicker');
const html = fs.readFileSync(path.join(gameDir, 'index.html'), 'utf8');

test('bundles referenced HTML and CSS assets without copied tracking or frames', () => {
  const document = new JSDOM(html).window.document;
  for (const element of document.querySelectorAll('script[src],link[href]')) {
    const value = element.getAttribute('src') || element.getAttribute('href');
    assert.ok(fs.existsSync(path.join(gameDir, value.split('?')[0])), value);
  }
  const css = fs.readFileSync(path.join(gameDir, 'style.css'), 'utf8') + html;
  for (const match of css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) {
    assert.ok(fs.existsSync(path.join(gameDir, match[1].split('?')[0])), match[1]);
  }
  assert.doesNotMatch(html, /<iframe|googlesyndication|fbevents|cdn-cgi|cookieconsent_options/);
  for (const name of ['Garden', 'Grimoire', 'Market', 'Pantheon']) {
    assert.ok(fs.existsSync(path.join(gameDir, `minigame${name}.js`)));
  }
});

test('serves the game directly and supports clicking, buying, saving, and reloading', async t => {
  const app = express();
  app.use(express.static(publicDir));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.on('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const redirect = await fetch(origin + '/cookieclicker', { redirect: 'manual' });
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get('location'), '/cookieclicker/');
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = await JSDOM.fromURL(origin + '/cookieclicker/', {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole,
    beforeParse(window) {
      // jsdom has no graphics/audio engine; exercise the real game with media stubs.
      window.CanvasRenderingContext2D = function () {};
      window.HTMLCanvasElement.prototype.getContext = function () {
        return new Proxy({ canvas: this }, { get(target, key) {
          if (key in target) return target[key];
          if (key === 'measureText') return () => ({ width: 30 });
          if (key === 'getImageData') return () => ({ data: new Uint8ClampedArray(40000) });
          if (String(key).startsWith('create')) return () => ({ addColorStop() {} });
          return () => {};
        } });
      };
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
      window.HTMLMediaElement.prototype.pause = () => {};
      window.HTMLMediaElement.prototype.load = () => {};
      window.Image = class {
        width = 256; height = 256;
        set src(value) {
          this._src = value;
          assert.ok(fs.existsSync(path.join(publicDir, new URL(value, origin + '/cookieclicker/').pathname)), value);
          window.setTimeout(() => this.onload?.({ target: this }), 0);
        }
        get src() { return this._src; }
      };
      window.localStorage.setItem('CookieClickerLang', 'EN');
    },
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  const deadline = Date.now() + 15000;
  while ((!window.Game?.ready || !window.Game?.Objects?.Cursor || window.Game.T < 5) && Date.now() < deadline && !errors.length) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.deepEqual(errors, []);
  const game = window.Game;
  assert.equal(game.ready, 1);
  const before = game.cookies;
  window.document.getElementById('bigCookie').click();
  assert.ok(game.cookies > before, 'click earns cookies');
  game.Earn(100);
  game.Objects.Cursor.buy(1);
  assert.equal(game.Objects.Cursor.amount, 1);
  game.WriteSave();
  const saved = window.localStorage.getItem('CookieClickerGame-WAMO');
  assert.ok(saved?.length > 100);
  const cookies = game.cookies;
  game.cookies = 0;
  game.LoadSave(saved);
  assert.ok(game.cookies >= cookies, 'save restores cookie balance');
  assert.equal(game.Objects.Cursor.amount, 1);
  assert.deepEqual(errors, []);
});
