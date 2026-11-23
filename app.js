'use strict';
{
/* ================= Course plan (built from data.js) ================= */
const LESSONS = SECTIONS.flatMap((s, si) => s.lessons.map((l) => ({ ...l, section: si })));
const PLAN = [];
{
  let li = 0, week = 0;
  SECTIONS.forEach((sec, si) => {
    const secLessons = [];
    for (let w = 0; w < 4; w++) {
      week++;
      const wk = [];
      for (let k = 0; k < 3; k++, li++) {
        wk.push(li); secLessons.push(li);
        PLAN.push({ type: 'learn', lesson: li, section: si, week });
        PLAN.push({ type: 'revise', lesson: li, section: si, week });
      }
      PLAN.push({ type: 'test', lessons: wk, section: si, week });
    }
    PLAN.push({ type: 'sreview', lessons: secLessons, section: si, week });
    PLAN.push({ type: 'exam', lessons: secLessons, section: si, week });
  });
}
const sectionStart = (si) => PLAN.findIndex((d) => d.section === si);
// Pronunciation crash course on the first 8 lesson days
const SOUND_DAYS = PLAN.map((d, i) => [d, i]).filter(([d]) => d.type === 'learn' || d.type === 'revise').slice(0, SOUNDS.length).map(([, i]) => i);

/* ================= State & storage ================= */
const KEY = 'dd.state.v2';
const INTERVALS = [1, 2, 4, 7, 15, 30];
const PASS = 70;
const ROUTINE = [
  { t: 'Review your due cards', m: 15 },
  { t: "Today's lesson, test or revision", m: 20 },
  { t: 'Conversation practice + shadowing', m: 15 },
  { t: 'Speaking challenge (out loud!)', m: 10 },
];
const fresh = () => ({ completed: [], scores: {}, deck: {}, activity: [], routine: { date: '', done: [] },
  showEn: true, rate: 0.9, mine: [], bonus: [], remind: { on: false, time: '08:00', last: '' } });
let st;
try { st = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch { st = fresh(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* no storage */ } };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ymd = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function markActive() {
  const t = ymd();
  if (!st.activity.includes(t)) st.activity.push(t);
  st.activity = st.activity.slice(-400);
}
function streak() {
  const set = new Set(st.activity), d = new Date();
  if (!set.has(ymd(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(ymd(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function routineToday() {
  if (st.routine.date !== ymd()) st.routine = { date: ymd(), done: [] };
  return st.routine;
}
const tickRoutine = (i) => { const r = routineToday(); if (!r.done.includes(i)) r.done.push(i); };

const currentDay = () => { const i = PLAN.findIndex((_, k) => !st.completed.includes(k)); return i === -1 ? PLAN.length - 1 : i; };
const dueCards = () => Object.entries(st.deck).filter(([, c]) => c.due <= ymd()).map(([id]) => id);

/* Card ids: "12-s3" lesson sentence · "12-w0" lesson word · "b5-3" bonus word · "my-…" own phrase */
function item(id) {
  if (id.startsWith('my-')) {
    const p = st.mine.find((x) => x.id === id);
    return p ? { id, de: p.de, en: p.en, kind: 'm', lesson: { emoji: '⭐', theme: 'My phrases' } } : null;
  }
  if (id[0] === 'b') {
    const [p, j] = id.slice(1).split('-').map(Number);
    const w = BONUS[p] && BONUS[p][j];
    return w ? { id, de: w[0], en: w[1], kind: 'w', lesson: { emoji: '➕', theme: `Bonus words ${p + 1}` } } : null;
  }
  const [l, rest] = id.split('-');
  const L = LESSONS[+l];
  const pair = L && rest && (rest[0] === 'w' ? L.w : L.s)[+rest.slice(1)];
  return pair ? { id, de: pair[0], en: pair[1], kind: rest[0], lesson: L } : null;
}
const itemsOf = (lessons) => lessons.flatMap((li) => [
  ...LESSONS[li].w.map((_, j) => item(`${li}-w${j}`)),
  ...LESSONS[li].s.map((_, j) => item(`${li}-s${j}`)),
]);

function dayTitle(d) {
  if (d.type === 'learn') return LESSONS[d.lesson].theme;
  if (d.type === 'revise') return `Revise: ${LESSONS[d.lesson].theme}`;
  if (d.type === 'test') return `Week ${d.week} test`;
  if (d.type === 'sreview') return `${SECTIONS[d.section].title}: review`;
  return `${SECTIONS[d.section].title}: exam`;
}
const dayEmoji = (d) => ({ learn: LESSONS[d.lesson]?.emoji, revise: '🔁', test: '📝', sreview: '🧠', exam: '🏆' }[d.type]);

/* ================= Speech: listen, speak-check ================= */
let deVoice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith('de'));
  deVoice = vs.find((v) => /google|natural|online/i.test(v.name)) || vs[0] || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

function speak(text, slow = false) {
  if (!('speechSynthesis' in window)) { toast('Audio is not supported in this browser'); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/\s*\/\s*/g, ', ').replace(/[–…]/g, '. ').replace(/[„“]/g, ''));
  u.lang = 'de-DE';
  if (deVoice) u.voice = deVoice;
  u.rate = slow ? Math.max(0.45, st.rate - 0.3) : st.rate;
  speechSynthesis.speak(u);
}

const Recog = window.SpeechRecognition || window.webkitSpeechRecognition;
const norm = (s) => s.toLowerCase().replace(/[.,!?;:"'„“…–\-]/g, ' ').replace(/\s+/g, ' ').trim();
const fold = (s) => norm(s).replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
function similarity(target, heard) {
  const want = norm(target).split(' ').filter(Boolean), got = new Set(norm(heard).split(' '));
  return want.length ? want.filter((w) => got.has(w)).length / want.length : 0;
}
function lev(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}
// Typed answer: forgiving about capitals, punctuation, ae/oe/ue/ss and small typos, strict about articles
function checkTyped(target, given) {
  const g = fold(given);
  if (!g) return { ok: false, note: '' };
  const cands = [target, ...target.split(/\s*\/\s*/)];
  for (const c of cands) {
    const t = fold(c);
    if (1 - lev(t, g) / Math.max(t.length, g.length) >= 0.85) return { ok: true, note: t === g ? '' : 'Correct, with a small typo.' };
  }
  const art = target.match(/^(der|die|das)\s+(.*)$/);
  if (art && fold(art[2]) === g) return { ok: false, note: `Don't forget the article: ${art[1]}!` };
  return { ok: false, note: '' };
}

let activeRec = null;
function listen(target, out, btn, onResult) {
  if (!Recog) { out.className = 'heard bad'; out.textContent = '🎤 The speech check works in Chrome or Edge. Say it out loud and compare with 🔊.'; return; }
  if (activeRec) { activeRec.abort(); activeRec = null; }
  const rec = new Recog();
  activeRec = rec;
  rec.lang = 'de-DE'; rec.interimResults = false; rec.maxAlternatives = 3;
  btn.disabled = true; out.className = 'heard'; out.textContent = '🎙️ Listening… say it now';
  rec.onresult = (e) => {
    let best = '', s = 0;
    for (const a of e.results[0]) { const v = similarity(target, a.transcript); if (v >= s) { s = v; best = a.transcript; } }
    const pct = Math.round(s * 100);
    if (s >= 0.8) { out.className = 'heard good'; out.textContent = `✅ Super! ${pct}% · I heard: “${best}”`; }
    else if (s >= 0.5) { out.className = 'heard mid'; out.textContent = `🟡 Almost! ${pct}% · I heard: “${best}”. Listen again and retry.`; }
    else { out.className = 'heard bad'; out.textContent = `🔁 Nochmal! ${pct}% · I heard: “${best}”`; }
    markActive(); save(); renderStats();
    if (onResult) onResult(s, best);
  };
  rec.onerror = (e) => {
    out.className = 'heard bad';
    out.textContent = e.error === 'not-allowed' || e.error === 'service-not-allowed'
      ? '🎤 The microphone is blocked. Allow it in the browser to use the speech check.'
      : e.error === 'no-speech' ? '🤫 I didn\'t hear anything. Try again, a bit louder.' : '🎤 The speech check failed. Try again.';
  };
  rec.onend = () => { btn.disabled = false; activeRec = null; };
  try { rec.start(); } catch { btn.disabled = false; }
}

/* ================= Recording yourself ================= */
let mediaRec = null;
async function toggleRecord(btn, onDone) {
  if (mediaRec && mediaRec.state === 'recording') { mediaRec.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { toast('Recording isn\'t supported in this browser'); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { toast('🎙 The microphone is blocked. Allow it in the browser to record.'); return; }
  const chunks = [];
  const label = btn.textContent;
  mediaRec = new MediaRecorder(stream);
  mediaRec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  mediaRec.onstop = () => {
    stream.getTracks().forEach((t) => t.stop());
    btn.textContent = label; btn.classList.remove('recording');
    const blob = new Blob(chunks, { type: mediaRec.mimeType || 'audio/webm' });
    mediaRec = null;
    if (blob.size) onDone(blob);
  };
  mediaRec.start();
  btn.textContent = '⏹ Stop'; btn.classList.add('recording');
}
const myTakes = {};   // in-memory takes for sentences: key → object URL

// Saved recordings (speaking challenges) live in IndexedDB so you can compare Day 1 with Day 90
const recDB = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      try {
        const r = indexedDB.open('deutsch-daily', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('recs', { keyPath: 'id', autoIncrement: true });
        r.onsuccess = () => { this.db = r.result; res(this.db); };
        r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
  },
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction('recs', mode), s = t.objectStore('recs');
      const req = fn(s);
      t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error);
    });
  },
  add(rec) { return this.tx('readwrite', (s) => s.add(rec)); },
  all() { return this.tx('readonly', (s) => s.getAll()); },
  del(id) { return this.tx('readwrite', (s) => s.delete(id)); },
};

/* ================= Helpers ================= */
let toastT;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
}
function deHtml(de) {
  const m = de.match(/^(der|die|das)\s/);
  return m ? `<span class="art-${m[1]}">${esc(de)}</span>` : esc(de);
}
function addToDeck(ids, dueToday = false) {
  for (const id of ids) {
    if (!st.deck[id]) st.deck[id] = { box: 0, due: dueToday ? ymd() : addDays(1) };
    else if (dueToday) { st.deck[id].box = 0; st.deck[id].due = ymd(); }
  }
}

/* ================= Today view ================= */
let viewDay = null, timer = null, quiz = null, dlg = { day: -1, step: -1, shown: {} };

function renderStats() {
  const cur = currentDay(), sec = SECTIONS[PLAN[cur].section];
  $('stats').textContent = `Day ${cur + 1} of ${PLAN.length} · ${sec.title} (${sec.level}) · 🔥 ${streak()}-day streak · ${Object.keys(st.deck).length} cards`;
  const due = dueCards().length;
  $('due-badge').hidden = !due; $('due-badge').textContent = due;
}

function routineCard() {
  const r = routineToday();
  const mins = ROUTINE.reduce((a, x, i) => a + (r.done.includes(i) ? x.m : 0), 0);
  return `<div class="card"><div class="card-head"><h2>Your German hour</h2><span class="muted">${mins} / 60 min</span></div>
    <div class="routine">${ROUTINE.map((x, i) => `
      <label class="${r.done.includes(i) ? 'done' : ''}"><input type="checkbox" data-routine="${i}" ${r.done.includes(i) ? 'checked' : ''}>
      <span>${x.t}</span><span class="mins">${x.m} min</span></label>`).join('')}</div>
    <div class="meter"><div style="width:${(mins / 60) * 100}%"></div></div></div>`;
}

function heroCard(idx, d) {
  const sec = SECTIONS[d.section];
  const label = { learn: 'Learn · day 1 of 2', revise: 'Revise from memory · day 2 of 2', test: 'Weekly test', sreview: 'Section review', exam: 'Section exam' }[d.type];
  const L = d.lesson !== undefined ? LESSONS[d.lesson] : null;
  return `<div class="card"><div class="lesson-hero"><span class="emoji">${dayEmoji(d)}</span>
    <div><div class="muted">Day ${idx + 1} · ${esc(sec.title)} ${sec.level} · ${label}${st.completed.includes(idx) ? ' · ✓' : ''}</div>
    <h2>${esc(dayTitle(d))}</h2></div>
    <div class="day-nav">
      <button type="button" class="ghost icon" data-go="${idx - 1}" ${idx === 0 ? 'disabled' : ''} aria-label="Previous day">‹</button>
      <button type="button" class="ghost icon" data-go="${idx + 1}" ${idx === PLAN.length - 1 ? 'disabled' : ''} aria-label="Next day">›</button>
    </div></div>
    ${L ? `<div class="tip">💡 ${esc(L.tip)}</div>` : ''}
    ${d.type === 'revise' ? '<div class="tip revise">🧠 Same lesson as yesterday. Read the English, say the German out loud, <b>then</b> tap to check.</div>' : ''}
    ${viewDay !== null && viewDay !== currentDay() ? '<div class="row"><button type="button" class="ghost" data-go="current">↩ Back to today</button></div>' : ''}
  </div>`;
}

function soundCard(idx) {
  const k = SOUND_DAYS.indexOf(idx);
  if (k === -1) return '';
  const s = SOUNDS[k];
  return `<div class="card sound"><div class="card-head"><h2>🔤 Sound of the day: ${esc(s.title)}</h2><span class="muted">${k + 1} / ${SOUNDS.length}</span></div>
    <p>${esc(s.how)}</p>
    <div class="row">${s.ex.map((w) => `<button type="button" data-say="${esc(w)}" data-slow="1">🔊 ${esc(w)}</button>`).join('')}</div></div>`;
}

function sentenceRow(de, key, i) {
  return `<div class="row">
      <button type="button" data-say="${esc(de)}">🔊 Listen</button>
      <button type="button" data-say="${esc(de)}" data-slow="1">🐢 Slow</button>
      <button type="button" data-listen="${i}">🎤 Say it</button>
      <button type="button" data-record="${key}">🎙 Record</button>
      ${myTakes[key] ? `<button type="button" data-play="${key}">▶ My take</button>` : ''}
    </div><div class="heard" id="heard-${i}"></div>`;
}

function lessonCards(idx, L, revise) {
  const hideEn = !revise && !st.showEn;
  return `<div class="card"><div class="card-head"><h2>${revise ? 'Words: say them from memory' : '5 new words'}</h2>
      <span class="gender-key muted"><span class="art-der">der</span> · <span class="art-die">die</span> · <span class="art-das">das</span></span></div>
    <div class="words">${L.w.map(([de, en]) => revise ? `
      <div class="word"><span class="de">${esc(en)}</span><span class="en blur" data-reveal>${deHtml(de)}</span>
      <button type="button" class="ghost icon" data-say="${esc(de)}" aria-label="Play">🔊</button></div>` : `
      <div class="word"><span class="de">${deHtml(de)}</span><span class="en ${hideEn ? 'blur' : ''}" data-reveal>${esc(en)}</span>
      <button type="button" class="ghost icon" data-say="${esc(de)}" aria-label="Play">🔊</button></div>`).join('')}</div></div>
  <div class="card"><div class="card-head"><h2>${revise ? 'Sentences: say them first, then check' : '5 sentences to say'}</h2>
      <span class="muted">${revise ? 'Tap the blurred line to check' : 'Listen, repeat 3×, then 🎤 or 🎙'}</span></div>
    <div class="sentences">${L.s.map(([de, en], i) => `
      <div class="sentence">
        ${revise ? `<div class="de">${esc(en)}</div><div class="de blur" data-reveal>${esc(de)}</div>`
                 : `<div class="de">${esc(de)}</div><div class="en ${hideEn ? 'blur' : ''}" data-reveal>${esc(en)}</div>`}
        ${sentenceRow(de, `${idx}-s${i}`, i)}</div>`).join('')}</div></div>`;
}

function dialogueCard(idx, li) {
  const D = DIALOGUES[li];
  if (!D) return '';
  if (dlg.day !== idx) dlg = { day: idx, step: -1, shown: {} };
  let body = '';
  if (dlg.step < 0) {
    body = `<p class="muted">A short real-life conversation. The app plays the other person; <b>you answer out loud</b> using the English hint.</p>
      <button type="button" class="primary" id="dlg-start">▶ Start conversation</button>`;
  } else {
    body = '<div class="chat">' + D.slice(0, dlg.step + 1).map(([who, de, en], k) => {
      if (who === 'A') return `<div class="bubble them"><div class="de">${esc(de)}</div>
        <div class="en ${st.showEn ? '' : 'blur'}" data-reveal>${esc(en)}</div>
        <button type="button" class="mini" data-say="${esc(de)}">🔊</button></div>`;
      const open = dlg.shown[k];
      return `<div class="bubble you"><div class="who">You: <i>${esc(en)}</i></div>
        <div class="de ${open ? '' : 'blur'}" data-reveal data-dlg-show="${k}">${esc(de)}</div>
        <div class="row">
          <button type="button" data-dlg-listen="${k}">🎤 Answer</button>
          ${open ? `<button type="button" data-say="${esc(de)}">🔊 Listen</button>` : `<button type="button" data-dlg-reveal="${k}">👁 Show</button>`}
        </div><div class="heard" id="dlg-heard-${k}"></div></div>`;
    }).join('') + '</div>';
    body += dlg.step < D.length - 1
      ? `<div class="row end"><button type="button" class="primary" id="dlg-next">${D[dlg.step][0] === 'A' ? 'My turn →' : 'Next →'}</button></div>`
      : '<div class="row end"><span class="muted">🎉 Conversation done! Do it again faster.</span><button type="button" class="ghost" id="dlg-start">↺ Again</button></div>';
  }
  return `<div class="card dialogue"><div class="card-head"><h2>💬 Conversation practice</h2><span class="muted">You are the blue side</span></div>${body}</div>`;
}

function bonusCard(li) {
  const pack = BONUS[li];
  if (!pack) return '';
  const added = st.bonus.includes(li);
  return `<details class="card bonus"><summary><h2>➕ Bonus: 10 common words</h2><span class="muted">optional · ${added ? 'added ✓' : 'tap to open'}</span></summary>
    <div class="words">${pack.map(([de, en]) => `
      <div class="word"><span class="de">${deHtml(de)}</span><span class="en">${esc(en)}</span>
      <button type="button" class="ghost icon" data-say="${esc(de)}" aria-label="Play">🔊</button></div>`).join('')}</div>
    <div class="row">${added ? '<span class="muted">✓ These are in your Review deck.</span>' : `<button type="button" class="primary" data-bonus="${li}">Add all 10 to Review</button>`}</div>
  </details>`;
}

function challengeCard(text, secs, idx) {
  return `<div class="card challenge"><div class="card-head"><h2>🗣️ Speaking challenge</h2><span class="muted">${secs / 60} min</span></div>
    <p>${esc(text)}</p>
    <div class="row"><button type="button" class="primary" id="timer-btn" data-secs="${secs}">▶ Start timer</button>
      <button type="button" id="rec-challenge" data-day="${idx}">🎙 Record my answer</button>
      <span class="timer" id="timer"></span></div>
    <div id="challenge-audio"></div></div>`;
}

function renderToday() {
  const idx = viewDay ?? currentDay();
  const d = PLAN[idx];
  const done = st.completed.includes(idx);
  let h = viewDay === null ? routineCard() : '';
  h += heroCard(idx, d);
  h += soundCard(idx);

  if (d.type === 'learn' || d.type === 'revise') {
    const L = LESSONS[d.lesson];
    h += lessonCards(idx, L, d.type === 'revise');
    h += dialogueCard(idx, d.lesson);
    if (d.type === 'learn') h += bonusCard(d.lesson);
    h += challengeCard(d.type === 'revise' ? `${L.challenge} This time, don't look at the screen.` : L.challenge, d.type === 'revise' ? 120 : 60, idx);
    h += done ? '<div class="card done-banner">✓ Day completed.</div>'
      : `<button type="button" class="primary finish" data-finish="${idx}">✓ ${d.type === 'learn' ? 'Finish learning: add 10 cards to Review' : 'Finish revision'}</button>`;
  } else if (d.type === 'sreview') {
    const due = dueCards().length;
    h += `<div class="card"><h2>Get ready for the exam 🧠</h2>
      <p class="muted" style="margin-top:6px">Tomorrow is the ${esc(SECTIONS[d.section].title)} exam, covering all 12 lessons of this section. Clear your review cards, then revisit the lessons you found hardest.</p>
      <div class="lesson-list">${d.lessons.map((li) => `<button type="button" class="ghost" data-go="${PLAN.findIndex((p) => p.type === 'revise' && p.lesson === li)}">${LESSONS[li].emoji} ${esc(LESSONS[li].theme)}</button>`).join('')}</div>
      <div class="row"><button type="button" class="primary" data-tab="review">Review ${due} due card${due === 1 ? '' : 's'}</button></div></div>`;
    h += challengeCard(SECTIONS[d.section].final, [120, 180, 240][d.section], idx);
    h += done ? '<div class="card done-banner">✓ Day completed.</div>' : `<button type="button" class="primary finish" data-finish="${idx}">✓ Finish review day</button>`;
  } else {
    h += testCard(idx, d);
  }
  $('view-today').innerHTML = h;
}

function finishDay(idx) {
  const d = PLAN[idx];
  if (!st.completed.includes(idx)) st.completed.push(idx);
  if (d.type === 'learn') addToDeck(itemsOf([d.lesson]).map((x) => x.id));
  if (idx === currentDay() || viewDay === null) tickRoutine(1);
  markActive(); save();
  viewDay = null;
  toast(d.type === 'learn' ? 'Lesson learned! 10 cards added to Review 🎉' : 'Day done! 🎉');
  renderAll(); window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ================= Weekly tests & section exams ================= */
// Mix: type it, choose meaning, say it, choose German, fill the gap. ~40% make you produce German yourself.
const CYCLE = ['type', 'de2en', 'say', 'en2de', 'gap'];
function buildQuiz(idx, d) {
  const pool = itemsOf(d.lessons);
  const words = pool.filter((x) => x.kind === 'w'), sents = pool.filter((x) => x.kind === 's');
  const n = d.type === 'exam' ? 20 : 12;
  const qs = shuffle(pool).slice(0, n).map((it, k) => {
    let type = CYCLE[k % CYCLE.length];
    if (type === 'gap' && it.kind !== 's') type = 'en2de';
    const same = (it.kind === 'w' ? words : sents).filter((x) => x.id !== it.id);
    if (type === 'gap') {
      const tokens = it.de.split(' ');
      const cand = tokens.map((t, i) => [t.replace(/[.,!?…„“]/g, ''), i]).filter(([t]) => t.length >= 4);
      const [word, at] = cand.length ? cand[Math.floor(Math.random() * cand.length)] : [tokens[0].replace(/[.,!?…]/g, ''), 0];
      const others = shuffle([...new Set(sents.flatMap((x) => x.de.split(' ').map((t) => t.replace(/[.,!?…„“]/g, '')))
        .filter((t) => t.length >= 4 && t.toLowerCase() !== word.toLowerCase()))]).slice(0, 3);
      const shown = tokens.map((t, i) => (i === at ? t.replace(word, '_____') : t)).join(' ');
      return { id: it.id, type, q: shown, hint: it.en, answer: word, options: shuffle([word, ...others]), say: it.de };
    }
    if (type === 'type' || type === 'say') return { id: it.id, type, q: it.en, answer: it.de, say: it.de };
    const dist = shuffle(same).slice(0, 3);
    return type === 'en2de'
      ? { id: it.id, type, q: it.en, answer: it.de, options: shuffle([...new Set([it.de, ...dist.map((x) => x.de)])]), say: it.de }
      : { id: it.id, type, q: it.de, answer: it.en, options: shuffle([...new Set([it.en, ...dist.map((x) => x.en)])]), say: it.de };
  });
  return { idx, qs, i: 0, right: 0, done: null, wrong: [], peek: false };
}

const QLABEL = { type: '⌨️ Type it in German', say: '🎤 Say it in German', en2de: 'Choose the German', de2en: 'What does it mean?', gap: 'Fill the gap' };

function testCard(idx, d) {
  const best = st.scores[idx];
  const themes = d.lessons.map((li) => `${LESSONS[li].emoji} ${LESSONS[li].theme}`).join(' · ');
  const n = d.type === 'exam' ? 20 : 12;
  if (!quiz || quiz.idx !== idx) {
    return `<div class="card"><h2>${d.type === 'exam' ? `🏆 ${esc(SECTIONS[d.section].title)} exam` : `📝 Week ${d.week} test`}</h2>
      <p class="muted" style="margin:6px 0 4px">${n} questions on: ${esc(themes)}.</p>
      <p class="muted" style="margin:0 0 12px">You'll type and say German yourself, not just pick answers. Pass mark: ${PASS}%.</p>
      ${best !== undefined ? `<p class="score ${best >= PASS ? 'pass' : 'fail'}">Best score: ${best}% ${best >= PASS ? '✓ passed' : '· try again'}</p>` : ''}
      <button type="button" class="primary finish" id="quiz-start">${best === undefined ? '▶ Start the test' : '↺ Take it again'}</button></div>`
      + challengeCard(d.type === 'exam' ? SECTIONS[d.section].final : `Without looking: say 2 sentences from each lesson this week (${d.lessons.map((li) => LESSONS[li].theme).join(', ')}).`, d.type === 'exam' ? 180 : 120, idx);
  }
  if (quiz.i >= quiz.qs.length) {
    const pct = Math.round((quiz.right / quiz.qs.length) * 100);
    return `<div class="card result"><div class="big">${pct >= PASS ? '🎉' : '💪'}</div>
      <h2>${quiz.right} / ${quiz.qs.length} correct · ${pct}%</h2>
      <p class="muted">${pct >= PASS ? 'Passed! Well done.' : `You need ${PASS}% to pass. The cards you missed are in Review today. Practise them and try again.`}</p>
      ${quiz.wrong.length ? `<div class="missed"><h3>Practise these</h3>${[...new Set(quiz.wrong)].map((id) => { const x = item(id); return `<div class="miss"><b>${deHtml(x.de)}</b><span class="muted">${esc(x.en)}</span><button type="button" class="ghost icon" data-say="${esc(x.de)}">🔊</button></div>`; }).join('')}</div>` : ''}
      <div class="row" style="justify-content:center"><button type="button" class="ghost" id="quiz-start">↺ Retake</button>
      ${quiz.wrong.length ? '<button type="button" class="ghost" data-tab="review">Practise missed cards</button>' : ''}
      <button type="button" class="primary" data-go="current">Continue to Day ${currentDay() + 1} →</button></div></div>`;
  }
  const q = quiz.qs[quiz.i];
  const answered = quiz.done !== null;
  let body = '';
  if (q.options) {
    body = `<div class="options">${q.options.map((o) => {
      let cls = '';
      if (answered) cls = o === q.answer ? 'right' : o === quiz.done.given ? 'wrong' : 'dim';
      return `<button type="button" class="opt ${cls}" data-opt="${esc(o)}" ${answered ? 'disabled' : ''}>${esc(o)}</button>`;
    }).join('')}</div>`;
  } else if (q.type === 'type') {
    body = `<form class="typeform" id="type-form" autocomplete="off">
      <input id="type-in" lang="de" spellcheck="false" autocapitalize="off" placeholder="Type the German…" ${answered ? `value="${esc(quiz.done.given)}" disabled` : ''}>
      ${answered ? '' : '<button class="primary">Check</button>'}</form>
      ${answered ? '' : '<div class="umlauts">' + ['ä', 'ö', 'ü', 'ß'].map((c) => `<button type="button" class="mini" data-char="${c}">${c}</button>`).join('') + '</div>'}`;
  } else if (q.type === 'say') {
    body = answered ? '' : `<div class="row">
        ${Recog && !quiz.peek ? '<button type="button" class="primary" id="say-btn">🎤 Speak now</button>' : ''}
        ${quiz.peek ? '' : `<button type="button" class="ghost" id="say-peek">${Recog ? 'I can\'t use the mic' : 'I said it out loud: show the answer'}</button>`}
      </div><div class="heard" id="say-heard"></div>
      ${quiz.peek ? `<div class="answer-box">${deHtml(q.answer)}</div><p class="muted">Did you say it correctly?</p>
        <div class="row"><button type="button" class="good-btn" data-self="1">✓ Yes, I got it</button><button type="button" class="bad-btn" data-self="0">✗ No</button></div>` : ''}`;
  }
  let feedback = '';
  if (answered && !q.options) {
    feedback = `<div class="feedback ${quiz.done.ok ? 'ok' : 'no'}">${quiz.done.ok ? '✅ Richtig!' : '❌ Not quite.'} ${esc(quiz.done.note || '')}
      ${quiz.done.ok && !quiz.done.note ? '' : `<div>Answer: <b>${esc(q.answer)}</b></div>`}</div>`;
  }
  return `<div class="card quiz">
    <div class="quiz-top"><span class="muted">Question ${quiz.i + 1} of ${quiz.qs.length}</span><span class="muted">✓ ${quiz.right}</span></div>
    <div class="meter"><div style="width:${(quiz.i / quiz.qs.length) * 100}%"></div></div>
    <div class="q">${QLABEL[q.type]}</div>
    <div class="qtext">${esc(q.q)}</div>
    ${q.type === 'gap' ? `<div class="muted">${esc(q.hint)}</div>` : ''}
    ${body}${feedback}
    ${answered ? `<div class="row"><button type="button" data-say="${esc(q.say)}">🔊 ${esc(q.say)}</button>
      <button type="button" class="primary" id="quiz-next" style="margin-left:auto">${quiz.i + 1 === quiz.qs.length ? 'See result' : 'Next →'}</button></div>` : ''}
  </div>`;
}

function grade(ok, given, note = '') {
  const q = quiz.qs[quiz.i];
  quiz.done = { ok, given, note };
  if (ok) quiz.right++; else quiz.wrong.push(q.id);
  renderToday();
  if (q.type !== 'say') speak(q.say);
  const nx = $('quiz-next'); if (nx) nx.focus();
}
function nextQuestion() {
  quiz.i++; quiz.done = null; quiz.peek = false;
  if (quiz.i >= quiz.qs.length) {
    const pct = Math.round((quiz.right / quiz.qs.length) * 100);
    st.scores[quiz.idx] = Math.max(st.scores[quiz.idx] ?? 0, pct);
    addToDeck([...new Set(quiz.wrong)], true);
    if (!st.completed.includes(quiz.idx)) st.completed.push(quiz.idx);
    viewDay = quiz.idx;
    tickRoutine(1); markActive(); save(); renderStats();
  }
  renderToday();
  const inp = $('type-in'); if (inp) inp.focus();
}

/* ================= Today events ================= */
$('view-today').addEventListener('click', async (e) => {
  const t = e.target.closest('button, [data-reveal], summary');
  if (!t || t.tagName === 'SUMMARY') return;
  const idx = viewDay ?? currentDay();
  if (t.dataset.opt !== undefined) { const q = quiz.qs[quiz.i]; grade(t.dataset.opt === q.answer, t.dataset.opt); }
  else if (t.id === 'quiz-next') nextQuestion();
  else if (t.id === 'quiz-start') { quiz = buildQuiz(idx, PLAN[idx]); renderToday(); const inp = $('type-in'); if (inp) inp.focus(); }
  else if (t.dataset.char) { const inp = $('type-in'); inp.value += t.dataset.char; inp.focus(); }
  else if (t.id === 'say-btn') {
    const q = quiz.qs[quiz.i];
    listen(q.answer, $('say-heard'), t, (s, heard) => grade(s >= 0.7, heard, s >= 0.7 ? '' : 'Listen and try once more next time.'));
  } else if (t.id === 'say-peek') { quiz.peek = true; renderToday(); speak(quiz.qs[quiz.i].answer); }
  else if (t.dataset.self !== undefined) grade(t.dataset.self === '1', '(said out loud)', t.dataset.self === '1' ? '' : '');
  else if (t.dataset.say) speak(t.dataset.say, !!t.dataset.slow);
  else if (t.dataset.listen !== undefined) {
    const L = LESSONS[PLAN[idx].lesson];
    listen(L.s[+t.dataset.listen][0], $(`heard-${t.dataset.listen}`), t, () => {
      t.closest('.sentence')?.querySelector('.blur')?.classList.remove('blur');
    });
  } else if (t.dataset.record) {
    const key = t.dataset.record;
    toggleRecord(t, (blob) => {
      if (myTakes[key]) URL.revokeObjectURL(myTakes[key]);
      myTakes[key] = URL.createObjectURL(blob);
      markActive(); save();
      const row = t.closest('.row');
      if (row && !row.querySelector('[data-play]')) row.insertAdjacentHTML('beforeend', `<button type="button" data-play="${key}">▶ My take</button>`);
      new Audio(myTakes[key]).play().catch(() => {});
    });
  } else if (t.dataset.play) { new Audio(myTakes[t.dataset.play]).play().catch(() => toast('Could not play the recording')); }
  else if (t.id === 'rec-challenge') {
    toggleRecord(t, async (blob) => {
      const url = URL.createObjectURL(blob);
      $('challenge-audio').innerHTML = `<audio controls src="${url}"></audio>`;
      try {
        await recDB.add({ day: +t.dataset.day, title: dayTitle(PLAN[+t.dataset.day]), date: new Date().toISOString(), blob });
        toast('Saved to My recordings (90 days tab) 🎙');
      } catch { toast('Recorded, but this browser can\'t save it for later'); }
      markActive(); save();
    });
  }
  else if (t.id === 'dlg-start') { dlg = { day: idx, step: 0, shown: {} }; renderToday(); speak(DIALOGUES[PLAN[idx].lesson][0][1]); scrollToDialogue(); }
  else if (t.id === 'dlg-next') {
    const D = DIALOGUES[PLAN[idx].lesson];
    if (D[dlg.step][0] === 'B') dlg.shown[dlg.step] = true;
    dlg.step++;
    renderToday();
    if (D[dlg.step][0] === 'A') speak(D[dlg.step][1]);
    scrollToDialogue();
  } else if (t.dataset.dlgReveal !== undefined) {
    const k = +t.dataset.dlgReveal; dlg.shown[k] = true; renderToday(); speak(DIALOGUES[PLAN[idx].lesson][k][1]); scrollToDialogue();
  } else if (t.dataset.dlgListen !== undefined) {
    const k = +t.dataset.dlgListen, line = DIALOGUES[PLAN[idx].lesson][k][1];
    listen(line, $(`dlg-heard-${k}`), t, () => { dlg.shown[k] = true; t.closest('.bubble').querySelector('.blur')?.classList.remove('blur'); });
  } else if (t.dataset.bonus !== undefined) {
    const li = +t.dataset.bonus;
    if (!st.bonus.includes(li)) st.bonus.push(li);
    addToDeck(BONUS[li].map((_, j) => `b${li}-${j}`));
    save(); renderStats(); renderToday(); toast('10 bonus words added to Review ➕');
  }
  else if (t.hasAttribute('data-reveal')) { t.classList.remove('blur'); if (t.dataset.dlgShow !== undefined) dlg.shown[+t.dataset.dlgShow] = true; }
  else if (t.dataset.go !== undefined) {
    viewDay = t.dataset.go === 'current' ? null : Math.max(0, Math.min(PLAN.length - 1, +t.dataset.go));
    if (viewDay === currentDay()) viewDay = null;
    quiz = null; clearInterval(timer);
    renderToday(); window.scrollTo({ top: 0 });
  } else if (t.dataset.finish !== undefined) finishDay(+t.dataset.finish);
  else if (t.dataset.tab) showView(t.dataset.tab);
  else if (t.id === 'timer-btn') startTimer(t);
});
function scrollToDialogue() {
  const c = document.querySelector('.dialogue .chat');
  if (c && c.lastElementChild) c.lastElementChild.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
$('view-today').addEventListener('submit', (e) => {
  if (e.target.id !== 'type-form') return;
  e.preventDefault();
  const q = quiz.qs[quiz.i], given = $('type-in').value.trim();
  if (!given) return;
  const r = checkTyped(q.answer, given);
  grade(r.ok, given, r.note);
});
$('view-today').addEventListener('change', (e) => {
  const i = e.target.dataset.routine;
  if (i === undefined) return;
  const r = routineToday();
  r.done = e.target.checked ? [...new Set([...r.done, +i])] : r.done.filter((x) => x !== +i);
  if (e.target.checked) markActive();
  save(); renderToday(); renderStats();
});

function startTimer(btn) {
  clearInterval(timer);
  let left = +btn.dataset.secs;
  const out = $('timer');
  const show = () => { out.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; };
  btn.textContent = '↺ Restart'; show();
  timer = setInterval(() => {
    left--; show();
    if (left <= 0) {
      clearInterval(timer); out.textContent = 'Geschafft! 🎉';
      if (viewDay === null) tickRoutine(3);
      markActive(); save(); renderStats();
    }
  }, 1000);
}

/* ================= Review (spaced repetition) ================= */
let queue = [], revealed = false, sessionDone = 0;
function startSession() { queue = shuffle(dueCards()).slice(0, 40); revealed = false; sessionDone = 0; }

function renderReview() {
  const box = $('view-review');
  if (!queue.length) {
    const total = Object.keys(st.deck).length;
    const next = Object.values(st.deck).map((c) => c.due).sort()[0];
    box.innerHTML = `<div class="card empty"><div class="big">${total ? '🎉' : '🌱'}</div>
      <h2>${total ? (sessionDone ? `Done! ${sessionDone} cards reviewed` : 'Nothing to review right now') : 'Your deck is empty'}</h2>
      <p class="muted" style="margin-top:6px">${total ? `${total} cards in your deck.${next ? ` Next review: ${next === addDays(1) ? 'tomorrow' : next}.` : ''}`
        : 'Finish a lesson and its words and sentences show up here the next day.'}</p>
      <div class="row" style="justify-content:center"><button type="button" class="primary" data-tab="today">Go to today</button></div></div>`;
    return;
  }
  const id = queue[0], c = item(id);
  if (!c) { delete st.deck[id]; queue.shift(); save(); renderReview(); return; }
  const box0 = st.deck[id].box;
  box.innerHTML = `<div class="card flash">
    <div class="muted">${queue.length} left · ${c.lesson.emoji} ${esc(c.lesson.theme)} · ${c.kind === 'w' ? 'word' : 'sentence'}</div>
    <div class="prompt">“${esc(c.en)}”</div>
    <div class="muted">Say it in German, out loud.</div>
    ${revealed ? `<div class="answer">${deHtml(c.de)}</div>` : ''}
    <div class="row">
      <button type="button" id="rv-listen">🎤 Say it</button>
      ${revealed ? `<button type="button" data-say="${esc(c.de)}">🔊 Listen</button>` : '<button type="button" class="primary" id="rv-show">Show answer</button>'}
    </div>
    <div class="heard" id="rv-heard"></div>
    ${revealed ? `<div class="rate">
      <button type="button" class="again" data-rate="0">Again<small>today</small></button>
      <button type="button" class="good" data-rate="1">Good<small>${INTERVALS[Math.min(box0 + 1, 5)]} d</small></button>
      <button type="button" data-rate="2">Easy<small>${INTERVALS[Math.min(box0 + 2, 5)]} d</small></button>
    </div>` : ''}
  </div>`;
}

$('view-review').addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  const id = queue[0];
  if (t.dataset.tab) { showView(t.dataset.tab); return; }
  if (t.id === 'rv-show') { revealed = true; renderReview(); speak(item(id).de); }
  else if (t.id === 'rv-listen') {
    const out = $('rv-heard');
    listen(item(id).de, out, t, () => {
      if (revealed) return;
      const txt = out.textContent, cls = out.className;
      revealed = true; renderReview();
      $('rv-heard').textContent = txt; $('rv-heard').className = cls;
    });
  } else if (t.dataset.say) speak(t.dataset.say);
  else if (t.dataset.rate !== undefined) {
    const card = st.deck[id], r = +t.dataset.rate;
    queue.shift();
    if (r === 0) { card.box = 0; card.due = ymd(); queue.push(id); }
    else { card.box = Math.min(card.box + r, INTERVALS.length - 1); card.due = addDays(INTERVALS[card.box]); sessionDone++; }
    revealed = false; markActive();
    if (!queue.length) { tickRoutine(0); toast('Review done! 🎉'); }
    save(); renderReview(); renderStats();
  }
});

/* ================= My phrases ================= */
function renderMine() {
  $('view-mine').innerHTML = `<div class="card"><h2>⭐ Add your own phrase</h2>
      <p class="muted" style="margin:6px 0 12px">Heard something useful at uni, the Bäckerei or from your flatmates? Add it here. It goes straight into Review.</p>
      <form id="mine-form" class="mine-form" autocomplete="off">
        <label>German<input id="mine-de" lang="de" required maxlength="160" placeholder="z. B. Hast du kurz Zeit?"></label>
        <label>English<input id="mine-en" required maxlength="160" placeholder="e.g. Do you have a minute?"></label>
        <div class="row"><button type="button" class="ghost" id="mine-hear">🔊 Hear it</button><button class="primary">＋ Add phrase</button></div>
      </form></div>
    <div class="card"><div class="card-head"><h2>Your phrases</h2><span class="muted">${st.mine.length}</span></div>
      ${st.mine.length ? `<div class="words">${st.mine.slice().reverse().map((p) => `
        <div class="word mine"><span class="de">${deHtml(p.de)}</span><span class="en">${esc(p.en)}</span>
          <span class="acts"><button type="button" class="ghost icon" data-say="${esc(p.de)}" aria-label="Play">🔊</button>
          <button type="button" class="ghost icon" data-del="${p.id}" aria-label="Delete">🗑</button></span></div>`).join('')}</div>`
      : '<p class="muted">No phrases yet. Your first one could be the last thing someone said to you in German!</p>'}</div>`;
}
$('view-mine').addEventListener('submit', (e) => {
  e.preventDefault();
  const de = $('mine-de').value.trim(), en = $('mine-en').value.trim();
  if (!de || !en) return;
  const id = `my-${Date.now()}`;
  st.mine.push({ id, de, en });
  addToDeck([id], true);
  markActive(); save(); renderMine(); renderStats();
  toast('Added! It\'s in Review now ⭐');
  $('mine-de').focus();
});
$('view-mine').addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.id === 'mine-hear') { const v = $('mine-de').value.trim(); if (v) speak(v); }
  else if (t.dataset.say) speak(t.dataset.say);
  else if (t.dataset.del) {
    if (!t.dataset.armed) { t.dataset.armed = '1'; t.textContent = '✓?'; t.title = 'Tap again to delete'; return; }
    st.mine = st.mine.filter((p) => p.id !== t.dataset.del);
    delete st.deck[t.dataset.del];
    save(); renderMine(); renderStats(); toast('Phrase deleted');
  }
});

/* ================= 90-day path ================= */
function renderPath() {
  const cur = currentDay();
  let h = `<div class="card"><div class="card-head"><h2>🎙 My recordings</h2><span class="muted">Compare Day 1 with today</span></div>
    <div id="recs"><p class="muted">Loading…</p></div></div>
    <details class="card guide"><summary><h2>🔤 Pronunciation guide</h2><span class="muted">${SOUNDS.length} sounds</span></summary>
      ${SOUNDS.map((s) => `<div class="sound-row"><h3>${esc(s.title)}</h3><p class="muted">${esc(s.how)}</p>
        <div class="row">${s.ex.map((w) => `<button type="button" data-say="${esc(w)}" data-slow="1">🔊 ${esc(w)}</button>`).join('')}</div></div>`).join('')}
    </details>`;
  h += SECTIONS.map((sec, si) => {
    const start = sectionStart(si);
    const days = PLAN.map((d, i) => [d, i]).filter(([d]) => d.section === si);
    const doneN = days.filter(([, i]) => st.completed.includes(i)).length;
    return `<div class="card section">
      <div class="card-head"><h2><span class="level">${sec.level}</span> Section ${si + 1}: ${esc(sec.title)}</h2>
      <span class="muted">Days ${start + 1}–${start + days.length} · ${doneN}/${days.length}</span></div>
      <p class="muted">${esc(sec.about)}</p>
      <div class="meter"><div style="width:${(doneN / days.length) * 100}%"></div></div>
      <div class="path">${days.map(([d, i]) => {
        const score = st.scores[i];
        const cls = [st.completed.includes(i) ? 'done' : '', score !== undefined && score < PASS ? 'fail' : '', i === cur ? 'current' : '', `t-${d.type}`].join(' ');
        const sub = { learn: 'Learn', revise: 'Revise', test: 'Test', sreview: 'Review', exam: 'Exam' }[d.type];
        return `<button type="button" data-open="${i}" class="${cls}">
          <span class="n">Day ${i + 1} · ${sub}${score !== undefined ? ` · ${score}%` : ''}</span>
          <span class="t">${dayEmoji(d)} ${esc(d.type === 'revise' ? LESSONS[d.lesson].theme : dayTitle(d))}</span></button>`;
      }).join('')}</div></div>`;
  }).join('');
  $('view-path').innerHTML = h;
  renderRecordings();
}
const recUrls = [];
async function renderRecordings() {
  const box = $('recs');
  if (!box) return;
  let recs;
  try { recs = await recDB.all(); } catch { box.innerHTML = '<p class="muted">This browser can\'t save recordings.</p>'; return; }
  recUrls.splice(0).forEach((u) => URL.revokeObjectURL(u));
  if (!recs.length) { box.innerHTML = '<p class="muted">No recordings yet. Use 🎙 <b>Record my answer</b> in a speaking challenge. In a few weeks you\'ll hear how much you\'ve improved.</p>'; return; }
  recs.sort((a, b) => a.date.localeCompare(b.date));
  box.innerHTML = `<div class="recs">${recs.map((r, k) => {
    const url = URL.createObjectURL(r.blob); recUrls.push(url);
    const tag = k === 0 ? '<span class="pill">first</span>' : k === recs.length - 1 ? '<span class="pill new">latest</span>' : '';
    return `<div class="rec"><div><b>Day ${r.day + 1}: ${esc(r.title)}</b> ${tag}<div class="muted small">${new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
      <audio controls src="${url}"></audio><button type="button" class="ghost icon" data-delrec="${r.id}" aria-label="Delete recording">🗑</button></div>`;
  }).join('')}</div>`;
}
$('view-path').addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.say) { speak(t.dataset.say, !!t.dataset.slow); return; }
  if (t.dataset.delrec) {
    if (!t.dataset.armed) { t.dataset.armed = '1'; t.textContent = '✓?'; return; }
    try { await recDB.del(+t.dataset.delrec); } catch { /* ignore */ }
    renderRecordings(); return;
  }
  if (t.dataset.open === undefined) return;
  const i = +t.dataset.open;
  viewDay = i === currentDay() ? null : i;
  quiz = null;
  showView('today');
});

/* ================= Tabs ================= */
const VIEWS = ['today', 'review', 'mine', 'path'];
function showView(name) {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  for (const v of VIEWS) $(`view-${v}`).hidden = v !== name;
  if (name === 'review') { startSession(); renderReview(); }
  if (name === 'today') renderToday();
  if (name === 'mine') renderMine();
  if (name === 'path') renderPath();
  window.scrollTo({ top: 0 });
}
document.querySelector('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-view]');
  if (!b) return;
  if (b.dataset.view === 'today') viewDay = null;
  showView(b.dataset.view);
});

/* ================= Settings: voice, reminder, backup, reset ================= */
$('btn-settings').addEventListener('click', () => {
  $('rate').value = st.rate; $('rate-label').textContent = `${st.rate.toFixed(2)}×`;
  $('show-en').checked = st.showEn;
  $('remind-on').checked = st.remind.on; $('remind-time').value = st.remind.time;
  $('reset').textContent = '⟲ Reset all progress'; delete $('reset').dataset.armed;
  $('settings').showModal();
});
$('rate').addEventListener('input', (e) => { st.rate = +e.target.value; $('rate-label').textContent = `${st.rate.toFixed(2)}×`; save(); });
$('show-en').addEventListener('change', (e) => { st.showEn = e.target.checked; save(); renderToday(); });
$('test-voice').addEventListener('click', () => {
  speak('Hallo! Schön, dass du Deutsch lernst.');
  if ('speechSynthesis' in window && !deVoice) toast('No German voice found. Your browser\'s default voice is used.');
});

$('remind-on').addEventListener('change', async (e) => {
  if (e.target.checked) {
    if (!('Notification' in window)) { toast('Notifications aren\'t supported here'); e.target.checked = false; return; }
    let perm = Notification.permission;
    try { if (perm !== 'granted') perm = await Notification.requestPermission(); } catch { perm = 'denied'; }
    if (perm !== 'granted') { toast('Notifications were blocked'); e.target.checked = false; return; }
  }
  st.remind.on = e.target.checked; save();
  toast(st.remind.on ? `Reminder set for ${st.remind.time} ⏰` : 'Reminder off');
});
$('remind-time').addEventListener('change', (e) => { st.remind.time = e.target.value || '08:00'; st.remind.last = ''; save(); });
async function checkReminder() {
  if (!st.remind.on || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const n = new Date(), hm = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  if (hm < st.remind.time || st.remind.last === ymd()) return;
  st.remind.last = ymd(); save();
  if (routineToday().done.includes(1)) return;       // today's lesson already done
  const d = PLAN[currentDay()];
  const title = 'Zeit für Deutsch! 🇩🇪', body = `Day ${currentDay() + 1}: ${dayTitle(d)}. Keep your ${streak()}-day streak going!`;
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) reg.showNotification(title, { body, icon: 'icons/icon-192.png', tag: 'dd-reminder' });
    else new Notification(title, { body, icon: 'icons/icon-192.png' });
  } catch { /* ignore */ }
}

$('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ app: 'deutsch-daily', version: 2, state: st }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `deutsch-daily-backup-${ymd()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup downloaded (recordings are not included)');
});
$('import').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const s = data.state;
    if (data.app !== 'deutsch-daily' || !s || !Array.isArray(s.completed) || typeof s.deck !== 'object') throw new Error('bad');
    st = Object.assign(fresh(), s);
    save(); quiz = null; viewDay = null; $('settings').close(); renderAll();
    toast('Backup restored ✓');
  } catch { toast('That file is not a Deutsch Daily backup'); }
  e.target.value = '';
});
$('reset').addEventListener('click', (e) => {
  const b = e.currentTarget;
  if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = '⚠️ Tap again to delete all progress'; return; }
  st = fresh(); quiz = null; viewDay = null; save(); $('settings').close(); renderAll(); toast('Progress reset');
});

/* ================= Start ================= */
function renderAll() {
  renderStats();
  const active = document.querySelector('.tabs .active').dataset.view;
  if (active === 'today') renderToday();
  if (active === 'review') renderReview();
  if (active === 'mine') renderMine();
  if (active === 'path') renderPath();
}

routineToday(); save();
renderAll();
setInterval(checkReminder, 30000); checkReminder();
document.addEventListener('visibilitychange', () => { if (!document.hidden) { routineToday(); renderStats(); checkReminder(); } });

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
}
