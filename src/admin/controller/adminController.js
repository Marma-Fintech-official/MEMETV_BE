const User = require("../../models/userModel");
const bcrypt = require("bcryptjs");
const Admin = require("../models/adminModel");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const {
  addToBlacklist,
  isTokenBlacklisted,
} = require("../helper/tokenHandler");
const { verifyToken, createToken } = require("../helper/token");

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "Strict",
};

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find admin by email
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = await createToken({ id: admin._id });

    res.cookie("id", admin._id.toString(), COOKIE_OPTIONS); // Use employee._id
    res.cookie("token", token.toString(), COOKIE_OPTIONS);
    res.status(200).json({ message: "Login successful", token });
    console.log("Generated Token: ", token);
  } catch (error) {
    console.error("Error during admin login:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update Admin Password
const updatePassword = async (req, res) => {
  try {
    const { email, oldPassword, newPassword, confirmNewPassword } = req.body;

    const admin = await Admin.findOne({ email });
    // Validate required fields
    if (!email || !oldPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const isMatch = await bcrypt.compare(oldPassword, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Old password is incorrect" });
    }

    if (newPassword !== confirmNewPassword) {
      return res
        .status(400)
        .json({ message: "New password and confirm password do not match" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    admin.password = hashedPassword;
    await admin.save();

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ message: "Failed to reset password", error });
  }
};

const adminLogout = async (req, res) => {
  try {
    const token = req.header("Authorization");
    if (!token) {
      return res.status(400).json({ message: "No token provided" });
    }

    // Check if the token is already blacklisted
    if (await isTokenBlacklisted(token)) {
      return res.status(401).send({ message: "Token is already blacklisted" });
    }
    await addToBlacklist(token);
    // Clear the token from cookies
    res.clearCookie("id");
    res.clearCookie("token");

    return res.status(200).json({ message: "Logged out successful" });
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getTotalusers = async (req, res) => {
  try {
    const { timeframe } = req.query;
    let startDate = null;
    let endDate = new Date(); // Current time
    let groupBy = null; // Variable to determine grouping method

    // If no timeframe is provided, return total user count in DB
    if (!timeframe) {
      const totalUsers = await User.countDocuments({});
      return res.status(200).json({ totalUsers });
    }
    if (timeframe === "week") {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      groupBy = { $dayOfWeek: "$updatedAt" }; // Group by day of the week
    } else if (timeframe === "month") {
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (timeframe === "today") {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0); // Start of today
    } else {
      return res.status(400).json({ error: "Invalid timeframe" });
    }

    let query = { updatedAt: { $gte: startDate, $lte: endDate } };

    // ✅ Return a single total count for "today" and "month"
    if (timeframe === "today" || timeframe === "month") {
      const totalUsers = await User.countDocuments(query);
      return res.status(200).json({ totalUsers });
    }

    // ✅ Aggregation for week (grouping by day of the week)
    const usersGrouped = await User.aggregate([
      { $match: query },
      { $group: { _id: groupBy, totalUsers: { $sum: 1 } } },
    ]);

    const daysOfWeek = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    let weekData = new Array(7)
      .fill(0)
      .map((_, i) => ({ [daysOfWeek[i]]: { totalUsers: 0 } }));

    usersGrouped.forEach(({ _id, totalUsers }) => {
      const dayName = daysOfWeek[_id % 7]; // Convert number to day name
      weekData[_id - 1] = { [dayName]: { totalUsers } };
    });

    res.status(200).json(weekData);
  } catch (error) {
    console.error("Error fetching total users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const individualsRewards = async (req, res) => {
  try {
    const { page = 1, search } = req.query;
    const limit = 10; 
    const pageNumber = parseInt(page, 10) || 1;

    // Build query
    const query = {};
    if (search) {
      query.name = new RegExp(`^${search.trim()}`, "i"); // Case-insensitive search
    }
    const totalUsers = await User.countDocuments(query);

    if (totalUsers === 0) {
      return res.status(404).json({ message: "No users found" });
    }

    // Paginate only after filtering
    const users = await User.find(query, "name telegramId balanceRewards")
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      totalUsers,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalUsers / limit),
      data: users,
    });
  } catch (error) {
    console.error("Error fetching users' balanceRewards:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];

      if (!token) {
        return res.status(401).json({ message: "No token found" });
      }
      // Check if the token is blacklisted
      if (await isTokenBlacklisted(token)) {
        return res.status(401).json({ message: "Token is blacklisted" });
      }

      // Verify the token
      const decoded = await verifyToken(token);

      req.user = await Admin.findById(decoded.id).select("-password");
      next();
    } else {
      return res
        .status(401)
        .json({ message: "Unauthorized - No token provided" });
    }
  } catch (error) {
    console.error("Unexpected error in protect middleware:", error.message);
    return res.status(500).json({ message: "Invaild token" });
  }
};

module.exports = {
  adminLogin,
  updatePassword,
  adminLogout,
  getTotalusers,
  individualsRewards,
  protect,
};
