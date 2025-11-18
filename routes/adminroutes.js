const express = require("express");
const router = express.Router();
const Admin = require("../models/admin");
const bcrypt = require("bcrypt");
const auth = require("../middleware/auth");
const role = require("../middleware/role");


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

router.get("/all-doctors", auth, role(["admin"]), async (req, res) => {
    const doctors = await Doctor.find();
    res.json(doctors);
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
  res.redirect("/dashboard.html");
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

// Register Admin
router.post("/register", async (req, res) => {
  const { username, password } = req.body;

  const existing = await Admin.findOne({ username });
  if (existing) return res.send("Username already exists, choose another.");

  const hashed = await bcrypt.hash(password, 10);

  const newAdmin = new Admin({
    username,
    password: hashed
  });

  await newAdmin.save();

  res.send("Admin created successfully! <a href='/login.html'>Login Now</a>");
});

router.post("/send-otp", async (req, res) => {
  const { username } = req.body;

  const admin = await Admin.findOne({ username });
  if (!admin) return res.send("User not found");

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Save in session
  req.session.resetUser = username;
  req.session.otp = otp;

  // Simulate email by printing OTP on screen
  res.send(`
    OTP sent to your email (simulation): <b>${otp}</b><br><br>
    <a href="/verifyOtp.html">Enter OTP</a>
  `);
});

router.post("/verify-otp", (req, res) => {
  const { otp } = req.body;

  if (!req.session.otp) return res.send("OTP expired. Try again.");

  if (otp !== req.session.otp) return res.send("Incorrect OTP");

  // OTP correct → allow reset password
  req.session.verified = true;
  res.redirect("/resetPassword.html");
});

router.post("/reset-password", async (req, res) => {
  if (!req.session.verified) return res.send("Not allowed");

  const { newPassword } = req.body;

  const username = req.session.resetUser;

  const hashed = await bcrypt.hash(newPassword, 10);

  await Admin.findOneAndUpdate(
    { username },
    { password: hashed }
  );

  // Clear session
  req.session.verified = false;
  req.session.otp = null;

  res.send("Password updated successfully! <a href='/login.html'>Login now</a>");
});
router.put("/doctor/:id", async (req, res) => {
  await Doctor.findByIdAndUpdate(req.params.id, req.body);
  res.json({ msg: "Doctor updated" });
});

router.delete("/doctor/:id", async (req, res) => {
  await Doctor.findByIdAndDelete(req.params.id);
  res.json({ msg: "Doctor deleted" });
});

module.exports = router;
