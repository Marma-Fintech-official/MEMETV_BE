const User = require('../../models/userModel');
const bcrypt = require('bcryptjs');
const Admin = require('../models/adminModel');
const jwt = require('jsonwebtoken');
require('dotenv').config(); 
const TokenBlacklist = require('../models/tokenBlacklist');

const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find admin by email
        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
           { adminId : admin._id, email : admin.email },
           process.env.JWT_SECRET,
           {expiresIn : '1h'}
        );

        res.status(200).json({ message: 'Login successful', token });
    } catch (error) {
        console.error('Error during admin login:', error);
        res.status(500).json({ message: 'Server error' });
    }
}

// Update Admin Password
   const updatePassword=  async (req, res) => {
    try {
        const { email, oldPassword, newPassword } = req.body;

        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        const isMatch = await bcrypt.compare(oldPassword, admin.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Old password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        admin.password = hashedPassword;
        await admin.save();

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
}



const adminLogout = async (req, res) => {
    try {
        const token = req.header('Authorization');
        if (!token) {
            return res.status(400).json({ message: 'No token provided' });
        }

        // Save the token in the blacklist to prevent reuse
        await TokenBlacklist.create({ token });

        res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
        console.error('Error during logout:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getTotalusers = async (req, res)=> {
    try {
        const { timeframe } = req.query; // ✅ Get timeframe from query
        let startDate = null;
        let endDate = new Date(); // End date is always the current time

        if (timeframe === "week") {
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);
        } else if (timeframe === "month") {
            startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 1);
        } else if (timeframe === "today") {
            startDate = new Date();
            startDate.setHours(0, 0, 0, 0); // Set time to start of the day
        }

        // ✅ Change the query to use `updatedAt` instead of `createdAt`
        let query = {};
        if (startDate) {
            query.updatedAt = { $gte: startDate, $lte: endDate };
        }
        console.log("MongoDB Query:", JSON.stringify(query, null, 2)); // ✅ Log the query
        const userCount = await User.countDocuments(query);

        res.status(200).json({ totalUsers: userCount });
        console.log({userCount});
    } catch (error) {
        console.error('Error fetching total users:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}


// const getTotalRewards = async (req, res) => {
//     try {
//         const result = await User.aggregate([
//             {
//                 $group: {
//                     _id: null,
//                     balanceRewards: { $sum: "$balanceRewards" }  // Summing up all users' rewards
//                 }
//             }
//         ]);

//         const balanceRewards = result.length > 0 ? result[0].balanceRewards : 0;

//         res.status(200).json({ balanceRewards });
//     } catch (error) {
//         console.error("Error fetching total rewards:", error);
//         res.status(500).json({ error: "Internal server error" });
//     }
// };

const individualsRewards = async (req, res)=>{
    try {
        const users = await User.find({}, 'name balanceRewards');  // Selecting only specific fields

        if (users.length > 0) {
            res.status(200).json(users);
        } else {
            res.status(404).json({ message: "No users found" });
        }
    } catch (error) {
        console.error("Error fetching users' telegramId and balanceRewards:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}





module.exports = {adminLogin, updatePassword, adminLogout, getTotalusers, individualsRewards};