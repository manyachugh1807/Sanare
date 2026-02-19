const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 👇 IMPORTANT FIX
app.use(express.static(path.join(__dirname, "Sanare", "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "Sanare", "public", "index.html"));
});

server.listen(3000, "0.0.0.0", () => {
  console.log("Server running");
});

