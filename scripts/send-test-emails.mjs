import { readFileSync } from 'fs';

const API_KEY = readFileSync('.dev.vars', 'utf8')
  .split('\n').find(l => l.startsWith('RESEND_API_KEY='))
  ?.split('=').slice(1).join('')?.trim();

if (!API_KEY) { console.error('No RESEND_API_KEY in .dev.vars'); process.exit(1); }

const FROM = 'Sovereign OS <sovereign@defrag.app>';
const TO = 'defragapp@gmail.com';

// Mirrors src/lib/email.ts emailShell/emailButton/emailLink (dark brand).
function emailShell(title, bodyHtml) {
  return `<div style="margin:0;padding:32px 16px;background:#0d0d0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"><div style="max-width:480px;margin:0 auto;background:#16130f;border-radius:12px;border:1px solid rgba(250,245,236,0.10)"><div style="background:#0d0d0d;padding:22px 28px;text-align:center;border-bottom:1px solid rgba(250,245,236,0.08);border-radius:12px 12px 0 0"><span style="font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;color:#f4efe4;font-size:14px;font-weight:600;letter-spacing:0.22em">SOVEREIGN<span style="color:#8a857b">.OS</span></span></div><div style="padding:28px"><h2 style="color:#f4efe4;font-size:20px;font-weight:600;margin:0 0 16px;text-align:center">${title}</h2><div style="text-align:center;color:#c2bcb0">${bodyHtml}</div></div><div style="padding:18px 28px;text-align:center;border-top:1px solid rgba(250,245,236,0.08)"><p style="color:#8a857b;font-size:12px;margin:0">&copy; Sovereign OS &mdash; Your personal intelligence layer.</p></div></div></div>`;
}

function button(href, label) { return `<a href="${href}" style="display:inline-block;background:#f4efe4;color:#141210;padding:12px 28px;border-radius:8px;text-decoration:none;margin:16px 0;font-weight:600;font-size:14px">${label}</a>`; }
function link(href, label) { return `<a href="${href}" style="color:#f4efe4;font-weight:600;text-decoration:underline">${label}</a>`; }

const T = [
  { name:'welcome', subject:'Welcome to Sovereign OS',
    html: emailShell('Welcome to Sovereign OS', `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 4px">Your account is ready. Complete your baseline to begin.</p>` + button('https://sovereign.defrag.app/onboard','Set Your Baseline')) },
  { name:'verify', subject:'Verify your email',
    html: emailShell('Verify your email', `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 4px">Welcome to Sovereign OS. Confirm your email address to unlock your baseline and personal AI chat.</p>` + button('https://sovereign.defrag.app/api/auth/verify?token=TEST123','Verify Email') + `<p style="color:#8a857b;font-size:13px;margin:16px 0 0">This link expires in 48 hours. If you didn&apos;t create an account, you can safely ignore this email.</p>`) },
  { name:'password-reset', subject:'Reset your password',
    html: emailShell('Reset your password', `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 4px">We received a request to reset your password. Click below to set a new one.</p>` + button('https://sovereign.defrag.app/onboard?reset=TEST456','Reset Password') + `<p style="color:#8a857b;font-size:13px;margin:16px 0 0">This link expires in 30 minutes. If you didn&apos;t request this, you can safely ignore this email.</p>`) },
  { name:'billing', subject:'Payment successful',
    html: emailShell('Payment successful', `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 4px">Your payment of <strong>$9.00</strong> was processed on September 12, 2026.</p><p style="color:#c2bcb0;line-height:1.6;margin:0 0 4px">Next billing date: October 12, 2026</p>` + link('https://sovereign.defrag.app/account?tab=billing','View billing history')) },
  { name:'trial-ending', subject:'Your trial ends soon',
    html: emailShell('Your trial ends soon', `<p style="color:#c2bcb0;line-height:1.6;margin:0 0 4px">Your free trial expires in <strong>3 days</strong>. Upgrade now to keep your data and continue using Sovereign OS.</p>` + button('https://sovereign.defrag.app/upgrade','Upgrade now')) },
];

let sent = 0;
for (const t of T) {
  try {
    const res = await fetch('https://api.resend.com/emails', { method:'POST', headers:{ Authorization:`Bearer ${API_KEY}`,'Content-Type':'application/json' }, body: JSON.stringify({ from:FROM, to:[TO], subject:t.subject, html:t.html }) });
    const data = await res.json();
    if (res.ok) { console.log(`OK ${t.name}: ${data.id}`); sent++; } else { console.log(`FAIL ${t.name}: ${data.message||res.status}`); }
  } catch(e) { console.log(`FAIL ${t.name}: ${e.message}`); }
  await new Promise(r=>setTimeout(r,120));
}
console.log(`\n${sent}/${T.length} emails sent.`);
