const express = require("express");
const router = express.Router();
const Appointment = require("../models/appointment");
const Patient = require("../models/Patient");
const Doctor = require("../models/doctor");
const Request = require("../models/request");
const { adminAuth, doctorAuth, patientAuth } = require("../middleware/auth");
const PDFDocument = require("pdfkit");
const path = require("path");
const { sendNotification } = require("./notificationRoutes");

// ============================================
// ADMIN ROUTES - Create Appointment Manually
// ============================================

// Create Appointment (Admin)
router.post("/add", adminAuth, async (req, res) => {
  try {
    const { patientId, doctorId, date, scheduledDateTime } = req.body;

    const appt = new Appointment({
      patientId,
      doctorId,
      date,
      scheduledDateTime: scheduledDateTime ? new Date(scheduledDateTime) : new Date(date),
      status: 'scheduled'
    });

    await appt.save();

    if (req.headers.accept && req.headers.accept.includes("text/html")) {
      return res.redirect("/viewAppointments.html");
    }

    res.json({ 
      success: true,
      message: "Appointment added", 
      appointment: appt 
    });
  } catch (err) {
    console.error("Add appointment error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get all appointments (Admin - with patient + doctor names)
router.get("/", async (req, res) => {
  try {
    const appts = await Appointment.find().sort({ scheduledDateTime: -1 });

    const result = [];
    for (let a of appts) {
      const patient = await Patient.findById(a.patientId);
      const doctor = await Doctor.findById(a.doctorId);

      result.push({
        _id: a._id,
        date: a.date,
        scheduledDateTime: a.scheduledDateTime,
        patientName: patient ? patient.name : "Unknown",
        doctorName: doctor ? doctor.name : "Unknown",
        status: a.status,
        videoCallRoom: a.videoCallRoom,
        // Handle old string prescription data
      });
    }

    res.json(result);
  } catch (err) {
    console.error("Get appointments error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete appointment (Admin)
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    await Appointment.findByIdAndDelete(req.params.id);
    res.json({
      success: true,
      message: "Appointment deleted"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel appointment (Admin)
router.post("/:appointmentId/cancel", adminAuth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.appointmentId);

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Check if appointment is already cancelled or completed
    if (appointment.status === 'cancelled') {
      return res.status(400).json({ error: "Appointment is already cancelled" });
    }

    if (appointment.status === 'completed') {
      return res.status(400).json({ error: "Cannot cancel completed appointments" });
    }

    appointment.status = 'cancelled';
    await appointment.save();

    // Update request status if exists
    if (appointment.requestId) {
      await Request.findByIdAndUpdate(appointment.requestId, { status: 'cancelled' });
    }

    res.json({
      success: true,
      message: "Appointment cancelled successfully"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// PATIENT ROUTES
// ============================================

// Get Patient's Appointments
router.get("/patient/my-appointments", patientAuth, async (req, res) => {
  try {
    const patientId = req.session.patientId;

    const appointments = await Appointment.find({ patientId })
      .populate('doctorId', 'name specialization phone consultationFee location profilePhoto')
      .sort({ scheduledDateTime: -1 });

    res.json({ 
      success: true, 
      appointments 
    });
  } catch (err) {
    console.error("Get patient appointments error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get specific appointment details (Patient)
router.get("/patient/appointment/:appointmentId", patientAuth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.appointmentId)
      .populate('patientId', 'name age gender phone')
      .populate('doctorId', 'name specialization phone consultationFee location profilePhoto');

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    res.json({ 
      success: true, 
      appointment 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel appointment (Patient)
router.post("/patient/cancel/:appointmentId", patientAuth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.appointmentId);
    
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Check if appointment is in future
    if (new Date(appointment.scheduledDateTime) < new Date()) {
      return res.status(400).json({ error: "Cannot cancel past appointments" });
    }

    appointment.status = 'cancelled';
    await appointment.save();

    // Update request status if exists
    if (appointment.requestId) {
      await Request.findByIdAndUpdate(appointment.requestId, { status: 'cancelled' });
    }

    res.json({ 
      success: true, 
      message: "Appointment cancelled successfully" 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// DOCTOR ROUTES
// ============================================

// Get Doctor's Appointments
router.get("/doctor/my-appointments", doctorAuth, async (req, res) => {
  try {
    const doctorId = req.session.doctorId;

    const appointments = await Appointment.find({ doctorId })
      .populate('patientId', 'name age gender phone location')
      .sort({ scheduledDateTime: -1 });

    res.json({ 
      success: true, 
      appointments 
    });
  } catch (err) {
    console.error("Get doctor appointments error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get specific appointment details (Doctor)
router.get("/doctor/appointment/:appointmentId", doctorAuth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.appointmentId)
      .populate('patientId', 'name age gender phone location medicalHistory')
      .populate('doctorId', 'name specialization');

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    res.json({ 
      success: true, 
      appointment 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get today's appointments (Doctor Dashboard)
router.get("/doctor/today", doctorAuth, async (req, res) => {
  try {
    const doctorId = req.session.doctorId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointments = await Appointment.find({
      doctorId,
      scheduledDateTime: {
        $gte: today,
        $lt: tomorrow
      },
      status: { $in: ['scheduled', 'in-progress'] }
    })
    .populate('patientId', 'name age gender phone')
    .sort({ scheduledDateTime: 1 });

    res.json({ 
      success: true, 
      appointments 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// VIDEO CALL ROUTES
// ============================================

// Check if user can join video call
router.get("/check-call-access/:appointmentId", async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.appointmentId);
    
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const now = new Date();
    const scheduledTime = new Date(appointment.scheduledDateTime);
    const timeDiff = scheduledTime - now;
    const timeDiffMinutes = Math.floor(timeDiff / 60000);

    // Allow joining 15 minutes before and up to 30 minutes after scheduled time
    const canJoin = timeDiffMinutes <= 15 && timeDiffMinutes >= -30;

    res.json({
      success: true,
      canJoin,
      scheduledTime: appointment.scheduledDateTime,
      videoCallRoom: appointment.videoCallRoom,
      timeDiffMinutes,
      status: appointment.status,
      message: canJoin ? 
        "You can join the call now" : 
        timeDiffMinutes > 15 ? 
          `Call starts in ${timeDiffMinutes} minutes` : 
          "Call time has expired"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start video call
router.post("/start-call/:appointmentId", async (req, res) => {
  try {
    console.log(`Starting call for appointment: ${req.params.appointmentId}`);

    const appointment = await Appointment.findById(req.params.appointmentId);
    if (!appointment) {
      console.log("Appointment not found:", req.params.appointmentId);
      return res.status(404).json({ error: "Appointment not found" });
    }

    console.log("Appointment found, current status:", appointment.status);

    // Check if already completed or cancelled
    if (appointment.status === 'completed' || appointment.status === 'cancelled') {
      console.log("Cannot start call, appointment status:", appointment.status);
      return res.status(400).json({
        error: `Cannot start call. Appointment is ${appointment.status}`
      });
    }

    // Update appointment status
    appointment.status = 'in-progress';
    if (!appointment.callStartTime) {
      appointment.callStartTime = new Date();
    }

    console.log("Saving appointment with in-progress status...");
    await appointment.save();
    console.log("Appointment saved successfully");

    // Send notification to patient that call has started
    console.log("Sending notification to patient...");
    try {
      sendNotification(appointment.patientId.toString(), 'patient', {
        type: 'call-started',
        message: 'Your doctor has started the video call!',
        appointmentId: appointment._id,
        videoCallRoom: appointment.videoCallRoom
      });
      console.log("Notification sent successfully");
    } catch (notificationErr) {
      console.error("Notification failed, but continuing:", notificationErr);
      // Don't fail the whole request due to notification issues
    }

    console.log("Call started successfully");
    res.json({
      success: true,
      message: "Video call started",
      videoCallRoom: appointment.videoCallRoom
    });
  } catch (err) {
    console.error("Error starting call:", err);
    res.status(500).json({ error: err.message });
  }
});

// End video call
router.post("/end-call/:appointmentId", async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.appointmentId);
    
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (!appointment.callEndTime) {
      appointment.callEndTime = new Date();
      
      // Calculate duration if call was started
      if (appointment.callStartTime) {
        const duration = Math.round(
          (appointment.callEndTime - appointment.callStartTime) / 60000
        );
        appointment.duration = duration;
      }
    }

    // Only change to completed if prescription is added
    if (appointment.prescription && appointment.prescription.medicines) {
      appointment.status = 'completed';
    }

    await appointment.save();

    res.json({ 
      success: true, 
      message: "Call ended successfully",
      duration: appointment.duration 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// PRESCRIPTION ROUTES
// ============================================

// Submit prescription (Doctor only)
router.post("/prescription/:appointmentId", doctorAuth, async (req, res) => {
  try {
    const { medicines, diagnosis, advice, followUpDate } = req.body;
    const appointmentId = req.params.appointmentId;
    const doctorId = req.session.doctorId;

    const appointment = await Appointment.findById(appointmentId);
    
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Verify doctor owns this appointment
    if (appointment.doctorId.toString() !== doctorId.toString()) {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    // Parse medicines if sent as JSON string
    const parsedMedicines = typeof medicines === 'string' ? 
      JSON.parse(medicines) : medicines;

    appointment.prescription = {
      medicines: parsedMedicines,
      diagnosis,
      advice,
      followUpDate: followUpDate ? new Date(followUpDate) : null,
      prescribedAt: new Date()
    };

    appointment.status = 'completed';
    
    // Set call end time if not already set
    if (!appointment.callEndTime) {
      appointment.callEndTime = new Date();
      
      if (appointment.callStartTime) {
        const duration = Math.round(
          (appointment.callEndTime - appointment.callStartTime) / 60000
        );
        appointment.duration = duration;
      }
    }

    await appointment.save();

    res.json({ 
      success: true, 
      message: "Prescription saved successfully!",
      appointment 
    });
  } catch (err) {
    console.error("Prescription save error:", err);
    res.status(500).json({ error: err.message });
  }
});

// View prescription (Patient or Doctor)
router.get("/prescription/:appointmentId", async (req, res) => {
  try {
    const appointmentId = req.params.appointmentId;
    const userId = req.session.patientId || req.session.doctorId;

    const appointment = await Appointment.findById(appointmentId)
      .populate('patientId', 'name age gender phone')
      .populate('doctorId', 'name specialization qualifications registrationNumber phone');

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Check authorization
    const isAuthorized = 
      appointment.patientId._id.toString() === userId ||
      appointment.doctorId._id.toString() === userId ||
      req.session.admin;

    if (!isAuthorized) {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    if (!appointment.prescription || !appointment.prescription.medicines) {
      return res.status(404).json({ error: "Prescription not yet provided" });
    }

    res.json({ 
      success: true, 
      appointment 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download prescription as PDF
router.get("/prescription/download/:appointmentId", async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.appointmentId)
      .populate('patientId', 'name age gender phone address')
      .populate('doctorId', 'name specialization qualifications registrationNumber phone location');

    if (!appointment || !appointment.prescription || !appointment.prescription.medicines) {
      return res.status(404).json({ error: "Prescription not found" });
    }

    // Create PDF
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 
      `attachment; filename=prescription-${appointment._id}.pdf`);
    
    doc.pipe(res);

    // Header with border
    doc.rect(40, 40, 515, 80).stroke();
    doc.fontSize(28)
       .fillColor('#2563eb')
       .text('MEDICAL PRESCRIPTION', 50, 60, { align: 'center' });
    doc.fontSize(10)
       .fillColor('#666')
       .text(`Appointment Date: ${new Date(appointment.scheduledDateTime).toLocaleString()}`, 
             50, 95, { align: 'center' });
    
    doc.moveDown(3);

    // Doctor Details Section
    doc.rect(40, doc.y, 515, 110).stroke();
    const doctorY = doc.y + 10;
    
    doc.fontSize(14)
       .fillColor('#000')
       .text('Doctor Information', 50, doctorY, { underline: true });
    doc.fontSize(11)
       .fillColor('#333')
       .text(`Dr. ${appointment.doctorId.name}`, 50, doctorY + 25)
       .text(`${appointment.doctorId.specialization}`, 50, doctorY + 42)
       .text(`Reg. No: ${appointment.doctorId.registrationNumber}`, 50, doctorY + 59)
       .text(`Phone: ${appointment.doctorId.phone}`, 50, doctorY + 76);
    
    doc.moveDown(8);

    // Patient Details Section
    doc.rect(40, doc.y, 515, 110).stroke();
    const patientY = doc.y + 10;
    
    doc.fontSize(14)
       .fillColor('#000')
       .text('Patient Information', 50, patientY, { underline: true });
    doc.fontSize(11)
       .fillColor('#333')
       .text(`Name: ${appointment.patientId.name}`, 50, patientY + 25)
       .text(`Age: ${appointment.patientId.age || 'N/A'} years`, 50, patientY + 42)
       .text(`Gender: ${appointment.patientId.gender || 'N/A'}`, 50, patientY + 59)
       .text(`Phone: ${appointment.patientId.phone}`, 50, patientY + 76);
    
    doc.moveDown(8);

    // Diagnosis Section
    doc.rect(40, doc.y, 515, 70).stroke();
    const diagnosisY = doc.y + 10;
    
    doc.fontSize(14)
       .fillColor('#000')
       .text('Diagnosis', 50, diagnosisY, { underline: true });
    doc.fontSize(11)
       .fillColor('#333')
       .text(appointment.prescription.diagnosis || 'N/A', 50, diagnosisY + 25, {
         width: 495,
         align: 'left'
       });
    
    doc.moveDown(6);

    // Medicines Section (Rx Symbol)
    doc.fontSize(24)
       .fillColor('#2563eb')
       .text('℞', 50, doc.y);
    
    doc.fontSize(14)
       .fillColor('#000')
       .text('Prescribed Medicines', 80, doc.y - 15, { underline: true });
    
    doc.moveDown(2);

    if (appointment.prescription.medicines && appointment.prescription.medicines.length > 0) {
      appointment.prescription.medicines.forEach((med, index) => {
        doc.fontSize(12)
           .fillColor('#000')
           .text(`${index + 1}. ${med.name}`, 60, doc.y, { bold: true });
        doc.fontSize(10)
           .fillColor('#555')
           .text(`    Dosage: ${med.dosage}`, 60, doc.y + 3)
           .text(`    Duration: ${med.duration}`, 60, doc.y + 3)
           .text(`    Instructions: ${med.instructions}`, 60, doc.y + 3);
        doc.moveDown(1);
      });
    } else {
      doc.fontSize(11)
         .fillColor('#666')
         .text('No medicines prescribed', 60, doc.y);
    }

    doc.moveDown(2);

    // Advice Section
    doc.fontSize(14)
       .fillColor('#000')
       .text('Medical Advice', 50, doc.y, { underline: true });
    doc.fontSize(11)
       .fillColor('#333')
       .text(appointment.prescription.advice || 'N/A', 50, doc.y + 5, {
         width: 495,
         align: 'left'
       });
    
    doc.moveDown(2);

    // Follow-up Date
    if (appointment.prescription.followUpDate) {
      doc.fontSize(12)
         .fillColor('#d97706')
         .text('Follow-up Date: ' + 
               new Date(appointment.prescription.followUpDate).toLocaleDateString(), 
               50, doc.y, { bold: true });
      doc.moveDown(2);
    }

    // Footer with signature
    doc.moveDown(3);
    doc.fontSize(10)
       .fillColor('#666')
       .text('This is a computer-generated prescription', 50, doc.y, { align: 'center' });
    
    doc.moveDown(2);
    doc.fontSize(11)
       .fillColor('#000')
       .text('_____________________________', 400, doc.y)
       .text('Doctor Signature', 420, doc.y + 5);

    doc.end();
  } catch (err) {
    console.error("PDF generation error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// RATING & FEEDBACK
// ============================================

// Submit rating and feedback (Patient)
router.post("/rate/:appointmentId", patientAuth, async (req, res) => {
  try {
    const { rating, feedback } = req.body;
    const appointmentId = req.params.appointmentId;
    const patientId = req.session.patientId;

    const appointment = await Appointment.findById(appointmentId);
    
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Verify patient owns this appointment
    if (appointment.patientId.toString() !== patientId.toString()) {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    // Check if appointment is completed
    if (appointment.status !== 'completed') {
      return res.status(400).json({ 
        error: "Can only rate completed appointments" 
      });
    }

    appointment.patientRating = rating;
    appointment.patientFeedback = feedback;
    await appointment.save();

    // Update doctor's overall rating
    const doctor = await Doctor.findById(appointment.doctorId);
    const totalRating = doctor.rating * doctor.totalRatings + rating;
    doctor.totalRatings += 1;
    doctor.rating = totalRating / doctor.totalRatings;
    await doctor.save();

    res.json({ 
      success: true, 
      message: "Thank you for your feedback!" 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// STATISTICS ROUTES
// ============================================

// Get appointment by video call room
router.get("/by-room/:roomId", async (req, res) => {
  try {
    const appointment = await Appointment.findOne({ videoCallRoom: req.params.roomId });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    res.json({
      success: true,
      appointment: {
        _id: appointment._id,
        status: appointment.status
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get appointment count (for admin dashboard)
router.get("/count", async (req, res) => {
  try {
    const total = await Appointment.countDocuments();
    res.json({
      success: true,
      count: total
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get appointment statistics (Admin)
router.get("/stats", adminAuth, async (req, res) => {
  try {
    const total = await Appointment.countDocuments();
    const scheduled = await Appointment.countDocuments({ status: 'scheduled' });
    const completed = await Appointment.countDocuments({ status: 'completed' });
    const cancelled = await Appointment.countDocuments({ status: 'cancelled' });
    const inProgress = await Appointment.countDocuments({ status: 'in-progress' });

    res.json({
      success: true,
      stats: {
        total,
        scheduled,
        completed,
        cancelled,
        inProgress
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
