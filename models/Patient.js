const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  age: Number,
  gender: String,
  address: String,
  location: {
    type: { type: String, default: 'Point' },
    coordinates: [Number], // [longitude, latitude]
    city: String,
    state: String
  },
  medicalHistory: String,
  createdAt: { type: Date, default: Date.now }
});

patientSchema.index({ 'location.coordinates': '2dsphere' });

module.exports = mongoose.model("Patient", patientSchema);