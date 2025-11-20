const express = require("express");
const router = express.Router();
const Doctor = require("../models/doctor");
const path = require("path");
const Appointment = require("../models/appointment");
const Request = require("../models/request");
const PDFDocument = require("pdfkit");
const { doctorAuth, patientAuth, adminAuth } = require("../middleware/auth");



// Add doctor
router.post("/add", async (req, res) => {
  const { name, specialization } = req.body;
  const newDoctor = new Doctor({ name, specialization });
  await newDoctor.save();

  if (req.headers.accept && req.headers.accept.includes("text/html")) {
    return res.redirect("/viewDoctors.html");
  }

  res.json({ message: "Doctor added", doctor: newDoctor });
});

router.get("/appointments", adminAuth, async (req, res) => {
    const list = await Appointment.find();
    res.json(list);
});

// Get all doctors (for dropdown)
router.get("/all", async (req, res) => {
  const doctors = await Doctor.find({});
  res.json(doctors);
});

// Get all doctors
router.get("/", async (req, res) => {
  const doctors = await Doctor.find().sort({ _id: -1 });
  res.json(doctors);
});

// Delete doctor
router.delete("/:id", async (req, res) => {
  await Doctor.findByIdAndDelete(req.params.id);
  res.json({ message: "Doctor deleted" });
});

// Doctor submits prescription
router.post("/submit-prescription/:appointmentId", async (req, res) => {
  const appointmentId = req.params.appointmentId;

  await Appointment.findByIdAndUpdate(appointmentId, {
    prescription: req.body.prescription,
    status: "Completed"
  });

  res.json({ message: "Prescription saved!" });
});
// Return appointment details as JSON (for doctor UI)
router.get("/appointment/:appointmentId", async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.appointmentId);
    if (!appt) return res.status(404).json({ error: "Appointment not found" });
    const doctor = await Doctor.findById(appt.doctorId);
    appt.doctorName = doctor ? doctor.name : "Unknown";
    res.json(appt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve addPrescription static page
router.get("/prescribe/:appointmentId", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "addPrescription.html"));
});

// Submit prescription by doctor
router.post("/submit-prescription/:appointmentId", async (req, res) => {
  try {
    const { prescription } = req.body;
    await Appointment.findByIdAndUpdate(req.params.appointmentId, {
      prescription,
      status: "Completed"
    });
    // Redirect back to doctor's appointments page (adjust URL if needed)
    res.send("<script>alert('Prescription saved'); window.location.href='/viewAppointments.html';</script>");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Generate receipt PDF for appointment
router.get("/receipt/:appointmentId", async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.appointmentId);
    if (!appt) return res.status(404).send("Appointment not found");

    // Create PDF
    const doc = new PDFDocument();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=receipt_${appt._id}.pdf`);
    doc.pipe(res);

    doc.fontSize(20).text("Hospital Management System", { align: "center" });
    doc.moveDown();
    doc.fontSize(14).text(`Receipt for Appointment: ${appt._id}`);
    doc.moveDown();
    doc.fontSize(12).text(`Patient ID: ${appt.patientId}`);
    doc.text(`Doctor ID: ${appt.doctorId}`);
    doc.text(`Date: ${appt.date}`);
    doc.moveDown();
    doc.text("Prescription:");
    doc.moveDown();
    doc.text(appt.prescription || "No prescription provided.");

    doc.end();
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.get("/list", adminAuth, async (req, res) => {
  const doctors = await Doctor.find();
  res.json(doctors);
});

// ============ GET DOCTOR STATS ============
router.get("/stats/:doctorId", async (req, res) => {
  try {
    const doctorId = req.params.doctorId;
    const doctor = await Doctor.findById(doctorId);

    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    // Get pending requests count
    const pendingRequests = await Request.countDocuments({
      doctorId,
      status: 'pending'
    });

    // Get today's appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAppointments = await Appointment.countDocuments({
      doctorId,
      scheduledDateTime: { $gte: today, $lt: tomorrow },
      status: { $in: ['scheduled', 'in-progress'] }
    });

    // Get completed this month
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const completedThisMonth = await Appointment.countDocuments({
      doctorId,
      status: 'completed',
      scheduledDateTime: { $gte: monthStart }
    });

    res.json({
      success: true,
      stats: {
        pendingRequests,
        todayAppointments,
        completedThisMonth,
        rating: doctor.rating || 0,
        totalRatings: doctor.totalRatings || 0
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update doctor profile (allow doctors to edit their profile including availability)
router.put("/profile", doctorAuth, async (req, res) => {
  try {
    const doctorId = req.session.doctorId;
    const updates = req.body;

    // Fields that doctors can update
    const allowedFields = [
      "name", "phone", "specialization", "qualifications", "experience",
      "registrationNumber", "profilePhoto", "location", "availability",
      "consultationFee"
    ];

    // Filter updates to only allowed fields
    const filteredUpdates = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    const updatedDoctor = await Doctor.findByIdAndUpdate(
      doctorId,
      filteredUpdates,
      { new: true, runValidators: true }
    );

    if (!updatedDoctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    res.json({ success: true, message: "Profile updated successfully", doctor: updatedDoctor });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get doctor profile for editing
router.get("/profile/:doctorId", doctorAuth, async (req, res) => {
  try {
    const doctorId = req.params.doctorId;
    const doctor = await Doctor.findById(doctorId).select("-password");

    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    res.json({ success: true, doctor });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
