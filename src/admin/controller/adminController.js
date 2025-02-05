const User = require('../../models/userModel');

// const signup = async (req, res) => {
//     try {
//       const { email, password } = req.body
//       // Check if email already exists
//       const existingEmployee = await Employee.findOne({ email })
//       if (existingEmployee) {
//         return res.status(400).json({ message: 'Email already exists' })
//       }
  
//       // Hash the password
//       const hashedPassword = await bcrypt.hash(password, 10)
  
//       // Create a new employee
//       const employee = new Employee({ name, email, password: hashedPassword })
//       await employee.save()
  
//       res.status(201).json({ message: 'Signup successful', employee })
//     } catch (error) {
//      next(err)
//     }
//   }

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

        const userCount = await User.countDocuments(query);

        res.status(200).json({ totalUsers: userCount });
    } catch (error) {
        console.error('Error fetching total users:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}


const getTotalRewards = async (req, res) => {
    try {
        const result = await User.aggregate([
            {
                $group: {
                    _id: null,
                    balanceRewards: { $sum: "$balanceRewards" }  // Summing up all users' rewards
                }
            }
        ]);

        const balanceRewards = result.length > 0 ? result[0].balanceRewards : 0;

        res.status(200).json({ balanceRewards });
    } catch (error) {
        console.error("Error fetching total rewards:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const individualsRewards = async (req, res)=>{
    try {
        const users = await User.find({}, 'telegramId balanceRewards');  // Selecting only specific fields

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





module.exports = {getTotalusers, getTotalRewards, individualsRewards};