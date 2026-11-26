import { memo, useEffect, useMemo, useState } from 'react';
import { EmptyState } from './ui.jsx';

/** Re-renders only when its own row (or the shared column list / click handler) changes. */
const Row = memo(function Row({ r, i, columns, onRowClick }) {
  return (
    <tr className={onRowClick ? 'clickable' : ''} style={{ '--ri': Math.min(i, 12) }} onClick={onRowClick ? () => onRowClick(r) : undefined}>
      {columns.map((c) => <td key={c.key} data-label={c.label || ''} className={c.className || ''}>{c.render ? c.render(r) : (r[c.key] ?? '—')}</td>)}
    </tr>
  );
});

/**
 * columns: [{ key, label, render?(row), sortValue?(row), sortable?, className? }]
 * searchKeys / search: client-side search over `searchText(row)` or the listed keys.
 * On phones (<700px) the table turns into stacked cards using each column's label.
 */
export default function DataTable({ columns, rows, searchKeys, searchText, searchPlaceholder = 'Search…', empty, onRowClick, toolbar, pageSize = 25, initialSort, stacked = true }) {
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState(initialSort || null);
  const [page, setPage] = useState(0);

  // Debounce typing so large tables don't re-filter on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => { setQ(input); setPage(0); }, 200);
    return () => clearTimeout(id);
  }, [input]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = rows || [];
    if (term) {
      list = list.filter((r) => {
        const text = searchText ? searchText(r) : (searchKeys || columns.map((c) => c.key)).map((k) => r[k]).join(' ');
        return String(text).toLowerCase().includes(term);
      });
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      const val = (r) => (col?.sortValue ? col.sortValue(r) : r[sort.key]);
      list = [...list].sort((a, b) => {
        const x = val(a), y = val(b);
        if (x === y) return 0;
        if (x === null || x === undefined) return 1;
        if (y === null || y === undefined) return -1;
        const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
        return sort.dir === 'asc' ? r : -r;
      });
    }
    return list;
  }, [rows, q, sort, columns, searchKeys, searchText]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const view = useMemo(() => filtered.slice(cur * pageSize, cur * pageSize + pageSize), [filtered, cur, pageSize]);

  const toggle = (c) => {
    if (c.sortable === false) return;
    setSort((s) => (s?.key === c.key ? (s.dir === 'asc' ? { key: c.key, dir: 'desc' } : null) : { key: c.key, dir: 'asc' }));
  };

  return (
    <div className="table-wrap">
      <div className="table-toolbar">
        <input className="input search" type="search" placeholder={searchPlaceholder} value={input} onChange={(e) => setInput(e.target.value)} aria-label="Search table" />
        <div className="toolbar-right">{toolbar}</div>
      </div>
      {filtered.length === 0 ? (
        <EmptyState title={empty?.title || (q ? 'No matches' : 'No records yet')} hint={empty?.hint || (q ? 'Try a different search term.' : undefined)} />
      ) : (
        <div className="table-scroll">
          <table className={`table ${stacked ? 'stackable' : ''}`}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} scope="col" onClick={() => toggle(c)} className={`${c.sortable === false ? '' : 'sortable'} ${c.className || ''}`} aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    {c.label}{sort?.key === c.key && <span className="sort-ind">{sort.dir === 'asc' ? ' ▲' : ' ▼'}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.map((r, i) => <Row key={r.id || r.attempt_id || r.candidate_id || i} r={r} i={i} columns={columns} onRowClick={onRowClick} />)}
            </tbody>
          </table>
        </div>
      )}
      {filtered.length > pageSize && (
        <div className="pager">
          <span className="muted small">{filtered.length} records</span>
          <div>
            <button className="btn btn-sm btn-ghost" disabled={cur === 0} onClick={() => setPage(cur - 1)}>‹ Prev</button>
            <span className="small pager-n">{cur + 1} / {pages}</span>
            <button className="btn btn-sm btn-ghost" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next ›</button>
          </div>
        </div>
      )}
    </div>
  );
}
