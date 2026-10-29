import { html, render, useState, useEffect, useMemo, useRef } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = 'https://kgoebdpbgwteebberznw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_jyzri7Cq_iAscQWpAI6PmA_u3fMJmyO';
const DOMAIN = 'burgersinghonline.com';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' } });

/* ---------- dates (Asia/Kolkata) ---------- */
const istNow = () => new Date(Date.now() + 5.5 * 3600e3);
const today = () => istNow().toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d) + n * 86400e3).toISOString().slice(0, 10);
const diff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400e3);
const dow = (d) => (new Date(Date.parse(d)).getUTCDay() + 6) % 7; // 0 = Monday
const weekStart = () => addDays(today(), -dow(today()));
const weekEnd = () => addDays(weekStart(), 6);
const nextDow = (target) => { const t = today(); let n = (target - dow(t) + 7) % 7; if (n === 0) n = 7; return addDays(t, n); };
const fmtDate = (d) => new Date(Date.parse(d)).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const shortDue = (d) => {
  if (!d) return 'No date';
  const n = diff(d, today());
  if (n > 0) return `${n}d late`;
  if (n === 0) return 'Today';
  if (n === -1) return 'Tomorrow';
  if (n > -7) return new Date(Date.parse(d)).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' });
  return fmtDate(d);
};
const ago = (ts) => {
  if (!ts) return '';
  const m = Math.round((Date.now() - Date.parse(ts)) / 60000);
  if (m < 60) return `${Math.max(m, 1)}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};
const initials = (n = '') => n.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const first = (n = '') => n.split(' ')[0];
const isLate = (t) => t.status !== 'done' && t.due_date && t.due_date < today();
const needsDate = (t) => t.status !== 'done' && (!t.due_date || !t.priority);

/* ---------- icons ---------- */
const Icon = ({ d }) => html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  overview: html`<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>`,
  mine: html`<circle cx="12" cy="12" r="8"/><path d="M8.5 12l2.5 2.5 4.5-5"/>`,
  dept: html`<circle cx="9" cy="9" r="3.2"/><circle cx="16.5" cy="10" r="2.6"/><path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5"/><path d="M15 15c2.2 0 4 1.2 5 3.6"/>`,
  all: html`<path d="M5 6h14M5 12h14M5 18h14"/>`,
};

/* ---------- app ---------- */
function App() {
  const [session, setSession] = useState(undefined);
  const [me, setMe] = useState(null);
  const [data, setData] = useState(null);
  const [route, setRoute] = useState(parseHash());
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => { sub.subscription.unsubscribe(); window.removeEventListener('hashchange', onHash); };
  }, []);

  async function load() {
    try {
      const since = new Date(Date.now() - 14 * 86400e3).toISOString();
      const [p, d, m, l, t, done, dcr] = await Promise.all([
        sb.from('people').select('*').eq('active', true).order('name'),
        sb.from('departments').select('*').eq('active', true).order('sort_order'),
        sb.from('department_members').select('*'),
        sb.from('task_lists').select('*').eq('active', true).order('name'),
        sb.from('v_tasks').select('*').neq('status', 'done').limit(5000),
        sb.from('v_tasks').select('*').eq('status', 'done').gte('completed_at', since).limit(2000),
        sb.from('date_change_requests').select('*').eq('status', 'pending'),
      ]);
      const err = [p, d, m, l, t, done, dcr].find((r) => r.error);
      if (err) throw err.error;
      const meRow = p.data.find((x) => x.auth_user_id === session.user.id) ?? null;
      setMe(meRow);
      setData({ people: p.data, depts: d.data, members: m.data, lists: l.data, tasks: [...t.data, ...done.data], dcr: dcr.data });
      setError('');
    } catch (e) { setError(e.message || 'Could not load tasks.'); }
  }
  useEffect(() => { if (session) load(); }, [session?.user?.id]);
  useEffect(() => {
    const onFocus = () => session && load();
    window.addEventListener('focus', onFocus);
    const iv = setInterval(onFocus, 120000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(iv); };
  }, [session?.user?.id]);
  useEffect(() => { if (route.task && data) setSheet({ mode: 'edit', id: route.task }); }, [route.task, !!data]);

  if (session === undefined) return html`<p class="boot">Loading…</p>`;
  if (!session) return html`<${Login} />`;
  if (error && !data) return html`<div class="login"><div class="card"><h1>Could not load</h1><p class="err">${error}</p><button class="btn primary big" onClick=${load}>Try again</button></div></div>`;
  if (!data) return html`<p class="boot">Loading tasks…</p>`;
  if (!me) return html`<div class="login"><div class="card"><h1>No access yet</h1><p>${session.user.email} is not set up in BS Tasks. Ask Bhargav to add you.</p><button class="btn big" onClick=${() => sb.auth.signOut()}>Sign out</button></div></div>`;

  const ctx = makeCtx({ me, data, setData, load, setSheet, setToast });
  const isAdmin = me.role === 'admin';
  const view = route.view || (isAdmin ? 'overview' : 'mine');
  const nav = [
    isAdmin && { id: 'overview', label: 'Overview', n: ctx.needsYou().length },
    { id: 'mine', label: 'My tasks', n: ctx.mine().filter((t) => t.status !== 'done').length },
    { id: 'dept', label: 'Department' },
    (isAdmin || ctx.headDepts.length) && { id: 'all', label: 'All tasks', n: ctx.visibleOpen().length },
  ].filter(Boolean);

  return html`
    <div class="shell">
      <nav class="side" aria-label="Main">
        <div class="brand"><span class="mark" aria-hidden="true"></span>BS Tasks</div>
        ${nav.map((n) => html`<a class="navlink" href=${'#' + n.id} aria-current=${view === n.id ? 'page' : null}>${n.label}${n.n != null ? html`<span class="n num">${n.n}</span>` : ''}</a>`)}
        <div class="grow"></div>
        <div class="who">${me.name}</div>
        <button class="linkbtn" style="padding:0 12px;text-align:left" onClick=${() => sb.auth.signOut()}>Sign out</button>
      </nav>
      <main class="page" id="main">
        ${view === 'overview' && isAdmin ? html`<${Overview} ctx=${ctx} />` : ''}
        ${view === 'mine' || (view === 'overview' && !isAdmin) ? html`<${Mine} ctx=${ctx} />` : ''}
        ${view === 'dept' ? html`<${Dept} ctx=${ctx} route=${route} />` : ''}
        ${view === 'all' ? html`<${AllTasks} ctx=${ctx} route=${route} />` : ''}
      </main>
      <nav class="tabs" aria-label="Main">
        ${nav.map((n) => html`<a class="tab" href=${'#' + n.id} aria-current=${view === n.id ? 'page' : null}><${Icon} d=${ICONS[n.id]} />${n.label === 'My tasks' ? 'Mine' : n.label === 'All tasks' ? 'All' : n.label}</a>`)}
      </nav>
      <${Composer} ctx=${ctx} deptHint=${view === 'dept' ? route.dept : null} />
      ${sheet ? html`<${TaskSheet} ctx=${ctx} sheet=${sheet} close=${() => { setSheet(null); if (location.hash.startsWith('#task=')) history.replaceState(null, '', '#' + view); }} />` : ''}
      ${toast ? html`<${Toast} toast=${toast} done=${() => setToast(null)} />` : ''}
    </div>`;
}

function parseHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith('task=')) return { task: h.slice(5) };
  const [view, q] = h.split('?');
  const params = Object.fromEntries(new URLSearchParams(q || ''));
  return { view: view || null, ...params };
}

/* ---------- shared helpers bound to data ---------- */
function makeCtx({ me, data, setData, load, setSheet, setToast }) {
  const { people, depts, members, lists, tasks, dcr } = data;
  const person = (id) => people.find((p) => p.id === id);
  const dept = (id) => depts.find((d) => d.id === id);
  const list = (id) => lists.find((l) => l.id === id);
  const isAdmin = me.role === 'admin';
  const myDepts = members.filter((m) => m.person_id === me.id).map((m) => m.department_id);
  const headDepts = members.filter((m) => m.person_id === me.id && m.is_head).map((m) => m.department_id);
  const isHead = (d) => headDepts.includes(d);
  const canSeeStats = (personId) => isAdmin || personId === me.id || members.some((m) => m.person_id === personId && headDepts.includes(m.department_id));
  const canDecide = (t) => isAdmin || isHead(t.department_id) || t.created_by === me.id;
  const canRedate = (t) => isAdmin || isHead(t.department_id) || t.created_by === me.id;
  const canEdit = (t) => isAdmin || isHead(t.department_id) || t.owner_id === me.id || t.created_by === me.id;
  const open = () => tasks.filter((t) => t.status !== 'done');
  const visibleOpen = () => open();
  const mine = () => tasks.filter((t) => t.owner_id === me.id);

  function patchLocal(ids, fields) {
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (ids.includes(t.id) ? { ...t, ...fields } : t)) }));
  }
  async function update(ids, fields, msg, undoFields) {
    ids = [].concat(ids);
    patchLocal(ids, fields);
    const { error } = await sb.from('tasks').update(fields).in('id', ids);
    if (error) { setToast({ text: error.message }); load(); return false; }
    if (msg) setToast({ text: msg, undo: undoFields ? async () => { patchLocal(ids, undoFields); await sb.from('tasks').update(undoFields).in('id', ids); load(); } : null });
    return true;
  }
  async function save(t, fields, onSaved) { if (await update(t.id, fields, null)) onSaved?.(t.id); }
  const done = (t) => update(t.id, { status: 'done', completed_at: new Date().toISOString() }, 'Marked done', { status: 'open', completed_at: null });
  const reopen = (t) => update(t.id, { status: 'open', completed_at: null }, 'Reopened');

  function needsYou() {
    if (!isAdmin) return [];
    const td = today();
    const out = [];
    for (const r of dcr) {
      const t = tasks.find((x) => x.id === r.task_id);
      if (t) out.push({ key: 'd' + r.id, kind: 'Date change', t, title: `${t.title} → ${shortDue(r.proposed_due)}`, who: `${first(person(r.requested_by)?.name)}, ${dept(t.department_id)?.name}${t.slip_count ? `, moved ${t.slip_count}× already` : ''}`, req: r });
    }
    for (const t of open()) {
      const who = `${first(person(t.owner_id)?.name)}, ${dept(t.department_id)?.name}`;
      if (t.owner_id === me.id && t.request_status === 'pending') out.push({ key: 'r' + t.id, kind: 'Request', t, title: t.title, who: `From ${first(person(t.created_by)?.name)}`, request: true });
      else if (t.status === 'blocked' && diff(t.updated_at.slice(0, 10), td) >= 3) out.push({ key: 'b' + t.id, kind: 'Blocked', t, title: `${t.title}, ${diff(t.updated_at.slice(0, 10), td)}d`, who: t.blocked_on_person_id ? `Waiting on ${first(person(t.blocked_on_person_id)?.name)}` : who });
      else if (t.priority === 'P1' && isLate(t)) out.push({ key: 'l' + t.id, kind: 'P1 late', t, title: `${t.title}, ${diff(t.due_date, td)}d`, who });
      else if (t.slip_count >= 2) out.push({ key: 's' + t.id, kind: `Moved ${t.slip_count}×`, t, title: t.title, who });
      else if (!t.acknowledged_at && t.owner_id !== t.created_by && diff(t.created_at.slice(0, 10), td) >= 1 && t.due_date) out.push({ key: 'a' + t.id, kind: 'Not seen', t, title: t.title, who });
      else if (t.due_date && ['P1', 'P2'].includes(t.priority) && diff((t.last_update_at || t.created_at).slice(0, 10), td) >= 7) out.push({ key: 'q' + t.id, kind: 'Quiet', t, title: `${t.title}, ${diff((t.last_update_at || t.created_at).slice(0, 10), td)}d`, who });
    }
    return out;
  }
  async function decideDate(req, approve) {
    const { error } = await sb.rpc('decide_date_change', { req: req.id, approve });
    if (error) return setToast({ text: error.message });
    setToast({ text: approve ? 'Date change approved' : 'Date change rejected' });
    load();
  }
  async function decideRequest(t, accept, note) {
    const fields = accept ? { request_status: 'accepted', acknowledged_at: new Date().toISOString() } : { request_status: 'declined', request_note: note || null, status: 'done' };
    await update(t.id, fields, accept ? 'Accepted' : 'Declined');
  }
  async function nudge(t, kind, target) {
    setToast({ text: 'Sending…' });
    const { data, error } = await sb.functions.invoke('nudge', { body: { task_id: t.id, kind, target } });
    if (error || data?.error) return setToast({ text: data?.error || 'Could not send. Try again.' });
    setToast({ text: kind === 'ask' ? `Asked ${first(data.to)} for an update` : `Nudged ${first(data.to)}` });
  }
  async function approveOther(req, date) {
    const ok = await update(req.task_id, { due_date: date }, null);
    if (!ok) return;
    await sb.from('date_change_requests').update({ status: 'approved', proposed_due: date, decided_by: me.id, decided_at: new Date().toISOString() }).eq('id', req.id);
    setToast({ text: `Moved to ${fmtDate(date)}` }); load();
  }
  const openTask = (t) => setSheet({ mode: 'edit', id: t.id });
  const newTask = (prefill) => setSheet({ mode: 'new', prefill });

  return { me, data, people, depts, members, lists, tasks, dcr, person, dept, list, isAdmin, myDepts, headDepts, isHead, canSeeStats, canDecide, canRedate, canEdit, save,
    open, visibleOpen, mine, update, done, reopen, needsYou, decideDate, decideRequest, nudge, approveOther, openTask, newTask, load, setToast, setSheet };
}

/* ---------- login ---------- */
function Login() {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, queryParams: { hd: DOMAIN, prompt: 'select_account' } } });
  };
  return html`<div class="login"><div class="card">
    <h1><span class="mark" aria-hidden="true"></span>BS Tasks</h1>
    <p class="note">Sign in with your ${DOMAIN} Google account.</p>
    <button class="btn primary big" disabled=${busy} onClick=${go}>${busy ? 'Opening Google…' : 'Sign in with Google'}</button>
  </div></div>`;
}

/* ---------- inline editing ---------- */
const PCOL = { P1: 'var(--help)', P2: 'var(--behind)', P3: 'var(--p3)' };
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function parseQuick(s) {
  s = (s || '').trim().toLowerCase();
  const t = today();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (['today', 'tod'].includes(s)) return t;
  if (['tomorrow', 'tom', 'tmrw', 'tmr'].includes(s)) return addDays(t, 1);
  const plus = s.match(/^\+?(\d+)\s*(d|w|days?|weeks?)?$/);
  if (plus && s.startsWith('+')) return addDays(t, +plus[1] * (/^w/.test(plus[2] || '') ? 7 : 1));
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const next = s.startsWith('next ');
  const name = next ? s.slice(5) : s;
  const idx = days.findIndex((d) => name.startsWith(d));
  if (idx >= 0) return !next && idx > dow(t) ? addDays(t, idx - dow(t)) : nextDow(idx);
  const parsed = Date.parse(`${s} ${new Date().getFullYear()}`);
  if (!isNaN(parsed)) { const d = ymd(new Date(parsed)); return d < t ? ymd(new Date(Date.parse(`${s} ${new Date().getFullYear() + 1}`))) : d; }
  return null;
}
function usePop() {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const k = (e) => { if (e.key === 'Escape') { setOpen(false); ref.current?.querySelector('button')?.focus(); } };
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    setTimeout(() => ref.current?.querySelector('.pop input')?.focus(), 0);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [open]);
  return [open, setOpen, ref];
}
function PriorityPill({ ctx, t, onSaved }) {
  const can = ctx.canEdit(t);
  const set = (p) => p !== t.priority && ctx.save(t, { priority: p }, onSaved);
  const next = { P1: 'P2', P2: 'P3', P3: 'P1' }[t.priority] || 'P1';
  return html`<button class=${'pill' + (t.priority ? '' : ' none')} disabled=${!can} title="Click to cycle, or press 1, 2 or 3" aria-label=${'Priority ' + (t.priority || 'not set')}
    onClick=${() => set(next)} onKeyDown=${(e) => { if (['1', '2', '3'].includes(e.key)) { e.preventDefault(); set('P' + e.key); } }}>
    ${t.priority ? html`<span class="dot" style=${'background:' + PCOL[t.priority]}></span>${t.priority}` : 'Set'}</button>`;
}
function DateChip({ ctx, t, onSaved }) {
  const [open, setOpen, ref] = usePop();
  const [txt, setTxt] = useState('');
  const can = ctx.canEdit(t) && ctx.canRedate(t);
  const td = today();
  const set = (d) => { setOpen(false); setTxt(''); if (d && d !== t.due_date) ctx.save(t, { due_date: d }, onSaved); };
  const quick = [['Today', td], ['Tomorrow', addDays(td, 1)], ['Fri', parseQuick('fri')], ['Mon', nextDow(0)], ['+1 week', addDays(td, 7)]];
  const guess = parseQuick(txt);
  return html`<span class="anchor" ref=${ref}>
    <button class=${'chipbtn' + (isLate(t) ? ' late' : t.due_date ? '' : ' muted')} onClick=${() => (can ? setOpen(!open) : ctx.openTask(t))} title=${can ? 'Change deadline' : 'Ask the assigner for a new date'}>${t.status === 'done' ? 'Done' : t.due_date ? shortDue(t.due_date) : 'Set date'}</button>
    ${open ? html`<div class="pop" role="dialog" aria-label="Deadline">
      <input class="field" placeholder="fri, +7, 12 nov" value=${txt} onInput=${(e) => setTxt(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter' && guess) set(guess); }} aria-label="Type a date" />
      ${txt ? html`<span class="note">${guess ? `Enter for ${fmtDate(guess)}` : 'Try fri, +7, 12 nov'}</span>` : ''}
      <div class="chips">${quick.map(([l, d]) => html`<button class="chip" onClick=${() => set(d)}>${l}</button>`)}</div>
      <input type="date" class="field" aria-label="Pick a date" value=${t.due_date || ''} onChange=${(e) => set(e.target.value)} />
    </div>` : ''}</span>`;
}
function OwnerPick({ ctx, t, onSaved }) {
  const [open, setOpen, ref] = usePop();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const can = ctx.isAdmin || ctx.isHead(t.department_id) || t.created_by === ctx.me.id;
  const opts = ctx.people.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 40);
  const pick = (p) => { setOpen(false); setQ(''); setI(0); if (p && p.id !== t.owner_id) ctx.save(t, { owner_id: p.id, acknowledged_at: p.id === ctx.me.id ? new Date().toISOString() : null }, onSaved); };
  const name = ctx.person(t.owner_id)?.name || 'Unassigned';
  return html`<span class="anchor" ref=${ref}>
    <button class="chipbtn" disabled=${!can} onClick=${() => setOpen(!open)} title=${can ? 'Change owner' : ''}>${name}</button>
    ${open ? html`<div class="pop" role="dialog" aria-label="Owner">
      <input class="field" placeholder="Type a name" value=${q} aria-label="Search people" onInput=${(e) => { setQ(e.target.value); setI(0); }}
        onKeyDown=${(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setI(Math.min(i + 1, opts.length - 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setI(Math.max(i - 1, 0)); } else if (e.key === 'Enter') pick(opts[i]); }} />
      <div class="opts" role="listbox">${opts.map((p, n) => html`<button class="opt" role="option" aria-selected=${n === i} onClick=${() => pick(p)}>${p.name}<span>${ctx.dept(ctx.members.find((m) => m.person_id === p.id)?.department_id)?.name || ''}</span></button>`)}</div>
    </div>` : ''}</span>`;
}
function TitleCell({ ctx, t, onSaved }) {
  const [v, setV] = useState(t.title);
  useEffect(() => setV(t.title), [t.title]);
  const commit = () => { const s = v.trim(); if (s && s !== t.title) ctx.save(t, { title: s }, onSaved); else setV(t.title); };
  return html`<input class="cell-input" value=${v} disabled=${!ctx.canEdit(t)} aria-label="Task title" onInput=${(e) => setV(e.target.value)} onBlur=${commit} onKeyDown=${(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setV(t.title); e.target.blur(); } }} />`;
}
function UpdCell({ ctx, t, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState('');
  const post = async () => {
    const body = v.trim(); setEditing(false); setV('');
    if (!body) return;
    const { error } = await sb.from('task_updates').insert({ task_id: t.id, author_id: ctx.me.id, body });
    if (error) return ctx.setToast({ text: error.message });
    onSaved?.(t.id); ctx.load();
  };
  if (editing) return html`<input class="cell-input" placeholder="Add an update, Enter to post" value=${v} ref=${(el) => el && !v && el.focus()} onInput=${(e) => setV(e.target.value)} onBlur=${post} onKeyDown=${(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setV(''); setEditing(false); } }} />`;
  return html`<button class="updbtn" title=${t.last_update_body || 'Add an update'} onClick=${() => setEditing(true)}>${t.last_update_body ? `${t.last_update_body} · ${ago(t.last_update_at)}` : 'Add update'}</button>`;
}
function StatusSel({ ctx, t, onSaved }) {
  return html`<select class="cell-sel" aria-label="Status" disabled=${!ctx.canEdit(t)} value=${t.status} onChange=${(e) => ctx.save(t, e.target.value === 'done' ? { status: 'done', completed_at: new Date().toISOString() } : { status: e.target.value, completed_at: null }, onSaved)}>
    <option value="open">Open</option><option value="blocked">Blocked</option><option value="done">Done</option></select>`;
}
const useWide = () => {
  const mq = '(min-width: 761px)';
  const [w, setW] = useState(() => matchMedia(mq).matches);
  useEffect(() => { const m = matchMedia(mq); const h = () => setW(m.matches); m.addEventListener('change', h); return () => m.removeEventListener('change', h); }, []);
  return w;
};

/* ---------- grid ---------- */
function Grid({ ctx, rows, groupKey, groupLabel, sel, toggle }) {
  const [ticks, setTicks] = useState({});
  const [closed, setClosed] = useState({});
  const saved = (id) => { setTicks((x) => ({ ...x, [id]: 1 })); setTimeout(() => setTicks((x) => { const y = { ...x }; delete y[id]; return y; }), 1600); };
  const groups = [];
  if (groupKey) { const m = new Map(); rows.forEach((t) => { const k = groupKey(t) || ''; if (!m.has(k)) m.set(k, []); m.get(k).push(t); }); groups.push(...m.entries()); }
  else groups.push(['', rows]);
  const nav = (e) => {
    if (!['ArrowUp', 'ArrowDown'].includes(e.key) || e.target.closest('.pop') || e.target.tagName === 'SELECT') return;
    const td = e.target.closest('td'); const tr = td?.parentElement; if (!tr?.dataset.id) return;
    const col = [...tr.children].indexOf(td);
    let n = e.key === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling;
    while (n && !n.dataset.id) n = e.key === 'ArrowDown' ? n.nextElementSibling : n.previousElementSibling;
    const target = n?.children[col]?.querySelector('input, button, select');
    if (target) { e.preventDefault(); target.focus(); }
  };
  const cols = 11;
  return html`<div class="gridwrap"><table class="grid" onKeyDown=${nav}>
    <thead><tr><th>${toggle ? html`<span class="sr">Select</span>` : ''}</th><th><span class="sr">Done</span></th><th>Task</th><th>Owner</th><th>Department</th><th>Task list</th><th>Priority</th><th>Deadline</th><th>Status</th><th>Latest update</th><th><span class="sr">Details</span></th></tr></thead>
    <tbody>${groups.map(([k, items]) => html`
      ${groupKey ? html`<tr class="gtitle" onClick=${() => setClosed((c) => ({ ...c, [k]: !c[k] }))}><td colspan=${cols}>${closed[k] ? '▸' : '▾'} ${groupLabel(k)}<span>${groupLabel.count ? groupLabel.count(k, items) : items.length}</span></td></tr>` : ''}
      ${closed[k] ? '' : html`<${GridRows} ctx=${ctx} items=${items} sel=${sel} toggle=${toggle} ticks=${ticks} saved=${saved} cols=${cols} />`}`)}
    </tbody></table></div>`;
}
function GridRows({ ctx, items, sel, toggle, ticks, saved, cols }) {
  const [n, setN] = useState(60);
  return html`${items.slice(0, n).map((t) => html`<${GridRow} key=${t.id} ctx=${ctx} t=${t} selected=${sel?.includes(t.id)} toggle=${toggle} tick=${ticks[t.id]} saved=${saved} />`)}
    ${items.length > n ? html`<tr><td colspan=${cols}><button class="linkbtn" style="padding:6px" onClick=${() => setN(n + 200)}>Show ${Math.min(items.length - n, 200)} more of ${items.length - n}</button></td></tr>` : ''}`;
}
function GridRow({ ctx, t, selected, toggle, tick, saved }) {
  const can = ctx.canEdit(t);
  const lead = ctx.isAdmin || ctx.isHead(t.department_id);
  const lists = ctx.lists.filter((l) => l.department_id === t.department_id);
  return html`<tr class=${selected ? 'sel' : ''} data-id=${t.id}>
    <td>${toggle ? html`<input type="checkbox" class="sel" style="margin:0" checked=${selected} onChange=${() => toggle(t.id)} aria-label=${'Select ' + t.title} />` : ''}</td>
    <td><button class=${`ring ${t.priority || 'none'}${t.status === 'done' ? ' done' : ''}`} disabled=${!can} aria-label=${(t.status === 'done' ? 'Reopen: ' : 'Mark done: ') + t.title} onClick=${() => (t.status === 'done' ? ctx.reopen(t) : ctx.done(t))}></button></td>
    <td class="title"><${TitleCell} ctx=${ctx} t=${t} onSaved=${saved} /></td>
    <td><${OwnerPick} ctx=${ctx} t=${t} onSaved=${saved} /></td>
    <td><select class="cell-sel" aria-label="Department" disabled=${!lead} value=${t.department_id} onChange=${(e) => ctx.save(t, { department_id: e.target.value, task_list_id: null }, saved)}>${ctx.depts.map((d) => html`<option value=${d.id}>${d.name}</option>`)}</select></td>
    <td><select class="cell-sel" aria-label="Task list" disabled=${!can} value=${t.task_list_id || ''} onChange=${(e) => ctx.save(t, { task_list_id: e.target.value || null }, saved)}><option value="">None</option>${lists.map((l) => html`<option value=${l.id}>${l.name}</option>`)}</select></td>
    <td><${PriorityPill} ctx=${ctx} t=${t} onSaved=${saved} /></td>
    <td><${DateChip} ctx=${ctx} t=${t} onSaved=${saved} /></td>
    <td><${StatusSel} ctx=${ctx} t=${t} onSaved=${saved} /></td>
    <td class="upd"><${UpdCell} ctx=${ctx} t=${t} onSaved=${saved} /></td>
    <td style="white-space:nowrap"><span class="tick" aria-live="polite">${tick ? '✓' : ''}</span><button class="iconbtn" aria-label=${'Open details: ' + t.title} onClick=${() => ctx.openTask(t)}><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button></td>
  </tr>`;
}

/* ---------- task row (lists) ---------- */
function Row({ ctx, t, select, selected, showOwner = true, showDept = true }) {
  const [upd, setUpd] = useState(null);
  const meta = [];
  if (showDept) meta.push(html`<span>${ctx.dept(t.department_id)?.name}</span>`);
  if (t.task_list_id) meta.push(html`<span>${ctx.list(t.task_list_id)?.name}</span>`);
  if (t.status === 'blocked') meta.push(html`<span class="tag grey">Blocked${t.blocked_on_person_id ? ` on ${first(ctx.person(t.blocked_on_person_id)?.name)}` : ''}</span>`);
  if (t.slip_count >= 1) meta.push(html`<span class="tag sand">Moved ${t.slip_count}×</span>`);
  if (!t.acknowledged_at && t.owner_id === ctx.me.id) meta.push(html`<span class="tag">New</span>`);
  if (t.from_department_id) meta.push(html`<span class="tag">From ${ctx.dept(t.from_department_id)?.name}</span>`);
  if (t.request_status === 'pending') meta.push(html`<span class="tag">Request</span>`);
  if (t.is_private) meta.push(html`<span class="tag grey">Private</span>`);
  const post = async () => {
    const body = (upd || '').trim(); setUpd(null);
    if (!body) return;
    const { error } = await sb.from('task_updates').insert({ task_id: t.id, author_id: ctx.me.id, body });
    if (error) return ctx.setToast({ text: error.message });
    ctx.setToast({ text: 'Update posted' }); ctx.load();
  };
  const can = ctx.canEdit(t);
  return html`<div class=${'row' + (t.status === 'done' ? ' isdone' : '')}>
    ${select ? html`<input type="checkbox" class="sel" checked=${selected} onChange=${() => select(t.id)} aria-label=${'Select ' + t.title} />` : ''}
    <button class=${`ring ${t.priority || 'none'}${t.status === 'done' ? ' done' : ''}`} disabled=${!can} aria-label=${(t.status === 'done' ? 'Reopen: ' : 'Mark done: ') + t.title} onClick=${() => (t.status === 'done' ? ctx.reopen(t) : ctx.done(t))}></button>
    <div class="main">
      <span class="title" onClick=${() => ctx.openTask(t)} role="button" tabindex="0" onKeyDown=${(e) => e.key === 'Enter' && ctx.openTask(t)}>${t.title}</span>
      ${meta.length ? html`<span class="meta">${meta}</span>` : ''}
      ${t.last_update_body ? html`<span class="meta">“${t.last_update_body.slice(0, 90)}${t.last_update_body.length > 90 ? '…' : ''}” ${ago(t.last_update_at)}</span>` : ''}
      ${upd !== null ? html`<div class="inlineupd"><input class="field" placeholder="Add an update" value=${upd} ref=${(el) => el && !upd && el.focus()} onInput=${(e) => setUpd(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') post(); if (e.key === 'Escape') setUpd(null); }} /><button class="btn primary" onClick=${post}>Post</button></div>` : ''}
    </div>
    <div class="ctrls">
      ${t.status !== 'done' && can ? html`<span class="hover">
        <button class="btn quiet" style="height:28px;padding:0 8px" onClick=${() => setUpd('')}>Update</button>
        <button class="btn quiet" style="height:28px;padding:0 8px" onClick=${() => ctx.update(t.id, { snoozed_until: addDays(today(), 1) }, 'Snoozed to tomorrow', { snoozed_until: null })}>Snooze</button>
      </span>` : ''}
      ${showOwner ? html`<${OwnerPick} ctx=${ctx} t=${t} />` : ''}
      <${PriorityPill} ctx=${ctx} t=${t} />
      <${DateChip} ctx=${ctx} t=${t} />
    </div>
  </div>`;
}

function Limited({ items, render: r, step = 50 }) {
  const [n, setN] = useState(step);
  return html`${items.slice(0, n).map(r)}${items.length > n ? html`<div class="more"><button class="linkbtn" onClick=${() => setN(n + step * 2)}>Show ${Math.min(items.length - n, step * 2)} more of ${items.length - n}</button></div>` : ''}`;
}

/* ---------- overview ---------- */
function OtherDate({ ctx, req }) {
  const [open, setOpen, ref] = usePop();
  return html`<span class="anchor" ref=${ref}><button class="btn quiet" onClick=${() => setOpen(!open)}>Other date</button>
    ${open ? html`<div class="pop" style="right:0;left:auto"><span class="note">Approve with this date instead</span><input type="date" class="field" min=${today()} onChange=${(e) => { if (e.target.value) { setOpen(false); ctx.approveOther(req, e.target.value); } }} /></div>` : ''}</span>`;
}
function NeedActions({ ctx, n }) {
  const t = n.t;
  if (n.req) return html`<button class="btn primary" onClick=${() => ctx.decideDate(n.req, true)}>Approve</button><button class="btn quiet" onClick=${() => ctx.decideDate(n.req, false)}>Reject</button><${OtherDate} ctx=${ctx} req=${n.req} />`;
  if (n.request) return html`<button class="btn primary" onClick=${() => ctx.decideRequest(t, true)}>Accept</button><button class="btn quiet" onClick=${() => ctx.openTask(t)}>Reassign</button>`;
  const open = html`<button class="btn quiet" onClick=${() => ctx.openTask(t)}>Open</button>`;
  if (n.kind === 'P1 late') return html`<${DateChip} ctx=${ctx} t=${t} /><button class="btn" onClick=${() => ctx.nudge(t, 'nudge')}>Nudge</button>`;
  if (n.kind === 'Blocked') return html`${t.blocked_on_person_id ? html`<button class="btn" onClick=${() => ctx.nudge(t, 'nudge', 'blocker')}>Nudge ${first(ctx.person(t.blocked_on_person_id)?.name)}</button>` : ''}${open}`;
  if (n.kind === 'Quiet') return html`<button class="btn" onClick=${() => ctx.nudge(t, 'ask')}>Ask for update</button>${open}`;
  if (n.kind === 'Not seen') return html`<button class="btn" onClick=${() => ctx.nudge(t, 'nudge')}>Nudge</button>${open}`;
  return html`<${DateChip} ctx=${ctx} t=${t} />${open}`;
}
function Overview({ ctx }) {
  const [filter, setFilter] = useState('needs');
  const [team, setTeam] = useState(null);
  const td = today(), ws = weekStart(), we = weekEnd();
  const needs = ctx.needsYou();
  const open = ctx.open();
  const doneWeek = ctx.tasks.filter((t) => t.status === 'done' && t.completed_at && t.completed_at.slice(0, 10) >= ws);
  const dueWeek = open.filter((t) => t.due_date && t.due_date >= ws && t.due_date <= we);
  const blocked = open.filter((t) => t.status === 'blocked');
  const undated = open.filter(needsDate);
  const figs = [['needs', needs.length, 'Needs you'], ['done', doneWeek.length, 'Done this week'], ['due', dueWeek.length, 'Due this week'], ['blocked', blocked.length, 'Blocked']];
  const teams = ctx.depts.map((d) => {
    const o = open.filter((t) => t.department_id === d.id);
    const late = o.filter(isLate);
    const lateP1 = late.filter((t) => t.priority === 'P1');
    const dn = doneWeek.filter((t) => t.department_id === d.id).length;
    const due = dueWeek.filter((t) => t.department_id === d.id).length;
    const pct = dn + due ? Math.round((dn / (dn + due)) * 100) : 100;
    const st = lateP1.length >= 2 || late.length >= 5 ? ['Needs help', 'help', 'var(--help)'] : late.length ? ['Behind', 'behind', 'var(--behind)'] : ['On track', 'ok', 'var(--ok)'];
    const attention = o.filter((t) => isLate(t) || t.status === 'blocked').sort((a, b) => (a.due_date || '9').localeCompare(b.due_date || '9'));
    return { d, open: o.length, pct, st, attention, rank: st[1] === 'help' ? 0 : st[1] === 'behind' ? 1 : 2 };
  }).sort((a, b) => a.rank - b.rank || b.open - a.open);
  const since = useMemo(() => {
    const last = Number(localStorage.getItem('bs_last_seen') || 0);
    const items = ctx.tasks.filter((t) => Date.parse(t.updated_at) > last && t.updated_at !== t.created_at).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 8);
    setTimeout(() => { try { localStorage.setItem('bs_last_seen', String(Date.now())); } catch (_) {} }, 4000);
    return { last, items };
  }, []);
  const list = filter === 'needs' ? null : filter === 'done' ? doneWeek : filter === 'due' ? dueWeek : blocked;
  setNav(list || needs.map((n) => n.t));
  return html`
    <div class="head"><h1>Overview</h1><span class="sub">${fmtDate(td)}</span></div>
    <div class="figs" role="tablist">${figs.map(([k, n, l]) => html`<button role="tab" aria-selected=${filter === k} class=${'fig' + (filter === k ? ' on' : '')} onClick=${() => setFilter(k)}><b>${n}</b><span>${l}</span></button>`)}</div>
    <div class="cols">
      <div>
        ${filter === 'needs' ? html`<section class="panel">
          <div class="ph"><h2>Needs you</h2>${undated.length ? html`<a href="#all?status=nodate" class="linkbtn">${undated.length} need priority and date</a>` : ''}</div>
          ${needs.length ? html`<${Limited} items=${needs} step=${15} render=${(n) => html`<div class="need" key=${n.key}>
            <span class="k">${n.kind}</span>
            <span class="t"><span onClick=${() => ctx.openTask(n.t)}>${n.title}</span><span>${n.who}</span></span>
            <span class="na"><${NeedActions} ctx=${ctx} n=${n} /></span>
          </div>`} />` : html`<p class="empty">Nothing needs you right now.</p>`}
        </section>` : html`<section class="panel"><div class="ph"><h2>${figs.find((f) => f[0] === filter)[2]}</h2></div>
          ${list.length ? html`<${Limited} items=${list} render=${(t) => html`<${Row} key=${t.id} ctx=${ctx} t=${t} />`} />` : html`<p class="empty">None.</p>`}</section>`}
      </div>
      <div>
        <section class="panel"><div class="ph"><h2>Teams</h2></div>
          ${teams.map(({ d, open: o, pct, st, attention }) => html`
            <button class="team" aria-expanded=${team === d.id} onClick=${() => setTeam(team === d.id ? null : d.id)}>
              <span>${team === d.id ? '▾' : '▸'} ${d.name}</span>
              <span class="bar" aria-hidden="true"><i style=${`width:${pct}%;background:${st[2]}`}></i></span>
              <span class="num" style="text-align:right;color:var(--muted);font-size:14px">${o}</span>
              <span class=${'st-' + st[1]} style="text-align:right;font-size:14px">${st[0]}</span>
            </button>
            ${team === d.id ? html`<div class="teamx">
              ${attention.length ? attention.slice(0, 8).map((t) => html`<${Row} key=${t.id} ctx=${ctx} t=${t} showDept=${false} />`) : html`<p class="empty" style="padding:6px 0">Nothing late or blocked.</p>`}
              <a class="linkbtn" href=${'#dept?dept=' + d.id}>Open ${d.name}${attention.length > 8 ? ` (${attention.length - 8} more late or blocked)` : ''}</a>
            </div>` : ''}`)}
        </section>
        ${since.last ? html`<section class="panel"><div class="ph"><h2>Since you last looked</h2><span class="note">${ago(new Date(since.last).toISOString())}</span></div>
          ${since.items.length ? since.items.map((t) => html`<div class="need" style="cursor:pointer" onClick=${() => ctx.openTask(t)}><span class="k">${new Date(t.updated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span><span class="t"><span>${t.title}</span><span>${t.status === 'done' ? 'Done' : t.status === 'blocked' ? 'Blocked' : 'Updated'}, ${first(ctx.person(t.owner_id)?.name)}</span></span></div>`) : html`<p class="empty">No changes.</p>`}
        </section>` : ''}
      </div>
    </div>`;
}

/* ---------- my tasks ---------- */
function Mine({ ctx }) {
  const td = today(), we = weekEnd();
  const mine = ctx.mine();
  const open = mine.filter((t) => t.status !== 'done' && !(t.snoozed_until && t.snoozed_until > td));
  const approvals = ctx.dcr.filter((r) => { const t = ctx.tasks.find((x) => x.id === r.task_id); return t && ctx.canDecide(t) && !ctx.isAdmin; });
  const waiting = ctx.open().filter((t) => t.blocked_on_person_id === ctx.me.id);
  const groups = [
    ['Overdue', open.filter((t) => t.due_date && t.due_date < td)],
    ['Today', open.filter((t) => t.due_date === td)],
    ['This week', open.filter((t) => t.due_date > td && t.due_date <= we)],
    ['Later', open.filter((t) => t.due_date > we)],
    ['Needs priority and date', open.filter((t) => !t.due_date)],
  ];
  const sort = (a) => a.sort((x, y) => (x.due_date || '9').localeCompare(y.due_date || '9') || (x.priority || 'P9').localeCompare(y.priority || 'P9'));
  const doneRecent = mine.filter((t) => t.status === 'done').sort((a, b) => b.completed_at.localeCompare(a.completed_at));
  const [showDone, setShowDone] = useState(false);
  setNav([...waiting, ...groups.flatMap(([, items]) => sort(items))]);
  return html`
    <div class="head"><h1>My tasks</h1><span class="sub num">${open.length} open, ${open.filter(isLate).length} late</span></div>
    ${approvals.length ? html`<section class="panel"><div class="ph"><h2>Needs your approval</h2></div>${approvals.map((r) => { const t = ctx.tasks.find((x) => x.id === r.task_id); return html`<div class="need"><span class="k">Date change</span><span class="t"><span onClick=${() => ctx.openTask(t)}>${t.title} → ${shortDue(r.proposed_due)}</span><span>${first(ctx.person(r.requested_by)?.name)}${r.reason ? ', ' + r.reason : ''}</span></span><button class="btn primary" onClick=${() => ctx.decideDate(r, true)}>Approve</button><button class="btn quiet" onClick=${() => ctx.decideDate(r, false)}>Reject</button></div>`; })}</section>` : ''}
    ${waiting.length ? html`<h2 class="sec">Waiting on you <span class="n">${waiting.length}</span></h2><div class="rows">${waiting.map((t) => html`<${Row} key=${t.id} ctx=${ctx} t=${t} />`)}</div>` : ''}
    ${groups.map(([g, items]) => items.length ? html`<h2 class="sec">${g} <span class="n">${items.length}</span></h2><div class="rows"><${Limited} items=${sort(items)} render=${(t) => html`<${Row} key=${t.id} ctx=${ctx} t=${t} showOwner=${false} />`} /></div>` : '')}
    ${!open.length ? html`<p class="empty">Nothing open. Add a task below.</p>` : ''}
    ${doneRecent.length ? html`<h2 class="sec"><button class="linkbtn" onClick=${() => setShowDone(!showDone)}>${showDone ? 'Hide' : 'Show'} done in the last 14 days (${doneRecent.length})</button></h2>${showDone ? html`<div class="rows">${doneRecent.map((t) => html`<${Row} key=${t.id} ctx=${ctx} t=${t} showOwner=${false} />`)}</div>` : ''}` : ''}`;
}

/* ---------- department ---------- */
function Dept({ ctx, route }) {
  const wide = useWide();
  const choices = ctx.isAdmin ? ctx.depts : ctx.depts.filter((d) => ctx.myDepts.includes(d.id));
  const id = route.dept && choices.some((d) => d.id === route.dept) ? route.dept : choices[0]?.id;
  const [group, setGroup] = useState('owner');
  const [f, setF] = useState('open');
  if (!id) return html`<div class="head"><h1>Department</h1></div><p class="empty">You are not in a department yet.</p>`;
  const all = ctx.tasks.filter((t) => t.department_id === id);
  const open = all.filter((t) => t.status !== 'done');
  const shown = (f === 'open' ? open : f === 'late' ? open.filter(isLate) : f === 'blocked' ? open.filter((t) => t.status === 'blocked') : f === 'nodate' ? open.filter(needsDate) : all.filter((t) => t.status === 'done' && t.completed_at?.slice(0, 10) >= weekStart()))
    .sort((a, b) => (a.due_date || '9').localeCompare(b.due_date || '9'));
  const requests = open.filter((t) => t.from_department_id && !t.acknowledged_at);
  const lead = ctx.isAdmin || ctx.isHead(id);
  const keyOf = (t) => (group === 'owner' ? t.owner_id : t.task_list_id || '');
  const label = (k) => (group === 'owner' ? ctx.person(k)?.name || 'Unassigned' : k ? ctx.list(k)?.name : 'No task list');
  label.count = (k, items) => (group === 'owner' && !ctx.canSeeStats(k) ? '' : `${items.length}${f === 'open' ? `, ${items.filter(isLate).length} late` : ''}`);
  const groups = {};
  shown.forEach((t) => (groups[keyOf(t)] ||= []).push(t));
  const order = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);
  const sorted = order.flatMap((k) => groups[k]);
  setNav(sorted);
  return html`
    <div class="head">
      <select class="field" style="font-size:20px;font-weight:600;height:44px;border:none;background:transparent;padding:0;letter-spacing:-0.02em" aria-label="Department" value=${id} onChange=${(e) => (location.hash = 'dept?dept=' + e.target.value)}>
        ${choices.map((d) => html`<option value=${d.id}>${d.name}</option>`)}
      </select>
      <span class="sub num">${open.length} open, ${open.filter(isLate).length} late, ${open.filter((t) => t.status === 'blocked').length} blocked</span>
    </div>
    <div class="filters">
      <div class="chips">${[['open', 'Open'], ['late', 'Late'], ['blocked', 'Blocked'], ['nodate', 'No date'], ['done', 'Done this week']].map(([k, l]) => html`<button class="chip" aria-pressed=${f === k} onClick=${() => setF(k)}>${l}</button>`)}</div>
      <div style="flex:1"></div>
      <div class="chips">${[['owner', 'By person'], ['list', 'By task list']].map(([k, l]) => html`<button class="chip" aria-pressed=${group === k} onClick=${() => setGroup(k)}>${l}</button>`)}</div>
    </div>
    ${lead && requests.length ? html`<section class="panel"><div class="ph"><h2>Requests from other teams</h2></div>${requests.map((t) => html`<${Row} key=${t.id} ctx=${ctx} t=${t} showDept=${false} />`)}</section>` : ''}
    ${!shown.length ? html`<p class="empty">No tasks here.</p>`
      : wide ? html`<${Grid} ctx=${ctx} rows=${sorted} groupKey=${keyOf} groupLabel=${label} /><p class="kbd">Click any cell to edit. Arrow keys move between rows. On priority, press 1, 2 or 3. Dates accept fri, +7 or 12 nov.</p>`
      : order.map((k) => html`<div class="gh">${label(k)}<span class="num">${label.count(k, groups[k])}</span></div>
        <div class="rows"><${Limited} items=${groups[k]} step=${8} render=${(t) => html`<${Row} key=${t.id} ctx=${ctx} t=${t} showDept=${false} showOwner=${group !== 'owner'} />`} /></div>`)}`;
}

/* ---------- all tasks ---------- */
function AllTasks({ ctx, route }) {
  const wide = useWide();
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [owner, setOwner] = useState('');
  const [prio, setPrio] = useState('');
  const [status, setStatus] = useState(route.status || 'open');
  const [grp, setGrp] = useState('dept');
  const [sel, setSel] = useState([]);
  useEffect(() => { if (route.status) setStatus(route.status); }, [route.status]);
  const td = today();
  const rows = ctx.tasks.filter((t) => {
    if (status === 'open' && t.status === 'done') return false;
    if (status === 'late' && !isLate(t)) return false;
    if (status === 'blocked' && t.status !== 'blocked') return false;
    if (status === 'nodate' && !needsDate(t)) return false;
    if (status === 'done' && t.status !== 'done') return false;
    if (dept && t.department_id !== dept) return false;
    if (owner && t.owner_id !== owner) return false;
    if (prio && (prio === 'none' ? t.priority : t.priority !== prio)) return false;
    if (q) { const s = q.toLowerCase(); if (!(`${t.title} ${t.notes || ''} ${t.last_update_body || ''} ${ctx.person(t.owner_id)?.name} ${ctx.list(t.task_list_id)?.name || ''}`.toLowerCase().includes(s))) return false; }
    return true;
  }).sort((a, b) => (ctx.dept(a.department_id)?.sort_order ?? 0) - (ctx.dept(b.department_id)?.sort_order ?? 0) || (a.due_date || '9').localeCompare(b.due_date || '9'));
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allOn = rows.length && rows.every((t) => sel.includes(t.id));
  async function apply(fields, msg) { if (await ctx.update(sel, fields, `${msg} (${sel.length})`)) { setSel([]); ctx.load(); } }
  const groupKey = grp === 'dept' ? (t) => t.department_id : grp === 'owner' ? (t) => t.owner_id : null;
  const groupLabel = grp === 'dept' ? (k) => ctx.dept(k)?.name : (k) => ctx.person(k)?.name || 'Unassigned';
  if (groupKey) { const m = new Map(); rows.forEach((t) => { const k = groupKey(t); if (!m.has(k)) m.set(k, []); m.get(k).push(t); }); setNav([...m.values()].flat()); } else setNav(rows);
  return html`
    <div class="head"><h1>All tasks</h1><span class="sub num">${rows.length} shown</span></div>
    <div class="filters">
      <label class="sr" for="q">Search</label><input id="q" class="field search" placeholder="Search tasks, people, task lists" value=${q} onInput=${(e) => setQ(e.target.value)} />
      <select class="field" aria-label="Status" value=${status} onChange=${(e) => setStatus(e.target.value)}>${[['open', 'Open'], ['nodate', 'Needs priority and date'], ['late', 'Late'], ['blocked', 'Blocked'], ['done', 'Done (14 days)'], ['any', 'Everything']].map(([v, l]) => html`<option value=${v}>${l}</option>`)}</select>
      <select class="field" aria-label="Department" value=${dept} onChange=${(e) => setDept(e.target.value)}><option value="">All departments</option>${ctx.depts.map((d) => html`<option value=${d.id}>${d.name}</option>`)}</select>
      <select class="field" aria-label="Owner" value=${owner} onChange=${(e) => setOwner(e.target.value)}><option value="">Everyone</option>${ctx.people.map((p) => html`<option value=${p.id}>${p.name}</option>`)}</select>
      <select class="field" aria-label="Priority" value=${prio} onChange=${(e) => setPrio(e.target.value)}><option value="">Any priority</option><option>P1</option><option>P2</option><option>P3</option><option value="none">No priority</option></select>
      ${wide ? html`<select class="field" aria-label="Group by" value=${grp} onChange=${(e) => setGrp(e.target.value)}><option value="dept">Group by department</option><option value="owner">Group by person</option><option value="none">No grouping</option></select>` : ''}
    </div>
    ${sel.length ? html`<div class="bulk">
      <b>${sel.length} selected</b>
      <select class="field" aria-label="Set priority" onChange=${(e) => e.target.value && apply({ priority: e.target.value }, 'Priority set')}><option value="">Set priority</option><option>P1</option><option>P2</option><option>P3</option></select>
      <input type="date" class="field" aria-label="Set deadline" min=${td} onChange=${(e) => e.target.value && apply({ due_date: e.target.value }, 'Deadline set')} />
      <select class="field" aria-label="Reassign" onChange=${(e) => e.target.value && apply({ owner_id: e.target.value, acknowledged_at: null }, 'Reassigned')}><option value="">Reassign to</option>${ctx.people.map((p) => html`<option value=${p.id}>${p.name}</option>`)}</select>
      <select class="field" aria-label="Move to department" onChange=${(e) => e.target.value && apply({ department_id: e.target.value, task_list_id: null }, 'Moved')}><option value="">Move to</option>${ctx.depts.map((d) => html`<option value=${d.id}>${d.name}</option>`)}</select>
      <button class="btn" onClick=${() => apply({ status: 'done', completed_at: new Date().toISOString() }, 'Closed')}>Close</button>
      <button class="btn quiet" onClick=${() => setSel([])}>Clear</button>
    </div>` : ''}
    <div style="display:flex;gap:10px;align-items:center;margin:4px 0 8px"><input type="checkbox" class="sel" style="margin:0" checked=${allOn} onChange=${() => setSel(allOn ? [] : rows.map((t) => t.id))} aria-label="Select all shown" /><span class="note">Select all ${rows.length} shown</span></div>
    ${!rows.length ? html`<p class="empty">No tasks match.</p>`
      : wide ? html`<${Grid} ctx=${ctx} rows=${rows} groupKey=${groupKey} groupLabel=${groupLabel} sel=${sel} toggle=${toggle} /><p class="kbd">Click any cell to edit. Arrow keys move between rows. On priority, press 1, 2 or 3. Dates accept fri, +7 or 12 nov. Tick rows to change many at once.</p>`
      : html`<div class="rows"><${Limited} items=${rows} step=${100} render=${(t) => html`<${Row} key=${t.id} ctx=${ctx} t=${t} select=${toggle} selected=${sel.includes(t.id)} />`} /></div>`}`;
}

/* ---------- composer ---------- */
function Composer({ ctx, deptHint }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const k = (e) => { if (e.key === 'n' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !e.metaKey && !e.ctrlKey) { e.preventDefault(); ref.current?.focus(); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  const ownerDept = (pid) => ctx.members.find((m) => m.person_id === pid)?.department_id;
  function onPaste(e) {
    const txt = e.clipboardData?.getData('text') || '';
    const lines = txt.split(/\r?\n/).map((s) => s.replace(/^\s*([-*•–]|\d+[.)])\s*/, '').trim()).filter(Boolean);
    if (lines.length > 1) { e.preventDefault(); ctx.setSheet({ mode: 'bulk', lines: lines.slice(0, 30) }); }
  }
  async function submit(e) {
    e.preventDefault();
    const s = text.trim(); if (!s) return;
    setBusy(true);
    let data = null;
    try {
      const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 7000);
      ({ data } = await sb.functions.invoke('quick-add', { body: { text: s, today: today() }, signal: ctrl.signal }));
      clearTimeout(tm);
    } catch (_) { data = null; }
    const ok = data && !data.fallback && !data.error;
    if (ok && data.owner_id && data.due_date && data.priority) {
      const row = { title: data.title || s, owner_id: data.owner_id, due_date: data.due_date, due_time: data.due_time || null, priority: data.priority,
        department_id: data.department_id || ownerDept(data.owner_id) || deptHint || ctx.myDepts[0] || ctx.depts[0].id, task_list_id: data.task_list_id || null, is_private: !!data.is_private, created_by: ctx.me.id, source: 'app' };
      const { data: saved, error } = await sb.from('tasks').insert(row).select().single();
      setBusy(false);
      if (error) { ctx.setToast({ text: error.message }); return; }
      setText('');
      ctx.setToast({ text: `Added: ${row.title} → ${row.owner_id === ctx.me.id ? 'you' : first(ctx.person(row.owner_id)?.name)}, ${shortDue(row.due_date)}, ${row.priority}`,
        action: { label: 'Edit', fn: () => ctx.setSheet({ mode: 'edit', id: saved.id }) },
        undo: async () => { await sb.from('tasks').delete().eq('id', saved.id); ctx.load(); } });
      ctx.load();
      return;
    }
    const prefill = ok ? { ...data, raw: s } : { title: s, raw: s, parseNote: 'Could not read that. Fill in the fields.' };
    if (!prefill.department_id && deptHint) prefill.department_id = deptHint;
    setBusy(false); setText('');
    ctx.newTask(prefill);
  }
  return html`<div class="composer"><form onSubmit=${submit}>
    <label class="sr" for="composer">Add a task</label>
    <input id="composer" ref=${ref} placeholder=${busy ? 'Reading…' : 'Add a task: Tiru to finalise Diwali creative by Thu, P1. Paste several lines to add many.'} value=${text} disabled=${busy} onInput=${(e) => setText(e.target.value)} onPaste=${onPaste} autocomplete="off" />
    <button type="submit" aria-label="Add task" disabled=${busy}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg></button>
  </form></div>`;
}

/* ---------- task sheet: new task (explicit add) and task panel (autosave) ---------- */
let NAV = [];
const setNav = (items) => { NAV = items.map((t) => t.id); };

function TaskSheet({ ctx, sheet, close }) {
  if (sheet.mode === 'new') return html`<${NewTask} ctx=${ctx} pre=${sheet.prefill || {}} close=${close} />`;
  if (sheet.mode === 'bulk') return html`<${BulkAdd} ctx=${ctx} lines=${sheet.lines} close=${close} />`;
  return html`<${TaskPanel} key=${sheet.id} ctx=${ctx} id=${sheet.id} close=${close} />`;
}

function DeadlineField({ value, onChange, disabled }) {
  const td = today();
  const chips = [['Today', td], ['Tomorrow', addDays(td, 1)], ['Fri', parseQuick('fri')], ['Mon', nextDow(0)], ['+1 week', addDays(td, 7)]];
  const [txt, setTxt] = useState('');
  const guess = parseQuick(txt);
  return html`<div>
    ${!disabled ? html`<div class="chips" style="margin-bottom:8px">${chips.map(([l, d]) => html`<button type="button" class="chip" aria-pressed=${value === d} onClick=${() => onChange(d)}>${l}</button>`)}</div>` : ''}
    <div class="grid2">
      <input type="date" class="field" aria-label="Deadline date" value=${value || ''} disabled=${disabled} onChange=${(e) => e.target.value && onChange(e.target.value)} />
      ${!disabled ? html`<input class="field" placeholder="or type fri, +7, 12 nov" aria-label="Type a date" value=${txt} onInput=${(e) => setTxt(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter' && guess) { onChange(guess); setTxt(''); } }} />` : ''}
    </div>
    ${txt && !disabled ? html`<p class="note">${guess ? `Enter for ${fmtDate(guess)}` : 'Try fri, +7, 12 nov'}</p>` : value ? html`<p class="note">${fmtDate(value)}</p>` : ''}
  </div>`;
}
const PrioritySeg = ({ value, onChange, disabled }) => html`<div class="seg" role="radiogroup" aria-label="Priority">${['P1', 'P2', 'P3'].map((p) => html`<button type="button" role="radio" disabled=${disabled} aria-checked=${value === p} onClick=${() => onChange(p)}><span class="dot" style=${'background:' + PCOL[p]}></span>${p}</button>`)}</div>`;

function NewTask({ ctx, pre, close }) {
  const ownerDept = (pid) => ctx.members.find((m) => m.person_id === pid)?.department_id;
  const defOwner = pre.owner_id || ctx.me.id;
  const [f, setF] = useState({ title: pre.title || '', owner_id: defOwner, due_date: pre.due_date || '', due_time: pre.due_time || '', priority: pre.priority || 'P2',
    department_id: pre.department_id || ownerDept(defOwner) || ctx.myDepts[0] || ctx.depts[0]?.id, task_list_id: pre.task_list_id || '', is_private: !!pre.is_private, notes: '' });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  useEffect(() => { const k = (e) => e.key === 'Escape' && close(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  async function add() {
    if (!f.title.trim()) return setErr('Add what needs doing.');
    if (!f.due_date) return setErr('Pick a deadline.');
    setSaving(true);
    const { error } = await sb.from('tasks').insert({ title: f.title.trim(), owner_id: f.owner_id, priority: f.priority, due_date: f.due_date, due_time: f.due_time || null, department_id: f.department_id, task_list_id: f.task_list_id || null, is_private: f.is_private, notes: f.notes || null, created_by: ctx.me.id, source: 'app' });
    setSaving(false);
    if (error) return setErr(error.message);
    ctx.setToast({ text: f.owner_id === ctx.me.id ? 'Task added' : `Sent to ${first(ctx.person(f.owner_id)?.name)}` });
    ctx.load(); close();
  }
  return html`<div class="scrim" onClick=${close}><div class="sheet" role="dialog" aria-modal="true" aria-label="New task" onClick=${(e) => e.stopPropagation()}>
    <div class="top"><span class="from">${pre.raw ? `From: “${pre.raw}”` : 'New task'}</span><button class="btn quiet" onClick=${close}>Close</button></div>
    ${pre.parseNote ? html`<p class="note">${pre.parseNote}</p>` : ''}
    <input class="titlein" aria-label="Task" value=${f.title} onInput=${(e) => set('title', e.target.value)} placeholder="What needs doing" />
    <div><label class="lbl" for="own">Owner</label><select id="own" class="field" value=${f.owner_id} onChange=${(e) => { const d = ownerDept(e.target.value); setF((x) => ({ ...x, owner_id: e.target.value, ...(d && !pre.department_id ? { department_id: d, task_list_id: '' } : {}) })); }}>${ctx.people.map((p) => html`<option value=${p.id}>${p.name}${p.id === ctx.me.id ? ' (me)' : ''}</option>`)}</select>
      ${pre.owner_candidates?.length ? html`<p class="note">More than one match: ${pre.owner_candidates.map((id) => ctx.person(id)?.name).join(', ')}</p>` : ''}</div>
    <div><span class="lbl">Deadline</span><${DeadlineField} value=${f.due_date} onChange=${(d) => set('due_date', d)} /></div>
    <div><span class="lbl">Priority</span><${PrioritySeg} value=${f.priority} onChange=${(p) => set('priority', p)} /></div>
    <div class="grid2">
      <div><label class="lbl" for="dp">Department</label><select id="dp" class="field" value=${f.department_id} onChange=${(e) => setF((x) => ({ ...x, department_id: e.target.value, task_list_id: '' }))}>${ctx.depts.map((d) => html`<option value=${d.id}>${d.name}</option>`)}</select></div>
      <div><label class="lbl" for="tl">Task list</label><select id="tl" class="field" value=${f.task_list_id} onChange=${(e) => set('task_list_id', e.target.value)}><option value="">None</option>${ctx.lists.filter((l) => l.department_id === f.department_id).map((l) => html`<option value=${l.id}>${l.name}</option>`)}</select></div>
    </div>
    <div><label class="lbl" for="nt">Notes</label><textarea id="nt" class="field" value=${f.notes} onInput=${(e) => set('notes', e.target.value)}></textarea></div>
    <label style="display:flex;gap:10px;align-items:center"><input type="checkbox" class="sel" style="margin:0" checked=${f.is_private} onChange=${(e) => set('is_private', e.target.checked)} /> Private (only owner, creator and Bhargav)</label>
    ${err ? html`<p class="err" role="alert">${err}</p>` : ''}
    <div class="actions"><button class="btn primary big" disabled=${saving} onClick=${add}>Add task</button><button class="btn quiet big" onClick=${close}>Cancel</button></div>
  </div></div>`;
}

function TaskPanel({ ctx, id, close }) {
  const t = ctx.tasks.find((x) => x.id === id);
  const [title, setTitle] = useState(t?.title || '');
  const [notes, setNotes] = useState(t?.notes || '');
  const [updates, setUpdates] = useState(null);
  const [upd, setUpd] = useState('');
  const [ask, setAsk] = useState(null);
  const [blk, setBlk] = useState(null);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState(false);
  const idx = NAV.indexOf(id);
  const go = (d) => { const nid = NAV[idx + d]; if (nid) ctx.setSheet({ mode: 'edit', id: nid }); };
  useEffect(() => { loadUpdates(); }, []);
  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') return close();
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); go(1); }
      if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); go(-1); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [idx]);
  async function loadUpdates() {
    const [u, a] = await Promise.all([
      sb.from('task_updates').select('*').eq('task_id', id).order('created_at', { ascending: false }),
      sb.from('task_activity').select('*').eq('task_id', id).order('created_at', { ascending: false }).limit(30),
    ]);
    setUpdates([...(u.data || []).map((x) => ({ ...x, kind: 'u' })), ...(a.data || []).filter((x) => ['date_changed', 'reassigned', 'blocked', 'done', 'reopened', 'acknowledged', 'nudged', 'asked_update'].includes(x.action)).map((x) => ({ ...x, kind: 'a' }))]
      .sort((x, y) => y.created_at.localeCompare(x.created_at)));
  }
  if (!t) return html`<div class="scrim" onClick=${close}><div class="sheet" onClick=${(e) => e.stopPropagation()}><p>This task is not available. It may have been deleted or made private.</p><button class="btn" onClick=${close}>Close</button></div></div>`;
  const can = ctx.canEdit(t);
  const canRedate = ctx.canRedate(t) && can;
  const canOwner = ctx.isAdmin || ctx.isHead(t.department_id) || t.created_by === ctx.me.id;
  const isOwner = t.owner_id === ctx.me.id;
  const canDelete = ctx.isAdmin || ctx.isHead(t.department_id) || t.created_by === ctx.me.id;
  const canNudge = !isOwner && (ctx.isAdmin || ctx.isHead(t.department_id) || t.created_by === ctx.me.id);
  const save = async (fields) => { setErr(''); await ctx.save(t, fields, () => { setFlash(true); setTimeout(() => setFlash(false), 1400); }); };
  const pendingReq = ctx.dcr.find((r) => r.task_id === t.id);
  async function addUpdate() {
    const body = upd.trim(); if (!body) return;
    const { error } = await sb.from('task_updates').insert({ task_id: t.id, author_id: ctx.me.id, body });
    if (error) return setErr(error.message);
    setUpd(''); loadUpdates(); ctx.load();
  }
  async function requestDate() {
    if (!ask?.date) return setErr('Pick the new date.');
    const { error } = await sb.from('date_change_requests').insert({ task_id: t.id, requested_by: ctx.me.id, current_due: t.due_date, proposed_due: ask.date, reason: ask.reason || null });
    if (error) return setErr(error.message);
    ctx.setToast({ text: 'Date change requested' }); setAsk(null); ctx.load();
  }
  async function del() {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    const { error } = await sb.from('tasks').delete().eq('id', t.id);
    if (error) return setErr(error.message);
    ctx.setToast({ text: 'Deleted' }); ctx.load(); close();
  }
  return html`<div class="scrim panelmode" onClick=${close}><div class="sheet" role="dialog" aria-label="Task details" onClick=${(e) => e.stopPropagation()}>
    <div class="top">
      <span class="from">${ctx.dept(t.department_id)?.name}, added by ${first(ctx.person(t.created_by)?.name)} ${ago(t.created_at)} ${flash ? html`<span class="saved">Saved</span>` : ''}</span>
      <span style="display:flex;gap:2px;align-items:center">
        ${idx >= 0 ? html`<span class="note num" style="margin-right:4px">${idx + 1} of ${NAV.length}</span>
          <button class="iconbtn" aria-label="Previous task (K)" disabled=${idx <= 0} onClick=${() => go(-1)}>↑</button>
          <button class="iconbtn" aria-label="Next task (J)" disabled=${idx >= NAV.length - 1} onClick=${() => go(1)}>↓</button>` : ''}
        <button class="btn quiet" onClick=${close}>Close</button>
      </span>
    </div>
    <input class="titlein" aria-label="Task title" value=${title} disabled=${!can} onInput=${(e) => setTitle(e.target.value)} onBlur=${() => { const s = title.trim(); if (s && s !== t.title) save({ title: s }); }} onKeyDown=${(e) => e.key === 'Enter' && e.target.blur()} />

    <div class="actions">
      ${t.status === 'done' ? html`<button class="btn" onClick=${() => ctx.reopen(t)}>Reopen</button>` : html`
        <button class="btn primary" disabled=${!can} onClick=${() => ctx.done(t)}>Mark done</button>
        ${isOwner && !t.acknowledged_at ? html`<button class="btn" onClick=${() => save({ acknowledged_at: new Date().toISOString() })}>Got it</button>` : ''}
        ${t.status === 'blocked' ? html`<button class="btn" onClick=${() => save({ status: 'open' })}>Unblock</button>` : can ? html`<button class="btn" onClick=${() => setBlk({ reason: '', on: '' })}>Mark blocked</button>` : ''}
        ${!canRedate && can && t.due_date && !pendingReq ? html`<button class="btn" onClick=${() => setAsk({ date: '', reason: '' })}>Ask for new date</button>` : ''}
        ${canNudge ? html`<button class="btn" onClick=${() => ctx.nudge(t, 'nudge')}>Nudge ${first(ctx.person(t.owner_id)?.name)}</button><button class="btn" onClick=${() => ctx.nudge(t, 'ask')}>Ask for update</button>` : ''}`}
    </div>
    ${t.request_status === 'pending' && isOwner ? html`<div class="box"><span>Request from ${ctx.person(t.created_by)?.name}</span><div class="actions"><button class="btn primary" onClick=${() => ctx.decideRequest(t, true)}>Accept</button><button class="btn" onClick=${() => { const n = prompt('Reason for declining (optional)'); ctx.decideRequest(t, false, n); close(); }}>Decline</button><span class="note">or change the owner below</span></div></div>` : ''}
    ${pendingReq ? html`<div class="box"><span>${first(ctx.person(pendingReq.requested_by)?.name)} asked to move this to ${fmtDate(pendingReq.proposed_due)}${pendingReq.reason ? `: ${pendingReq.reason}` : ''}</span>${ctx.canDecide(t) ? html`<div class="actions"><button class="btn primary" onClick=${() => ctx.decideDate(pendingReq, true)}>Approve</button><button class="btn" onClick=${() => ctx.decideDate(pendingReq, false)}>Reject</button></div>` : html`<span class="note">Waiting for approval.</span>`}</div>` : ''}
    ${ask ? html`<div class="box"><label class="lbl" for="nd">New date</label><input id="nd" type="date" class="field" min=${today()} value=${ask.date} onInput=${(e) => setAsk({ ...ask, date: e.target.value })} /><input class="field" placeholder="Reason (optional)" value=${ask.reason} onInput=${(e) => setAsk({ ...ask, reason: e.target.value })} /><div class="actions"><button class="btn primary" onClick=${requestDate}>Send request</button><button class="btn quiet" onClick=${() => setAsk(null)}>Cancel</button></div></div>` : ''}
    ${blk ? html`<div class="box"><input class="field" placeholder="What is it waiting on?" value=${blk.reason} onInput=${(e) => setBlk({ ...blk, reason: e.target.value })} /><select class="field" aria-label="Waiting on person" value=${blk.on} onChange=${(e) => setBlk({ ...blk, on: e.target.value })}><option value="">Waiting on (optional)</option>${ctx.people.map((p) => html`<option value=${p.id}>${p.name}</option>`)}</select><div class="actions"><button class="btn primary" onClick=${async () => { await save({ status: 'blocked', blocked_reason: blk.reason || null, blocked_on_person_id: blk.on || null }); setBlk(null); }}>Mark blocked</button><button class="btn quiet" onClick=${() => setBlk(null)}>Cancel</button></div></div>` : ''}
    ${t.status === 'blocked' && t.blocked_reason ? html`<p class="note">Blocked: ${t.blocked_reason}${t.blocked_on_person_id ? `, waiting on ${ctx.person(t.blocked_on_person_id)?.name}` : ''}</p>` : ''}

    <section style="display:flex;flex-direction:column;gap:12px">
      <span class="lbl" style="margin:0">Updates</span>
      <div style="display:flex;gap:8px"><input class="field" style="flex:1" aria-label="Add an update" placeholder="Add an update" value=${upd} onInput=${(e) => setUpd(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && addUpdate()} /><button class="btn primary" onClick=${addUpdate}>Post</button></div>
      ${updates === null ? html`<p class="note">Loading…</p>` : updates.length ? updates.slice(0, 12).map((u) => u.kind === 'u'
        ? html`<div class="upd"><span class="av">${initials(ctx.person(u.author_id)?.name)}</span><div><div class="b"><b style="color:var(--ink);font-weight:600">${ctx.person(u.author_id)?.name}</b> ${ago(u.created_at)}</div><div class="x">${u.body}</div></div></div>`
        : html`<div class="sys">${activityText(ctx, u)} ${ago(u.created_at)}</div>`) : html`<p class="note">No updates yet.</p>`}
    </section>

    <div style="border-top:1px solid var(--line);padding-top:14px;display:flex;flex-direction:column;gap:14px">
      <div><label class="lbl" for="own">Owner</label><select id="own" class="field" disabled=${!canOwner} value=${t.owner_id} onChange=${(e) => save({ owner_id: e.target.value, acknowledged_at: e.target.value === ctx.me.id ? new Date().toISOString() : null })}>${ctx.people.map((p) => html`<option value=${p.id}>${p.name}${p.id === ctx.me.id ? ' (me)' : ''}</option>`)}</select></div>
      <div><span class="lbl">Deadline${!canRedate ? ' (ask the assigner to change it)' : ''}${t.slip_count ? `, moved ${t.slip_count}×` : ''}</span><${DeadlineField} value=${t.due_date} disabled=${!canRedate} onChange=${(d) => d !== t.due_date && save({ due_date: d })} /></div>
      <div><span class="lbl">Priority</span><${PrioritySeg} value=${t.priority} disabled=${!can} onChange=${(p) => save({ priority: p })} />${t.notes?.startsWith('Zoho priority') && !t.priority ? html`<p class="note">${t.notes}</p>` : ''}</div>
      <div class="grid2">
        <div><label class="lbl" for="dp">Department</label><select id="dp" class="field" disabled=${!(ctx.isAdmin || ctx.isHead(t.department_id))} value=${t.department_id} onChange=${(e) => save({ department_id: e.target.value, task_list_id: null })}>${ctx.depts.map((d) => html`<option value=${d.id}>${d.name}</option>`)}</select></div>
        <div><label class="lbl" for="tl">Task list</label><select id="tl" class="field" disabled=${!can} value=${t.task_list_id || ''} onChange=${(e) => save({ task_list_id: e.target.value || null })}><option value="">None</option>${ctx.lists.filter((l) => l.department_id === t.department_id).map((l) => html`<option value=${l.id}>${l.name}</option>`)}</select></div>
      </div>
      <div><label class="lbl" for="nt">Notes</label><textarea id="nt" class="field" disabled=${!can} value=${notes} onInput=${(e) => setNotes(e.target.value)} onBlur=${() => notes !== (t.notes || '') && save({ notes: notes || null })}></textarea></div>
      <label style="display:flex;gap:10px;align-items:center"><input type="checkbox" class="sel" style="margin:0" disabled=${!can} checked=${t.is_private} onChange=${(e) => save({ is_private: e.target.checked })} /> Private (only owner, creator and Bhargav)</label>
      ${err ? html`<p class="err" role="alert">${err}</p>` : ''}
      <p class="note">Changes save as you make them. J and K move to the next and previous task.</p>
      ${canDelete ? html`<div><button class="btn quiet" onClick=${del}>Delete task</button></div>` : ''}
    </div>
  </div></div>`;
}

/* ---------- bulk add from pasted lines ---------- */
function BulkAdd({ ctx, lines, close }) {
  const ownerDept = (pid) => ctx.members.find((m) => m.person_id === pid)?.department_id;
  const [rows, setRows] = useState(lines.map((l) => ({ raw: l, title: l, owner_id: ctx.me.id, due_date: '', priority: 'P2', department_id: ownerDept(ctx.me.id) || ctx.depts[0]?.id, parsing: true })));
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    lines.forEach(async (l, i) => {
      try {
        const { data } = await sb.functions.invoke('quick-add', { body: { text: l, today: today() } });
        setRows((rs) => rs.map((r, j) => j !== i ? r : (data && !data.fallback && !data.error) ? { ...r, title: data.title || l, owner_id: data.owner_id || r.owner_id, due_date: data.due_date || '', priority: data.priority || 'P2', department_id: data.department_id || ownerDept(data.owner_id) || r.department_id, task_list_id: data.task_list_id || null, parsing: false } : { ...r, parsing: false }));
      } catch (_) { setRows((rs) => rs.map((r, j) => (j === i ? { ...r, parsing: false } : r))); }
    });
  }, []);
  const upd = (i, k, v) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v, ...(k === 'owner_id' ? { department_id: ownerDept(v) || r.department_id } : {}) } : r)));
  const ready = rows.filter((r) => r.title.trim() && r.due_date);
  async function addAll() {
    setSaving(true);
    const { error } = await sb.from('tasks').insert(ready.map((r) => ({ title: r.title.trim(), owner_id: r.owner_id, due_date: r.due_date, priority: r.priority, department_id: r.department_id, task_list_id: r.task_list_id || null, created_by: ctx.me.id, source: 'app' })));
    setSaving(false);
    if (error) return ctx.setToast({ text: error.message });
    ctx.setToast({ text: `${ready.length} tasks added` }); ctx.load(); close();
  }
  return html`<div class="scrim" onClick=${close}><div class="sheet wide" role="dialog" aria-modal="true" aria-label="Add several tasks" onClick=${(e) => e.stopPropagation()}>
    <div class="top"><span class="lbl" style="margin:0;font-size:15px;color:var(--ink);font-weight:600">${rows.length} tasks from your paste</span><button class="btn quiet" onClick=${close}>Close</button></div>
    <p class="note">Check owners and dates. Rows without a deadline are skipped.</p>
    ${rows.map((r, i) => html`<div class="bulkrow">
      <input class="field" aria-label="Task" value=${r.title} onInput=${(e) => upd(i, 'title', e.target.value)} />
      <select class="field" aria-label="Owner" value=${r.owner_id} onChange=${(e) => upd(i, 'owner_id', e.target.value)}>${ctx.people.map((p) => html`<option value=${p.id} selected=${r.owner_id === p.id}>${p.name}</option>`)}</select>
      <input type="date" class=${'field' + (r.due_date ? '' : ' missing')} aria-label="Deadline" value=${r.due_date} onChange=${(e) => upd(i, 'due_date', e.target.value)} />
      <select class="field" aria-label="Priority" value=${r.priority} onChange=${(e) => upd(i, 'priority', e.target.value)}>${['P1', 'P2', 'P3'].map((p) => html`<option value=${p} selected=${r.priority === p}>${p}</option>`)}</select>
      <button class="iconbtn" aria-label="Remove row" onClick=${() => setRows((rs) => rs.filter((_, j) => j !== i))}>✕</button>
      ${r.parsing ? html`<span class="note" style="grid-column:1/-1">Reading…</span>` : ''}
    </div>`)}
    <div class="actions"><button class="btn primary big" disabled=${saving || !ready.length} onClick=${addAll}>Add ${ready.length} tasks</button><button class="btn quiet big" onClick=${close}>Cancel</button></div>
  </div></div>`;
}

function activityText(ctx, a) {
  const who = first(ctx.person(a.actor_id)?.name) || 'Email link';
  const d = a.details || {};
  if (a.action === 'date_changed') return `${who} moved the deadline${d.from ? ` from ${fmtDate(d.from)}` : ''} to ${d.to ? fmtDate(d.to) : 'none'}`;
  if (a.action === 'reassigned') return `${who} reassigned to ${ctx.person(d.to)?.name}`;
  if (a.action === 'blocked') return `${who} marked blocked${d.reason ? `: ${d.reason}` : ''}`;
  if (a.action === 'done') return `${who} marked done`;
  if (a.action === 'reopened') return `${who} reopened`;
  if (a.action === 'acknowledged') return `${who} acknowledged`;
  return a.action;
}

/* ---------- toast ---------- */
function Toast({ toast, done }) {
  useEffect(() => { const tm = setTimeout(done, toast.undo || toast.action ? 6000 : 2500); return () => clearTimeout(tm); }, [toast]);
  return html`<div class="toast" role="status">${toast.text}${toast.action ? html`<button onClick=${() => { toast.action.fn(); done(); }}>${toast.action.label}</button>` : ''}${toast.undo ? html`<button onClick=${() => { toast.undo(); done(); }}>Undo</button>` : ''}</div>`;
}

render(html`<${App} />`, document.getElementById('app'));
