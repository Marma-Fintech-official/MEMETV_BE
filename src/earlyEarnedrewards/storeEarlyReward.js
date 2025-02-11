const fs = require('fs');
const User = require('../models/userModel');
const mongoose = require('mongoose');
const path = require('path'); // Import path module to manage file paths

async function generateUserJson() {
    try {
        const users = await User.find({}, "telegramId balanceRewards promoRewards levelUpRewards referRewards watchRewards gameRewards taskRewards streakRewards stakingRewards"); // Fetch only needed fields

        // Format the data
        const userData = users.map(user => {
            const otherRewardsTotal = 
                (user.promoRewards || 0) +
                (user.levelUpRewards || 0) +
                (user.referRewards || 0) +
                (user.gameRewards?.gamePoints || 0) +
                (user.taskRewards?.taskPoints || 0) +
                (user.streakRewards || 0) +
                (user.stakingRewards || 0);
            
            return {
                telegramId: user.telegramId,
                balanceRewards: user.balanceRewards,
                watchRewards: user.watchRewards,
                otherRewards: otherRewardsTotal
            };
        });

        // Define the path to save the JSON file inside the earlyEarnedrewards folder
        const filePath = path.join(__dirname, 'userData.json');

        const directoryPath = path.join(__dirname);
        if(!fs.existsSync(directoryPath)){
            fs.mkdirSync(directoryPath);
        }

        // Convert to JSON and save to file
        fs.writeFileSync(filePath, JSON.stringify(userData, null, 2));

        console.log("JSON file generated successfully!");
        mongoose.connection.close();
    } catch (error) {
        console.error("Error generating JSON:", error);
        mongoose.connection.close();
    }
}

module.exports = {generateUserJson};
