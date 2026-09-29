import React, { useEffect, useRef, useState } from 'react';
import { buildDocument } from './document.mjs';
import './compiler.css';

const initial = {
  html: '<main>\n  <span class="badge">MADE IN YOUR BROWSER</span>\n  <h1>Hello, world.</h1>\n  <p>A little HTML. A little CSS. Endless possibilities.</p>\n  <button id="hello">Give it a click</button>\n  <p id="message" aria-live="polite"></p>\n</main>',
  css: 'body {\n  margin: 0;\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  background: #eef2ff;\n  color: #172554;\n  font-family: system-ui, sans-serif;\n}\nmain { padding: 40px; text-align: center; }\n.badge { font-size: 11px; letter-spacing: 3px; color: #6366f1; }\nh1 { font-size: clamp(40px, 8vw, 80px); margin: 24px 0; }\np { line-height: 1.7; }\nbutton {\n  margin-top: 20px;\n  padding: 14px 24px;\n  border: 0;\n  border-radius: 12px;\n  background: #4f46e5;\n  color: white;\n  font: inherit;\n  cursor: pointer;\n}\nbutton:hover { background: #4338ca; }',
  javascript: 'let clicks = 0;\ndocument.querySelector("#hello").addEventListener("click", () => {\n  clicks += 1;\n  document.querySelector("#message").textContent =\n    `It works! You clicked ${clicks} ${clicks === 1 ? "time" : "times"}.`;\n});',
};
type Language = keyof typeof initial;
const languages: Language[] = ['html', 'css', 'javascript'];
const labels = { html: 'HTML', css: 'CSS', javascript: 'JavaScript' };
const storageKey = 'wamo.compiler.draft.v1';

function loadDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (draft && languages.every(key => typeof draft[key] === 'string')) return draft as typeof initial;
  } catch { /* Storage may be unavailable. The editor still works. */ }
  return initial;
}

export default function Compiler() {
  const [source, setSource] = useState(loadDraft);
  const [active, setActive] = useState<Language>('html');
  const [saved, setSaved] = useState('');
  const [status, setStatus] = useState('Ready when you are.');
  const editor = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    document.title = 'HTML Compiler · WAMO';
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(source));
        setSaved('Draft saved on this device');
      } catch { setSaved('Local saving unavailable — download to keep your work'); }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [source]);

  const update = (value: string) => {
    setSource(previous => ({ ...previous, [active]: value }));
    setSaved('Unsaved changes');
  };
  const makeUrl = () => URL.createObjectURL(new Blob([buildDocument(source)], { type: 'text/html;charset=utf-8' }));
  const run = () => {
    const url = makeUrl();
    // A real top-level document gives scripts native browser behavior without a frame.
    const preview = window.open('about:blank', '_blank');
    if (!preview) {
      URL.revokeObjectURL(url);
      setStatus('Your browser blocked the preview. Allow pop-ups for this site and try Run again.');
      return;
    }
    preview.opener = null;
    preview.location.replace(url);
    setStatus('Preview opened in a new tab. Edit your code and run again to see changes.');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const download = () => {
    const url = makeUrl();
    const link = document.createElement('a');
    link.href = url;
    link.download = 'index.html';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setStatus('Downloaded index.html with your HTML, CSS, and JavaScript.');
  };

  return <main className="compiler-page">
    <header className="compiler-header">
      <a className="compiler-brand" href="/">W<span>AMO</span><span className="compiler-divider">/</span><span className="compiler-product">Compiler</span></a>
      <a className="compiler-back" href="/">Back to website ↗</a>
    </header>
    <section className="compiler-intro">
      <div><p className="compiler-eyebrow">YOUR BROWSER IS THE PLAYGROUND</p><h1>Code it. Run it. Make it yours.</h1><p>Write HTML, CSS, and JavaScript. See your creation in its own browser tab.</p></div>
      <span className="compiler-native"><i /> Native browser preview</span>
    </section>
    <section className="compiler-workbench" aria-label="Code editor">
      <div className="compiler-toolbar">
        <div className="compiler-tabs" role="tablist" aria-label="Code language">
          {languages.map((language, index) => <button key={language} id={`tab-${language}`} role="tab" aria-selected={active === language} aria-controls="compiler-panel" tabIndex={active === language ? 0 : -1} className={active === language ? 'active' : ''} onClick={() => setActive(language)} onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
            setActive(languages[next]);
            document.getElementById(`tab-${languages[next]}`)?.focus();
          }}><span className={`compiler-dot ${language}`} />{labels[language]}</button>)}
        </div>
        <div className="compiler-actions"><button onClick={download}>↓ Download HTML</button><button className="compiler-run" onClick={run}>▶ Run code <span>↗</span></button></div>
      </div>
      <div id="compiler-panel" role="tabpanel" aria-labelledby={`tab-${active}`} className="compiler-editor-wrap">
        <div className="compiler-file"><span>{active === 'html' ? 'index.html' : active === 'css' ? 'styles.css' : 'script.js'}</span><span>Plain {labels[active]} · Ctrl / ⌘ + Enter to run</span></div>
        <textarea ref={editor} aria-label={`${labels[active]} code`} value={source[active]} spellCheck={false} autoCapitalize="off" autoCorrect="off" onChange={event => update(event.target.value)} onKeyDown={event => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); run(); }
          if (event.key === 'Tab' && !event.shiftKey) {
            event.preventDefault();
            const { selectionStart: start, selectionEnd: end } = event.currentTarget;
            update(source[active].slice(0, start) + '  ' + source[active].slice(end));
            requestAnimationFrame(() => editor.current?.setSelectionRange(start + 2, start + 2));
          }
        }} />
      </div>
      <footer className="compiler-editor-footer"><span>{saved}</span><span>{source[active].split('\n').length} lines · UTF-8</span></footer>
    </section>
    <div className="compiler-status" role="status">{status}</div>
    <section className="compiler-notes"><div><strong>One page, three languages</strong><p>Paste an HTML fragment or a full document. CSS is added to the head; JavaScript runs after the HTML. Use absolute URLs for external assets.</p></div><div><strong>A real page. No iframe.</strong><p>Run opens a fresh tab. Only run code you trust: the preview is not sandboxed and can access this site’s origin. Shift + Tab leaves the editor.</p></div></section>
  </main>;
}
