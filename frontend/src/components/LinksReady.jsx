import { useEffect, useMemo, useState } from 'react';
import { copyText, linkFor } from '../utils/people.js';
import { downloadCSV, fmtDate } from '../utils/format.js';
import { Button, Card, useToast } from './ui.jsx';
import './links.css';

const nameOf = (x) => x.name || x.label || '';
const shareText = (x, sessionName) =>
  `Hello${nameOf(x) ? ` ${nameOf(x)}` : ''}, here is your ONE-TIME link for the ${sessionName || 'HPAI'} assessment (Tester ID ${x.tester_id}):\n${linkFor(x.token)}\n\nIt works for a single start only — please do not share it. Open it on a laptop/desktop with Chrome or Edge.`;
const mailHref = (x, sessionName) => `mailto:${encodeURIComponent(x.email)}?subject=${encodeURIComponent(`Your ${sessionName || 'HPAI'} assessment link`)}&body=${encodeURIComponent(shareText(x, sessionName))}`;
const waHref = (x, sessionName) => `https://wa.me/?text=${encodeURIComponent(shareText(x, sessionName))}`;

/**
 * Shown ONCE right after links are created / regenerated / reissued (tokens are never retrievable again).
 * Nothing here is persisted: tokens live only in React state.
 */
export default function LinksReady({ invites, title = 'Links ready', subtitle, sessionName, onDone, doneLabel = 'Done' }) {
  const toast = useToast();
  const [sel, setSel] = useState(() => new Set());
  const list = invites || [];
  const allSel = list.length > 0 && sel.size === list.length;
  const expires = list[0]?.expires_at;

  useEffect(() => setSel(new Set()), [invites]);
  useEffect(() => {
    const after = () => document.body.classList.remove('printing-links');
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('afterprint', after); after(); };
  }, []);

  const toggle = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const copy = async (text, msg) => { const ok = await copyText(text); toast(ok ? msg : 'Could not copy — select the text and copy it manually', ok ? 'success' : 'error'); };
  const lineOf = (x) => `${x.tester_id}${nameOf(x) ? ` (${nameOf(x)})` : ''}\t${linkFor(x.token)}`;
  const chosen = useMemo(() => list.filter((x) => sel.has(x.id)), [list, sel]);

  const csv = () => downloadCSV(`invite_links_${new Date().toISOString().slice(0, 10)}.csv`, [
    { label: 'tester_id', value: (r) => r.tester_id }, { label: 'name', value: (r) => nameOf(r) }, { label: 'email', value: (r) => r.email || '' },
    { label: 'link', value: (r) => linkFor(r.token) }, { label: 'expires', value: (r) => r.expires_at },
  ], list);

  const print = () => { document.body.classList.add('printing-links'); setTimeout(() => window.print(), 50); };

  return (
    <Card title={title} subtitle={subtitle || `${list.length} one-time link${list.length === 1 ? '' : 's'} · each has its own Tester ID and works for ONE start only.`}
      actions={<Button variant="success" onClick={onDone}>{doneLabel}</Button>}>
      <div className="stack">
        <div className="alert alert-warn" role="alert"><span><b>Links are shown only once.</b> Copy or download them now — for security they cannot be retrieved later (you can always Reissue a fresh one for a Tester ID). {expires ? <>They expire {fmtDate(expires)}.</> : null}</span></div>
        <div className="alert alert-info"><span><b>Tip — release in waves.</b> If many candidates press Start in the same second the server has to do a burst of work. Select 10–15 rows, press <i>Copy selected</i>, send them, then the next group.</span></div>

        <div className="links-toolbar">
          <Button size="sm" onClick={() => copy(list.map(lineOf).join('\n'), `All ${list.length} links copied`)}>Copy all</Button>
          <Button size="sm" variant="ghost" disabled={!chosen.length} onClick={() => copy(chosen.map(lineOf).join('\n'), `${chosen.length} link${chosen.length === 1 ? '' : 's'} copied`)}>Copy selected ({chosen.length})</Button>
          <Button size="sm" variant="ghost" onClick={csv}>⬇ Download CSV</Button>
          <Button size="sm" variant="ghost" onClick={print}>🖨 Print sheet</Button>
          <span className="muted small">Mail / WhatsApp buttons only open your own app with the text filled in.</span>
        </div>

        <div className="table-scroll">
          <table className="table stackable links-table">
            <thead><tr>
              <th scope="col" className="sel"><input type="checkbox" aria-label="Select all links" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(list.map((x) => x.id)))} /></th>
              <th scope="col">Tester ID</th><th scope="col">Candidate</th><th scope="col">Link</th><th scope="col"><span className="sr-only">Actions</span></th>
            </tr></thead>
            <tbody>{list.map((x) => (
              <tr key={x.id}>
                <td data-label="Select" className="sel"><input type="checkbox" aria-label={`Select ${x.tester_id}`} checked={sel.has(x.id)} onChange={() => toggle(x.id)} /></td>
                <td data-label="Tester ID"><span className="tester-chip">{x.tester_id}</span>{x.purpose === 'resume' && <span className="small muted"> · resume</span>}</td>
                <td data-label="Candidate"><div className="name-cell"><strong>{nameOf(x) || '—'}</strong>{x.email && <span>{x.email}</span>}</div></td>
                <td data-label="Link"><span className="link-url" title="One-time link">{linkFor(x.token)}</span></td>
                <td data-label="" className="right"><div className="cell-actions">
                  <Button size="sm" variant="ghost" onClick={() => copy(linkFor(x.token), `${x.tester_id} link copied`)}>Copy</Button>
                  {x.email && <a className="btn btn-ghost btn-sm" href={mailHref(x, sessionName)}>Mail</a>}
                  <a className="btn btn-ghost btn-sm" href={waHref(x, sessionName)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      {/* Printable sheet: invisible on screen, the only thing printed (body.printing-links) */}
      <div className="links-print" aria-hidden="true">
        {list.map((x) => (
          <div className="print-card" key={x.id}>
            <div className="pc-head">HPAI Assessment{sessionName ? ` — ${sessionName}` : ''}</div>
            <div className="pc-tid">{x.tester_id}</div>
            {nameOf(x) && <div className="pc-name">{nameOf(x)}</div>}
            <div className="pc-url">{linkFor(x.token)}</div>
            <div className="pc-note">ONE-TIME link — it works for a single start only. Do not share it. Use a laptop/desktop with Chrome or Edge. You may leave the test screen at most 2 times; the 3rd time submits automatically. Screenshots and recording are prohibited.</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
