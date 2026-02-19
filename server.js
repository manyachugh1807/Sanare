const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 🔥 IMPORTANT
// Parse JSON body
app.use(express.json());

// 🔥 Serve static files
app.use(express.static(path.join(__dirname, "Sanare", "public")));

// 🔥 Home Route (Optional but safe)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "Sanare", "public", "index.html"));
});

// 🔥 Token Creation Route
app.post("/create-token", (req, res) => {
  try {
    console.log("✅ Create token route hit");

    // TEMP RESPONSE (Replace with real mint later)
    res.json({
      success: true,
      txId: "TEST_TX_123",
      assetId: "TEST_ASSET_456"
    });

  } catch (err) {
    console.error("❌ Server Error:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// 🔥 Socket.IO (optional for chat)
io.on("connection", (socket) => {
  console.log("🟢 User connected");

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected");
  });
});

// 🔥 IMPORTANT FOR HOTSPOT
server.listen(3000, "0.0.0.0", () => {
  console.log("🚀 Server running at:");
  console.log("👉 http://localhost:3000");
});
