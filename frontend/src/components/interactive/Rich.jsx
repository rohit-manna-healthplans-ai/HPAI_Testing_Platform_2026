/** Tiny inline formatter: **bold** and `code` (React escapes everything else — no innerHTML). */
export default function Rich({ text }) {
  const parts = String(text || '').split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('`') && p.endsWith('`') && p.length > 2) return <code key={i} className="ix-code">{p.slice(1, -1)}</code>;
    return p;
  });
}
