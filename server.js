require("dotenv").config();

const express = require("express");
const http    = require("http");
const { Server } = require("socket.io");
const path    = require("path");

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["websocket", "polling"]
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "Sanare", "public")));

// ─── Page routes ───
app.get("/",          (req, res) => res.sendFile(path.join(__dirname, "Sanare", "public", "index.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "Sanare", "public", "dashboard.html")));
app.get("/therapist", (req, res) => res.sendFile(path.join(__dirname, "Sanare", "public", "therapist.html")));

// ─── Mock token mint ───
app.post("/create-token", (req, res) => {
  res.json({ success: true, txId: "TEST_TX_123", assetId: "TEST_ASSET_456" });
});

// ─────────────────────────────────────────
// OPENROUTER PROXY — keeps API key server-side
// dashboard.js calls POST /api/robo
// ─────────────────────────────────────────
app.post("/api/robo", async (req, res) => {

  if (!process.env.OPENROUTER_KEY) {
    console.error("❌ OPENROUTER_KEY missing from .env");
    return res.status(500).json({ error: "API key not configured" });
  }

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array required" });
  }

  try {

    // 🌿 MindMint System Personality
    const systemPrompt = {
      role: "system",
      content: `
You are Sanare AI, a privacy-first emotional triage assistant.

Tone:
- Calm
- Soft
- Non-judgmental
- Supportive
- Never clinical or cold

Rules:
- Do NOT diagnose medical conditions.
- Do NOT prescribe medication.
- Encourage professional help if risk appears.
- Preserve emotional meaning.
- Be concise and structured.

Return output ONLY in this JSON format:

{
  "summary": "short emotional summary",
  "primary_emotion": "one word",
  "mood_score": 1-10,
  "risk_level": "low | medium | high",
  "supportive_response": "gentle supportive message"
}

Risk detection:
- If suicidal intent or self-harm intent appears → risk_level = "high"
- Encourage immediate professional support in that case.
`
    };

    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Sanare",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [systemPrompt, ...messages],
        max_tokens: 400,
        temperature: 0.6,   // calmer output
        stream: true
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error(`❌ OpenRouter ${upstream.status}:`, errText);
      return res.status(502).json({ error: `OpenRouter error: ${upstream.status}` });
    }

    // 🌊 Stream response
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const reader = upstream.body.getReader();

    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          break;
        }
        res.write(value);
      }
    };

    pump().catch(err => {
      console.error("Stream pump error:", err);
      res.end();
    });

    req.on("close", () => reader.cancel());

  } catch (err) {
    console.error("❌ /api/robo fetch error:", err.message);
    res.status(500).json({ error: "Server error — check console" });
  }
});


// ─────────────────────────────────────────
// GLOBAL STATE
// ─────────────────────────────────────────
const patients   = new Map();
const therapists = new Set();
const queue      = new Map();
const sessions   = new Map();

// ─────────────────────────────────────────
// SOCKET LOGIC
// ─────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("🟢 Connected:", socket.id);

  // ── PATIENT JOIN ──
  socket.on("patient_join", (data) => {
    socket.role      = "patient";
    socket.patientId = data.patientId;
    patients.set(data.patientId, {
      socketId: socket.id,
      alias:    data.alias,
      color:    data.color,
      mood:     null,
      joinedAt: Date.now(),
    });
    socket.emit("therapist_count", { count: therapists.size });
    console.log(`👤 Patient joined: ${data.alias}`);
  });

  // ── PATIENT QUEUE ──
  socket.on("patient_queue", (data) => {
    queue.set(data.patientId, {
      id:       data.patientId,
      alias:    data.alias,
      color:    data.color,
      mood:     data.mood || null,
      joinedAt: Date.now(),
    });
    const position = [...queue.keys()].indexOf(data.patientId) + 1;
    socket.emit("queue_position", { position });
    console.log(`📋 Patient queued: ${data.alias} at #${position}`);
    broadcastQueue();
  });

  // ── THERAPIST JOIN ──
  socket.on("therapist_join", () => {
    socket.role = "therapist";
    therapists.add(socket.id);
    socket.emit("queue_update", { queue: buildQueue() });
    broadcastPatients("therapist_count", { count: therapists.size });
    console.log(`🩺 Therapist joined. Total: ${therapists.size}`);
  });

  // ── ACCEPT SESSION ──
  socket.on("therapist_accept", ({ patientId }) => {
    const patient = patients.get(patientId);
    if (!patient) return;
    queue.delete(patientId);
    sessions.set(patientId, socket.id);
    socket.activePatientId = patientId;
    io.to(patient.socketId).emit("session_accepted");
    broadcastQueue();
    console.log(`✅ Session: therapist ${socket.id} ↔ ${patient.alias}`);
  });

  // ── PATIENT → THERAPIST ──
  socket.on("patient_message", (data) => {
    const therapistId = sessions.get(data.patientId);
    if (therapistId) io.to(therapistId).emit("patient_message", data);
  });

  // ── THERAPIST → PATIENT ──
  socket.on("therapist_message", (data) => {
    const patient = patients.get(data.patientId);
    if (patient) io.to(patient.socketId).emit("therapist_message", { message: data.message });
  });

  // ── MOOD UPDATE ──
  socket.on("mood_update", (data) => {
    const p = patients.get(data.patientId);
    if (p) p.mood = data.label;
    const therapistId = sessions.get(data.patientId);
    if (therapistId) io.to(therapistId).emit("mood_update", data);
  });

  // ── THERAPIST ENDS SESSION ──
  socket.on("therapist_end_session", ({ patientId }) => {
    const patient = patients.get(patientId);
    if (patient) io.to(patient.socketId).emit("session_ended_by_therapist");
    sessions.delete(patientId);
    socket.activePatientId = null;
    broadcastQueue();
    console.log(`🔚 Therapist ended session with ${patientId}`);
  });

  // ── PATIENT ENDS SESSION ──
  socket.on("patient_end_session", ({ patientId }) => {
    const therapistId = sessions.get(patientId);
    if (therapistId) io.to(therapistId).emit("session_ended_by_patient", { patientId });
    sessions.delete(patientId);
    queue.delete(patientId);
    broadcastQueue();
  });

  // ── DISCONNECT ──
  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id, `(${socket.role})`);

    if (socket.role === "therapist") {
      therapists.delete(socket.id);
      if (socket.activePatientId) {
        const patient = patients.get(socket.activePatientId);
        if (patient) io.to(patient.socketId).emit("session_ended_by_therapist");
        sessions.delete(socket.activePatientId);
      }
      broadcastPatients("therapist_count", { count: therapists.size });
      broadcastQueue();
    }

    if (socket.role === "patient" && socket.patientId) {
      const therapistId = sessions.get(socket.patientId);
      if (therapistId) io.to(therapistId).emit("session_ended_by_patient", { patientId: socket.patientId });
      queue.delete(socket.patientId);
      sessions.delete(socket.patientId);
      patients.delete(socket.patientId);
      broadcastQueue();
    }
  });
});

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function buildQueue() {
  return [...queue.values()].map(p => ({
    id:       p.id,
    alias:    p.alias,
    color:    p.color,
    mood:     p.mood,
    waitTime: formatWait(p.joinedAt),
  }));
}

function broadcastQueue() {
  const q = buildQueue();
  therapists.forEach(id => io.to(id).emit("queue_update", { queue: q }));
  [...queue.keys()].forEach((patientId, index) => {
    const patient = patients.get(patientId);
    if (patient) io.to(patient.socketId).emit("queue_position", { position: index + 1 });
  });
}

function broadcastPatients(event, data) {
  patients.forEach(p => io.to(p.socketId).emit(event, data));
}

function formatWait(joinedAt) {
  const s = Math.floor((Date.now() - joinedAt) / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s/60)}m ${s%60}s`;
}

// ─────────────────────────────────────────
// START
// ─────────────────────────────────────────
server.listen(3000, "0.0.0.0", () => {
  const { networkInterfaces } = require("os");
  const nets = networkInterfaces();
  let localIP = "YOUR_LOCAL_IP";
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) localIP = net.address;
    }
  }
  console.log("🚀 Sanare running:");
  console.log(`   Local:  http://localhost:3000`);
  console.log(`   Phone:  http://${localIP}:3000`);
  console.log(`   Robo:   ${process.env.OPENROUTER_KEY ? "✅ API key found" : "❌ OPENROUTER_KEY missing from .env"}`);
});