// Quick-Dev (UI) questions: builds the sandboxed preview document and runs DOM checks inside a hidden iframe.
import { summarize } from './compare.js';

const HARNESS = `(function(){
  var AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
  var ready = new Promise(function(res){
    function go(){ setTimeout(res, 50); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  });
  window.addEventListener('message', async function(e){
    var d = e.data; if (!d || d.type !== 'run-checks') return;
    await ready;
    var results = [];
    for (var k = 0; k < d.checks.length; k++) {
      var c = d.checks[k];
      try { var r = await new AsyncFunction(c.src)(); results.push({ i: c.i, passed: !!r }); }
      catch (err) { results.push({ i: c.i, passed: false, error: String((err && err.message) || err) }); }
    }
    parent.postMessage({ type: 'check-results', results: results }, '*');
  });
})();`;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const safeScript = (js) => String(js).replace(/<\/script/gi, '<\\/script');
const safeStyle = (css) => String(css).replace(/<\/style/gi, '<\\/style');

/** Inline style.css / script.js (any extra files) into index.html. */
export function buildSrcDoc(files, { harness = false } = {}) {
  let html = String(files['index.html'] ?? '');
  for (const name of Object.keys(files)) {
    if (name === 'index.html') continue;
    const n = esc(name);
    if (/\.css$/i.test(name)) {
      const re = new RegExp(`<link[^>]*href=["']${n}["'][^>]*>`, 'i');
      const tag = `<style>${safeStyle(files[name])}</style>`;
      html = re.test(html) ? html.replace(re, () => tag) : (/<\/head>/i.test(html) ? html.replace(/<\/head>/i, () => `${tag}</head>`) : tag + html);
    } else if (/\.js$/i.test(name)) {
      const re = new RegExp(`<script[^>]*src=["']${n}["'][^>]*>\\s*</script>`, 'i');
      const tag = `<script>${safeScript(files[name])}</script>`;
      html = re.test(html) ? html.replace(re, () => tag) : (/<\/body>/i.test(html) ? html.replace(/<\/body>/i, () => `${tag}</body>`) : html + tag);
    }
  }
  if (!harness) return html;
  const h = `<script>${HARNESS}</script>`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + h);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${h}</head>`);
  return `<!DOCTYPE html><html><head>${h}</head><body>${html}</body></html>`;
}

function runOneCheck(srcdoc, check, timeoutMs) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:900px;height:700px;border:0;visibility:hidden';
    let done = false;
    const finish = (r) => {
      if (done) return; done = true;
      window.removeEventListener('message', onMsg); clearTimeout(timer);
      iframe.remove(); resolve(r);
    };
    const onMsg = (e) => {
      if (e.source !== iframe.contentWindow || e.data?.type !== 'check-results') return;
      const r = e.data.results?.[0];
      finish(r ? { passed: !!r.passed, message: r.error } : { passed: false, message: 'No result' });
    };
    const timer = setTimeout(() => finish({ passed: false, message: 'Check timed out.' }), timeoutMs);
    window.addEventListener('message', onMsg);
    iframe.addEventListener('load', () => {
      try { iframe.contentWindow.postMessage({ type: 'run-checks', checks: [{ i: 0, src: check }] }, '*'); } catch { finish({ passed: false, message: 'Could not run check.' }); }
    });
    iframe.srcdoc = srcdoc;
    document.body.appendChild(iframe);
  });
}

/** Each check runs against a freshly loaded copy of the candidate's page, so checks cannot affect each other. */
export async function runUiChecks(question, files, { onlyVisible = false, timeoutMs = 4000 } = {}) {
  const srcdoc = buildSrcDoc(files || {}, { harness: true });
  const tests = (question.tests || []).map((t, index) => ({ ...t, index })).filter((t) => t.check && (!onlyVisible || !t.hidden));
  const results = [];
  for (const t of tests) {
    const r = await runOneCheck(srcdoc, t.check, timeoutMs);
    results.push({ index: t.index, name: t.name || `Check ${t.index + 1}`, hidden: !!t.hidden, weight: t.weight ?? 1, passed: r.passed, message: r.passed ? undefined : (r.message || 'Check failed') });
  }
  return summarize(results);
}
