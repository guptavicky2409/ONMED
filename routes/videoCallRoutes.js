const express = require("express");
const router = express.Router();
const Appointment = require("../models/appointment");
const path = require("path");

// Check if appointment time has arrived
router.get("/check/:appointmentId", async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.appointmentId);
    
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const now = new Date();
    const scheduledTime = new Date(appointment.scheduledTime);
    const timeDiff = scheduledTime - now;

    // Allow joining 5 minutes before scheduled time
    const canJoin = timeDiff <= 5 * 60 * 1000 && timeDiff >= -30 * 60 * 1000;

    res.json({
      canJoin,
      scheduledTime: appointment.scheduledTime,
      videoCallRoom: appointment.videoCallRoom,
      timeDiff: Math.floor(timeDiff / 1000 / 60) // in minutes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve video call page
router.get("/room/:roomId", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "videoCall.html"));
});

module.exports = router;