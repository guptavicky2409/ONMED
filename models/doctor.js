const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  specialization: { type: String, required: true },
  qualifications: String,
  experience: Number,
  registrationNumber: { type: String, required: true, unique: true },
  proofDocument: String, // Path to uploaded proof document
  profilePhoto: String,
  location: {
    type: { type: String, default: 'Point' },
    coordinates: [Number], // [longitude, latitude]
    address: String,
    city: String,
    state: String
  },
  availability: [{
    day: String, // Monday, Tuesday, etc.
    slots: [{
      startTime: String, // "09:00"
      endTime: String,   // "10:00"
      isBooked: { type: Boolean, default: false }
    }]
  }],
  consultationFee: Number,
  isVerified: { type: Boolean, default: false },
  applicationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rating: { type: Number, default: 0 },
  totalRatings: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

doctorSchema.index({ 'location.coordinates': '2dsphere' });

module.exports = mongoose.model("Doctor", doctorSchema);
