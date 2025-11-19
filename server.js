const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const fs = require("fs");

// ------------------------------------
// Create Express App FIRST
// ------------------------------------
const app = express();

// ------------------------------------
// Create upload directories
// ------------------------------------
const uploadDirs = [
  'uploads/doctors',
  'uploads/patients'
];

uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// ------------------------------------
// Create HTTP + Socket.io Server
// ------------------------------------
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// WebRTC signaling server
require("./video/signaling")(io);

// ------------------------------------
// GLOBAL MIDDLEWARES (ORDER MATTERS)
// ------------------------------------

// Allow frontend requests
app.use(cors());

// Parse form data + JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sessions (MUST be before routes)
app.use(session({
  secret: "hospital-secret-key-2024",
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve static files
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ------------------------------------
// MongoDB Connection
// ------------------------------------
mongoose.connect("mongodb://127.0.0.1:27017/hms", {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// ------------------------------------
// ROUTES (AFTER ALL MIDDLEWARE)
// ------------------------------------
app.use("/patients", require("./routes/patientRoutes"));
app.use("/doctors", require("./routes/doctorRoutes"));
app.use("/appointments", require("./routes/appointmentRoutes"));
app.use("/admin", require("./routes/adminRoutes"));
app.use("/auth", require("./routes/authRoutes"));
app.use("/requests", require("./routes/requestroutes"));
app.use("/notifications", require("./routes/notificationRoutes"));

// Video call route
app.get("/video/room/:roomId", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "videoCall.html"));
});

// Health check
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"
  });
});

// Default route
app.get("/", (req, res) => {
  res.redirect("/login-select.html");
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

// ------------------------------------
// START SERVER
// ------------------------------------
const PORT = process.env.PORT || 3001;

http.listen(PORT, "0.0.0.0", () => {
  console.log("=".repeat(50));
  console.log(`🏥 Hospital Management System Server`);
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📅 Started at: ${new Date().toLocaleString()}`);
  console.log("=".repeat(50));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  http.close(() => {
    mongoose.connection.close(false, () => {
      console.log('Server closed');
      process.exit(0);
    });
  });
});