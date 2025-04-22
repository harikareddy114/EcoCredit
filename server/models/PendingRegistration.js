const mongoose = require("mongoose");

const pendingRegistrationSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["employer", "employee"],
    required: true,
  },
  companyName: {
    type: String,
    required: function () {
      return this.role === "employer";
    },
  },
  employerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: function () {
      return this.role === "employee";
    },
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const PendingRegistration = mongoose.model(
  "PendingRegistration",
  pendingRegistrationSchema
);

module.exports = PendingRegistration;
