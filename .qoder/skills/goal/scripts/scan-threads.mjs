#!/usr/bin/env node
/**
 * scan-threads.mjs — read the goals and closing state of every recent Qoder chat thread
 * for this workspace, so a task ledger can be compiled from evidence instead of memory.
 *
 * Usage:
 *   node .qoder/skills/goal/scripts/scan-threads.mjs [--days N] [--full] [--list]
 *   node ... --session 4b798035            # only one thread
 *   node ... --dir <conversation-history>  # explicit source dir
 *   node ... --project <slug>              # explicit cache project slug
 *
 * --days N   threads whose files changed within N days (default 2)
 * --full     also print assistant lines that look like open/deferred/blocked tasks
 * --list     print the thread inventory (mtime + size + first goal) and exit
 *
 * Reads only. Nothing here mutates the Qoder cache or the repo.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

const OPEN_RE = /still open|remaining (?:candidates|items|work|tasks|uncertainty)|not (?:yet )?(?:done|verified|shipped)|left (?:as-is|untouched)|deferred|follow-up|out of scope|blocked|no\s*go|next (?:gate|action|steps?|task)/i;
const MAX_ASSISTANT_LINES = 8;

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--') && !a.includes('=')));
const opt = (name, fallback) => {
  const inline = argv.find((a) => a.startsWith(`--${name}=`));
  if (inline) return inline.split('=')[1];
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const days = Number(opt('days', '2'));
const legacyDir = path.join(os.homedir(), '.qoder', 'projects');

function normalize(p) {
  return p.replace(/\/+$/, '').replace(/[^a-zA-Z0-9]/g, '-');
}

/** Candidate cache roots, best match first. */
function candidates() {
  const root = process.cwd();
  const slugHint = `${path.basename(root)}-`;
  // Qoder's project cache slug is "<basename>-<8 hex of the absolute path>"; the hash is
  // not reproduced here, so identify the project by reading a session and matching its
  // recorded root directory.
  const base = path.join(os.homedir(), '.qoder', 'cache', 'projects');
  if (!fs.existsSync(base)) return [];
  const entries = fs.readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(base, d.name, 'conversation-history'))
    .filter((d) => fs.existsSync(d));
  const byName = entries.filter((d) => path.basename(path.dirname(d)).startsWith(slugHint));
  return [...byName, ...entries.filter((e) => !byName.includes(e))];
}

function sessionsIn(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(dir, entry.name, `${entry.name}.jsonl`);
    if (fs.existsSync(file)) out.push({ id: entry.name, file, dir });
  }
  return out.sort((a, b) => fs.statSync(b.file).mtimeMs - fs.statSync(a.file).mtimeMs);
}

/** Parse one thread log into goals, assistant reports, and open-task-looking lines. */
function readThread(file) {
  const raw = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  const queries = [];
  const reports = [];
  const openLines = [];
  const roots = new Set();
  let parsed = 0;
  for (const line of raw) {
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    const content = o && o.message && o.message.content;
    if (!Array.isArray(content)) continue;
    parsed++;
    for (const c of content) {
      if (!c || c.type !== 'text' || typeof c.text !== 'string' || !c.text.trim()) continue;
      if (o.role === 'user') {
        const root = /Root Directory:\s*`?([^\n`]+)`.?/.exec(c.text);
        if (root) roots.add(root[1].trim());
        for (const m of c.text.matchAll(/<user_query>([\s\S]*?)<\/user_query>/g)) {
          const q = m[1].trim();
          if (q && !queries.includes(q)) queries.push(q);
        }
      } else if (o.role === 'assistant') {
        reports.push(c.text.trim());
        if (OPEN_RE.test(c.text)) openLines.push(c.text.trim());
      }
    }
  }
  return { queries, reports, openLines, roots, lines: raw.length, parsed };
}

function clip(text, n) {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > n ? `${flat.slice(0, n)} …` : flat;
}

/** "2026-10-06 19:08" in the machine's local zone, which is how the user reads time. */
function local(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function main() {
  const explicit = opt('dir', '');
  const project = opt('project', '');
  const only = opt('session', '');
  const dirs = explicit ? [explicit]
    : project ? [path.join(os.homedir(), '.qoder', 'cache', 'projects', project, 'conversation-history')]
    : candidates();
  const usable = dirs.filter((d) => fs.existsSync(d) && fs.statSync(d).isDirectory());
  if (!usable.length) {
    console.error(`No Qoder conversation history found for ${process.cwd()}.
Pass --dir <path>/conversation-history or --project <cache slug>.
Looked in: ${dirs.join('\n  ') || '(nothing matched)'}`);
    process.exit(2);
  }
  if (only && !sessionsIn(usable[0]).some((t) => t.id.startsWith(only))) {
    console.error(`No thread id starts with "${only}" in ${usable[0]}.\nRun without --session, using --list --days 30, to see the inventory.`);
    process.exit(2);
  }

  const cutoff = Date.now() - days * 86400_000;
  const cwdRoot = normalize(process.cwd());
  const all = usable.flatMap((d) => sessionsIn(d));
  const threads = all.filter((t) => !only || t.id.startsWith(only));

  // The current session is always this process's own log: newest file in the matching
  // project dir. It is excluded from the report so a run never quotes itself — unless the
  // user asked for one specific thread, which is then printed regardless of age.
  const inventory = [];
  for (const t of threads) {
    const mtime = fs.statSync(t.file).mtimeMs;
    const size = fs.statSync(t.file).size;
    const cheap = readThread(t.file);
    const matchesWorkspace = [...cheap.roots].some((r) => normalize(r) === cwdRoot);
    inventory.push({ ...t, mtime, size, matchesWorkspace, cheap });
  }
  const relevant = inventory.filter((t) => t.matchesWorkspace || only);
  const self = only ? null : relevant.reduce((a, b) => (b.mtime > (a?.mtime || 0) ? b : a), null);
  const window = relevant.filter((t) => only || (t.mtime >= cutoff && t !== self));

  console.log(`# Qoder threads — workspace ${process.cwd()}`);
  console.log(`source: ${usable.join(', ')}\n`);
  console.log(`in window (last ${days}d, excluding this session): ${window.length}`);
  if (self) console.log(`skipping current thread ${self.id} (newest activity)`);
  const foreign = inventory.filter((t) => !t.matchesWorkspace);
  if (foreign.length) {
    console.log(`note: ${foreign.length} thread log(s) here recorded no Root Directory for this workspace (subagent or other-project logs) — excluded`);
  }

  if (flags.has('--list')) {
    console.log('\nid        last activity (local)   size    first goal');
    for (const t of window) {
      const goal = t.cheap.queries[0] ? clip(t.cheap.queries[0], 90) : '(no user query)';
      console.log(`${t.id}  ${local(t.mtime)}  ${String((t.size / 1024) | 0).padStart(5)}K  ${goal}`);
    }
    return;
  }

  for (const t of window) {
    console.log(`\n\n================ THREAD ${t.id} ================`);
    console.log(`last activity ${local(t.mtime)} (local)  size ${(t.size / 1024) | 0}K  records ${t.cheap.lines} (${t.cheap.parsed} parsed)`);
    if (!t.cheap.queries.length) console.log('goals: (none found — this thread may be subagent-only)');
    t.cheap.queries.forEach((q, i) => console.log(`\nGOAL ${i + 1}: ${clip(q, 1400)}`));
    const tail = t.cheap.reports.slice(-3);
    console.log('\n--- closing reports ---');
    tail.forEach((r, i) => console.log(`\n[${i + 1}/${tail.length}] ${r}`));
    if (flags.has('--full')) {
      const open = t.cheap.openLines.slice(-MAX_ASSISTANT_LINES);
      console.log('\n--- lines that read as open/deferred/blocked ---');
      if (!open.length) console.log('(none matched)');
      open.forEach((r) => console.log(`\n> ${clip(r, 2200)}`));
    }
  }

  const older = only ? [] : relevant.filter((t) => t.mtime < cutoff);
  if (older.length) {
    console.log(`\n# Older threads in this workspace (raise --days to include): ${older.map((t) => `${t.id}@${local(t.mtime).slice(0, 10)}`).join(', ')}`);
  }
  if (fs.existsSync(legacyDir)) {
    const legacy = fs.readdirSync(legacyDir).filter((d) => d.startsWith(cwdRoot.split('-').slice(-3).join('-').toLowerCase()));
    if (legacy.length) console.log(`\n# Legacy session store: ${path.join(legacyDir, legacy[0])} (dir mtimes only — no message timestamps)`);
  }
}

main();
