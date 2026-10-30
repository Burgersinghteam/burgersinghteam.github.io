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
const dow = (d) => (new Date(Date.parse(d)).getUTCDay() + 6) % 7;
const weekStart = () => addDays(today(), -dow(today()));
const weekEnd = () => addDays(weekStart(), 6);
const nextDow = (target) => { const t = today(); let n = (target - dow(t) + 7) % 7; if (n === 0) n = 7; return addDays(t, n); };
const fmtDate = (d) => new Date(Date.parse(d)).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayName = (d) => new Date(Date.parse(d)).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' });
const dayNum = (d) => new Date(Date.parse(d)).getUTCDate();
const shortDue = (d) => {
  if (!d) return 'Add date';
  const n = diff(d, today());
  if (n > 0) return `${n}d late`;
  if (n === 0) return 'Today';
  if (n === -1) return 'Tomorrow';
  if (n > -7) return dayName(d);
  return new Date(Date.parse(d)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
};
const ago = (ts) => {
  if (!ts) return '';
  const m = Math.round((Date.now() - Date.parse(ts)) / 60000);
  if (m < 60) return `${Math.max(m, 1)}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function parseQuick(s) {
  s = (s || '').trim().toLowerCase();
  const t = today();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (['today', 'tod'].includes(s)) return t;
  if (['tomorrow', 'tom', 'tmrw', 'tmr'].includes(s)) return addDays(t, 1);
  const plus = s.match(/^\+(\d+)\s*(d|w|days?|weeks?)?$/);
  if (plus) return addDays(t, +plus[1] * (/^w/.test(plus[2] || '') ? 7 : 1));
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const next = s.startsWith('next ');
  const name = next ? s.slice(5) : s;
  const idx = days.findIndex((d) => name.startsWith(d));
  if (idx >= 0) return !next && idx > dow(t) ? addDays(t, idx - dow(t)) : nextDow(idx);
  const parsed = Date.parse(`${s} ${new Date().getFullYear()}`);
  if (!isNaN(parsed)) { const d = ymd(new Date(parsed)); return d < t ? ymd(new Date(Date.parse(`${s} ${new Date().getFullYear() + 1}`))) : d; }
  return null;
}

/* ---------- small helpers ---------- */
const initials = (n = '') => n.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const first = (n = '') => n.split(' ')[0];
const isClosed = (t) => t.status === 'done' || t.status === 'cancelled';
const isActive = (t) => t.status === 'open' || t.status === 'blocked';
const isLate = (t) => isActive(t) && t.due_date && t.due_date < today();
const needsDate = (t) => isActive(t) && (!t.due_date || !t.priority);
const isQuiet = (t) => isActive(t) && diff((t.last_update_at || t.created_at).slice(0, 10), today()) >= 7;
const hash = (s = '') => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const AV = ['#FFE680', '#BFE6F7', '#F7D2D3', '#D9CCF4', '#D6F0E2', '#FFE0C2', '#E3E6EE', '#F5D7EC'];
const avColor = (id) => AV[hash(id || '') % AV.length];
const DCOL = ['#FFD600', '#CF3339', '#F2994A', '#4FB286', '#09A6E0', '#9B7BE0', '#17181B', '#E07BB5', '#C4A35A', '#2BB3A3', '#6E8BD8', '#A0A4AB'];
const LTINT = [['#FFF4B8', '#6B5800'], ['#E6F6FD', '#06688D'], ['#FBE4E5', '#A3262B'], ['#E6F5EE', '#2F7A57'], ['#EFE9FB', '#5B3FA8'], ['#FDEEDF', '#8A4B1A'], ['#F1F1F3', '#3B3D44']];
const listTint = (name = '') => LTINT[hash(name) % LTINT.length];
const PRI = { P1: 'Urgent', P2: 'Normal', P3: 'Low' };
let NAV = [];
const setNav = (items) => { NAV = items.map((t) => t.id); };

const Svg = (p) => html`<svg width=${p.s || 14} height=${p.s || 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=${p.w || 2} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p.children}</svg>`;
const I = {
  cal: html`<${Svg} s="13"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></${Svg}>`,
  bubble: html`<${Svg} s="13"><path d="M5 5h14v10H10l-4 4v-4H5z"/></${Svg}>`,
  search: html`<${Svg} s="14"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></${Svg}>`,
  plus: html`<${Svg} s="14" w="2.4"><path d="M12 5v14M5 12h14"/></${Svg}>`,
  caret: html`<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 6l6 6-6 6z"/></svg>`,
  check: html`<${Svg} s="13" w="3"><path d="M5 12.5l4.5 4.5L19 7.5"/></${Svg}>`,
  spark: html`<${Svg} s="14"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></${Svg}>`,
  overview: html`<${Svg} s="16" w="1.8"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></${Svg}>`,
  mine: html`<${Svg} s="16" w="1.8"><circle cx="12" cy="12" r="8"/><path d="M8.5 12l2.5 2.5 4.5-5"/></${Svg}>`,
  all: html`<${Svg} s="16" w="1.8"><path d="M5 6h14M5 12h14M5 18h14"/></${Svg}>`,
  dept: html`<${Svg} s="16" w="1.8"><circle cx="9" cy="9" r="3.2"/><circle cx="16.5" cy="10" r="2.6"/><path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5"/><path d="M15 15c2.2 0 4 1.2 5 3.6"/></${Svg}>`,
  pin: html`<${Svg} s="14" w="1.8"><path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/></${Svg}>`,
};
const LIcon = ({ name, sm }) => { const [bg, fg] = listTint(name); return html`<span class=${'licon' + (sm ? ' sm' : '')} style=${`background:${bg};color:${fg}`} aria-hidden="true">${(name || '·')[0].toUpperCase()}</span>`; };

function usePop() {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const k = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k, true);
    setTimeout(() => ref.current?.querySelector('.pop input')?.focus(), 0);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k, true); };
  }, [open]);
  return [open, setOpen, ref];
}
const useWide = () => {
  const mq = '(min-width: 761px)';
  const [w, setW] = useState(() => matchMedia(mq).matches);
  useEffect(() => { const m = matchMedia(mq); const h = () => setW(m.matches); m.addEventListener('change', h); return () => m.removeEventListener('change', h); }, []);
  return w;
};

/* ---------- query language (search, command bar, pinned views) ---------- */
function parseQuery(text, ctx) {
  const f = { text: [], owner: null, dept: null, list: null, prio: null, status: null, when: null, quiet: false };
  let rest = ` ${(text || '').toLowerCase()} `;
  const take = (re) => { const m = rest.match(re); if (m) { rest = rest.replace(m[0], ' '); return m; } return null; };
  if (take(/\s(late|overdue)\s/)) f.status = 'late';
  else if (take(/\sblocked\s/)) f.status = 'blocked';
  else if (take(/\s(done|completed)\s/)) f.status = 'done';
  else if (take(/\s(on hold|paused|held|hold)\s/)) f.status = 'hold';
  else if (take(/\s(cancelled|canceled|dropped)\s/)) f.status = 'cancelled';
  else if (take(/\s(no date|needs date|undated|no priority)\s/)) f.status = 'nodate';
  const p = take(/\s(p1|urgent|p2|normal|p3|low)\s/);
  if (p) f.prio = { p1: 'P1', urgent: 'P1', p2: 'P2', normal: 'P2', p3: 'P3', low: 'P3' }[p[1]];
  if (take(/\s(no update|quiet|stale)\s/)) f.quiet = true;
  if (take(/\stoday\s/)) f.when = 'today';
  else if (take(/\stomorrow\s/)) f.when = 'tomorrow';
  else if (take(/\s(this week|week)\s/)) f.when = 'week';
  const depts = [...ctx.depts].sort((a, b) => b.name.length - a.name.length);
  for (const d of depts) {
    const n = d.name.toLowerCase(); const w = n.split(' ')[0];
    if (rest.includes(` ${n} `)) { f.dept = d.id; rest = rest.replace(n, ' '); break; }
    const unique = w.length > 4 && depts.filter((x) => x.name.toLowerCase().split(' ')[0] === w).length === 1;
    if (unique && rest.includes(` ${w} `)) { f.dept = d.id; rest = rest.replace(` ${w} `, ' '); break; }
  }
  for (const pp of ctx.people) { const full = pp.name.toLowerCase(); const fn = full.split(' ')[0]; if (rest.includes(` ${full} `)) { f.owner = pp.id; rest = rest.replace(full, ' '); break; } if (rest.includes(` ${fn} `) && fn.length > 2) { f.owner = pp.id; rest = rest.replace(` ${fn} `, ' '); break; } }
  for (const l of ctx.lists) { const n = l.name.toLowerCase(); if (n.length > 3 && rest.includes(` ${n} `) && (!f.dept || l.department_id === f.dept)) { f.list = l.id; rest = rest.replace(n, ' '); break; } }
  rest = rest.replace(/\s('s|s)\s/g, ' ');
  f.text = rest.split(/\s+/).filter((w) => w && !['in', 'the', 'and', 'with', 'for', 'of', 'tasks', 'task', 'all', 'show', 'me'].includes(w));
  return f;
}
function matchQuery(t, f, ctx) {
  const td = today();
  if (f.status === 'late' && !isLate(t)) return false;
  if (f.status === 'blocked' && t.status !== 'blocked') return false;
  if (f.status === 'done' && !isClosed(t)) return false;
  if (f.status === 'hold' && t.status !== 'on_hold') return false;
  if (f.status === 'cancelled' && t.status !== 'cancelled') return false;
  if (f.status === 'nodate' && !needsDate(t)) return false;
  if (!['done', 'cancelled'].includes(f.status) && isClosed(t)) return false;
  if (!f.status && t.status === 'on_hold') return false;
  if (f.owner && t.owner_id !== f.owner) return false;
  if (f.dept && t.department_id !== f.dept) return false;
  if (f.list && t.task_list_id !== f.list) return false;
  if (f.prio && t.priority !== f.prio) return false;
  if (f.quiet && !isQuiet(t)) return false;
  if (f.when === 'today' && t.due_date !== td) return false;
  if (f.when === 'tomorrow' && t.due_date !== addDays(td, 1)) return false;
  if (f.when === 'week' && !(t.due_date && t.due_date >= weekStart() && t.due_date <= weekEnd())) return false;
  if (f.text.length) { const hay = `${t.title} ${t.notes || ''} ${t.last_update_body || ''}`.toLowerCase(); if (!f.text.every((w) => hay.includes(w))) return false; }
  return true;
}
function describeQuery(f, ctx) {
  const parts = [];
  if (f.owner) parts.push(ctx.person(f.owner)?.name);
  if (f.dept) parts.push(ctx.dept(f.dept)?.name);
  if (f.list) parts.push(ctx.list(f.list)?.name);
  if (f.status) parts.push({ late: 'late', blocked: 'blocked', done: 'done', nodate: 'needs date', hold: 'on hold', cancelled: 'cancelled' }[f.status]);
  if (f.prio) parts.push(PRI[f.prio]);
  if (f.quiet) parts.push('no update in 7 days');
  if (f.when) parts.push({ today: 'due today', tomorrow: 'due tomorrow', week: 'due this week' }[f.when]);
  if (f.text.length) parts.push(`“${f.text.join(' ')}”`);
  return parts.join(', ');
}
const pinsKey = () => 'bs_pins';
const loadPins = () => { try { return JSON.parse(localStorage.getItem(pinsKey()) || '[]'); } catch (_) { return []; } };
const savePins = (p) => { try { localStorage.setItem(pinsKey(), JSON.stringify(p)); } catch (_) {} };

/* ---------- app shell ---------- */
function parseHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith('task=')) return { task: h.slice(5) };
  const [view, q] = h.split('?');
  return { view: view || null, ...Object.fromEntries(new URLSearchParams(q || '')) };
}

function App() {
  const [session, setSession] = useState(undefined);
  const [me, setMe] = useState(null);
  const [data, setData] = useState(null);
  const [route, setRoute] = useState(parseHash());
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState(null);
  const [palette, setPalette] = useState(false);
  const [error, setError] = useState('');
  const [pins, setPins] = useState(loadPins());
  const [hint, setHint] = useState(null);
  const loadTimer = useRef();

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    const k = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); }
      else if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); setPalette(true); }
    };
    window.addEventListener('keydown', k);
    return () => { sub.subscription.unsubscribe(); window.removeEventListener('hashchange', onHash); window.removeEventListener('keydown', k); };
  }, []);

  async function load() {
    try {
      const since = new Date(Date.now() - 14 * 86400e3).toISOString();
      const [p, d, m, l, t, done, dcr] = await Promise.all([
        sb.from('people').select('*').eq('active', true).order('name'),
        sb.from('departments').select('*').eq('active', true).order('sort_order'),
        sb.from('department_members').select('*'),
        sb.from('task_lists').select('*').eq('active', true).order('name'),
        sb.from('v_tasks').select('*').not('status', 'in', '(done,cancelled)').limit(5000),
        sb.from('v_tasks').select('*').in('status', ['done', 'cancelled']).gte('completed_at', since).limit(2000),
        sb.from('date_change_requests').select('*').eq('status', 'pending'),
      ]);
      const err = [p, d, m, l, t, done, dcr].find((r) => r.error);
      if (err) throw err.error;
      setMe(p.data.find((x) => x.auth_user_id === session.user.id) ?? null);
      setData({ people: p.data, depts: d.data, members: m.data, lists: l.data, tasks: [...t.data, ...done.data], dcr: dcr.data });
      setError('');
    } catch (e) { setError(e.message || 'Could not load tasks.'); }
  }
  const softLoad = () => { clearTimeout(loadTimer.current); loadTimer.current = setTimeout(load, 700); };
  useEffect(() => {
    if (!session) return;
    load();
    const ch = sb.channel('live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, softLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_updates' }, softLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'date_change_requests' }, softLoad)
      .subscribe();
    const onFocus = () => softLoad();
    window.addEventListener('focus', onFocus);
    return () => { sb.removeChannel(ch); window.removeEventListener('focus', onFocus); };
  }, [session?.user?.id]);
  useEffect(() => { if (route.task && data) setSheet({ mode: 'edit', id: route.task }); }, [route.task, !!data]);

  if (session === undefined) return html`<p class="boot">Loading…</p>`;
  if (!session) return html`<${Login} />`;
  if (error && !data) return html`<div class="login"><div class="card"><h1>Could not load</h1><p class="err">${error}</p><button class="btn primary big" onClick=${load}>Try again</button></div></div>`;
  if (!data) return html`<p class="boot">Loading tasks…</p>`;
  if (!me) return html`<div class="login"><div class="card"><h1>No access yet</h1><p>${session.user.email} is not set up in BS Tasks. Ask Bhargav to add you.</p><button class="btn big" onClick=${() => sb.auth.signOut()}>Sign out</button></div></div>`;

  const ctx = makeCtx({ me, data, setData, load, setSheet, setToast, setPalette, pins, setPins, setHint });
  const isAdmin = me.role === 'admin';
  const view = route.view || (isAdmin ? 'overview' : 'mine');
  const closeSheet = () => { setSheet(null); if (location.hash.startsWith('#task=')) history.replaceState(null, '', '#' + view); };

  return html`
    <div class="shell">
      <${Sidebar} ctx=${ctx} view=${view} route=${route} />
      <div class="main">
        ${view === 'overview' && isAdmin ? html`<${Overview} ctx=${ctx} />` : ''}
        ${view === 'mine' || (view === 'overview' && !isAdmin) ? html`<${Mine} ctx=${ctx} />` : ''}
        ${view === 'dept' ? html`<${Dept} ctx=${ctx} route=${route} />` : ''}
        ${view === 'all' ? html`<${AllTasks} ctx=${ctx} route=${route} />` : ''}
      </div>
      <nav class="mtabs" aria-label="Main">
        ${[isAdmin && ['overview', 'Overview'], ['mine', 'Mine'], ['dept', 'Teams'], ['all', 'All']].filter(Boolean).map(([id, l]) => html`<a class="mtab" href=${'#' + id} aria-current=${view === id ? 'page' : null}>${I[id === 'dept' ? 'dept' : id]}${l}</a>`)}
        <button class="mtab" onClick=${() => setPalette(true)}>${I.search}Search</button>
      </nav>
      <${Composer} ctx=${ctx} deptHint=${view === 'dept' ? route.dept : null} listHint=${view === 'dept' ? route.list : null} />
      ${sheet ? html`<${TaskSheet} ctx=${ctx} sheet=${sheet} close=${closeSheet} />` : ''}
      ${palette ? html`<${Palette} ctx=${ctx} close=${() => setPalette(false)} />` : ''}
      ${hint ? html`<${Hints} key=${hint.key} ctx=${ctx} hint=${hint} done=${() => setHint(null)} />` : ''}
      ${toast ? html`<${Toast} toast=${toast} done=${() => setToast(null)} />` : ''}
    </div>`;
}

function makeCtx({ me, data, setData, load, setSheet, setToast, setPalette, pins, setPins, setHint }) {
  const { people, depts, members, lists, tasks, dcr } = data;
  const person = (id) => people.find((p) => p.id === id);
  const dept = (id) => depts.find((d) => d.id === id);
  const list = (id) => lists.find((l) => l.id === id);
  const deptColor = (id) => DCOL[(dept(id)?.sort_order ?? 1) - 1] || '#A0A4AB';
  const isAdmin = me.role === 'admin';
  const myDepts = members.filter((m) => m.person_id === me.id).map((m) => m.department_id);
  const headDepts = members.filter((m) => m.person_id === me.id && m.is_head).map((m) => m.department_id);
  const isHead = (d) => headDepts.includes(d);
  const canSeeStats = (pid) => isAdmin || pid === me.id || members.some((m) => m.person_id === pid && headDepts.includes(m.department_id));
  const canDecide = (t) => isAdmin || isHead(t.department_id) || t.created_by === me.id;
  const canRedate = (t) => isAdmin || isHead(t.department_id) || t.created_by === me.id;
  const canEdit = (t) => isAdmin || isHead(t.department_id) || t.owner_id === me.id || t.created_by === me.id;
  const canOwner = (t) => isAdmin || isHead(t.department_id) || t.created_by === me.id;
  const canManageLists = (d) => isAdmin || isHead(d);
  const open = () => tasks.filter((t) => !isClosed(t));
  const mine = () => tasks.filter((t) => t.owner_id === me.id);
  const ownerDept = (pid) => members.find((m) => m.person_id === pid)?.department_id;

  function patchLocal(ids, fields) { setData((d) => ({ ...d, tasks: d.tasks.map((t) => (ids.includes(t.id) ? { ...t, ...fields, updated_at: new Date().toISOString() } : t)) })); }
  async function update(ids, fields, msg, undoFields) {
    ids = [].concat(ids);
    patchLocal(ids, fields);
    const { error } = await sb.from('tasks').update(fields).in('id', ids);
    if (error) { setToast({ text: error.message }); load(); return false; }
    if (msg) setToast({ text: msg, undo: undoFields ? async () => { patchLocal(ids, undoFields); await sb.from('tasks').update(undoFields).in('id', ids); load(); } : null });
    return true;
  }
  const save = async (t, fields, onSaved) => { if (await update(t.id, fields, null)) onSaved?.(t.id); };
  const done = (t) => update(t.id, { status: 'done', completed_at: new Date().toISOString() }, 'Marked done', { status: t.status, completed_at: null });
  async function hold(t, reason) {
    if (reason) await sb.from('task_updates').insert({ task_id: t.id, author_id: me.id, body: `On hold: ${reason}` });
    await update(t.id, { status: 'on_hold' }, 'Put on hold', { status: t.status }); load();
  }
  async function cancel(t, reason) {
    if (!reason) { reason = (prompt(`Why cancel “${t.title}”?`) || '').trim(); if (!reason) return; }
    await sb.from('task_updates').insert({ task_id: t.id, author_id: me.id, body: `Cancelled: ${reason}` });
    await update(t.id, { status: 'cancelled', completed_at: new Date().toISOString() }, 'Cancelled', { status: t.status, completed_at: null }); load();
  }
  const reopen = (t) => update(t.id, { status: 'open', completed_at: null }, 'Reopened');

  function needsYou() {
    if (!isAdmin) return [];
    const td = today(); const out = [];
    for (const r of dcr) {
      const t = tasks.find((x) => x.id === r.task_id);
      if (t) out.push({ key: 'd' + r.id, kind: 'Date change', t, title: `${t.title} → ${shortDue(r.proposed_due)}`, who: `${first(person(r.requested_by)?.name)}, ${dept(t.department_id)?.name}${t.slip_count ? `, moved ${t.slip_count}× already` : ''}`, req: r });
    }
    for (const t of open()) {
      if (t.status === 'on_hold') continue;
      const who = `${first(person(t.owner_id)?.name)}, ${dept(t.department_id)?.name}`;
      if (t.owner_id === me.id && t.request_status === 'pending') out.push({ key: 'r' + t.id, kind: 'Request', t, title: t.title, who: `From ${first(person(t.created_by)?.name)}`, request: true });
      else if (t.status === 'blocked' && diff(t.updated_at.slice(0, 10), td) >= 3) out.push({ key: 'b' + t.id, kind: 'Blocked', t, title: t.title, who: t.blocked_on_person_id ? `Waiting on ${first(person(t.blocked_on_person_id)?.name)}, ${diff(t.updated_at.slice(0, 10), td)}d` : who });
      else if (t.priority === 'P1' && isLate(t)) out.push({ key: 'l' + t.id, kind: 'Urgent, late', t, title: t.title, who });
      else if (t.slip_count >= 2) out.push({ key: 's' + t.id, kind: `Moved ${t.slip_count}×`, t, title: t.title, who });
      else if (!t.acknowledged_at && t.owner_id !== t.created_by && t.due_date && diff(t.created_at.slice(0, 10), td) >= 1) out.push({ key: 'a' + t.id, kind: 'Not seen', t, title: t.title, who });
      else if (t.due_date && ['P1', 'P2'].includes(t.priority) && isQuiet(t)) out.push({ key: 'q' + t.id, kind: 'Quiet', t, title: t.title, who: `${who}, ${diff((t.last_update_at || t.created_at).slice(0, 10), td)}d` });
    }
    return out;
  }
  async function decideDate(req, approve) {
    const { error } = await sb.rpc('decide_date_change', { req: req.id, approve });
    if (error) return setToast({ text: error.message });
    setToast({ text: approve ? 'Date change approved' : 'Date change rejected' }); load();
  }
  async function approveOther(req, date) {
    if (!(await update(req.task_id, { due_date: date }, null))) return;
    await sb.from('date_change_requests').update({ status: 'approved', proposed_due: date, decided_by: me.id, decided_at: new Date().toISOString() }).eq('id', req.id);
    setToast({ text: `Moved to ${fmtDate(date)}` }); load();
  }
  async function decideRequest(t, accept, note) {
    await update(t.id, accept ? { request_status: 'accepted', acknowledged_at: new Date().toISOString() } : { request_status: 'declined', request_note: note || null, status: 'done' }, accept ? 'Accepted' : 'Declined');
  }
  async function nudge(t, kind, target) {
    setToast({ text: 'Sending…' });
    const { data: r, error } = await sb.functions.invoke('nudge', { body: { task_id: t.id, kind, target } });
    if (error || r?.error) return setToast({ text: r?.error || 'Could not send. Try again.' });
    setToast({ text: kind === 'ask' ? `Asked ${first(r.to)} for an update` : `Nudged ${first(r.to)}` });
  }
  async function createList(deptId) {
    const name = (prompt('Name of the new task list') || '').trim();
    if (!name) return null;
    const { data: row, error } = await sb.from('task_lists').insert({ department_id: deptId, name }).select().single();
    if (error) { setToast({ text: error.code === '23505' ? 'A list with that name already exists' : error.message }); return null; }
    setData((d) => ({ ...d, lists: [...d.lists, row].sort((a, b) => a.name.localeCompare(b.name)) }));
    setToast({ text: `List “${name}” created` });
    return row.id;
  }
  async function moveTo(ids, fields, label) {
    const ok = ids.filter((id) => { const t = tasks.find((x) => x.id === id); return t && canEdit(t) && (!('due_date' in fields) || canRedate(t)) && (!('department_id' in fields) || isAdmin || isHead(t.department_id)); });
    if (!ok.length) return setToast({ text: 'You can’t move that task.' });
    await update(ok, fields, label);
  }
  async function moveList(l, d) {
    const { error } = await sb.rpc('move_list', { l: l.id, d });
    if (error) return setToast({ text: error.message });
    setToast({ text: `“${l.name}” and its tasks moved to ${dept(d)?.name}` }); load();
    location.hash = `dept?dept=${d}&list=${l.id}`;
  }
  async function renameList(l) {
    const name = (prompt('Rename list', l.name) || '').trim();
    if (!name || name === l.name) return;
    const { error } = await sb.from('task_lists').update({ name }).eq('id', l.id);
    if (error) return setToast({ text: error.code === '23505' ? 'A list with that name already exists' : error.message });
    setToast({ text: 'List renamed' }); load();
  }
  async function deleteList(l) {
    const n = tasks.filter((t) => t.task_list_id === l.id).length;
    if (!confirm(`Delete the list “${l.name}”?${n ? ` Its ${n} tasks stay in the department under No list.` : ''}`)) return;
    const { error } = await sb.from('task_lists').delete().eq('id', l.id);
    if (error) return setToast({ text: error.message });
    setToast({ text: 'List deleted' }); load();
    if (location.hash.includes(l.id)) location.hash = 'dept?dept=' + l.department_id;
  }
  async function readUpdate(t, text) {
    if (!text || text.length < 12 || t.is_private) return;
    const r = await aiCall('read_update', { task_id: t.id, text });
    if (r && !r.error && (r.done || r.blocked || r.new_date || r.new_tasks?.length)) setHint({ key: Date.now(), t: tasks.find((x) => x.id === t.id) || t, r });
  }
  const addPin = (name, query) => { const p = [...pins.filter((x) => x.name !== name), { name, query }]; setPins(p); savePins(p); };
  const removePin = (name) => { const p = pins.filter((x) => x.name !== name); setPins(p); savePins(p); };

  return { me, data, people, depts, members, lists, tasks, dcr, person, dept, list, deptColor, isAdmin, myDepts, headDepts, isHead, canSeeStats, canDecide, canRedate, canEdit, canOwner, canManageLists,
    open, mine, ownerDept, update, save, done, reopen, hold, cancel, needsYou, decideDate, approveOther, decideRequest, nudge, readUpdate, createList, moveList, renameList, deleteList, moveTo, load, setToast, setSheet, setPalette,
    openTask: (t) => setSheet({ mode: 'edit', id: t.id }),
    newTask: (p = {}) => { const ov = {}; if (p.department_id) ov.department_id = p.department_id; if (p.task_list_id) ov.task_list_id = p.task_list_id; if (p.owner_id) ov.owner_id = p.owner_id; document.dispatchEvent(new CustomEvent('bs-compose', { detail: { ov } })); }, pins, addPin, removePin };
}

function Login() {
  const [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, queryParams: { hd: DOMAIN, prompt: 'select_account' } } }); };
  return html`<div class="login"><div class="card">
    <h1><span class="logo">${I.check}</span>BS Tasks</h1>
    <p class="note">Sign in with your ${DOMAIN} Google account.</p>
    <button class="btn primary big" disabled=${busy} onClick=${go}>${busy ? 'Opening Google…' : 'Sign in with Google'}</button>
  </div></div>`;
}

/* ---------- sidebar with department → list tree, pins, drop targets ---------- */
function useDrop(onDrop, onList) {
  const [over, setOver] = useState(false);
  return [over, {
    onDragOver: (e) => { const ty = e.dataTransfer.types; if (ty.includes('text/bs-task') || (onList && ty.includes('text/bs-list'))) { e.preventDefault(); setOver(true); } },
    onDragLeave: () => setOver(false),
    onDrop: (e) => {
      e.preventDefault(); setOver(false);
      const lid = e.dataTransfer.getData('text/bs-list');
      if (lid && onList) return onList(lid);
      const ids = (e.dataTransfer.getData('text/bs-task') || '').split(',').filter(Boolean); if (ids.length) onDrop(ids);
    },
  }];
}
function SideDept({ ctx, d, route, view, open, setOpen }) {
  const activeDept = view === 'dept' && route.dept === d.id;
  useEffect(() => { if (activeDept && !open) setOpen(true); }, [activeDept]);
  const openTasks = ctx.open().filter((t) => t.department_id === d.id && isActive(t));
  const lists = ctx.lists.filter((l) => l.department_id === d.id).map((l) => ({ ...l, n: openTasks.filter((t) => t.task_list_id === l.id).length })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  const [over, dropProps] = useDrop((ids) => ctx.moveTo(ids, { department_id: d.id, task_list_id: null }, `Moved to ${d.name}`), (lid) => { const l = ctx.list(lid); if (l && l.department_id !== d.id && confirm(`Move the list “${l.name}” and all its tasks to ${d.name}?`)) ctx.moveList(l, d.id); });
  return html`<div>
    <a class=${'nl' + (over ? ' drop' : '')} href=${'#dept?dept=' + d.id} aria-current=${activeDept && !route.list ? 'page' : null} ...${dropProps}>
      <span role="button" tabindex="0" aria-label=${open ? 'Collapse lists' : 'Show lists'} aria-expanded=${open} class=${'caret' + (open ? ' open' : '')} style="display:inline-flex;width:12px;height:12px;color:var(--faint)" onClick=${(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}>${I.caret}</span>
      <span class="ddot" style=${'background:' + ctx.deptColor(d.id)}></span><span>${d.name}</span><span class="c">${openTasks.length}</span>
    </a>
    ${open ? html`${lists.map((l) => html`<${SideList} ctx=${ctx} d=${d} l=${l} active=${activeDept && route.list === l.id} />`)}
      ${ctx.canManageLists(d.id) ? html`<button class="nl sub" style="color:var(--faint)" onClick=${async () => { const id = await ctx.createList(d.id); if (id) location.hash = `dept?dept=${d.id}&list=${id}`; }}>+ New list</button>` : ''}` : ''}
  </div>`;
}
function SideList({ ctx, d, l, active }) {
  const [over, dropProps] = useDrop((ids) => ctx.moveTo(ids, { task_list_id: l.id, department_id: d.id }, `Moved to ${l.name}`));
  const can = ctx.canManageLists(d.id);
  return html`<div class="slrow">
    <a class=${'nl sub' + (over ? ' drop' : '')} href=${`#dept?dept=${d.id}&list=${l.id}`} aria-current=${active ? 'page' : null} draggable=${can}
      onDragStart=${(e) => { e.dataTransfer.setData('text/bs-list', l.id); e.dataTransfer.effectAllowed = 'move'; }} ...${dropProps}><${LIcon} name=${l.name} sm />${l.name}<span class="c">${l.n || ''}</span></a>
    ${can ? html`<${ListMenu} ctx=${ctx} l=${l} />` : ''}
  </div>`;
}
function ListMenu({ ctx, l }) {
  const [open, setOpen, ref] = usePop();
  const [moving, setMoving] = useState(false);
  const targets = ctx.depts.filter((x) => x.id !== l.department_id && (ctx.isAdmin || ctx.isHead(x.id)));
  return html`<span class="anchor lmenu" ref=${ref}>
    <button class="iconbtn" aria-label=${'Options for ' + l.name} onClick=${(e) => { e.preventDefault(); setOpen(!open); setMoving(false); }}>⋯</button>
    ${open ? html`<div class="pop" style="right:0;left:auto;min-width:230px">${!moving ? html`
      <button class="opt" onClick=${() => { setOpen(false); ctx.renameList(l); }}>Rename</button>
      ${targets.length ? html`<button class="opt" onClick=${() => setMoving(true)}>Move to another department<span class="r">›</span></button>` : ''}
      <button class="opt" style="color:var(--late)" onClick=${() => { setOpen(false); ctx.deleteList(l); }}>Delete list</button>`
    : html`<span class="note" style="padding:4px 8px">Move “${l.name}” and its tasks to:</span>
      <div class="opts">${targets.map((x) => html`<button class="opt" onClick=${() => { setOpen(false); ctx.moveList(l, x.id); }}><span class="ddot" style=${'background:' + ctx.deptColor(x.id)}></span>${x.name}</button>`)}</div>`}
    </div>` : ''}
  </span>`;
}
function Sidebar({ ctx, view, route }) {
  const isAdmin = ctx.isAdmin;
  const [openMap, setOpenMap] = useState(() => { try { return JSON.parse(localStorage.getItem('bs_side_open') || '{}'); } catch (_) { return {}; } });
  const setOpenMapP = (m) => { setOpenMap(m); try { localStorage.setItem('bs_side_open', JSON.stringify(m)); } catch (_) {} };
  const myDepts = isAdmin ? ctx.depts : ctx.depts.filter((d) => ctx.myDepts.includes(d.id));
  const nav = [
    isAdmin && ['overview', 'Overview', ctx.needsYou().length],
    ['mine', 'My tasks', ctx.mine().filter(isActive).length],
    (isAdmin || ctx.headDepts.length) && ['all', 'All tasks', ctx.open().filter(isActive).length],
  ].filter(Boolean);
  return html`<nav class="side" aria-label="Main">
    <div class="brand"><span class="logo">${I.check}</span>BS Tasks</div>
    <button class="searchbtn" onClick=${() => ctx.setPalette(true)}>${I.search}Search or jump to<kbd>⌘K</kbd></button>
    ${nav.map(([id, l, n]) => html`<a class="nl" href=${'#' + id} aria-current=${view === id && !route.pin ? 'page' : null}><span class="ic">${I[id]}</span>${l}<span class="c">${n}</span></a>`)}
    ${ctx.pins.length ? html`<div class="sidelabel">Pinned</div>${ctx.pins.map((p) => html`<a class="nl" href=${'#all?pin=' + encodeURIComponent(p.name) + '&q=' + encodeURIComponent(p.query)} aria-current=${route.pin === p.name ? 'page' : null}><span class="ic">${I.pin}</span>${p.name}<span class="c">${ctx.tasks.filter((t) => matchQuery(t, parseQuery(p.query, ctx), ctx)).length}</span></a>`)}` : ''}
    <div class="sidelabel">${isAdmin ? 'Departments' : 'My departments'}
      <span class="sidetools"><button class="linkbtn" onClick=${() => setOpenMapP(Object.fromEntries(myDepts.map((d) => [d.id, true])))}>Expand</button><button class="linkbtn" onClick=${() => setOpenMapP({})}>Collapse</button></span></div>
    ${myDepts.map((d) => html`<${SideDept} key=${d.id} ctx=${ctx} d=${d} route=${route} view=${view} open=${!!openMap[d.id]} setOpen=${(v) => setOpenMapP({ ...openMap, [d.id]: v })} />`)}
    <div class="grow"></div>
    <div class="who"><span>${ctx.me.name}</span><button class="linkbtn" style="font-size:12.5px" onClick=${() => sb.auth.signOut()}>Sign out</button></div>
  </nav>`;
}

/* ---------- command bar ---------- */
function Palette({ ctx, close }) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const [ans, setAns] = useState(null);
  const [brief, setBrief] = useState(null);
  async function ask(question) {
    setAns({ loading: true, question });
    const r = await aiCall('ask', { question });
    setAns(r.error ? { error: r.error, question } : { question, answer: r.answer, tasks: (r.task_ids || []).map((id) => ctx.tasks.find((t) => t.id === id)).filter(Boolean) });
  }
  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    const out = [];
    if (s && looksLikeQuestion(q)) out.push({ k: 'Ask AI', label: q, hint: 'Enter', keep: true, run: () => ask(q) });
    if (s) {
      const f = parseQuery(q, ctx);
      const hits = ctx.tasks.filter((t) => matchQuery(t, f, ctx));
      const desc = describeQuery(f, ctx);
      if (desc && (hits.length || !looksLikeQuestion(q))) out.push({ k: 'Filter', label: `${desc}`, hint: `${hits.length} tasks`, run: () => { location.hash = 'all?q=' + encodeURIComponent(q); } });
      if (ctx.isAdmin && hits.length && hits.length <= 20 && (f.status === 'late' || f.quiet)) out.push({ k: 'Action', label: `${f.quiet ? 'Ask for updates on' : 'Nudge owners of'} these ${hits.length} tasks`, run: async () => { for (const t of hits) await ctx.nudge(t, f.quiet ? 'ask' : 'nudge'); } });
      ctx.tasks.filter((t) => t.title.toLowerCase().includes(s)).slice(0, 6).forEach((t) => out.push({ k: 'Task', label: t.title, hint: `${first(ctx.person(t.owner_id)?.name)}, ${shortDue(t.due_date)}`, run: () => ctx.openTask(t) }));
      ctx.people.filter((p) => p.name.toLowerCase().includes(s)).slice(0, 4).forEach((p) => { out.push({ k: 'Person', label: p.name, hint: 'Show their tasks', run: () => { location.hash = 'all?q=' + encodeURIComponent(p.name); } }); if (ctx.isAdmin && p.id !== ctx.me.id) out.push({ k: 'Prep', label: `1:1 brief with ${first(p.name)}`, keep: true, run: () => setBrief(p.id) }); });
      ctx.depts.filter((d) => d.name.toLowerCase().includes(s)).slice(0, 3).forEach((d) => out.push({ k: 'Go to', label: d.name, run: () => { location.hash = 'dept?dept=' + d.id; } }));
      ctx.lists.filter((l) => l.name.toLowerCase().includes(s)).slice(0, 4).forEach((l) => out.push({ k: 'List', label: l.name, hint: ctx.dept(l.department_id)?.name, run: () => { location.hash = `dept?dept=${l.department_id}&list=${l.id}`; } }));
      out.push({ k: 'Create', label: `New task: ${q}`, run: () => document.dispatchEvent(new CustomEvent('bs-compose', { detail: q })) });
    } else {
      out.push({ k: 'Try', label: 'What is pending with Narendra on Swiggy?', run: () => setQ('What is pending with Narendra on Swiggy?') });
      out.push({ k: 'Try', label: 'vivek late urgent', run: () => setQ('vivek late urgent') });
      out.push({ k: 'Try', label: 'franchise sales due this week', run: () => setQ('franchise sales due this week') });
      out.push({ k: 'Try', label: 'no update offline revenue', run: () => setQ('no update offline revenue') });
      ctx.depts.slice(0, 6).forEach((d) => out.push({ k: 'Go to', label: d.name, run: () => { location.hash = 'dept?dept=' + d.id; } }));
    }
    return out;
  }, [q]);
  useEffect(() => { setI(0); setAns(null); }, [q]);
  const run = (it) => { if (!it) return; if (it.k !== 'Try' && !it.keep) close(); it.run(); };
  if (brief) return html`<${BriefSheet} ctx=${ctx} personId=${brief} close=${close} />`;
  return html`<div class="palette-scrim" onClick=${close}><div class="palette" role="dialog" aria-modal="true" aria-label="Search and commands" onClick=${(e) => e.stopPropagation()}>
    <div class="in">${I.search}<input autofocus ref=${(el) => el && setTimeout(() => el.focus(), 0)} placeholder="Search tasks, people, lists, or type a filter like “vivek late urgent”" value=${q} aria-label="Search"
      onInput=${(e) => setQ(e.target.value)}
      onKeyDown=${(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setI(Math.min(i + 1, items.length - 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setI(Math.max(i - 1, 0)); } else if (e.key === 'Enter') { e.preventDefault(); run(items[i]); } else if (e.key === 'Escape') close(); }} /><kbd>Esc</kbd></div>
    ${ans ? html`<div class="answer">${ans.loading ? html`<span class="muted">${I.spark} Thinking about “${ans.question}”…</span>` : ans.error ? html`<span class="err">${ans.error}</span>` : html`<div class="a">${I.spark} ${ans.answer}</div>
      ${ans.tasks.map((t) => html`<button class="it" onClick=${() => { close(); ctx.openTask(t); }}><span class="k">${first(ctx.person(t.owner_id)?.name)}</span><span>${t.title}</span><span class="h">${t.status === 'done' ? 'Done' : shortDue(t.due_date)}</span></button>`)}`}</div>` : ''}
    <div class="res" role="listbox">${items.map((it, n) => html`<button class="it" role="option" aria-selected=${n === i} onMouseEnter=${() => setI(n)} onClick=${() => run(it)}><span class="k">${it.k}</span><span>${it.label}</span>${it.hint ? html`<span class="h">${it.hint}</span>` : ''}</button>`)}</div>
    <div class="foot">Type words like late, urgent, this week, a name or a list to filter, or ask a question ending in ? for an AI answer.</div>
  </div></div>`;
}

function Toast({ toast, done }) {
  useEffect(() => { const tm = setTimeout(done, toast.undo || toast.action ? 6000 : 2600); return () => clearTimeout(tm); }, [toast]);
  return html`<div class="toast" role="status">${toast.text}${toast.action ? html`<button onClick=${() => { toast.action.fn(); done(); }}>${toast.action.label}</button>` : ''}${toast.undo ? html`<button onClick=${() => { toast.undo(); done(); }}>Undo</button>` : ''}</div>`;
}

/* ---------- priority slider ---------- */
const PORDER = ['P3', 'P2', 'P1'];
const PTHUMB = { P1: 'var(--p1)', P2: 'var(--ink)', P3: 'var(--faint)' };
function PrioritySlider({ value, onChange, disabled, inPanel, always }) {
  const ref = useRef();
  const [drag, setDrag] = useState(null);
  const cur = drag ?? value;
  const idx = PORDER.indexOf(cur);
  const pick = (clientX) => { const r = ref.current.getBoundingClientRect(); const n = Math.max(0, Math.min(2, Math.floor(((clientX - r.left) / r.width) * 3))); return PORDER[n]; };
  const down = (e) => { if (disabled) return; e.preventDefault(); ref.current.setPointerCapture?.(e.pointerId); setDrag(pick(e.clientX)); };
  const move = (e) => { if (drag !== null) setDrag(pick(e.clientX)); };
  const up = () => { if (drag !== null) { const v = drag; setDrag(null); if (v !== value) onChange(v); } };
  const key = (e) => {
    if (disabled) return;
    const i = Math.max(0, PORDER.indexOf(value));
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(PORDER[Math.min(2, value ? i + 1 : 1)]); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(PORDER[Math.max(0, value ? i - 1 : 1)]); }
    if (['1', '2', '3'].includes(e.key)) { e.preventDefault(); onChange('P' + e.key); }
  };
  return html`<div ref=${ref} class=${'slider' + (inPanel ? ' inpanel' : '') + (always ? ' always' : '') + (disabled ? ' disabled' : '')} role="slider" tabindex=${disabled ? -1 : 0}
    aria-label="Priority" aria-valuemin="1" aria-valuemax="3" aria-valuenow=${idx + 1} aria-valuetext=${cur ? PRI[cur] : 'Not set'}
    onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${() => setDrag(null)} onKeyDown=${key}>
    ${cur ? html`<span class="thumb" style=${`left:calc(${idx * 33.33}% + 2px);background:${PTHUMB[cur]}`}></span>` : ''}
    ${PORDER.map((p) => html`<span class=${'seg' + (cur === p ? ' on' + (p === 'P2' ? ' p2' : '') : '')}>${PRI[p]}</span>`)}
  </div>`;
}
const SORDER = ['open', 'blocked', 'on_hold', 'done'];
const SLABEL = { open: 'In progress', blocked: 'Blocked', on_hold: 'On hold', done: 'Done' };
const STHUMB = { open: 'var(--ink)', blocked: 'var(--late)', on_hold: 'var(--faint)', done: 'var(--done)' };
function StatusSlider({ value, onChange }) {
  const ref = useRef();
  const [drag, setDrag] = useState(null);
  const cur = drag ?? value;
  const idx = SORDER.indexOf(cur);
  const pick = (x) => { const r = ref.current.getBoundingClientRect(); return SORDER[Math.max(0, Math.min(3, Math.floor(((x - r.left) / r.width) * 4)))]; };
  return html`<div ref=${ref} class="slider inpanel status" style="grid-template-columns:repeat(4,1fr)" role="slider" tabindex="0" aria-label="Status" aria-valuemin="1" aria-valuemax="4" aria-valuenow=${idx + 1} aria-valuetext=${SLABEL[cur]}
    onPointerDown=${(e) => { e.preventDefault(); ref.current.setPointerCapture?.(e.pointerId); setDrag(pick(e.clientX)); }}
    onPointerMove=${(e) => drag !== null && setDrag(pick(e.clientX))}
    onPointerUp=${() => { if (drag !== null) { onChange(drag); setDrag(null); } }}
    onKeyDown=${(e) => { const i = SORDER.indexOf(value); if (e.key === 'ArrowRight') { e.preventDefault(); onChange(SORDER[Math.min(3, i + 1)]); } if (e.key === 'ArrowLeft') { e.preventDefault(); onChange(SORDER[Math.max(0, i - 1)]); } }}>
    <span class="thumb" style=${`left:calc(${Math.max(0, idx) * 25}% + 2px);width:calc(25% - 4px);background:${STHUMB[cur] || 'var(--ink)'}`}></span>
    ${SORDER.map((v) => html`<span class=${'seg' + (cur === v ? ' on' + (v === 'open' ? ' p2' : '') : '')}>${SLABEL[v]}</span>`)}
  </div>`;
}
function QuickUpdate({ ctx, t, close }) {
  const [status, setStatus] = useState(SORDER.includes(t.status) ? t.status : 'open');
  const [text, setText] = useState('');
  const [on, setOn] = useState(t.blocked_on_person_id || '');
  const [busy, setBusy] = useState(false);
  const inRef = useRef();
  useEffect(() => { setTimeout(() => inRef.current?.focus(), 0); }, []);
  async function post() {
    const body = text.trim();
    if (status === t.status && !body) return close();
    if (status === 'blocked' && !body && t.status !== 'blocked') { inRef.current?.focus(); return ctx.setToast({ text: 'Say what it is waiting on' }); }
    setBusy(true);
    if (body) {
      const { error } = await sb.from('task_updates').insert({ task_id: t.id, author_id: ctx.me.id, body });
      if (error) { setBusy(false); return ctx.setToast({ text: error.message }); }
      delete peekCache[t.id];
    }
    if (status !== t.status || (status === 'blocked' && (body || on !== (t.blocked_on_person_id || '')))) {
      const fields = status === 'done' ? { status: 'done', completed_at: new Date().toISOString() }
        : status === 'blocked' ? { status: 'blocked', blocked_reason: body || t.blocked_reason, blocked_on_person_id: on || null, completed_at: null }
        : status === 'on_hold' ? { status: 'on_hold', completed_at: null }
        : { status: 'open', completed_at: null };
      await ctx.update(t.id, fields, null);
    }
    setBusy(false); close();
    if (body && status === t.status) ctx.readUpdate(t, body);
    ctx.setToast({ text: status === 'done' ? 'Marked done' + (body ? ' with update' : '') : status === 'blocked' ? 'Marked blocked' : status === 'on_hold' ? 'Put on hold' : body ? 'Update posted' : 'Status changed' });
    ctx.load();
  }
  const ph = status === 'blocked' ? 'What is it waiting on?' : status === 'done' ? 'Closing note (optional)' : status === 'on_hold' ? 'Why on hold? (optional)' : 'What’s the latest? e.g. “Draft shared with Aviral, final by Fri”';
  return html`<div class="qupd" onKeyDown=${(e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}>
    <${StatusSlider} value=${status} onChange=${setStatus} />
    <input ref=${inRef} class="field" aria-label="Update" placeholder=${ph} value=${text} onInput=${(e) => setText(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && !busy && post()} />
    ${status === 'blocked' ? html`<select class="field on" aria-label="Waiting on" value=${on} onChange=${(e) => setOn(e.target.value)}><option value="">Waiting on…</option>${ctx.people.map((p) => html`<option value=${p.id} selected=${on === p.id}>${p.name}</option>`)}</select>` : ''}
    <button class="btn primary" disabled=${busy} onClick=${post}>Post</button>
    <button class="btn ghost" onClick=${close}>Esc</button>
    <button class="btn ghost cancelbtn" onClick=${async () => { const r = text.trim() || (prompt(`Why cancel “${t.title}”?`) || '').trim(); if (!r) return; close(); await ctx.cancel(t, r); }}>Cancel task</button>
    ${t.last_update_body ? html`<span class="last">Last: “${t.last_update_body.slice(0, 80)}${t.last_update_body.length > 80 ? '…' : ''}” ${first(ctx.person(t.last_update_author)?.name)}, ${ago(t.last_update_at)}</span>` : ''}
  </div>`;
}
function Prio({ ctx, t, onSaved }) {
  const [open, setOpen] = useState(false);
  const can = ctx.canEdit(t);
  const set = (p) => { setOpen(false); ctx.save(t, { priority: p }, onSaved); };
  return html`<div class=${'prio' + (open ? ' open' : '')} onMouseLeave=${() => setOpen(false)}>
    <button class=${'plabel ' + (t.priority || 'none')} disabled=${!can} onClick=${() => setOpen(true)} aria-label=${'Priority: ' + (t.priority ? PRI[t.priority] : 'not set') + '. Change'}>${t.priority ? PRI[t.priority] : 'Priority'}</button>
    <${PrioritySlider} value=${t.priority} disabled=${!can} onChange=${set} />
  </div>`;
}

/* ---------- date chip ---------- */
function DateChip({ ctx, t, onSaved }) {
  const [open, setOpen, ref] = usePop();
  const [txt, setTxt] = useState('');
  const can = ctx.canEdit(t) && ctx.canRedate(t);
  const td = today();
  const set = (d) => { setOpen(false); setTxt(''); if (d && d !== t.due_date) ctx.save(t, { due_date: d }, onSaved); };
  const quick = [['Today', td], ['Tomorrow', addDays(td, 1)], ['Fri', parseQuick('fri')], ['Mon', nextDow(0)], ['+1 week', addDays(td, 7)]];
  const guess = parseQuick(txt);
  return html`<span class="anchor" ref=${ref}>
    <button class=${'datec' + (isLate(t) ? ' late' : t.due_date ? '' : ' empty')} onClick=${() => (can ? setOpen(!open) : ctx.openTask(t))} title=${can ? 'Change deadline' : 'Ask the assigner for a new date'}>${I.cal}${t.status === 'done' ? 'Done' : t.status === 'cancelled' ? 'Cancelled' : t.status === 'on_hold' ? 'On hold' : shortDue(t.due_date)}</button>
    ${open ? html`<div class="pop" role="dialog" aria-label="Deadline">
      <input class="field" placeholder="Type: fri, +7, 12 nov" value=${txt} aria-label="Type a date" onInput=${(e) => setTxt(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter' && guess) set(guess); }} />
      ${txt ? html`<p class="note">${guess ? `Enter for ${fmtDate(guess)}` : 'Try fri, +7, 12 nov'}</p>` : ''}
      <div class="qchips">${quick.map(([l, d]) => html`<button class="qchip" aria-pressed=${t.due_date === d} onClick=${() => set(d)}>${l}</button>`)}</div>
      <input type="date" class="field" aria-label="Pick a date" value=${t.due_date || ''} onChange=${(e) => set(e.target.value)} />
    </div>` : ''}</span>`;
}

/* ---------- owner avatar ---------- */
function Avatar({ ctx, id, size }) {
  const p = ctx.person(id);
  return html`<span class="who-av" title=${p?.name} style=${`background:${avColor(id)}${size ? `;width:${size}px;height:${size}px;border-radius:${size / 2}px` : ''}`}>${initials(p?.name || '?')}</span>`;
}
function OwnerPick({ ctx, t, onSaved }) {
  const [open, setOpen, ref] = usePop();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const can = ctx.canOwner(t);
  const opts = ctx.people.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 40);
  const pick = (p) => { setOpen(false); setQ(''); setI(0); if (p && p.id !== t.owner_id) ctx.save(t, { owner_id: p.id, acknowledged_at: p.id === ctx.me.id ? new Date().toISOString() : null }, onSaved); };
  const p = ctx.person(t.owner_id);
  return html`<span class="anchor" ref=${ref}>
    <button class="who-av" style=${'background:' + avColor(t.owner_id)} disabled=${!can} title=${(p?.name || 'Unassigned') + (can ? ', change owner' : '')} aria-label=${'Owner ' + (p?.name || 'unassigned')} onClick=${() => setOpen(!open)}>${initials(p?.name || '?')}</button>
    ${open ? html`<div class="pop" role="dialog" aria-label="Owner">
      <input class="field" placeholder="Assign to…" value=${q} aria-label="Search people" onInput=${(e) => { setQ(e.target.value); setI(0); }}
        onKeyDown=${(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setI(Math.min(i + 1, opts.length - 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setI(Math.max(i - 1, 0)); } else if (e.key === 'Enter') pick(opts[i]); }} />
      <div class="opts" role="listbox">${opts.map((pp, n) => html`<button class="opt" role="option" aria-selected=${n === i} onClick=${() => pick(pp)}><${Avatar} ctx=${ctx} id=${pp.id} size=${22} />${pp.name}<span class="r">${ctx.dept(ctx.ownerDept(pp.id))?.name || ''}</span></button>`)}</div>
    </div>` : ''}</span>`;
}

/* ---------- hover preview ---------- */
const peekCache = {};
function Peek({ ctx, t }) {
  const [ups, setUps] = useState(peekCache[t.id]);
  useEffect(() => { if (!ups) sb.from('task_updates').select('body,created_at,author_id').eq('task_id', t.id).order('created_at', { ascending: false }).limit(2).then(({ data }) => { peekCache[t.id] = data || []; setUps(data || []); }); }, []);
  return html`<div class="peek" role="tooltip">
    <div><b style="font-weight:600">${t.title}</b></div>
    <div class="m">${ctx.person(t.owner_id)?.name}, ${ctx.dept(t.department_id)?.name}${t.task_list_id ? `, ${ctx.list(t.task_list_id)?.name}` : ''}${t.due_date ? `, due ${fmtDate(t.due_date)}` : ''}${t.slip_count ? `, moved ${t.slip_count}×` : ''}</div>
    ${t.status === 'blocked' && t.blocked_reason ? html`<div class="m">Blocked: ${t.blocked_reason}</div>` : ''}
    ${ups === undefined ? html`<div class="m">Loading updates…</div>` : ups.length ? ups.map((u) => html`<div class="u"><b>${first(ctx.person(u.author_id)?.name)}</b> <span class="m">${ago(u.created_at)}</span><div>${u.body}</div></div>`) : html`<div class="m">No updates yet.</div>`}
    ${t.notes && !t.notes.startsWith('Zoho priority') ? html`<div class="m">${t.notes.slice(0, 160)}</div>` : ''}
  </div>`;
}

/* ---------- task row ---------- */
function TRow({ ctx, t, sel, toggle, selecting, showList = true, showDept = false, dragIds }) {
  const [peek, setPeek] = useState(false);
  const [qu, setQu] = useState(false);
  const timer = useRef();
  const can = ctx.canEdit(t);
  const tags = [];
  if (showDept) tags.push(html`<span class="tag quiet"><span class="ddot" style=${'display:inline-block;margin-right:5px;background:' + ctx.deptColor(t.department_id)}></span>${ctx.dept(t.department_id)?.name}</span>`);
  if (showList && t.task_list_id) tags.push(html`<span class="tag">${ctx.list(t.task_list_id)?.name}</span>`);
  if (t.status === 'blocked') tags.push(html`<span class="tag warn">Blocked${t.blocked_on_person_id ? ` on ${first(ctx.person(t.blocked_on_person_id)?.name)}` : ''}</span>`);
  if (t.status === 'on_hold') tags.push(html`<span class="tag">On hold</span>`);
  if (t.status === 'cancelled') tags.push(html`<span class="tag">Cancelled</span>`);
  if (t.slip_count >= 2) tags.push(html`<span class="tag warn">Moved ${t.slip_count}×</span>`);
  if (!t.acknowledged_at && t.owner_id === ctx.me.id) tags.push(html`<span class="tag info">New</span>`);
  if (t.request_status === 'pending') tags.push(html`<span class="tag info">Request</span>`);
  if (t.from_department_id) tags.push(html`<span class="tag info">From ${ctx.dept(t.from_department_id)?.name}</span>`);
  if (t.is_private) tags.push(html`<span class="tag quiet">Private</span>`);
  const dragStart = (e) => { const ids = dragIds?.(t.id) || [t.id]; e.dataTransfer.setData('text/bs-task', ids.join(',')); e.dataTransfer.effectAllowed = 'move'; e.currentTarget.classList.add('dragging'); };
  return html`<div class=${'trow' + (sel ? ' sel' : '') + (isClosed(t) ? ' isdone' : '') + (t.status === 'on_hold' ? ' held' : '') + (qu ? ' open' : '')} draggable=${can && !qu} onDragStart=${dragStart} onDragEnd=${(e) => e.currentTarget.classList.remove('dragging')}
    tabindex="-1" onKeyDown=${(e) => { if (e.key.toLowerCase() === 'u' && e.target === e.currentTarget && can) { e.preventDefault(); setQu(true); } }}>
    <span class="grip" aria-hidden="true" title="Drag to a list, a day or a department">⋮⋮</span>
    ${toggle ? html`<input type="checkbox" class="cbox" checked=${sel} onClick=${(e) => toggle(t.id, e.shiftKey)} aria-label=${'Select ' + t.title + '. Shift-click to select a range'} />` : ''}
    <button class=${'ring' + (t.status === 'done' ? ' done' : t.status === 'cancelled' ? ' cancelled' : t.status === 'on_hold' ? ' held' : t.status === 'blocked' ? ' blocked' : !t.priority ? ' none' : '')} disabled=${!can} aria-label=${(isClosed(t) ? 'Reopen: ' : t.status === 'on_hold' ? 'Resume: ' : 'Mark done: ') + t.title} onClick=${() => (isClosed(t) ? ctx.reopen(t) : t.status === 'on_hold' ? ctx.update(t.id, { status: 'open' }, 'Resumed') : ctx.done(t))}></button>
    <div class="tmain">
      <span class="ttitle" role="button" tabindex="0" onClick=${() => ctx.openTask(t)} onKeyDown=${(e) => e.key === 'Enter' && ctx.openTask(t)}
        onMouseEnter=${() => { timer.current = setTimeout(() => setPeek(true), 550); }} onMouseLeave=${() => { clearTimeout(timer.current); setPeek(false); }}>${t.title}</span>
      ${tags}
    </div>
    <div class="props">
      <button class=${'updc' + (t.last_update_at ? ' has' : '')} disabled=${!can} title=${t.last_update_body ? `Latest: ${t.last_update_body}. Click to update` : 'Post an update or change status'} aria-label=${'Update ' + t.title} onClick=${() => setQu(!qu)}>${I.bubble}<span class="lab">${t.last_update_at ? ago(t.last_update_at).replace(' ago', '') : 'Update'}</span></button>
      <${Prio} ctx=${ctx} t=${t} />
      <${DateChip} ctx=${ctx} t=${t} />
      <${OwnerPick} ctx=${ctx} t=${t} />
    </div>
    ${peek && !qu ? html`<${Peek} ctx=${ctx} t=${t} />` : ''}
    ${qu ? html`<${QuickUpdate} ctx=${ctx} t=${t} close=${() => setQu(false)} />` : ''}
  </div>`;
}

/* ---------- grouped list with drop targets ---------- */
function GroupHead({ label, icon, n, pct, hint, collapsed, onToggle, onDrop, onAdd, allSel, onSelAll }) {
  const [over, dropProps] = useDrop(onDrop || (() => {}));
  return html`<div class=${'ghead' + (over ? ' drop' : '')} onClick=${onToggle} ...${onDrop ? dropProps : {}}>
    ${onSelAll ? html`<input type="checkbox" class="cbox gsel" checked=${allSel} aria-label=${'Select all in ' + label} onClick=${(e) => { e.stopPropagation(); onSelAll(); }} />` : ''}
    <span class=${'caret' + (collapsed ? '' : ' open')} style="display:inline-flex;color:var(--faint)">${I.caret}</span>
    ${icon}<span class="name">${label}</span><span class="n">${n}</span>
    ${pct != null ? html`<span class="prog" aria-hidden="true"><i style=${`width:${pct}%`}></i></span><span class="n">${pct}% this week</span>` : ''}
    <span class="hint">${over ? 'Drop to move here' : hint || ''}</span>
    ${onAdd ? html`<button class="iconbtn" aria-label=${'Add a task to ' + label} onClick=${(e) => { e.stopPropagation(); onAdd(); }}>${I.plus}</button>` : ''}
  </div>`;
}
function Groups({ ctx, groups, sel, setSel, rowProps = {}, storeKey = 'x' }) {
  const sk = 'bs_closed_' + storeKey;
  const [closed, setClosedRaw] = useState(() => { try { return JSON.parse(sessionStorage.getItem(sk) || '{}'); } catch (_) { return {}; } });
  useEffect(() => { try { setClosedRaw(JSON.parse(sessionStorage.getItem(sk) || '{}')); } catch (_) { setClosedRaw({}); } }, [sk]);
  const setClosed = (fn) => setClosedRaw((c) => { const n = typeof fn === 'function' ? fn(c) : fn; try { sessionStorage.setItem(sk, JSON.stringify(n)); } catch (_) {} return n; });
  const labeled = groups.filter((g) => g.label != null);
  const nClosed = labeled.filter((g) => closed[g.key]).length;
  const last = useRef(null);
  const selecting = sel && sel.length > 0;
  const dragIds = (id) => (sel && sel.includes(id) ? sel : [id]);
  const flat = groups.flatMap((g) => (closed[g.key] ? [] : g.items)).map((t) => t.id);
  const toggle = setSel ? (id, shift) => {
    if (shift && last.current && flat.includes(last.current)) {
      const [a, b] = [flat.indexOf(last.current), flat.indexOf(id)].sort((x, y) => x - y);
      const range = flat.slice(a, b + 1);
      setSel((s) => [...new Set([...s, ...range])]);
    } else setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    last.current = id;
  } : null;
  return html`<div class=${selecting ? 'selecting' : ''}>
    ${labeled.length > 1 ? html`<div class="gtools"><span>${labeled.length} groups</span>
      <button class="linkbtn" disabled=${nClosed === labeled.length} onClick=${() => setClosed(Object.fromEntries(labeled.map((g) => [g.key, true])))}>Collapse all</button>
      <button class="linkbtn" disabled=${nClosed === 0} onClick=${() => setClosed({})}>Expand all</button></div>` : null}
    ${groups.map((g) => { const ids = g.items.map((t) => t.id); const allSel = !!sel && ids.length > 0 && ids.every((x) => sel.includes(x)); return html`<div key=${g.key}>
    ${g.label != null ? html`<${GroupHead} ...${g} collapsed=${closed[g.key]} onToggle=${() => setClosed((c) => ({ ...c, [g.key]: !c[g.key] }))}
      allSel=${allSel} onSelAll=${setSel ? () => setSel((s) => (allSel ? s.filter((x) => !ids.includes(x)) : [...new Set([...s, ...ids])])) : null} />` : ''}
    ${closed[g.key] ? '' : html`<${RowsLimited} ctx=${ctx} items=${g.items} sel=${sel} toggle=${toggle} dragIds=${dragIds} rowProps=${rowProps} />`}
  </div>`; })}</div>`;
}
function RowsLimited({ ctx, items, sel, toggle, dragIds, rowProps }) {
  const [n, setN] = useState(40);
  return html`${items.slice(0, n).map((t) => html`<${TRow} key=${t.id} ctx=${ctx} t=${t} sel=${sel?.includes(t.id)} toggle=${toggle} dragIds=${dragIds} ...${rowProps} />`)}
    ${items.length > n ? html`<div class="more"><button class="linkbtn" onClick=${() => setN(n + 150)}>Show ${Math.min(items.length - n, 150)} more of ${items.length - n}</button></div>` : ''}`;
}

/* ---------- week strip ---------- */
function WeekStrip({ ctx, tasks, day, setDay }) {
  const ws = weekStart(), td = today();
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  return html`<section class="week" aria-label="This week">${days.map((d) => html`<${DayCell} ctx=${ctx} d=${d} td=${td} items=${tasks.filter((t) => t.due_date === d)} on=${day === d} onClick=${() => setDay(day === d ? null : d)} />`)}</section>`;
}
function DayCell({ ctx, d, td, items, on, onClick }) {
  const [over, dropProps] = useDrop((ids) => ctx.moveTo(ids, { due_date: d }, `Due ${fmtDate(d)}`));
  const bars = items.filter((t) => t.status !== 'on_hold' && t.status !== 'cancelled').slice(0, 10).map((t) => t.status === 'done' ? ['14px', 'var(--done)'] : d < td ? ['10px', 'var(--late)'] : ['8px', 'var(--line)']);
  return html`<button class=${'day' + (d === td ? ' today' : '') + (on ? ' on' : '') + (over ? ' drop' : '')} onClick=${onClick} aria-pressed=${on} aria-label=${`${fmtDate(d)}, ${items.length} tasks`} ...${dropProps}>
    <span class="dh"><b>${dayName(d)} ${dayNum(d)}</b><span class="num">${items.length || ''}</span></span>
    <span class="bars" aria-hidden="true">${bars.map(([h, c]) => html`<i style=${`height:${h};background:${c}`}></i>`)}</span>
  </button>`;
}

/* ---------- floating bulk bar ---------- */
function BulkBar({ ctx, sel, clear }) {
  if (!sel.length) return '';
  const apply = async (fields, msg) => { if (await ctx.update(sel, fields, `${msg} (${sel.length})`)) { clear(); ctx.load(); } };
  return html`<div class="bulkbar" role="toolbar" aria-label="Selected tasks">
    <b>${sel.length} selected</b>
    <${BulkPop} label="Priority">${(close) => html`<${PrioritySlider} always value=${null} onChange=${(p) => { close(); apply({ priority: p }, `Set ${PRI[p]}`); }} />`}</${BulkPop}>
    <${BulkPop} label="Deadline">${(close) => html`<div class="qchips">${[['Today', today()], ['Tomorrow', addDays(today(), 1)], ['Fri', parseQuick('fri')], ['Mon', nextDow(0)], ['+1 week', addDays(today(), 7)]].map(([l, d]) => html`<button class="qchip" onClick=${() => { close(); apply({ due_date: d }, `Due ${fmtDate(d)}`); }}>${l}</button>`)}</div><input type="date" class="field" aria-label="Pick a date" onChange=${(e) => { if (e.target.value) { close(); apply({ due_date: e.target.value }, `Due ${fmtDate(e.target.value)}`); } }} />`}</${BulkPop}>
    <${BulkPop} label="Owner">${(close) => html`<${OwnerList} ctx=${ctx} onPick=${(p) => { close(); apply({ owner_id: p.id, acknowledged_at: p.id === ctx.me.id ? new Date().toISOString() : null }, `Assigned to ${first(p.name)}`); }} />`}</${BulkPop}>
    <${BulkPop} label="Move">${(close) => html`<div class="opts">${ctx.depts.map((d) => html`<div><div class="opt" style="font-weight:600;cursor:default"><span class="ddot" style=${'background:' + ctx.deptColor(d.id)}></span>${d.name}<button class="linkbtn" style="margin-left:auto;font-size:12px" onClick=${() => { close(); apply({ department_id: d.id, task_list_id: null }, `Moved to ${d.name}`); }}>Move here</button></div>
      ${ctx.lists.filter((l) => l.department_id === d.id).map((l) => html`<button class="opt" style="padding-left:24px" onClick=${() => { close(); apply({ department_id: d.id, task_list_id: l.id }, `Moved to ${l.name}`); }}><${LIcon} name=${l.name} sm />${l.name}</button>`)}</div>`)}</div>`}</${BulkPop}>
    <span class="bb"><button onClick=${() => apply({ status: 'done', completed_at: new Date().toISOString() }, 'Marked done')}>Done</button></span>
    <span class="bb"><button onClick=${() => apply({ status: 'on_hold' }, 'Put on hold')}>Hold</button></span>
    <span class="bb"><button onClick=${async () => { const r = (prompt(`Why cancel these ${sel.length} tasks?`) || '').trim(); if (!r) return; await sb.from('task_updates').insert(sel.map((id) => ({ task_id: id, author_id: ctx.me.id, body: `Cancelled: ${r}` }))); apply({ status: 'cancelled', completed_at: new Date().toISOString() }, 'Cancelled'); }}>Cancel</button></span>
    <span class="bb"><button onClick=${clear} aria-label="Clear selection">✕</button></span>
  </div>`;
}
function OwnerList({ ctx, onPick }) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const opts = ctx.people.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  return html`<input class="field" placeholder="Assign to…" aria-label="Search people" value=${q} onInput=${(e) => { setQ(e.target.value); setI(0); }}
    onKeyDown=${(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setI(Math.min(i + 1, opts.length - 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setI(Math.max(i - 1, 0)); } else if (e.key === 'Enter' && opts[i]) onPick(opts[i]); }} />
    <div class="opts" role="listbox">${opts.map((p, n) => html`<button class="opt" role="option" aria-selected=${n === i} onClick=${() => onPick(p)}><${Avatar} ctx=${ctx} id=${p.id} size=${22} />${p.name}<span class="r">${ctx.dept(ctx.ownerDept(p.id))?.name || ''}</span></button>`)}</div>`;
}
function BulkPop({ label, children }) {
  const [open, setOpen, ref] = usePop();
  return html`<span class="bb" ref=${ref}><button aria-expanded=${open} onClick=${() => setOpen(!open)}>${label}</button>${open ? html`<div class="pop" style="min-width:${label === 'Priority' ? 220 : 260}px">${children(() => setOpen(false))}</div>` : ''}</span>`;
}

/* ---------- All tasks ---------- */
const STATUS_TABS = [['open', 'Open'], ['nodate', 'Needs date'], ['late', 'Late'], ['blocked', 'Blocked'], ['hold', 'On hold'], ['done', 'Done']];
const byStatus = (t, s) => s === 'open' ? isActive(t) : s === 'nodate' ? needsDate(t) : s === 'late' ? isLate(t) : s === 'blocked' ? t.status === 'blocked' : s === 'hold' ? t.status === 'on_hold' : isClosed(t);
const sortTasks = (a, b, sort) => sort === 'priority' ? (a.priority || 'P9').localeCompare(b.priority || 'P9') || (a.due_date || '9').localeCompare(b.due_date || '9')
  : sort === 'updated' ? (b.last_update_at || b.updated_at).localeCompare(a.last_update_at || a.updated_at)
  : (a.due_date || '9').localeCompare(b.due_date || '9') || (a.priority || 'P9').localeCompare(b.priority || 'P9');

function AllTasks({ ctx, route }) {
  const [tab, setTab] = useState(route.status || 'open');
  const [q, setQ] = useState(route.q || '');
  const [group, setGroup] = useState('dept');
  const [sort, setSort] = useState('due');
  const [day, setDay] = useState(null);
  const [sel, setSel] = useState([]);
  useEffect(() => { setQ(route.q || ''); if (route.status) setTab(route.status); setSel([]); }, [route.q, route.status, route.pin]);
  const f = parseQuery(q, ctx);
  const qStatus = f.status;
  const rows = ctx.tasks.filter((t) => (qStatus ? true : byStatus(t, tab)) && matchQuery(t, { ...f, status: f.status || (tab === 'done' ? 'done' : tab === 'hold' ? 'hold' : null) }, ctx) && (!day || t.due_date === day)).sort((a, b) => sortTasks(a, b, sort));
  const counts = Object.fromEntries(STATUS_TABS.map(([k]) => [k, ctx.tasks.filter((t) => byStatus(t, k) && matchQuery(t, { ...f, status: k === 'done' ? 'done' : k === 'hold' ? 'hold' : null }, ctx)).length]));
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const groups = [];
  if (group === 'none') groups.push({ key: 'all', label: null, items: rows });
  else {
    const m = new Map();
    rows.forEach((t) => { const k = group === 'dept' ? t.department_id : group === 'owner' ? t.owner_id : group === 'prio' ? (t.priority || 'none') : (t.task_list_id || 'none'); if (!m.has(k)) m.set(k, []); m.get(k).push(t); });
    const keys = [...m.keys()].sort((a, b) => group === 'dept' ? (ctx.dept(a)?.sort_order ?? 99) - (ctx.dept(b)?.sort_order ?? 99) : group === 'prio' ? a.localeCompare(b) : m.get(b).length - m.get(a).length);
    keys.forEach((k) => {
      const items = m.get(k);
      const g = { key: k, items, n: items.length };
      if (group === 'dept') Object.assign(g, { label: ctx.dept(k)?.name, icon: html`<span class="ddot" style=${'background:' + ctx.deptColor(k)}></span>`, onDrop: (ids) => ctx.moveTo(ids, { department_id: k, task_list_id: null }, `Moved to ${ctx.dept(k)?.name}`), onAdd: () => ctx.newTask({ department_id: k }) });
      if (group === 'owner') Object.assign(g, { label: ctx.person(k)?.name || 'Unassigned', icon: html`<${Avatar} ctx=${ctx} id=${k} size=${20} />`, onDrop: ctx.isAdmin ? (ids) => ctx.moveTo(ids, { owner_id: k, acknowledged_at: null }, `Assigned to ${first(ctx.person(k)?.name)}`) : null });
      if (group === 'prio') Object.assign(g, { label: k === 'none' ? 'No priority' : PRI[k], icon: html`<span class=${'plabel ' + k} style="height:18px;padding:0 6px;font-size:10.5px">${k === 'none' ? '—' : k}</span>`, onDrop: k === 'none' ? null : (ids) => ctx.moveTo(ids, { priority: k }, `Set ${PRI[k]}`) });
      if (group === 'list') Object.assign(g, { label: k === 'none' ? 'No list' : ctx.list(k)?.name, icon: k === 'none' ? '' : html`<${LIcon} name=${ctx.list(k)?.name} />`, hint: k === 'none' ? '' : ctx.dept(ctx.list(k)?.department_id)?.name });
      groups.push(g);
    });
  }
  setNav(groups.flatMap((g) => g.items));
  const chips = [];
  if (f.owner) chips.push(['Owner', ctx.person(f.owner)?.name]);
  if (f.dept) chips.push(['Department', ctx.dept(f.dept)?.name]);
  if (f.list) chips.push(['List', ctx.list(f.list)?.name]);
  if (f.prio) chips.push(['Priority', PRI[f.prio]]);
  if (f.status) chips.push(['Status', { late: 'Late', blocked: 'Blocked', done: 'Done', nodate: 'Needs date' }[f.status]]);
  if (f.when) chips.push(['Due', { today: 'Today', tomorrow: 'Tomorrow', week: 'This week' }[f.when]]);
  if (f.quiet) chips.push(['Updates', 'None in 7 days']);
  if (day) chips.push(['Due', fmtDate(day)]);
  const title = route.pin || 'All tasks';
  return html`
    <div class="topbar">
      <h1>${route.pin ? html`<span class="ic" style="color:var(--muted)">${I.pin}</span>` : ''}${title}</h1>
      <div class="tabs" role="tablist" aria-label="Views">${STATUS_TABS.map(([k, l]) => html`<button role="tab" class="tab" aria-selected=${!qStatus && tab === k} onClick=${() => { setTab(k); if (qStatus) setQ(q.replace(/\b(late|overdue|blocked|done|completed|no date|needs date|undated)\b/gi, '').trim()); }}>${l}<span>${counts[k]}</span></button>`)}</div>
      <span class="grow"></span>
      <button class="btn primary" onClick=${() => ctx.newTask({})}>${I.plus}New task</button>
    </div>
    <${WeekStrip} ctx=${ctx} tasks=${ctx.tasks.filter((t) => matchQuery(t, { ...f, status: null, when: null }, ctx) || t.status === 'done' && matchQuery(t, { ...f, status: 'done', when: null }, ctx))} day=${day} setDay=${setDay} />
    <div class="filterbar">
      <label class="nlsearch">${I.search}<span class="sr">Filter</span><input placeholder="Filter in plain words: vivek urgent this week, no update, resale…" value=${q} onInput=${(e) => setQ(e.target.value)} /></label>
      ${chips.map(([k, v]) => html`<span class="fchip"><span>${k}</span><b>${v}</b><button aria-label=${'Remove ' + k} onClick=${() => { if (k === 'Due' && day) setDay(null); else setQ(''); }}>×</button></span>`)}
      ${q ? html`<button class="addfilter" onClick=${() => { const n = prompt('Name this view', describeQuery(f, ctx)); if (n) { ctx.addPin(n.trim(), q); ctx.setToast({ text: `Pinned “${n.trim()}” to the sidebar` }); } }}>${I.pin}Pin view</button>` : ''}
      ${route.pin ? html`<button class="addfilter" onClick=${() => { ctx.removePin(route.pin); location.hash = 'all'; }}>Unpin</button>` : ''}
      ${rows.length ? html`<button class="addfilter" onClick=${() => setSel(sel.length === rows.length ? [] : rows.map((t) => t.id))}>${sel.length === rows.length ? 'Clear selection' : `Select all ${rows.length}`}</button>` : ''}
      <span class="grow" style="flex:1"></span>
      <label class="ctl">Group <select value=${group} onChange=${(e) => setGroup(e.target.value)}><option value="dept">Department</option><option value="list">Task list</option><option value="owner">Person</option><option value="prio">Priority</option><option value="none">None</option></select></label>
      <label class="ctl">Sort <select value=${sort} onChange=${(e) => setSort(e.target.value)}><option value="due">Deadline</option><option value="priority">Priority</option><option value="updated">Last update</option></select></label>
    </div>
    <div class="page">
      ${rows.length ? html`<${Groups} ctx=${ctx} groups=${groups} sel=${sel} setSel=${setSel} storeKey=${'all-' + group} rowProps=${{ showDept: group !== 'dept', showList: group !== 'list' }} />` : html`<p class="empty">No tasks match.</p>`}
    </div>
    <${BulkBar} ctx=${ctx} sel=${sel} clear=${() => setSel([])} />`;
}

/* ---------- Department ---------- */
function Dept({ ctx, route }) {
  const wide = useWide();
  const choices = ctx.isAdmin ? ctx.depts : ctx.depts.filter((d) => ctx.myDepts.includes(d.id));
  const id = route.dept && choices.some((d) => d.id === route.dept) ? route.dept : choices[0]?.id;
  const listF = route.list || '';
  const [tab, setTab] = useState('open');
  const [day, setDay] = useState(null);
  const [sel, setSel] = useState([]);
  const [summary, setSummary] = useState(null);
  const [suggest, setSuggest] = useState(null);
  const [assign, setAssign] = useState(false);
  const [aiSheet, setAiSheet] = useState(null);
  useEffect(() => { setSel([]); setDay(null); setSummary(null); }, [id, listF]);
  if (!id) return html`<div class="topbar"><h1>Department</h1></div><p class="empty">You are not in a department yet.</p>`;
  const d = ctx.dept(id);
  const all = ctx.tasks.filter((t) => t.department_id === id);
  const open = all.filter(isActive);
  const inList = (t) => !listF || (listF === 'none' ? !t.task_list_id : t.task_list_id === listF);
  const shown = all.filter((t) => byStatus(t, tab) && inList(t) && (!day || t.due_date === day)).sort((a, b) => sortTasks(a, b, 'due'));
  const lists = ctx.lists.filter((l) => l.department_id === id);
  const doneWeek = all.filter((t) => t.status === 'done' && t.completed_at?.slice(0, 10) >= weekStart());
  const pctFor = (items, lid) => { const dn = doneWeek.filter((t) => (t.task_list_id || 'none') === lid).length; const due = items.filter((t) => t.due_date && t.due_date <= weekEnd()).length; return dn + due ? Math.round((dn / (dn + due)) * 100) : null; };
  const groups = [];
  if (listF) groups.push({ key: listF, label: null, items: shown });
  else {
    const m = new Map(lists.map((l) => [l.id, []]));
    m.set('none', []);
    shown.forEach((t) => m.get(t.task_list_id || 'none')?.push(t));
    [...m.entries()].filter(([, items]) => items.length).sort((a, b) => (a[0] === 'none') - (b[0] === 'none') || b[1].length - a[1].length).forEach(([k, items]) => {
      const name = k === 'none' ? 'No list' : ctx.list(k)?.name;
      groups.push({ key: k, label: name, items, n: items.length, pct: k === 'none' ? null : pctFor(items, k), icon: k === 'none' ? '' : html`<${LIcon} name=${name} />`, hint: wide ? 'Drag tasks here to move them' : '',
        onDrop: k === 'none' ? (ids) => ctx.moveTo(ids, { task_list_id: null }, 'Removed from list') : (ids) => ctx.moveTo(ids, { task_list_id: k }, `Moved to ${name}`),
        onAdd: () => ctx.newTask({ department_id: id, task_list_id: k === 'none' ? '' : k }) });
    });
  }
  setNav(groups.flatMap((g) => g.items));
  const toggle = (tid) => setSel((s) => (s.includes(tid) ? s.filter((x) => x !== tid) : [...s, tid]));
  const noList = open.filter((t) => !t.task_list_id).length;
  const heads = ctx.members.filter((m) => m.department_id === id && m.is_head).map((m) => first(ctx.person(m.person_id)?.name));
  const requests = open.filter((t) => t.from_department_id && !t.acknowledged_at);
  const lead = ctx.canManageLists(id);
  async function runSummary() {
    setSummary({ loading: true });
    const { data, error } = await sb.functions.invoke('ai', { body: { mode: 'summarise', department_id: id } });
    setSummary(error || data?.error ? { error: data?.error || 'Could not summarise right now.' } : { lines: data.lines });
  }
  async function runSuggest() {
    setSuggest({ loading: true });
    const { data, error } = await sb.functions.invoke('ai', { body: { mode: 'suggest_lists', department_id: id } });
    if (error || data?.error) { setSuggest(null); return ctx.setToast({ text: data?.error || 'Could not get suggestions right now.' }); }
    if (!data.suggestions.length) { setSuggest(null); return ctx.setToast({ text: 'No confident suggestions. Try adding a few more lists.' }); }
    setSuggest({ items: data.suggestions.map((s) => ({ ...s, on: true })) });
  }
  return html`
    <div class="topbar">
      <h1><span class="ddot" style=${`width:12px;height:12px;border-radius:3px;background:${ctx.deptColor(id)}`}></span>${listF && listF !== 'none' ? html`<a href=${'#dept?dept=' + id} style="color:var(--muted);text-decoration:none;font-weight:500">${d.name}</a><span style="color:var(--ghost)">/</span>${ctx.list(listF)?.name}${lead && ctx.list(listF) ? html`<${ListMenu} ctx=${ctx} l=${ctx.list(listF)} />` : ''}` : d.name}</h1>
      <span class="sub num">${open.length} open, ${open.filter(isLate).length} late${heads.length ? `, heads ${heads.join(' and ')}` : ''}</span>
      <span class="grow"></span>
      <button class="btn" onClick=${runSummary}>${I.spark}Summarise</button>
      <button class="btn" onClick=${() => setAiSheet('brief')}>Prep brief</button>
      <button class="btn" onClick=${() => setAiSheet('notes')}>From notes</button>
      ${ctx.isAdmin || lead ? html`<button class="btn" onClick=${() => setAiSheet('cleanup')}>Clean up</button>` : ''}
      <button class="btn primary" onClick=${() => ctx.newTask({ department_id: id, task_list_id: listF && listF !== 'none' ? listF : '' })}>${I.plus}New task</button>
    </div>
    ${summary ? html`<div class="summary" role="status"><div class="h"><span>${I.spark} ${d.name}, this week</span><button class="iconbtn" aria-label="Close summary" onClick=${() => setSummary(null)}>✕</button></div>
      ${summary.loading ? html`<span class="muted">Reading tasks and updates…</span>` : summary.error ? html`<span class="err">${summary.error}</span>` : html`<ol>${summary.lines.map((l) => html`<li>${l}</li>`)}</ol>`}</div>` : ''}
    <${WeekStrip} ctx=${ctx} tasks=${all.filter(inList)} day=${day} setDay=${setDay} />
    ${lead && noList >= 3 && !listF && lists.length ? html`<div class="banner"><span>${I.spark}</span><span class="t"><b style="font-weight:600">${noList} tasks have no list.</b> Auto-sort suggests a list for each, from the title and similar tasks.</span><button class="btn dark" disabled=${suggest?.loading} onClick=${runSuggest}>${suggest?.loading ? 'Thinking…' : 'Review suggestions'}</button></div>` : ''}
    ${ctx.isAdmin && !listF && open.filter((t) => t.owner_id === ctx.me.id && !t.is_private).length >= 3 && ctx.members.some((m) => m.department_id === id && m.person_id !== ctx.me.id) ? html`<div class="banner"><span>${I.spark}</span><span class="t"><b style="font-weight:600">${open.filter((t) => t.owner_id === ctx.me.id && !t.is_private).length} tasks here are with you.</b> Get suggested owners from this team.</span><button class="btn dark" onClick=${() => setAssign([id])}>Suggest owners</button></div>` : ''}
    ${assign ? html`<${OwnerSuggest} ctx=${ctx} deptIds=${assign} close=${() => setAssign(false)} />` : ''}
    <div class="mlists">
      <button class="lp" aria-pressed=${!listF} onClick=${() => (location.hash = 'dept?dept=' + id)}>All lists</button>
      ${lists.map((l) => html`<button class="lp" aria-pressed=${listF === l.id} onClick=${() => (location.hash = `dept?dept=${id}&list=${l.id}`)}>${l.name}</button>`)}
    </div>
    <div class="filterbar">
      <div class="tabs" role="tablist">${[['open', 'Open'], ['late', 'Late'], ['blocked', 'Blocked'], ['nodate', 'Needs date'], ['hold', 'On hold'], ['done', 'Done']].map(([k, l]) => html`<button role="tab" class="tab" aria-selected=${tab === k} onClick=${() => setTab(k)}>${l}<span>${all.filter((t) => byStatus(t, k) && inList(t)).length}</span></button>`)}</div>
      ${day ? html`<span class="fchip"><span>Due</span><b>${fmtDate(day)}</b><button aria-label="Clear day" onClick=${() => setDay(null)}>×</button></span>` : ''}
      <span style="flex:1"></span>
      ${shown.length ? html`<button class="addfilter" onClick=${() => setSel(sel.length === shown.length ? [] : shown.map((t) => t.id))}>${sel.length === shown.length ? 'Clear selection' : `Select all ${shown.length}`}</button>` : ''}
    </div>
    ${lead && requests.length ? html`<div style="padding:12px 28px 0"><div class="panel"><div class="ph"><h2>Requests from other teams</h2></div>${requests.map((t) => html`<${TRow} key=${t.id} ctx=${ctx} t=${t} />`)}</div></div>` : ''}
    <div class="page">${shown.length ? html`<${Groups} ctx=${ctx} groups=${groups} sel=${sel} setSel=${setSel} storeKey=${'dept-' + id + '-' + (listF || 'all')} rowProps=${{ showList: false }} />` : html`<p class="empty">No tasks here.</p>`}</div>
    <${BulkBar} ctx=${ctx} sel=${sel} clear=${() => setSel([])} />
    ${aiSheet === 'brief' ? html`<${BriefSheet} ctx=${ctx} deptId=${id} close=${() => setAiSheet(null)} />` : ''}
    ${aiSheet === 'notes' ? html`<${NotesSheet} ctx=${ctx} deptId=${id} close=${() => setAiSheet(null)} />` : ''}
    ${aiSheet === 'cleanup' ? html`<${CleanupSheet} ctx=${ctx} deptId=${id} close=${() => setAiSheet(null)} />` : ''}
    ${suggest?.items ? html`<${SuggestSheet} ctx=${ctx} deptId=${id} items=${suggest.items} close=${() => setSuggest(null)} />` : ''}`;
}
function SuggestSheet({ ctx, deptId, items: init, close }) {
  const [items, setItems] = useState(init);
  const lists = ctx.lists.filter((l) => l.department_id === deptId);
  const on = items.filter((i) => i.on);
  async function apply() {
    const byList = {};
    on.forEach((i) => { (byList[i.list_id] ||= []).push(i.task_id); });
    for (const [lid, ids] of Object.entries(byList)) await sb.from('tasks').update({ task_list_id: lid }).in('id', ids);
    ctx.setToast({ text: `${on.length} tasks filed` }); ctx.load(); close();
  }
  return html`<div class="scrim" onClick=${close}><div class="sheet wide" role="dialog" aria-modal="true" aria-label="Auto-sort suggestions" onClick=${(e) => e.stopPropagation()}>
    <div class="top"><b style="font-size:16px;font-weight:600">${I.spark} Suggested lists</b><button class="btn ghost" onClick=${close}>Close</button></div>
    <p class="note">Untick anything that looks wrong, or pick another list. Nothing changes until you apply.</p>
    <div>${items.map((it, n) => { const t = ctx.tasks.find((x) => x.id === it.task_id); return t ? html`<div class="suggrow">
      <input type="checkbox" class="cbox" style="opacity:1" checked=${it.on} aria-label=${'Apply suggestion for ' + t.title} onChange=${() => setItems(items.map((x, j) => (j === n ? { ...x, on: !x.on } : x)))} />
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.title}</span>
      <select class="field" aria-label="List" value=${it.list_id} onChange=${(e) => setItems(items.map((x, j) => (j === n ? { ...x, list_id: e.target.value } : x)))}>${lists.map((l) => html`<option value=${l.id} selected=${l.id === it.list_id}>${l.name}</option>`)}</select>
    </div>` : ''; })}</div>
    <div class="actions"><button class="btn primary big" disabled=${!on.length} onClick=${apply}>File ${on.length} tasks</button><button class="btn ghost big" onClick=${close}>Cancel</button></div>
  </div></div>`;
}


/* ---------- AI: suggest owners for tasks the admin owns ---------- */
function OwnerSuggest({ ctx, deptIds, close }) {
  const [prog, setProg] = useState({ i: 0, name: '' });
  const [items, setItems] = useState(null);
  const [notes, setNotes] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      const all = []; const skipped = [];
      for (let i = 0; i < deptIds.length; i++) {
        const d = ctx.dept(deptIds[i]);
        if (!alive) return;
        setProg({ i: i + 1, name: d?.name });
        const { data, error } = await sb.functions.invoke('ai', { body: { mode: 'suggest_owners', department_id: deptIds[i] } });
        if (error || data?.error) { skipped.push(`${d?.name}: ${data?.error || 'could not get suggestions'}`); if ((data?.error || '').includes('limit')) break; continue; }
        if (data.note) skipped.push(`${d?.name}: ${data.note}`);
        (data.suggestions || []).forEach((s) => all.push({ ...s, dept: deptIds[i], on: true }));
      }
      if (alive) { setItems(all); setNotes(skipped); }
    })();
    return () => { alive = false; };
  }, []);
  const on = (items || []).filter((x) => x.on && x.owner_id !== ctx.me.id);
  async function apply() {
    setBusy(true);
    const byOwner = {};
    on.forEach((x) => (byOwner[x.owner_id] ||= []).push(x.task_id));
    for (const [oid, ids] of Object.entries(byOwner)) await sb.from('tasks').update({ owner_id: oid, acknowledged_at: null }).in('id', ids);
    setBusy(false);
    ctx.setToast({ text: `${on.length} tasks handed out to ${Object.keys(byOwner).length} people` }); ctx.load(); close();
  }
  const teamOf = (d) => ctx.members.filter((m) => m.department_id === d).map((m) => ctx.person(m.person_id)).filter(Boolean);
  const groups = deptIds.map((d) => ({ d, rows: (items || []).map((x, n) => ({ ...x, n })).filter((x) => x.dept === d) })).filter((g) => g.rows.length);
  const count = (pid) => on.filter((x) => x.owner_id === pid).length;
  return html`<div class="scrim" onClick=${close}><div class="sheet wide" role="dialog" aria-modal="true" aria-label="Suggested owners" onClick=${(e) => e.stopPropagation()}>
    <div class="top"><b style="font-size:16px;font-weight:600;display:flex;gap:8px;align-items:center">${I.spark} Suggested owners</b><button class="btn ghost" onClick=${close}>Close</button></div>
    ${items === null ? html`<p class="note">Reading ${prog.name}… department ${prog.i} of ${deptIds.length}. This takes a few seconds per department.</p>` : html`
      <p class="note">Gemini suggested an owner for ${items.length} of your tasks, based on each department's team and who already owns similar work. Tasks it thought should stay with you are not listed. Untick or change anything; nothing moves until you apply.</p>
      ${on.length ? html`<p class="note">Split: ${[...new Set(on.map((x) => x.owner_id))].map((pid) => `${first(ctx.person(pid)?.name)} ${count(pid)}`).join(', ')}</p>` : ''}
      ${notes.length ? html`<p class="note">Skipped: ${notes.join('; ')}</p>` : ''}
      ${groups.map((g) => html`<div>
        <div style="display:flex;align-items:center;gap:8px;margin:10px 0 4px;font-weight:600"><span class="ddot" style=${'background:' + ctx.deptColor(g.d)}></span>${ctx.dept(g.d)?.name}<span class="muted" style="font-weight:400">${g.rows.length}</span></div>
        ${g.rows.map((x) => { const t = ctx.tasks.find((y) => y.id === x.task_id); return t ? html`<div class="suggrow">
          <input type="checkbox" class="cbox" style="opacity:1" checked=${x.on} aria-label=${'Apply for ' + t.title} onChange=${() => setItems(items.map((y, j) => (j === x.n ? { ...y, on: !y.on } : y)))} />
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title=${t.title}>${t.title}${t.task_list_id ? html` <span class="tag" style="margin-left:6px">${ctx.list(t.task_list_id)?.name}</span>` : ''}</span>
          <select class="field" aria-label="Owner" value=${x.owner_id} onChange=${(e) => setItems(items.map((y, j) => (j === x.n ? { ...y, owner_id: e.target.value } : y)))}>
            ${[...teamOf(g.d), ctx.me].filter((p, i, arr) => arr.findIndex((q) => q.id === p.id) === i).map((p) => html`<option value=${p.id} selected=${p.id === x.owner_id}>${p.id === ctx.me.id ? 'Keep with me' : p.name}</option>`)}
          </select>
        </div>` : ''; })}
      </div>`)}
      ${!items.length ? html`<p class="empty" style="padding:8px 0">No suggestions. Departments without team members can't be assigned automatically.</p>` : ''}
      <div class="actions"><button class="btn primary big" disabled=${busy || !on.length} onClick=${apply}>${busy ? 'Assigning…' : `Assign ${on.length} tasks`}</button><button class="btn ghost big" onClick=${close}>Cancel</button></div>`}
  </div></div>`;
}

/* ---------- My tasks ---------- */
function Mine({ ctx }) {
  const [day, setDay] = useState(null);
  const td = today(), we = weekEnd();
  const mine = ctx.mine();
  const open = mine.filter((t) => isActive(t) && !(t.snoozed_until && t.snoozed_until > td) && (!day || t.due_date === day));
  const held = mine.filter((t) => t.status === 'on_hold');
  const approvals = ctx.isAdmin ? [] : ctx.dcr.filter((r) => { const t = ctx.tasks.find((x) => x.id === r.task_id); return t && ctx.canDecide(t); });
  const waiting = ctx.open().filter((t) => t.blocked_on_person_id === ctx.me.id);
  const sorted = (a) => a.sort((x, y) => sortTasks(x, y, 'due'));
  const groups = [
    { key: 'w', label: 'Waiting on you', items: waiting },
    { key: 'o', label: 'Overdue', items: sorted(open.filter((t) => t.due_date && t.due_date < td)) },
    { key: 't', label: 'Today', items: sorted(open.filter((t) => t.due_date === td)) },
    { key: 'k', label: 'This week', items: sorted(open.filter((t) => t.due_date > td && t.due_date <= we)) },
    { key: 'l', label: 'Later', items: sorted(open.filter((t) => t.due_date > we)) },
    { key: 'n', label: 'Needs priority and date', items: sorted(open.filter((t) => !t.due_date)) },
    { key: 'h', label: 'On hold', items: held },
  ].filter((g) => g.items.length).map((g) => ({ ...g, n: g.items.length }));
  setNav(groups.flatMap((g) => g.items));
  return html`
    <div class="topbar"><h1>My tasks</h1><span class="sub num">${open.length} open, ${open.filter(isLate).length} late</span><span class="grow"></span><button class="btn primary" onClick=${() => ctx.newTask({ owner_id: ctx.me.id })}>${I.plus}New task</button></div>
    <${WeekStrip} ctx=${ctx} tasks=${mine} day=${day} setDay=${setDay} />
    ${approvals.length ? html`<div style="padding:0 28px 12px"><div class="panel"><div class="ph"><h2>Needs your approval</h2></div>${approvals.map((r) => { const t = ctx.tasks.find((x) => x.id === r.task_id); return html`<div class="need"><span class="k">Date change</span><span class="t"><span onClick=${() => ctx.openTask(t)}>${t.title} → ${shortDue(r.proposed_due)}</span><span>${first(ctx.person(r.requested_by)?.name)}${r.reason ? ', ' + r.reason : ''}</span></span><span class="na"><button class="btn primary" onClick=${() => ctx.decideDate(r, true)}>Approve</button><button class="btn ghost" onClick=${() => ctx.decideDate(r, false)}>Reject</button></span></div>`; })}</div></div>` : ''}
    <div class="page">${groups.length ? html`<${Groups} ctx=${ctx} groups=${groups} storeKey="mine" rowProps=${{ showDept: true }} />` : html`<p class="empty">Nothing open${day ? ' that day' : ''}. Add a task below.</p>`}</div>`;
}

/* ---------- Overview ---------- */
function OtherDate({ ctx, req }) {
  const [open, setOpen, ref] = usePop();
  return html`<span class="anchor" ref=${ref}><button class="btn ghost" onClick=${() => setOpen(!open)}>Other date</button>${open ? html`<div class="pop"><span class="note">Approve with this date instead</span><input type="date" class="field" min=${today()} onChange=${(e) => { if (e.target.value) { setOpen(false); ctx.approveOther(req, e.target.value); } }} /></div>` : ''}</span>`;
}
function NeedActions({ ctx, n }) {
  const t = n.t;
  const openB = html`<button class="btn ghost" onClick=${() => ctx.openTask(t)}>Open</button>`;
  if (n.req) return html`<button class="btn primary" onClick=${() => ctx.decideDate(n.req, true)}>Approve</button><button class="btn ghost" onClick=${() => ctx.decideDate(n.req, false)}>Reject</button><${OtherDate} ctx=${ctx} req=${n.req} />`;
  if (n.request) return html`<button class="btn primary" onClick=${() => ctx.decideRequest(t, true)}>Accept</button><button class="btn ghost" onClick=${() => ctx.openTask(t)}>Reassign</button>`;
  if (n.kind === 'Urgent, late') return html`<${DateChip} ctx=${ctx} t=${t} /><button class="btn" onClick=${() => ctx.nudge(t, 'nudge')}>Nudge</button>`;
  if (n.kind === 'Blocked') return html`${t.blocked_on_person_id ? html`<button class="btn" onClick=${() => ctx.nudge(t, 'nudge', 'blocker')}>Nudge ${first(ctx.person(t.blocked_on_person_id)?.name)}</button>` : ''}${openB}`;
  if (n.kind === 'Quiet') return html`<button class="btn" onClick=${() => ctx.nudge(t, 'ask')}>Ask for update</button>${openB}`;
  if (n.kind === 'Not seen') return html`<button class="btn" onClick=${() => ctx.nudge(t, 'nudge')}>Nudge</button>${openB}`;
  return html`<${DateChip} ctx=${ctx} t=${t} />${openB}`;
}
function Overview({ ctx }) {
  const [filter, setFilter] = useState('needs');
  const [assign, setAssign] = useState(false);
  const [team, setTeam] = useState(null);
  const [summary, setSummary] = useState(null);
  const td = today(), ws = weekStart(), we = weekEnd();
  const needs = ctx.needsYou();
  const open = ctx.open().filter(isActive);
  const doneWeek = ctx.tasks.filter((t) => t.status === 'done' && t.completed_at && t.completed_at.slice(0, 10) >= ws);
  const dueWeek = open.filter((t) => t.due_date && t.due_date >= ws && t.due_date <= we);
  const blocked = open.filter((t) => t.status === 'blocked');
  const undated = open.filter(needsDate);
  const figs = [['needs', needs.length, 'Needs you'], ['done', doneWeek.length, 'Done this week'], ['due', dueWeek.length, 'Due this week'], ['blocked', blocked.length, 'Blocked']];
  const teams = ctx.depts.map((d) => {
    const o = open.filter((t) => t.department_id === d.id);
    const late = o.filter(isLate);
    const dn = doneWeek.filter((t) => t.department_id === d.id).length;
    const due = dueWeek.filter((t) => t.department_id === d.id).length;
    const pct = dn + due ? Math.round((dn / (dn + due)) * 100) : 100;
    const st = late.filter((t) => t.priority === 'P1').length >= 2 || late.length >= 5 ? ['Needs help', 'help', 'var(--p1)'] : late.length ? ['Behind', 'behind', '#D9A441'] : ['On track', 'ok', 'var(--done)'];
    return { d, open: o.length, pct, st, attention: o.filter((t) => isLate(t) || t.status === 'blocked').sort((a, b) => sortTasks(a, b, 'due')), rank: st[1] === 'help' ? 0 : st[1] === 'behind' ? 1 : 2 };
  }).sort((a, b) => a.rank - b.rank || b.open - a.open);
  const since = useMemo(() => {
    const last = Number(localStorage.getItem('bs_last_seen') || 0);
    const items = ctx.tasks.filter((t) => Date.parse(t.updated_at) > last && t.updated_at !== t.created_at).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 8);
    setTimeout(() => { try { localStorage.setItem('bs_last_seen', String(Date.now())); } catch (_) {} }, 4000);
    return { last, items };
  }, []);
  const list = filter === 'needs' ? null : filter === 'done' ? doneWeek : filter === 'due' ? dueWeek : blocked;
  setNav(list || needs.map((n) => n.t));
  async function runSummary() {
    setSummary({ loading: true });
    const { data, error } = await sb.functions.invoke('ai', { body: { mode: 'summarise' } });
    setSummary(error || data?.error ? { error: data?.error || 'Could not summarise right now.' } : { lines: data.lines });
  }
  return html`
    <div class="topbar"><h1>Overview</h1><span class="sub">${fmtDate(td)}</span><span class="grow"></span><button class="btn" onClick=${runSummary}>${I.spark}Summarise this week</button></div>
    ${summary ? html`<div class="summary" role="status"><div class="h"><span>${I.spark} All departments, this week</span><button class="iconbtn" aria-label="Close summary" onClick=${() => setSummary(null)}>✕</button></div>
      ${summary.loading ? html`<span class="muted">Reading tasks and updates…</span>` : summary.error ? html`<span class="err">${summary.error}</span>` : html`<ol>${summary.lines.map((l) => html`<li>${l}</li>`)}</ol>`}</div>` : ''}
    <div class="figs" role="tablist">${figs.map(([k, n, l]) => html`<button role="tab" aria-selected=${filter === k} class=${'fig' + (filter === k ? ' on' : '')} onClick=${() => setFilter(k)}><b>${n}</b><span>${l}</span></button>`)}</div>
    ${(() => { const mineOpen = open.filter((t) => t.owner_id === ctx.me.id && !t.is_private); const depts = [...new Set(mineOpen.map((t) => t.department_id))].filter((d) => ctx.members.some((m) => m.department_id === d && m.person_id !== ctx.me.id)); return html`<${AiTools} ctx=${ctx} onOwners=${mineOpen.length >= 5 && depts.length ? () => setAssign(depts) : null} />`; })()}
    ${assign ? html`<${OwnerSuggest} ctx=${ctx} deptIds=${assign} close=${() => setAssign(false)} />` : ''}
    <div class="cols page">
      <div class="panel">
        ${filter === 'needs' ? html`<div class="ph"><h2>Needs you</h2>${undated.length ? html`<a href="#all?status=nodate" class="linkbtn" style="font-size:13px">${undated.length} need priority and date</a>` : ''}</div>
          ${needs.length ? needs.slice(0, 30).map((n) => html`<div class="need" key=${n.key}><span class="k">${n.kind}</span><span class="t"><span onClick=${() => ctx.openTask(n.t)}>${n.title}</span><span>${n.who}</span></span><span class="na"><${NeedActions} ctx=${ctx} n=${n} /></span></div>`) : html`<p class="empty">Nothing needs you right now.</p>`}`
        : html`<div class="ph"><h2>${figs.find((x) => x[0] === filter)[2]}</h2></div>${list.length ? list.slice(0, 60).map((t) => html`<${TRow} key=${t.id} ctx=${ctx} t=${t} showDept />`) : html`<p class="empty">None.</p>`}`}
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="panel"><div class="ph"><h2>Teams</h2></div>
          ${teams.map(({ d, open: o, pct, st, attention }) => html`
            <button class="team" aria-expanded=${team === d.id} onClick=${() => setTeam(team === d.id ? null : d.id)}>
              <span style="display:flex;align-items:center;gap:8px"><span class="ddot" style=${'background:' + ctx.deptColor(d.id)}></span>${d.name}</span>
              <span class="bar" aria-hidden="true"><i style=${`width:${pct}%;background:${st[2]}`}></i></span>
              <span class="num" style="text-align:right;color:var(--muted);font-size:13px">${o}</span>
              <span class=${'st-' + st[1]} style="text-align:right;font-size:13px">${st[0]}</span>
            </button>
            ${team === d.id ? html`<div class="teamx">${attention.length ? attention.slice(0, 8).map((t) => html`<${TRow} key=${t.id} ctx=${ctx} t=${t} />`) : html`<p class="empty" style="padding:10px 16px">Nothing late or blocked.</p>`}
              <div style="padding:8px 16px"><a class="linkbtn" href=${'#dept?dept=' + d.id}>Open ${d.name}</a></div></div>` : ''}`)}
        </div>
        ${since.last ? html`<div class="panel"><div class="ph"><h2>Since you last looked</h2><span class="note">${ago(new Date(since.last).toISOString())}</span></div>
          ${since.items.length ? since.items.map((t) => html`<div class="need" style="cursor:pointer" onClick=${() => ctx.openTask(t)}><span class="k">${new Date(t.updated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span><span class="t"><span>${t.title}</span><span>${t.status === 'done' ? 'Done' : t.status === 'blocked' ? 'Blocked' : 'Updated'}, ${first(ctx.person(t.owner_id)?.name)}</span></span></div>`) : html`<p class="empty">No changes.</p>`}</div>` : ''}
      </div>
    </div>`;
}

/* ---------- AI helpers and features ---------- */
async function aiCall(mode, body = {}) {
  try {
    const { data, error } = await sb.functions.invoke('ai', { body: { mode, ...body } });
    if (error) return { error: 'AI request failed. Try again.' };
    return data || { error: 'No response.' };
  } catch (_) { return { error: 'AI request failed. Try again.' }; }
}
const looksLikeQuestion = (q) => /\?\s*$/.test(q) || /^(what|which|who|whose|how|when|why|is|are|any|show|list|give|tell)\b/i.test(q.trim());

/* AI tools strip (Overview) */
function AiTools({ ctx, onOwners }) {
  const [sheet, setSheet] = useState(null);
  const [briefFor, setBriefFor] = useState('');
  return html`<div class="aitools">
    <span class="lab">${I.spark} AI</span>
    ${onOwners ? html`<button class="btn" onClick=${onOwners}>Suggest owners</button>` : ''}
    <button class="btn" onClick=${() => setSheet({ k: 'cleanup' })}>Find duplicates and dead tasks</button>
    <button class="btn" onClick=${() => setSheet({ k: 'notes' })}>Meeting notes to tasks</button>
    <label class="btn" style="padding-right:4px">Prep 1:1
      <select aria-label="Prep a 1:1 brief for" value=${briefFor} onChange=${(e) => { if (e.target.value) { setSheet({ k: 'brief', person: e.target.value }); setBriefFor(''); } }} style="border:none;background:transparent;font:inherit;color:var(--muted);max-width:120px">
        <option value="">with…</option>${ctx.people.filter((p) => p.id !== ctx.me.id).map((p) => html`<option value=${p.id}>${p.name}</option>`)}
      </select></label>
    ${sheet?.k === 'cleanup' ? html`<${CleanupSheet} ctx=${ctx} close=${() => setSheet(null)} />` : ''}
    ${sheet?.k === 'notes' ? html`<${NotesSheet} ctx=${ctx} close=${() => setSheet(null)} />` : ''}
    ${sheet?.k === 'brief' ? html`<${BriefSheet} ctx=${ctx} personId=${sheet.person} close=${() => setSheet(null)} />` : ''}
  </div>`;
}

/* 1. duplicates and dead tasks */
function CleanupSheet({ ctx, deptId, close }) {
  const [res, setRes] = useState(null);
  const [keep, setKeep] = useState({});
  const [closeSel, setCloseSel] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { aiCall('cleanup', deptId ? { department_id: deptId } : {}).then((r) => {
    if (r.error) return setRes(r);
    const k = {}; const c = {};
    r.duplicates = r.duplicates || []; r.stale = r.stale || [];
    r.duplicates.forEach((g, i) => { const ts = g.map((id) => ctx.tasks.find((t) => t.id === id)).filter(Boolean).sort((a, b) => (b.last_update_at || '').localeCompare(a.last_update_at || '') || (a.due_date ? -1 : 1)); if (ts[0]) { k[i] = ts[0].id; ts.slice(1).forEach((t) => (c[t.id] = true)); } });
    r.stale.forEach((s) => (c[s.task_id] = true));
    setKeep(k); setCloseSel(c); setRes(r);
  }); }, []);
  const toClose = Object.keys(closeSel).filter((id) => closeSel[id] && !Object.values(keep).includes(id));
  async function apply() {
    setBusy(true);
    const mergeNotes = [];
    (res.duplicates || []).forEach((g, i) => { const kept = ctx.tasks.find((t) => t.id === keep[i]); g.filter((id) => id !== keep[i] && toClose.includes(id)).forEach((id) => mergeNotes.push({ task_id: id, author_id: ctx.me.id, body: `Closed as a duplicate of “${kept?.title}”` })); });
    if (mergeNotes.length) await sb.from('task_updates').insert(mergeNotes);
    if (toClose.length) await sb.from('tasks').update({ status: 'done', completed_at: new Date().toISOString() }).in('id', toClose);
    setBusy(false); ctx.setToast({ text: `${toClose.length} tasks closed` }); ctx.load(); close();
  }
  const T = (id) => ctx.tasks.find((t) => t.id === id);
  const meta = (t) => `${ctx.dept(t.department_id)?.name}, ${first(ctx.person(t.owner_id)?.name)}${t.task_list_id ? `, ${ctx.list(t.task_list_id)?.name}` : ''}`;
  return html`<div class="scrim" onClick=${close}><div class="sheet wide" role="dialog" aria-modal="true" aria-label="Clean up tasks" onClick=${(e) => e.stopPropagation()}>
    <div class="top"><b class="sheettitle">${I.spark} Duplicates and dead tasks</b><button class="btn ghost" onClick=${close}>Close</button></div>
    ${!res ? html`<p class="note">Reading ${deptId ? 'this department' : 'all open tasks'}… this takes up to half a minute.</p>` : res.error ? html`<p class="err">${res.error}</p>` : html`
      <p class="note">Nothing changes until you apply. Closed tasks move to Done, so they can be reopened.</p>
      <h3 class="sub3">Likely duplicates <span class="muted">${res.duplicates.length} groups</span></h3>
      ${res.duplicates.length ? res.duplicates.map((g, i) => html`<div class="dupgroup">${g.map((id) => { const t = T(id); return t ? html`<label class="duprow">
        <input type="radio" name=${'keep' + i} checked=${keep[i] === id} onChange=${() => { setKeep({ ...keep, [i]: id }); setCloseSel({ ...closeSel, [id]: false, ...Object.fromEntries(g.filter((x) => x !== id).map((x) => [x, true])) }); }} />
        <span class="t">${t.title}<span class="m">${meta(t)}</span></span><span class=${'kc ' + (keep[i] === id ? 'k' : 'c')}>${keep[i] === id ? 'Keep' : 'Close'}</span></label>` : ''; })}</div>`) : html`<p class="note">None found.</p>`}
      <h3 class="sub3">Probably dead <span class="muted">${res.stale.length}</span></h3>
      ${res.stale.length ? res.stale.map((s) => { const t = T(s.task_id); return t ? html`<label class="duprow"><input type="checkbox" checked=${!!closeSel[t.id]} onChange=${() => setCloseSel({ ...closeSel, [t.id]: !closeSel[t.id] })} /><span class="t">${t.title}<span class="m">${meta(t)}, ${s.why}</span></span><span class=${'kc ' + (closeSel[t.id] ? 'c' : 'k')}>${closeSel[t.id] ? 'Close' : 'Keep'}</span></label>` : ''; }) : html`<p class="note">None found.</p>`}
      <div class="actions" style="margin-top:8px"><button class="btn primary big" disabled=${busy || !toClose.length} onClick=${apply}>${busy ? 'Closing…' : `Close ${toClose.length} tasks`}</button><button class="btn ghost big" onClick=${close}>Cancel</button></div>`}
  </div></div>`;
}

/* 2. meeting notes to tasks */
function NotesSheet({ ctx, deptId, initialText, close }) {
  const [text, setText] = useState(initialText || '');
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ownerDept = (pid) => ctx.ownerDept(pid);
  async function extract() {
    setBusy(true); setErr('');
    const r = await aiCall('extract', { text, department_id: deptId || null });
    setBusy(false);
    if (r.error) return setErr(r.error);
    if (!r.items?.length) return setErr('No action items found in those notes.');
    setRows(r.items.map((x) => ({ ...x, on: true, owner_id: x.owner_id || ctx.me.id, department_id: x.department_id || ownerDept(x.owner_id) || deptId || ctx.myDepts[0] || ctx.depts[0].id })));
  }
  useEffect(() => { if (initialText) extract(); }, []);
  const upd = (i, k, v) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v, ...(k === 'owner_id' && !deptId ? { department_id: ownerDept(v) || r.department_id, task_list_id: null } : {}) } : r)));
  const ready = (rows || []).filter((r) => r.on && r.title.trim() && r.due_date);
  async function add() {
    setBusy(true);
    const { error } = await sb.from('tasks').insert(ready.map((r) => ({ title: r.title.trim(), owner_id: r.owner_id, due_date: r.due_date, priority: r.priority || 'P2', department_id: r.department_id, task_list_id: r.task_list_id || null, created_by: ctx.me.id, source: 'app' })));
    setBusy(false);
    if (error) return setErr(error.message);
    ctx.setToast({ text: `${ready.length} tasks added` }); ctx.load(); close();
  }
  return html`<div class="scrim" onClick=${close}><div class="sheet wide" role="dialog" aria-modal="true" aria-label="Meeting notes to tasks" onClick=${(e) => e.stopPropagation()}>
    <div class="top"><b class="sheettitle">${I.spark} Meeting notes to tasks</b><button class="btn ghost" onClick=${close}>Close</button></div>
    ${!rows ? html`
      <p class="note">Paste notes, a transcript or a WhatsApp summary. Each action becomes a task with an owner (by name, or by who handles that area) and a date if one is mentioned.</p>
      <textarea class="field" style="min-height:220px" aria-label="Meeting notes" placeholder="Franchise Sales review, 29 Oct&#10;- Vivek to call back all Jaipur leads by Friday&#10;- Soumay: fix call centre script, urgent&#10;- Expo stall budget to be finalised next week" value=${text} onInput=${(e) => setText(e.target.value)}></textarea>
      ${err ? html`<p class="err">${err}</p>` : ''}
      <div class="actions"><button class="btn primary big" disabled=${busy || text.trim().length < 5} onClick=${extract}>${busy ? 'Reading notes…' : 'Find action items'}</button></div>`
    : html`
      <p class="note">${rows.length} action items found. Check owners and dates; rows without a deadline are skipped.</p>
      ${rows.map((r, i) => html`<div class="bulkrow notesrow">
        <input type="checkbox" class="cbox" style="opacity:1" checked=${r.on} aria-label="Include" onChange=${() => upd(i, 'on', !r.on)} />
        <input class="field" aria-label="Task" value=${r.title} onInput=${(e) => upd(i, 'title', e.target.value)} />
        <select class="field" aria-label="Owner" onChange=${(e) => upd(i, 'owner_id', e.target.value)}>${ctx.people.map((p) => html`<option value=${p.id} selected=${r.owner_id === p.id}>${p.name}</option>`)}</select>
        <input type="date" class=${'field' + (r.due_date ? '' : ' missing')} aria-label="Deadline" value=${r.due_date} onChange=${(e) => upd(i, 'due_date', e.target.value)} />
        <select class="field" aria-label="Priority" onChange=${(e) => upd(i, 'priority', e.target.value)}>${['P1', 'P2', 'P3'].map((p) => html`<option value=${p} selected=${r.priority === p}>${PRI[p]}</option>`)}</select>
        <select class="field" aria-label="Department" onChange=${(e) => upd(i, 'department_id', e.target.value)}>${ctx.depts.map((d) => html`<option value=${d.id} selected=${r.department_id === d.id}>${d.name}</option>`)}</select>
      </div>`)}
      ${err ? html`<p class="err">${err}</p>` : ''}
      <div class="actions"><button class="btn primary big" disabled=${busy || !ready.length} onClick=${add}>Add ${ready.length} tasks</button><button class="btn ghost big" onClick=${() => setRows(null)}>Back to notes</button></div>`}
  </div></div>`;
}

/* 3. prep briefs */
function BriefSheet({ ctx, personId, deptId, close }) {
  const [res, setRes] = useState(null);
  useEffect(() => { aiCall('brief', personId ? { person_id: personId } : { department_id: deptId }).then(setRes); }, []);
  const name = personId ? ctx.person(personId)?.name : ctx.dept(deptId)?.name;
  return html`<div class="scrim" onClick=${close}><div class="sheet" role="dialog" aria-modal="true" aria-label="Prep brief" onClick=${(e) => e.stopPropagation()}>
    <div class="top"><b class="sheettitle">${I.spark} ${personId ? `1:1 with ${name}` : `${name} review`}</b><button class="btn ghost" onClick=${close}>Close</button></div>
    ${personId && ctx.person(personId)?.handles ? html`<p class="note">${ctx.person(personId).handles}</p>` : ''}
    ${!res ? html`<p class="note">Reading tasks and updates…</p>` : res.error ? html`<p class="err">${res.error}</p>` : html`
      <div class="figs" style="padding:0;grid-template-columns:repeat(4,minmax(0,1fr))">${[['Open', res.counts?.open ?? 0], ['Late', res.counts?.late ?? 0], ['Blocked', res.counts?.blocked ?? 0], ['Done, 14 days', res.counts?.done ?? 0]].map(([l, n]) => html`<div class="fig"><b>${n}</b><span>${l}</span></div>`)}</div>
      <div><span class="lbl">Where things stand</span><ul class="brief">${(res.lines || []).map((l) => html`<li>${l}</li>`)}</ul></div>
      <div><span class="lbl">Ask</span><ul class="brief q">${(res.questions || []).map((l) => html`<li>${l}</li>`)}</ul></div>
      <div class="actions"><a class="btn" href=${'#all?q=' + encodeURIComponent(personId ? name : name)} onClick=${close}>See ${personId ? 'their' : 'the'} tasks</a>${personId ? html`<button class="btn" onClick=${() => { navigator.clipboard?.writeText(`1:1 with ${name}\n${res.lines.map((l) => '- ' + l).join('\n')}\nAsk:\n${res.questions.map((l) => '- ' + l).join('\n')}`); ctx.setToast({ text: 'Copied' }); }}>Copy</button>` : ''}</div>`}
  </div></div>`;
}

/* 4. suggestions after an update */
function Hints({ ctx, hint, done }) {
  const { t, r } = hint;
  const [left, setLeft] = useState(() => {
    const out = [];
    if (r.done) out.push({ k: 'done', label: 'Sounds finished. Mark done?' });
    if (r.blocked) out.push({ k: 'blocked', label: `Mark blocked${r.waiting_on ? ` on ${first(ctx.person(r.waiting_on)?.name)}` : ''}${r.reason ? `: ${r.reason}` : ''}?` });
    if (r.new_date) out.push({ k: 'date', label: `${ctx.canRedate(t) ? 'Move deadline' : 'Ask to move the deadline'} to ${fmtDate(r.new_date)}?` });
    (r.new_tasks || []).forEach((x) => out.push({ k: 'task', title: x, label: `Add task: ${x}` }));
    return out;
  });
  useEffect(() => { if (!left.length) done(); const tm = setTimeout(done, 15000); return () => clearTimeout(tm); }, [left.length]);
  async function act(h) {
    if (h.k === 'done') await ctx.done(t);
    if (h.k === 'blocked') await ctx.update(t.id, { status: 'blocked', blocked_on_person_id: r.waiting_on || null, blocked_reason: r.reason || null }, 'Marked blocked');
    if (h.k === 'date') {
      if (ctx.canRedate(t)) await ctx.update(t.id, { due_date: r.new_date }, `Moved to ${fmtDate(r.new_date)}`);
      else { await sb.from('date_change_requests').insert({ task_id: t.id, requested_by: ctx.me.id, current_due: t.due_date, proposed_due: r.new_date, reason: 'From update' }); ctx.setToast({ text: 'Date change requested' }); ctx.load(); }
    }
    if (h.k === 'task') { await sb.from('tasks').insert({ title: h.title, owner_id: t.owner_id, created_by: ctx.me.id, department_id: t.department_id, task_list_id: t.task_list_id, priority: 'P2', due_date: t.due_date || addDays(today(), 7), source: 'app' }); ctx.setToast({ text: 'Task added' }); ctx.load(); }
    setLeft((l) => l.filter((x) => x !== h));
  }
  return html`<div class="hints" role="status"><div class="hh">${I.spark} From your update on “${t.title.slice(0, 50)}”<button class="iconbtn" aria-label="Dismiss" onClick=${done}>✕</button></div>
    ${left.map((h) => html`<div class="hrow"><span>${h.label}</span><button class="btn primary" onClick=${() => act(h)}>Yes</button><button class="btn ghost" onClick=${() => setLeft((l) => l.filter((x) => x !== h))}>No</button></div>`)}
  </div>`;
}
/* ---------- smart composer: everything from the add box ---------- */
const DAYW = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAYFULL = { monday: 'mon', tuesday: 'tue', wednesday: 'wed', thursday: 'thu', friday: 'fri', saturday: 'sat', sunday: 'sun', tues: 'tue', thur: 'thu', thurs: 'thu', weds: 'wed' };
const MONTHS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december';
function parseDateWords(s) {
  const t = today();
  const rules = [
    [/\b(?:by |on |before |due )?(?:eod|end of day|today|tonight)\b/i, () => t],
    [/\b(?:by |on |before |due )?(?:tomorrow|tmrw|tmr|tom)\b/i, () => addDays(t, 1)],
    [/\b(?:by |before )?(?:eow|end of (?:the )?week|this week)\b/i, () => (dow(t) <= 4 ? addDays(t, 4 - dow(t)) : nextDow(4))],
    [/\b(?:by |before )?next week\b/i, () => nextDow(0)],
    [/\b(?:by |before )?(?:eom|end of (?:the )?month)\b/i, () => { const d = new Date(Date.parse(t)); return ymd(new Date(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)); }],
    [/\b(?:in )?\+?(\d{1,2}) ?(days?|d)\b/i, (m) => addDays(t, +m[1])],
    [/\b(?:in )?\+?(\d{1,2}) ?(weeks?|w)\b/i, (m) => addDays(t, +m[1] * 7)],
    [/(?:^|\s)\+(\d{1,2})\b/, (m) => addDays(t, +m[1])],
    [new RegExp(`\\b(?:by |on |before |due )?(?:the )?(\\d{1,2})(?:st|nd|rd|th)?(?: of)? (${MONTHS})(?:,? (20\\d\\d))?\\b`, 'i'), (m) => m[3] ? ymd(new Date(Date.parse(`${m[1]} ${m[2].slice(0, 3)} ${m[3]}`))) : parseQuick(`${m[1]} ${m[2].slice(0, 3)}`)],
    [new RegExp(`\\b(?:by |on |before |due )?(${MONTHS}) (\\d{1,2})(?:st|nd|rd|th)?(?:,? (20\\d\\d))?\\b`, 'i'), (m) => m[3] ? ymd(new Date(Date.parse(`${m[2]} ${m[1].slice(0, 3)} ${m[3]}`))) : parseQuick(`${m[2]} ${m[1].slice(0, 3)}`)],
    [/\b(?:by |before )?(?:this |the )?weekend\b/i, () => (dow(t) < 5 ? addDays(t, 5 - dow(t)) : nextDow(5))],
    [/\b(?:by |on |before |due )(?:the )?(\d{1,2})(?:st|nd|rd|th)\b/i, (m) => { const d = new Date(Date.parse(t)); let y = d.getUTCFullYear(), mo = d.getUTCMonth(); if (+m[1] < d.getUTCDate()) { mo += 1; if (mo > 11) { mo = 0; y += 1; } } const r = new Date(y, mo, +m[1]); return r.getMonth() === mo ? ymd(r) : null; }],
    [/\b(?:by |on |before |due )?(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/, (m) => { let y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear(); let d = `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`; if (!m[3] && d < t) d = `${y + 1}${d.slice(4)}`; return isNaN(Date.parse(d)) || +m[2] > 12 ? null : d; }],
    [/\b(?:by |on |before |due )?(next )?(mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)(?:day|nesday|sday|urday)?\b/i, (m) => { const k = DAYFULL[m[2].toLowerCase()] || m[2].toLowerCase().slice(0, 3); return parseQuick((m[1] ? 'next ' : '') + k); }],
  ];
  for (const [re, fn] of rules) { const m = s.match(re); if (m) { const d = fn(m); if (d) return { date: d, match: m[0] }; } }
  return null;
}
const STOP = new Set('a an the and or of for to in on at by with from into about this that these those is are be been was were will shall should must need needs do done get make send share take give follow up all new our my your his her their its it as per via vs call review check plan update fix prepare create discuss finalise finalize revise meeting report list task work team weekly monthly daily today tomorrow week month store stores'.split(' '));
const stem = (w) => w.replace(/(ings|ing|ies|es|s|ed|ly)$/i, (m) => (m === 'ies' ? 'y' : '')).replace(/[^a-z0-9]/g, '');
const tokens = (s) => [...new Set((s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)).map(stem).filter((w) => w.length > 2))];
const lev1 = (a, b) => { if (a.length === b.length) { const d = [...a].map((c, i) => (c !== b[i] ? i : -1)).filter((i) => i >= 0); if (d.length === 2 && d[1] === d[0] + 1 && a[d[0]] === b[d[1]] && a[d[1]] === b[d[0]]) return true; } if (Math.abs(a.length - b.length) > 1) return false; let i = 0, j = 0, e = 0; while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++e > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } } return e + (a.length - i) + (b.length - j) <= 1; };
function nameIndex(people) {
  const idx = {};
  const add = (k, id) => { (idx[k] ||= new Set()).add(id); };
  people.forEach((p) => { const parts = p.name.toLowerCase().split(/\s+/).filter((w) => w.length > 1); parts.forEach((w) => add(w, p.id)); add(p.name.toLowerCase(), p.id); });
  return idx;
}
function findPerson(word, people, idx) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '').replace(/s$/, (m) => (idx[word.toLowerCase().replace(/[^a-z]/g, '')] ? m : ''));
  if (w.length < 3) return null;
  const hit = idx[w] || idx[word.toLowerCase().replace(/[^a-z]/g, '')];
  if (hit && hit.size === 1) return [...hit][0];
  if (w.length >= 5 && !hit) { const near = Object.keys(idx).filter((k) => !k.includes(' ') && k.length >= 5 && lev1(k, w) && idx[k].size === 1); if (near.length === 1) return [...idx[near[0]]][0]; }
  return null;
}
// suggest a task list from where similar tasks already sit
function suggestList(title, ctx, deptId, ownerId) {
  const tt = tokens(title);
  if (!tt.length) return null;
  const pool = ctx.tasks.filter((t) => t.task_list_id && (!deptId || t.department_id === deptId));
  const score = {};
  for (const t of pool) {
    const ov = tokens(t.title).filter((w) => tt.includes(w)).length;
    if (!ov) continue;
    const k = t.task_list_id;
    score[k] = score[k] || [];
    score[k].push(ov + (ownerId && t.owner_id === ownerId ? 0.5 : 0));
  }
  for (const l of ctx.lists.filter((l) => !deptId || l.department_id === deptId)) {
    const lv = tokens(l.name).filter((w) => tt.includes(w)).length;
    if (lv) (score[l.id] ||= []).push(lv * 2.5);
  }
  const ranked = Object.entries(score).map(([k, v]) => [k, v.sort((a, b) => b - a).slice(0, 3).reduce((x, y) => x + y, 0)]).sort((a, b) => b[1] - a[1]);
  if (!ranked.length || ranked[0][1] < 2) return null;
  if (ranked[1] && ranked[1][1] >= ranked[0][1] * 0.85) return null;
  const l = ctx.list(ranked[0][0]);
  return l ? { task_list_id: l.id, department_id: l.department_id } : null;
}
function parseTaskText(raw, ctx) {
  let s = ` ${raw} `;
  const out = { owner_id: null, due_date: null, priority: null, department_id: null, task_list_id: null };
  const cut = (str) => { s = s.replace(str, ' '); };
  // priority (low first so "not urgent" is not read as urgent)
  const low = s.match(/[\s,(]!(3|low)\b|[\s,(](not urgent|no rush|no hurry|low[- ]priority|whenever possible|whenever|when free|p3)\b/i);
  if (low) { out.priority = 'P3'; cut(low[0]); }
  else {
    const hi = s.match(/[\s,(]!(1|urgent|high)\b|[\s,(](urgently|urgent|asap|a\.s\.a\.p|immediately|immediate|right away|critical|top[- ]priority|high[- ]priority|priority|important|p1)\b/i);
    if (hi) { out.priority = 'P1'; cut(hi[0]); }
    else { const mid = s.match(/[\s,(]!(2|normal|medium)\b|[\s,(](normal priority|medium priority|p2)\b/i); if (mid) { out.priority = 'P2'; cut(mid[0]); } }
  }
  // explicit @owner and #place tokens
  const idx = nameIndex(ctx.people);
  const at = s.match(/\s@([a-z][\w.-]*)/i);
  if (at) { const q = at[1].toLowerCase(); const hit = ctx.people.filter((p) => p.name.toLowerCase().split(' ').some((w) => w.startsWith(q))); if (hit.length === 1) { out.owner_id = hit[0].id; cut(at[0]); } }
  const hash = s.match(/\s#([\w&/-]+)/i);
  if (hash) {
    const q = hash[1].toLowerCase().replace(/[-_]/g, ' ');
    const lists = ctx.lists.filter((l) => l.name.toLowerCase().startsWith(q) || l.name.toLowerCase().includes(q));
    const depts = ctx.depts.filter((d) => d.name.toLowerCase().startsWith(q) || d.name.toLowerCase().split(' ').some((w) => w.startsWith(q)));
    if (lists.length === 1) { out.task_list_id = lists[0].id; out.department_id = lists[0].department_id; cut(hash[0]); }
    else if (depts.length === 1) { out.department_id = depts[0].id; cut(hash[0]); }
  }
  // date words
  const dm = parseDateWords(s);
  if (dm) { out.due_date = dm.date; cut(dm.match); }
  // owner in plain words, anywhere in the sentence
  if (!out.owner_id) {
    const words = s.trim().split(/\s+/);
    const OWNER_BEFORE = ['by', 'for', 'ask', 'tell', 'remind', 'get', 'have', 'assign', 'assigned', 'owner', 'owned', '->', '→', 'over', 'let'];
    const NOT_OWNER_BEFORE = ['with', 'from', 'cc', 'and', 'call', 'ping', 'email', 'mail', 'meet', 'message', 'inform', 'update', 'brief', 'show', 'send', 'share', 'copy', 'loop', 'about', 'of'];
    let best = null;
    for (let i = 0; i < words.length; i++) {
      const raw = words[i].replace(/^[("'\[]+|[)"'\],.:;!?]+$/g, '');
      const two = (raw + ' ' + (words[i + 1] || '').replace(/[,.:;!?)]+$/, '')).toLowerCase();
      let id = idx[two] && idx[two].size === 1 ? [...idx[two]][0] : findPerson(raw.replace(/'s$/i, ''), ctx.people, idx);
      if (!id) continue;
      const prev = (words[i - 1] || '').toLowerCase().replace(/[^a-z>→-]/g, '');
      const next = (words[i + 1] || '').toLowerCase().replace(/[^a-z:]/g, '');
      const strong = i === 0 || OWNER_BEFORE.includes(prev) || ['to', 'will', 'should', 'must', 'needs', 'can', 'pls', 'please', 'to:'].includes(next) || /^\(.+\)$/.test(words[i]) || /'s$/i.test(raw) || /:$/.test(words[i]);
      const weak = !NOT_OWNER_BEFORE.includes(prev) && prev !== 'to';
      const sc = strong ? 2 : weak ? 1 : 0;
      if (sc && (!best || sc > best.sc)) best = { id, i, sc, two: idx[two] && idx[two].size === 1 };
    }
    if (best) {
      out.owner_id = best.id;
      const w = words[best.i]; const w2 = best.two ? ' ' + words[best.i + 1] : '';
      const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`\\s(?:ask |tell |remind |get |have |let |assign(?:ed)? (?:to )?|owner:? |owned by |for |by |-> |→ )?${esc(w + w2)}(?:'s)?(?: (?:to|will|should|must|needs to|can|pls|please)\\b)?:?\\s`, 'i');
      s = s.replace(re, ' ');
    }
  }
  // plain-word department or list name
  if (!out.department_id) {
    const lowS = s.toLowerCase();
    const d = [...ctx.depts].sort((a, b) => b.name.length - a.name.length).find((x) => lowS.includes(` ${x.name.toLowerCase()} `));
    if (d) { out.department_id = d.id; s = s.replace(new RegExp(`\\s(?:in |for |under )?${d.name}\\s`, 'i'), ' '); }
  }
  let title = s.replace(/\s+/g, ' ').replace(/\s([,.;:])/g, '$1').trim()
    .replace(/^(to|and|please|pls|kindly|-|:)\s+/i, '')
    .replace(/\s*(?:,\s*)?(?:has |have )?(?:to be|should be|needs to be|need to be|must be|will be|is to be)\s+(?:done|completed|finished|closed|sent|shared|submitted|finalised|finalized)\s*$/i, '')
    .replace(/\s*(?:,\s*)?(?:to be|should be|needs to be|must be)\s*$/i, '')
    .replace(/[,;:\s-]+$/, '').replace(/^[,;:\s-]+/, '');
  if (title) title = title[0].toUpperCase() + title.slice(1);
  return { ...out, title };
}

function Composer({ ctx, deptHint, listHint }) {
  const [text, setText] = useState('');
  const [ov, setOv] = useState({});
  const [ai, setAi] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [pop, setPop] = useState(null);
  const [ac, setAc] = useState(null);
  const [acI, setAcI] = useState(0);
  const [sticky, setSticky] = useState(null);
  const [busy, setBusy] = useState(false);
  const inRef = useRef();
  const wrapRef = useRef();
  const aiTimer = useRef();
  const ctxDefault = { department_id: deptHint || null, task_list_id: deptHint && listHint && listHint !== 'none' ? listHint : null };

  useEffect(() => {
    const k = (e) => { if (e.key === 'n' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); inRef.current?.focus(); } };
    const c = (e) => { const d = e.detail || {}; if (typeof d === 'string') setText(d); else { if (d.text) setText(d.text); setOv((o) => ({ ...o, ...(d.ov || {}) })); } setTimeout(() => inRef.current?.focus(), 0); };
    const out = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setPop(null); };
    window.addEventListener('keydown', k); document.addEventListener('bs-compose', c); document.addEventListener('mousedown', out);
    return () => { window.removeEventListener('keydown', k); document.removeEventListener('bs-compose', c); document.removeEventListener('mousedown', out); };
  }, []);

  const parsed = useMemo(() => parseTaskText(text, ctx), [text, ctx.people, ctx.lists, ctx.depts]);
  const pick = (k) => ov[k] ?? sticky?.[k] ?? parsed[k] ?? (ai && ai.text === text ? ai[k] : null);
  const owner_id = pick('owner_id') || ctx.me.id;
  const priority = pick('priority') || 'P2';
  const due_date = pick('due_date');
  const baseDept = ov.department_id || sticky?.department_id || parsed.department_id || ctxDefault.department_id || null;
  const guess = useMemo(() => (parsed.title && parsed.title.split(' ').length >= 2 ? suggestList(parsed.title, ctx, baseDept, ov.owner_id || parsed.owner_id) : null), [parsed.title, baseDept, ov.owner_id, parsed.owner_id, ctx.tasks.length]);
  const list_id = ov.task_list_id !== undefined ? ov.task_list_id : (sticky?.task_list_id ?? parsed.task_list_id ?? (ai && ai.text === text ? ai.task_list_id : null) ?? ctxDefault.task_list_id ?? guess?.task_list_id ?? null);
  const listGuessed = ov.task_list_id === undefined && !sticky?.task_list_id && !parsed.task_list_id && !ctxDefault.task_list_id && guess && list_id === guess.task_list_id;
  const dept_id = ov.department_id || (list_id && ctx.list(list_id)?.department_id) || sticky?.department_id || parsed.department_id || (ai && ai.text === text ? ai.department_id : null) || ctxDefault.department_id || ctx.ownerDept(owner_id) || ctx.myDepts[0] || ctx.depts[0]?.id;
  const title = (ai && ai.text === text && ai.title && (!parsed.title || parsed.title.split(' ').length > ai.title.split(' ').length + 3)) ? ai.title : parsed.title;
  const fromAi = (k) => !ov[k] && !parsed[k] && ai && ai.text === text && ai[k];

  // AI backstop for long sentences the instant reader can't fully place
  useEffect(() => {
    clearTimeout(aiTimer.current);
    const words = text.trim().split(/\s+/).length;
    if (words < 5 || (parsed.owner_id || ov.owner_id) && (parsed.due_date || ov.due_date)) return;
    aiTimer.current = setTimeout(async () => {
      setAiBusy(true);
      try {
        const { data } = await sb.functions.invoke('quick-add', { body: { text, today: today() } });
        if (data && !data.fallback && !data.error) setAi({ ...data, text });
      } catch (_) {}
      setAiBusy(false);
    }, 900);
    return () => clearTimeout(aiTimer.current);
  }, [text]);

  // autocomplete for @ and #
  function onInput(e) {
    const v = e.target.value; setText(v);
    if (!v.trim()) { setOv({}); setAi(null); }
    const pos = e.target.selectionStart; const before = v.slice(0, pos);
    const m = before.match(/(?:^|\s)([@#])([\w&/-]*)$/);
    if (m) setAc({ kind: m[1], q: m[2].toLowerCase(), start: pos - m[2].length - 1, end: pos }); else setAc(null);
    setAcI(0);
  }
  const acOpts = !ac ? [] : ac.kind === '@'
    ? ctx.people.filter((p) => p.name.toLowerCase().split(' ').some((w) => w.startsWith(ac.q)) || p.name.toLowerCase().startsWith(ac.q)).slice(0, 7).map((p) => ({ label: p.name, sub: ctx.dept(ctx.ownerDept(p.id))?.name || '', apply: { owner_id: p.id } }))
    : [...ctx.lists.filter((l) => l.name.toLowerCase().includes(ac.q.replace(/[-_]/g, ' '))).map((l) => ({ label: l.name, sub: ctx.dept(l.department_id)?.name, apply: { task_list_id: l.id, department_id: l.department_id } })),
       ...ctx.depts.filter((d) => d.name.toLowerCase().includes(ac.q)).map((d) => ({ label: d.name, sub: 'Department', apply: { department_id: d.id, task_list_id: null } }))].slice(0, 8);
  function chooseAc(o) {
    if (!o) return;
    setText((t) => (t.slice(0, ac.start) + t.slice(ac.end)).replace(/\s{2,}/g, ' '));
    setOv((x) => ({ ...x, ...o.apply })); setAc(null);
    setTimeout(() => inRef.current?.focus(), 0);
  }

  async function submit(keep) {
    if (!title || busy) return;
    if (!due_date) { setPop('date'); return; }
    setBusy(true);
    const row = { title, owner_id, due_date, priority, department_id: dept_id, task_list_id: list_id && ctx.list(list_id)?.department_id === dept_id ? list_id : null, created_by: ctx.me.id, source: 'app' };
    const { data: saved, error } = await sb.from('tasks').insert(row).select().single();
    setBusy(false);
    if (error) return ctx.setToast({ text: error.message });
    ctx.setToast({ text: `Added: ${row.title} → ${row.owner_id === ctx.me.id ? 'you' : first(ctx.person(row.owner_id)?.name)}, ${shortDue(row.due_date)}`,
      action: { label: 'Edit', fn: () => ctx.setSheet({ mode: 'edit', id: saved.id }) },
      undo: async () => { await sb.from('tasks').delete().eq('id', saved.id); ctx.load(); } });
    setSticky(keep ? { owner_id: ov.owner_id || parsed.owner_id || null, task_list_id: list_id, department_id: dept_id } : null);
    setText(''); setOv({}); setAi(null); setPop(null); setAc(null);
    ctx.load();
    setTimeout(() => inRef.current?.focus(), 0);
  }
  function onKey(e) {
    if (ac && acOpts.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); return setAcI(Math.min(acI + 1, acOpts.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); return setAcI(Math.max(acI - 1, 0)); }
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); return chooseAc(acOpts[acI]); }
      if (e.key === 'Escape') { e.preventDefault(); return setAc(null); }
    }
    if (e.key === 'Enter') { e.preventDefault(); submit(e.shiftKey); }
    if (e.key === 'Escape') { if (pop) setPop(null); else if (sticky) setSticky(null); else { setText(''); setOv({}); e.target.blur(); } }
  }
  function onPaste(e) {
    const txt = e.clipboardData?.getData('text') || '';
    if (txt.split(/\r?\n/).filter((l) => l.trim()).length > 1) { e.preventDefault(); ctx.setSheet({ mode: 'notes', text: txt, dept: deptHint }); }
  }
  const setO = (k, v) => { setOv((x) => ({ ...x, ...k })); setPop(null); setTimeout(() => inRef.current?.focus(), 0); };
  const td = today();
  const show = text.trim() || sticky || Object.keys(ov).length;
  const placeLabel = list_id && ctx.list(list_id)?.department_id === dept_id ? `${ctx.dept(dept_id)?.name} / ${ctx.list(list_id)?.name}` : ctx.dept(dept_id)?.name;
  const onP = ctx.person(owner_id);

  return html`<div class="composer" ref=${wrapRef}>
    <div class="cbox2">
      ${ac && acOpts.length ? html`<div class="acpop" role="listbox">${acOpts.map((o, n) => html`<button class="opt" role="option" aria-selected=${n === acI} onMouseDown=${(e) => { e.preventDefault(); chooseAc(o); }}>${ac.kind === '@' ? html`<${Avatar} ctx=${ctx} id=${o.apply.owner_id} size=${20} />` : o.apply.task_list_id ? html`<${LIcon} name=${o.label} sm />` : html`<span class="ddot" style=${'background:' + ctx.deptColor(o.apply.department_id)}></span>`}${o.label}<span class="r">${o.sub}</span></button>`)}<div class="achint">Tab or Enter to pick</div></div>` : null}
      ${pop ? html`<div class="chippop">
        ${pop === 'date' ? html`<span class="note">${due_date ? 'Change date' : 'When is it due?'}</span><div class="qchips">${[['Today', td], ['Tomorrow', addDays(td, 1)], ['Fri', parseQuick('fri')], ['Mon', nextDow(0)], ['+1 week', addDays(td, 7)], ['End of month', parseDateWords('eom').date]].map(([l, d]) => html`<button class="qchip" aria-pressed=${due_date === d} onClick=${() => setO({ due_date: d })}>${l}</button>`)}</div><input type="date" class="field" aria-label="Pick a date" min=${td} onChange=${(e) => e.target.value && setO({ due_date: e.target.value })} />` : null}
        ${pop === 'owner' ? html`<${OwnerList} ctx=${ctx} onPick=${(p) => setO({ owner_id: p.id })} />` : null}
        ${pop === 'prio' ? html`<${PrioritySlider} always value=${priority} onChange=${(p) => setO({ priority: p })} />` : null}
        ${pop === 'place' ? html`<${PlacePicker} ctx=${ctx} onPick=${(d, l) => setO({ department_id: d, task_list_id: l })} />` : null}
      </div>` : null}
      ${show ? html`<div class="cchips" aria-label="Task details">
        <button class=${'cchip' + (ov.owner_id || parsed.owner_id ? ' set' : '') + (fromAi('owner_id') ? ' ai' : '')} onClick=${() => setPop(pop === 'owner' ? null : 'owner')} title="Owner (type @name)"><${Avatar} ctx=${ctx} id=${owner_id} size=${18} />${owner_id === ctx.me.id ? 'Me' : first(onP?.name)}</button>
        <button class=${'cchip' + (due_date ? ' set' : ' need') + (fromAi('due_date') ? ' ai' : '')} onClick=${() => setPop(pop === 'date' ? null : 'date')} title="Due date (type fri, tomorrow, 12 nov)">${I.cal}${due_date ? fmtDate(due_date) : 'Add date'}</button>
        <button class=${'cchip prio-' + priority + (ov.priority || parsed.priority ? ' set' : '')} onClick=${() => setPop(pop === 'prio' ? null : 'prio')} title="Priority (type !1, !2, !3 or urgent)">${PRI[priority]}</button>
        <button class=${'cchip' + (ov.department_id || ov.task_list_id || parsed.department_id || list_id ? ' set' : '') + (fromAi('department_id') || listGuessed ? ' ai' : '')} onClick=${() => setPop(pop === 'place' ? null : 'place')} title=${listGuessed ? 'List suggested from where similar tasks sit. Click to change.' : 'Department or list (type #name)'}>${listGuessed ? I.spark : null}<span class="ddot" style=${'background:' + ctx.deptColor(dept_id)}></span>${placeLabel}</button>
        ${aiBusy ? html`<span class="cnote">${I.spark} reading…</span>` : null}
        ${sticky ? html`<span class="cnote">Adding more for ${first(ctx.person(sticky.owner_id || ctx.me.id)?.name)}, Esc to stop</span>` : null}
      </div>` : null}
      <form onSubmit=${(e) => { e.preventDefault(); submit(false); }}>
        <label class="sr" for="composer">Add a task</label>
        <input id="composer" ref=${inRef} autocomplete="off" value=${text} onInput=${onInput} onKeyDown=${onKey} onPaste=${onPaste}
          placeholder=${sticky ? 'Next task…' : 'Add a task: Call Jaipur leads @vivek fri !1 #daily'} />
        ${title && title.toLowerCase() !== text.trim().toLowerCase() ? html`<span class="ctitle" title="Task title">→ ${title.length > 40 ? title.slice(0, 40) + '…' : title}</span>` : null}
        <button type="submit" aria-label=${due_date ? 'Add task' : 'Add task, pick a date first'} disabled=${busy || !title}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg></button>
      </form>
      ${show ? html`<div class="ckeys"><kbd>Enter</kbd> add · <kbd>Shift</kbd>+<kbd>Enter</kbd> add another · <kbd>@</kbd> owner · <kbd>#</kbd> list · <kbd>!1</kbd> urgent</div>` : null}
    </div>
  </div>`;
}
function PlacePicker({ ctx, onPick }) {
  const [q, setQ] = useState('');
  const s = q.toLowerCase();
  const depts = ctx.depts.filter((d) => !s || d.name.toLowerCase().includes(s) || ctx.lists.some((l) => l.department_id === d.id && l.name.toLowerCase().includes(s)));
  return html`<input class="field" placeholder="Department or list…" aria-label="Search departments and lists" value=${q} onInput=${(e) => setQ(e.target.value)} ref=${(el) => el && !q && setTimeout(() => el.focus(), 0)} />
    <div class="opts">${depts.map((d) => html`<div>
      <button class="opt" style="font-weight:600" onClick=${() => onPick(d.id, null)}><span class="ddot" style=${'background:' + ctx.deptColor(d.id)}></span>${d.name}</button>
      ${ctx.lists.filter((l) => l.department_id === d.id && (!s || l.name.toLowerCase().includes(s) || d.name.toLowerCase().includes(s))).map((l) => html`<button class="opt" style="padding-left:26px" onClick=${() => onPick(d.id, l.id)}><${LIcon} name=${l.name} sm />${l.name}</button>`)}
    </div>`)}</div>`;
}
/* ---------- task sheet: new task (explicit add) and task panel (autosave) ---------- */

function TaskSheet({ ctx, sheet, close }) {
  if (sheet.mode === 'new') return html`<${NewTask} ctx=${ctx} pre=${sheet.prefill || {}} close=${close} />`;
  if (sheet.mode === 'bulk') return html`<${BulkAdd} ctx=${ctx} lines=${sheet.lines} close=${close} />`;
  if (sheet.mode === 'notes') return html`<${NotesSheet} ctx=${ctx} deptId=${sheet.dept} initialText=${sheet.text} close=${close} />`;
  return html`<${TaskPanel} key=${sheet.id} ctx=${ctx} id=${sheet.id} close=${close} />`;
}

function DeadlineField({ value, onChange, disabled }) {
  const td = today();
  const chips = [['Today', td], ['Tomorrow', addDays(td, 1)], ['Fri', parseQuick('fri')], ['Mon', nextDow(0)], ['+1 week', addDays(td, 7)]];
  const [txt, setTxt] = useState('');
  const guess = parseQuick(txt);
  return html`<div>
    ${!disabled ? html`<div class="qchips" style="margin-bottom:8px">${chips.map(([l, d]) => html`<button type="button" class="qchip" aria-pressed=${value === d} onClick=${() => onChange(d)}>${l}</button>`)}</div>` : ''}
    <div class="grid2">
      <input type="date" class="field" aria-label="Deadline date" value=${value || ''} disabled=${disabled} onChange=${(e) => e.target.value && onChange(e.target.value)} />
      ${!disabled ? html`<input class="field" placeholder="or type fri, +7, 12 nov" aria-label="Type a date" value=${txt} onInput=${(e) => setTxt(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter' && guess) { onChange(guess); setTxt(''); } }} />` : ''}
    </div>
    ${txt && !disabled ? html`<p class="note">${guess ? `Enter for ${fmtDate(guess)}` : 'Try fri, +7, 12 nov'}</p>` : value ? html`<p class="note">${fmtDate(value)}</p>` : ''}
  </div>`;
}
const PrioritySeg = ({ value, onChange, disabled }) => html`<${PrioritySlider} inPanel value=${value} disabled=${disabled} onChange=${onChange} />`;

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
    <div class="top"><span class="from">${pre.raw ? `From: “${pre.raw}”` : 'New task'}</span><button class="btn ghost" onClick=${close}>Close</button></div>
    ${pre.parseNote ? html`<p class="note">${pre.parseNote}</p>` : ''}
    <input class="titlein" aria-label="Task" autofocus value=${f.title} onInput=${(e) => set('title', e.target.value)} placeholder="What needs doing" />
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
    <div class="actions"><button class="btn primary big" disabled=${saving} onClick=${add}>Add task</button><button class="btn ghost big" onClick=${close}>Cancel</button></div>
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
    setUpdates([...(u.data || []).map((x) => ({ ...x, kind: 'u' })), ...(a.data || []).filter((x) => ['date_changed', 'reassigned', 'blocked', 'done', 'reopened', 'acknowledged', 'nudged', 'asked_update', 'on_hold', 'resumed', 'cancelled'].includes(x.action)).map((x) => ({ ...x, kind: 'a' }))]
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
    ctx.readUpdate(t, body);
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
        <button class="btn ghost" onClick=${close}>Close</button>
      </span>
    </div>
    <input class="titlein" aria-label="Task title" value=${title} disabled=${!can} onInput=${(e) => setTitle(e.target.value)} onBlur=${() => { const s = title.trim(); if (s && s !== t.title) save({ title: s }); }} onKeyDown=${(e) => e.key === 'Enter' && e.target.blur()} />

    <div class="actions">
      ${isClosed(t) ? html`<button class="btn" onClick=${() => ctx.reopen(t)}>${t.status === 'cancelled' ? 'Restore' : 'Reopen'}</button>` : t.status === 'on_hold' ? html`<button class="btn primary" onClick=${() => save({ status: 'open' })}>Resume</button><button class="btn ghost" onClick=${() => ctx.cancel(t)}>Cancel task</button>` : html`
        <button class="btn primary" disabled=${!can} onClick=${() => ctx.done(t)}>Mark done</button>
        ${isOwner && !t.acknowledged_at ? html`<button class="btn" onClick=${() => save({ acknowledged_at: new Date().toISOString() })}>Got it</button>` : ''}
        ${t.status === 'blocked' ? html`<button class="btn" onClick=${() => save({ status: 'open' })}>Unblock</button>` : can ? html`<button class="btn" onClick=${() => setBlk({ reason: '', on: '' })}>Mark blocked</button>` : ''}
        ${!canRedate && can && t.due_date && !pendingReq ? html`<button class="btn" onClick=${() => setAsk({ date: '', reason: '' })}>Ask for new date</button>` : ''}
        ${can ? html`<button class="btn" onClick=${() => { const r = (prompt('Why on hold? (optional)') ?? null); if (r !== null) ctx.hold(t, r.trim()); }}>Put on hold</button><button class="btn ghost" onClick=${() => ctx.cancel(t)}>Cancel task</button>` : ''}
        ${canNudge ? html`<button class="btn" onClick=${() => ctx.nudge(t, 'nudge')}>Nudge ${first(ctx.person(t.owner_id)?.name)}</button><button class="btn" onClick=${() => ctx.nudge(t, 'ask')}>Ask for update</button>` : ''}`}
    </div>
    ${t.request_status === 'pending' && isOwner ? html`<div class="box"><span>Request from ${ctx.person(t.created_by)?.name}</span><div class="actions"><button class="btn primary" onClick=${() => ctx.decideRequest(t, true)}>Accept</button><button class="btn" onClick=${() => { const n = prompt('Reason for declining (optional)'); ctx.decideRequest(t, false, n); close(); }}>Decline</button><span class="note">or change the owner below</span></div></div>` : ''}
    ${pendingReq ? html`<div class="box"><span>${first(ctx.person(pendingReq.requested_by)?.name)} asked to move this to ${fmtDate(pendingReq.proposed_due)}${pendingReq.reason ? `: ${pendingReq.reason}` : ''}</span>${ctx.canDecide(t) ? html`<div class="actions"><button class="btn primary" onClick=${() => ctx.decideDate(pendingReq, true)}>Approve</button><button class="btn" onClick=${() => ctx.decideDate(pendingReq, false)}>Reject</button></div>` : html`<span class="note">Waiting for approval.</span>`}</div>` : ''}
    ${ask ? html`<div class="box"><label class="lbl" for="nd">New date</label><input id="nd" type="date" class="field" min=${today()} value=${ask.date} onInput=${(e) => setAsk({ ...ask, date: e.target.value })} /><input class="field" placeholder="Reason (optional)" value=${ask.reason} onInput=${(e) => setAsk({ ...ask, reason: e.target.value })} /><div class="actions"><button class="btn primary" onClick=${requestDate}>Send request</button><button class="btn ghost" onClick=${() => setAsk(null)}>Cancel</button></div></div>` : ''}
    ${blk ? html`<div class="box"><input class="field" placeholder="What is it waiting on?" value=${blk.reason} onInput=${(e) => setBlk({ ...blk, reason: e.target.value })} /><select class="field" aria-label="Waiting on person" value=${blk.on} onChange=${(e) => setBlk({ ...blk, on: e.target.value })}><option value="">Waiting on (optional)</option>${ctx.people.map((p) => html`<option value=${p.id}>${p.name}</option>`)}</select><div class="actions"><button class="btn primary" onClick=${async () => { await save({ status: 'blocked', blocked_reason: blk.reason || null, blocked_on_person_id: blk.on || null }); setBlk(null); }}>Mark blocked</button><button class="btn ghost" onClick=${() => setBlk(null)}>Cancel</button></div></div>` : ''}
    ${t.status === 'blocked' && t.blocked_reason ? html`<p class="note">Blocked: ${t.blocked_reason}${t.blocked_on_person_id ? `, waiting on ${ctx.person(t.blocked_on_person_id)?.name}` : ''}</p>` : ''}

    <section style="display:flex;flex-direction:column;gap:12px">
      <span class="lbl" style="margin:0">Updates</span>
      <div style="display:flex;gap:8px"><input class="field" style="flex:1" aria-label="Add an update" placeholder="Add an update" value=${upd} onInput=${(e) => setUpd(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && addUpdate()} /><button class="btn primary" onClick=${addUpdate}>Post</button></div>
      ${updates === null ? html`<p class="note">Loading…</p>` : updates.length ? updates.slice(0, 12).map((u) => u.kind === 'u'
        ? html`<div class="upd"><${Avatar} ctx=${ctx} id=${u.author_id} /><div><div class="b"><b style="color:var(--ink);font-weight:600">${ctx.person(u.author_id)?.name}</b> ${ago(u.created_at)}</div><div class="x">${u.body}</div></div></div>`
        : html`<div class="sys">${activityText(ctx, u)} ${ago(u.created_at)}</div>`) : html`<p class="note">No updates yet.</p>`}
    </section>

    <div style="border-top:1px solid var(--line);padding-top:14px;display:flex;flex-direction:column;gap:14px">
      <div><label class="lbl" for="own">Owner</label><select id="own" class="field" disabled=${!canOwner} value=${t.owner_id} onChange=${(e) => save({ owner_id: e.target.value, acknowledged_at: e.target.value === ctx.me.id ? new Date().toISOString() : null })}>${ctx.people.map((p) => html`<option value=${p.id}>${p.name}${p.id === ctx.me.id ? ' (me)' : ''}</option>`)}</select></div>
      <div><span class="lbl">Deadline${!canRedate ? ' (ask the assigner to change it)' : ''}${t.slip_count ? `, moved ${t.slip_count}×` : ''}</span><${DeadlineField} value=${t.due_date} disabled=${!canRedate} onChange=${(d) => d !== t.due_date && save({ due_date: d })} /></div>
      <div><span class="lbl">Priority</span><${PrioritySeg} value=${t.priority} disabled=${!can} onChange=${(p) => save({ priority: p })} />${t.notes?.startsWith('Zoho priority') && !t.priority ? html`<p class="note">${t.notes}</p>` : ''}</div>
      <div class="grid2">
        <div><label class="lbl" for="dp">Department</label><select id="dp" class="field" disabled=${!(ctx.isAdmin || ctx.isHead(t.department_id))} value=${t.department_id} onChange=${(e) => save({ department_id: e.target.value, task_list_id: null })}>${ctx.depts.map((d) => html`<option value=${d.id}>${d.name}</option>`)}</select></div>
        <div><label class="lbl" for="tl">Task list</label><select id="tl" class="field" disabled=${!can} value=${t.task_list_id || ''} onChange=${async (e) => { let v = e.target.value; if (v === '__new') { v = await ctx.createList(t.department_id); if (!v) { e.target.value = t.task_list_id || ''; return; } } save({ task_list_id: v || null }); }}><option value="">None</option>${ctx.lists.filter((l) => l.department_id === t.department_id).map((l) => html`<option value=${l.id}>${l.name}</option>`)}${ctx.canManageLists(t.department_id) ? html`<option value="__new">+ New list…</option>` : ''}</select></div>
      </div>
      <div><label class="lbl" for="nt">Notes</label><textarea id="nt" class="field" disabled=${!can} value=${notes} onInput=${(e) => setNotes(e.target.value)} onBlur=${() => notes !== (t.notes || '') && save({ notes: notes || null })}></textarea></div>
      <label style="display:flex;gap:10px;align-items:center"><input type="checkbox" class="sel" style="margin:0" disabled=${!can} checked=${t.is_private} onChange=${(e) => save({ is_private: e.target.checked })} /> Private (only owner, creator and Bhargav)</label>
      ${err ? html`<p class="err" role="alert">${err}</p>` : ''}
      <p class="note">Changes save as you make them. J and K move to the next and previous task.</p>
      ${canDelete ? html`<div><button class="btn ghost" onClick=${del}>Delete task</button></div>` : ''}
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
    <div class="top"><span class="lbl" style="margin:0;font-size:15px;color:var(--ink);font-weight:600">${rows.length} tasks from your paste</span><button class="btn ghost" onClick=${close}>Close</button></div>
    <p class="note">Check owners and dates. Rows without a deadline are skipped.</p>
    ${rows.map((r, i) => html`<div class="bulkrow">
      <input class="field" aria-label="Task" value=${r.title} onInput=${(e) => upd(i, 'title', e.target.value)} />
      <select class="field" aria-label="Owner" value=${r.owner_id} onChange=${(e) => upd(i, 'owner_id', e.target.value)}>${ctx.people.map((p) => html`<option value=${p.id} selected=${r.owner_id === p.id}>${p.name}</option>`)}</select>
      <input type="date" class=${'field' + (r.due_date ? '' : ' missing')} aria-label="Deadline" value=${r.due_date} onChange=${(e) => upd(i, 'due_date', e.target.value)} />
      <select class="field" aria-label="Priority" value=${r.priority} onChange=${(e) => upd(i, 'priority', e.target.value)}>${['P1', 'P2', 'P3'].map((p) => html`<option value=${p} selected=${r.priority === p}>${p}</option>`)}</select>
      <button class="iconbtn" aria-label="Remove row" onClick=${() => setRows((rs) => rs.filter((_, j) => j !== i))}>✕</button>
      ${r.parsing ? html`<span class="note" style="grid-column:1/-1">Reading…</span>` : ''}
    </div>`)}
    <div class="actions"><button class="btn primary big" disabled=${saving || !ready.length} onClick=${addAll}>Add ${ready.length} tasks</button><button class="btn ghost big" onClick=${close}>Cancel</button></div>
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
  if (a.action === 'on_hold') return `${who} put it on hold`;
  if (a.action === 'resumed') return `${who} resumed it`;
  if (a.action === 'cancelled') return `${who} cancelled it`;
  return a.action;
}


render(html`<${App} />`, document.getElementById('app'));
