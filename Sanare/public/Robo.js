// ═══════════════════════════════════════════════════
//  dashboard.js  —  Sanare patient dashboard
//  robo.js must be loaded BEFORE this file
// ═══════════════════════════════════════════════════

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

// ─── Date ───
document.getElementById('dateChip').textContent = new Date().toLocaleDateString('en-IN',{
  weekday:'short', day:'numeric', month:'short'
});

// ─────────────────────────────────────────
// ALIAS
// ─────────────────────────────────────────
const ALIAS_WORDS = ['Willow','Cedar','River','Cloud','Stone','Fern','Meadow',
  'Birch','Rain','Ember','Dusk','Creek','Petal','Mist','Vale'];

function generateAlias() {
  const s = sessionStorage.getItem('sanare_alias');
  if (s) return s;
  const word  = ALIAS_WORDS[Math.floor(Math.random() * ALIAS_WORDS.length)];
  const num   = Math.floor(1000 + Math.random() * 9000);
  const alias = `${word}-${num}`;
  sessionStorage.setItem('sanare_alias', alias);
  return alias;
}

async function hashAlias(alias) {
  const enc = new TextEncoder().encode(alias + '_sanare_salt');
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2,'0')).join('').slice(0,16);
}

const MY_ALIAS    = generateAlias();
const displayName = MY_ALIAS.split('-')[0];       // exposed to robo.js
document.getElementById('aliasDisplay').textContent  = displayName;
document.getElementById('avatarInitial').textContent = displayName[0];
document.getElementById('aliasInNote').textContent   = MY_ALIAS;

const COLORS   = ['#A8C5B5','#B5CCA4','#A8B5C5','#C5A8B5','#B5A8C5','#C5B5A8'];
const myColor  = COLORS[MY_ALIAS.charCodeAt(0) % COLORS.length];

// ─────────────────────────────────────────
// STATE  (some exposed to robo.js)
// ─────────────────────────────────────────
let MY_ID            = null;
let socketReady      = false;
let inHumanSession   = false;
let humanChatOpen    = false;
let roboChatOpen     = false;
let currentMoodLabel = null;   // read by robo.js
let currentMoodScore = null;   // read by robo.js
let therapistsOnline = 0;

// ─────────────────────────────────────────
// FLOWER  (setFlowerTarget / pulseFlower exposed to robo.js)
// ─────────────────────────────────────────
let flowerScore     = 72;
let flowerTarget    = 72;      // exposed to robo.js
let _flowerFrame    = null;

function animateFlower() {
  const diff = flowerTarget - flowerScore;
  if (Math.abs(diff) < 0.4) { flowerScore = flowerTarget; renderFlower(flowerScore); return; }
  flowerScore += diff * 0.035;
  renderFlower(flowerScore);
  _flowerFrame = requestAnimationFrame(animateFlower);
}

function setFlowerTarget(s) {   // called by robo.js
  flowerTarget = Math.max(4, Math.min(100, s));
  cancelAnimationFrame(_flowerFrame);
  _flowerFrame = requestAnimationFrame(animateFlower);
}

function pulseFlower(direction) {  // called by robo.js
  const svg = document.querySelector('.flower-svg');
  if (!svg) return;
  svg.style.transition = 'filter 0.4s ease';
  svg.style.filter = direction === 'up'
    ? 'drop-shadow(0 0 14px rgba(168,197,181,0.85))'
    : 'drop-shadow(0 0 14px rgba(192,122,138,0.6))';
  setTimeout(() => svg.style.filter = '', 2200);
}

function renderFlower(score) {
  const petals     = document.querySelectorAll('.petal');
  const s          = score / 100;
  const alivePetals = Math.max(2, Math.round(2 + s * 6));

  petals.forEach((petal, i) => {
    if (i >= alivePetals) {
      petal.setAttribute('ry', '4');
      petal.style.opacity = '0.06';
    } else {
      const wave = 0.85 + Math.sin(i * 2.1 + 1) * 0.15;
      petal.setAttribute('ry', Math.round(14 + s * 46 * wave));
      petal.style.opacity = (0.65 + s * 0.3).toFixed(2);
    }
    petal.style.transition = 'opacity 1.8s ease';
  });

  const scoreEl = document.getElementById('centerScore');
  if (scoreEl) scoreEl.textContent = Math.round(score) + '%';

  const bases = [0.78,0.65,0.55,0.82,0.60,0.70];
  document.querySelectorAll('.metric-bar').forEach((bar, i) => {
    const val = Math.min(100, Math.round(bases[i] * score / 72 * 100));
    bar.style.width = val + '%';
    bar.style.transition = 'width 1.8s ease';
    const v = bar.closest('.metric-row')?.querySelector('.metric-val');
    if (v) v.textContent = val + '%';
  });

  const el = document.getElementById('statusMsg');
  if (el) {
    let icon, text;
    if      (score < 25) { icon='🥀'; text="It's okay to struggle. Your flower is resting — it will bloom again."; }
    else if (score < 40) { icon='🌧️'; text="Heavy days are real. You reached out — that already takes courage."; }
    else if (score < 55) { icon='🌱'; text="Something small is growing. One breath at a time."; }
    else if (score < 70) { icon='🌤️'; text="You're finding your footing. Keep going."; }
    else if (score < 85) { icon='🌿'; text="You're on the right track. Your flower is gently blooming."; }
    else                  { icon='🌸'; text="You're thriving. Your wellness garden is in full bloom."; }
    el.innerHTML = `<span class="status-icon">${icon}</span><p>${text}</p>`;
  }
}

// ─────────────────────────────────────────
// SOCKET.IO — fixed: listeners FIRST, connect LAST
// ─────────────────────────────────────────
let socket = null;

function initSocket(myId) {
  // Create with autoConnect:false so we register all listeners before connecting
  socket = io({ autoConnect: false });

  socket.on('connect', () => {
    console.log('✅ Patient connected:', socket.id);
    socketReady = true;
    setStatus('● Connected');
    socket.emit('patient_join', {
      patientId: myId,
      alias:     MY_ALIAS,
      color:     myColor,
    });
  });

  socket.on('connect_error', (err) => {
    console.warn('Socket error:', err.message);
    socketReady = false;
    setStatus('○ Connection failed');
  });

  socket.on('disconnect', () => {
    socketReady = false;
    setStatus('○ Reconnecting…');
  });

  socket.on('therapist_count', ({ count }) => {
    therapistsOnline = count;
    document.getElementById('therapistCount').textContent =
      count > 0 ? `${count} online` : 'none online';
  });

  socket.on('queue_position', ({ position }) => {
    setStatus(`● Queue: #${position}`);
  });

  socket.on('session_accepted', () => {
    inHumanSession = true;
    setStatus('● In session');
    if (!humanChatOpen) openChat('human');
    appendHumanMsg('system', 'A listener has joined. This space is safe and private 🌿');
  });

  socket.on('therapist_message', ({ message }) => {
    appendHumanMsg('them', message);
  });

  socket.on('session_ended_by_therapist', () => {
    inHumanSession = false;
    setStatus('● Connected');
    appendHumanMsg('system', 'Your listener has ended the session. Take care 🌿');
  });

  // Connect AFTER all listeners are attached
  socket.connect();
}

// Hash alias then init socket
(async () => {
  MY_ID = await hashAlias(MY_ALIAS);
  initSocket(MY_ID);
})();

function setStatus(t) {
  document.getElementById('connStatus').textContent = t;
}

// ─────────────────────────────────────────
// CHAT TOGGLES
// ─────────────────────────────────────────
document.getElementById('humanToggle').addEventListener('click', () => {
  document.getElementById('humanChat').classList.contains('hidden')
    ? openChat('human') : closeChat('human');
});
document.getElementById('roboToggle').addEventListener('click', () => {
  document.getElementById('roboChat').classList.contains('hidden')
    ? openChat('robo') : closeChat('robo');
});

function openChat(type) {
  document.getElementById(type + 'Chat').classList.remove('hidden');
  const btn = document.getElementById(type + 'Toggle');

  if (type === 'human') {
    humanChatOpen = true;
    btn.innerHTML = '<span class="btn-icon">✕</span> Close Chat';
    if (!socketReady) {
      appendHumanMsg('system', "Can't reach server. Try Robo below 🤖");
    } else if (!inHumanSession) {
      socket.emit('patient_queue', {
        patientId: MY_ID,
        alias:     MY_ALIAS,
        color:     myColor,
        mood:      currentMoodLabel || null,
      });
      appendHumanMsg('system', therapistsOnline > 0
        ? "Looking for a listener… connecting shortly 🌿"
        : "No therapists online. Added to queue — try Robo in the meantime 🤖");
    }
  } else {
    roboChatOpen = true;
    btn.innerHTML = '<span class="btn-icon">✕</span> Close Robo';
    // Greet via robo.js
    if (typeof sendRoboGreeting === 'function') sendRoboGreeting();
  }

  setTimeout(() => {
    const m = document.getElementById(type + 'Messages');
    if (m) m.scrollTop = m.scrollHeight;
  }, 50);
}

function closeChat(type) {
  document.getElementById(type + 'Chat').classList.add('hidden');
  const btn = document.getElementById(type + 'Toggle');
  if (type === 'human') {
    humanChatOpen = false;
    btn.innerHTML = '<span class="btn-icon">💬</span> Start Conversation';
  } else {
    roboChatOpen = false;
    btn.innerHTML = '<span class="btn-icon">🤖</span> Talk to Robo';
  }
}

// ─────────────────────────────────────────
// SEND
// ─────────────────────────────────────────
document.getElementById('humanSendBtn').addEventListener('click', () => sendMsg('human'));
document.getElementById('roboSendBtn').addEventListener('click',  () => sendMsg('robo'));
document.getElementById('humanInput').addEventListener('keydown', e => { if(e.key==='Enter') sendMsg('human'); });
document.getElementById('roboInput').addEventListener('keydown',  e => { if(e.key==='Enter') sendMsg('robo'); });

function sendMsg(type) {
  const input = document.getElementById(type + 'Input');
  const text  = input.value.trim();
  if (!text) return;
  input.value = '';

  if (type === 'robo') {
    appendRoboMsg('me', text);
    if (typeof callRoboAI === 'function') callRoboAI(text);
  } else {
    appendHumanMsg('me', text);
    if (!socketReady || !inHumanSession) {
      setTimeout(() => appendHumanMsg('system', 'Waiting for a listener to connect…'), 400);
      return;
    }
    socket.emit('patient_message', { patientId: MY_ID, alias: MY_ALIAS, message: text });
  }
}

// ─────────────────────────────────────────
// MESSAGE RENDERERS  (used by robo.js too)
// ─────────────────────────────────────────
function appendHumanMsg(side, text) {
  const msgs = document.getElementById('humanMessages');
  if (side === 'system') {
    const d = document.createElement('div');
    d.style.cssText = 'text-align:center;font-size:12px;color:var(--text-soft);font-style:italic;padding:8px 0;line-height:1.5;';
    d.textContent = text;
    msgs.appendChild(d);
  } else {
    const d = document.createElement('div');
    d.className = `msg msg-${side === 'me' ? 'me' : 'them'}`;
    d.innerHTML = `<div class="msg-bubble">${escHtml(text)}</div><span class="msg-time">${timeNow()}</span>`;
    msgs.appendChild(d);
  }
  msgs.scrollTop = msgs.scrollHeight;
}

function appendRoboMsg(side, text) {  // called by robo.js
  const msgs = document.getElementById('roboMessages');
  const d = document.createElement('div');
  d.className = `msg msg-${side === 'me' ? 'me' : 'them'}`;
  d.innerHTML = `<div class="msg-bubble ${side==='them'?'robo-bubble':''}">${escHtml(text)}</div><span class="msg-time">${timeNow()}</span>`;
  msgs.appendChild(d);
  msgs.scrollTop = msgs.scrollHeight;
}

// ─────────────────────────────────────────
// MOOD MODAL
// ─────────────────────────────────────────
document.getElementById('moodBtn').addEventListener('click', () =>
  document.getElementById('moodModal').classList.remove('hidden'));

function closeMood() {
  document.getElementById('moodModal').classList.add('hidden');
}

function selectMood(emoji, label, score) {
  closeMood();
  currentMoodLabel = `${emoji} ${label}`;
  currentMoodScore = score;
  document.getElementById('moodBtn').textContent = currentMoodLabel;
  if (socketReady && MY_ID) {
    socket.emit('mood_update', { patientId: MY_ID, score, label: currentMoodLabel });
  }
  setFlowerTarget(score);
  pulseFlower(score >= flowerScore ? 'up' : 'down');
}

// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────
function escHtml(t) { return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function timeNow()  { return new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}); }

window.addEventListener('load', () => {
  renderFlower(flowerScore);
  setTimeout(() => {
    document.querySelectorAll('.metric-bar').forEach(bar => {
      const t = bar.style.width; bar.style.width = '0%';
      setTimeout(() => bar.style.width = t, 100);
    });
  }, 300);
});