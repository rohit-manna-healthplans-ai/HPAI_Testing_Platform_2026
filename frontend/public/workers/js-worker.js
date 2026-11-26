/* JavaScript marking worker (classic worker).
 * in : { type:'run', code, fn, tests:[{ index, args }] }
 * out: { type:'started' } | { type:'compile-error', message } | { type:'result', index, json?, error? } | { type:'done' }
 * The main thread enforces time limits by terminating this worker.
 */
self.onmessage = function (e) {
  var msg = e.data;
  if (msg && msg.type === 'bench') { runBench(msg); return; }
  if (!msg || msg.type !== 'run') return;
  var post = self.postMessage.bind(self);
  post({ type: 'started' });

  var f;
  try {
    // Shadow a few powerful globals so candidate code cannot message the page or hit the network.
    var factory = new Function(
      'postMessage', 'fetch', 'XMLHttpRequest', 'importScripts', 'WebSocket',
      msg.code + '\n;return (typeof ' + msg.fn + ' === "function") ? ' + msg.fn + ' : undefined;'
    );
    f = factory();
  } catch (err) {
    post({ type: 'compile-error', message: String((err && err.message) || err) });
    return;
  }
  if (!f) {
    post({ type: 'compile-error', message: 'Function "' + msg.fn + '" is not defined. Keep the function name unchanged.' });
    return;
  }

  for (var i = 0; i < msg.tests.length; i++) {
    var t = msg.tests[i];
    try {
      var out = f.apply(null, t.args || []);
      var json = JSON.stringify(out);
      if (json === undefined) post({ type: 'result', index: t.index, error: 'Function returned undefined (did you forget to return a value?)' });
      else post({ type: 'result', index: t.index, json: json });
    } catch (err) {
      post({ type: 'result', index: t.index, error: String((err && err.message) || err) });
    }
  }
  post({ type: 'done' });
};

/* ── Complexity benchmark (reviewer tool) ─────────────────────────────────────────────────────────────
 * in : { type:'bench', code, fn, gen:'(n, rnd) => [args]', sizes:[n...], perSizeMs, budgetMs }
 * out: { type:'started' } | { type:'compile-error', message } | { type:'bench-point', n, ms, k } | { type:'bench-error', n, message } | { type:'bench-done', reason }
 * Generation of inputs is excluded from the timing; every timed call gets freshly generated arguments.
 */
function runBench(msg) {
  var post = self.postMessage.bind(self);
  post({ type: 'started' });
  var f, gen;
  try {
    var factory = new Function(
      'postMessage', 'fetch', 'XMLHttpRequest', 'importScripts', 'WebSocket',
      msg.code + '\n;return (typeof ' + msg.fn + ' === "function") ? ' + msg.fn + ' : undefined;'
    );
    f = factory();
  } catch (err) { post({ type: 'compile-error', message: String((err && err.message) || err) }); return; }
  if (!f) { post({ type: 'compile-error', message: 'Function "' + msg.fn + '" is not defined. Keep the function name unchanged.' }); return; }
  try { gen = new Function('return (' + msg.gen + ')')(); } catch (err) { post({ type: 'compile-error', message: 'Input generator failed: ' + String((err && err.message) || err) }); return; }

  var seed = 20240611;
  function rnd() { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  var now = function () { return (typeof performance !== 'undefined' ? performance.now() : Date.now()); };
  var perSize = msg.perSizeMs || 1500, budget = msg.budgetMs || 8000;
  // Warm-up: ~40 ms of calls on the smallest size so the JIT settles before anything is timed (errors surface in the main loop).
  try { var ws = now(), wc = 0; while (now() - ws < 40 && wc < 5000) { f.apply(null, gen(msg.sizes[0], rnd)); wc++; } } catch (e) { /* reported below */ }
  var t0 = now(), prev = null;

  for (var i = 0; i < msg.sizes.length; i++) {
    var n = msg.sizes[i];
    var single, pure = false, a1;
    try {
      a1 = gen(n, rnd);
      var snap = JSON.stringify(a1); // a function that leaves its input untouched can be re-run on the same input (cheap batching)
      var s = now(); f.apply(null, a1); single = now() - s;
      pure = JSON.stringify(a1) === snap;
    } catch (err) { post({ type: 'bench-error', n: n, message: String((err && err.message) || err) }); post({ type: 'bench-done', reason: 'error' }); return; }
    var kCap = pure ? 20000 : Math.min(200, Math.floor(3e6 / Math.max(n, 1))); // impure: k fresh copies of the input must stay small
    var k = Math.max(1, Math.min(kCap, Math.ceil(2 / Math.max(single, pure ? 0.0001 : 0.005))));
    var reps = single * k > perSize * 0.5 ? 1 : Math.max(1, Math.min(5, Math.floor((perSize * 0.6) / Math.max(single * k, 0.01))));
    var samples = [];
    try {
      // the first batch is an untimed warm-up (JIT / caches) when the function is fast enough to afford it
      for (var r = (single < 50 ? -1 : 0); r < reps; r++) {
        var sets = []; for (var j = 0; j < k; j++) sets.push(pure ? a1 : gen(n, rnd));
        var st = now(); for (var q = 0; q < k; q++) f.apply(null, sets[q]); var took = (now() - st) / k;
        if (r >= 0) samples.push(took);
      }
    } catch (err2) { post({ type: 'bench-error', n: n, message: String((err2 && err2.message) || err2) }); post({ type: 'bench-done', reason: 'error' }); return; }
    samples.sort(function (x, y) { return x - y; });
    var ms = samples[Math.floor(samples.length / 2)];
    post({ type: 'bench-point', n: n, ms: ms, k: k });
    // Decide whether the next size would blow the per-size / total budget.
    var next = msg.sizes[i + 1];
    if (next === undefined) break;
    var slope = prev && prev.ms > 0 && ms > 0 ? Math.min(3, Math.max(1, Math.log(ms / prev.ms) / Math.log(n / prev.n))) : 2;
    var projected = ms * Math.pow(next / n, slope);
    prev = { n: n, ms: ms };
    if (projected > perSize * 0.9 || now() - t0 + projected * 2 > budget) { post({ type: 'bench-done', reason: 'budget' }); return; }
  }
  post({ type: 'bench-done', reason: 'complete' });
}
