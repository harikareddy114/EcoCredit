const mongoose = require("mongoose");

const commuteSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  method: {
    type: String,
    enum: [
      "bike",
      "walk",
      "carpool",
      "public_transport",
      "electric_vehicle",
      "car",
    ],
    required: true,
  },
  startLocation: {
    type: String,
    required: true,
  },
  endLocation: {
    type: String,
    required: true,
  },
  distanceKm: {
    type: Number,
    required: true,
  },
  carbonSaved: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Commute", commuteSchema);
