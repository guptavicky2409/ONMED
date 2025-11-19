const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");

const Appointment = require("../models/appointment");
const Doctor = require("../models/doctor");
const Patient = require("../models/Patient");

// -----------------------------------------------------
// 1) ADD PATIENT
// -----------------------------------------------------
router.post("/add", async (req, res) => {
  try {
    const newPatient = new Patient(req.body);
    await newPatient.save();

    res.send("<script>alert('Patient added successfully!'); window.location.href='/addpatient.html'</script>");
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

// -----------------------------------------------------
// 2) MULTER CONFIG
// -----------------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});

const upload = multer({ storage });

// -----------------------------------------------------
// 3) PATIENT DASHBOARD PAGE
// -----------------------------------------------------
router.get("/dashboard/:patientId", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "patientDashboard.html"));
});

// -----------------------------------------------------
// 4) GET APPOINTMENTS WITH DOCTOR NAME (MAIN FIX)
// -----------------------------------------------------
router.get("/get-appointments/:patientId", async (req, res) => {
  const patientId = req.params.patientId;

  const appointments = await Appointment.find({ patientId }).sort({ _id: -1 });

  const result = [];

  for (let appt of appointments) {
    // FIX: doctorId is stored as STRING, so use findOne
    const doctor = await Doctor.findOne({ _id: appt.doctorId });

    result.push({
      _id: appt._id,
      date: appt.date,
      status: appt.status || "Pending",
      problemDescription: appt.problemDescription,
      prescription: appt.prescription,

      // FIXED: Doctor name will now show correctly
      doctorName: doctor ? doctor.name : "Unknown Doctor",
    });
  }

  res.json(result);
});

// -----------------------------------------------------
// 5) EXPLAIN PROBLEM PAGE
// -----------------------------------------------------
router.get("/explain-problem/:appointmentId", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "patientProblems.html"));
});

// -----------------------------------------------------
// 6) SUBMIT PROBLEM + IMAGES
// -----------------------------------------------------
router.post("/submit-problem/:appointmentId", upload.array("images", 5), async (req, res) => {
  const appointmentId = req.params.appointmentId;
  const imagePaths = req.files.map(file => file.path);

  await Appointment.findByIdAndUpdate(appointmentId, {
    problemDescription: req.body.problemDescription,
    images: imagePaths,
    status: "Reviewed"
  });

  res.send("<script>alert('Problem submitted!'); window.location.href='/patientDashboard.html'</script>");
});

// -----------------------------------------------------
// 7) GET ALL PATIENTS (for dropdowns, admin UI, etc.)
// -----------------------------------------------------
router.get("/all", async (req, res) => {
  const patients = await Patient.find({});
  res.json(patients);
});
// -----------------------------------------------------
// 9) GET ALL PATIENTS (alternative endpoint for compatibility)
// -----------------------------------------------------
router.get("/", async (req, res) => {
  const patients = await Patient.find({});
  res.json(patients);
});

// -----------------------------------------------------
// 8) DELETE PATIENT
// -----------------------------------------------------
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    await Patient.findByIdAndDelete(id);

    res.json({ success: true, message: "Patient deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
