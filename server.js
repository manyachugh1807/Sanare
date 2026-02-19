require("dotenv").config();

const express = require("express");
const http    = require("http");
const { Server } = require("socket.io");
const path    = require("path");
const fs      = require("fs");

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["websocket", "polling"]
});

app.use(express.json());

// ─── AUTO-DETECT public folder ───
// Works whether files are in: ./public  OR  ./Sanare/public  OR ./
const candidates = [
  path.join(__dirname, "Sanare", "public"),
  path.join(__dirname, "public"),
  path.join(__dirname),
];
const PUBLIC = candidates.find(p => fs.existsSync(path.join(p, "dashboard.html"))) || candidates[0];
console.log("📁 Serving from:", PUBLIC);

app.use(express.static(PUBLIC));

app.get("/",          (req,res) => res.sendFile(path.join(PUBLIC, "index.html")));
app.get("/dashboard", (req,res) => res.sendFile(path.join(PUBLIC, "dashboard.html")));
app.get("/therapist", (req,res) => res.sendFile(path.join(PUBLIC, "therapist.html")));
app.post("/create-token", (req,res) => res.json({ success:true, txId:"TEST_TX_123", assetId:"TEST_ASSET_456" }));

// ═══════════════════════════════════════════
// /api/robo  — riverflow-v2-pro (streamed)
// ═══════════════════════════════════════════
app.post("/api/robo", async (req, res) => {
  const key = process.env.OPENROUTER_KEY;
  if (!key) return res.status(500).json({ error: "OPENROUTER_KEY missing in .env" });

  const { messages } = req.body;
  if (!messages?.length) return res.status(400).json({ error: "messages required" });

  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type":  "application/json",
        "HTTP-Referer":  "http://localhost:3000",
        "X-Title":       "Sanare"
      },
      body: JSON.stringify({
        model:       "sourceful/riverflow-v2-pro",
        messages,
        max_tokens:  350,
        temperature: 0.75,
        stream:      true
      })
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error("❌ OpenRouter:", upstream.status, errText);
      return res.status(502).json({ error: `OpenRouter ${upstream.status}: ${errText}` });
    }

    res.setHeader("Content-Type",       "text/event-stream");
    res.setHeader("Cache-Control",      "no-cache");
    res.setHeader("X-Accel-Buffering",  "no");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const reader = upstream.body.getReader();
    const pump   = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { res.end(); break; }
        res.write(value);
      }
    };
    pump().catch(e => { console.error("Stream err:", e.message); res.end(); });
    req.on("close", () => reader.cancel());

  } catch (e) {
    console.error("❌ /api/robo:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════
// /api/tone  — sentiment 0-100
// ═══════════════════════════════════════════
app.post("/api/tone", async (req, res) => {
  const key = process.env.OPENROUTER_KEY;
  if (!key) return res.json({ score: 50 });

  const { messages } = req.body;
  if (!messages?.length) return res.json({ score: 50 });

  const transcript = messages
    .filter(m => m.role !== "system")
    .map(m => `${m.role === "user" ? "Patient" : "Robo"}: ${m.content}`)
    .join("\n");

  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type":  "application/json",
        "HTTP-Referer":  "http://localhost:3000",
        "X-Title":       "Sanare"
      },
      body: JSON.stringify({
        model:       "sourceful/riverflow-v2-pro",
        stream:      false,
        max_tokens:  60,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: `Clinical sentiment analyser. Score 0-100:
0-20=crisis/suicidal, 21-35=heavy grief, 36-50=struggling,
51-65=neutral, 66-80=calm/hopeful, 81-100=thriving.
Return ONLY valid JSON with no extra text: {"score":<number>}`
          },
          { role: "user", content: transcript }
        ]
      })
    });

    if (!upstream.ok) return res.json({ score: 50 });
    const data  = await upstream.json();
    const raw   = data.choices?.[0]?.message?.content?.trim() || '{"score":50}';
    let score   = 50;
    try {
      const cleaned = raw.replace(/```json|```/g, "").trim();
      score = Math.max(0, Math.min(100, Number(JSON.parse(cleaned).score) || 50));
    } catch {}
    console.log("🌸 Tone score:", score);
    res.json({ score });

  } catch (e) {
    console.error("❌ /api/tone:", e.message);
    res.json({ score: 50 });
  }
});

// ═══════════════════════════════════════════
// SOCKET STATE
// ═══════════════════════════════════════════
const patients   = new Map();
const therapists = new Set();
const queue      = new Map();
const sessions   = new Map();

io.on("connection", (socket) => {
  console.log("🟢 Connected:", socket.id);

  socket.on("patient_join", (data) => {
    socket.role      = "patient";
    socket.patientId = data.patientId;
    patients.set(data.patientId, {
      socketId: socket.id, alias: data.alias,
      color: data.color, mood: null, joinedAt: Date.now()
    });
    socket.emit("therapist_count", { count: therapists.size });
    console.log(`👤 Patient joined: ${data.alias}`);
  });

  socket.on("patient_queue", (data) => {
    queue.set(data.patientId, {
      id: data.patientId, alias: data.alias,
      color: data.color, mood: data.mood || null, joinedAt: Date.now()
    });
    const pos = [...queue.keys()].indexOf(data.patientId) + 1;
    socket.emit("queue_position", { position: pos });
    broadcastQueue();
    console.log(`📋 Queued: ${data.alias} #${pos}`);
  });

  socket.on("therapist_join", () => {
    socket.role = "therapist";
    therapists.add(socket.id);
    socket.emit("queue_update", { queue: buildQueue() });
    broadcastPatients("therapist_count", { count: therapists.size });
    console.log(`🩺 Therapist joined. Total: ${therapists.size}`);
  });

  socket.on("therapist_accept", ({ patientId }) => {
    const p = patients.get(patientId);
    if (!p) return;
    queue.delete(patientId);
    sessions.set(patientId, socket.id);
    socket.activePatientId = patientId;
    io.to(p.socketId).emit("session_accepted");
    broadcastQueue();
    console.log(`🔗 Session: ${p.alias} ↔ therapist`);
  });

  socket.on("patient_message", (data) => {
    const tId = sessions.get(data.patientId);
    if (tId) io.to(tId).emit("patient_message", data);
  });

  socket.on("therapist_message", (data) => {
    const p = patients.get(data.patientId);
    if (p) io.to(p.socketId).emit("therapist_message", { message: data.message });
  });

  socket.on("mood_update", (data) => {
    const p = patients.get(data.patientId);
    if (p) p.mood = data.label;
    const tId = sessions.get(data.patientId);
    if (tId) io.to(tId).emit("mood_update", data);
    if (queue.has(data.patientId)) {
      queue.get(data.patientId).mood = data.label;
      broadcastQueue();
    }
  });

  socket.on("therapist_end_session", ({ patientId }) => {
    const p = patients.get(patientId);
    if (p) io.to(p.socketId).emit("session_ended_by_therapist");
    sessions.delete(patientId);
    socket.activePatientId = null;
    broadcastQueue();
    console.log("🔚 Session ended by therapist");
  });

  socket.on("patient_end_session", ({ patientId }) => {
    const tId = sessions.get(patientId);
    if (tId) io.to(tId).emit("session_ended_by_patient", { patientId });
    sessions.delete(patientId);
    queue.delete(patientId);
    broadcastQueue();
  });

  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id, `(${socket.role || "unknown"})`);

    if (socket.role === "therapist") {
      therapists.delete(socket.id);
      if (socket.activePatientId) {
        const p = patients.get(socket.activePatientId);
        if (p) io.to(p.socketId).emit("session_ended_by_therapist");
        sessions.delete(socket.activePatientId);
      }
      broadcastPatients("therapist_count", { count: therapists.size });
      broadcastQueue();
    }

    if (socket.role === "patient" && socket.patientId) {
      const tId = sessions.get(socket.patientId);
      if (tId) io.to(tId).emit("session_ended_by_patient", { patientId: socket.patientId });
      queue.delete(socket.patientId);
      sessions.delete(socket.patientId);
      patients.delete(socket.patientId);
      broadcastQueue();
    }
  });
});

// ─── Helpers ───
function buildQueue() {
  return [...queue.values()].map(p => ({
    id: p.id, alias: p.alias, color: p.color,
    mood: p.mood, waitTime: formatWait(p.joinedAt)
  }));
}

function broadcastQueue() {
  const q = buildQueue();
  therapists.forEach(id => io.to(id).emit("queue_update", { queue: q }));
  [...queue.keys()].forEach((pid, i) => {
    const p = patients.get(pid);
    if (p) io.to(p.socketId).emit("queue_position", { position: i + 1 });
  });
}

function broadcastPatients(ev, data) {
  patients.forEach(p => io.to(p.socketId).emit(ev, data));
}

function formatWait(t) {
  const s = Math.floor((Date.now() - t) / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ─── Start ───
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  const { networkInterfaces } = require("os");
  let localIP = "YOUR_IP";
  for (const nets of Object.values(networkInterfaces()))
    for (const net of nets)
      if (net.family === "IPv4" && !net.internal) { localIP = net.address; break; }

  console.log(`\n🚀 Sanare running:`);
  console.log(`   Local:    http://localhost:${PORT}`);
  console.log(`   Network:  http://${localIP}:${PORT}`);
  console.log(`   Therapist: http://localhost:${PORT}/therapist`);
  console.log(`\n🤖 AI:  sourceful/riverflow-v2-pro`);
  console.log(`🔑 Key: ${process.env.OPENROUTER_KEY ? "✅ Set" : "❌ MISSING — check .env"}`);
  console.log(`📁 Files: ${PUBLIC}\n`);
});