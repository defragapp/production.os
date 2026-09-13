import { readFileSync } from 'fs';

const API_KEY = readFileSync('.dev.vars', 'utf8')
  .split('\n').find(l => l.startsWith('RESEND_API_KEY='))
  ?.split('=').slice(1).join('')?.trim();

if (!API_KEY) { console.error('No RESEND_API_KEY in .dev.vars'); process.exit(1); }

const FROM = 'Sovereign OS <sovereign@defrag.app>';
const TO = 'defragapp@gmail.com';

function emailShell(title, bodyHtml) {
  return `<div style="font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;background:#f4f4f5;padding:32px 16px"><div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7"><div style="background:#0d0d0d;padding:20px 28px"><span style="color:#fafafa;font-size:15px;font-weight:600;letter-spacing:0.22em">SOVEREIGN<span style="color:#a1a1aa">.OS</span></span></div><div style="padding:28px"><h2 style="color:#18181b;font-size:20px;margin:0 0 12px">${title}</h2>${bodyHtml}</div><div style="padding:16px 28px;border-top:1px solid #e4e4e7"><p style="color:#a1a1aa;font-size:12px;margin:0">&copy; Sovereign OS &mdash; Your personal intelligence layer.</p></div></div></div>`;
}

function button(href, label) { return `<a href="${href}" style="display:inline-block;background:#18181b;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;margin:16px 0;font-weight:600;font-size:14px">${label}</a>`; }
function link(href, label) { return `<a href="${href}" style="color:#18181b;font-weight:600">${label}</a>`; }

const T = [
  { name:'welcome', subject:'Welcome to Sovereign OS',
    html: emailShell('Welcome to Sovereign OS', `<p style="color:#52525b;line-height:1.6;margin:0 0 4px">Your account is ready. Complete your baseline to begin.</p>` + button('https://sovereign.defrag.app/onboard','Set Your Baseline')) },
  { name:'verify', subject:'Verify your email',
    html: emailShell('Verify your email', `<p style="color:#52525b;line-height:1.6;margin:0 0 4px">Welcome to Sovereign OS. Confirm your email address to unlock your baseline and personal AI chat.</p>` + button('https://sovereign.defrag.app/api/auth/verify?token=TEST123','Verify Email') + `<p style="color:#a1a1aa;font-size:13px;margin:16px 0 0">This link expires in 48 hours. If you didn&apos;t create an account, you can safely ignore this email.</p>`) },
  { name:'password-reset', subject:'Reset your password',
    html: emailShell('Reset your password', `<p style="color:#52525b;line-height:1.6;margin:0 0 4px">We received a request to reset your password. Click below to set a new one.</p>` + button('https://sovereign.defrag.app/reset?token=TEST456','Reset Password') + `<p style="color:#a1a1aa;font-size:13px;margin:16px 0 0">This link expires in 15 minutes. If you didn&apos;t request this, you can safely ignore this email.</p>`) },
  { name:'billing', subject:'Payment successful',
    html: emailShell('Payment successful', `<p style="color:#52525b;line-height:1.6;margin:0 0 4px">Your payment of <strong>$9.00</strong> was processed on September 12, 2026.</p><p style="color:#52525b;line-height:1.6;margin:0 0 4px">Next billing date: October 12, 2026</p>` + link('https://sovereign.defrag.app/account?tab=billing','View billing history')) },
  { name:'trial-ending', subject:'Your trial ends soon',
    html: emailShell('Your trial ends soon', `<p style="color:#52525b;line-height:1.6;margin:0 0 4px">Your free trial expires in <strong>3 days</strong>. Upgrade now to keep your data and continue using Sovereign OS.</p>` + button('https://sovereign.defrag.app/upgrade','Upgrade now')) },
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
