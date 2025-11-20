const express = require("express");
const router = express.Router();
const Appointment = require("../models/appointment");
const cron = require('node-cron');

// Store notification connections
const notificationConnections = new Map();

// SSE endpoint for real-time notifications
router.get("/stream/:userId/:userType", (req, res) => {
  const { userId, userType } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Store connection
  const key = `${userType}-${userId}`;
  notificationConnections.set(key, res);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Notification stream connected' })}\n\n`);

  // Clean up on close
  req.on('close', () => {
    notificationConnections.delete(key);
  });
});

// Function to send notification
function sendNotification(userId, userType, data) {
  const key = `${userType}-${userId}`;
  const connection = notificationConnections.get(key);
  
  if (connection) {
    connection.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

// Cron job to check appointments every minute
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const fifteenMinutesLater = new Date(now.getTime() + 15 * 60000);

    // Find appointments scheduled in 15 minutes
    const upcomingAppointments = await Appointment.find({
      scheduledDateTime: {
        $gte: now,
        $lte: fifteenMinutesLater
      },
      notificationSent15Min: false,
      status: 'scheduled'
    });

    for (const appointment of upcomingAppointments) {
      // Send notification to patient
      sendNotification(appointment.patientId.toString(), 'patient', {
        type: 'appointment-reminder',
        message: 'Your appointment is starting in 15 minutes!',
        appointmentId: appointment._id,
        videoCallRoom: appointment.videoCallRoom
      });

      // Send notification to doctor
      sendNotification(appointment.doctorId.toString(), 'doctor', {
        type: 'appointment-reminder',
        message: 'Your appointment is starting in 15 minutes!',
        appointmentId: appointment._id,
        videoCallRoom: appointment.videoCallRoom
      });

      // Mark as notified
      appointment.notificationSent15Min = true;
      await appointment.save();
    }
  } catch (err) {
    console.error('Notification cron error:', err);
  }
});

// Send notification (Internal endpoint)
router.post("/send", (req, res) => {
  const { userId, userType, type, message, appointmentId, videoCallRoom } = req.body;
  const data = { type, message, appointmentId, videoCallRoom };
  sendNotification(userId, userType, data);
  res.json({ success: true });
});

// Get pending notifications
router.get("/pending/:userId/:userType", async (req, res) => {
  try {
    const { userId, userType } = req.params;
    const now = new Date();
    const fifteenMinutesLater = new Date(now.getTime() + 15 * 60000);

    let appointments;
    if (userType === 'patient') {
      appointments = await Appointment.find({
        patientId: userId,
        scheduledDateTime: { $gte: now, $lte: fifteenMinutesLater },
        status: 'scheduled'
      }).populate('doctorId', 'name specialization');
    } else if (userType === 'doctor') {
      appointments = await Appointment.find({
        doctorId: userId,
        scheduledDateTime: { $gte: now, $lte: fifteenMinutesLater },
        status: 'scheduled'
      }).populate('patientId', 'name age gender');
    }

    res.json({ success: true, appointments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export the sendNotification function for use in other routes
module.exports.sendNotification = sendNotification;
module.exports = router;
