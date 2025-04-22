const express = require("express");
const router = express.Router();
const Commute = require("../models/Commute");
const User = require("../models/User");

// Get all commutes for an employee
router.get("/", async (req, res) => {
  try {
    const { employeeId } = req.query;
    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID is required" });
    }

    const commutes = await Commute.find({ employeeId })
      .sort({ date: -1 })
      .populate("employeeId", "username");

    res.json(commutes);
  } catch (error) {
    console.error("Error fetching commutes:", error);
    res.status(500).json({ message: "Error fetching commutes" });
  }
});

// Add a new commute
router.post("/", async (req, res) => {
  try {
    const {
      employeeId,
      date,
      method,
      startLocation,
      endLocation,
      distanceKm,
      carbonSaved,
    } = req.body;

    // Validate required fields
    if (
      !employeeId ||
      !date ||
      !method ||
      !startLocation ||
      !endLocation ||
      !distanceKm ||
      !carbonSaved
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Validate method
    const validMethods = [
      "bike",
      "walk",
      "carpool",
      "public_transport",
      "electric_vehicle",
      "car",
    ];
    if (!validMethods.includes(method)) {
      return res.status(400).json({ message: "Invalid transportation method" });
    }

    // Create new commute
    const newCommute = new Commute({
      employeeId,
      date,
      method,
      startLocation,
      endLocation,
      distanceKm,
      carbonSaved,
      status: "pending",
    });

    await newCommute.save();

    // Update user's carbon credits
    const user = await User.findById(employeeId);
    if (user) {
      user.carbonCredits = (user.carbonCredits || 0) + carbonSaved;
      await user.save();
    }

    res.status(201).json(newCommute);
  } catch (error) {
    console.error("Error adding commute:", error);
    res.status(500).json({ message: "Error adding commute" });
  }
});

// Update commute status
router.put("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const commute = await Commute.findById(id);
    if (!commute) {
      return res.status(404).json({ message: "Commute not found" });
    }

    const user = await User.findById(commute.employeeId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Calculate credits based on distance and method
    const creditsEarned = calculateCredits(commute.distanceKm, commute.method);

    // If changing from approved to rejected, subtract credits
    if (commute.status === "approved" && status === "rejected") {
      user.carbonCredits = Math.max(
        0,
        (user.carbonCredits || 0) - creditsEarned
      );
    }
    // If changing from rejected to approved, add credits
    else if (commute.status === "rejected" && status === "approved") {
      user.carbonCredits = (user.carbonCredits || 0) + creditsEarned;
    }
    // If changing from pending to approved, add credits
    else if (commute.status === "pending" && status === "approved") {
      user.carbonCredits = (user.carbonCredits || 0) + creditsEarned;
    }
    // If changing from pending to rejected, no change in credits
    else if (commute.status === "pending" && status === "rejected") {
      // No credit change needed
    }

    await user.save();
    commute.status = status;
    await commute.save();

    res.json({
      commute,
      creditsEarned,
      totalCredits: user.carbonCredits,
    });
  } catch (error) {
    console.error("Error updating commute status:", error);
    res.status(500).json({ message: "Error updating commute status" });
  }
});

// Get credit history for an employee
router.get("/employee/:employeeId/history", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query;

    const query = {
      employeeId,
    };

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate + "T00:00:00.000Z"),
        $lte: new Date(endDate + "T23:59:59.999Z"),
      };
    }

    const commutes = await Commute.find(query)
      .sort({ date: -1 })
      .select("date method distanceKm carbonSaved status");

    const creditHistory = commutes.map((commute) => ({
      date: commute.date,
      method: commute.method.replace("_", " "),
      distance: commute.distanceKm,
      credits: Math.floor(commute.carbonSaved * 10), // Convert carbon saved to credits
      status: commute.status,
    }));

    res.json(creditHistory);
  } catch (error) {
    console.error("Error fetching credit history:", error);
    res.status(500).json({ message: "Error fetching credit history" });
  }
});

// Helper function to calculate credits based on distance and method
function calculateCredits(distance, method) {
  const baseRate = 0.1; // Base rate per km
  const methodMultipliers = {
    bike: 2,
    walk: 3,
    carpool: 1.5,
    public_transport: 1.2,
    electric_vehicle: 1.8,
    car: 0.5,
  };

  const multiplier = methodMultipliers[method] || 1;
  return Math.round(distance * baseRate * multiplier);
}

// Delete a commute
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const commute = await Commute.findById(id);

    if (!commute) {
      return res.status(404).json({ message: "Commute not found" });
    }

    // Update user's carbon credits
    const user = await User.findById(commute.employeeId);
    if (user) {
      user.carbonCredits = (user.carbonCredits || 0) - commute.carbonSaved;
      await user.save();
    }

    await commute.remove();
    res.json({ message: "Commute deleted successfully" });
  } catch (error) {
    console.error("Error deleting commute:", error);
    res.status(500).json({ message: "Error deleting commute" });
  }
});

module.exports = router;
