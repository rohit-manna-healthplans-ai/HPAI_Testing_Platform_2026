// Generic cloud-service glyphs (NOT official logos): a provider-tinted rounded square + a simple line glyph chosen by `kind`.
import { useId } from 'react';

const GLYPHS = {
  users: <><circle cx="12" cy="8" r="3.2" /><path d="M5.5 19.5c.7-3.6 3.3-5.5 6.5-5.5s5.8 1.9 6.5 5.5" /></>,
  cdn: <><circle cx="12" cy="12" r="8" /><ellipse cx="12" cy="12" rx="3.6" ry="8" /><path d="M4 12h16" /></>,
  dns: <><path d="M12 3.5v17" /><path d="M12 6h6l2 2-2 2h-6z" /><path d="M12 12H6l-2 2 2 2h6" /></>,
  lb: <><circle cx="5" cy="12" r="1.8" /><path d="M6.8 12h4l4-5.5h2.4M10.8 12h6.1M10.8 12l4 5.5h2.4" /><circle cx="19.2" cy="6.5" r="1.4" /><circle cx="19.2" cy="12" r="1.4" /><circle cx="19.2" cy="17.5" r="1.4" /></>,
  compute: <><rect x="6.5" y="6.5" width="11" height="11" rx="2" /><path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3" /></>,
  container: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" /></>,
  function: <><path d="M8 4c-2 0-3 1-3 3v2c0 1-.8 2-2 3 1.2 1 2 2 2 3v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1 .8 2 2 3-1.2 1-2 2-2 3v2c0 2-1 3-3 3" /><path d="M12.6 8l-2.4 4h3.2l-2.4 4" /></>,
  storage: <><path d="M5 8c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3z" /><path d="M5 8l1.5 10c.2 1.2 2.6 2 5.5 2s5.3-.8 5.5-2L19 8" /></>,
  'db-sql': <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" /></>,
  'db-nosql': <><rect x="4" y="6" width="12" height="14" rx="2" /><path d="M8 3.5h10a2 2 0 012 2V16" /><path d="M7.5 11h5M7.5 14.5h5" /></>,
  cache: <path d="M13.2 3L6 13h5l-1 8 8-11h-5z" />,
  queue: <><rect x="3" y="9" width="4" height="6" rx="1" /><rect x="9.5" y="9" width="4" height="6" rx="1" /><path d="M16.5 12h4M18.6 9.6L21 12l-2.4 2.4" /></>,
  'api-gateway': <><path d="M4 20V11a8 8 0 0116 0v9" /><path d="M9 20v-6a3 3 0 016 0v6" /></>,
  monitoring: <><rect x="3.5" y="4.5" width="17" height="12" rx="2" /><path d="M6.5 12l3-3 2.5 2.5 3.5-4.5" /><path d="M9 20h6M12 16.5V20" /></>,
  identity: <><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><circle cx="12" cy="10" r="2.2" /><path d="M8.5 16c.6-1.8 1.9-2.6 3.5-2.6s2.9.8 3.5 2.6" /></>,
  network: <><circle cx="12" cy="5" r="2" /><circle cx="5" cy="18" r="2" /><circle cx="19" cy="18" r="2" /><path d="M12 7v5M12 12l-6 4.5M12 12l6 4.5" /></>,
  analytics: <><path d="M4 20h16" /><rect x="5.5" y="12" width="3" height="8" /><rect x="10.5" y="7" width="3" height="13" /><rect x="15.5" y="4" width="3" height="16" /></>,
  ml: <><circle cx="5" cy="7" r="1.6" /><circle cx="5" cy="17" r="1.6" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="7" r="1.6" /><circle cx="19" cy="17" r="1.6" /><path d="M6.4 7.8l4.2 3M6.4 16.2l4.2-3M13.5 11l4-3M13.5 13l4 3" /></>,
  secrets: <><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8 10.5V8a4 4 0 018 0v2.5" /><circle cx="12" cy="15" r="1.2" /></>,
  search: <><circle cx="10.5" cy="10.5" r="5.5" /><path d="M15 15l5 5" /></>,
  firewall: <><rect x="3.5" y="5" width="17" height="14" rx="1.5" /><path d="M3.5 10h17M3.5 14.5h17M9 5v5M15 10v4.5M9 14.5V19" /></>,
  email: <><rect x="3.5" y="6" width="17" height="12" rx="2" /><path d="M4 7.5l8 6 8-6" /></>,
};
export const CLOUD_KINDS = Object.keys(GLYPHS);

const TINTS = {
  aws: ['#ffc15e', '#ff9900'],
  azure: ['#4fb0ff', '#0a74d1'],
  generic: ['#2f6f94', '#173f59'],
};

export default function CloudIcon({ kind = 'compute', provider = 'generic', size = 34, className = '' }) {
  const uid = useId().replace(/:/g, '');
  const g = GLYPHS[kind] || GLYPHS.container;
  const gcp = provider === 'gcp';
  const tint = TINTS[provider] || TINTS.generic;
  return (
    <svg className={`ix-icon ${className}`} width={size} height={size} viewBox="0 0 36 36" role="img" aria-label={`${kind} service`} focusable="false">
      <defs>
        <linearGradient id={`t${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={tint[0]} /><stop offset="1" stopColor={tint[1]} /></linearGradient>
        <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4285f4" /><stop offset=".35" stopColor="#ea4335" /><stop offset=".7" stopColor="#fbbc04" /><stop offset="1" stopColor="#34a853" /></linearGradient>
      </defs>
      {gcp ? (
        <>
          <rect x="1.5" y="1.5" width="33" height="33" rx="9" fill="#fff" stroke={`url(#g${uid})`} strokeWidth="3" />
          <g transform="translate(6 6)" fill="none" stroke="#3b6fd8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{g}</g>
        </>
      ) : (
        <>
          <rect x="1" y="1" width="34" height="34" rx="9" fill={`url(#t${uid})`} />
          <rect x="1" y="1" width="34" height="17" rx="9" fill="#fff" opacity=".12" />
          <g transform="translate(6 6)" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{g}</g>
        </>
      )}
    </svg>
  );
}
