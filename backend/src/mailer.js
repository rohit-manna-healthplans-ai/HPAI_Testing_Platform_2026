// Optional transactional email over HTTPS (Render's free tier blocks outbound SMTP ports).
// Enabled only when EMAIL_PROVIDER=resend, RESEND_API_KEY, EMAIL_FROM and APP_URL are all set; otherwise the
// forgot-password flow runs in "admin-assisted" mode. Never log the API key or the reset link.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const emailMode = () => (
  process.env.EMAIL_PROVIDER === 'resend' && process.env.RESEND_API_KEY && process.env.EMAIL_FROM && process.env.APP_URL ? 'resend' : null
);
export const appUrl = () => String(process.env.APP_URL || '').trim().replace(/\/+$/, '');

export async function sendResetEmail({ to, name, link, minutes }) {
  const base = String(process.env.RESEND_API_URL || 'https://api.resend.com').replace(/\/+$/, '');
  const subject = 'Reset your HPAI Assessment password';
  const text = `Hello ${name || ''},\n\nUse this link to set a new password (valid for ${minutes} minutes, one use only):\n${link}\n\nIf you did not ask for this, you can ignore this email — your password stays the same.\n\nHPAI Assessment Platform`;
  const html = `<div style="font-family:Arial,sans-serif;color:#173044;line-height:1.5">
<h2 style="color:#173f59;margin:0 0 12px">Reset your password</h2>
<p>Hello ${esc(name || '')},</p>
<p>Use the button below to set a new password. The link works <b>once</b> and expires in <b>${minutes} minutes</b>.</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#173f59;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">Set a new password</a></p>
<p style="color:#718895;font-size:13px">If the button does not work, copy this address into your browser:<br>${esc(link)}</p>
<p style="color:#718895;font-size:13px">If you did not ask for this, ignore this email — your password stays the same.</p>
<p style="color:#718895;font-size:12px">HPAI Assessment Platform · Healthplans.ai</p></div>`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(`${base}/emails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html, text }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`email provider responded ${res.status}`); // status only: never echo the response body / key
    return true;
  } finally { clearTimeout(timer); }
}
