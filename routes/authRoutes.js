const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const Patient = require("../models/Patient");
const Doctor = require("../models/doctor");
const { uploadDoctorDocs } = require("../middleware/upload");

// ============ PATIENT SIGNUP ============
router.post("/patient/signup", async (req, res) => {
  try {
    const { name, email, password, phone, age, gender, address, city, state, longitude, latitude } = req.body;

    // Check if patient exists
    const existingPatient = await Patient.findOne({ email });
    if (existingPatient) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create patient
    const newPatient = new Patient({
      name,
      email,
      password: hashedPassword,
      phone,
      age,
      gender,
      address,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
        city,
        state
      }
    });

    await newPatient.save();

    res.json({ 
      success: true, 
      message: "Registration successful! Please login.",
      patientId: newPatient._id
    });
  } catch (err) {
    console.error("Patient signup error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============ PATIENT LOGIN ============
router.post("/patient/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const patient = await Patient.findOne({ email });
    if (!patient) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const isValidPassword = await bcrypt.compare(password, patient.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Set session
    req.session.patientId = patient._id;
    req.session.patientName = patient.name;
    req.session.userType = 'patient';

    res.json({ 
      success: true, 
      message: "Login successful",
      patient: {
        id: patient._id,
        name: patient.name,
        email: patient.email,
        location: patient.location
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ DOCTOR SIGNUP ============
router.post("/doctor/signup", uploadDoctorDocs.fields([
  { name: 'proofDocument', maxCount: 1 },
  { name: 'profilePhoto', maxCount: 1 }
]), async (req, res) => {
  try {
    const { 
      name, email, password, phone, specialization, qualifications, 
      experience, registrationNumber, address, city, state, 
      longitude, latitude, consultationFee, availability 
    } = req.body;

    // Check if doctor exists
    const existingDoctor = await Doctor.findOne({ 
      $or: [{ email }, { registrationNumber }] 
    });
    
    if (existingDoctor) {
      return res.status(400).json({ 
        error: "Email or Registration Number already exists" 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Get uploaded file paths
    const proofDocument = req.files['proofDocument'] ? req.files['proofDocument'][0].path : null;
    const profilePhoto = req.files['profilePhoto'] ? req.files['profilePhoto'][0].path : null;

    // Parse availability (sent as JSON string)
    const parsedAvailability = availability ? JSON.parse(availability) : [];

    // Create doctor
    const newDoctor = new Doctor({
      name,
      email,
      password: hashedPassword,
      phone,
      specialization,
      qualifications,
      experience,
      registrationNumber,
      proofDocument,
      profilePhoto,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
        address,
        city,
        state
      },
      availability: parsedAvailability,
      consultationFee,
      isVerified: false // Admin will verify
    });

    await newDoctor.save();

    res.json({ 
      success: true, 
      message: "Registration successful! Your profile will be verified by admin within 24 hours.",
      doctorId: newDoctor._id
    });
  } catch (err) {
    console.error("Doctor signup error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============ DOCTOR LOGIN ============
router.post("/doctor/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const doctor = await Doctor.findOne({ email });
    if (!doctor) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Check if verified
    if (!doctor.isVerified) {
      return res.status(403).json({ 
        error: "Your account is pending verification by admin. Please wait." 
      });
    }

    const isValidPassword = await bcrypt.compare(password, doctor.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Set session
    req.session.doctorId = doctor._id;
    req.session.doctorName = doctor.name;
    req.session.userType = 'doctor';

    res.json({ 
      success: true, 
      message: "Login successful",
      doctor: {
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        specialization: doctor.specialization,
        location: doctor.location
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ LOGOUT ============
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.json({ success: true, message: "Logged out successfully" });
  });
});

module.exports = router;