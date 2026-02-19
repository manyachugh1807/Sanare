// ═══════════════════════════════════════════════════
// dashboard.js — COMPLETE, single file, no splits
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

document.getElementById('dateChip').textContent = new Date().toLocaleDateString('en-IN',{
  weekday:'short', day:'numeric', month:'short'
});

// ─── Alias ───
const ALIAS_WORDS = ['Willow','Cedar','River','Cloud','Stone','Fern','Meadow',
  'Birch','Rain','Ember','Dusk','Creek','Petal','Mist','Vale'];

function generateAlias() {
  const s = sessionStorage.getItem('sanare_alias');
  if (s) return s;
  const word = ALIAS_WORDS[Math.floor(Math.random()*ALIAS_WORDS.length)];
  const num  = Math.floor(1000 + Math.random()*9000);
  const a    = `${word}-${num}`;
  sessionStorage.setItem('sanare_alias', a);
  return a;
}

async function hashAlias(alias) {
  const enc = new TextEncoder().encode(alias+'_sanare_salt');
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,16);
}

const MY_ALIAS    = generateAlias();
const displayName = MY_ALIAS.split('-')[0];
document.getElementById('aliasDisplay').textContent  = displayName;
document.getElementById('avatarInitial').textContent = displayName[0];
document.getElementById('aliasInNote').textContent   = MY_ALIAS;

const COLORS  = ['#A8C5B5','#B5CCA4','#A8B5C5','#C5A8B5','#B5A8C5','#C5B5A8'];
const myColor = COLORS[MY_ALIAS.charCodeAt(0) % COLORS.length];

// ─── State ───
let MY_ID            = null;
let socketReady      = false;
let inHumanSession   = false;
let humanChatOpen    = false;
let roboChatOpen     = false;
let currentMoodLabel = null;
let currentMoodScore = null;
let therapistsOnline = 0;

// ─── Flower ───
let flowerScore  = 72;
let flowerTarget = 72;
let flowerAF     = null;

function setFlowerTarget(s) {
  flowerTarget = Math.max(4, Math.min(100, s));
  cancelAnimationFrame(flowerAF);
  flowerAF = requestAnimationFrame(animateFlower);
}

function animateFlower() {
  const diff = flowerTarget - flowerScore;
  if (Math.abs(diff) < 0.4) { flowerScore = flowerTarget; renderFlower(flowerScore); return; }
  flowerScore += diff * 0.035;
  renderFlower(flowerScore);
  flowerAF = requestAnimationFrame(animateFlower);
}

function pulseFlower(dir) {
  const svg = document.querySelector('.flower-svg');
  if (!svg) return;
  svg.style.filter = dir==='up'
    ? 'drop-shadow(0 0 14px rgba(168,197,181,0.85))'
    : 'drop-shadow(0 0 14px rgba(192,122,138,0.6))';
  setTimeout(() => svg.style.filter='', 2200);
}

function renderFlower(score) {
  const petals = document.querySelectorAll('.petal');
  const s      = score/100;
  const alive  = Math.max(2, Math.round(2 + s*6));
  petals.forEach((p,i) => {
    p.style.transition = 'opacity 1.8s ease';
    if (i >= alive) { p.setAttribute('ry','4'); p.style.opacity='0.06'; }
    else {
      const wave = 0.85 + Math.sin(i*2.1+1)*0.15;
      p.setAttribute('ry', Math.round(14 + s*46*wave));
      p.style.opacity = (0.65 + s*0.3).toFixed(2);
    }
  });
  const sc = document.getElementById('centerScore');
  if (sc) sc.textContent = Math.round(score)+'%';

  const bases = [0.78,0.65,0.55,0.82,0.60,0.70];
  document.querySelectorAll('.metric-bar').forEach((bar,i) => {
    const val = Math.min(100, Math.round(bases[i]*score/72*100));
    bar.style.width = val+'%'; bar.style.transition = 'width 1.8s ease';
    const v = bar.closest('.metric-row')?.querySelector('.metric-val');
    if (v) v.textContent = val+'%';
  });

  const el = document.getElementById('statusMsg');
  if (!el) return;
  let icon, text;
  if      (score<25){icon='🥀';text="It's okay to struggle. Your flower is resting — it will bloom again.";}
  else if (score<40){icon='🌧️';text="Heavy days are real. You reached out — that already takes courage.";}
  else if (score<55){icon='🌱';text="Something small is growing. One breath at a time.";}
  else if (score<70){icon='🌤️';text="You're finding your footing. Keep going — your flower notices.";}
  else if (score<85){icon='🌿';text="You're on the right track. Your flower is gently blooming.";}
  else              {icon='🌸';text="You're thriving. Your wellness garden is in full bloom.";}
  el.innerHTML = `<span class="status-icon">${icon}</span><p>${text}</p>`;
}

// ═══════════════════════════════════════════════════
// ROBO AI — riverflow-v2-pro via OpenRouter (stream)
// ═══════════════════════════════════════════════════
const roboHistory = [];
let roboTyping    = false;

function buildSystemPrompt() {
  const moodCtx = currentMoodScore
    ? `Patient mood: ${currentMoodScore}/100 (${currentMoodLabel}).`
    : 'Patient has not shared mood yet.';
  return `You are Robo, a compassionate AI mental wellness companion on Sanare — safe, anonymous.
${moodCtx} Alias: ${displayName}. Never ask for real name.
- Warm, empathetic, non-judgmental
- Use CBT, 5-4-3-2-1 grounding, breathing
- 2-3 sentences per reply — brief, present
- Emotion first, then gentle reflection
- Never diagnose or prescribe
- Crisis signals → share: iCall India 9152987821 / text HOME to 741741
Tone: gentle, grounded, present.`;
}

async function callRoboAI(userText) {
  if (roboTyping) return;
  roboTyping = true;
  roboHistory.push({ role:'user', content:userText });

  const msgs = document.getElementById('roboMessages');

  // Typing bubble
  const typingEl = document.createElement('div');
  typingEl.className = 'msg msg-them';
  typingEl.id = '_roboTyping';
  typingEl.innerHTML = `<div class="msg-bubble robo-bubble" id="_roboBubble" style="letter-spacing:3px">● ● ●</div>`;
  msgs.appendChild(typingEl);
  msgs.scrollTop = msgs.scrollHeight;

  let dotState = 0;
  const dotInterval = setInterval(() => {
    const b = document.getElementById('_roboBubble');
    if (b) b.textContent = ['● ○ ○','○ ● ○','○ ○ ●'][dotState++%3];
  }, 400);

  try {
    const res = await fetch('/api/robo', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        messages: [{role:'system',content:buildSystemPrompt()}, ...roboHistory]
      })
    });

    clearInterval(dotInterval);
    if (!res.ok) throw new Error('HTTP '+res.status);

    const bubble = document.getElementById('_roboBubble');
    bubble.textContent = '';
    bubble.removeAttribute('id');

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText  = '';

    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value,{stream:true}).split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw==='[DONE]') break;
        try {
          const token = JSON.parse(raw).choices?.[0]?.delta?.content;
          if (token) { fullText+=token; bubble.textContent=fullText; msgs.scrollTop=msgs.scrollHeight; }
        } catch {}
      }
    }

    const t = document.createElement('span');
    t.className='msg-time'; t.textContent=timeNow();
    typingEl.appendChild(t);

    if (fullText) {
      roboHistory.push({role:'assistant',content:fullText});
      if (roboHistory.length>40) roboHistory.splice(0,2);
      updateFlowerFromTone();
    }

  } catch(err) {
    clearInterval(dotInterval);
    console.error('Robo error:', err.message);
    document.getElementById('_roboTyping')?.remove();
    appendMsg('roboMessages','them',"I'm having a little trouble right now. Take a breath — try again in a moment 🌿",true);
    roboHistory.pop();
  }
  roboTyping = false;
}

async function updateFlowerFromTone() {
  if (roboHistory.length < 2) return;
  try {
    const res = await fetch('/api/tone', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ messages: roboHistory.slice(-8) })
    });
    if (!res.ok) return;
    const {score} = await res.json();
    if (typeof score==='number') {
      const blended = Math.round(flowerTarget*0.35 + score*0.65);
      pulseFlower(blended>=flowerTarget?'up':'down');
      setFlowerTarget(blended);
    }
  } catch {}
}

// ═══════════════════════════════════════════════════
// SOCKET.IO
// ═══════════════════════════════════════════════════
let socket = null;

function initSocket(myId) {
  socket = io({ autoConnect:false });

  socket.on('connect', () => {
    console.log('✅ Patient connected:', socket.id);
    socketReady = true;
    setStatus('● Connected');
    socket.emit('patient_join', { patientId:myId, alias:MY_ALIAS, color:myColor });
  });

  socket.on('disconnect', () => { socketReady=false; setStatus('○ Reconnecting…'); });

  socket.on('connect_error', (e) => {
    console.warn('Socket err:', e.message);
    socketReady=false; setStatus('○ Connection failed');
  });

  socket.on('therapist_count', ({count}) => {
    therapistsOnline = count;
    document.getElementById('therapistCount').textContent = count>0?`${count} online`:'none online';
  });

  socket.on('queue_position', ({position}) => setStatus(`● Queue: #${position}`));

  socket.on('session_accepted', () => {
    inHumanSession=true; setStatus('● In session');
    if (!humanChatOpen) openHumanChat();
    appendMsg('humanMessages','system','A listener has joined. This space is safe and private 🌿');
  });

  socket.on('therapist_message', ({message}) => appendMsg('humanMessages','them',message));

  socket.on('session_ended_by_therapist', () => {
    inHumanSession=false; setStatus('● Connected');
    appendMsg('humanMessages','system','Your listener ended the session. Take care 🌿');
  });

  socket.connect();
}

(async () => { MY_ID = await hashAlias(MY_ALIAS); initSocket(MY_ID); })();

function setStatus(t) { document.getElementById('connStatus').textContent = t; }

// ═══════════════════════════════════════════════════
// HUMAN CHAT
// ═══════════════════════════════════════════════════
document.getElementById('humanToggle').addEventListener('click', () => {
  document.getElementById('humanChat').classList.contains('hidden') ? openHumanChat() : closeHumanChat();
});

function openHumanChat() {
  document.getElementById('humanChat').classList.remove('hidden');
  document.getElementById('humanToggle').innerHTML = '<span class="btn-icon">✕</span> Close Chat';
  humanChatOpen = true;
  if (!socketReady) {
    appendMsg('humanMessages','system',"Can't reach server. Try Robo below 🤖");
    return;
  }
  if (!inHumanSession) {
    socket.emit('patient_queue', { patientId:MY_ID, alias:MY_ALIAS, color:myColor, mood:currentMoodLabel||null });
    appendMsg('humanMessages','system', therapistsOnline>0
      ? "Looking for a listener… connecting shortly 🌿"
      : "No therapists online right now — added to queue. Try Robo in the meantime 🤖");
  }
  setTimeout(()=>{ const m=document.getElementById('humanMessages'); if(m) m.scrollTop=m.scrollHeight; },50);
}

function closeHumanChat() {
  document.getElementById('humanChat').classList.add('hidden');
  document.getElementById('humanToggle').innerHTML = '<span class="btn-icon">💬</span> Start Conversation';
  humanChatOpen = false;
}

document.getElementById('humanSendBtn').addEventListener('click', sendHumanMsg);
document.getElementById('humanInput').addEventListener('keydown', e => { if(e.key==='Enter') sendHumanMsg(); });

function sendHumanMsg() {
  const input = document.getElementById('humanInput');
  const text  = input.value.trim();
  if (!text) return;
  input.value = '';
  appendMsg('humanMessages','me',text);
  if (!socketReady || !inHumanSession) {
    setTimeout(()=>appendMsg('humanMessages','system','Waiting for a listener to connect…'),400);
    return;
  }
  socket.emit('patient_message', { patientId:MY_ID, alias:MY_ALIAS, message:text });
}

// ═══════════════════════════════════════════════════
// ROBO CHAT
// ═══════════════════════════════════════════════════
document.getElementById('roboToggle').addEventListener('click', () => {
  document.getElementById('roboChat').classList.contains('hidden') ? openRoboChat() : closeRoboChat();
});

function openRoboChat() {
  document.getElementById('roboChat').classList.remove('hidden');
  document.getElementById('roboToggle').innerHTML = '<span class="btn-icon">✕</span> Close Robo';
  roboChatOpen = true;
  if (roboHistory.length === 0) {
    const greets = [
      "Hi there 🌿 This is a safe, private space — no names, no records. What's on your mind?",
      "Hey. I'm Robo — I'm here to listen, no judgment. How are you feeling right now?",
      "Welcome. Take your time. What would you like to talk about today?",
    ];
    const g = greets[Math.floor(Math.random()*greets.length)];
    appendMsg('roboMessages','them',g,true);
    roboHistory.push({role:'assistant',content:g});
  }
  setTimeout(()=>{ const m=document.getElementById('roboMessages'); if(m) m.scrollTop=m.scrollHeight; },50);
}

function closeRoboChat() {
  document.getElementById('roboChat').classList.add('hidden');
  document.getElementById('roboToggle').innerHTML = '<span class="btn-icon">🤖</span> Talk to Robo';
  roboChatOpen = false;
}

document.getElementById('roboSendBtn').addEventListener('click', sendRoboMsg);
document.getElementById('roboInput').addEventListener('keydown', e => { if(e.key==='Enter') sendRoboMsg(); });

function sendRoboMsg() {
  const input = document.getElementById('roboInput');
  const text  = input.value.trim();
  if (!text || roboTyping) return;
  input.value = '';
  appendMsg('roboMessages','me',text);
  callRoboAI(text);
}

// ═══════════════════════════════════════════════════
// MOOD MODAL
// ═══════════════════════════════════════════════════
document.getElementById('moodBtn').addEventListener('click', () =>
  document.getElementById('moodModal').classList.remove('hidden'));

function closeMood() { document.getElementById('moodModal').classList.add('hidden'); }

function selectMood(emoji, label, score) {
  closeMood();
  currentMoodLabel = `${emoji} ${label}`;
  currentMoodScore = score;
  document.getElementById('moodBtn').textContent = currentMoodLabel;
  if (socketReady && MY_ID)
    socket.emit('mood_update', { patientId:MY_ID, score, label:currentMoodLabel });
  const prev = flowerTarget;
  setFlowerTarget(score);
  pulseFlower(score>=prev?'up':'down');
}

// ═══════════════════════════════════════════════════
// SHARED MSG RENDERER
// ═══════════════════════════════════════════════════
function appendMsg(containerId, side, text, isRobo=false) {
  const msgs = document.getElementById(containerId);
  if (!msgs) return;
  if (side==='system') {
    const d = document.createElement('div');
    d.style.cssText='text-align:center;font-size:12px;color:var(--text-soft);font-style:italic;padding:8px 0;line-height:1.5;';
    d.textContent=text; msgs.appendChild(d);
  } else {
    const d = document.createElement('div');
    d.className=`msg msg-${side==='me'?'me':'them'}`;
    d.innerHTML=`<div class="msg-bubble ${(side==='them'&&isRobo)?'robo-bubble':''}">${esc(text)}</div><span class="msg-time">${timeNow()}</span>`;
    msgs.appendChild(d);
  }
  msgs.scrollTop=msgs.scrollHeight;
}

function esc(t){ return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function timeNow(){ return new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}); }

window.addEventListener('load', () => {
  renderFlower(flowerScore);
  setTimeout(() => {
    document.querySelectorAll('.metric-bar').forEach(bar => {
      const t=bar.style.width; bar.style.width='0%';
      setTimeout(()=>bar.style.width=t, 100);
    });
  }, 300);
});