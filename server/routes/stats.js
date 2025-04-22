const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Commute = require("../models/Commute");

// Get overall system stats
router.get("/system", async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
          totalCredits: { $sum: { $ifNull: ["$carbonCredits", 0] } },
        },
      },
    ]);

    const result = {
      totalUsers: stats.reduce((sum, role) => sum + role.count, 0),
      employers: stats.find((role) => role._id === "employer")?.count || 0,
      employees: stats.find((role) => role._id === "employee")?.count || 0,
      totalCredits: stats.reduce((sum, role) => sum + role.totalCredits, 0),
      totalTransactions: await Commute.countDocuments({ status: "approved" }),
    };

    res.json(result);
  } catch (error) {
    console.error("Error fetching system stats:", error);
    res.status(500).json({ message: "Error fetching system stats" });
  }
});

// Get employer stats
router.get("/employer/:employerId", async (req, res) => {
  try {
    const { employerId } = req.params;

    // Get employees count
    const employees = await User.find({ employerId, role: "employee" });
    const employeeIds = employees.map((emp) => emp._id);

    // Get commutes for these employees
    const commutes = await Commute.find({
      employeeId: { $in: employeeIds },
      status: "approved",
    });

    // Calculate stats
    const totalEmployees = employees.length;
    const totalCarbonCredits = employees.reduce(
      (sum, emp) => sum + (emp.carbonCredits || 0),
      0
    );
    const totalTransactions = commutes.length;

    // Calculate monthly carbon credits
    const currentMonth = new Date().getMonth();
    const monthlyCarbonCredits = commutes
      .filter((commute) => new Date(commute.date).getMonth() === currentMonth)
      .reduce((sum, commute) => sum + commute.carbonSaved, 0);

    res.json({
      totalEmployees,
      totalCarbonCredits,
      totalTransactions,
      monthlyCarbonCredits,
    });
  } catch (error) {
    console.error("Error fetching employer stats:", error);
    res.status(500).json({ message: "Error fetching employer stats" });
  }
});

// Get employee stats
router.get("/employee/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Get all commutes for this employee
    const commutes = await Commute.find({ employeeId, status: "approved" });

    // Calculate stats
    const totalCommutes = commutes.length;
    const totalDistance = commutes.reduce(
      (sum, commute) => sum + commute.distanceKm,
      0
    );
    const totalCarbonSaved = commutes.reduce(
      (sum, commute) => sum + commute.carbonSaved,
      0
    );

    // Calculate monthly carbon saved
    const currentMonth = new Date().getMonth();
    const monthlyCarbonSaved = commutes
      .filter((commute) => new Date(commute.date).getMonth() === currentMonth)
      .reduce((sum, commute) => sum + commute.carbonSaved, 0);

    res.json({
      totalCommutes,
      totalDistance,
      totalCarbonSaved,
      monthlyCarbonSaved,
    });
  } catch (error) {
    console.error("Error fetching employee stats:", error);
    res.status(500).json({ message: "Error fetching employee stats" });
  }
});

module.exports = router;
