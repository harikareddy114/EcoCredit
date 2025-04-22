const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["admin", "employer", "employee"],
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
  carbonCredits: {
    type: Number,
    default: 0,
  },
  isApproved: {
    type: Boolean,
    default: function () {
      return this.role === "admin"; // Admin is auto-approved
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// When an employer is created, there's no need to set employerId
userSchema.pre("validate", function (next) {
  if (this.role !== "employee") {
    this.employerId = undefined;
  }
  next();
});

// Hash password before saving
userSchema.pre("save", async function (next) {
  // Skip hashing if password is already hashed (from PendingRegistration)
  if (
    !this.isModified("password") ||
    this.password.startsWith("$2a$") ||
    this.password.startsWith("$2b$")
  ) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
