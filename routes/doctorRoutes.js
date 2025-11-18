const express = require("express");
const router = express.Router();
const Doctor = require("../models/doctor");
const path = require("path");
const Appointment = require("../models/appointment");
const PDFDocument = require("pdfkit");
const auth = require("../middleware/auth");



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

router.get("/appointments", auth, async (req, res) => {
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

router.get("/list", auth, async (req, res) => {
  const doctors = await Doctor.find();
  res.json(doctors);
});


module.exports = router;
