const express = require("express");
const router = express.Router();
const Appointment = require("../models/appointment");
const Patient = require("../models/Patient");
const Doctor = require("../models/doctor");

// Create Appointment
router.post("/add", async (req, res) => {
  const { patientId, doctorId, date } = req.body;

  const appt = new Appointment({
    patientId,
    doctorId,
    date
  });

  await appt.save();

  if (req.headers.accept && req.headers.accept.includes("text/html")) {
    return res.redirect("/viewAppointments.html");
  }

  res.json({ message: "Appointment added", appt });
});

// Get all appointments (with patient + doctor names)
router.get("/", async (req, res) => {
  const appts = await Appointment.find().sort({ _id: -1 });

  const result = [];
  for (let a of appts) {
    const patient = await Patient.findById(a.patientId);
    const doctor  = await Doctor.findById(a.doctorId);

    result.push({
      _id: a._id,
      date: a.date,
      patientName: patient ? patient.name : "Unknown",
      doctorName: doctor ? doctor.name : "Unknown",
    });
  }

  res.json(result);
});

// Delete appointment
router.delete("/:id", async (req, res) => {
  await Appointment.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

module.exports = router;
