const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const session = require("express-session");

// ------------------------------------
// Create Express App FIRST
// ------------------------------------
const app = express();

// ------------------------------------
// Create HTTP + Socket.io Server
// ------------------------------------
const http = require("http").createServer(app);
const io = require("socket.io")(http);

// WebRTC signaling server
require("./video/signaling")(io);

// ------------------------------------
// Basic Test Route
// ------------------------------------
app.get("/check", (req, res) => {
  res.send("SERVER WORKING");
});

// ------------------------------------
// GLOBAL MIDDLEWARES (ORDER MATTERS)
// ------------------------------------

// Allow frontend requests
app.use(cors());

// Parse form data + JSON (FIX FOR req.body undefined)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Sessions (MUST be before routes)
app.use(session({
  secret: "hospital-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Serve static files
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Logger
app.use((req, res, next) => {
  console.log("Request:", req.method, req.url);
  next();
});

// ------------------------------------
// MongoDB Connection
// ------------------------------------
mongoose.connect("mongodb://127.0.0.1:27017/hms")
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// ------------------------------------
// ROUTES (AFTER ALL MIDDLEWARE)
// ------------------------------------
app.use("/patients", require("./routes/patientRoutes"));
app.use("/doctors", require("./routes/doctorRoutes"));
app.use("/appointments", require("./routes/appointmentRoutes"));
app.use("/admin", require("./routes/adminRoutes"));

// ------------------------------------
// START SERVER
// ------------------------------------
http.listen(3001, "0.0.0.0", () => {
  console.log("Server running on http://localhost:3001");
});
