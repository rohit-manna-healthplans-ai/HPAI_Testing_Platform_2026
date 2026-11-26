/* Python marking worker (Pyodide, classic worker). Pyodide is cached by the browser; this worker is reused across runs.
 * in : { type:'warmup' } | { type:'run', code, fn, tests:[{ index, args }] }
 * out: { type:'ready' } | { type:'started' } | { type:'compile-error', message } | { type:'result', index, json?, error? } | { type:'done' } | { type:'fatal', message }
 */
var PYODIDE_VERSION = 'v0.26.4';
var INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/' + PYODIDE_VERSION + '/full/';

var HELPERS = [
  'import json',
  '_ns = {}',
  'def _hpai_load(code):',
  '    global _ns',
  '    _ns = {"__name__": "__main__"}',
  '    exec(compile(code, "<solution>", "exec"), _ns)',
  'def _hpai_call(fn, args_json):',
  '    f = _ns.get(fn)',
  '    if not callable(f):',
  '        raise NameError("function \'%s\' is not defined - keep the function name unchanged" % fn)',
  '    def _d(o):',
  '        if isinstance(o, (set, frozenset)):',
  '            try:',
  '                return sorted(o)',
  '            except Exception:',
  '                return list(o)',
  '        raise TypeError("Object of type %s is not JSON serializable" % type(o).__name__)',
  '    return json.dumps(f(*json.loads(args_json)), default=_d, allow_nan=False)'
].join('\n');

/* Complexity benchmark helpers (reviewer tool). Input generation/JSON parsing happens before the timer starts. */
var BENCH_HELPERS = [
  'import time, tracemalloc',
  'def _hpai_fn(fn):',
  '    f = _ns.get(fn)',
  '    if not callable(f):',
  '        raise NameError("function %s is not defined - keep the function name unchanged" % fn)',
  '    return f',
  'def _hpai_probe(fn, args_json):',
  '    f = _hpai_fn(fn)',
  '    a1 = json.loads(args_json)',
  '    a2 = json.loads(args_json)',
  '    t = time.perf_counter()',
  '    f(*a1)',
  '    el = (time.perf_counter() - t) * 1000.0',
  '    return json.dumps([el, a1 == a2])',
  'def _hpai_bench(fn, args_json, k, want_mem, pure):',
  '    f = _hpai_fn(fn)',
  '    if pure:',
  '        shared = json.loads(args_json)',
  '        sets = [shared] * k',
  '    else:',
  '        sets = [json.loads(args_json) for _ in range(k)]',
  '    t = time.perf_counter()',
  '    for a in sets:',
  '        f(*a)',
  '    el = time.perf_counter() - t',
  '    sets = None',
  '    mem = None',
  '    if want_mem:',
  '        a = json.loads(args_json)',
  '        tracemalloc.start()',
  '        try:',
  '            f(*a)',
  '        finally:',
  '            mem = tracemalloc.get_traced_memory()[1]',
  '            tracemalloc.stop()',
  '    return json.dumps([el * 1000.0 / k, mem])'
].join('\n');

var pyReady = null;
function boot() {
  if (!pyReady) {
    pyReady = (async function () {
      importScripts(INDEX_URL + 'pyodide.js');
      var py = await loadPyodide({ indexURL: INDEX_URL });
      py.setStdout({ batched: function () {} });
      py.setStderr({ batched: function () {} });
      py.runPython(HELPERS);
      py.runPython(BENCH_HELPERS);
      return py;
    })();
    pyReady.catch(function () { pyReady = null; });
  }
  return pyReady;
}

function cleanError(err) {
  var text = String((err && err.message) || err);
  var lines = text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  var last = lines.length ? lines[lines.length - 1] : text;
  var m = text.match(/File "<solution>", line (\d+)/g);
  if (m && m.length) {
    var n = m[m.length - 1].match(/line (\d+)/)[1];
    last += ' (line ' + n + ')';
  }
  return last;
}

self.onmessage = async function (e) {
  var msg = e.data;
  if (!msg) return;
  if (msg.type === 'warmup') {
    try { await boot(); self.postMessage({ type: 'ready' }); }
    catch (err) { self.postMessage({ type: 'fatal', message: 'Could not load the Python runtime. Check your internet connection or switch to JavaScript.' }); }
    return;
  }
  if (msg.type === 'bench') { await runBench(msg); return; }
  if (msg.type !== 'run') return;

  var py;
  try { py = await boot(); }
  catch (err) { self.postMessage({ type: 'fatal', message: 'Could not load the Python runtime. Check your internet connection or switch to JavaScript.' }); return; }
  self.postMessage({ type: 'started' });

  try { py.globals.get('_hpai_load')(msg.code); }
  catch (err) { self.postMessage({ type: 'compile-error', message: cleanError(err) }); return; }

  var call = py.globals.get('_hpai_call');
  for (var i = 0; i < msg.tests.length; i++) {
    var t = msg.tests[i];
    try {
      var json = call(msg.fn, JSON.stringify(t.args || []));
      self.postMessage({ type: 'result', index: t.index, json: json });
    } catch (err) {
      self.postMessage({ type: 'result', index: t.index, error: cleanError(err) });
    }
  }
  self.postMessage({ type: 'done' });
};

/* in : { type:'bench', code, fn, gen:'(n, rnd) => [args]', sizes:[n...], perSizeMs, budgetMs }
 * out: { type:'started' } | { type:'compile-error' } | { type:'bench-point', n, ms, bytes, k } | { type:'bench-error', n, message } | { type:'bench-done', reason } | { type:'fatal' } */
async function runBench(msg) {
  var post = self.postMessage.bind(self);
  var py;
  try { py = await boot(); }
  catch (err) { post({ type: 'fatal', message: 'Could not load the Python runtime. Check your internet connection.' }); return; }
  post({ type: 'started' });
  var gen;
  try { gen = new Function('return (' + msg.gen + ')')(); } catch (err) { post({ type: 'compile-error', message: 'Input generator failed: ' + String((err && err.message) || err) }); return; }
  try { py.globals.get('_hpai_load')(msg.code); } catch (err) { post({ type: 'compile-error', message: cleanError(err) }); return; }
  var bench = py.globals.get('_hpai_bench');
  var probeFn = py.globals.get('_hpai_probe');
  var seed = 20240611;
  function rnd() { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  var now = function () { return (typeof performance !== 'undefined' ? performance.now() : Date.now()); };
  var perSize = msg.perSizeMs || 1500, budget = msg.budgetMs || 8000;
  var t0 = now(), prev = null;
  for (var i = 0; i < msg.sizes.length; i++) {
    var n = msg.sizes[i];
    var single, argsJson, pure = false;
    try {
      argsJson = JSON.stringify(gen(n, rnd));
      var probe = JSON.parse(probeFn(msg.fn, argsJson)); // one timed call + "did the function leave its input untouched?"
      single = probe[0]; pure = !!probe[1];
    } catch (err) { post({ type: 'bench-error', n: n, message: cleanError(err) }); post({ type: 'bench-done', reason: 'error' }); return; }
    var kCap = pure ? 20000 : Math.min(200, Math.floor(3e6 / Math.max(n, 1))); // impure: k fresh copies of the input must stay small
    var k = Math.max(1, Math.min(kCap, Math.ceil(2 / Math.max(single, pure ? 0.0005 : 0.005))));
    var reps = single * k > perSize * 0.5 ? 1 : Math.max(1, Math.min(5, Math.floor((perSize * 0.6) / Math.max(single * k, 0.01))));
    var samples = [], bytes = null;
    try {
      for (var r = (single < 50 ? -1 : 0); r < reps; r++) { // first batch is an untimed warm-up
        var res = JSON.parse(bench(msg.fn, pure ? argsJson : JSON.stringify(gen(n, rnd)), k, false, pure));
        if (r >= 0) samples.push(res[0]);
      }
      if (single < 300) { var mres = JSON.parse(bench(msg.fn, argsJson, 1, true, true)); bytes = mres[1]; }
    } catch (err2) { post({ type: 'bench-error', n: n, message: cleanError(err2) }); post({ type: 'bench-done', reason: 'error' }); return; }
    samples.sort(function (x, y) { return x - y; });
    var ms = samples[Math.floor(samples.length / 2)];
    post({ type: 'bench-point', n: n, ms: ms, bytes: bytes, k: k });
    var next = msg.sizes[i + 1];
    if (next === undefined) break;
    var slope = prev && prev.ms > 0 && ms > 0 ? Math.min(3, Math.max(1, Math.log(ms / prev.ms) / Math.log(n / prev.n))) : 2;
    var projected = ms * Math.pow(next / n, slope);
    prev = { n: n, ms: ms };
    if (projected > perSize * 0.9 || now() - t0 + projected * 2 > budget) { post({ type: 'bench-done', reason: 'budget' }); return; }
  }
  post({ type: 'bench-done', reason: 'complete' });
}
