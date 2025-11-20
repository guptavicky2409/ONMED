const express = require("express");
const router = express.Router();
const Admin = require("../models/admin");
const Doctor = require("../models/doctor");
const bcrypt = require("bcrypt");
const { adminAuth } = require("../middleware/auth");


// Create default admin (ONLY FIRST TIME)
router.get("/createDefault", async (req, res) => {
  const existing = await Admin.findOne({ username: "admin" });

  if (existing) return res.send("Admin already exists");

  const hashed = await bcrypt.hash("admin123", 10);
  const newAdmin = new Admin({
    username: "admin",
    password: hashed
  });

  await newAdmin.save();
  res.send("Default admin created: admin / admin123");
});

// LOGIN
router.post("/login", async (req, res) => {
  console.log("BODY RECEIVED:", req.body);   // DEBUG LINE

  const { username, password } = req.body;

  const admin = await Admin.findOne({ username });
  if (!admin) return res.send("Invalid username");

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) return res.send("Incorrect password");

  req.session.admin = admin._id;
  res.redirect("/adminDashboard.html");
});

// LOGOUT
router.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login.html");
});

// PROTECT ROUTES
router.get("/check", (req, res) => {
  if (!req.session.admin) return res.send("NOT_LOGGED_IN");
  res.send("LOGGED_IN");
});

// Doctor verification routes
router.post("/doctors/verify/:doctorId", adminAuth, async (req, res) => {
  try {
    await Doctor.findByIdAndUpdate(req.params.doctorId, {
      isVerified: true,
      applicationStatus: 'approved'
    });
    res.json({ success: true, message: "Doctor verified successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/doctors/reject/:doctorId", adminAuth, async (req, res) => {
  try {
    console.log('Deleting rejected doctor:', req.params.doctorId);
    // Delete the doctor completely from database
    const deleted = await Doctor.findByIdAndDelete(req.params.doctorId);
    console.log('Deleted doctor result:', deleted ? 'success' : 'not found');
    res.json({ success: true, message: "Doctor application rejected and removed" });
  } catch (err) {
    console.error('Reject doctor error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
