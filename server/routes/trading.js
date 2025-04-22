const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const User = require("../models/User");
const Trading = require("../models/Trading");
const mongoose = require("mongoose");

// Create a new trading offer
router.post("/create", auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { credits } = req.body;

    // Validate inputs
    if (!credits || isNaN(credits) || credits <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Invalid credit amount" });
    }

    // Verify the requesting user is an employer
    if (req.user.role !== "employer") {
      await session.abortTransaction();
      return res
        .status(403)
        .json({ message: "Only employers can create trades" });
    }

    // Get employer and their employees to check available credits
    const employer = await User.findById(req.user.id).session(session);
    if (!employer) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Employer not found" });
    }

    // Get all employees of this employer
    const employees = await User.find({
      employerId: req.user.id,
      role: "employee",
    }).session(session);

    // Calculate total team credits
    const employeeCredits = employees.reduce(
      (sum, emp) => sum + (emp.carbonCredits || 0),
      0
    );
    const totalTeamCredits = (employer.carbonCredits || 0) + employeeCredits;

    // Check if they have enough credits to offer
    if (totalTeamCredits < credits) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Insufficient team credits",
        availableCredits: totalTeamCredits,
        requestedCredits: credits,
        employerCredits: employer.carbonCredits || 0,
        employeeCredits: employeeCredits,
      });
    }

    // Create new trading offer without deducting credits
    const newTrade = new Trading({
      employerId: req.user.id,
      companyName: employer.companyName,
      amount: credits,
      status: "available",
    });

    await newTrade.save({ session });
    await session.commitTransaction();

    res.json({
      message: "Trading offer created successfully",
      trade: newTrade,
      updatedTeamCredits: {
        employer: employer.carbonCredits,
        employees: employeeCredits,
        total: totalTeamCredits,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error creating trade:", error);
    res
      .status(500)
      .json({ message: "Error creating trade", error: error.message });
  } finally {
    session.endSession();
  }
});

// Get available trades
router.get("/available", auth, async (req, res) => {
  try {
    // Get all available trades except those from the requesting employer
    const trades = await Trading.find({
      status: "available",
      employerId: { $ne: req.user.id },
    })
      .sort({ createdAt: -1 })
      .populate("employerId", "companyName");

    res.json(trades);
  } catch (error) {
    console.error("Error fetching available trades:", error);
    res
      .status(500)
      .json({ message: "Error fetching trades", error: error.message });
  }
});

// Accept a trade
router.post("/accept/:tradeId", auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { tradeId } = req.params;

    // Verify the requesting user is an employer
    if (req.user.role !== "employer") {
      await session.abortTransaction();
      return res
        .status(403)
        .json({ message: "Only employers can accept trades" });
    }

    // Find the trade
    const trade = await Trading.findById(tradeId).session(session);
    if (!trade || trade.status !== "available") {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ message: "Trade not found or not available" });
    }

    // Get the trading employer (seller)
    const tradingEmployer = await User.findById(trade.employerId).session(
      session
    );
    if (!tradingEmployer) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Trading employer not found" });
    }

    // Get the accepting employer (buyer)
    const acceptingEmployer = await User.findById(req.user.id).session(session);
    if (!acceptingEmployer) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Accepting employer not found" });
    }

    // Get trading employer's employees
    const tradingEmployerEmployees = await User.find({
      employerId: trade.employerId,
      role: "employee",
    }).session(session);

    // Calculate total available credits for trading employer
    const employeeCredits = tradingEmployerEmployees.reduce(
      (sum, emp) => sum + (emp.carbonCredits || 0),
      0
    );
    const totalTeamCredits =
      (tradingEmployer.carbonCredits || 0) + employeeCredits;

    // Verify trading employer still has enough credits
    if (totalTeamCredits < trade.amount) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Trading employer no longer has sufficient credits",
        availableCredits: totalTeamCredits,
        requestedCredits: trade.amount,
      });
    }

    // Deduct credits from trading employer first, then from employees if needed
    let remainingCredits = trade.amount;

    // First try to deduct from employer
    if (tradingEmployer.carbonCredits > 0) {
      const employerDeduction = Math.min(
        tradingEmployer.carbonCredits,
        remainingCredits
      );
      tradingEmployer.carbonCredits -= employerDeduction;
      remainingCredits -= employerDeduction;
      await tradingEmployer.save({ session });
    }

    // If still need more credits, deduct from employees
    if (remainingCredits > 0) {
      for (const employee of tradingEmployerEmployees) {
        if (employee.carbonCredits > 0) {
          const employeeDeduction = Math.min(
            employee.carbonCredits,
            remainingCredits
          );
          employee.carbonCredits -= employeeDeduction;
          remainingCredits -= employeeDeduction;
          await employee.save({ session });

          if (remainingCredits === 0) break;
        }
      }
    }

    // Add credits to accepting employer
    acceptingEmployer.carbonCredits += trade.amount;
    await acceptingEmployer.save({ session });

    // Update trade status
    trade.status = "accepted";
    trade.acceptorId = req.user.id;
    trade.acceptedAt = new Date();
    await trade.save({ session });

    await session.commitTransaction();
    res.json({
      message: "Trade accepted successfully",
      trade: trade,
      updatedCredits: {
        seller: {
          employer: tradingEmployer.carbonCredits,
          team: tradingEmployer.carbonCredits + employeeCredits,
        },
        buyer: acceptingEmployer.carbonCredits,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error accepting trade:", error);
    res
      .status(500)
      .json({ message: "Error accepting trade", error: error.message });
  } finally {
    session.endSession();
  }
});

// Get all trades (admin only)
router.get("/all", auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only admins can view all trades" });
    }

    // Get all trades and populate employer and acceptor details
    const trades = await Trading.find()
      .populate("employerId", "companyName username")
      .populate("acceptorId", "companyName username")
      .sort({ createdAt: -1 });

    // Transform the data to include company names
    const transformedTrades = trades.map((trade) => ({
      ...trade.toObject(),
      companyName: trade.employerId.companyName,
      acceptorName: trade.acceptorId ? trade.acceptorId.companyName : null,
    }));

    res.json(transformedTrades);
  } catch (error) {
    console.error("Error fetching all trades:", error);
    res
      .status(500)
      .json({ message: "Error fetching trades", error: error.message });
  }
});

// Get company trading history
router.get("/company-history/:employerId", auth, async (req, res) => {
  try {
    const { employerId } = req.params;
    console.log(`Fetching trading history for employer ${employerId}`);
    console.log(`Request user ID: ${req.user.id}`);

    // Validate employerId
    if (!employerId || !mongoose.Types.ObjectId.isValid(employerId)) {
      console.log("Invalid employerId format");
      return res.status(400).json({
        message: "Invalid employer ID format. Please provide a valid ID.",
      });
    }

    // Verify the requesting user is the employer
    if (req.user.id !== employerId) {
      console.log("Unauthorized access attempt");
      return res.status(403).json({
        message: "You can only view your own company's trading history.",
      });
    }

    // Get all trades where the company is either the seller or buyer with populated company names
    const trades = await Trading.find({
      $or: [{ employerId: employerId }, { acceptorId: employerId }],
    })
      .populate("employerId", "companyName")
      .populate("acceptorId", "companyName")
      .sort({ createdAt: -1 });

    console.log(`Found ${trades.length} trades`);

    // Get the employer's current total credits
    const employer = await User.findById(employerId);
    if (!employer) {
      console.log("Employer not found");
      return res.status(404).json({
        message: "Employer account not found. Please verify the employer ID.",
      });
    }

    // Get all employees' credits
    const employees = await User.find({
      employerId: employerId,
      role: "employee",
    });

    const totalCredits =
      employer.carbonCredits +
      employees.reduce((sum, emp) => sum + (emp.carbonCredits || 0), 0);

    console.log(`Total credits: ${totalCredits}`);

    // Format the response with detailed trade information
    const response = {
      totalCredits,
      tradeHistory: trades.map((trade) => {
        const isOutgoing = trade.employerId._id.toString() === employerId;
        console.log(
          `Trade ${trade._id}: isOutgoing=${isOutgoing}, employerId=${trade.employerId._id}, acceptorId=${trade.acceptorId?._id}`
        );

        return {
          date: trade.createdAt,
          amount: trade.amount,
          type: isOutgoing ? "out" : "in",
          status: trade.status,
          partnerCompany: isOutgoing
            ? trade.acceptorId?.companyName || "Pending"
            : trade.employerId.companyName,
          transactionId: trade._id,
        };
      }),
    };

    console.log("Successfully prepared trading history response");
    res.json(response);
  } catch (error) {
    console.error("Error in /company-history/:employerId:", error);
    res.status(500).json({
      message: "Failed to fetch trading history. Please try again later.",
      error: error.message,
    });
  }
});

module.exports = router;
