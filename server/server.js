const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const authRoutes = require("./routes/auth");
const User = require("./models/User");
const commuteRoutes = require("./routes/commutes");
const statsRoutes = require("./routes/stats");
const tradingRoutes = require("./routes/trading");
dotenv.config();

const app = express();
app.use((err, req, res, next) => {
  console.error("Global error handler:", err.stack);
  res.status(500).json({
    message: "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/commutes", commuteRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/trading", tradingRoutes);

// Basic route
app.get("/", (req, res) => {
  res.json({ message: "EcoCredit API is running" });
});

// 404 handler - must be before error handler
app.use((req, res, next) => {
  res.status(404).json({
    message: "Endpoint not found",
    path: req.path,
  });
});

// Error handler - must be last
app.use((err, req, res, next) => {
  console.error("Global error handler:", err);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err : {},
  });
});

// Database connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB");

    // Delete any existing admin users
    await User.deleteMany({ role: "admin" });
    console.log("Cleared existing admin users");

    // Create new admin user
    const adminPassword = "admin@123";
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    // Verify the hash before saving
    const verifyHash = await bcrypt.compare(adminPassword, hashedPassword);
    console.log("Password hash verification:", verifyHash);

    const admin = new User({
      username: "admin",
      email: "admin@gmail.com",
      password: hashedPassword,
      role: "admin",
      isApproved: true,
    });

    await admin.save();
    console.log("=========================================");
    console.log("ADMIN CREDENTIALS:");
    console.log("Email: admin@gmail.com");
    console.log("Password: admin@123");
    console.log("=========================================");

    // Verify the admin was created correctly
    const verifyAdmin = await User.findOne({ role: "admin" });
    if (verifyAdmin) {
      const passwordMatch = await bcrypt.compare(
        adminPassword,
        verifyAdmin.password
      );
      console.log("Admin verification successful:", passwordMatch);
      if (!passwordMatch) {
        console.error("ERROR: Admin password verification failed!");
        // Delete and recreate if verification fails
        await User.deleteOne({ role: "admin" });
        throw new Error("Admin password verification failed");
      }
    } else {
      console.error("ERROR: Admin user not found after creation!");
    }
  })
  .catch((err) => console.error("MongoDB connection error:", err));

const PORT = process.env.PORT || 9000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
