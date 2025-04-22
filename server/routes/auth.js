const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Notification = require("../models/Notification");
const PendingRegistration = require("../models/PendingRegistration");
const Commute = require("../models/Commute");
const { auth } = require("../middleware/auth");
const Transaction = require("../models/Trading");
const mongoose = require("mongoose");

// ======================
// AUTHENTICATION ROUTES
// ======================

// Register new user
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, role, companyName, employerId } =
      req.body;

    // Validation
    if (!username || !email || !password || !role) {
      return res
        .status(400)
        .json({ message: "Please fill in all required fields" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ message: "Please enter a valid email address" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long" });
    }

    // Check existing users
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const existingPending = await PendingRegistration.findOne({ email });
    if (existingPending) {
      return res.status(400).json({
        message: "You already have a pending registration with this email",
      });
    }

    // Role validation
    if (!["employer", "employee", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // Admin creation validation
    if (role === "admin") {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res
          .status(403)
          .json({ message: "Admin registration requires authorization" });
      }

      try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
        const existingAdmin = await User.findById(decoded.id);

        if (!existingAdmin || existingAdmin.role !== "admin") {
          return res
            .status(403)
            .json({ message: "Only admins can create new admin users" });
        }
      } catch (error) {
        return res.status(403).json({ message: "Invalid authorization token" });
      }
    }

    // Role-specific validation
    if (role === "employer" && !companyName) {
      return res
        .status(400)
        .json({ message: "Company name is required for employers" });
    }

    if (role === "employee" && !employerId) {
      return res.status(400).json({ message: "Please select an employer" });
    }

    // Hash password and create pending registration
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const pendingData = {
      username,
      email,
      password: hashedPassword,
      role,
      status: "pending",
      ...(role === "employer" && { companyName }),
      ...(role === "employee" && { employerId }),
    };

    const pendingRegistration = await new PendingRegistration(
      pendingData
    ).save();

    // Create notifications
    if (role === "employer") {
      const admin = await User.findOne({ role: "admin" });
      if (admin) {
        await new Notification({
          recipient: admin._id,
          sender: pendingRegistration._id,
          type: "employer_approval",
          message: `New employer registration from ${companyName}`,
          status: "pending",
          pendingRegistrationId: pendingRegistration._id,
        }).save();
      }
    } else if (role === "employee" && employerId) {
      await new Notification({
        recipient: employerId,
        sender: pendingRegistration._id,
        type: "employee_approval",
        message: `New employee registration from ${username}`,
        status: "pending",
        pendingRegistrationId: pendingRegistration._id,
      }).save();
    }

    res.status(201).json({
      message: "Registration successful! Please wait for approval.",
      pendingId: pendingRegistration._id,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      message: "Server error during registration",
      error: error.message,
    });
  }
});

// Login user
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({
      email: { $regex: new RegExp("^" + email + "$", "i") },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (!user.isApproved && user.role !== "admin") {
      return res.status(403).json({ message: "Account pending approval" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        companyName: user.companyName,
        employerId: user.employerId,
        isApproved: user.isApproved,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Server error during login",
      error: error.message,
    });
  }
});

// ======================
// USER MANAGEMENT ROUTES
// ======================

// Get approved employers (public endpoint)
router.get("/employers/approved", async (req, res) => {
  try {
    const employers = await User.find(
      { role: "employer", isApproved: true },
      { _id: 1, username: 1, companyName: 1 }
    ).sort({ companyName: 1 });

    if (!employers || employers.length === 0) {
      return res.status(404).json({ message: "No approved employers found" });
    }

    console.log(`Found ${employers.length} approved employers`);
    res.json(employers);
  } catch (error) {
    console.error("Error fetching approved employers:", error);
    res.status(500).json({
      message: "Server error while fetching employers",
      error: error.message,
    });
  }
});

// Get user by ID
router.get("/users/:id", async (req, res) => {
  try {
    console.log("Attempting to find user with ID:", req.params.id);
    const user = await User.findById(req.params.id).select("-password").lean();
    console.log("User search result:", user);

    if (!user) {
      console.log("User not found in database");
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "employee" && user.employerId) {
      console.log("Fetching employer data for employee");
      const employer = await User.findById(user.employerId)
        .select("username companyName")
        .lean();
      console.log("Employer data:", employer);
      user.employer = employer;
    }

    res.json(user);
  } catch (error) {
    console.error("Error in /users/:id route:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// ======================
// APPROVAL ROUTES
// ======================

// Admin approve employer
router.post("/approve/:pendingId", auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { pendingId } = req.params;
    const { approvedBy } = req.body;

    // Validate inputs
    if (!approvedBy) {
      await session.abortTransaction();
      return res.status(400).json({ message: "approvedBy is required" });
    }

    // Verify the requesting user is an admin
    if (req.user.role !== "admin") {
      await session.abortTransaction();
      return res
        .status(403)
        .json({ message: "Only admins can approve employers" });
    }

    // Find the pending registration
    const pendingEmployer = await PendingRegistration.findById(
      pendingId
    ).session(session);
    if (!pendingEmployer) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ message: "Pending registration not found" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      email: pendingEmployer.email,
    }).session(session);

    if (existingUser) {
      await session.abortTransaction();
      return res.status(400).json({ message: "User already exists" });
    }

    // Create new user
    const newUser = new User({
      username: pendingEmployer.username,
      email: pendingEmployer.email,
      password: pendingEmployer.password,
      role: pendingEmployer.role,
      companyName: pendingEmployer.companyName,
      isApproved: true,
      status: "approved",
      approvedBy,
      approvedAt: new Date(),
    });

    // Save the new user
    await newUser.save({ session });

    // Store the pendingRegistrationId before deleting
    const storedPendingId = pendingId;

    // Delete the pending registration
    const deleteResult = await PendingRegistration.findByIdAndDelete(
      pendingId,
      { session }
    );
    if (!deleteResult) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ message: "Failed to delete pending registration" });
    }

    // Delete related notifications
    await Notification.deleteMany({
      pendingRegistrationId: pendingId,
      type: "employer_approval",
    }).session(session);

    // Create approval notification
    const notification = new Notification({
      recipient: newUser._id,
      sender: req.user.id,
      type: "employer_approval",
      message: "Your account has been approved by the admin",
      status: "approved",
      read: false,
      pendingRegistrationId: storedPendingId,
    });
    await notification.save({ session });

    // Commit the transaction
    await session.commitTransaction();

    res.json({
      message: "Employer approved successfully",
      employer: newUser,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error in approve employer:", error);
    res.status(500).json({
      message: "Error during approval process",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
});

// Add a GET route handler for the approval endpoint that redirects to the POST handler
router.get("/approve/:pendingId", auth, async (req, res) => {
  // This is a fallback for when a GET request is made instead of a POST request
  // We'll return a 405 Method Not Allowed response with a message
  res.status(405).json({
    message:
      "Method Not Allowed. Please use POST request instead of GET for this endpoint.",
    error:
      "This endpoint requires a POST request with the 'approvedBy' field in the request body.",
  });
});

// Reject registration
router.post("/reject/:pendingId", auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { pendingId } = req.params;
    const { rejectedBy } = req.body;

    // Validate inputs
    if (!rejectedBy) {
      await session.abortTransaction();
      return res.status(400).json({ message: "rejectedBy is required" });
    }

    // Verify the requesting user is an admin
    if (req.user.role !== "admin") {
      await session.abortTransaction();
      return res
        .status(403)
        .json({ message: "Only admins can reject employers" });
    }

    // Find and delete the pending registration
    const deleteResult = await PendingRegistration.findByIdAndDelete(
      pendingId,
      { session }
    );
    if (!deleteResult) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ message: "Pending registration not found" });
    }

    // Delete related notifications
    await Notification.deleteMany({
      pendingRegistrationId: pendingId,
      type: "employer_approval",
    }).session(session);

    // Commit the transaction
    await session.commitTransaction();

    res.json({
      message: "Employer rejected successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error in reject employer:", error);
    res.status(500).json({
      message: "Error during rejection process",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
});

// Get pending approvals
router.get("/pending-approvals/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let notifications;
    if (user.role === "admin") {
      notifications = await Notification.find({
        type: "employer_approval",
        status: "pending",
      }).populate("pendingRegistrationId");
    } else if (user.role === "employer") {
      notifications = await Notification.find({
        recipient: userId,
        type: "employee_approval",
        status: "pending",
      }).populate("pendingRegistrationId");
    }

    res.json(notifications || []);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Initialize admin user
router.post("/init-admin", async (req, res) => {
  try {
    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin user already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("admin123", salt);

    const admin = new User({
      username: "admin",
      email: "admin@gmail.com",
      password: hashedPassword,
      role: "admin",
      isApproved: true,
    });

    await admin.save();
    res.json({ message: "Admin user created successfully" });
  } catch (error) {
    console.error("Error creating admin user:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ======================
// COMMUTE ROUTES
// ======================

// Get user's commutes
router.get("/users/:id/commutes", async (req, res) => {
  try {
    const { method, startDate, endDate } = req.query;
    const query = { employeeId: req.params.id };

    if (method) query.method = method;
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const commutes = await Commute.find(query).sort({ date: -1 }).limit(100);

    res.json(commutes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Log new commute
router.post("/users/:id/commutes", async (req, res) => {
  try {
    const { method, startLocation, endLocation, distanceKm } = req.body;

    if (!method || !startLocation || !endLocation || !distanceKm) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newCommute = new Commute({
      employeeId: req.params.id,
      method,
      startLocation,
      endLocation,
      distanceKm: parseFloat(distanceKm),
    });

    await newCommute.save();

    const creditsEarned = Math.floor(newCommute.carbonSaved / 5);
    if (creditsEarned > 0) {
      await User.findByIdAndUpdate(req.params.id, {
        $inc: { carbonCredits: creditsEarned },
      });
    }

    res.status(201).json({
      message: "Commute logged successfully",
      commute: newCommute,
      creditsEarned,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// ======================
// UTILITY ROUTES
// ======================

// Verify credentials
router.post("/verify-credentials", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({
      email: { $regex: new RegExp("^" + email + "$", "i") },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    res.json({
      isValid: isMatch,
      message: isMatch ? "Password is correct" : "Password is incorrect",
    });
  } catch (error) {
    console.error("Verify credentials error:", error);
    res.status(500).json({
      message: "Server error during verification",
      error: error.message,
    });
  }
});

// ======================
// EMPLOYEE MANAGEMENT ROUTES
// ======================

// Delete an employee
router.delete("/employee/:employeeId", auth, async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Validate employeeId format
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ message: "Invalid employee ID format" });
    }

    // Find the employee
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Check if the requesting user is the employer of this employee or an admin
    if (
      req.user.role !== "admin" &&
      req.user.id !== employee.employerId?.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this employee" });
    }

    // Delete the employee and all associated data
    await Promise.all([
      // Delete the employee
      User.findByIdAndDelete(employeeId),
      // Delete notifications
      Notification.deleteMany({
        $or: [{ recipient: employeeId }, { sender: employeeId }],
      }),
      // Delete commutes
      Commute.deleteMany({ userId: employeeId }),
      // Delete trades
      Transaction.deleteMany({
        $or: [{ employerId: employeeId }, { acceptorId: employeeId }],
      }),
    ]);

    res.json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error("Error deleting employee:", error);
    res.status(500).json({
      message: "Error deleting employee",
      error: error.message,
    });
  }
});

// Get employees for an employer
router.get("/employer/:employerId/employees", auth, async (req, res) => {
  try {
    const { employerId } = req.params;

    // Get approved employees from User model
    const approvedEmployees = await User.find({
      employerId,
      role: "employee",
      isApproved: true,
    }).select("-password");

    // Get pending employees from both User and PendingRegistration models
    const [pendingUsers, pendingRegistrations] = await Promise.all([
      User.find({
        employerId,
        role: "employee",
        isApproved: false,
      }).select("-password"),
      PendingRegistration.find({
        employerId,
        role: "employee",
        status: "pending",
      }),
    ]);

    // Combine pending employees
    const pendingEmployees = [
      ...pendingUsers,
      ...pendingRegistrations.map((reg) => ({
        _id: reg._id,
        username: reg.username,
        email: reg.email,
        role: reg.role,
        status: reg.status,
        createdAt: reg.createdAt,
      })),
    ];

    res.json({
      approved: approvedEmployees,
      pending: pendingEmployees,
    });
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ message: "Error fetching employees" });
  }
});

// Approve employee registration
router.post("/approve-employee/:employeeId", auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { employeeId } = req.params;
    const { approvedBy } = req.body;

    // Validate inputs
    if (!approvedBy) {
      await session.abortTransaction();
      return res.status(400).json({ message: "approvedBy is required" });
    }

    // Verify the requesting user is the employer
    if (req.user.id !== approvedBy || req.user.role !== "employer") {
      await session.abortTransaction();
      return res
        .status(403)
        .json({ message: "Unauthorized to approve employees" });
    }

    // Find the pending registration
    const pendingEmployee = await PendingRegistration.findById(
      employeeId
    ).session(session);
    if (!pendingEmployee) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ message: "Pending registration not found" });
    }

    // Verify the employee belongs to the employer
    if (pendingEmployee.employerId.toString() !== approvedBy) {
      await session.abortTransaction();
      return res
        .status(403)
        .json({ message: "Cannot approve employee from another company" });
    }

    // Create new user
    const newUser = new User({
      username: pendingEmployee.username,
      email: pendingEmployee.email,
      password: pendingEmployee.password,
      role: pendingEmployee.role,
      employerId: pendingEmployee.employerId,
      isApproved: true,
      status: "approved",
      approvedBy,
      approvedAt: new Date(),
    });

    // Save the new user
    await newUser.save({ session });

    // Store the pendingRegistrationId before deleting
    const storedPendingId = employeeId;

    // Delete the pending registration
    const deleteResult = await PendingRegistration.findByIdAndDelete(
      employeeId,
      { session }
    );
    if (!deleteResult) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ message: "Failed to delete pending registration" });
    }

    // Delete related notifications
    await Notification.deleteMany({
      pendingRegistrationId: employeeId,
      type: "employee_approval",
    }).session(session);

    // Create approval notification
    const notification = new Notification({
      recipient: newUser._id,
      sender: req.user.id,
      type: "employee_approval",
      message: "Your account has been approved by your employer",
      status: "approved",
      read: false,
      pendingRegistrationId: storedPendingId,
    });
    await notification.save({ session });

    // Commit the transaction
    await session.commitTransaction();

    res.json({
      message: "Employee approved successfully",
      employee: newUser,
    });
  } catch (error) {
    // If anything fails, rollback the transaction
    await session.abortTransaction();
    console.error("Error in approve-employee:", error);
    res.status(500).json({
      message: "Error during approval process",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
});

// Reject employee registration
router.post("/reject-employee/:employeeId", auth, async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Find and delete the pending registration
    const pendingEmployee = await PendingRegistration.findById(employeeId);
    if (!pendingEmployee) {
      return res
        .status(404)
        .json({ message: "Pending registration not found" });
    }

    // Delete the pending registration
    await PendingRegistration.findByIdAndDelete(employeeId);

    res.json({
      message: "Employee rejected successfully",
    });
  } catch (error) {
    console.error("Error in reject-employee:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

// Get pending employers
router.get("/users/pending/employers", async (req, res) => {
  try {
    // Get pending employers from both User and PendingRegistration models
    const [pendingUsersEmployers, pendingRegistrationEmployers] =
      await Promise.all([
        User.find({
          role: "employer",
          status: "pending",
        }).sort({ createdAt: -1 }),
        PendingRegistration.find({
          role: "employer",
          status: "pending",
        }).sort({ createdAt: -1 }),
      ]);

    // Combine and sort by creation date
    const allPendingEmployers = [
      ...pendingUsersEmployers,
      ...pendingRegistrationEmployers,
    ].sort((a, b) => b.createdAt - a.createdAt);

    res.json(allPendingEmployers);
  } catch (error) {
    console.error("Error fetching pending employers:", error);
    res.status(500).json({ message: "Error fetching pending employers" });
  }
});

// ======================
// EMPLOYER ROUTES
// ======================

// Get all employers (admin only)
router.get("/employers", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only admins can view all employers" });
    }

    const employers = await User.find(
      { role: "employer" },
      { password: 0 }
    ).sort({ createdAt: -1 });

    res.json(employers);
  } catch (error) {
    console.error("Error fetching all employers:", error);
    res.status(500).json({
      message: "Error fetching employers",
      error: error.message,
    });
  }
});

// Approve employer (admin only)
router.post("/employers/:id/approve", auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { approvedBy } = req.body;

    if (req.user.role !== "admin") {
      await session.abortTransaction();
      return res
        .status(403)
        .json({ message: "Only admins can approve employers" });
    }

    if (!approvedBy) {
      await session.abortTransaction();
      return res.status(400).json({ message: "approvedBy is required" });
    }

    const pendingEmployer = await PendingRegistration.findById(id).session(
      session
    );
    if (!pendingEmployer) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ message: "Pending registration not found" });
    }

    const newUser = new User({
      username: pendingEmployer.username,
      email: pendingEmployer.email,
      password: pendingEmployer.password,
      role: "employer",
      companyName: pendingEmployer.companyName,
      isApproved: true,
      approvedBy,
      approvedAt: new Date(),
    });

    await newUser.save({ session });
    await PendingRegistration.findByIdAndDelete(id, { session });

    // Create approval notification
    const notification = new Notification({
      recipient: newUser._id,
      sender: approvedBy,
      type: "employer_approval",
      message: "Your employer account has been approved",
      status: "approved",
      pendingRegistrationId: id,
    });

    await notification.save({ session });
    await session.commitTransaction();

    res.json({
      message: "Employer approved successfully",
      employer: newUser,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error approving employer:", error);
    res.status(500).json({
      message: "Error during approval process",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
});

// Reject employer (admin only)
router.post("/employers/:id/reject", auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { rejectedBy } = req.body;

    if (req.user.role !== "admin") {
      await session.abortTransaction();
      return res
        .status(403)
        .json({ message: "Only admins can reject employers" });
    }

    if (!rejectedBy) {
      await session.abortTransaction();
      return res.status(400).json({ message: "rejectedBy is required" });
    }

    const pendingEmployer = await PendingRegistration.findById(id).session(
      session
    );
    if (!pendingEmployer) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ message: "Pending registration not found" });
    }

    await PendingRegistration.findByIdAndDelete(id, { session });
    await session.commitTransaction();

    res.json({ message: "Employer rejected successfully" });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error rejecting employer:", error);
    res.status(500).json({
      message: "Error during rejection process",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
});

// Fetch available tradings
router.get("/available", auth, async (req, res) => {
  try {
    const { id: employerId } = req.user;

    const tradings = await Trading.find({
      employerId: { $ne: employerId },
    }).sort({ createdAt: -1 });
    res.json(tradings);
  } catch (error) {
    console.error("Error fetching available tradings:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});
// Get approved employers (public route)
router.get("/employers/public", async (req, res) => {
  try {
    const employers = await User.find(
      { role: "employer", isApproved: true },
      { _id: 1, companyName: 1 }
    ).sort({ companyName: 1 });
    res.json(employers);
  } catch (error) {
    console.error("Error fetching employers:", error);
    res.status(500).json({ message: "Failed to fetch employers" });
  }
});

// Delete a user (employee or employer)
router.delete("/users/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }

    // Find and delete the user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check authorization
    if (
      req.user.role !== "admin" &&
      req.user.id !== user.employerId?.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this user" });
    }

    // Delete the user
    await User.findByIdAndDelete(userId);

    // Delete associated notifications
    await Notification.deleteMany({
      $or: [{ recipient: userId }, { sender: userId }],
    });

    // Delete associated commutes
    await Commute.deleteMany({ userId: userId });

    // Delete associated trades
    await Transaction.deleteMany({
      $or: [{ employerId: userId }, { acceptorId: userId }],
    });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res
      .status(500)
      .json({ message: "Error deleting user", error: error.message });
  }
});

// Delete all employees of an employer

router.delete("/employer/:employerId/employees", auth, async (req, res) => {
  try {
    const { employerId } = req.params;

    // Validate employerId format
    if (!mongoose.Types.ObjectId.isValid(employerId)) {
      return res.status(400).json({ message: "Invalid employer ID format" });
    }

    // Check authorization
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Not authorized to perform this action" });
    }

    // Find all employees of the employer
    const employees = await User.find({ employerId });

    // Delete all associated data for each employee
    for (const employee of employees) {
      // Delete notifications
      await Notification.deleteMany({
        $or: [{ recipient: employee._id }, { sender: employee._id }],
      });

      // Delete commutes
      await Commute.deleteMany({ userId: employee._id });

      // Delete trades
      await Transaction.deleteMany({
        $or: [{ employerId: employee._id }, { acceptorId: employee._id }],
      });
    }

    // Delete all employees
    await User.deleteMany({ employerId });

    res.json({ message: "All employees deleted successfully" });
  } catch (error) {
    console.error("Error deleting employees:", error);
    res
      .status(500)
      .json({ message: "Error deleting employees", error: error.message });
  }
});

module.exports = router;