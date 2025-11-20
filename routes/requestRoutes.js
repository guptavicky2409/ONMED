const express = require("express");
const router = express.Router();
const Request = require("../models/request");
const Appointment = require("../models/appointment");
const Doctor = require("../models/doctor");
const Patient = require("../models/Patient");
const { patientAuth, doctorAuth } = require("../middleware/auth");
const { uploadPatientImages } = require("../middleware/upload");
const { v4: uuidv4 } = require('uuid');

router.post("/find-doctors", patientAuth, async (req, res) => {
  try {
    const { specialization, longitude, latitude, maxDistance = 50000 } = req.body; // 50km default

    console.log('Find doctors request:', { specialization, longitude, latitude, maxDistance });

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

    console.log('Found doctors before distance:', doctors.length);

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

    console.log('Doctors to return:', doctorsWithDistance.length);

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

/// ============ CREATE REQUEST ============
router.post("/create", patientAuth, uploadPatientImages.array('images', 5), async (req, res) => {
  try {
    const { doctorId, disease, symptoms, requestedDate, requestedTime } = req.body;
    const patientId = req.session.patientId;

    const patient = await Patient.findById(patientId);
    const doctor = await Doctor.findById(doctorId);

    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    // Check doctor availability for requested date and time
    const requestedDateObj = new Date(requestedDate);
    const isAvailable = checkDoctorAvailability(doctor, requestedDateObj, requestedTime);

    if (!isAvailable) {
      return res.status(400).json({
        error: "Doctor is not available at the selected date and time. Please choose a different time from the doctor's available slots.",
        availableSlots: getDoctorAvailableSlots(doctor, requestedDateObj)
      });
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

    // Get doctor availability
    const doctor = await Doctor.findById(request.doctorId);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    const scheduledDate = new Date(scheduledDateTime);
    const requestedTime = request.requestedTime;

    // No availability check needed when doctor accepts - they choose their own schedule

    // Generate unique video room
    const videoCallRoom = uuidv4();

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

// Helper function to check doctor availability
function checkDoctorAvailability(doctor, requestedDate, requestedTime) {
  if (!doctor.availability || !Array.isArray(doctor.availability)) {
    return false;
  }

  // Get day of week for requested date
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = days[requestedDate.getDay()];

  // Find availability for this day
  const dayAvailability = doctor.availability.find(slot =>
    slot.day && slot.day.toLowerCase() === dayOfWeek
  );

  if (!dayAvailability || !dayAvailability.slots || !Array.isArray(dayAvailability.slots)) {
    return false;
  }

  // Check if requested time falls within any available slot
  return dayAvailability.slots.some(slot => {
    if (!slot.startTime || !slot.endTime || slot.isBooked) {
      return false;
    }

    const [reqHours, reqMinutes] = requestedTime.split(':').map(Number);
    const reqTimeMinutes = reqHours * 60 + reqMinutes;

    const [startHours, startMinutes] = slot.startTime.split(':').map(Number);
    const startTimeMinutes = startHours * 60 + startMinutes;

    const [endHours, endMinutes] = slot.endTime.split(':').map(Number);
    const endTimeMinutes = endHours * 60 + endMinutes;

    return reqTimeMinutes >= startTimeMinutes && reqTimeMinutes <= endTimeMinutes;
  });
}

// Helper function to get available slots for a date
function getDoctorAvailableSlots(doctor, date) {
  if (!doctor.availability || !Array.isArray(doctor.availability)) {
    return [];
  }

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = days[date.getDay()];

  const dayAvailability = doctor.availability.find(slot =>
    slot.day && slot.day.toLowerCase() === dayOfWeek
  );

  if (!dayAvailability || !dayAvailability.slots) {
    return [];
  }

  return dayAvailability.slots.filter(slot => !slot.isBooked).map(slot => ({
    day: slot.day,
    startTime: slot.startTime,
    endTime: slot.endTime
  }));
}

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

// ============ CANCEL REQUEST (Patient) ============
router.post("/:requestId/cancel", patientAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const patientId = req.session.patientId;

    const request = await Request.findOneAndUpdate(
      { _id: requestId, patientId, status: 'pending' },
      { status: 'cancelled' },
      { new: true }
    );

    if (!request) {
      return res.status(404).json({ error: "Request not found or cannot be cancelled" });
    }

    res.json({ success: true, message: "Request cancelled successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
