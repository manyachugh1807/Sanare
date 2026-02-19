// ─── Cursor ───
const cursor = document.getElementById('cursor');
const ring   = document.getElementById('cursorRing');
let mx=0,my=0,rx=0,ry=0;
document.addEventListener('mousemove', e => {
  mx=e.clientX; my=e.clientY;
  cursor.style.transform=`translate(${mx-5}px,${my-5}px)`;
});
(function loop(){
  rx+=(mx-rx)*0.12; ry+=(my-ry)*0.12;
  ring.style.transform=`translate(${rx-15}px,${ry-15}px)`;
  requestAnimationFrame(loop);
})();

document.getElementById('dateChip').textContent = new Date().toLocaleDateString('en-IN',{
  weekday:'short', day:'numeric', month:'short'
});

// ─── State ───
let activePatientId = null;
let sessionStart    = null;
let messageHistory  = [];
let sessionTimer    = null;
let queueData       = [];

// ─── Socket.IO ───
const socket = io({ autoConnect: false });

socket.on('connect', () => {
  console.log('✅ Therapist connected:', socket.id);
  document.getElementById('therapistStatus').textContent = '● Online';
  socket.emit('therapist_join');
});

socket.on('disconnect', () => {
  document.getElementById('therapistStatus').textContent = '○ Reconnecting…';
});

socket.on('connect_error', (err) => {
  console.warn('Socket error:', err.message);
  document.getElementById('therapistStatus').textContent = '○ Connecting…';
});

socket.on('queue_update', ({ queue }) => {
  console.log('📋 Queue:', queue.length, 'patients');
  queueData = queue;
  renderQueue(queue);
});

socket.on('patient_message', ({ patientId, alias, message }) => {
  if (patientId !== activePatientId) return;
  addMsg('them', alias, message);
  messageHistory.push({ role:'patient', text:message });
  updateAI();
  checkFlags(message);
  updateSentiment(message);
});

socket.on('mood_update', ({ patientId, score }) => {
  if (patientId !== activePatientId) return;
  updateWellness(score);
});

socket.on('session_ended_by_patient', ({ patientId }) => {
  if (patientId !== activePatientId) return;
  sysMsg('Patient has ended the session.');
  clearSession();
});

socket.connect();

// ─── Queue ───
function renderQueue(queue) {
  const list  = document.getElementById('queueList');
  const count = document.getElementById('queueCount');
  count.textContent = queue.length + ' waiting';

  if (!queue.length) {
    list.innerHTML = `<div class="queue-empty"><span>🌿</span><p>No one waiting right now.</p></div>`;
    return;
  }

  list.innerHTML = queue.map(p => `
    <div class="queue-item ${p.id === activePatientId ? 'active-session' : ''}"
         data-id="${p.id}" data-alias="${p.alias}" data-color="${p.color || '#A8C5B5'}">
      <div class="q-avatar" style="background:${p.color || '#A8C5B5'}">${(p.alias||'?')[0]}</div>
      <div class="q-info">
        <span class="q-alias">${p.alias}</span>
        <span class="q-wait">Waiting ${p.waitTime}</span>
      </div>
      ${p.mood ? `<span class="q-mood-chip">${p.mood}</span>` : ''}
      ${p.id !== activePatientId
        ? `<button class="accept-btn">Accept</button>`
        : `<span style="font-size:11px;color:var(--t-accent);font-weight:500">Active</span>`}
    </div>
  `).join('');

  list.querySelectorAll('.accept-btn').forEach(btn => {
    const item = btn.closest('.queue-item');
    btn.addEventListener('click', () => {
      acceptSession(item.dataset.id, item.dataset.alias, item.dataset.color);
    });
  });
}

// ─── Accept / End Session ───
function acceptSession(patientId, alias, color) {
  if (activePatientId && !confirm('End current session and switch?')) return;
  if (activePatientId) endSession(true);

  activePatientId = patientId;
  sessionStart    = new Date();
  messageHistory  = [];

  document.getElementById('activeAlias').textContent       = alias;
  document.getElementById('activeAvatar').textContent      = alias[0];
  document.getElementById('activeAvatar').style.background = color;
  document.getElementById('activeSince').textContent       = 'Just started';
  document.getElementById('flowerAliasTag').textContent    = alias;

  setUI(true);

  document.getElementById('therapistMessages').innerHTML =
    `<div class="msg-system">Session started with ${alias}</div>`;
  document.getElementById('aiSummaryBox').innerHTML =
    `<p class="ai-placeholder">Listening…</p>`;
  document.getElementById('flagsList').innerHTML =
    `<span class="flag-chip neutral">No concerns flagged</span>`;
  document.getElementById('flowerScore').textContent = '—';
  setSentimentBar(50);
  resetWellness();

  clearInterval(sessionTimer);
  sessionTimer = setInterval(() => {
    const s = Math.floor((new Date() - sessionStart) / 1000);
    document.getElementById('activeSince').textContent = `${Math.floor(s/60)}m ${s%60}s`;
  }, 1000);

  socket.emit('therapist_accept', { patientId });
  renderQueue(queueData);
  sysMsg(`Connected with ${alias}. Identity encrypted.`);
}

function endSession(silent = false) {
  if (!activePatientId) return;
  if (!silent) socket.emit('therapist_end_session', { patientId: activePatientId });
  clearSession();
}

function clearSession() {
  clearInterval(sessionTimer);
  activePatientId = null;

  document.getElementById('activeAlias').textContent       = 'No active session';
  document.getElementById('activeAvatar').textContent      = '·';
  document.getElementById('activeAvatar').style.background = 'var(--sage-dark)';
  document.getElementById('activeSince').textContent       = 'Select a patient from the queue';
  document.getElementById('flowerAliasTag').textContent    = 'No session';

  setUI(false);
  document.getElementById('therapistMessages').innerHTML = `<div class="msg-system">Session ended</div>`;
  document.getElementById('flowerScore').textContent = '—';
  setSentimentBar(50);
  resetWellness();
  renderQueue(queueData);
}

function setUI(active) {
  ['therapistInput','notesArea'].forEach(id =>
    document.getElementById(id).disabled = !active);
  ['therapistSendBtn','endSessionBtn'].forEach(id =>
    document.getElementById(id).disabled = !active);
}

// ─── Send Message ───
document.getElementById('therapistSendBtn').addEventListener('click', sendMsg);
document.getElementById('therapistInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') sendMsg();
});

function sendMsg() {
  if (!activePatientId) return;
  const input = document.getElementById('therapistInput');
  const text  = input.value.trim();
  if (!text) return;

  addMsg('me', 'You', text);
  messageHistory.push({ role:'therapist', text });
  socket.emit('therapist_message', { patientId: activePatientId, message: text });
  input.value = '';
  updateAI();
}

// ─── Messages ───
function addMsg(side, label, text) {
  const msgs = document.getElementById('therapistMessages');
  const d    = document.createElement('div');
  d.className = `msg msg-${side === 'me' ? 'me' : 'them'}`;
  d.innerHTML = `
    <span class="msg-label">${side === 'me' ? 'You' : label}</span>
    <div class="msg-bubble">${esc(text)}</div>
    <span class="msg-time">${now()}</span>`;
  msgs.appendChild(d);
  msgs.scrollTop = msgs.scrollHeight;
}

function sysMsg(text) {
  const msgs = document.getElementById('therapistMessages');
  const d    = document.createElement('div');
  d.className = 'msg-system';
  d.textContent = text;
  msgs.appendChild(d);
  msgs.scrollTop = msgs.scrollHeight;
}

// ─── AI Summary ───
let aiTimer = null;

function updateAI() {
  clearTimeout(aiTimer);
  aiTimer = setTimeout(() => {
    const lines = messageHistory.filter(m => m.role==='patient').map(m => m.text);
    if (!lines.length) return;
    document.getElementById('aiSummaryBox').innerHTML =
      `<p class="ai-summary-text">${buildSummary(lines)}</p>`;
  }, 1500);
}

function buildSummary(lines) {
  const t = lines.join(' ').toLowerCase();
  let themes = [], tone = 'neutral';

  if (/anxious|stress|worry|panic/.test(t))   themes.push('anxiety');
  if (/sad|depress|hopeless|empty/.test(t))   themes.push('low mood');
  if (/sleep|tired|exhausted/.test(t))        themes.push('sleep issues');
  if (/angry|frustrat/.test(t))               themes.push('frustration');
  if (/alone|lonely|isolated/.test(t))        themes.push('loneliness');
  if (/work|job|pressure/.test(t))            themes.push('work stress');
  if (/family|relationship|partner/.test(t))  themes.push('relationship strain');
  if (/better|progress|hope/.test(t))       { themes.push('positive shift'); tone='positive'; }
  if (!themes.length) themes = ['general distress'];

  if (/hopeless|harm|die|end it/.test(t))     tone = 'critical';
  else if (/better|hopeful/.test(t))          tone = 'stable';
  else if (themes.length > 2)                 tone = 'elevated';

  let rec = 'Continue <strong>active listening</strong>.';
  if (tone==='critical') rec = '<strong>⚠️ Safety assessment recommended.</strong>';
  if (tone==='elevated') rec = '<strong>Grounding or CBT</strong> may help.';
  if (tone==='positive') rec = '<strong>Reinforce positive progress.</strong>';

  return `Themes: <strong>${themes.join(', ')}</strong>. Tone: <strong>${tone}</strong>. ${lines.length} msg${lines.length>1?'s':''} analysed. ${rec}`;
}

function checkFlags(text) {
  const t = text.toLowerCase();
  const flags = [];
  if (/harm|hurt myself|end it|suicide|die/.test(t)) flags.push({l:'⚠️ Self-harm language',c:'red'});
  if (/hopeless|worthless|no point/.test(t))         flags.push({l:'🔴 Hopelessness',c:'red'});
  if (/alone|no one|isolated/.test(t))               flags.push({l:'🟡 Social isolation',c:'yellow'});
  if (/anxious|panic/.test(t))                       flags.push({l:'🟡 Acute anxiety',c:'yellow'});
  if (/better|progress|good today/.test(t))          flags.push({l:'🟢 Positive signal',c:'green'});

  document.getElementById('flagsList').innerHTML = flags.length
    ? flags.map(f=>`<span class="flag-chip ${f.c}">${f.l}</span>`).join('')
    : `<span class="flag-chip neutral">No concerns flagged</span>`;
}

function setSentimentBar(pct) {
  const bar = document.getElementById('sentimentBar');
  if (bar) bar.style.width = Math.max(5, Math.min(95, pct)) + '%';
}

function updateSentiment(text) {
  const t   = text.toLowerCase();
  const neg = (t.match(/sad|depressed|hopeless|anxious|panic|harm|die/g)||[]).length;
  const pos = (t.match(/better|good|calm|hope|progress|grateful/g)||[]).length;
  setSentimentBar(Math.max(5, Math.min(95, 50 - neg*12 + pos*10)));
}

function updateWellness(score) {
  document.getElementById('flowerScore').textContent = score + '%';
  const m = { mood:1.05, sleep:0.88, anxiety:0.75, energy:0.82 };
  Object.entries(m).forEach(([k,f]) => {
    const val = Math.min(100, Math.round(score*f));
    const b = document.getElementById(`mbar-${k}`);
    const v = document.getElementById(`mval-${k}`);
    if (b) b.style.width = val+'%';
    if (v) v.textContent = val+'%';
  });
}

function resetWellness() {
  ['mood','sleep','anxiety','energy'].forEach(k => {
    const b = document.getElementById(`mbar-${k}`);
    const v = document.getElementById(`mval-${k}`);
    if (b) b.style.width = '0%';
    if (v) v.textContent = '—';
  });
}

// ─── Notes ───
document.getElementById('saveNotesBtn').addEventListener('click', () => {
  const btn = document.getElementById('saveNotesBtn');
  btn.textContent = 'Saved ✓';
  setTimeout(() => btn.textContent = 'Save', 2000);
});

// ─── Utils ───
function esc(t) { return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function now()  { return new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}); }