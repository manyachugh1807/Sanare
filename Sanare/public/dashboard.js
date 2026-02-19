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
let currentMoodScore = null;
let therapistsOnline = 0;

// ─────────────────────────────────────────
// ROBO AI STATE
// Replaces the old static ROBO_REPLIES array
// ─────────────────────────────────────────
const roboHistory = []; // { role: 'user'|'assistant', content: string }
let roboIsTyping  = false;

// System prompt — defines Robo's personality and safety rules
function buildSystemPrompt() {
  const moodContext = currentMoodScore
    ? `The patient's current mood score is ${currentMoodScore}/100 (${currentMoodLabel}).`
    : 'The patient has not yet shared their mood.';

  return `You are Robo, a compassionate AI mental wellness companion on Sanare — a safe, anonymous mental health support platform.

${moodContext}
The patient's anonymous alias is: ${displayName}. Never ask for or use their real name.

Your role:
- Be warm, empathetic, and non-judgmental
- Use evidence-based approaches: CBT reframing, grounding techniques (5-4-3-2-1), mindful breathing
- Keep each response to 2–3 sentences maximum — brief, present, unhurried
- Respond to the emotional content first, then gently invite reflection
- Never diagnose, prescribe medication, or make clinical judgments
- If you detect crisis signals (self-harm, suicidal ideation, phrases like "end it", "no point"), respond with care and provide: iCall India helpline 9152987821, or international: Crisis Text Line (text HOME to 741741)
- You are not a replacement for professional therapy — if themes become complex, gently suggest speaking to a human listener on Sanare or a professional

Tone: gentle, grounded, present. Like a wise, calm friend who actually listens.`;
}

// ─────────────────────────────────────────
// OPENROUTER GPT-4o CALL (streamed)
// ─────────────────────────────────────────
async function callRoboAI(userText) {
  if (roboIsTyping) return;
  roboIsTyping = true;

  // Add user message to history
  roboHistory.push({ role: 'user', content: userText });

  // Create typing bubble
  const msgs     = document.getElementById('roboMessages');
  const typingEl = document.createElement('div');
  typingEl.className = 'msg msg-them';
  typingEl.innerHTML = `<div class="msg-bubble robo-bubble" id="robo-streaming" style="min-width:60px">
    <span class="robo-dot">·</span><span class="robo-dot">·</span><span class="robo-dot">·</span>
  </div>`;
  msgs.appendChild(typingEl);
  msgs.scrollTop = msgs.scrollHeight;

  // Animate the dots while waiting
  const dotAnim = setInterval(() => {
    const dots = typingEl.querySelectorAll('.robo-dot');
    dots.forEach((d, i) => {
      setTimeout(() => {
        d.style.opacity = d.style.opacity === '0.2' ? '1' : '0.2';
      }, i * 150);
    });
  }, 600);

  try {
    const response = await fetch('/api/robo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          ...roboHistory,
        ],
      }),
    });

    clearInterval(dotAnim);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Stream the response token by token into the bubble
    const bubble = document.getElementById('robo-streaming');
    bubble.innerHTML = '';
    bubble.removeAttribute('id');

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText  = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;

        try {
          const json  = JSON.parse(data);
          const token = json.choices?.[0]?.delta?.content;
          if (token) {
            fullText += token;
            bubble.textContent = fullText;
            msgs.scrollTop = msgs.scrollHeight;
          }
        } catch {
          // Partial JSON chunk — skip
        }
      }
    }

    // Add timestamp after streaming completes
    const timeEl = document.createElement('span');
    timeEl.className = 'msg-time';
    timeEl.textContent = timeNow();
    typingEl.appendChild(timeEl);

    // Save to history for context on next message
    if (fullText) {
      roboHistory.push({ role: 'assistant', content: fullText });
      // Keep history from growing too large — last 20 exchanges
      if (roboHistory.length > 40) roboHistory.splice(0, 2);
    }

  } catch (err) {
    clearInterval(dotAnim);
    console.error('Robo AI error:', err);

    // Graceful fallback — remove typing bubble, show error
    typingEl.remove();
    appendRoboMsg('them', "I'm having a little trouble connecting right now. Take a breath — I'll be back in a moment. 🌿");

    // Remove the user message from history so they can retry
    roboHistory.pop();
  }

  roboIsTyping = false;
}

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

    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
      socketReady = true;
      setStatus('● Connected');
      socket.emit('patient_join', {
        patientId: myId,
        alias:     MY_ALIAS,
        color:     COLORS[colorIdx],
      });
      document.getElementById('therapistCount').textContent = 'checking…';
    });

    socket.on('connect_error', (err) => {
      console.warn('⚠️ Socket connect_error (may retry):', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.warn('Socket disconnected:', reason);
      socketReady = false;
      setStatus('○ Reconnecting…');
      if (reason === 'transport close' || reason === 'io server disconnect') {
        document.getElementById('therapistCount').textContent = 'unavailable';
      }
    });

    socket.on('therapist_count', ({ count }) => {
      therapistsOnline = count;
      const badge = document.getElementById('therapistCount');
      badge.textContent = count > 0 ? `${count} online` : 'none online';
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

    socket.connect();

  } catch(e) {
    console.warn('Socket.IO not available, running offline:', e);
    socketReady = false;
    setStatus('● Offline mode');
    document.getElementById('therapistCount').textContent = 'unavailable';
  }
}

// ─── Init ───
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
  if (win.classList.contains('hidden')) openChat('human');
  else closeChat('human');
});

document.getElementById('roboToggle').addEventListener('click', () => {
  const win = document.getElementById('roboChat');
  if (win.classList.contains('hidden')) openChat('robo');
  else closeChat('robo');
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
        appendHumanMsg('system', "No therapists online right now. You've been added to the queue — try Robo in the meantime 🤖");
      }
    }
  } else {
    roboChatOpen = true;
    btn.innerHTML = '<span class="btn-icon">✕</span> Close Robo';

    // First-time greeting from Robo via AI
    if (roboHistory.length === 0) {
      const greetings = [
        "Hi there. This is a safe, private space — no names, no records. What's on your mind today?",
        "Hey. I'm Robo — I'm here to listen, no judgment. How are you feeling right now?",
        "Welcome. Take your time. What would you like to talk about today?",
      ];
      const greeting = greetings[Math.floor(Math.random() * greetings.length)];
      appendRoboMsg('them', greeting);
      // Seed history so GPT-4o has context
      roboHistory.push({ role: 'assistant', content: greeting });
    }
  }

  setTimeout(() => {
    const m = document.getElementById(type + 'Messages');
    if (m) m.scrollTop = m.scrollHeight;
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
    // Show user's message immediately
    appendRoboMsg('me', text);
    // Call GPT-4o — streams response into a bubble
    callRoboAI(text);

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
  currentMoodScore = score; // ← now stored so Robo system prompt picks it up
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
// UTILS
// ─────────────────────────────────────────
function escHtml(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function timeNow() {
  return new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
}