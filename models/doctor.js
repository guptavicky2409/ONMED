const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema({
  name: String,
  specialization: String
});

module.exports = mongoose.model("Doctor", doctorSchema);
