const express = require("express");
const router = express.Router();
const Request = require("../models/request");
const Appointment = require("../models/appointment");
const Doctor = require("../models/doctor");
const Patient = require("../models/Patient");
const { patientAuth, doctorAuth } = require("../middleware/auth");
const { uploadPatientImages } = require("../middleware/upload");
const { v4: uuidv4 } = require('uuid');

// ============ FIND NEARBY DOCTORS ============
router.post("/find-doctors", patientAuth, async (req, res) => {
  try {
    const { specialization, longitude, latitude, maxDistance = 50000 } = req.body; // 50km default

    const doctors = await Doctor.find({
      specialization: new RegExp(specialization, 'i'),
      isVerified: true,
      'location.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: maxDistance // in meters
        }
      }
    }).select('-password');

    // Calculate distance for each doctor
    const doctorsWithDistance = doctors.map(doctor => {
      const distance = calculateDistance(
        latitude, longitude,
        doctor.location.coordinates[1], doctor.location.coordinates[0]
      );
      
      return {
        ...doctor.toObject(),
        distance: Math.round(distance * 10) / 10 // Round to 1 decimal
      };
    });

    res.json({ 
      success: true, 
      doctors: doctorsWithDistance 
    });
  } catch (err) {
    console.error("Find doctors error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Helper function to calculate distance
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// ============ CREATE REQUEST ============
router.post("/create", patientAuth, uploadPatientImages.array('images', 5), async (req, res) => {
  try {
    const { doctorId, disease, symptoms, requestedDate, requestedTime } = req.body;
    const patientId = req.session.patientId;

    const patient = await Patient.findById(patientId);
    const doctor = await Doctor.findById(doctorId);

    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    // Get uploaded image paths
    const images = req.files ? req.files.map(file => file.path) : [];

    const newRequest = new Request({
      patientId,
      doctorId,
      disease,
      symptoms,
      images,
      requestedDate: new Date(requestedDate),
      requestedTime,
      status: 'pending'
    });

    await newRequest.save();

    res.json({ 
      success: true, 
      message: "Request sent to doctor successfully!",
      request: newRequest
    });
  } catch (err) {
    console.error("Create request error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============ GET DOCTOR'S PENDING REQUESTS ============
router.get("/doctor/pending", doctorAuth, async (req, res) => {
  try {
    const doctorId = req.session.doctorId;

    const requests = await Request.find({ 
      doctorId,
      status: 'pending'
    })
    .populate('patientId', 'name email phone age gender location')
    .sort({ createdAt: -1 });

    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ ACCEPT REQUEST ============
router.post("/accept/:requestId", doctorAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { scheduledDateTime } = req.body;

    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    // Generate unique video room
    const videoCallRoom = uuidv4();
    const scheduledDate = new Date(scheduledDateTime);

    // Update request
    request.status = 'accepted';
    request.scheduledDateTime = scheduledDate;
    request.videoCallRoom = videoCallRoom;
    await request.save();

    // Create appointment
    const appointment = new Appointment({
      requestId: request._id,
      patientId: request.patientId,
      doctorId: request.doctorId,
      scheduledDateTime: scheduledDate,
      videoCallRoom,
      problemDescription: request.symptoms,
      images: request.images,
      status: 'scheduled'
    });

    await appointment.save();

    res.json({ 
      success: true, 
      message: "Request accepted and appointment scheduled!",
      appointment
    });
  } catch (err) {
    console.error("Accept request error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============ REJECT REQUEST ============
router.post("/reject/:requestId", doctorAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;

    const request = await Request.findByIdAndUpdate(
      requestId,
      { 
        status: 'rejected',
        rejectionReason: reason 
      },
      { new: true }
    );

    res.json({ 
      success: true, 
      message: "Request rejected",
      request
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ GET PATIENT'S REQUESTS ============
router.get("/patient/my-requests", patientAuth, async (req, res) => {
  try {
    const patientId = req.session.patientId;

    const requests = await Request.find({ patientId })
      .populate('doctorId', 'name specialization phone consultationFee location')
      .sort({ createdAt: -1 });

    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;