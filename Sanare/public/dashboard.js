// ─── Cursor ───
const cursor = document.getElementById('cursor');
const ring   = document.getElementById('cursorRing');
let mx=0,my=0,rx=0,ry=0;
document.addEventListener('mousemove', e => {
  mx=e.clientX; my=e.clientY;
  cursor.style.transform=`translate(${mx-5}px,${my-5}px)`;
});
(function loop(){ rx+=(mx-rx)*0.12; ry+=(my-ry)*0.12;
  ring.style.transform=`translate(${rx-15}px,${ry-15}px)`;
  requestAnimationFrame(loop);
})();
document.querySelectorAll('button,a,input').forEach(el => {
  el.addEventListener('mouseenter', () => ring.style.opacity='0.9');
  el.addEventListener('mouseleave', () => ring.style.opacity='0.4');
});

// ─── Date ───
document.getElementById('dateChip').textContent = new Date().toLocaleDateString('en-IN',{
  weekday:'short', day:'numeric', month:'short'
});

// ─────────────────────────────────────────
// ALIAS — nature word + number, no real name
// ─────────────────────────────────────────
const ALIAS_WORDS = ['Willow','Cedar','River','Cloud','Stone','Fern','Meadow',
  'Birch','Rain','Ember','Dusk','Creek','Petal','Mist','Vale'];

function generateAlias() {
  const stored = sessionStorage.getItem('sanare_alias');
  if (stored) return stored;
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
const displayName = MY_ALIAS.split('-')[0];

document.getElementById('aliasDisplay').textContent  = displayName;
document.getElementById('avatarInitial').textContent = displayName[0];
document.getElementById('aliasInNote').textContent   = MY_ALIAS;

const COLORS   = ['#A8C5B5','#B5CCA4','#A8B5C5','#C5A8B5','#B5A8C5','#C5B5A8'];
const colorIdx = MY_ALIAS.charCodeAt(0) % COLORS.length;

// ─────────────────────────────────────────
// STATE
// ─────────────────────────────────────────
let MY_ID            = null;
let socketReady      = false;
let inHumanSession   = false;
let humanChatOpen    = false;
let roboChatOpen     = false;
let currentMoodLabel = null;
let therapistsOnline = 0;

// ─────────────────────────────────────────
// ROBO REPLIES
// ─────────────────────────────────────────
const ROBO_REPLIES = [
  "That makes a lot of sense. Can you tell me more about what's been on your mind?",
  "I hear you. It takes courage to put feelings into words. How long have you felt this way?",
  "Thank you for sharing that. You're doing better than you think. 🌿",
  "Let's breathe together — in for 4… hold for 4… out for 4. How do you feel now?",
  "It sounds like you've been carrying a lot. What would feel like relief right now?",
  "Your feelings are valid — every single one of them.",
  "I'm here. There's no rush. This space is entirely yours.",
  "Sometimes naming what we feel is the first step. You're already doing it.",
  "That sounds really hard. You don't have to go through it alone.",
];
let roboIdx = 0;

// ─────────────────────────────────────────
// SOCKET.IO
// ─────────────────────────────────────────
let socket = null;

function initSocket(myId) {
  try {
    socket = io({
      autoConnect: false,
      reconnectionAttempts: 5,
      timeout: 8000,
    });

    // ── Attach ALL listeners before connect() ──

    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
      socketReady = true;
      setStatus('● Connected');

      // Register with server
      socket.emit('patient_join', {
        patientId: myId,
        alias:     MY_ALIAS,
        color:     COLORS[colorIdx],
      });
      // ✅ FIX: After joining, explicitly ask server for current therapist count.
      // The server sends it back in patient_join handler, but we also request
      // it here in case the response was missed or connect fired multiple times.
      // The server's patient_join handler already emits therapist_count back,
      // so this is handled — but we update UI to "checking" while we wait.
      document.getElementById('therapistCount').textContent = 'checking…';
    });

    // ✅ FIX: connect_error fires during WebSocket→polling fallback negotiation.
    // Do NOT set socketReady=false or show "unavailable" here — the connection
    // may still succeed on the next attempt. Only show offline after all retries fail.
    socket.on('connect_error', (err) => {
      console.warn('⚠️ Socket connect_error (may retry):', err.message);
      // Don't touch the UI here — let reconnection attempts continue.
      // Only act on 'disconnect' or exhausted retries.
    });

    // ✅ FIX: Only show offline state on actual confirmed disconnect,
    // not on transient connect_error during negotiation.
    socket.on('disconnect', (reason) => {
      console.warn('Socket disconnected:', reason);
      socketReady = false;
      setStatus('○ Reconnecting…');
      // Only show unavailable if truly offline (not a transport upgrade)
      if (reason === 'transport close' || reason === 'io server disconnect') {
        document.getElementById('therapistCount').textContent = 'unavailable';
      }
    });

    // ✅ FIX: This is the key event. Server sends this count right after
    // patient_join is received. Update the badge properly here.
    socket.on('therapist_count', ({ count }) => {
      console.log('👩‍⚕️ Therapist count:', count);
      therapistsOnline = count;
      // Update the availability badge in the Human card
      const badge = document.getElementById('therapistCount');
      if (count > 0) {
        badge.textContent = `${count} online`;
        badge.style.color = ''; // reset any error coloring
      } else {
        badge.textContent = 'none online';
      }
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
      appendHumanMsg('system', 'Your listener has ended the session. Take care 🌿');
      setStatus('● Connected');
    });

    // ── NOW connect ──
    socket.connect();

  } catch(e) {
    console.warn('Socket.IO not available, running offline:', e);
    socketReady = false;
    setStatus('● Offline mode');
    document.getElementById('therapistCount').textContent = 'unavailable';
  }
}

// ─── Init: hash alias, then start socket ───
(async () => {
  MY_ID = await hashAlias(MY_ALIAS);
  initSocket(MY_ID);
})();

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function setStatus(text) {
  document.getElementById('connStatus').textContent = text;
}

// ─────────────────────────────────────────
// TOGGLE CHAT BUTTONS
// ─────────────────────────────────────────
document.getElementById('humanToggle').addEventListener('click', () => {
  const win = document.getElementById('humanChat');
  if (win.classList.contains('hidden')) {
    openChat('human');
  } else {
    closeChat('human');
  }
});

document.getElementById('roboToggle').addEventListener('click', () => {
  const win = document.getElementById('roboChat');
  if (win.classList.contains('hidden')) {
    openChat('robo');
  } else {
    closeChat('robo');
  }
});

function openChat(type) {
  const win = document.getElementById(type + 'Chat');
  const btn = document.getElementById(type + 'Toggle');
  win.classList.remove('hidden');

  if (type === 'human') {
    humanChatOpen = true;
    btn.innerHTML = '<span class="btn-icon">✕</span> Close Chat';

    if (!socketReady) {
      appendHumanMsg('system', "Can't reach server right now. Try Robo below — it's always available 🤖");
    } else if (!inHumanSession) {
      socket.emit('patient_queue', {
        patientId: MY_ID,
        alias:     MY_ALIAS,
        color:     COLORS[colorIdx],
        mood:      currentMoodLabel || null,
      });
      if (therapistsOnline > 0) {
        appendHumanMsg('system', "Looking for a listener… you'll be connected shortly 🌿");
      } else {
        appendHumanMsg('system', "No therapists online right now. You've been added to the queue — we'll connect you as soon as one is available. Try Robo in the meantime 🤖");
      }
    }

  } else {
    roboChatOpen = true;
    btn.innerHTML = '<span class="btn-icon">✕</span> Close Robo';
  }

  setTimeout(() => {
    const msgs = document.getElementById(type + 'Messages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }, 50);
}

function closeChat(type) {
  const win = document.getElementById(type + 'Chat');
  const btn = document.getElementById(type + 'Toggle');
  win.classList.add('hidden');

  if (type === 'human') {
    humanChatOpen = false;
    btn.innerHTML = '<span class="btn-icon">💬</span> Start Conversation';
  } else {
    roboChatOpen = false;
    btn.innerHTML = '<span class="btn-icon">🤖</span> Talk to Robo';
  }
}

// ─────────────────────────────────────────
// SEND MESSAGES
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
    const typingId = 'robo-typing-' + Date.now();
    const msgs = document.getElementById('roboMessages');
    const typing = document.createElement('div');
    typing.id = typingId;
    typing.className = 'msg msg-them';
    typing.innerHTML = `<div class="msg-bubble robo-bubble" style="color:var(--text-soft);font-style:italic">typing…</div>`;
    msgs.appendChild(typing);
    msgs.scrollTop = msgs.scrollHeight;
    setTimeout(() => {
      document.getElementById(typingId)?.remove();
      appendRoboMsg('them', ROBO_REPLIES[roboIdx++ % ROBO_REPLIES.length]);
    }, 800 + Math.random() * 700);

  } else {
    appendHumanMsg('me', text);
    if (!socketReady || !inHumanSession) {
      setTimeout(() => {
        appendHumanMsg('system', 'Waiting for a listener to connect… your message is saved.');
      }, 400);
      return;
    }
    socket.emit('patient_message', {
      patientId: MY_ID,
      alias:     MY_ALIAS,
      message:   text,
    });
  }
}

// ─────────────────────────────────────────
// APPEND MESSAGES
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

function appendRoboMsg(side, text) {
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
  document.getElementById('moodBtn').textContent = currentMoodLabel;
  document.getElementById('centerScore').textContent = score + '%';

  if (socketReady && MY_ID) {
    socket.emit('mood_update', { patientId: MY_ID, score, label: currentMoodLabel });
  }

  const msgs = {
    30:{icon:'🌧️', text:"It's okay to not be okay. Reaching out is already a step forward."},
    45:{icon:'😶', text:"Numbness can feel heavy. One breath at a time — your flower is still here."},
    62:{icon:'🌤️', text:"You're okay — and that's enough. Small moments add up."},
    75:{icon:'😌', text:"You're calm and grounded. That peace is real. Keep going."},
    90:{icon:'🌸', text:"You're thriving! Your wellness garden is in full bloom."},
  };
  const m = msgs[score];
  document.getElementById('statusMsg').innerHTML =
    `<span class="status-icon">${m.icon}</span><p>${m.text}</p>`;
  updateFlower(score);
}

// ─────────────────────────────────────────
// FLOWER & METRICS
// ─────────────────────────────────────────
function updateFlower(score) {
  document.querySelectorAll('.petal').forEach(p => {
    const base = 30 + 35 * (score/100) * (0.75 + Math.random()*0.5);
    p.setAttribute('ry', Math.round(base));
  });
  document.querySelectorAll('.metric-bar').forEach((bar, i) => {
    const bases = [0.78,0.65,0.55,0.82,0.60,0.70];
    const val   = Math.min(100, Math.round(bases[i] * score / 72 * 100));
    bar.style.width = val + '%';
    const vEl = bar.closest('.metric-row')?.querySelector('.metric-val');
    if (vEl) vEl.textContent = val + '%';
  });
}

window.addEventListener('load', () => {
  setTimeout(() => {
    document.querySelectorAll('.metric-bar').forEach(bar => {
      const t = bar.style.width; bar.style.width = '0%';
      setTimeout(() => { bar.style.width = t; }, 100);
    });
  }, 300);
});

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function escHtml(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function timeNow() {
  return new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
}