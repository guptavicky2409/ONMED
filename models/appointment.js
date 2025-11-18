const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({
  patientId: String,
  doctorId: String,
  date: String,

  problemDescription: {
    type: String,
    default: ""
  },
  images: {
    type: [String],
    default: []
  },
  prescription: {
    type: String,
    default: ""
  },
  status: {
    type: String,
    default: "Pending"
  }
});

module.exports = mongoose.model("Appointment", appointmentSchema);
