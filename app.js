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
        <div class="brand">BS Tasks</div>
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
  const openTask = (t) => setSheet({ mode: 'edit', id: t.id });
  const newTask = (prefill) => setSheet({ mode: 'new', prefill });

  return { me, data, people, depts, members, lists, tasks, dcr, person, dept, list, isAdmin, myDepts, headDepts, isHead, canSeeStats, canDecide, canRedate,
    open, visibleOpen, mine, update, done, reopen, needsYou, decideDate, decideRequest, openTask, newTask, load, setToast, setSheet };
}

/* ---------- login ---------- */
function Login() {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, queryParams: { hd: DOMAIN, prompt: 'select_account' } } });
  };
  return html`<div class="login"><div class="card">
    <h1>BS Tasks</h1>
    <p class="note">Sign in with your ${DOMAIN} Google account.</p>
    <button class="btn primary big" disabled=${busy} onClick=${go}>${busy ? 'Opening Google…' : 'Sign in with Google'}</button>
  </div></div>`;
}

/* ---------- task row ---------- */
function Row({ ctx, t, select, selected, showOwner = true, showDept = true }) {
  const owner = ctx.person(t.owner_id);
  const late = isLate(t);
  const meta = [];
  if (showOwner) meta.push(html`<span>${owner?.name}</span>`);
  if (showDept) meta.push(html`<span>${ctx.dept(t.department_id)?.name}</span>`);
  if (t.task_list_id) meta.push(html`<span>${ctx.list(t.task_list_id)?.name}</span>`);
  if (t.status === 'blocked') meta.push(html`<span class="tag grey">Blocked${t.blocked_on_person_id ? ` on ${first(ctx.person(t.blocked_on_person_id)?.name)}` : ''}</span>`);
  if (t.slip_count >= 1) meta.push(html`<span class="tag sand">Moved ${t.slip_count}×</span>`);
  if (!t.acknowledged_at && t.owner_id === ctx.me.id) meta.push(html`<span class="tag">New</span>`);
  if (t.from_department_id) meta.push(html`<span class="tag">From ${ctx.dept(t.from_department_id)?.name}</span>`);
  if (t.request_status === 'pending') meta.push(html`<span class="tag">Request</span>`);
  if (t.is_private) meta.push(html`<span class="tag grey">Private</span>`);
  return html`<div class=${'row' + (t.status === 'done' ? ' isdone' : '')}>
    ${select ? html`<input type="checkbox" class="sel" checked=${selected} onChange=${() => select(t.id)} aria-label=${'Select ' + t.title} />` : ''}
    <button class=${`ring ${t.priority || 'none'}${t.status === 'done' ? ' done' : ''}`} aria-label=${(t.status === 'done' ? 'Reopen: ' : 'Mark done: ') + t.title} onClick=${() => (t.status === 'done' ? ctx.reopen(t) : ctx.done(t))}></button>
    <div class="main" onClick=${() => ctx.openTask(t)} role="button" tabindex="0" onKeyDown=${(e) => e.key === 'Enter' && ctx.openTask(t)}>
      <span class="title">${t.title}</span>
      <span class="meta">${meta}</span>
      ${t.last_update_body ? html`<span class="meta">“${t.last_update_body.slice(0, 90)}${t.last_update_body.length > 90 ? '…' : ''}” ${ago(t.last_update_at)}</span>` : ''}
    </div>
    <span class=${'due' + (late ? ' late' : '')}>${t.status === 'done' ? 'Done' : shortDue(t.due_date)}</span>
  </div>`;
}

function Limited({ items, render: r, step = 50 }) {
  const [n, setN] = useState(step);
  return html`${items.slice(0, n).map(r)}${items.length > n ? html`<div class="more"><button class="linkbtn" onClick=${() => setN(n + step * 2)}>Show ${Math.min(items.length - n, step * 2)} more of ${items.length - n}</button></div>` : ''}`;
}

/* ---------- overview ---------- */
function Overview({ ctx }) {
  const [filter, setFilter] = useState('needs');
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
    return { d, open: o.length, pct, st, rank: st[1] === 'help' ? 0 : st[1] === 'behind' ? 1 : 2 };
  }).sort((a, b) => a.rank - b.rank || b.open - a.open);
  const since = useMemo(() => {
    const last = Number(localStorage.getItem('bs_last_seen') || 0);
    const items = ctx.tasks.filter((t) => Date.parse(t.updated_at) > last && t.updated_at !== t.created_at).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 8);
    setTimeout(() => { try { localStorage.setItem('bs_last_seen', String(Date.now())); } catch (_) {} }, 4000);
    return { last, items };
  }, []);
  const list = filter === 'needs' ? null : filter === 'done' ? doneWeek : filter === 'due' ? dueWeek : blocked;

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
            ${n.req ? html`<button class="btn primary" onClick=${() => ctx.decideDate(n.req, true)}>Approve</button><button class="btn quiet" onClick=${() => ctx.decideDate(n.req, false)}>Reject</button>`
              : n.request ? html`<button class="btn primary" onClick=${() => ctx.decideRequest(n.t, true)}>Accept</button><button class="btn quiet" onClick=${() => ctx.openTask(n.t)}>Reassign</button>`
              : html`<button class="btn" onClick=${() => ctx.openTask(n.t)}>Open</button>`}
          </div>`} />` : html`<p class="empty">Nothing needs you right now.</p>`}
        </section>` : html`<section class="panel"><div class="ph"><h2>${figs.find((f) => f[0] === filter)[2]}</h2></div>
          ${list.length ? html`<${Limited} items=${list} render=${(t) => html`<${Row} key=${t.id} ctx=${ctx} t=${t} />`} />` : html`<p class="empty">None.</p>`}</section>`}
      </div>
      <div>
        <section class="panel"><div class="ph"><h2>Teams</h2></div>
          ${teams.map(({ d, open: o, pct, st }) => html`<a class="team" href=${'#dept?dept=' + d.id}>
            <span>${d.name}</span>
            <span class="bar" aria-hidden="true"><i style=${`width:${pct}%;background:${st[2]}`}></i></span>
            <span class="num" style="text-align:right;color:var(--muted);font-size:14px">${o}</span>
            <span class=${'st-' + st[1]} style="text-align:right;font-size:14px">${st[0]}</span>
          </a>`)}
        </section>
        ${since.last ? html`<section class="panel"><div class="ph"><h2>Since you last looked</h2><span class="note">${ago(new Date(since.last).toISOString())}</span></div>
          ${since.items.length ? since.items.map((t) => html`<div class="need" style="cursor:pointer" onClick=${() => ctx.openTask(t)}><span class="k">${new Date(t.updated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span><span class="t"><span>${t.title}</span><span>${t.status === 'done' ? 'Done' : t.status === 'blocked' ? 'Blocked' : 'Updated'} by ${first(ctx.person(t.owner_id)?.name)}</span></span></div>`) : html`<p class="empty">No changes.</p>`}
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
  const choices = ctx.isAdmin ? ctx.depts : ctx.depts.filter((d) => ctx.myDepts.includes(d.id));
  const id = route.dept && choices.some((d) => d.id === route.dept) ? route.dept : choices[0]?.id;
  const [group, setGroup] = useState('owner');
  const [f, setF] = useState('open');
  if (!id) return html`<div class="head"><h1>Department</h1></div><p class="empty">You are not in a department yet.</p>`;
  const td = today();
  const all = ctx.tasks.filter((t) => t.department_id === id);
  const open = all.filter((t) => t.status !== 'done');
  const shown = f === 'open' ? open : f === 'late' ? open.filter(isLate) : f === 'blocked' ? open.filter((t) => t.status === 'blocked') : f === 'nodate' ? open.filter(needsDate) : all.filter((t) => t.status === 'done' && t.completed_at?.slice(0, 10) >= weekStart());
  const requests = open.filter((t) => t.from_department_id && !t.acknowledged_at);
  const lead = ctx.isAdmin || ctx.isHead(id);
  const keyOf = (t) => (group === 'owner' ? t.owner_id : t.task_list_id || '');
  const groups = {};
  shown.forEach((t) => (groups[keyOf(t)] ||= []).push(t));
  const names = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);
  const label = (k) => (group === 'owner' ? ctx.person(k)?.name : k ? ctx.list(k)?.name : 'No task list');
  return html`
    <div class="head">
      <select class="field" style="font-size:20px;font-weight:500;height:44px;border:none;background:transparent;padding:0" aria-label="Department" value=${id} onChange=${(e) => (location.hash = 'dept?dept=' + e.target.value)}>
        ${choices.map((d) => html`<option value=${d.id}>${d.name}</option>`)}
      </select>
      <span class="sub num">${open.length} open, ${open.filter(isLate).length} late, ${open.filter((t) => t.status === 'blocked').length} blocked</span>
    </div>
    <div class="filters">
      <div class="chips">${[['open', 'Open'], ['late', 'Late'], ['blocked', 'Blocked'], ['nodate', 'No date'], ['done', 'Done this week']].map(([k, l]) => html`<button class="chip" aria-pressed=${f === k} onClick=${() => setF(k)}>${l}</button>`)}</div>
      <div class="grow" style="flex:1"></div>
      <div class="chips">${[['owner', 'By person'], ['list', 'By task list']].map(([k, l]) => html`<button class="chip" aria-pressed=${group === k} onClick=${() => setGroup(k)}>${l}</button>`)}</div>
    </div>
    ${lead && requests.length ? html`<section class="panel"><div class="ph"><h2>Requests from other teams</h2></div>${requests.map((t) => html`<${Row} key=${t.id} ctx=${ctx} t=${t} showDept=${false} />`)}</section>` : ''}
    ${names.map((k) => html`<div class="gh">${label(k)}${group === 'owner' && !ctx.canSeeStats(k) ? '' : html`<span class="num">${groups[k].length}${f === 'open' ? `, ${groups[k].filter(isLate).length} late` : ''}</span>`}</div>
      <div class="rows"><${Limited} items=${groups[k].sort((a, b) => (a.due_date || '9').localeCompare(b.due_date || '9'))} step=${8} render=${(t) => html`<${Row} key=${t.id} ctx=${ctx} t=${t} showDept=${false} showOwner=${group !== 'owner'} />`} /></div>`)}
    ${!shown.length ? html`<p class="empty">No tasks here.</p>` : ''}`;
}

/* ---------- all tasks ---------- */
function AllTasks({ ctx, route }) {
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [owner, setOwner] = useState('');
  const [prio, setPrio] = useState('');
  const [status, setStatus] = useState(route.status || 'open');
  const [sel, setSel] = useState([]);
  const [bulk, setBulk] = useState({});
  useEffect(() => { if (route.status) setStatus(route.status); }, [route.status]);
  const td = today();
  let rows = ctx.tasks.filter((t) => {
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
  }).sort((a, b) => (a.due_date || '9').localeCompare(b.due_date || '9') || (ctx.dept(a.department_id)?.sort_order ?? 0) - (ctx.dept(b.department_id)?.sort_order ?? 0));
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allOn = rows.length && rows.slice(0, 200).every((t) => sel.includes(t.id));
  async function apply(fields, msg) { if (await ctx.update(sel, fields, `${msg} (${sel.length})`)) { setSel([]); setBulk({}); ctx.load(); } }
  return html`
    <div class="head"><h1>All tasks</h1><span class="sub num">${rows.length} shown</span></div>
    <div class="filters">
      <label class="sr" for="q">Search</label><input id="q" class="field search" placeholder="Search tasks, people, task lists" value=${q} onInput=${(e) => setQ(e.target.value)} />
      <select class="field" aria-label="Status" value=${status} onChange=${(e) => setStatus(e.target.value)}>${[['open', 'Open'], ['nodate', 'Needs priority and date'], ['late', 'Late'], ['blocked', 'Blocked'], ['done', 'Done (14 days)'], ['any', 'Everything']].map(([v, l]) => html`<option value=${v}>${l}</option>`)}</select>
      <select class="field" aria-label="Department" value=${dept} onChange=${(e) => setDept(e.target.value)}><option value="">All departments</option>${ctx.depts.map((d) => html`<option value=${d.id}>${d.name}</option>`)}</select>
      <select class="field" aria-label="Owner" value=${owner} onChange=${(e) => setOwner(e.target.value)}><option value="">Everyone</option>${ctx.people.map((p) => html`<option value=${p.id}>${p.name}</option>`)}</select>
      <select class="field" aria-label="Priority" value=${prio} onChange=${(e) => setPrio(e.target.value)}><option value="">Any priority</option><option>P1</option><option>P2</option><option>P3</option><option value="none">No priority</option></select>
    </div>
    ${sel.length ? html`<div class="bulk">
      <b>${sel.length} selected</b>
      <select class="field" aria-label="Set priority" value=${bulk.p || ''} onChange=${(e) => e.target.value && apply({ priority: e.target.value }, 'Priority set')}><option value="">Set priority</option><option>P1</option><option>P2</option><option>P3</option></select>
      <input type="date" class="field" aria-label="Set deadline" min=${td} onChange=${(e) => e.target.value && apply({ due_date: e.target.value }, 'Deadline set')} />
      <select class="field" aria-label="Reassign" onChange=${(e) => e.target.value && apply({ owner_id: e.target.value, acknowledged_at: null }, 'Reassigned')}><option value="">Reassign to</option>${ctx.people.map((p) => html`<option value=${p.id}>${p.name}</option>`)}</select>
      <select class="field" aria-label="Move to department" onChange=${(e) => e.target.value && apply({ department_id: e.target.value, task_list_id: null }, 'Moved')}><option value="">Move to</option>${ctx.depts.map((d) => html`<option value=${d.id}>${d.name}</option>`)}</select>
      <button class="btn" onClick=${() => apply({ status: 'done', completed_at: new Date().toISOString() }, 'Closed')}>Close</button>
      <button class="btn quiet" onClick=${() => setSel([])}>Clear</button>
    </div>` : ''}
    <div class="row" style="border-bottom:none;padding-bottom:4px"><input type="checkbox" class="sel" checked=${allOn} onChange=${() => setSel(allOn ? [] : rows.slice(0, 200).map((t) => t.id))} aria-label="Select first 200" /><span class="note">Select ${Math.min(rows.length, 200)} shown</span></div>
    <div class="rows"><${Limited} items=${rows} step=${100} render=${(t) => html`<${Row} key=${t.id} ctx=${ctx} t=${t} select=${toggle} selected=${sel.includes(t.id)} />`} /></div>
    ${!rows.length ? html`<p class="empty">No tasks match.</p>` : ''}`;
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
  async function submit(e) {
    e.preventDefault();
    const s = text.trim(); if (!s) return;
    setBusy(true);
    let prefill = { title: s };
    try {
      const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 7000);
      const { data } = await sb.functions.invoke('quick-add', { body: { text: s, today: today() }, signal: ctrl.signal });
      clearTimeout(tm);
      if (data && !data.fallback && !data.error) prefill = { ...data, raw: s };
      else prefill = { title: s, raw: s, parseNote: 'Could not read that. Fill in the fields.' };
    } catch (_) { prefill = { title: s, raw: s, parseNote: 'Could not read that. Fill in the fields.' }; }
    if (!prefill.department_id && deptHint) prefill.department_id = deptHint;
    setBusy(false); setText('');
    ctx.newTask(prefill);
  }
  return html`<div class="composer"><form onSubmit=${submit}>
    <label class="sr" for="composer">Add a task</label>
    <input id="composer" ref=${ref} placeholder=${busy ? 'Reading…' : 'Add a task, e.g. Tiru to finalise Diwali creative by Thu, P1'} value=${text} disabled=${busy} onInput=${(e) => setText(e.target.value)} autocomplete="off" />
    <button type="submit" aria-label="Add task" disabled=${busy}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg></button>
  </form></div>`;
}

/* ---------- task sheet (new + edit) ---------- */
function TaskSheet({ ctx, sheet, close }) {
  const isNew = sheet.mode === 'new';
  const t = isNew ? null : ctx.tasks.find((x) => x.id === sheet.id);
  const pre = sheet.prefill || {};
  const defOwner = pre.owner_id || ctx.me.id;
  const ownerDept = (pid) => ctx.members.find((m) => m.person_id === pid)?.department_id;
  const [f, setF] = useState(() => t ? { ...t } : {
    title: pre.title || '', owner_id: defOwner, due_date: pre.due_date || '', due_time: pre.due_time || '', priority: pre.priority || 'P2',
    department_id: pre.department_id || ownerDept(defOwner) || ctx.myDepts[0] || ctx.depts[0]?.id, task_list_id: pre.task_list_id || '', is_private: !!pre.is_private, notes: '',
  });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [updates, setUpdates] = useState(null);
  const [upd, setUpd] = useState('');
  const [ask, setAsk] = useState(null);
  const [blk, setBlk] = useState(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  useEffect(() => { if (t) loadUpdates(); }, [sheet.id]);
  useEffect(() => { const k = (e) => e.key === 'Escape' && close(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  async function loadUpdates() {
    const [u, a] = await Promise.all([
      sb.from('task_updates').select('*').eq('task_id', sheet.id).order('created_at', { ascending: false }),
      sb.from('task_activity').select('*').eq('task_id', sheet.id).order('created_at', { ascending: false }).limit(30),
    ]);
    const items = [...(u.data || []).map((x) => ({ ...x, kind: 'u' })), ...(a.data || []).filter((x) => ['date_changed', 'reassigned', 'blocked', 'done', 'reopened', 'acknowledged'].includes(x.action)).map((x) => ({ ...x, kind: 'a' }))]
      .sort((x, y) => y.created_at.localeCompare(x.created_at));
    setUpdates(items);
  }
  if (!isNew && !t) return html`<div class="scrim" onClick=${close}><div class="sheet" onClick=${(e) => e.stopPropagation()}><p>This task is not available. It may have been deleted or made private.</p><button class="btn" onClick=${close}>Close</button></div></div>`;

  const canRedate = isNew || ctx.canRedate(t);
  const isOwner = t && t.owner_id === ctx.me.id;
  const canDelete = t && (ctx.isAdmin || ctx.isHead(t.department_id) || t.created_by === ctx.me.id);
  const deptLists = ctx.lists.filter((l) => l.department_id === f.department_id);
  const td = today();
  const chips = [['Today', td], ['Tomorrow', addDays(td, 1)], ['This Fri', dow(td) <= 4 ? addDays(td, 4 - dow(td)) : nextDow(4)], ['Next Mon', nextDow(0)], ['+1 week', addDays(td, 7)]];
  const recent = [...new Set(ctx.tasks.filter((x) => x.created_by === ctx.me.id).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((x) => x.owner_id))].slice(0, 5);
  const ownerOpts = [...recent.map((id) => ctx.person(id)).filter(Boolean), ...ctx.people.filter((p) => !recent.includes(p.id))];
  const load = (pid) => { const o = ctx.open().filter((x) => x.owner_id === pid); return ctx.canSeeStats(pid) ? ` (${o.length} open)` : ''; };

  async function save() {
    setErr('');
    if (!f.title.trim()) return setErr('Add what needs doing.');
    if (!f.owner_id) return setErr('Pick an owner.');
    if (!f.due_date && (isNew || t.source !== 'zoho' || f.priority)) return setErr('Pick a deadline.');
    if (!f.priority && f.due_date) return setErr('Pick a priority.');
    setSaving(true);
    const row = { title: f.title.trim(), owner_id: f.owner_id, priority: f.priority || null, department_id: f.department_id, task_list_id: f.task_list_id || null, is_private: f.is_private, notes: f.notes || null, due_time: f.due_time || null };
    if (canRedate) row.due_date = f.due_date || null;
    let res;
    if (isNew) {
      res = await sb.from('tasks').insert({ ...row, created_by: ctx.me.id, source: 'app' }).select().single();
    } else {
      if (row.owner_id !== t.owner_id) row.acknowledged_at = row.owner_id === ctx.me.id ? new Date().toISOString() : null;
      res = await sb.from('tasks').update(row).eq('id', t.id).select().single();
    }
    setSaving(false);
    if (res.error) return setErr(res.error.message);
    ctx.setToast({ text: isNew ? (row.owner_id === ctx.me.id ? 'Task added' : `Sent to ${first(ctx.person(row.owner_id)?.name)}`) : 'Saved' });
    ctx.load(); close();
  }
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
  async function setBlocked() {
    await ctx.update(t.id, { status: 'blocked', blocked_reason: blk.reason || null, blocked_on_person_id: blk.on || null }, 'Marked blocked');
    setBlk(null); ctx.load();
  }
  async function del() {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    const { error } = await sb.from('tasks').delete().eq('id', t.id);
    if (error) return setErr(error.message);
    ctx.setToast({ text: 'Deleted' }); ctx.load(); close();
  }
  const pendingReq = t && ctx.dcr.find((r) => r.task_id === t.id);

  return html`<div class="scrim" onClick=${close}><div class="sheet" role="dialog" aria-modal="true" aria-label=${isNew ? 'New task' : 'Task'} onClick=${(e) => e.stopPropagation()}>
    <div class="top"><span class="from">${isNew ? (pre.raw ? `From: “${pre.raw}”` : 'New task') : `${ctx.dept(t.department_id)?.name}, added by ${first(ctx.person(t.created_by)?.name)} ${ago(t.created_at)}`}</span><button class="btn quiet" onClick=${close} aria-label="Close">Close</button></div>
    ${pre.parseNote ? html`<p class="note">${pre.parseNote}</p>` : ''}
    <label class="sr" for="tt">Task</label>
    <input id="tt" class="titlein" value=${f.title} onInput=${(e) => set('title', e.target.value)} placeholder="What needs doing" />

    ${t && t.status !== 'done' ? html`<div class="actions">
      <button class="btn primary" onClick=${async () => { await ctx.done(t); close(); }}>Mark done</button>
      ${isOwner && !t.acknowledged_at ? html`<button class="btn" onClick=${() => ctx.update(t.id, { acknowledged_at: new Date().toISOString() }, 'Acknowledged')}>Got it</button>` : ''}
      ${t.status === 'blocked' ? html`<button class="btn" onClick=${() => ctx.update(t.id, { status: 'open' }, 'Unblocked')}>Unblock</button>` : html`<button class="btn" onClick=${() => setBlk({ reason: '', on: '' })}>Mark blocked</button>`}
      ${!canRedate && t.due_date && !pendingReq ? html`<button class="btn" onClick=${() => setAsk({ date: '', reason: '' })}>Ask for new date</button>` : ''}
    </div>` : ''}
    ${t && t.status === 'done' ? html`<div class="actions"><button class="btn" onClick=${() => ctx.reopen(t)}>Reopen</button></div>` : ''}
    ${t?.request_status === 'pending' && t.owner_id === ctx.me.id ? html`<div class="box"><span>Request from ${ctx.person(t.created_by)?.name}</span><div class="actions"><button class="btn primary" onClick=${() => ctx.decideRequest(t, true)}>Accept</button><button class="btn" onClick=${() => { const n = prompt('Reason for declining (optional)'); ctx.decideRequest(t, false, n); close(); }}>Decline</button><span class="note">or reassign below</span></div></div>` : ''}
    ${pendingReq ? html`<div class="box"><span>${first(ctx.person(pendingReq.requested_by)?.name)} asked to move this to ${fmtDate(pendingReq.proposed_due)}${pendingReq.reason ? `: ${pendingReq.reason}` : ''}</span>${ctx.canDecide(t) ? html`<div class="actions"><button class="btn primary" onClick=${() => ctx.decideDate(pendingReq, true)}>Approve</button><button class="btn" onClick=${() => ctx.decideDate(pendingReq, false)}>Reject</button></div>` : html`<span class="note">Waiting for approval.</span>`}</div>` : ''}
    ${ask ? html`<div class="box"><label class="lbl" for="nd">New date</label><input id="nd" type="date" class="field" min=${td} value=${ask.date} onInput=${(e) => setAsk({ ...ask, date: e.target.value })} /><input class="field" placeholder="Reason (optional)" value=${ask.reason} onInput=${(e) => setAsk({ ...ask, reason: e.target.value })} /><div class="actions"><button class="btn primary" onClick=${requestDate}>Send request</button><button class="btn quiet" onClick=${() => setAsk(null)}>Cancel</button></div></div>` : ''}
    ${blk ? html`<div class="box"><input class="field" placeholder="What is it waiting on?" value=${blk.reason} onInput=${(e) => setBlk({ ...blk, reason: e.target.value })} /><select class="field" aria-label="Waiting on person" value=${blk.on} onChange=${(e) => setBlk({ ...blk, on: e.target.value })}><option value="">Waiting on (optional)</option>${ctx.people.map((p) => html`<option value=${p.id}>${p.name}</option>`)}</select><div class="actions"><button class="btn primary" onClick=${setBlocked}>Mark blocked</button><button class="btn quiet" onClick=${() => setBlk(null)}>Cancel</button></div></div>` : ''}
    ${t?.status === 'blocked' && t.blocked_reason ? html`<p class="note">Blocked: ${t.blocked_reason}${t.blocked_on_person_id ? `, waiting on ${ctx.person(t.blocked_on_person_id)?.name}` : ''}</p>` : ''}

    <div>
      <label class="lbl" for="own">Owner</label>
      <select id="own" class="field" value=${f.owner_id} onChange=${(e) => { set('owner_id', e.target.value); if (isNew && !pre.department_id) { const d = ownerDept(e.target.value); if (d) setF((x) => ({ ...x, owner_id: e.target.value, department_id: d, task_list_id: '' })); } }}>
        ${ownerOpts.map((p) => html`<option value=${p.id}>${p.name}${p.id === ctx.me.id ? ' (me)' : ''}${load(p.id)}</option>`)}
      </select>
      ${pre.owner_candidates?.length ? html`<p class="note">More than one match: ${pre.owner_candidates.map((id) => ctx.person(id)?.name).join(', ')}</p>` : ''}
    </div>

    <div>
      <span class="lbl">Deadline${!canRedate ? ' (ask the assigner to change it)' : ''}</span>
      ${canRedate ? html`<div class="chips" style="margin-bottom:8px">${chips.map(([l, d]) => html`<button type="button" class="chip" aria-pressed=${f.due_date === d} onClick=${() => set('due_date', d)}>${l}</button>`)}</div>` : ''}
      <div class="grid2"><input type="date" class="field" aria-label="Deadline date" value=${f.due_date || ''} disabled=${!canRedate} onInput=${(e) => set('due_date', e.target.value)} /><input type="time" class="field" aria-label="Time (optional)" value=${f.due_time || ''} onInput=${(e) => set('due_time', e.target.value)} /></div>
      ${f.due_date ? html`<p class="note">${fmtDate(f.due_date)}${t?.slip_count ? `, moved ${t.slip_count}× before` : ''}</p>` : ''}
    </div>

    <div><span class="lbl">Priority</span><div class="seg" role="radiogroup" aria-label="Priority">${[['P1', 'var(--help)'], ['P2', 'var(--behind)'], ['P3', 'var(--p3)']].map(([p, c]) => html`<button type="button" role="radio" aria-checked=${f.priority === p} onClick=${() => set('priority', p)}><span class="dot" style=${'background:' + c}></span>${p}</button>`)}</div>
      ${t?.notes?.startsWith('Zoho priority') && !t.priority ? html`<p class="note">${t.notes}</p>` : ''}</div>

    <div class="grid2">
      <div><label class="lbl" for="dp">Department</label><select id="dp" class="field" value=${f.department_id} onChange=${(e) => setF((x) => ({ ...x, department_id: e.target.value, task_list_id: '' }))}>${ctx.depts.map((d) => html`<option value=${d.id}>${d.name}</option>`)}</select></div>
      <div><label class="lbl" for="tl">Task list</label><select id="tl" class="field" value=${f.task_list_id || ''} onChange=${(e) => set('task_list_id', e.target.value)}><option value="">None</option>${deptLists.map((l) => html`<option value=${l.id}>${l.name}</option>`)}</select></div>
    </div>
    <div><label class="lbl" for="nt">Notes</label><textarea id="nt" class="field" value=${f.notes || ''} onInput=${(e) => set('notes', e.target.value)}></textarea></div>
    <label style="display:flex;gap:10px;align-items:center"><input type="checkbox" class="sel" style="margin:0" checked=${f.is_private} onChange=${(e) => set('is_private', e.target.checked)} /> Private (only owner, creator and Bhargav)</label>

    ${err ? html`<p class="err" role="alert">${err}</p>` : ''}
    <div class="actions"><button class="btn primary big" disabled=${saving} onClick=${save}>${isNew ? 'Add task' : 'Save changes'}</button><button class="btn quiet big" onClick=${close}>Cancel</button>${canDelete ? html`<span style="flex:1"></span><button class="btn quiet big" onClick=${del}>Delete</button>` : ''}</div>

    ${t ? html`<section style="border-top:1px solid var(--line);padding-top:14px;display:flex;flex-direction:column;gap:12px">
      <span class="lbl" style="margin:0">Updates</span>
      <div style="display:flex;gap:8px"><label class="sr" for="up">Add an update</label><input id="up" class="field" style="flex:1" placeholder="Add an update" value=${upd} onInput=${(e) => setUpd(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && addUpdate()} /><button class="btn primary" onClick=${addUpdate}>Post</button></div>
      ${updates === null ? html`<p class="note">Loading…</p>` : updates.length ? updates.map((u) => u.kind === 'u'
        ? html`<div class="upd"><span class="av">${initials(ctx.person(u.author_id)?.name)}</span><div><div class="b"><b style="color:var(--ink);font-weight:600">${ctx.person(u.author_id)?.name}</b> ${ago(u.created_at)}</div><div class="x">${u.body}</div></div></div>`
        : html`<div class="sys">${activityText(ctx, u)} ${ago(u.created_at)}</div>`) : html`<p class="note">No updates yet.</p>`}
    </section>` : ''}
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
  useEffect(() => { const tm = setTimeout(done, toast.undo ? 5000 : 2500); return () => clearTimeout(tm); }, [toast]);
  return html`<div class="toast" role="status">${toast.text}${toast.undo ? html`<button onClick=${() => { toast.undo(); done(); }}>Undo</button>` : ''}</div>`;
}

render(html`<${App} />`, document.getElementById('app'));
