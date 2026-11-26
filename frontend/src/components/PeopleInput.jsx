import { useRef } from 'react';
import { Badge, Button, Field } from './ui.jsx';
import './links.css';

export const EXPIRY_OPTIONS = [[1, '1 hour'], [6, '6 hours'], [24, '24 hours'], [48, '2 days'], [72, '3 days'], [168, '7 days']];

/**
 * "How many candidates?" stepper + optional pasted/CSV list of names & emails + link options.
 * The parent owns the state and parses the text with parsePeople() (so it can validate against the cap before calling the API).
 *   parsed = { rows, errors, duplicates }   n = effective number of links (rows.length when a list is given, else `count`)
 */
export default function PeopleInput({ count, setCount, text, setText, parsed, max, locked, setLocked, hours, setHours, allowZero = true }) {
  const fileRef = useRef(null);
  const hasList = parsed.rows.length > 0;
  const n = hasList ? parsed.rows.length : count;
  const min = allowZero ? 0 : 1;
  const clamp = (v) => Math.max(min, Math.min(max, Math.floor(Number(v) || 0)));

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 512 * 1024) { setText(''); return; }
    setText(await f.text());
  };

  return (
    <div className="people-box">
      <div className="people-grid">
        <Field label={`How many candidates will take this test?`} hint={`max ${max} per session`}>
          <div className="count-stepper" role="group" aria-label="Number of candidates">
            <Button type="button" variant="ghost" aria-label="One fewer" disabled={hasList || n <= min} onClick={() => setCount(clamp(count - 1))}>−</Button>
            <input className="input" type="number" inputMode="numeric" min={min} max={max} aria-label="Number of candidates" value={hasList ? n : count} disabled={hasList}
              onChange={(e) => setCount(clamp(e.target.value))} onFocus={(e) => e.target.select()} />
            <Button type="button" variant="ghost" aria-label="One more" disabled={hasList || n >= max} onClick={() => setCount(clamp(count + 1))}>+</Button>
          </div>
        </Field>
        <Field label="Each link is valid for">
          <select className="input" value={hours} onChange={(e) => setHours(parseInt(e.target.value, 10))}>
            {EXPIRY_OPTIONS.map(([h, l]) => <option key={h} value={h}>{l}</option>)}
          </select>
        </Field>
        <label className="checkbox" title="When on, the candidate cannot change the name/email you entered">
          <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} disabled={!hasList} /> Lock the name on the link{!hasList && <span className="muted small"> (needs a names list)</span>}
        </label>
      </div>

      <details open={!!text}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--navy)' }}>Add names &amp; emails <span className="muted small">(optional — one candidate per line: <code>name,email</code> or just <code>name</code>)</span></summary>
        <div className="stack" style={{ marginTop: 10 }}>
          <textarea className="input" rows={5} value={text} onChange={(e) => setText(e.target.value)} aria-label="Names and emails, one per line"
            placeholder={'Asha Verma, asha@example.com\nRahul Nair, rahul@example.com\nPriya Singh'} spellCheck={false} />
          <div className="row">
            <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={onFile} />
            <Button type="button" size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>⬆ Upload CSV</Button>
            {text && <Button type="button" size="sm" variant="ghost" onClick={() => setText('')}>Clear list</Button>}
          </div>
          {(text.trim() || parsed.errors.length > 0) && (
            <div className="people-chips" role="status">
              <Badge tone="green">{parsed.rows.length} parsed</Badge>
              {parsed.duplicates > 0 && <Badge tone="amber">{parsed.duplicates} duplicate email{parsed.duplicates === 1 ? '' : 's'} ignored</Badge>}
              {parsed.errors.length > 0 && <Badge tone="red">{parsed.errors.length} line{parsed.errors.length === 1 ? '' : 's'} need fixing</Badge>}
            </div>
          )}
          {parsed.errors.length > 0 && (
            <ul className="people-errors">
              {parsed.errors.slice(0, 5).map((e) => <li key={e.line}>Line {e.line}: {e.reason} — “{e.text}”</li>)}
              {parsed.errors.length > 5 && <li>…and {parsed.errors.length - 5} more</li>}
            </ul>
          )}
          <span className="muted small">With a list, the number of candidates is the number of valid lines. Each person gets their own unique one-time link.</span>
        </div>
      </details>
    </div>
  );
}
