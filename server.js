require("dotenv").config();

const express = require("express");
const http    = require("http");
const { Server } = require("socket.io");
const path    = require("path");

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"]
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "Sanare", "public")));

app.get("/",          (req, res) => res.sendFile(path.join(__dirname, "Sanare", "public", "index.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "Sanare", "public", "dashboard.html")));
app.get("/therapist", (req, res) => res.sendFile(path.join(__dirname, "Sanare", "public", "therapist.html")));

app.post("/create-token", (req, res) => {
  res.json({ success: true, txId: "TEST_TX_123", assetId: "TEST_ASSET_456" });
});

// ─────────────────────────────────────────
// GLOBAL STATE
// ─────────────────────────────────────────
const patients   = new Map(); // patientId → { socketId, alias, color, mood, joinedAt }
const therapists = new Set(); // Set of therapist socketIds
const queue      = new Map(); // patientId → queue entry
const sessions   = new Map(); // patientId → therapistSocketId

// ─────────────────────────────────────────
// SOCKET LOGIC
// ─────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("🟢 Connected:", socket.id);

  // ── PATIENT JOIN ──
  // dashboard.js emits: socket.emit('patient_join', { patientId, alias, color })
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

    // ✅ FIX 1: Tell this patient how many therapists are currently online
    socket.emit("therapist_count", { count: therapists.size });
    console.log(`👤 Patient joined: ${data.alias} (hashed: ${data.patientId})`);
  });

  // ── PATIENT QUEUE ──
  // dashboard.js emits: socket.emit('patient_queue', { patientId, alias, color, mood })
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

    console.log(`📋 Patient queued: ${data.alias} at position ${position}`);
    console.log(`📡 Therapists online: ${therapists.size} — broadcasting queue of ${queue.size} to them`);
    therapists.forEach(id => console.log(`   → sending to therapist socket: ${id}`));

    broadcastQueue();
  });

  // ── THERAPIST JOIN ──
  // therapist.js emits: socket.emit('therapist_join')
  socket.on("therapist_join", () => {
    socket.role = "therapist";
    therapists.add(socket.id);

    // Send current queue state to the newly joined therapist
    socket.emit("queue_update", { queue: buildQueue() });

    // ✅ FIX 2: Broadcast updated therapist count to ALL patients
    broadcastPatients("therapist_count", { count: therapists.size });
    console.log(`🩺 Therapist joined. Total: ${therapists.size}`);
  });

  // ── ACCEPT SESSION ──
  // therapist.js emits: socket.emit('therapist_accept', { patientId })
  socket.on("therapist_accept", ({ patientId }) => {
    const patient = patients.get(patientId);
    if (!patient) {
      console.warn(`⚠️ therapist_accept: patient ${patientId} not found`);
      return;
    }

    queue.delete(patientId);
    sessions.set(patientId, socket.id);
    socket.activePatientId = patientId;

    // Tell the patient their session was accepted
    io.to(patient.socketId).emit("session_accepted");
    broadcastQueue();
    console.log(`✅ Session accepted: therapist ${socket.id} ↔ patient ${patient.alias}`);
  });

  // ── PATIENT → THERAPIST MESSAGE ──
  // dashboard.js emits: socket.emit('patient_message', { patientId, alias, message })
  socket.on("patient_message", (data) => {
    const therapistId = sessions.get(data.patientId);
    if (therapistId) {
      io.to(therapistId).emit("patient_message", data);
    }
  });

  // ── THERAPIST → PATIENT MESSAGE ──
  // therapist.js emits: socket.emit('therapist_message', { patientId, message })
  socket.on("therapist_message", (data) => {
    const patient = patients.get(data.patientId);
    if (patient) {
      io.to(patient.socketId).emit("therapist_message", { message: data.message });
    }
  });

  // ── MOOD UPDATE ──
  // dashboard.js emits: socket.emit('mood_update', { patientId, score, label })
  socket.on("mood_update", (data) => {
    // Update stored mood
    const p = patients.get(data.patientId);
    if (p) p.mood = data.label;

    // Forward to therapist if in session
    const therapistId = sessions.get(data.patientId);
    if (therapistId) {
      io.to(therapistId).emit("mood_update", data);
    }
  });

  // ── THERAPIST ENDS SESSION ──
  // ✅ FIX 3: This handler was MISSING from server — therapist.js emits this but server never listened
  // therapist.js emits: socket.emit('therapist_end_session', { patientId })
  socket.on("therapist_end_session", ({ patientId }) => {
    const patient = patients.get(patientId);
    if (patient) {
      // ✅ Tell the patient their session ended — dashboard.js listens for 'session_ended_by_therapist'
      io.to(patient.socketId).emit("session_ended_by_therapist");
      console.log(`🔚 Therapist ended session with ${patient.alias}`);
    }

    sessions.delete(patientId);
    socket.activePatientId = null;
    broadcastQueue();
  });

  // ── PATIENT ENDS SESSION ──
  // ✅ FIX 4: This was missing too — if patient closes chat, therapist should be notified
  // dashboard.js should emit this if you want to notify therapist (see note below)
  socket.on("patient_end_session", ({ patientId }) => {
    const therapistId = sessions.get(patientId);
    if (therapistId) {
      // ✅ therapist.js listens for 'session_ended_by_patient'
      io.to(therapistId).emit("session_ended_by_patient", { patientId });
      console.log(`🔚 Patient ended session: ${patientId}`);
    }
    sessions.delete(patientId);
    queue.delete(patientId);
    broadcastQueue();
  });

  // ── DISCONNECT ──
  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id, `(role: ${socket.role})`);

    if (socket.role === "therapist") {
      therapists.delete(socket.id);

      // ✅ FIX 5: If therapist had an active session, notify the patient
      if (socket.activePatientId) {
        const patient = patients.get(socket.activePatientId);
        if (patient) {
          io.to(patient.socketId).emit("session_ended_by_therapist");
        }
        sessions.delete(socket.activePatientId);
      }

      // Tell all patients updated therapist count
      broadcastPatients("therapist_count", { count: therapists.size });
      broadcastQueue();
    }

    if (socket.role === "patient" && socket.patientId) {
      const therapistId = sessions.get(socket.patientId);
      if (therapistId) {
        // ✅ Tell therapist this patient disconnected
        io.to(therapistId).emit("session_ended_by_patient", { patientId: socket.patientId });
      }

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
  therapists.forEach(id => {
    io.to(id).emit("queue_update", { queue: q });
  });

  // Also update each queued patient's position
  [...queue.keys()].forEach((patientId, index) => {
    const patient = patients.get(patientId);
    if (patient) {
      io.to(patient.socketId).emit("queue_position", { position: index + 1 });
    }
  });
}

function broadcastPatients(event, data) {
  patients.forEach(p => {
    io.to(p.socketId).emit(event, data);
  });
}

function formatWait(joinedAt) {
  const s = Math.floor((Date.now() - joinedAt) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ─────────────────────────────────────────
// START
// ─────────────────────────────────────────
server.listen(3000, "0.0.0.0", () => {
  console.log("🚀 Sanare server running:");
  console.log("   Local:   http://localhost:3000");
  console.log("   Network: http://YOUR_LOCAL_IP:3000");
});