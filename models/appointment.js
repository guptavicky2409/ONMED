const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Request' },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  scheduledDateTime: { type: Date, required: true },
  videoCallRoom: { type: String, required: true },
  problemDescription: String,
  images: [String],
  prescription: {
    medicines: [{
      name: String,
      dosage: String,
      duration: String,
      instructions: String
    }],
    diagnosis: String,
    advice: String,
    prescribedAt: Date,
    followUpDate: Date
  },
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  callStartTime: Date,
  callEndTime: Date,
  duration: Number, // in minutes
  patientRating: Number,
  patientFeedback: String,
  notificationSent15Min: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

appointmentSchema.index({ scheduledDateTime: 1 });
appointmentSchema.index({ patientId: 1 });
appointmentSchema.index({ doctorId: 1 });

module.exports = mongoose.model("Appointment", appointmentSchema);
