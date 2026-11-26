import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

// ---- tunables (reuse these in the instructions modal) ---------------------------------------------
export const MAX_SCREEN_LEAVES = 2;   // candidate may leave the test screen this many times; the next leave auto-submits
export const LEAVE_DEDUPE_MS = 1500;  // tab-switch + blur + fullscreen-exit firing together count as ONE leave
export const BLUR_CONFIRM_MS = 300;   // wait before treating a window blur as a leave (tab switch is reported by visibilitychange)

export const leavesKey = (attemptId) => `hpai_leaves_${attemptId}`;
const reloadFlagKey = (attemptId) => `hpai_leftflag_${attemptId}`;
export const submitReasonKey = (attemptId) => `hpai_submit_reason_${attemptId}`;

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

export function readLeaves(attemptId) {
  const n = parseInt(ls.get(leavesKey(attemptId)) || '0', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
export function clearProctoringFlags(attemptId) { ls.del(reloadFlagKey(attemptId)); }

export function leaveWarningText(n, max = MAX_SCREEN_LEAVES) {
  const remaining = Math.max(0, max - n);
  const head = remaining === 0 ? 'Final warning' : `Warning ${n} of ${max}`;
  return {
    title: head,
    body: remaining === 0
      ? 'You left the test screen. This was your last allowed leave. The next time, your test will be auto-submitted.'
      : `You left the test screen. ${remaining} warning${remaining === 1 ? '' : 's'} remaining. The next time you leave, your test will be auto-submitted.`,
  };
}
export const leaveLimitReason = (max = MAX_SCREEN_LEAVES) =>
  `You left the test screen more than ${max} times, so your test was submitted automatically.`;

/** Pure leave-counting rules (no DOM) so they can be unit-tested. */
export class LeaveTracker {
  constructor({ initial = 0, max = MAX_SCREEN_LEAVES, dedupeMs = LEAVE_DEDUPE_MS } = {}) {
    this.count = initial; this.max = max; this.dedupeMs = dedupeMs; this.away = false; this.lastAt = -Infinity;
  }
  /** Returns null when ignored (already away / duplicate), else { n, source, remaining, exceeded }. */
  leave(source, now = Date.now()) {
    if (this.away || now - this.lastAt < this.dedupeMs) return null;
    this.away = true; this.lastAt = now; this.count += 1;
    return { n: this.count, source, remaining: Math.max(0, this.max - this.count), exceeded: this.count > this.max };
  }
  returned() { this.away = false; }
  sync(n) { if (n > this.count) this.count = n; return this.count; }
}

const inEditor = (t) => !!(t && t.closest && t.closest('.monaco-editor, .tr-fallback-editor, .tr-ui, input, textarea, select'));

/**
 * Proctoring signals for the test page.
 * opts: { enabled (leave detection + deterrents active), ready (test loaded: consume reload flag once), onNotice(msg) }
 * returns { leaves, blank, warning, dismissWarning, syncLeaves, requestFullscreen, isFullscreen }
 *  - leaves   : screen leaves so far (persisted per attempt; reload/close-and-return counts as one)
 *  - blank    : true while the window is hidden/blurred -> hide test content
 *  - warning  : leave number (1..MAX) to warn about, else null
 */
export function useProctoring(attemptId, { enabled = true, ready = false, onNotice } = {}) {
  const trackerRef = useRef(null);
  if (!trackerRef.current) trackerRef.current = new LeaveTracker({ initial: readLeaves(attemptId) });
  const [leaves, setLeaves] = useState(trackerRef.current.count);
  const [warning, setWarning] = useState(null);
  const [blank, setBlank] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const lastLog = useRef({});
  const everFull = useRef(!!document.fullscreenElement);
  const wasFull = useRef(!!document.fullscreenElement);
  const noticeRef = useRef(onNotice);
  noticeRef.current = onNotice;

  const post = useCallback((type, meta) => {
    if (attemptId) api.candidate.event(attemptId, type, meta).catch(() => {});
  }, [attemptId]);

  /** fine-grained, debounced event log (fire-and-forget) */
  const log = useCallback((type, meta) => {
    const now = Date.now();
    if (now - (lastLog.current[type] || 0) < LEAVE_DEDUPE_MS) return;
    lastLog.current[type] = now;
    post(type, meta);
  }, [post]);

  const notice = (m) => { if (noticeRef.current) noticeRef.current(m); };

  // Set once the page starts unloading: Chromium fires pagehide and then visibilitychange(hidden)/blur during a reload.
  // Those must not count as a separate leave on top of the reload flag consumed on the next load.
  const unloading = useRef(false);

  const registerLeave = useCallback((source) => {
    if (unloading.current && source !== 'reload') return;
    const r = trackerRef.current.leave(source);
    if (!r) return;
    ls.set(leavesKey(attemptId), String(r.n));
    setLeaves(r.n);
    post('screen_leave', { n: r.n, source });
    if (!r.exceeded) setWarning(r.n);
  }, [attemptId, post]);

  const syncLeaves = useCallback((n) => {
    const c = trackerRef.current.sync(n || 0);
    ls.set(leavesKey(attemptId), String(c));
    setLeaves(c);
  }, [attemptId]);

  const requestFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      wasFull.current = !!document.fullscreenElement;
      if (wasFull.current) everFull.current = true;
      setIsFullscreen(wasFull.current);
      return wasFull.current;
    } catch { return false; }
  }, []);

  const dismissWarning = useCallback(() => {
    trackerRef.current.returned();
    setWarning(null);
    setBlank(false);
    if (everFull.current) requestFullscreen(); // called inside the click handler => allowed as a user gesture
  }, [requestFullscreen]);

  // a reload / close-and-return while the test was running counts as one leave
  useEffect(() => {
    if (!ready) return;
    if (ls.get(reloadFlagKey(attemptId))) { ls.del(reloadFlagKey(attemptId)); registerLeave('reload'); }
  }, [ready, attemptId, registerLeave]);

  useEffect(() => {
    if (!enabled) return undefined;
    let blurTimer = null;
    const tracker = trackerRef.current;
    const iframeFocused = () => !!document.activeElement && document.activeElement.tagName === 'IFRAME';
    const back = () => { if (!document.hidden && document.hasFocus()) { tracker.returned(); setBlank(false); } };

    const onVisibility = () => {
      if (document.hidden) { setBlank(true); log('tab_hidden'); registerLeave('tab_hidden'); } else back();
    };
    const onBlur = () => {
      if (iframeFocused()) return; // clicking the live-preview iframe is not leaving
      setBlank(true);
      clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        if (document.hidden || iframeFocused()) return; // tab switch is already counted by visibilitychange
        log('window_blur'); registerLeave('window_blur');
      }, BLUR_CONFIRM_MS);
    };
    const onFocus = () => { clearTimeout(blurTimer); back(); };
    const onFullscreen = () => {
      const full = !!document.fullscreenElement;
      setIsFullscreen(full);
      if (full) { everFull.current = true; tracker.returned(); }
      if (wasFull.current && !full) { log('fullscreen_exit'); registerLeave('fullscreen_exit'); }
      wasFull.current = full;
    };
    const onPageHide = () => { unloading.current = true; ls.set(reloadFlagKey(attemptId), String(Date.now())); };
    const onPageShow = (e) => { if (e.persisted) { unloading.current = false; ls.del(reloadFlagKey(attemptId)); } }; // restored from bfcache: not a reload

    // ---- clipboard / context menu / shortcuts (best-effort deterrents) ----
    const onPaste = (e) => {
      if (inEditor(e.target)) { log('paste', { where: 'editor' }); return; } // log-only inside editors
      e.preventDefault(); log('paste', { where: 'page' });
    };
    const onCopyCut = (e) => {
      if (inEditor(e.target)) return;
      e.preventDefault(); log('copy', { kind: e.type }); notice('Copying test content is disabled.');
    };
    const onContext = (e) => { if (!inEditor(e.target)) e.preventDefault(); };
    const onKeyDown = (e) => {
      const k = (e.key || '').toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if (k === 'printscreen') { e.preventDefault(); return; }
      if (mod && (k === 'p' || k === 's')) {
        e.preventDefault();
        log('screenshot_attempt', { key: `${e.shiftKey ? 'shift+' : ''}${mod ? 'ctrl+' : ''}${k}` });
        notice('Printing and saving are disabled during the test.');
      } else if (e.metaKey && e.shiftKey && k === 's') {
        log('screenshot_attempt', { key: 'win+shift+s' });
        notice('Screenshots are not allowed and are recorded.');
      }
    };
    const onKeyUp = (e) => {
      if ((e.key || '').toLowerCase() !== 'printscreen') return;
      try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText('').catch(() => {}); } catch { /* ignore */ }
      log('screenshot_attempt', { key: 'printscreen' });
      notice('Screenshots are not allowed and are recorded.');
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('fullscreenchange', onFullscreen);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('paste', onPaste, true);
    document.addEventListener('copy', onCopyCut, true);
    document.addEventListener('cut', onCopyCut, true);
    document.addEventListener('contextmenu', onContext, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    return () => {
      clearTimeout(blurTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('fullscreenchange', onFullscreen);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('paste', onPaste, true);
      document.removeEventListener('copy', onCopyCut, true);
      document.removeEventListener('cut', onCopyCut, true);
      document.removeEventListener('contextmenu', onContext, true);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
    };
  }, [enabled, attemptId, log, registerLeave]);

  return { leaves, blank, warning, dismissWarning, syncLeaves, requestFullscreen, isFullscreen };
}
