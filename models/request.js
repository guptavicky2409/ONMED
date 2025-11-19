const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  disease: String,
  symptoms: String,
  images: [String], // Paths to uploaded images
  requestedDate: Date,
  requestedTime: String,
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'rejected', 'completed', 'cancelled'],
    default: 'pending' 
  },
  rejectionReason: String,
  videoCallRoom: String,
  scheduledDateTime: Date,
  notificationSent15Min: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Request", requestSchema);