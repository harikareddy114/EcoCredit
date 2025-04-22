const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: "senderModel", 
    required: true,
  },
  senderModel: {
    type: String,
    enum: ["User", "PendingRegistration"],
    default: "PendingRegistration",
  },
  type: {
    type: String,
    enum: ["employer_approval", "employee_approval"],
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  message: {
    type: String,
    required: true,
  },
  pendingRegistrationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PendingRegistration",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
