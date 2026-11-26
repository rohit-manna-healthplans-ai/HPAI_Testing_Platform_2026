export function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d)) return '—';
  return d.toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function fmtDay(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' });
}

export function fmtDuration(sec) {
  if (sec === null || sec === undefined || isNaN(sec)) return '—';
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function fmtClock(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function pct(score, max) {
  const s = Number(score), m = Number(max);
  if (!m) return 0;
  return Math.round((s / m) * 1000) / 10;
}

export function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function gradeFor(percentage) {
  if (percentage >= 80) return 'Excellent';
  if (percentage >= 60) return 'Good';
  if (percentage >= 40) return 'Fair';
  return 'Needs Improvement';
}

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCSV(columns, rows) {
  const head = columns.map((c) => csvCell(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => csvCell(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(','));
  return [head, ...body].join('\r\n');
}

export function downloadFile(filename, content, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCSV(filename, columns, rows) {
  downloadFile(filename, '﻿' + toCSV(columns, rows));
}

export function parseNameEmailLines(text) {
  const rows = [];
  const bad = [];
  text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((line) => {
    const parts = line.split(/[,\t;]/).map((p) => p.trim());
    const [name, email] = parts;
    if (name && email && /^\S+@\S+\.\S+$/.test(email)) rows.push({ name, email });
    else bad.push(line);
  });
  return { rows, bad };
}

export const ATTEMPT_STATUS = {
  in_progress: { label: 'In progress', tone: 'blue' },
  submitted: { label: 'Submitted', tone: 'green' },
  auto_submitted: { label: 'Auto-submitted', tone: 'amber' },
  terminated: { label: 'Terminated', tone: 'red' },
};
