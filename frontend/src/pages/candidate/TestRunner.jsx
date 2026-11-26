import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, auth } from '../../api.js';
import { loadBank, getRunnableQuestions, BANK_UPDATED_MESSAGE } from '../../bank/index.js';
import CodeEditor from '../../components/CodeEditor.jsx';
import UIQuestion from '../../runners/UIPreview.jsx';
import {
  runQuestion, defaultResponse, isAnswered, warmUpPython, getSqlPreview, totalTests,
  LANGUAGE_GROUPS, getLanguage, isSyntaxLang, lintLanguage, starterFor, SYNTAX_NOTE,
} from '../../runners/index.js';
import { short } from '../../runners/compare.js';
import {
  useProctoring, MAX_SCREEN_LEAVES, leaveWarningText, leaveLimitReason, submitReasonKey, clearProctoringFlags,
} from '../../utils/proctoring.js';
import { dropQueue, flushEvents } from '../../utils/eventQueue.js';
import './test.css';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Free-tier friendly saving: ONE batched PUT (<= 20 answers) every 45-60 s (+ up to 10 s jitter on the first tick), dirty answers only.
const SAVE_MIN_MS = 45000;
const SAVE_SPAN_MS = 15000;
const SYNC_EVERY_MS = 5 * 60 * 1000; // timer re-sync when no save has refreshed the server clock (e.g. proctor extended the time)
const MAX_PER_SAVE = 20;
const hashPayload = (p) => JSON.stringify([p.response, p.tests_passed, p.tests_total]); // time_spent excluded: it changes every second
const TYPE_LABEL = { coding: 'Coding', sql: 'SQL', nosql: 'NoSQL', ui: 'Quick Dev', mcq: 'MCQ' };
const MIN_RUN_GAP_MS = 1000; // debounce for rapid Run clicks

function fmtTime(sec) {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60;
  const mm = String(m).padStart(2, '0'); const ss = String(r).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
const stamp = () => new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

// ---- local draft <-> server response mapping ----------------------------------------------------
// coding draft: { language, codes: { [languageId]: code } }  (separate code per language, per question)
function codeFor(q, d) { return d.codes[d.language] ?? starterFor(d.language, q); }
function fromResponse(q, resp) {
  switch (q.type) {
    case 'coding': {
      const language = resp?.language || 'python';
      const codes = {};
      if (resp?.code != null) codes[language] = resp.code;
      return { language, codes };
    }
    case 'sql': case 'nosql': return { code: resp?.code ?? defaultResponse(q).code };
    case 'ui': return { files: { ...(q.config?.files || {}), ...(resp?.files || {}) } };
    case 'mcq': return { selected: resp?.selected || [] };
    default: return {};
  }
}
function toResponse(q, d) {
  if (!d) return defaultResponse(q);
  if (q.type === 'coding') {
    const base = { language: d.language, code: codeFor(q, d) };
    return isSyntaxLang(d.language) ? { ...base, mode: 'syntax_only' } : base; // reviewers badge these "Syntax-checked only"
  }
  return d;
}
const draftKey = (id) => `hpai_draft_${id}`;

export default function TestRunner() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [phase, setPhase] = useState('loading'); // loading | error | test
  const [loadError, setLoadError] = useState('');
  const [questions, setQuestions] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [active, setActive] = useState(0);
  const [begun, setBegun] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const [runState, setRunState] = useState({});
  const [saveState, setSaveState] = useState({});
  const [sqlPreviews, setSqlPreviews] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitState, setSubmitState] = useState(null); // {stage:'grading'|'sending'|'error', done,total,error}
  const [toast, setToast] = useState('');
  const [minute, setMinute] = useState(stamp());

  const draftsRef = useRef({});
  const questionsRef = useRef([]);
  const dirtyRef = useRef(new Set());
  const cacheRef = useRef({}); // qid -> payload last graded
  const regradeRef = useRef({}); // qid -> grading failed transiently (e.g. checker could not load); retry later
  const timeRef = useRef({}); // qid -> seconds
  const visitRef = useRef(Date.now());
  const activeRef = useRef(0);
  const offsetRef = useRef(0);
  const endsAtRef = useRef(0);
  const queueRef = useRef(Promise.resolve());
  const submitLock = useRef(false);
  const submittedRef = useRef(false);
  const payloadRef = useRef(null);
  const autoRef = useRef(false);
  const reasonRef = useRef(null);
  const persistTimer = useRef(null);
  const lastRunRef = useRef(0);
  const pendingRef = useRef(new Map()); // qid -> graded payload waiting for the next batched save
  const sentHashRef = useRef({}); // qid -> hash of the payload the server already has
  const failRef = useRef(0); // consecutive failed saves (exponential backoff)
  const retryTimer = useRef(null);
  const lastClockRef = useRef(Date.now()); // last time the server clock/ends_at was refreshed

  activeRef.current = active;
  questionsRef.current = questions;

  const flash = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(''), 2400); }, []);

  const { leaves, blank, warning, dismissWarning, syncLeaves, requestFullscreen } = useProctoring(attemptId, {
    enabled: phase === 'test' && begun && !submitState,
    ready: phase === 'test',
    onNotice: flash,
  });

  // ---- load -----------------------------------------------------------------------------------
  const load = useCallback(async () => {
    setPhase('loading'); setLoadError('');
    try {
      const data = await api.candidate.attempt(attemptId);
      if (data.attempt.status !== 'in_progress') { navigate(`/result/${attemptId}`, { replace: true }); return; }
      offsetRef.current = new Date(data.server_now).getTime() - Date.now();
      endsAtRef.current = new Date(data.attempt.ends_at).getTime();
      if (typeof data.attempt.screen_leaves === 'number') syncLeaves(data.attempt.screen_leaves); // server count wins if higher
      // Question sets live in the frontend code (lazy bank chunk); the API only returns ids + the bank version it was built against.
      const bank = await loadBank();
      if (data.bank_version && data.bank_version !== bank.BANK_VERSION) throw new Error(BANK_UPDATED_MESSAGE);
      // Answers (hidden tests, MCQ correct options) are sealed in the bank; the server released keys for THIS attempt's questions only.
      const qs = await getRunnableQuestions(data.question_ids || [], data.bank_keys || {});
      const answers = data.answers || {};
      let stored = null;
      try { stored = JSON.parse(localStorage.getItem(draftKey(attemptId)) || 'null'); } catch { /* ignore */ }

      const d = {};
      qs.forEach((q) => {
        const a = answers[q.id];
        if (a?.response) {
          cacheRef.current[q.id] = { question_id: q.id, response: a.response, tests_passed: a.tests_passed ?? 0, tests_total: a.tests_total || totalTests(q, a.response.language), time_spent_sec: a.time_spent_sec || 0 };
          sentHashRef.current[q.id] = hashPayload(cacheRef.current[q.id]); // the server already has exactly this
          timeRef.current[q.id] = a.time_spent_sec || 0;
        }
        let draft = fromResponse(q, a?.response || defaultResponse(q));
        const local = stored?.drafts?.[q.id];
        if (local) {
          try {
            const restored = { ...fromResponse(q, toResponse(q, local)) };
            if (q.type === 'coding' && local.codes) restored.codes = { ...restored.codes, ...local.codes };
            const serverResp = a?.response ? JSON.stringify(a.response) : null;
            if (JSON.stringify(toResponse(q, restored)) !== serverResp && isAnswered(q, toResponse(q, restored))) dirtyRef.current.add(q.id);
            draft = restored;
          } catch { /* ignore corrupt draft */ }
        }
        d[q.id] = draft;
      });
      draftsRef.current = d;
      setDrafts(d);
      setQuestions(qs);
      questionsRef.current = qs;
      setRemaining(Math.floor((endsAtRef.current - (Date.now() + offsetRef.current)) / 1000));
      setPhase('test');
    } catch (e) {
      setLoadError(e.message || 'Could not load the assessment.');
      setPhase('error');
    }
  }, [attemptId, navigate, syncLeaves]);

  useEffect(() => { load(); }, [load]);

  // deterrent: hide the page when printing (scoped class so it never affects other pages)
  useEffect(() => {
    document.body.classList.add('tr-testing');
    return () => document.body.classList.remove('tr-testing');
  }, []);
  // watermark timestamp refresh
  useEffect(() => { const id = setInterval(() => setMinute(stamp()), 60000); return () => clearInterval(id); }, []);
  // warm Python up in the background once the test is open
  useEffect(() => {
    if (phase !== 'test' || !questions.some((x) => x.type === 'coding')) return undefined;
    const t = setTimeout(() => warmUpPython(), 1500);
    return () => clearTimeout(t);
  }, [phase, questions]);

  // ---- helpers --------------------------------------------------------------------------------
  const setSave = (qid, s) => setSaveState((prev) => (prev[qid] === s ? prev : { ...prev, [qid]: s }));
  const enqueue = (fn) => { const p = queueRef.current.then(fn, fn); queueRef.current = p.catch(() => {}); return p; };

  const persistLocal = () => {
    clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      try { localStorage.setItem(draftKey(attemptId), JSON.stringify({ drafts: draftsRef.current, ts: Date.now() })); } catch { /* quota */ }
    }, 400);
  };

  const commitTime = () => {
    const q = questionsRef.current[activeRef.current];
    const now = Date.now();
    if (q) timeRef.current[q.id] = (timeRef.current[q.id] || 0) + (now - visitRef.current) / 1000;
    visitRef.current = now;
  };

  const updateDraft = (q, fn) => {
    const next = { ...draftsRef.current, [q.id]: fn(draftsRef.current[q.id]) };
    draftsRef.current = next;
    setDrafts(next);
    dirtyRef.current.add(q.id);
    setSave(q.id, 'dirty');
    persistLocal();
  };

  /** Grade ALL tests (incl. hidden) in the browser and cache the payload. Transient failures are retried; code is never lost. */
  const gradeQuestion = async (q) => {
    const response = toResponse(q, draftsRef.current[q.id]);
    let grade = await runQuestion(q, response, {});
    for (let i = 0; i < 2 && grade.retryable; i += 1) { await sleep(1500 * (i + 1)); grade = await runQuestion(q, response, {}); }
    regradeRef.current[q.id] = !!grade.retryable;
    const payload = {
      question_id: q.id,
      response,
      tests_passed: grade.passed,
      tests_total: grade.total || totalTests(q, response.language),
      time_spent_sec: Math.round(timeRef.current[q.id] || 0),
    };
    cacheRef.current[q.id] = payload;
    return payload;
  };

  const applyServerClock = (res) => {
    if (!res) return;
    if (res.server_now) offsetRef.current = new Date(res.server_now).getTime() - Date.now();
    if (res.ends_at) endsAtRef.current = new Date(res.ends_at).getTime();
    lastClockRef.current = Date.now();
  };

  /** Grade one dirty question IN THE BROWSER (queued, serial) and park the payload for the next batched save. No network. */
  const flush = (q) => enqueue(async () => {
    if (submittedRef.current || !dirtyRef.current.has(q.id)) return;
    const response = toResponse(q, draftsRef.current[q.id]);
    if (!isAnswered(q, response) && !cacheRef.current[q.id]) { dirtyRef.current.delete(q.id); setSave(q.id, 'idle'); return; }
    dirtyRef.current.delete(q.id);
    setSave(q.id, 'saving');
    try {
      const p = await gradeQuestion(q);
      if (hashPayload(p) === sentHashRef.current[q.id]) { pendingRef.current.delete(q.id); setSave(q.id, 'saved'); } // unchanged vs. what the server has
      else { pendingRef.current.set(q.id, p); setSave(q.id, 'queued'); }
      if (regradeRef.current[q.id]) dirtyRef.current.add(q.id); // grading failed transiently; grade again on the next tick
      if (dirtyRef.current.has(q.id)) setSave(q.id, 'dirty');
    } catch {
      dirtyRef.current.add(q.id);
      setSave(q.id, 'error');
    }
  });

  /** exponential backoff with jitter (2 s, 4 s, 8 s ... 30 s, +-30 %) after a failed save */
  const scheduleRetry = () => {
    if (retryTimer.current || submittedRef.current) return;
    const base = Math.min(30000, 2000 * 2 ** Math.min(failRef.current, 4));
    failRef.current += 1;
    retryTimer.current = setTimeout(() => { retryTimer.current = null; sendPending(); }, base * (0.7 + Math.random() * 0.6));
  };

  /** Send every parked payload in ONE request (<= 20 per call); unchanged ones are skipped. Returns false on failure. */
  const sendPending = () => enqueue(async () => {
    if (submittedRef.current) return true;
    const entries = [...pendingRef.current.entries()].filter(([id, p]) => hashPayload(p) !== sentHashRef.current[id]);
    pendingRef.current = new Map(entries);
    for (let i = 0; i < entries.length; i += MAX_PER_SAVE) {
      const part = entries.slice(i, i + MAX_PER_SAVE);
      const answers = part.map(([id, p]) => ({ ...p, time_spent_sec: Math.round(timeRef.current[id] ?? p.time_spent_sec ?? 0) }));
      try {
        const res = await api.candidate.saveAnswers(attemptId, answers);
        applyServerClock(res);
        part.forEach(([id, p]) => {
          sentHashRef.current[id] = hashPayload(p);
          pendingRef.current.delete(id);
          setSave(id, dirtyRef.current.has(id) ? 'dirty' : 'saved');
        });
        failRef.current = 0;
      } catch (e) {
        if (e.status === 409) { navigate(`/result/${attemptId}`, { replace: true }); return false; }
        part.forEach(([id]) => setSave(id, 'error'));
        if (e.retryAfter) failRef.current = Math.max(failRef.current, Math.min(4, Math.ceil(Math.log2(e.retryAfter / 2))));
        scheduleRetry();
        return false;
      }
    }
    return true;
  });

  // ---- navigation -----------------------------------------------------------------------------
  const goto = (i) => {
    if (i === active || i < 0 || i >= questions.length) return;
    commitTime();
    const prev = questions[active];
    if (prev) flush(prev);
    setActive(i);
    activeRef.current = i;
    visitRef.current = Date.now();
  };

  const saveCurrent = async () => {
    commitTime();
    const q = questions[active];
    if (!q) return;
    dirtyRef.current.add(q.id);
    await flush(q);
    const ok = await sendPending(); // explicit "Save" press: send the parked answers now (nothing is sent when nothing changed)
    flash(ok ? 'Saved' : 'Saved on this device — will sync when the connection is back');
  };

  // ---- run (visible tests only) ---------------------------------------------------------------
  const run = async (q) => {
    const now = Date.now();
    if (now - lastRunRef.current < MIN_RUN_GAP_MS) return;
    lastRunRef.current = now;
    const response = toResponse(q, draftsRef.current[q.id]);
    setRunState((s) => ({ ...s, [q.id]: { running: true, python: q.type === 'coding' && response.language === 'python' } }));
    const result = await runQuestion(q, response, { onlyVisible: true });
    const hiddenCount = result.mode === 'syntax_only' ? 0 : (q.tests || []).filter((t) => t.hidden).length;
    setRunState((s) => ({ ...s, [q.id]: { running: false, result, hiddenCount } }));
  };

  // ---- timer ----------------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== 'test') return undefined;
    const tick = () => setRemaining(Math.floor((endsAtRef.current - (Date.now() + offsetRef.current)) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === 'test' && remaining !== null && remaining <= 0 && !submitLock.current) doSubmit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, phase]);

  // screen-leave limit exceeded (also covers a reload that already put the count over the limit) -> grade everything and auto-submit
  useEffect(() => {
    if (phase === 'test' && leaves > MAX_SCREEN_LEAVES && !submitLock.current) doSubmit(true, leaveLimitReason(), 'screen_leave_limit');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaves, phase]);

  // ---- batched autosave: one request per 45-60 s (jittered), dirty answers only --------------------
  useEffect(() => {
    if (phase !== 'test') return undefined;
    let t;
    let alive = true;
    const next = (first) => { t = setTimeout(tick, SAVE_MIN_MS + Math.random() * SAVE_SPAN_MS + (first ? Math.random() * 10000 : 0)); };
    const tick = async () => {
      if (!alive) return;
      if (!submitLock.current) {
        commitTime();
        for (const q of questionsRef.current) { if (dirtyRef.current.has(q.id)) await flush(q); }
        await sendPending();
      }
      if (alive) next(false);
    };
    next(true);
    return () => { alive = false; clearTimeout(t); clearTimeout(retryTimer.current); retryTimer.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // timer re-sync (~5 min): saves already refresh the server clock, so only call when none did (e.g. nothing was edited and
  // the proctor extended the time). Reads ends_at/server_now only.
  useEffect(() => {
    if (phase !== 'test') return undefined;
    const id = setInterval(async () => {
      if (submitLock.current || submittedRef.current || Date.now() - lastClockRef.current < SYNC_EVERY_MS - 20000) return;
      try {
        const d = await api.candidate.attempt(attemptId);
        if (d.attempt?.status && d.attempt.status !== 'in_progress') { submittedRef.current = true; navigate(`/result/${attemptId}`, { replace: true }); return; }
        applyServerClock({ server_now: d.server_now, ends_at: d.attempt?.ends_at });
      } catch { /* try again next time */ }
    }, SYNC_EVERY_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // when the page is hidden/closed, push whatever is already graded with keepalive (no extra grading, nothing if nothing is pending)
  useEffect(() => {
    if (phase !== 'test') return undefined;
    const push = () => {
      if (submittedRef.current) return;
      const answers = [...pendingRef.current.entries()].filter(([id, p]) => hashPayload(p) !== sentHashRef.current[id]).slice(0, MAX_PER_SAVE)
        .map(([id, p]) => ({ ...p, time_spent_sec: Math.round(timeRef.current[id] ?? p.time_spent_sec ?? 0) }));
      if (answers.length) api.candidate.saveAnswers(attemptId, answers, { keepalive: true }).catch(() => {});
    };
    const onVis = () => { if (document.hidden) push(); };
    window.addEventListener('pagehide', push);
    document.addEventListener('visibilitychange', onVis);
    return () => { window.removeEventListener('pagehide', push); document.removeEventListener('visibilitychange', onVis); };
  }, [phase, attemptId]);

  useEffect(() => () => { flushEvents(attemptId, { keepalive: true }); dropQueue(attemptId); }, [attemptId]);

  // warn before leaving mid-test
  useEffect(() => {
    if (phase !== 'test') return undefined;
    const h = (e) => { if (!submittedRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [phase]);

  // SQL table preview for the problem panel
  const q = questions[active];
  useEffect(() => {
    if (q && q.type === 'sql' && !sqlPreviews[q.id]) {
      getSqlPreview(q).then((p) => setSqlPreviews((s) => ({ ...s, [q.id]: p }))).catch(() => setSqlPreviews((s) => ({ ...s, [q.id]: [] })));
    }
  }, [q, sqlPreviews]);

  // ---- submit ---------------------------------------------------------------------------------
  const sendSubmit = async () => {
    setSubmitState((s) => ({ ...(s || {}), stage: 'sending', error: null }));
    try {
      await api.candidate.submit(attemptId, payloadRef.current);
      submittedRef.current = true;
      try { localStorage.removeItem(draftKey(attemptId)); } catch { /* ignore */ }
      clearProctoringFlags(attemptId);
      try { if (reasonRef.current) sessionStorage.setItem(submitReasonKey(attemptId), reasonRef.current); } catch { /* ignore */ }
      try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* ignore */ }
      navigate(`/result/${attemptId}`, { replace: true, state: reasonRef.current ? { reason: reasonRef.current } : undefined });
    } catch (e) {
      if (e.status === 409 || e.status === 403) { submittedRef.current = true; navigate(`/result/${attemptId}`, { replace: true }); return; }
      setSubmitState({ stage: 'error', error: e.message || 'Submission failed.' });
    }
  };

  async function doSubmit(auto = false, reason = null, reasonCode = null) {
    if (submitLock.current || submittedRef.current) return;
    submitLock.current = true;
    autoRef.current = auto;
    reasonRef.current = reason;
    setConfirmOpen(false);
    flushEvents(attemptId); // integrity events first (fire-and-forget); the submit below carries every graded answer
    commitTime();
    const qs = questionsRef.current;
    const toGrade = qs.filter((x) => (dirtyRef.current.has(x.id) || !cacheRef.current[x.id])
      && (isAnswered(x, toResponse(x, draftsRef.current[x.id])) || cacheRef.current[x.id]));
    setSubmitState({ stage: 'grading', done: 0, total: toGrade.length });

    const work = (async () => {
      try { await queueRef.current; } catch { /* ignore */ }
      let done = 0;
      for (const x of toGrade) {
        try { await gradeQuestion(x); } catch { /* fall back to the cached/zero grade below */ }
        done += 1;
        setSubmitState((s) => ({ ...(s || {}), stage: 'grading', done, total: toGrade.length }));
      }
    })();
    if (auto) await Promise.race([work, sleep(20000)]); else await work;

    const answers = [];
    qs.forEach((x) => {
      const response = toResponse(x, draftsRef.current[x.id]);
      const cached = cacheRef.current[x.id];
      const stillDirty = dirtyRef.current.has(x.id);
      if (cached && !(stillDirty && JSON.stringify(cached.response) !== JSON.stringify(response))) answers.push(cached);
      else if (isAnswered(x, response)) answers.push({ question_id: x.id, response, tests_passed: cached?.tests_passed ?? 0, tests_total: cached?.tests_total ?? totalTests(x, response.language), time_spent_sec: Math.round(timeRef.current[x.id] || 0) });
    });
    payloadRef.current = { answers, auto, ...(reasonCode ? { reason: reasonCode } : {}) };
    await sendSubmit();
  }

  // auto-retry for failed auto-submit
  useEffect(() => {
    if (submitState?.stage === 'error' && autoRef.current) {
      const t = setTimeout(() => sendSubmit(), 5000);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitState]);

  // ---- derived --------------------------------------------------------------------------------
  const answeredMap = useMemo(() => {
    const m = {};
    questions.forEach((x) => { m[x.id] = isAnswered(x, toResponse(x, drafts[x.id])); });
    return m;
  }, [questions, drafts]);

  const groups = useMemo(() => {
    const g = [];
    questions.forEach((x, i) => {
      const name = x.subject_name || TYPE_LABEL[x.type] || 'Questions';
      let last = g[g.length - 1];
      if (!last || last.name !== name) { last = { name, items: [] }; g.push(last); }
      last.items.push({ q: x, i });
    });
    return g;
  }, [questions]);

  const unanswered = questions.map((x, i) => ({ x, i })).filter(({ x }) => !answeredMap[x.id]);

  const beginTest = async () => {
    await requestFullscreen();
    visitRef.current = Date.now();
    setBegun(true);
  };

  const watermark = useMemo(() => {
    const text = `${auth.user?.name || 'Candidate'} · ${String(attemptId || '').slice(0, 8)} · ${minute}`
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="260"><g fill="#173f59" fill-opacity="0.10" font-family="Arial, sans-serif" font-size="14" font-weight="700"><text x="10" y="150" transform="rotate(-24 260 130)">${text}</text><text x="270" y="250" transform="rotate(-24 260 130)">${text}</text></g></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  }, [attemptId, minute]);

  // ---- render ---------------------------------------------------------------------------------
  if (phase === 'loading') return <div className="tr-root tr-center"><div className="tr-spinner" /><p>Loading your assessment…</p></div>;
  if (phase === 'error') {
    return (
      <div className="tr-root tr-center">
        <div className="tr-modal-card">
          <h2>Couldn't open the assessment</h2>
          <p className="tr-muted">{loadError}</p>
          <button className="tr-btn tr-btn-primary" onClick={load}>Try again</button>
        </div>
      </div>
    );
  }
  if (!q) return <div className="tr-root tr-center"><p>No questions found for this attempt.</p></div>;

  const draft = drafts[q.id];
  const rs = runState[q.id];
  const clockClass = remaining !== null && remaining < 60 ? 'red' : remaining !== null && remaining < 300 ? 'amber' : '';
  const candidateName = auth.user?.name;
  const lang = q.type === 'coding' ? draft.language : null;
  const syntaxOnly = lang ? isSyntaxLang(lang) : false;
  const warnText = warning ? leaveWarningText(warning) : null;

  return (
    <div className="tr-root">
      <header className="tr-header">
        <div className="tr-brand">
          <img src="/logo.png" alt="HPAI" />
          <div><b>HPAI Assessment</b><span>{candidateName || 'Candidate'}</span></div>
        </div>
        <div className="tr-header-right">
          <div className={`tr-leaves l${Math.min(leaves, MAX_SCREEN_LEAVES)}`} title="Leaving the test screen is recorded">Screen leaves: {leaves}/{MAX_SCREEN_LEAVES}</div>
          <div className={`tr-timer ${clockClass}`} aria-label="Time remaining">⏱ {remaining === null ? '--:--' : fmtTime(remaining)}</div>
        </div>
      </header>

      <nav className="tr-nav">
        {groups.map((g) => (
          <div className="tr-navgroup" key={g.name + g.items[0].i}>
            <span className="tr-navlabel">{g.name}</span>
            {g.items.map(({ q: x, i }) => (
              <button
                key={x.id}
                className={`tr-pill ${i === active ? 'on' : ''} ${answeredMap[x.id] ? 'done' : ''}`}
                onClick={() => goto(i)}
                title={`${x.title} · ${x.difficulty}`}
              >
                <span className={`tr-diff ${x.difficulty}`} />{i + 1}{answeredMap[x.id] ? <i> ✓</i> : null}
              </button>
            ))}
          </div>
        ))}
        <div className="tr-navprogress">{questions.length - unanswered.length}/{questions.length} answered</div>
      </nav>

      <main className={`tr-main ${blank ? 'tr-away' : ''}`}>
        <section className="tr-card tr-problem">
          <div className="tr-chips">
            <span className="tr-chip">{q.subject_name || TYPE_LABEL[q.type]}</span>
            <span className={`tr-chip diff ${q.difficulty}`}>{q.difficulty}</span>
            <span className="tr-chip">{TYPE_LABEL[q.type]}</span>
            <span className="tr-chip">{q.marks} marks</span>
            <span className="tr-chip">~{q.time_mins} min</span>
          </div>
          <h2>{q.title}</h2>
          <ProblemBody q={q} preview={sqlPreviews[q.id]} />
        </section>

        <section className="tr-card tr-work">
          {q.type === 'coding' && (
            <>
              <div className="tr-toolbar">
                <div className="tr-toolbar-left">
                  <select
                    className="tr-select"
                    value={draft.language}
                    onChange={(e) => updateDraft(q, (d) => ({ ...d, language: e.target.value }))}
                    aria-label="Language"
                  >
                    {LANGUAGE_GROUPS.map((g) => (
                      <optgroup key={g.label} label={g.label}>
                        {g.langs.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <button className="tr-btn tr-btn-ghost" onClick={() => updateDraft(q, (d) => ({ ...d, codes: { ...d.codes, [d.language]: starterFor(d.language, q) } }))}>Reset</button>
                </div>
                <SaveBadge state={saveState[q.id]} />
              </div>
              {syntaxOnly && <div className="tr-notestrip">ℹ {SYNTAX_NOTE}</div>}
              <CodeEditor
                path={`${q.id}.${draft.language}`}
                language={getLanguage(draft.language).monaco}
                lint={lintLanguage(draft.language)}
                height={380}
                value={codeFor(q, draft)}
                onChange={(v) => updateDraft(q, (d) => ({ ...d, codes: { ...d.codes, [d.language]: v } }))}
              />
            </>
          )}

          {(q.type === 'sql' || q.type === 'nosql') && (
            <>
              <div className="tr-toolbar">
                <div className="tr-toolbar-left"><b>{q.type === 'sql' ? 'SQL (SQLite)' : `MongoDB · ${q.config?.mode === 'find' ? 'find' : 'aggregate'}`}</b></div>
                <SaveBadge state={saveState[q.id]} />
              </div>
              <CodeEditor
                path={`${q.id}.${q.type}`}
                language={q.type === 'sql' ? 'sql' : 'javascript'}
                height={300}
                value={draft.code}
                onChange={(v) => updateDraft(q, (d) => ({ ...d, code: v }))}
              />
            </>
          )}

          {q.type === 'ui' && (
            <>
              <div className="tr-toolbar">
                <div className="tr-toolbar-left"><b>Fix the UI — edit the files, watch the preview</b></div>
                <SaveBadge state={saveState[q.id]} />
              </div>
              <UIQuestion qid={q.id} question={q} files={draft.files} onChange={(files) => updateDraft(q, () => ({ files }))} />
            </>
          )}

          {q.type === 'mcq' && (
            <div className="tr-mcq">
              <div className="tr-toolbar">
                <div className="tr-toolbar-left"><b>{q.config?.multiple ? 'Select all that apply' : 'Select one answer'}</b></div>
                <SaveBadge state={saveState[q.id]} />
              </div>
              {(q.config?.options || []).map((opt, idx) => {
                const on = draft.selected.includes(idx);
                return (
                  <label key={idx} className={`tr-option ${on ? 'on' : ''}`}>
                    <input
                      type={q.config?.multiple ? 'checkbox' : 'radio'}
                      name={`opt-${q.id}`}
                      checked={on}
                      onChange={() => updateDraft(q, (d) => {
                        if (q.config?.multiple) return { selected: on ? d.selected.filter((s) => s !== idx) : [...d.selected, idx].sort() };
                        return { selected: [idx] };
                      })}
                    />
                    <span className="tr-optkey">{String.fromCharCode(65 + idx)}</span>
                    <span>{opt}</span>
                  </label>
                );
              })}
              {(draft.selected || []).length > 0 && !q.config?.multiple && (
                <button className="tr-btn tr-btn-ghost" onClick={() => updateDraft(q, () => ({ selected: [] }))}>Clear selection</button>
              )}
            </div>
          )}

          {q.type !== 'mcq' && <RunConsole q={q} rs={rs} />}

          <div className="tr-foot">
            <div className="tr-foot-left">
              <button className="tr-btn tr-btn-ghost" onClick={() => goto(active - 1)} disabled={active === 0}>← Prev</button>
              <button className="tr-btn tr-btn-ghost" onClick={() => goto(active + 1)} disabled={active === questions.length - 1}>Next →</button>
            </div>
            <div className="tr-foot-right">
              {q.type !== 'mcq' && (
                <button className="tr-btn tr-btn-secondary" onClick={() => run(q)} disabled={rs?.running}>
                  {rs?.running ? 'Running…' : syntaxOnly ? '✓ Check syntax' : q.type === 'ui' ? '▶ Run checks' : '▶ Run sample tests'}
                </button>
              )}
              <button className="tr-btn tr-btn-secondary" onClick={saveCurrent}>Save</button>
              <button className="tr-btn tr-btn-submit" onClick={() => setConfirmOpen(true)}>Submit assessment</button>
            </div>
          </div>
        </section>
      </main>

      {/* anti-screenshot deterrents: tiled watermark + content blanked while the window is hidden/blurred */}
      <div className="tr-watermark" style={{ backgroundImage: watermark }} aria-hidden="true" />
      {blank && begun && !warning && !submitState && (
        <div className="tr-blank" role="alert">
          <div><b>Test content hidden while you are away</b><p>Return to this window to continue. Leaving the screen is recorded.</p></div>
        </div>
      )}

      {toast && <div className="tr-toast">{toast}</div>}

      {confirmOpen && (
        <div className="tr-overlay">
          <div className="tr-modal-card">
            <h2>Submit assessment?</h2>
            {unanswered.length ? (
              <>
                <p className="tr-muted">You haven't attempted {unanswered.length} question{unanswered.length > 1 ? 's' : ''}:</p>
                <ul className="tr-list">{unanswered.map(({ x, i }) => <li key={x.id}>Q{i + 1} · {x.title}</li>)}</ul>
              </>
            ) : <p className="tr-muted">You have attempted all questions.</p>}
            <p className="tr-muted">You cannot change your answers after submitting.</p>
            <div className="tr-modal-actions">
              <button className="tr-btn tr-btn-secondary" onClick={() => setConfirmOpen(false)}>Keep working</button>
              <button className="tr-btn tr-btn-submit" onClick={() => doSubmit(false)}>Yes, submit</button>
            </div>
          </div>
        </div>
      )}

      {submitState && (
        <div className="tr-overlay">
          <div className="tr-modal-card tr-center-text">
            {submitState.stage === 'error' ? (
              <>
                <h2>Couldn't submit yet</h2>
                <p className="tr-muted">{submitState.error}</p>
                <p className="tr-muted">Your answers are safe in this browser. {autoRef.current ? 'Retrying automatically…' : ''}</p>
                <button className="tr-btn tr-btn-primary" onClick={sendSubmit}>Retry submit</button>
              </>
            ) : (
              <>
                <div className="tr-spinner" />
                <h2>{submitState.stage === 'grading' ? 'Grading your answers…' : 'Submitting…'}</h2>
                {reasonRef.current && <p className="tr-reason">{reasonRef.current}</p>}
                <p className="tr-muted">
                  {submitState.stage === 'grading' && submitState.total ? `${Math.min(submitState.done || 0, submitState.total)} of ${submitState.total} checked. ` : ''}
                  Please don't close this tab.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {!begun && (
        <div className="tr-overlay tr-gate">
          <div className="tr-modal-card tr-center-text">
            <img src="/logo.png" alt="HPAI" className="tr-gate-logo" />
            <h2>{Object.keys(cacheRef.current).length || leaves ? 'Welcome back' : 'Ready to begin?'}</h2>
            <p className="tr-muted">The test runs in fullscreen and the timer is already running. You may leave the test screen at most <b>{MAX_SCREEN_LEAVES}</b> times — the next time your test is submitted automatically. Everything is recorded for your proctor.</p>
            {leaves > 0 && <p className="tr-reason">Screen leaves so far: {leaves}/{MAX_SCREEN_LEAVES}</p>}
            <button className="tr-btn tr-btn-primary tr-btn-lg" onClick={beginTest}>Enter fullscreen to begin</button>
            <button className="tr-link" onClick={() => { visitRef.current = Date.now(); setBegun(true); }}>Continue without fullscreen</button>
          </div>
        </div>
      )}

      {warnText && (
        <div className="tr-overlay tr-warn" role="alertdialog" aria-modal="true">
          <div className="tr-modal-card tr-center-text">
            <div className="tr-warn-icon">⚠</div>
            <h2>{warnText.title}</h2>
            <p>{warnText.body}</p>
            <button className="tr-btn tr-btn-primary tr-btn-lg" onClick={dismissWarning}>I understand — return to the test</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
function SaveBadge({ state }) {
  const map = { saved: ['ok', 'Saved ✓'], queued: ['ok', 'Saved ✓ · syncing'], saving: ['', 'Saving…'], dirty: ['', 'Unsaved changes'], error: ['bad', 'Save failed – retrying'] };
  const m = map[state];
  return m ? <span className={`tr-save ${m[0]}`}>{m[1]}</span> : <span className="tr-save" />;
}

function RunConsole({ q, rs }) {
  if (!rs) return <div className="tr-console empty">Run your solution to see sample results here.</div>;
  if (rs.running) return <div className="tr-console"><div className="tr-spinner sm" /> {rs.python ? 'Running… (the first Python run downloads the runtime, this can take a few seconds)' : 'Running…'}</div>;
  const r = rs.result;
  const list = r.results || [];
  const ok = list.filter((x) => x.passed).length;
  const syntax = r.mode === 'syntax_only';
  const noun = syntax ? 'syntax checks' : q.type === 'ui' ? 'checks' : 'tests';
  return (
    <div className="tr-console">
      {list.length ? (
        <div className={`tr-console-sum ${ok === list.length ? 'ok' : ''}`}>{ok} of {list.length} {syntax ? 'syntax checks' : `sample ${noun}`} passed</div>
      ) : (
        <div className="tr-console-sum">{r.error ? 'Could not run' : 'No sample tests for this question.'}</div>
      )}
      {syntax && <div className="tr-console-note">Syntax-checked only — this language is not executed. The portal marks it automatically: marks are awarded for clean syntax and a complete implementation.</div>}
      {r.error && list.every((x) => !x.passed) && <pre className="tr-console-err">{r.error}</pre>}
      {list.map((x) => (
        <div key={x.index} className={`tr-case ${x.passed ? 'pass' : 'fail'}`}>
          <b>{x.passed ? '✓' : '✗'} {x.name}</b>
          {!x.passed && x.message && !(r.error && x.message === r.error) && <pre>{x.message}</pre>}
        </div>
      ))}
      {r.retryable && <div className="tr-console-note">Press the button again to retry.</div>}
      {rs.hiddenCount > 0 && <div className="tr-console-note">{rs.hiddenCount} more hidden {q.type === 'ui' ? 'check' : 'test'}{rs.hiddenCount > 1 ? 's' : ''} will be evaluated when your answer is saved and submitted.</div>}
    </div>
  );
}

/** Tiny inline formatter for statements: **bold** and `code` (React escapes everything else). */
function Rich({ text }) {
  const parts = String(text || '').split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('`') && p.endsWith('`') && p.length > 2) return <code key={i} className="tr-inline-code">{p.slice(1, -1)}</code>;
    return p;
  });
}

function ProblemBody({ q, preview }) {
  const cfg = q.config || {};
  const visible = (q.tests || []).filter((t) => !t.hidden);
  const hiddenN = (q.tests || []).length - visible.length;
  const paramNames = cfg.fn?.params || [];
  return (
    <div className="tr-problem-body">
      {q.type === 'mcq' && cfg.scenario && <div className="tr-scenario"><b>Scenario</b><p>{cfg.scenario}</p></div>}
      <p className="tr-statement"><Rich text={q.statement} /></p>

      {cfg.constraints?.length > 0 && (
        <div className="tr-box"><h3>Constraints</h3><ul>{cfg.constraints.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
      )}

      {q.type === 'coding' && cfg.examples?.length > 0 && (
        <div className="tr-box"><h3>Examples</h3>
          {cfg.examples.map((ex, i) => (
            <div className="tr-example" key={i}>
              <div><span>Input</span><code>{ex.input}</code></div>
              <div><span>Output</span><code className="exp">{ex.output}</code></div>
              {ex.explanation && <small>{ex.explanation}</small>}
            </div>
          ))}
        </div>
      )}

      {q.type === 'coding' && visible.length > 0 && (
        <div className="tr-box"><h3>Sample tests</h3>
          {visible.map((t, i) => (
            <div className="tr-example" key={i}>
              <div><span>Input{paramNames.length ? ` (${paramNames.join(', ')})` : ''}</span><code>{(t.args || []).map((a) => short(a, 200)).join(', ')}</code></div>
              <div><span>Expected</span><code className="exp">{short(t.expected, 200)}</code></div>
            </div>
          ))}
          {hiddenN > 0 && <small className="tr-muted">+ {hiddenN} hidden test{hiddenN > 1 ? 's' : ''} (edge cases)</small>}
        </div>
      )}

      {q.type === 'sql' && (
        <>
          <div className="tr-box"><h3>Tables (sample data)</h3>
            {!preview && <small className="tr-muted">Loading tables…</small>}
            {(preview || []).map((t) => (
              <div key={t.name} className="tr-table-wrap">
                <div className="tr-table-name">{t.name} <small>({t.total} rows)</small></div>
                <MiniTable columns={t.columns} rows={t.rows} />
              </div>
            ))}
          </div>
          {visible[0]?.expected && (
            <div className="tr-box"><h3>Expected output (sample)</h3><MiniTable columns={visible[0].expected.columns} rows={visible[0].expected.rows} />
              {cfg.ordered && <small className="tr-muted">Row order matters.</small>}
            </div>
          )}
        </>
      )}

      {q.type === 'nosql' && (
        <>
          <div className="tr-box"><h3>Collection: <code>{cfg.collection || 'collection'}</code></h3>
            <small className="tr-muted">{cfg.mode === 'find' ? 'Write an object: { filter, projection, sort, limit }' : 'Write an aggregation pipeline array: [ { $match: … }, … ]'}</small>
            {visible[0] && <pre className="tr-pre">{JSON.stringify((visible[0].data || []).slice(0, 5), null, 1)}{(visible[0].data || []).length > 5 ? '\n… ' + ((visible[0].data || []).length - 5) + ' more documents' : ''}</pre>}
          </div>
          {visible[0] && <div className="tr-box"><h3>Expected output (sample)</h3><pre className="tr-pre">{JSON.stringify(visible[0].expected, null, 1)}</pre></div>}
        </>
      )}

      {q.type === 'ui' && visible.length > 0 && (
        <div className="tr-box"><h3>Your fix should satisfy</h3>
          <ul>{visible.map((t, i) => <li key={i}>{t.name}</li>)}</ul>
          {hiddenN > 0 && <small className="tr-muted">+ {hiddenN} hidden check{hiddenN > 1 ? 's' : ''}</small>}
        </div>
      )}
    </div>
  );
}

function MiniTable({ columns = [], rows = [] }) {
  return (
    <div className="tr-minitable">
      <table>
        <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={Math.max(1, columns.length)} className="tr-muted">(no rows)</td></tr>}
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c === null ? <i>NULL</i> : String(c)}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}
